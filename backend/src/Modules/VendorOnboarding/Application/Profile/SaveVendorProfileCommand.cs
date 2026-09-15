namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Full vendor profile payload from the registration wizard. Child collections use replace-all
/// semantics. Set <see cref="Submit"/> to move the vendor into review (SBMIT) after saving.
/// </summary>
public sealed record SaveVendorProfileCommand(
    string VendorId,
    // Contact
    string? Position,
    string? OfficePhoneCountry,
    string? OfficePhoneArea,
    string? OfficePhoneNumber,
    string? HandphoneCountry,
    string? HandphoneNumber,
    string? WebAddress,
    // Locations
    VendorAddressInput? Office,
    VendorAddressInput? Warehouse,
    VendorAddressInput? Workshop,
    // Legal & tax
    string? NpwpNo,
    string? NibNo,
    string? AktaPendirianNo,
    DateOnly? AktaPendirianDate,
    string? AktaPerubahanNo,
    DateOnly? AktaPerubahanDate,
    string? AktaPenyesuaianNo,
    DateOnly? AktaPenyesuaianDate,
    string? SppkpNo,
    // Declarations
    bool IsBiodataTrue,
    bool IsAgreeSubmit,
    // Child collections (master-data codes)
    IReadOnlyList<VendorSubClassificationInput> SubClassifications,
    IReadOnlyList<VendorKbliInput> Kblis,
    IReadOnlyList<VendorBrandInput> Brands,
    IReadOnlyList<VendorCertificateInput> Certificates,
    IReadOnlyList<VendorPortfolioInput> Portfolios,
    IReadOnlyList<VendorSpecialRequirementInput> SpecialRequirements,
    bool Submit,
    string? Actor,
    // Vendor legal name (editable in the Bio Data step, like the legacy wizard); ignored when blank.
    string? Name = null,
    // When true (external self-service), the save is rejected unless the vendor is still in a
    // registration/revision status (see VendorStatuses.IsSubmittableFrom). Internal callers leave false.
    bool RequireEditableStatus = false);

public sealed record VendorAddressInput(
    string? Address, string? AddressCode, string? ProvinceCode, string? CityCode,
    string? DistrictCode, string? VillageCode, string? PostCode, string? Country,
    decimal? Latitude, decimal? Longitude);

public sealed record VendorSubClassificationInput(string SubClassificationCode);

public sealed record VendorKbliInput(string KbliTypeCode, string KbliCode, string KbliStatusCode);

public sealed record VendorBrandInput(string BrandName, string? DistributorTypeCode, DateOnly? ExpireDate);

public sealed record VendorCertificateInput(string CertificateNumber, string? Description, DateOnly? ExpireDate);

public sealed record VendorPortfolioInput(string Client, string ScopeOfWork, decimal TotalValue, DateOnly ContractStartDate, DateOnly ContractEndDate);

public sealed record VendorSpecialRequirementInput(string SpecialReqCode, string? Number, string? Description, DateOnly? ExpireDate);

public sealed record SaveVendorProfileResult(
    bool Found,
    string VendorId,
    string Status,
    bool NotEditable = false,
    IReadOnlyList<string>? ValidationErrors = null,
    string? PreviousStatus = null,
    string? VendorName = null,
    string? ApproverRoleCode = null);
