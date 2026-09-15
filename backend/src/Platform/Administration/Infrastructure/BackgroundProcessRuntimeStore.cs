using System.Collections.Concurrent;
using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

/// <summary>Process-wide last/next/error bag for hosted loops that do not already own a coordinator.</summary>
public sealed class BackgroundProcessRuntimeStore : IBackgroundProcessRuntime
{
    private readonly ConcurrentDictionary<string, BackgroundProcessRuntimeSnapshot> _items = new(StringComparer.OrdinalIgnoreCase);

    public void MarkRunning(string key, DateTimeOffset at) =>
        Mutate(key, previous => previous with
        {
            Running = true,
            LastStartedAt = at,
            IdleReason = null,
        });

    public void MarkSucceeded(string key, DateTimeOffset at, string? result, DateTimeOffset? nextRunAt) =>
        Mutate(key, previous => previous with
        {
            Running = false,
            LastFinishedAt = at,
            LastResult = result,
            LastError = null,
            NextRunAt = nextRunAt ?? previous.NextRunAt,
            IdleReason = null,
        });

    public void MarkFailed(string key, DateTimeOffset at, string failure, DateTimeOffset? nextRunAt) =>
        Mutate(key, previous => previous with
        {
            Running = false,
            LastFinishedAt = at,
            LastError = Truncate(failure),
            NextRunAt = nextRunAt ?? previous.NextRunAt,
        });

    public void SetNextRun(string key, DateTimeOffset? nextRunAt) =>
        Mutate(key, previous => previous with { NextRunAt = nextRunAt });

    public void SetIdle(string key, string? reason) =>
        Mutate(key, previous => previous with
        {
            Running = false,
            IdleReason = reason,
            NextRunAt = null,
        });

    public BackgroundProcessRuntimeSnapshot? SnapshotFor(string key) =>
        _items.TryGetValue(key, out var snapshot) ? snapshot : null;

    private void Mutate(string key, Func<BackgroundProcessRuntimeSnapshot, BackgroundProcessRuntimeSnapshot> transform)
    {
        _items.AddOrUpdate(
            key,
            _ => transform(Empty),
            (_, previous) => transform(previous));
    }

    private static BackgroundProcessRuntimeSnapshot Empty =>
        new(false, null, null, null, null, null, null);

    private static string Truncate(string error)
    {
        var trimmed = error.Trim();
        return trimmed.Length <= 500 ? trimmed : trimmed[..500];
    }
}
