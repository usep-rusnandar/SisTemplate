using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

public static class VendorImportStatuses
{
    public const string Validated = "Validated";
    public const string Committing = "Committing";
    public const string Completed = "Completed";
    public const string CompletedWithErrors = "CompletedWithErrors";
}

public static class VendorImportRowStatuses
{
    public const string Ready = "Ready";
    public const string Warning = "Warning";
    public const string Error = "Error";
    public const string Imported = "Imported";
    public const string Skipped = "Skipped";
}

/// <summary>Auditable validation/commit boundary for one manually uploaded Ariba workbook.</summary>
public sealed class VendorImportBatch : AuditableEntity
{
    private VendorImportBatch() { }

    private VendorImportBatch(string fileName, string fileHash, string actor) : base(Guid.NewGuid())
    {
        FileName = fileName;
        FileHash = fileHash;
        Status = VendorImportStatuses.Validated;
        StartedBy = actor;
    }

    public string FileName { get; private set; } = string.Empty;
    public string FileHash { get; private set; } = string.Empty;
    public string Status { get; private set; } = string.Empty;
    public string StartedBy { get; private set; } = string.Empty;
    public int TotalRows { get; private set; }
    public int ReadyRows { get; private set; }
    public int WarningRows { get; private set; }
    public int ErrorRows { get; private set; }
    public int ImportedRows { get; private set; }
    public int SkippedRows { get; private set; }
    public DateTimeOffset? CommittedAt { get; private set; }

    public static VendorImportBatch Create(string fileName, string fileHash, string actor) =>
        new(fileName.Trim(), fileHash, actor);

    public void SetValidationCounts(int total, int ready, int warning, int error)
    {
        TotalRows = total; ReadyRows = ready; WarningRows = warning; ErrorRows = error;
    }

    public void BeginCommit() => Status = VendorImportStatuses.Committing;

    public void Complete(int imported, int skipped, int errors)
    {
        ImportedRows = imported;
        SkippedRows = skipped;
        ErrorRows = errors;
        Status = errors > 0 ? VendorImportStatuses.CompletedWithErrors : VendorImportStatuses.Completed;
        CommittedAt = DateTimeOffset.UtcNow;
    }
}

/// <summary>Stored dry-run result and normalized payload for one Vendors worksheet row.</summary>
public sealed class VendorImportRow : AuditableEntity
{
    private VendorImportRow() { }

    private VendorImportRow(Guid batchId, int rowNumber, string externalVendorId, string vendorName,
        string picEmail, string status, string issuesJson, string payloadJson) : base(Guid.NewGuid())
    {
        BatchId = batchId; RowNumber = rowNumber; ExternalVendorId = externalVendorId;
        VendorName = vendorName; PicEmail = picEmail; Status = status;
        IssuesJson = issuesJson; PayloadJson = payloadJson;
    }

    public Guid BatchId { get; private set; }
    public int RowNumber { get; private set; }
    public string ExternalVendorId { get; private set; } = string.Empty;
    public string VendorName { get; private set; } = string.Empty;
    public string PicEmail { get; private set; } = string.Empty;
    public string Status { get; private set; } = string.Empty;
    public string IssuesJson { get; private set; } = "[]";
    public string PayloadJson { get; private set; } = "{}";
    public string? VendorId { get; private set; }

    public static VendorImportRow Create(Guid batchId, int rowNumber, string externalVendorId, string vendorName,
        string picEmail, string status, string issuesJson, string payloadJson) =>
        new(batchId, rowNumber, externalVendorId, vendorName, picEmail, status, issuesJson, payloadJson);

    public void MarkImported(string vendorId, string? issuesJson = null)
    {
        VendorId = vendorId;
        Status = VendorImportRowStatuses.Imported;
        if (!string.IsNullOrWhiteSpace(issuesJson))
        {
            IssuesJson = issuesJson;
        }
    }
    public void MarkSkipped(string reasonJson) { Status = VendorImportRowStatuses.Skipped; IssuesJson = reasonJson; }
    public void MarkError(string issuesJson) { Status = VendorImportRowStatuses.Error; IssuesJson = issuesJson; }
}

/// <summary>
/// Permanent idempotency map from an Ariba vendor id to an application vendor.
/// Re-import may refresh the hash/batch, or relink when an INITL vendor is overwritten.
/// </summary>
public sealed class VendorExternalReference : AuditableEntity
{
    private VendorExternalReference() { }

    private VendorExternalReference(string vendorId, string sourceSystem, string externalVendorId,
        Guid importBatchId, string payloadHash, DateTimeOffset? sourceUpdatedAt) : base(Guid.NewGuid())
    {
        VendorId = vendorId; SourceSystem = sourceSystem; ExternalVendorId = externalVendorId;
        ImportBatchId = importBatchId; PayloadHash = payloadHash; SourceUpdatedAt = sourceUpdatedAt;
        ImportedAt = DateTimeOffset.UtcNow;
    }

    public string VendorId { get; private set; } = string.Empty;
    public string SourceSystem { get; private set; } = string.Empty;
    public string ExternalVendorId { get; private set; } = string.Empty;
    public Guid ImportBatchId { get; private set; }
    public string PayloadHash { get; private set; } = string.Empty;
    public DateTimeOffset? SourceUpdatedAt { get; private set; }
    public DateTimeOffset ImportedAt { get; private set; }

    public static VendorExternalReference Create(string vendorId, string sourceSystem, string externalVendorId,
        Guid importBatchId, string payloadHash, DateTimeOffset? sourceUpdatedAt) =>
        new(vendorId, sourceSystem.Trim(), externalVendorId.Trim(), importBatchId, payloadHash, sourceUpdatedAt);

    public void Relink(string externalVendorId, Guid importBatchId, string payloadHash, DateTimeOffset? sourceUpdatedAt)
    {
        ExternalVendorId = externalVendorId.Trim();
        Refresh(importBatchId, payloadHash, sourceUpdatedAt);
    }

    public void Refresh(Guid importBatchId, string payloadHash, DateTimeOffset? sourceUpdatedAt)
    {
        ImportBatchId = importBatchId;
        PayloadHash = payloadHash;
        SourceUpdatedAt = sourceUpdatedAt;
        ImportedAt = DateTimeOffset.UtcNow;
    }
}
