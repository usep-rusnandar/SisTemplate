using System.Text.Json;
using SisTemplate.Platform.Administration.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SisTemplate.Platform.Administration.Infrastructure;

/// <summary>
/// Drives the Administrative Regions sync: fires on the configured day-of-month (default the 1st,
/// 17:00 UTC / 00:00 WIB) and also whenever the manual "Sync" button raises <see cref="WilayahSyncSignal.RequestRun"/>.
/// Runs are sequential (the loop is single-threaded), so a manual trigger during a run is coalesced.
/// </summary>
internal sealed class WilayahSyncBackgroundService : BackgroundService
{
    // Wake at least this often so schedule changes / clock drift are picked up even without a signal.
    private static readonly TimeSpan MaxIdleWait = TimeSpan.FromHours(6);
    // Guard against re-firing the scheduled run multiple times within the same due window.
    private static readonly TimeSpan ScheduledDedupeWindow = TimeSpan.FromHours(23);

    private static readonly Action<ILogger, Exception?> LogRunError =
        LoggerMessage.Define(LogLevel.Error, new EventId(1, "WilayahRunError"), "Wilayah sync run raised an error.");
    private static readonly Action<ILogger, string, Exception?> LogTriggered =
        LoggerMessage.Define<string>(LogLevel.Information, new EventId(2, "WilayahTriggered"), "Wilayah sync triggered ({Trigger}).");

    private readonly IServiceProvider _services;
    private readonly WilayahSyncSignal _signal;
    private readonly WilayahSyncOptions _options;
    private readonly ILogger<WilayahSyncBackgroundService> _logger;

    public WilayahSyncBackgroundService(
        IServiceProvider services,
        WilayahSyncSignal signal,
        IOptions<WilayahSyncOptions> options,
        ILogger<WilayahSyncBackgroundService> logger)
    {
        _services = services;
        _signal = signal;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _signal.SetEnabled(_options.Enabled);
        await HydrateStateAsync(stoppingToken);

        if (!_options.Enabled)
        {
            return;
        }

        var lastScheduledRun = DateTimeOffset.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTimeOffset.UtcNow;
            var next = NextScheduledRun(now);
            var due = next - now;
            var wait = due < TimeSpan.Zero ? TimeSpan.Zero : (due < MaxIdleWait ? due : MaxIdleWait);

            bool triggered;
            try
            {
                triggered = await _signal.WaitForTriggerAsync(wait, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            if (stoppingToken.IsCancellationRequested)
            {
                return;
            }

            now = DateTimeOffset.UtcNow;
            var scheduledDue = now >= next && (now - lastScheduledRun) > ScheduledDedupeWindow;

            if (!triggered && !scheduledDue)
            {
                continue;
            }

            if (scheduledDue)
            {
                lastScheduledRun = now;
            }

            var trigger = triggered ? "manual" : "scheduled";
            LogTriggered(_logger, trigger, null);
            await RunOnceAsync(trigger, stoppingToken);
        }
    }

    private async Task RunOnceAsync(string trigger, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _services.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IWilayahSyncService>();
            await service.RunAsync(trigger, cancellationToken);
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            LogRunError(_logger, ex);
        }
    }

    /// <summary>Next occurrence of day-of-month at the configured UTC hour, strictly after <paramref name="from"/>.</summary>
    private DateTimeOffset NextScheduledRun(DateTimeOffset from)
    {
        var day = _options.NormalizedDayOfMonth;
        var hour = _options.NormalizedHourUtc;

        var candidate = new DateTimeOffset(from.Year, from.Month, day, hour, 0, 0, TimeSpan.Zero);
        if (candidate <= from)
        {
            var nextMonth = new DateTimeOffset(from.Year, from.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(1);
            candidate = new DateTimeOffset(nextMonth.Year, nextMonth.Month, day, hour, 0, 0, TimeSpan.Zero);
        }

        return candidate;
    }

    // Rebuilds the in-memory status from the last persisted run so the UI shows a real "last sync" after a restart.
    private async Task HydrateStateAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _services.CreateScope();
            var configuration = scope.ServiceProvider.GetRequiredService<IAdminConsoleConfigurationService>();
            var settings = await configuration.GetSettingsAsync(cancellationToken);
            if (settings.Values is null
                || !settings.Values.TryGetValue(WilayahSyncService.StateSettingsKey, out var state)
                || state.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            DateTimeOffset? Time(string name) =>
                state.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
                && DateTimeOffset.TryParse(el.GetString(), out var parsed)
                    ? parsed
                    : null;
            int Count(string name) =>
                state.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetInt32() : 0;
            string? Text(string name) =>
                state.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() : null;

            var lastSuccessAt = Time("lastSuccessAt");
            var phase = lastSuccessAt is not null ? WilayahSyncPhase.Succeeded : WilayahSyncPhase.Idle;

            _signal.Hydrate(new WilayahSyncSnapshot(
                phase,
                _options.Enabled,
                Text("trigger"),
                null,
                Time("finishedAt"),
                lastSuccessAt,
                Count("provinces"),
                Count("regencies"),
                Count("districts"),
                Count("villages"),
                null,
                Text("error"),
                SourceUpdatedAt: WilayahDatasetStamp.Parse(Text("sourceUpdatedAt"))));
        }
        catch (Exception)
        {
            // Non-fatal: start from a clean Idle snapshot if persisted state can't be read.
        }
    }
}
