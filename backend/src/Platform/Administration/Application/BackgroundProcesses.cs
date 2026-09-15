namespace IntegratedProcurement.Platform.Administration.Application;

/// <summary>Stable keys for every process surfaced on Super Admin ▸ Background processes.</summary>
public static class BackgroundProcessKeys
{
    public const string WilayahSync = "wilayahSync";
    public const string Retention = "retention";
    public const string EproposalIngestion = "eproposalIngestion";
    public const string ContractImportQueue = "contractImportQueue";
    public const string ContractReminderScan = "contractReminderScan";
}

/// <summary>Catalog kinds. Stored and returned as these exact strings (not a serialized enum).</summary>
public static class BackgroundProcessKinds
{
    public const string Scheduled = "scheduled";
    public const string Interval = "interval";
    public const string Queue = "queue";
    public const string OnDemand = "onDemand";
}

public static class BackgroundProcessOutcomes
{
    public const string Accepted = "accepted";
    public const string Completed = "completed";
    public const string Rejected = "rejected";
}

/// <summary>
/// One row in the Super Admin background-process catalog. Timestamps are UTC instants; the UI
/// converts them to WIB. <see cref="ScheduleSummary"/> is already a Jakarta-facing sentence.
/// </summary>
public sealed record BackgroundProcessDto(
    string Key,
    string Name,
    string ModuleKey,
    string Kind,
    bool Enabled,
    bool Idle,
    string? IdleReason,
    string? ScheduleSummary,
    DateTimeOffset? LastRunAt,
    DateTimeOffset? NextRunAt,
    string? LastResult,
    string? LastError,
    bool CanRunNow,
    bool Running,
    string? OperationalRoute,
    int? QueueDepth,
    int? InFlightCount);

public sealed record BackgroundProcessCatalogResponse(
    IReadOnlyList<BackgroundProcessDto> Items,
    string ArchitectureNote);

public sealed record BackgroundProcessRunResult(string Outcome, string? Message);

public sealed record BackgroundProcessRunResponse(
    string Key,
    string Outcome,
    string? Message,
    BackgroundProcessDto? Process);

/// <summary>Live last/next/error snapshot for processes that do not already own a coordinator.</summary>
public sealed record BackgroundProcessRuntimeSnapshot(
    bool Running,
    DateTimeOffset? LastStartedAt,
    DateTimeOffset? LastFinishedAt,
    string? LastResult,
    string? LastError,
    DateTimeOffset? NextRunAt,
    string? IdleReason);

/// <summary>Supplies one catalog row. Registered in DI; the catalog enumerates every implementation.</summary>
public interface IBackgroundProcessSource
{
    string Key { get; }

    Task<BackgroundProcessDto> GetStatusAsync(CancellationToken cancellationToken);
}

/// <summary>Optional "Run now" for scheduled/interval jobs. Queue and on-demand processes omit this.</summary>
public interface IBackgroundProcessRunner
{
    string Key { get; }

    Task<BackgroundProcessRunResult> RunNowAsync(CancellationToken cancellationToken);
}

public interface IBackgroundProcessCatalog
{
    Task<BackgroundProcessCatalogResponse> ListAsync(CancellationToken cancellationToken);

    Task<BackgroundProcessRunResponse> RunNowAsync(string key, CancellationToken cancellationToken);
}

/// <summary>In-memory last/next/error for host loops. Lost on process restart unless the source also persists.</summary>
public interface IBackgroundProcessRuntime
{
    void MarkRunning(string key, DateTimeOffset at);

    void MarkSucceeded(string key, DateTimeOffset at, string? result, DateTimeOffset? nextRunAt);

    void MarkFailed(string key, DateTimeOffset at, string failure, DateTimeOffset? nextRunAt);

    void SetNextRun(string key, DateTimeOffset? nextRunAt);

    void SetIdle(string key, string? reason);

    BackgroundProcessRuntimeSnapshot? SnapshotFor(string key);
}
