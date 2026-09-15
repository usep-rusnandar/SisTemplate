using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;

public sealed class CipCaseDocument : AuditableEntity
{
    private CipCaseDocument()
    {
        CaseKey = string.Empty;
        DocumentKey = string.Empty;
        DocumentType = string.Empty;
        FileName = string.Empty;
        PayloadJson = string.Empty;
    }

    public CipCaseDocument(
        Guid id,
        string caseKey,
        string documentKey,
        string documentType,
        string? fileName,
        DateTimeOffset? generatedAt,
        long size,
        string? dataUri,
        string payloadJson,
        string? container = null,
        string? blobKey = null)
        : base(id)
    {
        CaseKey = caseKey;
        DocumentKey = documentKey;
        DocumentType = documentType;
        FileName = fileName ?? string.Empty;
        GeneratedAt = generatedAt;
        Size = size;
        DataUri = dataUri;
        PayloadJson = payloadJson;
        Container = container;
        BlobKey = blobKey;
    }

    public string CaseKey { get; private set; }

    public string DocumentKey { get; private set; }

    public string DocumentType { get; private set; }

    public string FileName { get; private set; }

    public DateTimeOffset? GeneratedAt { get; private set; }

    public long Size { get; private set; }

    public string? DataUri { get; private set; }

    /// <summary>Azure Blob container holding the file (documents are stored in Blob, not the DB).</summary>
    public string? Container { get; private set; }

    /// <summary>Azure Blob key (path) of the stored file.</summary>
    public string? BlobKey { get; private set; }

    public string PayloadJson { get; private set; }

    /// <summary>Replace the stored file metadata on regenerate. Blob bytes live in Azure; this row only holds the reference.</summary>
    public void ReplaceGeneratedFile(
        string? fileName,
        DateTimeOffset? generatedAt,
        long size,
        string? dataUri,
        string payloadJson,
        string? container,
        string? blobKey)
    {
        FileName = string.IsNullOrWhiteSpace(fileName) ? FileName : fileName;
        GeneratedAt = generatedAt;
        Size = size;
        DataUri = dataUri;
        PayloadJson = payloadJson ?? string.Empty;
        Container = container;
        BlobKey = blobKey;
    }
}
