namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Documents;

/// <summary>Records an already-uploaded Blob as a vendor document (metadata only).</summary>
public sealed record RecordVendorDocumentCommand(
    string VendorId,
    string DocumentType,
    string? OwnerKey,
    string FileName,
    string? ContentType,
    long? FileSize,
    string Container,
    string BlobKey,
    string? UploadedBy,
    bool IsPlaceholder = false,
    string? SourceSystem = null);

public sealed record VendorDocumentDto(
    Guid Id,
    string VendorId,
    string DocumentType,
    string OwnerKey,
    string FileName,
    string? ContentType,
    long? FileSize,
    string Container,
    string BlobKey,
    string? UploadedBy,
    DateTimeOffset UploadedAt,
    bool IsPlaceholder,
    string? SourceSystem);
