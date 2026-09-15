namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// Data-access contract for vendor documents (stored on Blob; metadata in the DB). Implementation
/// lives in the module's Infrastructure layer.
/// </summary>
public interface IVendorDocumentRepository
{
    void Add(VendorDocument document);

    void Remove(VendorDocument document);

    Task<VendorDocument?> GetAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>The active document occupying a (vendor, type, owner) slot, if any.</summary>
    Task<VendorDocument?> FindSlotAsync(string vendorId, string documentType, string ownerKey, CancellationToken cancellationToken);

    /// <summary>Find a document by its type and owner key across all vendors (e.g. an e-certificate by number).</summary>
    Task<VendorDocument?> FindByTypeAndOwnerAsync(string documentType, string ownerKey, CancellationToken cancellationToken);

    /// <summary>The most recent document of a type for a vendor, if any (e.g. the current e-certificate).</summary>
    Task<VendorDocument?> FindLatestByVendorAndTypeAsync(string vendorId, string documentType, CancellationToken cancellationToken);

    Task<IReadOnlyList<VendorDocument>> ListByVendorAsync(string vendorId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
