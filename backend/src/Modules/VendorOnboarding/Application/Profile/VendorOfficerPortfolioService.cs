using System.Text;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Documents;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Officer-party CRUD for <see cref="VendorPortfolio"/> plus portfolio-only document upload/delete.
/// Vendor self-service never calls this — it keeps using <see cref="VendorProfileService.SaveAsync"/>.
/// </summary>
public sealed class VendorOfficerPortfolioService
{
    private const string PortfolioDocType = "portfolio";
    private const string VendorModule = "vendorOnboarding";

    private readonly IVendorRepository _repository;
    private readonly VendorDocumentService _documents;
    private readonly IDocumentStorage _storage;
    private readonly IInternalRoleReadPort _roles;
    private readonly VendorApprovalChainProvider _chains;

    public VendorOfficerPortfolioService(
        IVendorRepository repository,
        VendorDocumentService documents,
        IDocumentStorage storage,
        IInternalRoleReadPort roles,
        VendorApprovalChainProvider chains)
    {
        _repository = repository;
        _documents = documents;
        _storage = storage;
        _roles = roles;
        _chains = chains;
    }

    public async Task<bool> IsSlotOwnedByPartyAsync(
        string vendorId,
        string? ownerKey,
        string party,
        CancellationToken cancellationToken)
    {
        var key = (ownerKey ?? string.Empty).Trim();
        if (key.Length == 0)
        {
            return false;
        }

        var children = await _repository.GetChildrenAsync(vendorId, cancellationToken);
        return children.Portfolios.Any(row =>
            string.Equals(row.EnteredByParty, party, StringComparison.OrdinalIgnoreCase)
            && string.Equals(row.DocumentOwnerKey, key, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<OfficerPortfolioMutationResult> CreateAsync(
        string vendorId,
        SaveOfficerPortfolioCommand command,
        string actorId,
        CancellationToken cancellationToken)
    {
        var gate = await GateAsync(vendorId, actorId, cancellationToken);
        if (gate.Failure is not null)
        {
            return gate.Failure;
        }

        var vendor = gate.Vendor!;
        if (string.IsNullOrWhiteSpace(command.Client) || string.IsNullOrWhiteSpace(command.ScopeOfWork))
        {
            return OfficerPortfolioMutationResult.BadRequest(
                "portfolio_required_fields",
                "Client and scope of work are required.");
        }

        var incomingKey = VendorPortfolio.DocumentOwnerKeyFor(command.Client, command.ContractStartDate);
        var children = await _repository.GetChildrenAsync(vendorId, cancellationToken);
        if (incomingKey.Length > 0
            && children.Portfolios.Any(row => string.Equals(row.DocumentOwnerKey, incomingKey, StringComparison.OrdinalIgnoreCase)))
        {
            return OfficerPortfolioMutationResult.Conflict(
                "portfolio_owner_key_conflict",
                "A portfolio with the same client and start month already exists.");
        }

        var row = VendorPortfolio.Create(
            vendor.Id,
            command.Client,
            command.ScopeOfWork,
            command.TotalValue,
            command.ContractStartDate,
            command.ContractEndDate,
            VendorPortfolioParties.Officer);
        _repository.AddPortfolio(row);
        await _repository.SaveChangesAsync(cancellationToken);
        return OfficerPortfolioMutationResult.Success(ToDto(row));
    }

    public async Task<OfficerPortfolioMutationResult> UpdateAsync(
        string vendorId,
        Guid portfolioId,
        SaveOfficerPortfolioCommand command,
        string actorId,
        CancellationToken cancellationToken)
    {
        var gate = await GateAsync(vendorId, actorId, cancellationToken);
        if (gate.Failure is not null)
        {
            return gate.Failure;
        }

        var row = await _repository.GetPortfolioAsync(vendorId, portfolioId, cancellationToken);
        if (row is null)
        {
            return OfficerPortfolioMutationResult.NotFound("portfolio_not_found");
        }

        if (!row.IsOfficerEntered)
        {
            return OfficerPortfolioMutationResult.Forbidden(
                "portfolio_vendor_owned",
                "Officer and Super Admin may only edit Officer-entered portfolio rows.");
        }

        if (string.IsNullOrWhiteSpace(command.Client) || string.IsNullOrWhiteSpace(command.ScopeOfWork))
        {
            return OfficerPortfolioMutationResult.BadRequest(
                "portfolio_required_fields",
                "Client and scope of work are required.");
        }

        var previousKey = row.DocumentOwnerKey;
        var nextKey = VendorPortfolio.DocumentOwnerKeyFor(command.Client, command.ContractStartDate);
        if (!string.Equals(previousKey, nextKey, StringComparison.OrdinalIgnoreCase))
        {
            var documents = await _documents.ListAsync(vendorId, cancellationToken);
            if (documents.Any(document =>
                    document.DocumentType.Equals(PortfolioDocType, StringComparison.OrdinalIgnoreCase)
                    && string.Equals((document.OwnerKey ?? string.Empty).Trim(), previousKey, StringComparison.OrdinalIgnoreCase)))
            {
                return OfficerPortfolioMutationResult.Conflict(
                    "portfolio_owner_key_locked",
                    "Client and start month are locked while a document is attached. Remove the file to change them.");
            }

            var children = await _repository.GetChildrenAsync(vendorId, cancellationToken);
            if (nextKey.Length > 0
                && children.Portfolios.Any(item =>
                    item.Id != row.Id
                    && string.Equals(item.DocumentOwnerKey, nextKey, StringComparison.OrdinalIgnoreCase)))
            {
                return OfficerPortfolioMutationResult.Conflict(
                    "portfolio_owner_key_conflict",
                    "A portfolio with the same client and start month already exists.");
            }
        }

        row.Update(command.Client, command.ScopeOfWork, command.TotalValue, command.ContractStartDate, command.ContractEndDate);
        await _repository.SaveChangesAsync(cancellationToken);
        return OfficerPortfolioMutationResult.Success(ToDto(row));
    }

    public async Task<OfficerPortfolioMutationResult> DeleteAsync(
        string vendorId,
        Guid portfolioId,
        string actorId,
        CancellationToken cancellationToken)
    {
        var gate = await GateAsync(vendorId, actorId, cancellationToken);
        if (gate.Failure is not null)
        {
            return gate.Failure;
        }

        var row = await _repository.GetPortfolioAsync(vendorId, portfolioId, cancellationToken);
        if (row is null)
        {
            return OfficerPortfolioMutationResult.NotFound("portfolio_not_found");
        }

        if (!row.IsOfficerEntered)
        {
            return OfficerPortfolioMutationResult.Forbidden(
                "portfolio_vendor_owned",
                "Officer and Super Admin may only delete Officer-entered portfolio rows.");
        }

        var ownerKey = row.DocumentOwnerKey;
        _repository.RemovePortfolio(row);
        await _repository.SaveChangesAsync(cancellationToken);

        var documents = await _documents.ListAsync(vendorId, cancellationToken);
        foreach (var document in documents.Where(item =>
                     item.DocumentType.Equals(PortfolioDocType, StringComparison.OrdinalIgnoreCase)
                     && string.Equals((item.OwnerKey ?? string.Empty).Trim(), ownerKey, StringComparison.OrdinalIgnoreCase)))
        {
            await _documents.DeleteAsync(vendorId, document.Id, cancellationToken);
        }

        return OfficerPortfolioMutationResult.Success();
    }

    public async Task<OfficerPortfolioMutationResult> UploadDocumentAsync(
        string vendorId,
        string ownerKey,
        string fileName,
        string? contentType,
        long fileLength,
        Stream content,
        string actorId,
        CancellationToken cancellationToken)
    {
        var gate = await GateAsync(vendorId, actorId, cancellationToken);
        if (gate.Failure is not null)
        {
            return gate.Failure;
        }

        var key = (ownerKey ?? string.Empty).Trim();
        if (key.Length == 0)
        {
            return OfficerPortfolioMutationResult.BadRequest("owner_key_required", "OwnerKey is required for a portfolio document.");
        }

        if (await IsSlotOwnedByPartyAsync(vendorId, key, VendorPortfolioParties.Vendor, cancellationToken))
        {
            return OfficerPortfolioMutationResult.Forbidden(
                "portfolio_vendor_owned",
                "Officer and Super Admin may not replace a Vendor-owned portfolio document.");
        }

        if (VendorDocumentRules.Validate(PortfolioDocType, fileName, fileLength) is var rejection && rejection is not null)
        {
            return OfficerPortfolioMutationResult.BadRequest(rejection.Value.Code, rejection.Value.Message);
        }

        if (!_storage.IsConfigured)
        {
            return OfficerPortfolioMutationResult.Unavailable("Document storage is not configured.");
        }

        var container = _storage.ContainerForModule(VendorModule);
        var blobKey = $"{vendorId}/{Slug(PortfolioDocType)}/{Guid.NewGuid():N}-{SafeFileName(fileName)}";
        var uploaded = await _storage.UploadAsync(
            container,
            blobKey,
            content,
            string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
            cancellationToken);

        var dto = await _documents.RecordAsync(
            new RecordVendorDocumentCommand(
                vendorId, PortfolioDocType, key, fileName,
                uploaded.ContentType, uploaded.Size, uploaded.Container, uploaded.BlobKey,
                actorId),
            cancellationToken);

        return OfficerPortfolioMutationResult.Success(Document: dto);
    }

    public async Task<OfficerPortfolioMutationResult> DeleteDocumentAsync(
        string vendorId,
        Guid documentId,
        string actorId,
        CancellationToken cancellationToken)
    {
        var gate = await GateAsync(vendorId, actorId, cancellationToken);
        if (gate.Failure is not null)
        {
            return gate.Failure;
        }

        var document = await _documents.GetAsync(vendorId, documentId, cancellationToken);
        if (document is null)
        {
            return OfficerPortfolioMutationResult.NotFound("vendor_document_not_found");
        }

        if (!document.DocumentType.Equals(PortfolioDocType, StringComparison.OrdinalIgnoreCase))
        {
            return OfficerPortfolioMutationResult.Forbidden(
                "portfolio_document_only",
                "Officer portfolio endpoints may only delete portfolio documents.");
        }

        if (await IsSlotOwnedByPartyAsync(vendorId, document.OwnerKey, VendorPortfolioParties.Vendor, cancellationToken))
        {
            return OfficerPortfolioMutationResult.Forbidden(
                "portfolio_vendor_owned",
                "Officer and Super Admin may not delete a Vendor-owned portfolio document.");
        }

        await _documents.DeleteAsync(vendorId, documentId, cancellationToken);
        return OfficerPortfolioMutationResult.Success();
    }

    private async Task<(Vendor? Vendor, OfficerPortfolioMutationResult? Failure)> GateAsync(
        string vendorId,
        string actorId,
        CancellationToken cancellationToken)
    {
        var roleCodes = await _roles.GetActorRoleCodesAsync(actorId, cancellationToken);
        if (!VendorPortfolioOfficerAccess.HasOfficerPartyRole(roleCodes))
        {
            return (null, OfficerPortfolioMutationResult.Forbidden(
                "portfolio_officer_role_required",
                "Only Officer Vendor Onboarding (OFFCR-VDR) or Super Admin (SPR-ADM) may mutate Officer portfolio rows."));
        }

        var vendor = await _repository.GetAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return (null, OfficerPortfolioMutationResult.NotFound());
        }

        var chain = await _chains.GetAsync(cancellationToken);
        if (!VendorPortfolioOfficerAccess.CanMutateForStatus(vendor.Status, chain))
        {
            return (vendor, OfficerPortfolioMutationResult.Conflict(
                "portfolio_not_writable",
                $"Officer portfolio rows can be edited while the vendor is awaiting approval, Approved, or Registered (status '{vendor.Status}')."));
        }

        return (vendor, null);
    }

    internal static VendorPortfolioDto ToDto(VendorPortfolio row) =>
        new(row.Id, row.Client, row.ScopeOfWork, row.TotalValue, row.ContractStartDate, row.ContractEndDate, row.EnteredByParty);

    private static string SafeFileName(string fileName)
    {
        var name = Path.GetFileName(fileName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(name))
        {
            return "document";
        }

        var builder = new StringBuilder(name.Length);
        foreach (var ch in name)
        {
            builder.Append(char.IsLetterOrDigit(ch) || ch is '.' or '-' or '_' ? ch : '-');
        }

        return builder.ToString();
    }

    private static string Slug(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "doc";
        }

        var builder = new StringBuilder(value.Length);
        foreach (var ch in value.Trim())
        {
            builder.Append(char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '-');
        }

        var slug = builder.ToString();
        return slug.Length == 0 ? "doc" : slug;
    }
}

public sealed record SaveOfficerPortfolioCommand(
    string Client,
    string ScopeOfWork,
    decimal TotalValue,
    DateOnly ContractStartDate,
    DateOnly ContractEndDate);

public sealed record OfficerPortfolioMutationResult(
    bool Found,
    bool Ok,
    int StatusCode,
    string? Code,
    string? Message,
    VendorPortfolioDto? Portfolio = null,
    VendorDocumentDto? Document = null)
{
    public static OfficerPortfolioMutationResult NotFound(string code = "vendor_not_found") =>
        new(false, false, 404, code, null);

    public static OfficerPortfolioMutationResult Forbidden(string code, string message) =>
        new(true, false, 403, code, message);

    public static OfficerPortfolioMutationResult Conflict(string code, string message) =>
        new(true, false, 409, code, message);

    public static OfficerPortfolioMutationResult BadRequest(string code, string message) =>
        new(true, false, 400, code, message);

    public static OfficerPortfolioMutationResult Unavailable(string message) =>
        new(true, false, 503, "storage_unavailable", message);

    public static OfficerPortfolioMutationResult Success(
        VendorPortfolioDto? Portfolio = null,
        VendorDocumentDto? Document = null) =>
        new(true, true, 200, null, null, Portfolio, Document);
}
