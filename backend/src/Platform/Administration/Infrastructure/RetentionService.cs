using System.Text.Json;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

/// <summary>
/// Enforces the data-retention settings configured in Super Admin → Settings. Records older than the
/// configured window are permanently deleted. Disabled toggles or non-positive day counts are skipped.
/// </summary>
internal sealed class RetentionService : IRetentionService
{
    internal const string StateSettingsKey = "retentionRuntimeState";

    private static readonly JsonSerializerOptions StateOptions = new(JsonSerializerDefaults.Web);

    private readonly ProcurementDbContext _dbContext;
    private readonly IAdminConsoleConfigurationService _configurationService;
    private readonly IBackgroundProcessRuntime _runtime;

    public RetentionService(
        ProcurementDbContext dbContext,
        IAdminConsoleConfigurationService configurationService,
        IBackgroundProcessRuntime runtime)
    {
        _dbContext = dbContext;
        _configurationService = configurationService;
        _runtime = runtime;
    }

    public async Task<RetentionResult> RunAsync(CancellationToken cancellationToken)
    {
        _runtime.MarkRunning(BackgroundProcessKeys.Retention, DateTimeOffset.UtcNow);
        try
        {
            var result = await RunCoreAsync(cancellationToken);
            var summary =
                $"audit={result.AuditDeleted}, notifications={result.NotificationsDeleted}, emailLogs={result.EmailLogsDeleted}";
            var finished = DateTimeOffset.UtcNow;
            _runtime.MarkSucceeded(BackgroundProcessKeys.Retention, finished, summary, nextRunAt: null);
            await PersistStateAsync(finished, summary, error: null, cancellationToken);
            return result;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            var finished = DateTimeOffset.UtcNow;
            _runtime.MarkFailed(BackgroundProcessKeys.Retention, finished, ex.Message, nextRunAt: null);
            await PersistStateSafeAsync(finished, result: null, ex.Message, cancellationToken);
            throw;
        }
    }

    private async Task<RetentionResult> RunCoreAsync(CancellationToken cancellationToken)
    {
        var settings = await _configurationService.GetSettingsAsync(cancellationToken);
        var values = settings.Values;
        var now = DateTimeOffset.UtcNow;

        var auditDeleted = 0;
        var notificationsDeleted = 0;
        var notificationStatesDeleted = 0;
        var emailLogsDeleted = 0;

        if (Enabled(values, "auditDelete") && Days(values, "auditDays") is { } auditDays)
        {
            var cutoff = now.AddDays(-auditDays);
            auditDeleted = await _dbContext.AuditLogs
                .Where(log => log.OccurredAt < cutoff)
                .ExecuteDeleteAsync(cancellationToken);
        }

        if (Enabled(values, "notifDelete") && Days(values, "notifDays") is { } notifDays)
        {
            var cutoff = now.AddDays(-notifDays);
            // Remove per-recipient state for the notifications about to be deleted, then the notifications.
            notificationStatesDeleted = await _dbContext.NotificationRecipientStates
                .Where(state => _dbContext.Notifications.Any(n => n.Id == state.NotificationId && n.CreatedAt < cutoff))
                .ExecuteDeleteAsync(cancellationToken);
            notificationsDeleted = await _dbContext.Notifications
                .Where(notification => notification.CreatedAt < cutoff)
                .ExecuteDeleteAsync(cancellationToken);
        }

        if (Enabled(values, "emailLogDelete") && Days(values, "emailLogDays") is { } emailDays)
        {
            var cutoff = now.AddDays(-emailDays);
            emailLogsDeleted = await _dbContext.EmailSentEntries
                .Where(entry => entry.SentAt < cutoff)
                .ExecuteDeleteAsync(cancellationToken);
        }

        return new RetentionResult(auditDeleted, notificationsDeleted, notificationStatesDeleted, emailLogsDeleted);
    }

    private async Task PersistStateAsync(
        DateTimeOffset finishedAt,
        string? result,
        string? error,
        CancellationToken cancellationToken)
    {
        var state = new RetentionBackgroundProcessSource.PersistedRetentionState(finishedAt, result, error);
        var element = JsonSerializer.SerializeToElement(state, StateOptions);
        await _configurationService.SaveSettingsAsync(
            new Dictionary<string, JsonElement> { [StateSettingsKey] = element },
            cancellationToken);
    }

    private async Task PersistStateSafeAsync(
        DateTimeOffset finishedAt,
        string? result,
        string? error,
        CancellationToken cancellationToken)
    {
        try
        {
            await PersistStateAsync(finishedAt, result, error, cancellationToken);
        }
        catch (Exception)
        {
            // Best-effort: a failure to persist must not mask the original error.
        }
    }

    private static bool Enabled(IReadOnlyDictionary<string, JsonElement>? values, string key)
    {
        if (values is null || !values.TryGetValue(key, out var element))
        {
            return false;
        }

        return element.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => bool.TryParse(element.GetString(), out var parsed) && parsed,
            _ => false,
        };
    }

    private static int? Days(IReadOnlyDictionary<string, JsonElement>? values, string key)
    {
        if (values is null || !values.TryGetValue(key, out var element))
        {
            return null;
        }

        var days = element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(element.GetString(), out var parsed) => parsed,
            _ => 0,
        };

        return days > 0 ? days : null;
    }
}

/// <summary>Runs the retention policy once shortly after startup, then daily.</summary>
internal sealed class RetentionBackgroundService : BackgroundService
{
    private static readonly TimeSpan StartupDelay = RetentionBackgroundProcessSource.StartupDelay;
    private static readonly TimeSpan Interval = RetentionBackgroundProcessSource.Interval;

    private static readonly Action<ILogger, int, int, int, int, Exception?> LogCleanup =
        LoggerMessage.Define<int, int, int, int>(
            LogLevel.Information,
            new EventId(1, "RetentionCleanup"),
            "Retention cleanup: audit={Audit}, notifications={Notifications}, notificationStates={States}, emailLogs={Email}");
    private static readonly Action<ILogger, Exception?> LogCleanupFailed =
        LoggerMessage.Define(
            LogLevel.Warning,
            new EventId(2, "RetentionCleanupFailed"),
            "Retention cleanup run failed; will retry on the next interval.");

    private readonly IServiceProvider _services;
    private readonly IBackgroundProcessRuntime _runtime;
    private readonly ILogger<RetentionBackgroundService> _logger;

    public RetentionBackgroundService(
        IServiceProvider services,
        IBackgroundProcessRuntime runtime,
        ILogger<RetentionBackgroundService> logger)
    {
        _services = services;
        _runtime = runtime;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _runtime.SetNextRun(BackgroundProcessKeys.Retention, DateTimeOffset.UtcNow + StartupDelay);
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _services.CreateScope();
                var retention = scope.ServiceProvider.GetRequiredService<IRetentionService>();
                var result = await retention.RunAsync(stoppingToken);
                LogCleanup(_logger, result.AuditDeleted, result.NotificationsDeleted, result.NotificationStatesDeleted, result.EmailLogsDeleted, null);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                LogCleanupFailed(_logger, ex);
            }

            var next = DateTimeOffset.UtcNow + Interval;
            _runtime.SetNextRun(BackgroundProcessKeys.Retention, next);
            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }
}
