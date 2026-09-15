namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>
/// Data-access contract for background document-migration jobs. Used both by the request-scoped
/// application service (create / list / retry / pause) and by the background runner (claim work,
/// advance rows, finalize). Implementation lives in the module's Infrastructure layer.
/// </summary>
public interface IImportJobRepository
{
    void AddJob(ImportJob job);

    void AddRow(ImportJobRow row);

    Task<ImportJob?> GetJobAsync(Guid jobId, CancellationToken cancellationToken);

    Task<IReadOnlyList<ImportJob>> ListRecentJobsAsync(int take, CancellationToken cancellationToken);

    Task<IReadOnlyList<ImportJobRow>> GetRowsAsync(Guid jobId, CancellationToken cancellationToken);

    /// <summary>The job currently being worked: an already-Running job, or the oldest Queued job promoted to Running.</summary>
    Task<ImportJob?> ClaimNextRunnableJobAsync(DateTimeOffset now, CancellationToken cancellationToken);

    Task<IReadOnlyList<Guid>> GetQueuedRowIdsAsync(Guid jobId, int limit, CancellationToken cancellationToken);

    Task<ImportJobRow?> GetRowAsync(Guid rowId, CancellationToken cancellationToken);

    /// <summary>
    /// Latest Stored migration row for a sharing URL (full or nvarchar(1000) prefix),
    /// or — when the URL misses — the latest Stored row for <paramref name="contractId"/>.
    /// </summary>
    Task<ImportJobRow?> FindLatestStoredRowAsync(
        string? sharingLink,
        string? contractId,
        CancellationToken cancellationToken);

    Task<bool> HasPendingRowsAsync(Guid jobId, CancellationToken cancellationToken);

    /// <summary>Recompute Stored/Failed/Skipped tallies from the rows and apply them to the job.</summary>
    Task RecomputeCountsAsync(ImportJob job, CancellationToken cancellationToken);

    /// <summary>Reset rows left mid-flight by a crash (Fetching/Storing) back to Queued so they re-run.</summary>
    Task<int> ResetInFlightRowsAsync(CancellationToken cancellationToken);

    /// <summary>Reset Failed rows of a job to Queued (for retry). Returns the count reset.</summary>
    Task<int> ResetFailedRowsAsync(Guid jobId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>Queued/running counts plus the most recently completed job, for the Super Admin catalog.</summary>
    Task<ImportJobQueueSnapshot> GetQueueSnapshotAsync(CancellationToken cancellationToken);
}

public sealed record ImportJobQueueSnapshot(
    int QueuedJobs,
    int RunningJobs,
    DateTimeOffset? LastCompletedAt,
    string? LastStatus,
    string? LastFileName,
    int LastStored,
    int LastFailed,
    int LastSkipped);
