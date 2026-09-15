using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>Lifecycle states of a document-migration batch.</summary>
public static class ImportJobStatus
{
    public const string Queued = "Queued";
    public const string Running = "Running";
    public const string Paused = "Paused";
    public const string Completed = "Completed";
    public const string CompletedWithErrors = "CompletedWithErrors";
}

/// <summary>
/// A background document-migration batch: one uploaded contract export whose document links are
/// fetched from SharePoint and stored in Azure Blob. Runs server-side so it survives the user leaving
/// the page; progress is read back through <see cref="ImportJobRow"/>s.
/// </summary>
public sealed class ImportJob : AuditableEntity
{
    private ImportJob()
    {
        BatchCode = string.Empty;
        FileName = string.Empty;
        Status = ImportJobStatus.Queued;
    }

    public ImportJob(Guid id, string batchCode, string fileName, string? startedByPersonnelNo, string? startedByName, int totalRows)
        : base(id)
    {
        BatchCode = batchCode;
        FileName = fileName;
        StartedByPersonnelNo = startedByPersonnelNo;
        StartedByName = startedByName;
        TotalRows = totalRows;
        Status = ImportJobStatus.Queued;
    }

    public string BatchCode { get; private set; }

    public string FileName { get; private set; }

    public string? StartedByPersonnelNo { get; private set; }

    public string? StartedByName { get; private set; }

    public string Status { get; private set; }

    public int TotalRows { get; private set; }

    public int StoredCount { get; private set; }

    public int FailedCount { get; private set; }

    public int SkippedCount { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public bool IsTerminal =>
        Status is ImportJobStatus.Completed or ImportJobStatus.CompletedWithErrors;

    public void MarkRunning(DateTimeOffset now)
    {
        StartedAt ??= now;
        Status = ImportJobStatus.Running;
        CompletedAt = null;
    }

    public void Pause() => Status = ImportJobStatus.Paused;

    public void Resume() => Status = ImportJobStatus.Running;

    public void Complete(DateTimeOffset now)
    {
        Status = FailedCount > 0 ? ImportJobStatus.CompletedWithErrors : ImportJobStatus.Completed;
        CompletedAt = now;
    }

    public void ApplyCounts(int stored, int failed, int skipped)
    {
        StoredCount = stored;
        FailedCount = failed;
        SkippedCount = skipped;
    }
}
