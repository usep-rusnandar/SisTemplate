namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// Data-access contract for the vendor aggregate and its child collections. Implementation lives in
/// the module's Infrastructure layer. Child collections use replace-all semantics (the wizard
/// re-submits the full set each save), except Officer-entered portfolio rows which the registry owns.
/// </summary>
public interface IVendorRepository
{
    Task<Vendor?> GetAsync(string vendorId, CancellationToken cancellationToken);

    /// <summary>
    /// Replace every child record of a vendor (classification, KBLI, brands, certificates, vendor-owned
    /// portfolio, special reqs). Officer-entered portfolio rows are preserved and must not be included
    /// in <paramref name="portfolios"/>.
    /// </summary>
    Task ReplaceChildrenAsync(
        string vendorId,
        IReadOnlyList<VendorSubClassification> subClassifications,
        IReadOnlyList<VendorKbli> kblis,
        IReadOnlyList<VendorBrand> brands,
        IReadOnlyList<VendorCertificate> certificates,
        IReadOnlyList<VendorPortfolio> portfolios,
        IReadOnlyList<VendorSpecialRequirement> specialRequirements,
        CancellationToken cancellationToken);

    /// <summary>Tracked portfolio row for Officer CRUD (null when missing or owned by another vendor).</summary>
    Task<VendorPortfolio?> GetPortfolioAsync(string vendorId, Guid portfolioId, CancellationToken cancellationToken);

    void AddPortfolio(VendorPortfolio portfolio);

    void RemovePortfolio(VendorPortfolio portfolio);

    /// <summary>Load every child record of a vendor (read-only, for the profile editor).</summary>
    Task<VendorChildrenSnapshot> GetChildrenAsync(string vendorId, CancellationToken cancellationToken);

    /// <summary>Registry list for internal reviewers, optionally filtered by status code and a name/legal search.</summary>
    Task<IReadOnlyList<Vendor>> ListAsync(string? status, string? search, CancellationToken cancellationToken);

    /// <summary>Status transition trail for a vendor (newest first).</summary>
    Task<IReadOnlyList<VendorStatusHistory>> GetStatusHistoryAsync(string vendorId, CancellationToken cancellationToken);

    /// <summary>Primary contact email of the vendor (its earliest VendorUser), for reviewer notifications.</summary>
    Task<string?> GetPrimaryContactEmailAsync(string vendorId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>Read-only bag of a vendor's child collections, returned by <see cref="IVendorRepository.GetChildrenAsync"/>.</summary>
public sealed record VendorChildrenSnapshot(
    IReadOnlyList<VendorSubClassification> SubClassifications,
    IReadOnlyList<VendorKbli> Kblis,
    IReadOnlyList<VendorBrand> Brands,
    IReadOnlyList<VendorCertificate> Certificates,
    IReadOnlyList<VendorPortfolio> Portfolios,
    IReadOnlyList<VendorSpecialRequirement> SpecialRequirements);
