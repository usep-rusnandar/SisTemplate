using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Platform.Administration.Application;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.AppHost.Api.Services;

internal sealed class EproposalBackgroundProcessSource : IBackgroundProcessSource
{
    private readonly EproposalIngestionOptions _connection;
    private readonly EproposalIngestionScheduleOptions _schedule;
    private readonly IBackgroundProcessRuntime _runtime;

    public EproposalBackgroundProcessSource(
        EproposalIngestionOptions connection,
        IOptions<EproposalIngestionScheduleOptions> schedule,
        IBackgroundProcessRuntime runtime)
    {
        _connection = connection;
        _schedule = schedule.Value;
        _runtime = runtime;
    }

    public string Key => BackgroundProcessKeys.EproposalIngestion;

    public Task<BackgroundProcessDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var live = _runtime.SnapshotFor(Key);
        var configured = _connection.IsConfigured;
        var enabled = _schedule.Enabled && configured;
        string? idleReason = null;
        if (!_schedule.Enabled)
        {
            idleReason = "Disabled by configuration (EproposalIngestion:Enabled).";
        }
        else if (!configured)
        {
            idleReason = "EproposalConnection is not configured.";
        }

        var intervalMinutes = Math.Max(5, _schedule.IntervalMinutes);
        return Task.FromResult(new BackgroundProcessDto(
            Key,
            "E-Proposal ingestion",
            ModuleKeys.ProposalTracker,
            BackgroundProcessKinds.Interval,
            enabled,
            Idle: live is not { Running: true },
            idleReason,
            enabled
                ? BackgroundProcessSchedule.EveryMinutes(intervalMinutes)
                : BackgroundProcessSchedule.EveryMinutes(intervalMinutes),
            live?.LastFinishedAt,
            enabled ? live?.NextRunAt : null,
            live?.LastResult,
            live?.LastError,
            CanRunNow: configured && live is not { Running: true },
            Running: live is { Running: true },
            OperationalRoute: "trackerProposals",
            QueueDepth: null,
            InFlightCount: null));
    }
}

internal sealed class EproposalBackgroundProcessRunner : IBackgroundProcessRunner
{
    private readonly IEproposalIngestionService _ingestion;
    private readonly EproposalIngestionOptions _connection;
    private readonly IBackgroundProcessRuntime _runtime;

    public EproposalBackgroundProcessRunner(
        IEproposalIngestionService ingestion,
        EproposalIngestionOptions connection,
        IBackgroundProcessRuntime runtime)
    {
        _ingestion = ingestion;
        _connection = connection;
        _runtime = runtime;
    }

    public string Key => BackgroundProcessKeys.EproposalIngestion;

    public async Task<BackgroundProcessRunResult> RunNowAsync(CancellationToken cancellationToken)
    {
        if (!_connection.IsConfigured)
        {
            return new BackgroundProcessRunResult(BackgroundProcessOutcomes.Rejected, "not_configured");
        }

        _runtime.MarkRunning(Key, DateTimeOffset.UtcNow);
        try
        {
            var result = await _ingestion.IngestAsync(cancellationToken);
            var summary = result.Enabled
                ? $"fetched={result.Fetched}, inserted={result.Inserted}, updated={result.Updated}, skipped={result.Skipped}"
                : "disabled";
            _runtime.MarkSucceeded(Key, DateTimeOffset.UtcNow, summary, nextRunAt: null);
            return result.Enabled
                ? new BackgroundProcessRunResult(BackgroundProcessOutcomes.Completed, summary)
                : new BackgroundProcessRunResult(BackgroundProcessOutcomes.Rejected, "not_configured");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _runtime.MarkFailed(Key, DateTimeOffset.UtcNow, ex.Message, nextRunAt: null);
            throw;
        }
    }
}

internal sealed class ContractImportQueueProcessSource : IBackgroundProcessSource
{
    private readonly IImportJobRepository _jobs;
    private readonly ImportJobProcessor _processor;
    private readonly IBackgroundProcessRuntime _runtime;

    public ContractImportQueueProcessSource(
        IImportJobRepository jobs,
        ImportJobProcessor processor,
        IBackgroundProcessRuntime runtime)
    {
        _jobs = jobs;
        _processor = processor;
        _runtime = runtime;
    }

    public string Key => BackgroundProcessKeys.ContractImportQueue;

    public async Task<BackgroundProcessDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        var snapshot = await _jobs.GetQueueSnapshotAsync(cancellationToken);
        var live = _runtime.SnapshotFor(Key);
        var pipelineReady = _processor.CanRun;
        var running = snapshot.RunningJobs > 0;
        string? lastResult = null;
        if (snapshot.LastCompletedAt is not null)
        {
            lastResult =
                $"{snapshot.LastStatus} {snapshot.LastFileName} (stored={snapshot.LastStored}, failed={snapshot.LastFailed}, skipped={snapshot.LastSkipped})";
        }

        return new BackgroundProcessDto(
            Key,
            "Contract document import queue",
            ModuleKeys.ContractMonitoring,
            BackgroundProcessKinds.Queue,
            pipelineReady,
            Idle: !running,
            IdleReason: pipelineReady ? null : "SharePoint or Blob storage is not configured.",
            BackgroundProcessSchedule.EventDriven,
            snapshot.LastCompletedAt ?? live?.LastFinishedAt,
            NextRunAt: null,
            lastResult,
            live?.LastError,
            CanRunNow: false,
            running,
            OperationalRoute: "cmImport",
            QueueDepth: snapshot.QueuedJobs,
            InFlightCount: snapshot.RunningJobs);
    }
}

internal sealed class ContractReminderProcessSource : IBackgroundProcessSource
{
    public string Key => BackgroundProcessKeys.ContractReminderScan;

    public Task<BackgroundProcessDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        return Task.FromResult(new BackgroundProcessDto(
            Key,
            "Contract expiry reminder scan",
            ModuleKeys.ContractMonitoring,
            BackgroundProcessKinds.OnDemand,
            Enabled: true,
            Idle: true,
            IdleReason: "No host scheduler — the daily Hangfire job was never wired; scan is on-demand from Contract Monitoring.",
            BackgroundProcessSchedule.NotHostScheduled,
            LastRunAt: null,
            NextRunAt: null,
            LastResult: null,
            LastError: null,
            CanRunNow: false,
            Running: false,
            OperationalRoute: "cmExpiry",
            QueueDepth: null,
            InFlightCount: null));
    }
}
