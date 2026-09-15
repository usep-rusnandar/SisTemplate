namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Full read model of a vendor's registration profile (scalars + 3 addresses + child collections),
/// returned to the external profile editor. Documents are fetched separately via the documents endpoint.
/// </summary>
public sealed record VendorProfileDto(
    string VendorId,
    string Name,
    string Status,
    /// <summary>Latest status-history reason (e.g. revision notes when Status is REPIR).</summary>
    string? LastReason,
    // Contact
    string? Position,
    string? OfficePhoneCountry,
    string? OfficePhoneArea,
    string? OfficePhoneNumber,
    string? HandphoneCountry,
    string? HandphoneNumber,
    string? WebAddress,
    // Locations
    VendorAddressDto Office,
    VendorAddressDto Warehouse,
    VendorAddressDto Workshop,
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
    // Child collections
    IReadOnlyList<VendorSubClassificationDto> SubClassifications,
    IReadOnlyList<VendorKbliDto> Kblis,
    IReadOnlyList<VendorBrandDto> Brands,
    IReadOnlyList<VendorCertificateDto> Certificates,
    IReadOnlyList<VendorPortfolioDto> Portfolios,
    IReadOnlyList<VendorSpecialRequirementDto> SpecialRequirements);

public sealed record VendorAddressDto(
    string? Address, string? AddressCode, string? ProvinceCode, string? CityCode,
    string? DistrictCode, string? VillageCode, string? PostCode, string? Country,
    decimal? Latitude, decimal? Longitude);

// Child DTOs carry the Guid Id so the editor can link uploaded documents to a row via OwnerKey.
public sealed record VendorSubClassificationDto(Guid Id, string SubClassificationCode);

public sealed record VendorKbliDto(Guid Id, string KbliTypeCode, string KbliCode, string KbliStatusCode);

public sealed record VendorBrandDto(Guid Id, string BrandName, string? DistributorTypeCode, DateOnly? ExpireDate);

public sealed record VendorCertificateDto(Guid Id, string CertificateNumber, string Description, DateOnly? ExpireDate);

public sealed record VendorPortfolioDto(
    Guid Id,
    string Client,
    string ScopeOfWork,
    decimal TotalValue,
    DateOnly ContractStartDate,
    DateOnly ContractEndDate,
    string EnteredByParty);

public sealed record VendorSpecialRequirementDto(Guid Id, string SpecialReqCode, string? Number, string? Description, DateOnly? ExpireDate);
