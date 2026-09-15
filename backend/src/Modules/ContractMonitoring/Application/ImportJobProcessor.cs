using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

/// <summary>
/// Does the actual document migration for one import-job row: fetch from SharePoint, upload to Azure
/// Blob, record the link→blob mapping, and advance the row's state. Designed to run inside a fresh DI
/// scope per row so the background runner can process several rows in parallel. Job-level coordination
/// (claiming the next job, planning batches, finalizing) is here too but is always called single-threaded.
/// </summary>
public sealed class ImportJobProcessor
{
    private const string ModuleKey = "contractMonitoring";

    private readonly IImportJobRepository _jobs;
    private readonly IContractRepository _contracts;
    private readonly ISharePointDocumentFetcher _fetcher;
    private readonly IDocumentStorage _storage;

    public ImportJobProcessor(
        IImportJobRepository jobs,
        IContractRepository contracts,
        ISharePointDocumentFetcher fetcher,
        IDocumentStorage storage)
    {
        _jobs = jobs;
        _contracts = contracts;
        _fetcher = fetcher;
        _storage = storage;
    }

    /// <summary>True only when both ends of the pipeline are configured; otherwise jobs can't run.</summary>
    public bool CanRun => _fetcher.IsConfigured && _storage.IsConfigured;

    /// <summary>Recover rows left mid-flight by a previous process so they re-run. Call once at startup.</summary>
    public Task<int> ReconcileInFlightAsync(CancellationToken cancellationToken) =>
        _jobs.ResetInFlightRowsAsync(cancellationToken);

    /// <summary>The job currently being worked (oldest Running, or oldest Queued promoted to Running).</summary>
    public async Task<Guid?> ClaimNextJobAsync(CancellationToken cancellationToken)
    {
        var job = await _jobs.ClaimNextRunnableJobAsync(DateTimeOffset.UtcNow, cancellationToken);
        return job?.Id;
    }

    public Task<IReadOnlyList<Guid>> NextRowBatchAsync(Guid jobId, int limit, CancellationToken cancellationToken) =>
        _jobs.GetQueuedRowIdsAsync(jobId, limit, cancellationToken);

    /// <summary>Refresh the job's counts; complete it when no rows remain pending. Returns true when done.</summary>
    public async Task<bool> FinalizeAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var job = await _jobs.GetJobAsync(jobId, cancellationToken);
        if (job is null)
        {
            return true;
        }

        await _jobs.RecomputeCountsAsync(job, cancellationToken);
        var pending = await _jobs.HasPendingRowsAsync(jobId, cancellationToken);
        if (!pending && job.Status == ImportJobStatus.Running)
        {
            job.Complete(DateTimeOffset.UtcNow);
        }

        await _jobs.SaveChangesAsync(cancellationToken);
        return !pending;
    }

    /// <summary>Migrate a single row end-to-end. Persists each state transition so the UI sees live progress.</summary>
    public async Task ProcessRowAsync(Guid rowId, CancellationToken cancellationToken)
    {
        var row = await _jobs.GetRowAsync(rowId, cancellationToken);
        if (row is null || row.State != ImportRowState.Queued || string.IsNullOrWhiteSpace(row.SharingLink))
        {
            return; // already handled, or nothing to migrate
        }

        row.MarkFetching();
        await _jobs.SaveChangesAsync(cancellationToken);

        try
        {
            var persistedLink = SharePointDocument.TruncateSharingLink(row.SharingLink);
            var linkHash = SharePointDocument.HashLink(persistedLink);

            // Idempotent: reuse a blob mapped under the full URL hash or the nvarchar(1000) prefix hash.
            var existing = await _contracts.FindSharePointDocumentAsync(row.SharingLink!, cancellationToken);
            if (existing is not null)
            {
                row.MarkStored(existing.Container, existing.BlobKey, existing.SizeBytes);
                await _jobs.SaveChangesAsync(cancellationToken);
                return;
            }

            var file = await _fetcher.DownloadAsync(row.SharingLink, cancellationToken);
            await using (file.Content)
            {
                var size = file.Content.CanSeek ? file.Content.Length : 0;
                row.MarkStoring(size);
                await _jobs.SaveChangesAsync(cancellationToken);

                var container = _storage.ContainerForModule(ModuleKey);
                var blobKey = $"sharepoint/{linkHash}{Path.GetExtension(file.FileName)}";
                var upload = await _storage.UploadAsync(container, blobKey, file.Content, file.ContentType, cancellationToken);

                _contracts.AddSharePointDocument(new SharePointDocument(
                    Guid.NewGuid(), linkHash, persistedLink, upload.Container, upload.BlobKey,
                    file.FileName, upload.ContentType, upload.Size, DateTimeOffset.UtcNow));
                row.MarkStored(upload.Container, upload.BlobKey, upload.Size);
                await _jobs.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            var reason = ex.Message.Length > 900 ? ex.Message[..900] : ex.Message;
            row.MarkFailed(reason);
            await _jobs.SaveChangesAsync(cancellationToken);
        }
    }
}
