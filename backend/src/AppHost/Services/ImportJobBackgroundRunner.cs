using IntegratedProcurement.Modules.ContractMonitoring.Application;
using IntegratedProcurement.Platform.Administration.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IntegratedProcurement.AppHost.Api.Services;

/// <summary>
/// Server-side runner for contract document-migration jobs. Continuously claims the next runnable job,
/// migrates a small batch of its rows in parallel (each in its own DI scope so the shared DbContext is
/// never touched concurrently), then refreshes the job's progress. Because it runs in the host, a batch
/// keeps progressing after the user leaves the Import Center, and resumes after a restart (in-flight rows
/// are reconciled on startup).
/// </summary>
public sealed class ImportJobBackgroundRunner : BackgroundService
{
    private const int BatchSize = 4;
    private const int Concurrency = 3;

    private static readonly Action<ILogger, int, Exception?> LogReconciled =
        LoggerMessage.Define<int>(LogLevel.Information, new EventId(1, "ImportReconcile"),
            "Import runner reset {Count} in-flight row(s) left by a previous run.");
    private static readonly Action<ILogger, Exception?> LogCycleError =
        LoggerMessage.Define(LogLevel.Error, new EventId(2, "ImportCycleError"), "Import runner cycle failed; backing off.");

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ImportJobSignal _signal;
    private readonly IBackgroundProcessRuntime _runtime;
    private readonly ILogger<ImportJobBackgroundRunner> _logger;

    public ImportJobBackgroundRunner(
        IServiceScopeFactory scopeFactory,
        ImportJobSignal signal,
        IBackgroundProcessRuntime runtime,
        ILogger<ImportJobBackgroundRunner> logger)
    {
        _scopeFactory = scopeFactory;
        _signal = signal;
        _runtime = runtime;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ReconcileAsync(stoppingToken);
        _signal.Notify(); // process any jobs left over from a previous run

        // Event-driven: park here (no DB polling) until a job is created/retried/resumed, then drain all
        // runnable work and park again. Idle = zero database traffic.
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _signal.WaitAsync(stoppingToken);
                await DrainAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _runtime.MarkFailed(BackgroundProcessKeys.ContractImportQueue, DateTimeOffset.UtcNow, ex.Message, nextRunAt: null);
                LogCycleError(_logger, ex);
            }
        }
    }

    /// <summary>Process runnable jobs batch-by-batch until none remain, then return so the runner can park.</summary>
    private async Task DrainAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            if (!await RunCycleAsync(cancellationToken))
            {
                return; // no runnable work left
            }
        }
    }

    private async Task ReconcileAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<ImportJobProcessor>();
            var reset = await processor.ReconcileInFlightAsync(cancellationToken);
            if (reset > 0)
            {
                LogReconciled(_logger, reset, null);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCycleError(_logger, ex);
        }
    }

    private async Task<bool> RunCycleAsync(CancellationToken cancellationToken)
    {
        Guid jobId;
        IReadOnlyList<Guid> rowIds;

        using (var scope = _scopeFactory.CreateScope())
        {
            var processor = scope.ServiceProvider.GetRequiredService<ImportJobProcessor>();
            if (!processor.CanRun)
            {
                return false; // SharePoint/Blob not configured — nothing to do
            }

            var claimed = await processor.ClaimNextJobAsync(cancellationToken);
            if (claimed is null)
            {
                return false;
            }

            jobId = claimed.Value;
            rowIds = await processor.NextRowBatchAsync(jobId, BatchSize, cancellationToken);
        }

        if (rowIds.Count == 0)
        {
            // No queued rows left for this job — settle final counts / mark complete, then keep draining
            // (there may be other runnable jobs; the finalized one becomes terminal and won't reappear).
            using var scope = _scopeFactory.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ImportJobProcessor>().FinalizeAsync(jobId, cancellationToken);
            return true;
        }

        await Parallel.ForEachAsync(
            rowIds,
            new ParallelOptions { MaxDegreeOfParallelism = Concurrency, CancellationToken = cancellationToken },
            async (rowId, token) =>
            {
                using var scope = _scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ImportJobProcessor>().ProcessRowAsync(rowId, token);
            });

        using (var scope = _scopeFactory.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<ImportJobProcessor>().FinalizeAsync(jobId, cancellationToken);
        }

        return true;
    }
}
