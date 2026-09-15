using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.ContractMonitoring.Infrastructure;

/// <summary>EF Core implementation of the background import-job data-access contract.</summary>
internal sealed class ImportJobRepository : IImportJobRepository
{
    private readonly ProcurementDbContext _dbContext;

    public ImportJobRepository(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public void AddJob(ImportJob job) => _dbContext.ImportJobs.Add(job);

    public void AddRow(ImportJobRow row) => _dbContext.ImportJobRows.Add(row);

    public async Task<ImportJob?> GetJobAsync(Guid jobId, CancellationToken cancellationToken) =>
        await _dbContext.ImportJobs.SingleOrDefaultAsync(item => item.Id == jobId, cancellationToken);

    public async Task<IReadOnlyList<ImportJob>> ListRecentJobsAsync(int take, CancellationToken cancellationToken) =>
        await _dbContext.ImportJobs
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ImportJobRow>> GetRowsAsync(Guid jobId, CancellationToken cancellationToken) =>
        await _dbContext.ImportJobRows
            .AsNoTracking()
            .Where(item => item.JobId == jobId)
            .OrderBy(item => item.RowIndex)
            .ToListAsync(cancellationToken);

    public async Task<ImportJob?> ClaimNextRunnableJobAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var running = await _dbContext.ImportJobs
            .Where(item => item.Status == ImportJobStatus.Running)
            .OrderBy(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (running is not null)
        {
            return running;
        }

        var queued = await _dbContext.ImportJobs
            .Where(item => item.Status == ImportJobStatus.Queued)
            .OrderBy(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (queued is not null)
        {
            queued.MarkRunning(now);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return queued;
    }

    public async Task<IReadOnlyList<Guid>> GetQueuedRowIdsAsync(Guid jobId, int limit, CancellationToken cancellationToken) =>
        await _dbContext.ImportJobRows
            .Where(item => item.JobId == jobId && item.State == ImportRowState.Queued)
            .OrderBy(item => item.RowIndex)
            .Take(limit)
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);

    public async Task<ImportJobRow?> GetRowAsync(Guid rowId, CancellationToken cancellationToken) =>
        await _dbContext.ImportJobRows.SingleOrDefaultAsync(item => item.Id == rowId, cancellationToken);

    public async Task<ImportJobRow?> FindLatestStoredRowAsync(
        string? sharingLink,
        string? contractId,
        CancellationToken cancellationToken)
    {
        var stored = _dbContext.ImportJobRows
            .AsNoTracking()
            .Where(item => item.State == ImportRowState.Stored
                && item.BlobContainer != null
                && item.BlobKey != null);

        if (!string.IsNullOrWhiteSpace(sharingLink))
        {
            var trimmed = sharingLink.Trim();
            var prefix = trimmed.Length > SharePointDocument.SharingLinkMaxLength
                ? trimmed[..SharePointDocument.SharingLinkMaxLength]
                : trimmed;
            var byLink = await stored
                .Where(item => item.SharingLink == trimmed || item.SharingLink == prefix)
                .OrderByDescending(item => item.UpdatedAt ?? item.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
            if (byLink is not null)
            {
                return byLink;
            }
        }

        if (string.IsNullOrWhiteSpace(contractId))
        {
            return null;
        }

        return await stored
            .Where(item => item.ContractId == contractId)
            .OrderByDescending(item => item.UpdatedAt ?? item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<bool> HasPendingRowsAsync(Guid jobId, CancellationToken cancellationToken) =>
        await _dbContext.ImportJobRows.AnyAsync(
            item => item.JobId == jobId
                && (item.State == ImportRowState.Queued || item.State == ImportRowState.Fetching || item.State == ImportRowState.Storing),
            cancellationToken);

    public async Task RecomputeCountsAsync(ImportJob job, CancellationToken cancellationToken)
    {
        var tallies = await _dbContext.ImportJobRows
            .Where(item => item.JobId == job.Id)
            .GroupBy(item => item.State)
            .Select(group => new { State = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.State, item => item.Count, cancellationToken);

        int Get(string state) => tallies.TryGetValue(state, out var count) ? count : 0;
        job.ApplyCounts(Get(ImportRowState.Stored), Get(ImportRowState.Failed), Get(ImportRowState.Skipped));
    }

    public async Task<int> ResetInFlightRowsAsync(CancellationToken cancellationToken)
    {
        var rows = await _dbContext.ImportJobRows
            .Where(item => item.State == ImportRowState.Fetching || item.State == ImportRowState.Storing)
            .ToListAsync(cancellationToken);
        foreach (var row in rows)
        {
            row.ResetToQueued();
        }

        if (rows.Count > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return rows.Count;
    }

    public async Task<int> ResetFailedRowsAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var rows = await _dbContext.ImportJobRows
            .Where(item => item.JobId == jobId && item.State == ImportRowState.Failed)
            .ToListAsync(cancellationToken);
        foreach (var row in rows)
        {
            row.ResetToQueued();
        }

        return rows.Count;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);

    public async Task<ImportJobQueueSnapshot> GetQueueSnapshotAsync(CancellationToken cancellationToken)
    {
        var queued = await _dbContext.ImportJobs.CountAsync(
            item => item.Status == ImportJobStatus.Queued, cancellationToken);
        var running = await _dbContext.ImportJobs.CountAsync(
            item => item.Status == ImportJobStatus.Running, cancellationToken);
        var last = await _dbContext.ImportJobs.AsNoTracking()
            .Where(item => item.Status == ImportJobStatus.Completed
                || item.Status == ImportJobStatus.CompletedWithErrors)
            .OrderByDescending(item => item.CompletedAt ?? item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return new ImportJobQueueSnapshot(
            queued,
            running,
            last?.CompletedAt,
            last?.Status,
            last?.FileName,
            last?.StoredCount ?? 0,
            last?.FailedCount ?? 0,
            last?.SkippedCount ?? 0);
    }
}
