using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>Per-document transit states within an <see cref="ImportJob"/>.</summary>
public static class ImportRowState
{
    public const string Queued = "Queued";
    public const string Fetching = "Fetching";   // downloading from SharePoint
    public const string Storing = "Storing";     // uploading to Azure Blob
    public const string Stored = "Stored";
    public const string Failed = "Failed";
    public const string Skipped = "Skipped";     // no document link
}

/// <summary>
/// One contract document in an import batch, tracked as it travels SharePoint → Azure Blob. The row's
/// <see cref="State"/> is updated live as the background runner processes it, so the UI can poll progress.
/// </summary>
public sealed class ImportJobRow : AuditableEntity
{
    private ImportJobRow()
    {
        ContractId = string.Empty;
        Title = string.Empty;
        Supplier = string.Empty;
        State = ImportRowState.Queued;
    }

    public ImportJobRow(
        Guid id,
        Guid jobId,
        int rowIndex,
        string contractId,
        string title,
        string supplier,
        string? sharingLink)
        : base(id)
    {
        JobId = jobId;
        RowIndex = rowIndex;
        ContractId = contractId;
        Title = title;
        Supplier = supplier;
        SharingLink = string.IsNullOrWhiteSpace(sharingLink)
            ? sharingLink
            : SharePointDocument.TruncateSharingLink(sharingLink);
        // A row with no SharePoint link has nothing to migrate.
        State = string.IsNullOrWhiteSpace(sharingLink) ? ImportRowState.Skipped : ImportRowState.Queued;
        FailReason = State == ImportRowState.Skipped ? "No document link" : null;
    }

    public Guid JobId { get; private set; }

    public int RowIndex { get; private set; }

    public string ContractId { get; private set; }

    public string Title { get; private set; }

    public string Supplier { get; private set; }

    public string? SharingLink { get; private set; }

    public long? SizeBytes { get; private set; }

    public string State { get; private set; }

    public string? BlobContainer { get; private set; }

    public string? BlobKey { get; private set; }

    public string? FailReason { get; private set; }

    public bool IsPending => State is ImportRowState.Queued or ImportRowState.Fetching or ImportRowState.Storing;

    public void MarkFetching()
    {
        State = ImportRowState.Fetching;
        FailReason = null;
    }

    public void MarkStoring(long sizeBytes)
    {
        State = ImportRowState.Storing;
        SizeBytes = sizeBytes;
    }

    public void MarkStored(string container, string blobKey, long sizeBytes)
    {
        State = ImportRowState.Stored;
        BlobContainer = container;
        BlobKey = blobKey;
        SizeBytes = sizeBytes;
        FailReason = null;
    }

    public void MarkFailed(string reason)
    {
        State = ImportRowState.Failed;
        FailReason = reason;
    }

    public void ResetToQueued()
    {
        State = ImportRowState.Queued;
        FailReason = null;
    }
}
