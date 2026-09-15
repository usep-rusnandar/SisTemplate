using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// The single home for every vendor document, stored on Azure Blob (not DB binary). Keyed like the
/// legacy VENDOR_DOCUMENT_T (Guid PK VendorDocumentId, varchar(10) VendorId). The logical
/// slot is (VendorId, DocumentType, OwnerKey): OwnerKey is the owning child-row natural key
/// (KbliCode / BrandName / cert number / SpecialReqCode / client|startDate); empty string for
/// vendor-level documents (NPWP, NIB, Pakta, Logo, Akta, E-Certificate, …).
/// </summary>
public sealed class VendorDocument : AuditableEntity
{
    private VendorDocument()
    {
    }

    private VendorDocument(
        string vendorId, string documentType, string ownerKey,
        string fileName, string? contentType, long? fileSize, string container, string blobKey, string? uploadedBy,
        bool isPlaceholder, string? sourceSystem)
        : base(Guid.NewGuid())
    {
        VendorId = vendorId;
        DocumentType = documentType;
        OwnerKey = ownerKey;
        FileName = fileName;
        ContentType = contentType;
        FileSize = fileSize;
        BlobContainer = container;
        BlobKey = blobKey;
        UploadedBy = uploadedBy;
        IsPlaceholder = isPlaceholder;
        SourceSystem = sourceSystem;
        IsActive = true;
    }

    public string VendorId { get; private set; } = string.Empty;

    public string DocumentType { get; private set; } = string.Empty;

    /// <summary>Owning child-row natural key; empty string for vendor-level documents.</summary>
    public string OwnerKey { get; private set; } = string.Empty;

    public string FileName { get; private set; } = string.Empty;

    public string? ContentType { get; private set; }

    public long? FileSize { get; private set; }

    public string BlobContainer { get; private set; } = string.Empty;

    public string BlobKey { get; private set; } = string.Empty;

    public string? UploadedBy { get; private set; }

    /// <summary>True for an import-generated temporary file that must be replaced before submission.</summary>
    public bool IsPlaceholder { get; private set; }

    public string? SourceSystem { get; private set; }

    public bool IsActive { get; private set; }

    public static VendorDocument Create(
        string vendorId, string documentType, string? ownerKey,
        string fileName, string? contentType, long? fileSize, string container, string blobKey, string? uploadedBy,
        bool isPlaceholder = false, string? sourceSystem = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(documentType);
        ArgumentException.ThrowIfNullOrWhiteSpace(fileName);
        ArgumentException.ThrowIfNullOrWhiteSpace(container);
        ArgumentException.ThrowIfNullOrWhiteSpace(blobKey);
        return new VendorDocument(
            vendorId, documentType.Trim(),
            string.IsNullOrWhiteSpace(ownerKey) ? string.Empty : ownerKey.Trim(),
            fileName.Trim(), contentType, fileSize, container.Trim(), blobKey.Trim(),
            string.IsNullOrWhiteSpace(uploadedBy) ? null : uploadedBy.Trim(),
            isPlaceholder,
            string.IsNullOrWhiteSpace(sourceSystem) ? null : sourceSystem.Trim());
    }

    public void Deactivate() => IsActive = false;
}
