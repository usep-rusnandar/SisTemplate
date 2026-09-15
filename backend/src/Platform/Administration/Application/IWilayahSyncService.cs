namespace IntegratedProcurement.Platform.Administration.Application;

/// <summary>
/// Synchronises the Administrative Regions master data (province → regency/city → district → village)
/// from the external <c>wilayah.id</c> API into the generic master-data store. Implementations are
/// expected to retry transient HTTP failures and to refuse a level replace when any parent request
/// is still incomplete — a re-run converges to the same result.
/// </summary>
public interface IWilayahSyncService
{
    /// <summary>Runs a full region sync. <paramref name="trigger"/> is a short label (e.g. "manual",
    /// "scheduled") used for status/audit reporting.</summary>
    Task<WilayahSyncResult> RunAsync(string trigger, CancellationToken cancellationToken);
}

/// <summary>How deep the region sync descends the hierarchy. Higher levels imply many more requests.</summary>
public enum WilayahSyncDepth
{
    Province = 1,
    Regency = 2,
    District = 3,
    Village = 4,
}

/// <summary>Where the sync currently is, for status reporting to the UI.</summary>
public enum WilayahSyncPhase
{
    Idle = 0,
    Running = 1,
    Succeeded = 2,
    Failed = 3,
}

/// <summary>Outcome of a single sync run.</summary>
public sealed record WilayahSyncResult(
    bool Success,
    int Provinces,
    int Regencies,
    int Districts,
    int Villages,
    string? Error,
    DateTimeOffset StartedAt,
    DateTimeOffset FinishedAt,
    DateOnly? SourceUpdatedAt = null,
    bool DatasetUnchanged = false);

/// <summary>Immutable snapshot of sync state, safe to hand to the API/UI at any time.</summary>
public sealed record WilayahSyncSnapshot(
    WilayahSyncPhase Phase,
    bool Enabled,
    string? Trigger,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? LastSuccessAt,
    int Provinces,
    int Regencies,
    int Districts,
    int Villages,
    string? CurrentStep,
    string? Error,
    string? StepKey = null,
    int ProgressPercent = 0,
    int ProgressDone = 0,
    int ProgressTotal = 0,
    DateOnly? SourceUpdatedAt = null)
{
    public static WilayahSyncSnapshot Initial(bool enabled) =>
        new(WilayahSyncPhase.Idle, enabled, null, null, null, null, 0, 0, 0, 0, null, null);
}
