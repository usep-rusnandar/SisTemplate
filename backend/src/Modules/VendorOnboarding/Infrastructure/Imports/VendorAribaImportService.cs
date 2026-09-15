using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Migration;

public sealed class VendorAribaImportService : IVendorAribaImportService
{
    private const string SourceSystem = "ARIBA";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex EmailPattern = new("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", RegexOptions.Compiled);
    private static readonly (string Type, string Label)[] MandatoryDocuments =
    [
        ("pakta-integritas", "Integrity Pact"),
        ("npwp", "NPWP"),
        ("nib", "NIB"),
        ("akta-pendirian", "Deed of Establishment"),
        ("sppkp", "SPPKP"),
    ];

    private readonly ProcurementDbContext _db;
    private readonly UserManager<VendorIdentityUser> _userManager;
    private readonly IDocumentStorage _storage;
    private readonly IPlaceholderDocumentGenerator _placeholderGenerator;
    private readonly ICurrentActor _currentActor;

    public VendorAribaImportService(
        ProcurementDbContext db,
        UserManager<VendorIdentityUser> userManager,
        IDocumentStorage storage,
        IPlaceholderDocumentGenerator placeholderGenerator,
        ICurrentActor currentActor)
    {
        _db = db;
        _userManager = userManager;
        _storage = storage;
        _placeholderGenerator = placeholderGenerator;
        _currentActor = currentActor;
    }

    public byte[] CreateTemplate() => VendorAribaImportTemplate.Create();

    public async Task<VendorImportBatchDto> ValidateAsync(Stream input, string fileName, CancellationToken cancellationToken)
    {
        using var memory = new MemoryStream();
        await input.CopyToAsync(memory, cancellationToken);
        var bytes = memory.ToArray();
        var fileHash = Convert.ToHexString(SHA256.HashData(bytes));
        var actor = _currentActor.Actor.ActorId;
        var batch = VendorImportBatch.Create(fileName, fileHash, actor);

        var catalog = await LoadCatalogAsync(cancellationToken);
        var payloads = VendorAribaImportWorkbookParser.Parse(bytes, catalog);
        var externalIds = payloads.Select(item => item.Payload.AribaVendorId).Where(value => value.Length > 0).ToArray();
        var emails = payloads.Select(item => item.Payload.PicEmail).Where(value => value.Length > 0).ToArray();
        var lookups = await LoadExistingLookupsAsync(externalIds, emails, cancellationToken);
        var duplicateIds = externalIds.GroupBy(value => value, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1).Select(group => group.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var duplicateEmails = emails.GroupBy(value => value, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1).Select(group => group.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var rows = new List<VendorImportRow>();
        foreach (var item in payloads)
        {
            var payload = item.Payload;
            var issues = Validate(payload, lookups, duplicateIds, duplicateEmails);
            issues.AddRange(item.Notes);
            var status = issues.Any(issue => issue.Level == "error")
                ? VendorImportRowStatuses.Error
                : issues.Count > 0 ? VendorImportRowStatuses.Warning : VendorImportRowStatuses.Ready;
            rows.Add(VendorImportRow.Create(batch.Id, item.RowNumber, payload.AribaVendorId, payload.VendorName,
                payload.PicEmail, status, JsonSerializer.Serialize(issues, JsonOptions), JsonSerializer.Serialize(payload, JsonOptions)));
        }

        batch.SetValidationCounts(rows.Count,
            rows.Count(row => row.Status == VendorImportRowStatuses.Ready),
            rows.Count(row => row.Status == VendorImportRowStatuses.Warning),
            rows.Count(row => row.Status == VendorImportRowStatuses.Error));
        _db.VendorImportBatches.Add(batch);
        _db.VendorImportRows.AddRange(rows);
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(batch, rows);
    }

    public async Task<VendorImportBatchDto?> CommitAsync(Guid batchId, CancellationToken cancellationToken)
    {
        var batch = await _db.VendorImportBatches.FirstOrDefaultAsync(item => item.Id == batchId, cancellationToken);
        if (batch is null) return null;
        if (batch.Status is VendorImportStatuses.Completed or VendorImportStatuses.CompletedWithErrors)
            return await GetAsync(batchId, cancellationToken);
        if (batch.ErrorRows > 0)
            throw new VendorImportCommitException("Commit is blocked while the validated batch contains errors.");
        if (!_storage.IsConfigured)
            throw new InvalidOperationException("Document storage must be configured before committing an Ariba import.");

        var rows = await _db.VendorImportRows.Where(item => item.BatchId == batchId).OrderBy(item => item.RowNumber).ToListAsync(cancellationToken);
        batch.BeginCommit();
        await _db.SaveChangesAsync(cancellationToken);
        var imported = 0;
        var skipped = 0;
        var strategy = _db.Database.CreateExecutionStrategy();

        foreach (var row in rows.Where(item => item.Status is VendorImportRowStatuses.Ready or VendorImportRowStatuses.Warning))
        {
            var payload = JsonSerializer.Deserialize<VendorImportPayload>(row.PayloadJson, JsonOptions)!;
            var lookups = await LoadExistingLookupsAsync([payload.AribaVendorId], [payload.PicEmail], cancellationToken);
            var decision = DecideIdentity(payload, lookups);

            if (decision.Disposition == VendorAribaImportDisposition.Skip)
            {
                var skippedRow = await _db.VendorImportRows.FirstAsync(item => item.Id == row.Id, cancellationToken);
                skippedRow.MarkSkipped(JsonSerializer.Serialize(decision.Issues, JsonOptions));
                skipped++;
                await _db.SaveChangesAsync(cancellationToken);
                continue;
            }

            try
            {
                await strategy.ExecuteAsync(async () =>
                {
                    _db.ChangeTracker.Clear();
                    await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                    var tracked = await _db.VendorImportRows.FirstAsync(item => item.Id == row.Id, cancellationToken);
                    if (decision.Disposition == VendorAribaImportDisposition.Overwrite)
                    {
                        await OverwriteVendorAsync(decision.TargetVendorId!, payload, batch.Id, tracked.PayloadJson, cancellationToken);
                        tracked.MarkImported(decision.TargetVendorId!, JsonSerializer.Serialize(decision.Issues, JsonOptions));
                    }
                    else
                    {
                        await ImportVendorAsync(payload, batch.Id, tracked, cancellationToken);
                    }

                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                });
                imported++;
            }
            catch (Exception exception)
            {
                _db.ChangeTracker.Clear();
                var failedRow = await _db.VendorImportRows.FirstAsync(item => item.Id == row.Id, cancellationToken);
                failedRow.MarkError(JsonSerializer.Serialize(new[] { new ImportIssue("error", "Commit", exception.Message) }, JsonOptions));
                await _db.SaveChangesAsync(cancellationToken);
            }
        }

        batch = await _db.VendorImportBatches.FirstAsync(item => item.Id == batchId, cancellationToken);
        rows = await _db.VendorImportRows.Where(item => item.BatchId == batchId).OrderBy(item => item.RowNumber).ToListAsync(cancellationToken);
        batch.Complete(imported, skipped, rows.Count(item => item.Status == VendorImportRowStatuses.Error));
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(batch, rows);
    }

    public async Task<VendorImportBatchDto?> GetAsync(Guid batchId, CancellationToken cancellationToken)
    {
        var batch = await _db.VendorImportBatches.AsNoTracking().FirstOrDefaultAsync(item => item.Id == batchId, cancellationToken);
        if (batch is null) return null;
        var rows = await _db.VendorImportRows.AsNoTracking().Where(item => item.BatchId == batchId).OrderBy(item => item.RowNumber).ToListAsync(cancellationToken);
        return ToDto(batch, rows);
    }

    public async Task<IReadOnlyList<VendorImportBatchSummaryDto>> ListAsync(CancellationToken cancellationToken) =>
        await _db.VendorImportBatches.AsNoTracking()
            .Where(item => item.FileName != VendorImportSources.VendorConnectBatchName
                && item.FileName != VendorImportSources.VendorConnectDocsBatchName)
            .OrderByDescending(item => item.CreatedAt).Take(30)
            .Select(item => new VendorImportBatchSummaryDto(item.Id, item.FileName, item.Status, item.TotalRows,
                item.ReadyRows, item.WarningRows, item.ErrorRows, item.ImportedRows, item.SkippedRows, item.StartedBy, item.CreatedAt, item.CommittedAt))
            .ToListAsync(cancellationToken);

    private async Task ImportVendorAsync(
        VendorImportPayload payload,
        Guid batchId,
        VendorImportRow tracked,
        CancellationToken cancellationToken)
    {
        var vendor = Vendor.Register(
            Clip(payload.VendorName, 250),
            VendorStatuses.Initial,
            _currentActor.Actor.ActorId,
            $"Imported from {SourceSystem}; officer must invite the vendor to start registration.",
            payload.SourceUpdatedAt);
        ApplyVendorProfile(vendor, payload);
        vendor.SetConsent(false, false);
        _db.Vendors.Add(vendor);
        await _db.SaveChangesAsync(cancellationToken);

        await CreateIdentityAsync(vendor.Id, payload, cancellationToken);
        AddChildren(vendor.Id, payload);
        await UpsertExternalReferenceAsync(vendor.Id, payload, batchId, tracked.PayloadJson, cancellationToken);
        await AddPlaceholderDocumentsAsync(vendor, payload, cancellationToken);
        tracked.MarkImported(vendor.Id);
    }

    private async Task OverwriteVendorAsync(
        string vendorId,
        VendorImportPayload payload,
        Guid batchId,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var vendor = await _db.Vendors.FirstOrDefaultAsync(item => item.Id == vendorId, cancellationToken)
            ?? throw new InvalidOperationException($"INITL vendor {vendorId} was not found for overwrite.");
        if (!VendorAribaImportIdentityRules.IsInitial(vendor.Status))
        {
            throw new InvalidOperationException($"Vendor {vendor.Id} is {vendor.Status} and can no longer be overwritten by Ariba import.");
        }

        ApplyVendorProfile(vendor, payload);
        await ReplaceChildrenAsync(vendor.Id, payload, cancellationToken);
        await UpdateIdentityAsync(vendor.Id, payload, cancellationToken);
        await UpsertExternalReferenceAsync(vendor.Id, payload, batchId, payloadJson, cancellationToken);
        await AddPlaceholderDocumentsAsync(vendor, payload, cancellationToken);
    }

    private static void ApplyVendorProfile(Vendor vendor, VendorImportPayload payload)
    {
        vendor.Rename(Clip(payload.VendorName, 250));
        vendor.UpdateContact(
            Clip(payload.Position, 100),
            Clip(payload.OfficePhoneCountry, 8),
            Clip(payload.OfficePhoneArea, 8),
            Clip(payload.OfficePhoneNumber, 20),
            Clip(payload.HandphoneCountry, 8),
            Clip(payload.HandphoneNumber, 20),
            Clip(payload.WebAddress, 150));
        vendor.SetOfficeAddress(ToAddress(payload.Addresses.FirstOrDefault(address => address.Type == "OFFICE")));
        vendor.SetWarehouseAddress(ToAddress(payload.Addresses.FirstOrDefault(address => address.Type == "WAREHOUSE")));
        vendor.SetWorkshopAddress(ToAddress(payload.Addresses.FirstOrDefault(address => address.Type == "WORKSHOP")));
        vendor.UpdateLegal(
            Clip(payload.NpwpNo, 30),
            Clip(payload.NibNo, 50),
            Clip(payload.AktaPendirianNo, 50),
            payload.AktaPendirianDate,
            Clip(payload.AktaPerubahanNo, 50),
            payload.AktaPerubahanDate,
            Clip(payload.AktaPenyesuaianNo, 50),
            payload.AktaPenyesuaianDate,
            Clip(payload.SppkpNo, 50));
    }

    private void AddChildren(string vendorId, VendorImportPayload payload)
    {
        _db.VendorSubClassifications.AddRange(
            payload.SubClassifications
                .Where(code => code.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(code => VendorSubClassification.Create(vendorId, code)));
        _db.VendorKblis.AddRange(
            payload.Kblis
                .Where(item => item.Code.Length > 0)
                .GroupBy(item => item.TypeCode + "\u001f" + item.Code, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .Select(item => VendorKbli.Create(vendorId, item.TypeCode, item.Code, item.StatusCode)));
        _db.VendorBrands.AddRange(
            payload.Brands
                .Where(item => item.Name.Length > 0)
                .GroupBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .Select(item => VendorBrand.Create(vendorId, item.Name.Length <= 100 ? item.Name : item.Name[..100], item.DistributorTypeCode, item.ExpireDate)));
        _db.VendorCertificates.AddRange(payload.Certificates.Select(item => VendorCertificate.Create(vendorId, item.Number, item.Description, item.ExpireDate)));
        _db.VendorPortfolios.AddRange(payload.Portfolios.Select(item => VendorPortfolio.Create(vendorId, item.Client, item.ScopeOfWork, item.TotalValue, item.StartDate, item.EndDate)));
        _db.VendorSpecialRequirements.AddRange(
            payload.SpecialRequirements
                .Where(item => item.Code.Length > 0)
                .GroupBy(item => item.Code, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .Select(item => VendorSpecialRequirement.Create(vendorId, item.Code, item.Number, item.Description, item.ExpireDate)));
    }

    private async Task ReplaceChildrenAsync(string vendorId, VendorImportPayload payload, CancellationToken cancellationToken)
    {
        _db.VendorSubClassifications.RemoveRange(await _db.VendorSubClassifications.Where(item => item.VendorId == vendorId).ToListAsync(cancellationToken));
        _db.VendorKblis.RemoveRange(await _db.VendorKblis.Where(item => item.VendorId == vendorId).ToListAsync(cancellationToken));
        _db.VendorBrands.RemoveRange(await _db.VendorBrands.Where(item => item.VendorId == vendorId).ToListAsync(cancellationToken));
        _db.VendorCertificates.RemoveRange(await _db.VendorCertificates.Where(item => item.VendorId == vendorId).ToListAsync(cancellationToken));
        _db.VendorPortfolios.RemoveRange(await _db.VendorPortfolios
            .Where(item => item.VendorId == vendorId && item.EnteredByParty != VendorPortfolioParties.Officer)
            .ToListAsync(cancellationToken));
        _db.VendorSpecialRequirements.RemoveRange(await _db.VendorSpecialRequirements.Where(item => item.VendorId == vendorId).ToListAsync(cancellationToken));
        AddChildren(vendorId, payload);
    }

    private async Task CreateIdentityAsync(string vendorId, VendorImportPayload payload, CancellationToken cancellationToken)
    {
        var identity = new VendorIdentityUser
        {
            Id = vendorId,
            UserName = payload.PicEmail,
            Email = payload.PicEmail,
            EmailConfirmed = true,
            CompleteName = Clip(payload.PicName, 256),
            Position = string.IsNullOrWhiteSpace(payload.Position) ? null : payload.Position.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(payload.HandphoneNumber) ? null : payload.HandphoneNumber.Trim(),
            Status = "Active",
            IsActive = payload.IsActive,
            HasLogin = false,
        };
        EnsureIdentitySucceeded(await _userManager.CreateAsync(identity));
        EnsureIdentitySucceeded(await _userManager.AddToRoleAsync(identity, VendorIdentityRoleNames.Vendor));
        if (!await _db.VendorUsers.AnyAsync(link => link.IdentityUserId == identity.Id && link.VendorId == vendorId, cancellationToken))
        {
            _db.VendorUsers.Add(VendorUser.Create(identity.Id, vendorId, isWorkspacePic: true));
        }
    }

    private async Task UpdateIdentityAsync(string vendorId, VendorImportPayload payload, CancellationToken cancellationToken)
    {
        var identity = await _userManager.FindByIdAsync(vendorId);
        if (identity is null)
        {
            var linkedId = await _db.VendorUsers.AsNoTracking()
                .Where(link => link.VendorId == vendorId)
                .OrderByDescending(link => link.IsWorkspacePic)
                .Select(link => link.IdentityUserId)
                .FirstOrDefaultAsync(cancellationToken);
            if (!string.IsNullOrWhiteSpace(linkedId))
            {
                identity = await _userManager.FindByIdAsync(linkedId);
            }
        }

        if (identity is null)
        {
            await CreateIdentityAsync(vendorId, payload, cancellationToken);
            return;
        }

        var emailTaken = await _userManager.FindByEmailAsync(payload.PicEmail);
        if (emailTaken is not null && !string.Equals(emailTaken.Id, identity.Id, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"PIC email {payload.PicEmail} is already used by another vendor account.");
        }

        identity.CompleteName = Clip(payload.PicName, 256);
        identity.Email = payload.PicEmail;
        identity.UserName = payload.PicEmail;
        identity.NormalizedEmail = _userManager.NormalizeEmail(payload.PicEmail);
        identity.NormalizedUserName = _userManager.NormalizeName(payload.PicEmail);
        identity.Position = string.IsNullOrWhiteSpace(payload.Position) ? null : payload.Position.Trim();
        identity.PhoneNumber = string.IsNullOrWhiteSpace(payload.HandphoneNumber) ? null : payload.HandphoneNumber.Trim();
        identity.Status = "Active";
        identity.IsActive = payload.IsActive;
        identity.EmailConfirmed = true;
        identity.HasLogin = false;
        EnsureIdentitySucceeded(await _userManager.UpdateAsync(identity));
        if (!await _userManager.IsInRoleAsync(identity, VendorIdentityRoleNames.Vendor))
        {
            EnsureIdentitySucceeded(await _userManager.AddToRoleAsync(identity, VendorIdentityRoleNames.Vendor));
        }

        if (!await _db.VendorUsers.AnyAsync(link => link.IdentityUserId == identity.Id && link.VendorId == vendorId, cancellationToken))
        {
            _db.VendorUsers.Add(VendorUser.Create(identity.Id, vendorId, isWorkspacePic: true));
        }
    }

    private async Task UpsertExternalReferenceAsync(
        string vendorId,
        VendorImportPayload payload,
        Guid batchId,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payloadJson)));
        var xref = await _db.VendorExternalReferences.FirstOrDefaultAsync(
            item => item.VendorId == vendorId && item.SourceSystem == SourceSystem, cancellationToken);
        if (xref is null)
        {
            _db.VendorExternalReferences.Add(VendorExternalReference.Create(vendorId, SourceSystem, payload.AribaVendorId,
                batchId, payloadHash, payload.SourceUpdatedAt));
            return;
        }

        if (!string.Equals(xref.ExternalVendorId, payload.AribaVendorId, StringComparison.OrdinalIgnoreCase))
        {
            xref.Relink(payload.AribaVendorId, batchId, payloadHash, payload.SourceUpdatedAt);
            return;
        }

        xref.Refresh(batchId, payloadHash, payload.SourceUpdatedAt);
    }

    private async Task AddPlaceholderDocumentsAsync(Vendor vendor, VendorImportPayload payload, CancellationToken cancellationToken)
    {
        var container = _storage.ContainerForModule("vendorOnboarding");
        await _storage.EnsureContainerAsync(container, cancellationToken);
        var slots = MandatoryDocuments.ToList();
        if (!string.IsNullOrWhiteSpace(payload.AktaPerubahanNo)) slots.Add(("akta-perubahan", "Deed of Amendment"));
        if (!string.IsNullOrWhiteSpace(payload.AktaPenyesuaianNo)) slots.Add(("akta-penyesuaian", "Deed of Adjustment"));

        var existingTypes = (await _db.VendorDocuments.AsNoTracking()
            .Where(document => document.VendorId == vendor.Id && document.OwnerKey == string.Empty)
            .Select(document => document.DocumentType)
            .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var slot in slots)
        {
            if (existingTypes.Contains(slot.Type)) continue;
            var bytes = _placeholderGenerator.Generate(vendor.Name, slot.Label, SourceSystem, payload.AribaVendorId);
            var blobKey = $"vendors/{vendor.Id}/migration-placeholder/{slot.Type}.pdf";
            using var stream = new MemoryStream(bytes);
            var upload = await _storage.UploadAsync(container, blobKey, stream, "application/pdf", cancellationToken);
            _db.VendorDocuments.Add(VendorDocument.Create(vendor.Id, slot.Type, string.Empty,
                $"PLACEHOLDER-{slot.Type}.pdf", upload.ContentType, upload.Size, upload.Container, upload.BlobKey,
                _currentActor.Actor.ActorId, true, SourceSystem));
        }
    }

    private static List<ImportIssue> Validate(
        VendorImportPayload payload,
        AribaImportLookups lookups,
        HashSet<string> duplicateIds,
        HashSet<string> duplicateEmails)
    {
        var issues = new List<ImportIssue>();
        Require(payload.AribaVendorId, "AribaVendorId"); Require(payload.VendorName, "VendorName");
        Require(payload.PicName, "PICName"); Require(payload.PicEmail, "PICEmail");
        if (payload.PicEmail.Length > 0 && !EmailPattern.IsMatch(payload.PicEmail))
            issues.Add(new("error", "PICEmail", "Email format is invalid."));
        if (duplicateIds.Contains(payload.AribaVendorId)) issues.Add(new("error", "AribaVendorId", "Duplicate value in this workbook."));
        if (duplicateEmails.Contains(payload.PicEmail)) issues.Add(new("error", "PICEmail", "Duplicate value in this workbook."));
        issues.AddRange(DecideIdentity(payload, lookups).Issues);
        if (payload.NpwpNo.Length > 0 && payload.NpwpNo.Length != 16)
            issues.Add(new("warning", "NPWPNo", "NPWP is not 16 digits; stored as-is. The vendor remains INITL until an officer invites them."));
        if (payload.SubClassifications.Count == 0) issues.Add(new("warning", "Commodities", "No commodity supplied; vendor must complete it before submission."));
        if (payload.NpwpNo.Length == 0 || payload.NibNo.Length == 0 || payload.AktaPendirianNo.Length == 0 || payload.SppkpNo.Length == 0)
            issues.Add(new("warning", "Legal data", "Some legal numbers are missing; vendor remains INITL until an officer invites them."));
        return issues;

        void Require(string value, string field)
        {
            if (string.IsNullOrWhiteSpace(value)) issues.Add(new("error", field, $"{field} is required."));
        }
    }

    private static VendorAribaImportIdentityDecision DecideIdentity(VendorImportPayload payload, AribaImportLookups lookups)
    {
        lookups.ByEmail.TryGetValue(payload.PicEmail, out var vendorByEmail);
        lookups.ByAribaId.TryGetValue(payload.AribaVendorId, out var vendorByAribaId);
        var emailTaken = payload.PicEmail.Length > 0 && lookups.TakenEmails.Contains(payload.PicEmail);
        return VendorAribaImportIdentityRules.Decide(vendorByEmail, vendorByAribaId, emailTaken);
    }

    private async Task<AribaImportLookups> LoadExistingLookupsAsync(
        IReadOnlyCollection<string> aribaIds,
        IReadOnlyCollection<string> emails,
        CancellationToken cancellationToken)
    {
        var normalizedEmails = emails.Where(email => email.Length > 0)
            .Select(email => email.ToUpperInvariant())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var externalIds = aribaIds.Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var users = normalizedEmails.Length == 0
            ? []
            : await _db.Users.AsNoTracking()
                .Where(user => user.NormalizedEmail != null && normalizedEmails.Contains(user.NormalizedEmail))
                .Select(user => new { user.Id, Email = user.NormalizedEmail! })
                .ToListAsync(cancellationToken);
        var takenEmails = users.Select(user => user.Email).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var userIds = users.Select(user => user.Id).ToArray();
        var links = userIds.Length == 0
            ? []
            : await _db.VendorUsers.AsNoTracking()
                .Where(link => userIds.Contains(link.IdentityUserId))
                .Select(link => new { link.IdentityUserId, link.VendorId, link.IsWorkspacePic })
                .ToListAsync(cancellationToken);

        var xrefs = externalIds.Length == 0
            ? []
            : await _db.VendorExternalReferences.AsNoTracking()
                .Where(item => item.SourceSystem == SourceSystem && externalIds.Contains(item.ExternalVendorId))
                .Select(item => new { item.ExternalVendorId, item.VendorId })
                .ToListAsync(cancellationToken);

        var vendorIds = links.Select(link => link.VendorId)
            .Concat(xrefs.Select(item => item.VendorId))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var vendors = vendorIds.Length == 0
            ? []
            : await _db.Vendors.AsNoTracking()
                .Where(vendor => vendorIds.Contains(vendor.Id))
                .Select(vendor => new { vendor.Id, vendor.Status })
                .ToListAsync(cancellationToken);
        var vendorMap = vendors.ToDictionary(
            vendor => vendor.Id,
            vendor => new VendorAribaExistingVendor(vendor.Id, vendor.Status),
            StringComparer.OrdinalIgnoreCase);

        var byEmail = new Dictionary<string, VendorAribaExistingVendor>(StringComparer.OrdinalIgnoreCase);
        foreach (var user in users)
        {
            var vendorId = links
                .Where(link => link.IdentityUserId == user.Id)
                .OrderByDescending(link => link.IsWorkspacePic)
                .Select(link => link.VendorId)
                .FirstOrDefault(id => vendorMap.ContainsKey(id));
            if (vendorId is not null)
            {
                byEmail[user.Email] = vendorMap[vendorId];
            }
        }

        var byAribaId = new Dictionary<string, VendorAribaExistingVendor>(StringComparer.OrdinalIgnoreCase);
        foreach (var xref in xrefs)
        {
            if (vendorMap.TryGetValue(xref.VendorId, out var vendor))
            {
                byAribaId[xref.ExternalVendorId] = vendor;
            }
        }

        return new AribaImportLookups(byEmail, byAribaId, takenEmails);
    }

    private sealed record AribaImportLookups(
        IReadOnlyDictionary<string, VendorAribaExistingVendor> ByEmail,
        IReadOnlyDictionary<string, VendorAribaExistingVendor> ByAribaId,
        IReadOnlySet<string> TakenEmails);

    private async Task<VendorAribaImportCatalog> LoadCatalogAsync(CancellationToken cancellationToken)
    {
        var setKeys = new[] { "province", "city", "district", "village", "commodity-subclassification", "country" };
        var records = await _db.MasterDataRecords.AsNoTracking()
            .Where(record => setKeys.Contains(record.SetKey))
            .Select(record => new { record.SetKey, record.Code, record.Name, record.ParentCode })
            .ToListAsync(cancellationToken);

        VendorAribaRegionRow[] Of(string key) =>
            records.Where(record => record.SetKey == key)
                .Select(record => new VendorAribaRegionRow(record.Code, record.Name, record.ParentCode))
                .ToArray();

        return new VendorAribaImportCatalog(
            Of("province"),
            Of("city"),
            Of("district"),
            Of("village"),
            records.Where(record => record.SetKey == "commodity-subclassification").Select(record => record.Code),
            records.Where(record => record.SetKey == "country").Select(record => record.Code));
    }

    private static VendorAddress ToAddress(ImportAddress? item) =>
        item is null
            ? VendorAddress.Empty()
            : VendorAddress.Create(
                Clip(item.Address, 250),
                Clip(item.AddressCode, 50),
                Clip(item.ProvinceCode, 50),
                Clip(item.CityCode, 50),
                Clip(item.DistrictCode, 50),
                Clip(item.VillageCode, 50),
                Clip(item.PostCode, 10),
                Clip(item.Country, 50),
                item.Latitude,
                item.Longitude);

    private static string Clip(string? value, int max)
    {
        var text = (value ?? string.Empty).Trim();
        return text.Length <= max ? text : text[..max];
    }

    private static void EnsureIdentitySucceeded(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(error => error.Description)));
    }

    private static VendorImportBatchDto ToDto(VendorImportBatch batch, IReadOnlyCollection<VendorImportRow> rows) =>
        new(batch.Id, batch.FileName, batch.Status, batch.TotalRows, batch.ReadyRows, batch.WarningRows, batch.ErrorRows,
            batch.ImportedRows, batch.SkippedRows, batch.StartedBy, batch.CreatedAt, batch.CommittedAt,
            rows.Select(row => new VendorImportRowDto(row.Id, row.RowNumber, row.ExternalVendorId, row.VendorName, row.PicEmail,
                row.Status, JsonSerializer.Deserialize<IReadOnlyList<ImportIssue>>(row.IssuesJson, JsonOptions) ?? [], row.VendorId)).ToArray());
}
