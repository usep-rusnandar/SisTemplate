using IntegratedProcurement.Modules.ContractMonitoring.Domain;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

/// <summary>One parsed Excel row handed to the importer (the document side of a contract row).</summary>
public sealed record NewImportRow(int RowIndex, string ContractId, string Title, string Supplier, string? Link);

/// <summary>A job plus its rows, for the detail/polling read.</summary>
public sealed record ImportJobDetail(ImportJob Job, IReadOnlyList<ImportJobRow> Rows);

/// <summary>
/// Request-scoped use-cases for background document-migration jobs: create a batch, list history,
/// read a job's live detail, and retry / pause / resume. The actual migration work is done by the
/// background runner (<see cref="ImportJobProcessor"/>); this service only manages job state.
/// </summary>
public sealed class ImportJobService
{
    private const int HistoryLimit = 50;

    private readonly IImportJobRepository _repository;

    public ImportJobService(IImportJobRepository repository)
    {
        _repository = repository;
    }

    public async Task<ImportJob> CreateAsync(
        string fileName,
        string? startedByPersonnelNo,
        string? startedByName,
        IReadOnlyList<NewImportRow> rows,
        CancellationToken cancellationToken)
    {
        var jobId = Guid.NewGuid();
        var batchCode = jobId.ToString("N")[..6];
        var job = new ImportJob(jobId, batchCode, fileName, startedByPersonnelNo, startedByName, rows.Count);
        _repository.AddJob(job);

        foreach (var row in rows)
        {
            _repository.AddRow(new ImportJobRow(
                Guid.NewGuid(),
                jobId,
                row.RowIndex,
                row.ContractId,
                row.Title,
                row.Supplier,
                row.Link));
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return job;
    }

    public Task<IReadOnlyList<ImportJob>> ListAsync(CancellationToken cancellationToken) =>
        _repository.ListRecentJobsAsync(HistoryLimit, cancellationToken);

    public async Task<ImportJobDetail?> GetDetailAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var job = await _repository.GetJobAsync(jobId, cancellationToken);
        if (job is null)
        {
            return null;
        }

        var rows = await _repository.GetRowsAsync(jobId, cancellationToken);
        return new ImportJobDetail(job, rows);
    }

    /// <summary>Requeue a job's failed rows and set it Running so the background runner re-processes them.</summary>
    public async Task<ImportJob?> RetryFailedAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var job = await _repository.GetJobAsync(jobId, cancellationToken);
        if (job is null)
        {
            return null;
        }

        var reset = await _repository.ResetFailedRowsAsync(jobId, cancellationToken);
        if (reset > 0)
        {
            job.Resume();
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return job;
    }

    /// <summary>Requeue a single failed row and set its job Running so the runner re-processes just that row.</summary>
    public async Task<ImportJob?> RetryRowAsync(Guid jobId, Guid rowId, CancellationToken cancellationToken)
    {
        var job = await _repository.GetJobAsync(jobId, cancellationToken);
        if (job is null)
        {
            return null;
        }

        var row = await _repository.GetRowAsync(rowId, cancellationToken);
        if (row is not null && row.JobId == jobId && row.State == ImportRowState.Failed)
        {
            row.ResetToQueued();
            job.Resume();
            await _repository.SaveChangesAsync(cancellationToken);
        }

        return job;
    }

    public async Task<ImportJob?> SetPausedAsync(Guid jobId, bool paused, CancellationToken cancellationToken)
    {
        var job = await _repository.GetJobAsync(jobId, cancellationToken);
        if (job is null || job.IsTerminal)
        {
            return job;
        }

        if (paused)
        {
            job.Pause();
        }
        else
        {
            job.Resume();
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return job;
    }
}
