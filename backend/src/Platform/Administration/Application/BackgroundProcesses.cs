namespace SisTemplate.Platform.Administration.Application;

public static class BackgroundProcessKeys
{
    public const string WilayahSync = "wilayahSync";
    public const string Retention = "retention";
}

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

public sealed record BackgroundProcessRuntimeSnapshot(
    bool Running,
    DateTimeOffset? LastStartedAt,
    DateTimeOffset? LastFinishedAt,
    string? LastResult,
    string? LastError,
    DateTimeOffset? NextRunAt,
    string? IdleReason);

public interface IBackgroundProcessSource
{
    string Key { get; }

    Task<BackgroundProcessDto> GetStatusAsync(CancellationToken cancellationToken);
}

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

public interface IBackgroundProcessRuntime
{
    void MarkRunning(string key, DateTimeOffset at);
    void MarkSucceeded(string key, DateTimeOffset at, string? result, DateTimeOffset? nextRunAt);
    void MarkFailed(string key, DateTimeOffset at, string failure, DateTimeOffset? nextRunAt);
    void SetNextRun(string key, DateTimeOffset? nextRunAt);
    void SetIdle(string key, string? reason);
    BackgroundProcessRuntimeSnapshot? SnapshotFor(string key);
}
