using IntegratedProcurement.Modules.VendorOnboarding.Application.Documents;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Persists the vendor registration profile: scalar fields (contact / addresses / legal) plus the
/// child collections (replace-all), and optionally submits the vendor for review.
/// </summary>
public sealed class VendorProfileService
{
    private readonly IVendorRepository _repository;
    private readonly VendorDocumentService _documents;
    private readonly ICommodityKbliRuleReadPort _kbliRules;
    private readonly VendorApprovalService _approval;

    public VendorProfileService(
        IVendorRepository repository,
        VendorDocumentService documents,
        ICommodityKbliRuleReadPort kbliRules,
        VendorApprovalService approval)
    {
        _repository = repository;
        _documents = documents;
        _kbliRules = kbliRules;
        _approval = approval;
    }

    public async Task<VendorProfileDto?> GetAsync(string vendorId, CancellationToken cancellationToken)
    {
        var vendor = await _repository.GetAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return null;
        }

        var children = await _repository.GetChildrenAsync(vendorId, cancellationToken);
        var history = await _repository.GetStatusHistoryAsync(vendorId, cancellationToken);
        // Prefer the latest reason for the current status (revision notes when REPIR), else any recent reason.
        var lastReason = history
            .Where(entry => string.Equals(entry.StatusCode, vendor.Status, StringComparison.OrdinalIgnoreCase)
                            && !string.IsNullOrWhiteSpace(entry.Reason))
            .OrderByDescending(entry => entry.CreatedAt)
            .Select(entry => entry.Reason)
            .FirstOrDefault()
            ?? history
                .Where(entry => !string.IsNullOrWhiteSpace(entry.Reason))
                .OrderByDescending(entry => entry.CreatedAt)
                .Select(entry => entry.Reason)
                .FirstOrDefault();

        return new VendorProfileDto(
            vendor.Id, vendor.Name, vendor.Status, lastReason,
            vendor.Position, vendor.OfficePhoneCountry, vendor.OfficePhoneArea, vendor.OfficePhoneNumber,
            vendor.HandphoneCountry, vendor.HandphoneNumber, vendor.WebAddress,
            new VendorAddressDto(
                vendor.OfficeAddress, vendor.OfficeAddressCode, vendor.OfficeProvinceCode, vendor.OfficeCityCode,
                vendor.OfficeDistrictCode, vendor.OfficeVillageCode, vendor.OfficePostCode, vendor.OfficeCountry,
                vendor.OfficeLatitude, vendor.OfficeLongitude),
            new VendorAddressDto(
                vendor.WarehouseAddress, vendor.WarehouseAddressCode, vendor.WarehouseProvinceCode, vendor.WarehouseCityCode,
                vendor.WarehouseDistrictCode, vendor.WarehouseVillageCode, vendor.WarehousePostCode, vendor.WarehouseCountry,
                vendor.WarehouseLatitude, vendor.WarehouseLongitude),
            new VendorAddressDto(
                vendor.WorkshopAddress, vendor.WorkshopAddressCode, vendor.WorkshopProvinceCode, vendor.WorkshopCityCode,
                vendor.WorkshopDistrictCode, vendor.WorkshopVillageCode, vendor.WorkshopPostCode, vendor.WorkshopCountry,
                vendor.WorkshopLatitude, vendor.WorkshopLongitude),
            vendor.NpwpNo, vendor.NibNo,
            vendor.AktaPendirianNo, vendor.AktaPendirianDate,
            vendor.AktaPerubahanNo, vendor.AktaPerubahanDate,
            vendor.AktaPenyesuaianNo, vendor.AktaPenyesuaianDate,
            vendor.SppkpNo,
            vendor.IsBiodataTrue, vendor.IsAgreeSubmit,
            children.SubClassifications.Select(x => new VendorSubClassificationDto(x.Id, x.SubClassificationCode)).ToArray(),
            children.Kblis.Select(x => new VendorKbliDto(x.Id, x.KbliTypeCode, x.KbliCode, x.KbliStatusCode)).ToArray(),
            children.Brands.Select(x => new VendorBrandDto(x.Id, x.BrandName, x.DistributorTypeCode, x.ExpireDate)).ToArray(),
            children.Certificates.Select(x => new VendorCertificateDto(x.Id, x.CertificateNumber, x.Description, x.ExpireDate)).ToArray(),
            children.Portfolios.Select(x => new VendorPortfolioDto(x.Id, x.Client, x.ScopeOfWork, x.TotalValue, x.ContractStartDate, x.ContractEndDate, x.EnteredByParty)).ToArray(),
            children.SpecialRequirements.Select(x => new VendorSpecialRequirementDto(x.Id, x.SpecialReqCode, x.Number, x.Description, x.ExpireDate)).ToArray());
    }

    public async Task<SaveVendorProfileResult> SaveAsync(SaveVendorProfileCommand command, CancellationToken cancellationToken)
    {
        var vendor = await _repository.GetAsync(command.VendorId, cancellationToken);
        if (vendor is null)
        {
            return new SaveVendorProfileResult(false, command.VendorId, string.Empty);
        }

        var previousStatus = vendor.Status;
        string? approverRoleCode = null;

        // External self-service can only edit while the vendor is still registering/revising.
        if (command.RequireEditableStatus && !VendorStatuses.IsSubmittableFrom(vendor.Status))
        {
            return new SaveVendorProfileResult(true, vendor.Id, vendor.Status, NotEditable: true);
        }

        if (command.Submit)
        {
            var validationErrors = ValidateProfileRules(command).ToList();
            validationErrors.AddRange(await ValidateKbliRulesAsync(command, cancellationToken));
            validationErrors.AddRange(await ValidateSubmissionDocumentsAsync(command, cancellationToken));
            if (validationErrors.Count > 0)
            {
                return new SaveVendorProfileResult(true, vendor.Id, vendor.Status, ValidationErrors: validationErrors);
            }
        }

        if (!string.IsNullOrWhiteSpace(command.Name))
        {
            vendor.Rename(command.Name);
        }

        vendor.UpdateContact(
            command.Position, command.OfficePhoneCountry, command.OfficePhoneArea, command.OfficePhoneNumber,
            command.HandphoneCountry, command.HandphoneNumber, command.WebAddress);
        vendor.SetOfficeAddress(ToAddress(command.Office));
        vendor.SetWarehouseAddress(ToAddress(command.Warehouse));
        vendor.SetWorkshopAddress(ToAddress(command.Workshop));
        vendor.UpdateLegal(
            command.NpwpNo, command.NibNo,
            command.AktaPendirianNo, command.AktaPendirianDate,
            command.AktaPerubahanNo, command.AktaPerubahanDate,
            command.AktaPenyesuaianNo, command.AktaPenyesuaianDate,
            command.SppkpNo);
        vendor.SetConsent(command.IsBiodataTrue, command.IsAgreeSubmit);

        // Omitted collections deserialize to null on partial payloads; treat them as empty (replace-all
        // with nothing) rather than throwing, mirroring the null-guard in ToAddress. Officer-entered
        // portfolios are kept by ReplaceChildrenAsync and dropped from the vendor payload here.
        var existingChildren = await _repository.GetChildrenAsync(vendor.Id, cancellationToken);
        await _repository.ReplaceChildrenAsync(
            vendor.Id,
            (command.SubClassifications ?? []).Select(x => VendorSubClassification.Create(vendor.Id, x.SubClassificationCode)).ToArray(),
            (command.Kblis ?? []).Select(x => VendorKbli.Create(vendor.Id, x.KbliTypeCode, x.KbliCode, x.KbliStatusCode)).ToArray(),
            (command.Brands ?? []).Select(x => VendorBrand.Create(vendor.Id, x.BrandName, x.DistributorTypeCode, x.ExpireDate)).ToArray(),
            (command.Certificates ?? []).Select(x => VendorCertificate.Create(vendor.Id, x.CertificateNumber, x.Description, x.ExpireDate)).ToArray(),
            VendorPortfolioReplacement.VendorOwnedIncoming(vendor.Id, command.Portfolios, existingChildren.Portfolios),
            (command.SpecialRequirements ?? []).Select(x => VendorSpecialRequirement.Create(vendor.Id, x.SpecialReqCode, x.Number, x.Description, x.ExpireDate)).ToArray(),
            cancellationToken);

        if (command.Submit && VendorStatuses.IsSubmittableFrom(vendor.Status))
        {
            approverRoleCode = await _approval.StartOrRestartAsync(vendor, command.Actor, cancellationToken);
        }
        else if (!command.Submit && vendor.Status is VendorStatuses.Invited or VendorStatuses.Responded)
        {
            // Legacy chain: first save-as-draft moves the vendor from Responded to Draft.
            vendor.SetStatus(VendorStatuses.Draft, command.Actor, "Profile saved as draft.");
        }

        await _repository.SaveChangesAsync(cancellationToken);

        // Replace-all removed children whose documents (and their Blobs) are now orphaned — delete them.
        var remaining = await _repository.GetChildrenAsync(vendor.Id, cancellationToken);
        await CleanupOrphanedChildDocumentsAsync(command, remaining, cancellationToken);

        return new SaveVendorProfileResult(
            true,
            vendor.Id,
            vendor.Status,
            PreviousStatus: previousStatus,
            VendorName: vendor.Name,
            ApproverRoleCode: approverRoleCode);
    }

    private static bool IsIndonesiaCountry(string? country) =>
        string.IsNullOrWhiteSpace(country)
        || country.Contains("Indonesia", StringComparison.OrdinalIgnoreCase);

    private static List<string> ValidateProfileRules(SaveVendorProfileCommand command)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(command.Office?.Country))
        {
            errors.Add("Office country is required.");
        }

        if (IsIndonesiaCountry(command.Office?.Country))
        {
            var npwp = (command.NpwpNo ?? string.Empty).Trim();
            if (npwp.Length != 16 || npwp.Any(ch => ch is < '0' or > '9'))
            {
                errors.Add("NPWP No. must be exactly 16 digits.");
            }
        }

        errors.AddRange(VendorBrandRules.Validate(command.Brands));

        return errors;
    }

    private async Task<IReadOnlyList<string>> ValidateKbliRulesAsync(
        SaveVendorProfileCommand command,
        CancellationToken cancellationToken)
    {
        var rules = await _kbliRules.GetRulesBySubClassificationAsync(cancellationToken);
        var vendorCodes = (command.Kblis ?? []).Select(x => x.KbliCode);
        var errors = new List<string>();

        foreach (var sub in command.SubClassifications ?? [])
        {
            if (!rules.TryGetValue(sub.SubClassificationCode, out var groups) || groups.Count == 0)
            {
                continue;
            }

            if (!CommodityKbliRuleEvaluator.IsSatisfied(groups, vendorCodes))
            {
                var preview = CommodityKbliRuleEvaluator.Preview(groups);
                errors.Add($"Commodity {sub.SubClassificationCode} needs: {preview}.");
            }
        }

        return errors;
    }

    private async Task<IReadOnlyList<string>> ValidateSubmissionDocumentsAsync(
        SaveVendorProfileCommand command,
        CancellationToken cancellationToken)
    {
        var documents = await _documents.ListAsync(command.VendorId, cancellationToken);
        bool HasRealDocument(string type) => documents.Any(document =>
            !document.IsPlaceholder
            && document.DocumentType.Equals(type, StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(document.OwnerKey));
        bool HasOwnedDocument(string type, string ownerKey) => documents.Any(document =>
            !document.IsPlaceholder
            && document.DocumentType.Equals(type, StringComparison.OrdinalIgnoreCase)
            && string.Equals((document.OwnerKey ?? string.Empty).Trim(), ownerKey.Trim(), StringComparison.OrdinalIgnoreCase));
        var requirements = new List<(string Type, string Label)>
        {
            ("pakta-integritas", "Integrity Pact"),
            ("nib", "NIB"),
            ("akta-pendirian", "Deed of Establishment"),
            ("sppkp", "SPPKP"),
        };
        if (IsIndonesiaCountry(command.Office?.Country))
        {
            requirements.Insert(1, ("npwp", "NPWP"));
        }
        if (!string.IsNullOrWhiteSpace(command.AktaPerubahanNo)) requirements.Add(("akta-perubahan", "Deed of Amendment"));
        if (!string.IsNullOrWhiteSpace(command.AktaPenyesuaianNo)) requirements.Add(("akta-penyesuaian", "Deed of Adjustment"));
        var errors = requirements.Where(item => !HasRealDocument(item.Type))
            .Select(item => $"{item.Label} document is required; migration placeholders must be replaced.")
            .ToList();

        // Low risk (1RH) may omit the KBLI certificate file; all other risk classifications require it.
        const string lowRiskType = "1RH";
        foreach (var kbli in command.Kblis ?? [])
        {
            if (string.IsNullOrWhiteSpace(kbli.KbliCode))
            {
                continue;
            }

            if (string.Equals(kbli.KbliTypeCode, lowRiskType, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!HasOwnedDocument("kbli", kbli.KbliCode))
            {
                errors.Add($"KBLI {kbli.KbliCode} document is required for non-low risk classifications.");
            }
        }

        return errors;
    }

    /// <summary>
    /// After the child collections are replaced, delete any vendor document whose OwnerKey no longer
    /// matches a surviving child — deleting the Blob too (VendorDocumentService.DeleteAsync). Without
    /// this, removing e.g. a Brand left its file behind in Blob Storage.
    /// </summary>
    private async Task CleanupOrphanedChildDocumentsAsync(
        SaveVendorProfileCommand command,
        VendorChildrenSnapshot remaining,
        CancellationToken cancellationToken)
    {
        string Key(string? value) => (value ?? string.Empty).Trim();
        var survivors = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["brand"] = (command.Brands ?? []).Select(x => Key(x.BrandName)).ToHashSet(StringComparer.OrdinalIgnoreCase),
            ["kbli"] = (command.Kblis ?? []).Select(x => Key(x.KbliCode)).ToHashSet(StringComparer.OrdinalIgnoreCase),
            // "sertifikat" is the document-slot label used by the vendor wizard (independent of the
            // VENDOR_CERTIFICATE_T table name); keys are certificate numbers.
            ["sertifikat"] = (command.Certificates ?? []).Select(x => Key(x.CertificateNumber)).ToHashSet(StringComparer.OrdinalIgnoreCase),
            ["special-requirement"] = (command.SpecialRequirements ?? []).Select(x => Key(x.SpecialReqCode)).ToHashSet(StringComparer.OrdinalIgnoreCase),
            // Remaining portfolios (vendor payload + preserved Officer rows) are the survivor set —
            // do not derive this from the wizard payload alone or Officer blobs get deleted.
            ["portfolio"] = remaining.Portfolios
                .Select(x => x.DocumentOwnerKey)
                .Where(key => key.Length > 0)
                .ToHashSet(StringComparer.OrdinalIgnoreCase),
        };

        var documents = await _documents.ListAsync(command.VendorId, cancellationToken);
        foreach (var document in documents)
        {
            if (survivors.TryGetValue(document.DocumentType, out var keep) && !keep.Contains(Key(document.OwnerKey)))
            {
                await _documents.DeleteAsync(command.VendorId, document.Id, cancellationToken);
            }
        }
    }

    private static VendorAddress ToAddress(VendorAddressInput? input) =>
        input is null
            ? VendorAddress.Empty()
            : VendorAddress.Create(
                input.Address, input.AddressCode, input.ProvinceCode, input.CityCode, input.DistrictCode,
                input.VillageCode, input.PostCode, input.Country, input.Latitude, input.Longitude);
}
