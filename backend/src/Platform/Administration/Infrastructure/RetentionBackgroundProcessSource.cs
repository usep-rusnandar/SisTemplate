using System.Text.Json;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

internal sealed class RetentionBackgroundProcessSource : IBackgroundProcessSource
{
    internal static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(2);
    internal static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IBackgroundProcessRuntime _runtime;
    private readonly IAdminConsoleConfigurationService _configuration;

    public RetentionBackgroundProcessSource(
        IBackgroundProcessRuntime runtime,
        IAdminConsoleConfigurationService configuration)
    {
        _runtime = runtime;
        _configuration = configuration;
    }

    public string Key => BackgroundProcessKeys.Retention;

    public async Task<BackgroundProcessDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        var live = _runtime.SnapshotFor(Key);
        var persisted = await ReadPersistedAsync(cancellationToken);
        var lastRun = live?.LastFinishedAt ?? persisted?.LastFinishedAt;
        var lastResult = live?.LastResult ?? persisted?.LastResult;
        var lastError = live?.LastError ?? persisted?.LastError;

        return new BackgroundProcessDto(
            Key,
            "Data retention cleanup",
            ModuleKeys.SuperAdmin,
            BackgroundProcessKinds.Interval,
            Enabled: true,
            Idle: live is not { Running: true },
            IdleReason: null,
            BackgroundProcessSchedule.EveryHoursAfterStartup(StartupDelay, Interval),
            lastRun,
            live?.NextRunAt,
            lastResult,
            lastError,
            CanRunNow: live is not { Running: true },
            Running: live is { Running: true },
            OperationalRoute: "settings",
            QueueDepth: null,
            InFlightCount: null);
    }

    private async Task<PersistedRetentionState?> ReadPersistedAsync(CancellationToken cancellationToken)
    {
        var settings = await _configuration.GetSettingsAsync(cancellationToken);
        if (settings.Values is null
            || !settings.Values.TryGetValue(RetentionService.StateSettingsKey, out var element)
            || element.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        try
        {
            return element.Deserialize<PersistedRetentionState>(JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    internal sealed record PersistedRetentionState(
        DateTimeOffset? LastFinishedAt,
        string? LastResult,
        string? LastError);
}

internal sealed class RetentionBackgroundProcessRunner : IBackgroundProcessRunner
{
    private readonly IRetentionService _retention;

    public RetentionBackgroundProcessRunner(IRetentionService retention) => _retention = retention;

    public string Key => BackgroundProcessKeys.Retention;

    public async Task<BackgroundProcessRunResult> RunNowAsync(CancellationToken cancellationToken)
    {
        var result = await _retention.RunAsync(cancellationToken);
        return new BackgroundProcessRunResult(
            BackgroundProcessOutcomes.Completed,
            $"audit={result.AuditDeleted}, notifications={result.NotificationsDeleted}, emailLogs={result.EmailLogsDeleted}");
    }
}
