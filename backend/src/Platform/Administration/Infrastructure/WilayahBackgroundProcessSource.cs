using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Platform.Administration.Application;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

internal sealed class WilayahBackgroundProcessSource : IBackgroundProcessSource
{
    private readonly IWilayahSyncCoordinator _coordinator;
    private readonly WilayahSyncOptions _options;

    public WilayahBackgroundProcessSource(IWilayahSyncCoordinator coordinator, IOptions<WilayahSyncOptions> options)
    {
        _coordinator = coordinator;
        _options = options.Value;
    }

    public string Key => BackgroundProcessKeys.WilayahSync;

    public Task<BackgroundProcessDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var snapshot = _coordinator.Current;
        var running = snapshot.Phase == WilayahSyncPhase.Running;
        var lastResult = running
            ? FormatProgress(snapshot)
            : FormatCounts(snapshot);
        var nextRun = snapshot.Enabled
            ? BackgroundProcessSchedule.NextMonthlyUtc(
                DateTimeOffset.UtcNow,
                _options.NormalizedDayOfMonth,
                _options.NormalizedHourUtc)
            : (DateTimeOffset?)null;

        return Task.FromResult(new BackgroundProcessDto(
            Key,
            "Administrative Regions sync",
            ModuleKeys.MasterData,
            BackgroundProcessKinds.Scheduled,
            snapshot.Enabled,
            Idle: !snapshot.Enabled || !running,
            IdleReason: snapshot.Enabled ? null : "Disabled by configuration (Wilayah:Enabled).",
            BackgroundProcessSchedule.MonthlyWib(_options.NormalizedDayOfMonth, _options.NormalizedHourUtc),
            snapshot.FinishedAt ?? snapshot.LastSuccessAt,
            nextRun,
            lastResult,
            snapshot.Error,
            CanRunNow: snapshot.Enabled && !running,
            running,
            OperationalRoute: "adminRegions",
            QueueDepth: null,
            InFlightCount: null));
    }

    private static string? FormatProgress(WilayahSyncSnapshot snapshot)
    {
        var step = string.IsNullOrWhiteSpace(snapshot.CurrentStep) ? "Running" : snapshot.CurrentStep;
        return snapshot.ProgressPercent > 0 ? $"{step} ({snapshot.ProgressPercent}%)" : step;
    }

    private static string? FormatCounts(WilayahSyncSnapshot snapshot)
    {
        if (snapshot.LastSuccessAt is null && snapshot.Provinces == 0 && snapshot.Villages == 0)
        {
            return null;
        }

        return $"{snapshot.Provinces} provinces, {snapshot.Regencies} cities, {snapshot.Districts} districts, {snapshot.Villages} villages";
    }
}

internal sealed class WilayahBackgroundProcessRunner : IBackgroundProcessRunner
{
    private readonly IWilayahSyncCoordinator _coordinator;

    public WilayahBackgroundProcessRunner(IWilayahSyncCoordinator coordinator) => _coordinator = coordinator;

    public string Key => BackgroundProcessKeys.WilayahSync;

    public Task<BackgroundProcessRunResult> RunNowAsync(CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var snapshot = _coordinator.Current;
        if (!snapshot.Enabled)
        {
            return Task.FromResult(new BackgroundProcessRunResult(
                BackgroundProcessOutcomes.Rejected,
                "wilayah_sync_disabled"));
        }

        if (snapshot.Phase == WilayahSyncPhase.Running)
        {
            return Task.FromResult(new BackgroundProcessRunResult(
                BackgroundProcessOutcomes.Accepted,
                "already_running"));
        }

        _coordinator.RequestRun();
        return Task.FromResult(new BackgroundProcessRunResult(
            BackgroundProcessOutcomes.Accepted,
            "requested"));
    }
}
