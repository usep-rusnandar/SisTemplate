using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Platform.Administration.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.AppHost.Api.Services;

/// <summary>Schedule for the E-Proposal ingestion background pull.</summary>
public sealed class EproposalIngestionScheduleOptions
{
    public const string SectionName = "EproposalIngestion";

    /// <summary>Master switch. When false the scheduler never runs (manual Sync endpoint still works).</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Minutes between scheduled pulls. Clamped to a sane floor at runtime.</summary>
    public int IntervalMinutes { get; set; } = 30;

    /// <summary>Delay before the first pull after startup, in seconds.</summary>
    public int InitialDelaySeconds { get; set; } = 30;
}

/// <summary>
/// Periodically pulls proposals from E-Proposal into the Tracker domain. Idle when the connection
/// string is missing so Staging/Prod without EproposalConnection are unaffected.
/// </summary>
public sealed class EproposalIngestionScheduler : BackgroundService
{
    private static readonly Action<ILogger, bool, bool, Exception?> LogIdle =
        LoggerMessage.Define<bool, bool>(LogLevel.Information, new EventId(1, "EproposalSchedIdle"),
            "E-Proposal ingestion scheduler idle (enabled={Enabled}, configured={Configured}).");

    private static readonly Action<ILogger, Exception?> LogFailed =
        LoggerMessage.Define(LogLevel.Error, new EventId(2, "EproposalSchedError"),
            "Scheduled E-Proposal ingestion failed; will retry on the next tick.");

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly EproposalIngestionOptions _connection;
    private readonly EproposalIngestionScheduleOptions _schedule;
    private readonly IBackgroundProcessRuntime _runtime;
    private readonly ILogger<EproposalIngestionScheduler> _logger;

    public EproposalIngestionScheduler(
        IServiceScopeFactory scopeFactory,
        EproposalIngestionOptions connection,
        IOptions<EproposalIngestionScheduleOptions> schedule,
        IBackgroundProcessRuntime runtime,
        ILogger<EproposalIngestionScheduler> logger)
    {
        _scopeFactory = scopeFactory;
        _connection = connection;
        _schedule = schedule.Value;
        _runtime = runtime;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_schedule.Enabled || !_connection.IsConfigured)
        {
            var reason = !_schedule.Enabled
                ? "Disabled by configuration (EproposalIngestion:Enabled)."
                : "EproposalConnection is not configured.";
            _runtime.SetIdle(BackgroundProcessKeys.EproposalIngestion, reason);
            LogIdle(_logger, _schedule.Enabled, _connection.IsConfigured, null);
            return;
        }

        try
        {
            var initial = TimeSpan.FromSeconds(Math.Max(0, _schedule.InitialDelaySeconds));
            _runtime.SetNextRun(BackgroundProcessKeys.EproposalIngestion, DateTimeOffset.UtcNow + initial);
            await Task.Delay(initial, stoppingToken);
            var interval = TimeSpan.FromMinutes(Math.Max(5, _schedule.IntervalMinutes));
            while (!stoppingToken.IsCancellationRequested)
            {
                await RunOnceAsync(stoppingToken);
                var next = DateTimeOffset.UtcNow + interval;
                _runtime.SetNextRun(BackgroundProcessKeys.EproposalIngestion, next);
                await Task.Delay(interval, stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // host shutting down
        }
    }

    private async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        _runtime.MarkRunning(BackgroundProcessKeys.EproposalIngestion, DateTimeOffset.UtcNow);
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IEproposalIngestionService>();
            var result = await service.IngestAsync(cancellationToken);
            var summary = result.Enabled
                ? $"fetched={result.Fetched}, inserted={result.Inserted}, updated={result.Updated}, skipped={result.Skipped}"
                : "disabled";
            _runtime.MarkSucceeded(BackgroundProcessKeys.EproposalIngestion, DateTimeOffset.UtcNow, summary, nextRunAt: null);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _runtime.MarkFailed(BackgroundProcessKeys.EproposalIngestion, DateTimeOffset.UtcNow, ex.Message, nextRunAt: null);
            LogFailed(_logger, ex);
        }
    }
}
