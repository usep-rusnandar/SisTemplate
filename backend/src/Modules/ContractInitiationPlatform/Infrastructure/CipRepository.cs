using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Infrastructure;

/// <summary>
/// EF Core implementation of the CIP data-access contract over the shared
/// <see cref="ProcurementDbContext"/>; touches only CIP entities.
/// </summary>
internal sealed class CipRepository : ICipRepository
{
    private readonly ProcurementDbContext _dbContext;

    public CipRepository(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<CipCase>> ListCasesAsync(CancellationToken cancellationToken) =>
        await _dbContext.CipCases
            .AsNoTracking()
            .OrderBy(item => item.CaseKey)
            .ToListAsync(cancellationToken);

    public async Task<CipCase?> GetCaseAsync(string caseKey, bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking ? _dbContext.CipCases : _dbContext.CipCases.AsNoTracking();
        return await query.SingleOrDefaultAsync(item => item.CaseKey == caseKey, cancellationToken);
    }

    public async Task<CipCase?> GetCaseByLoaKeyAsync(string loaKey, CancellationToken cancellationToken) =>
        await _dbContext.CipCases
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.LoaKey == loaKey, cancellationToken);

    public async Task<IReadOnlyList<CipCaseDocument>> ListAllDocumentsAsync(CancellationToken cancellationToken) =>
        await _dbContext.CipCaseDocuments
            .AsNoTracking()
            .OrderByDescending(item => item.GeneratedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<CipCaseDocument>> GetDocumentsAsync(string caseKey, CancellationToken cancellationToken) =>
        await _dbContext.CipCaseDocuments
            .AsNoTracking()
            .Where(item => item.CaseKey == caseKey)
            .OrderBy(item => item.DocumentType)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<CipCaseActivity>> GetActivitiesAsync(string caseKey, CancellationToken cancellationToken) =>
        await _dbContext.CipCaseActivities
            .AsNoTracking()
            .Where(item => item.CaseKey == caseKey)
            .OrderBy(item => item.OccurredAt)
            .ToListAsync(cancellationToken);

    public async Task<bool> DocumentExistsAsync(string caseKey, string documentKey, CancellationToken cancellationToken) =>
        await GetDocumentAsync(caseKey, documentKey, tracking: false, cancellationToken) is not null;

    public async Task<CipCaseDocument?> GetDocumentAsync(string caseKey, string documentKey, bool tracking, CancellationToken cancellationToken)
    {
        var local = _dbContext.CipCaseDocuments.Local.FirstOrDefault(item =>
            item.CaseKey == caseKey && item.DocumentKey == documentKey);
        if (local is not null)
        {
            return local;
        }

        var query = tracking ? _dbContext.CipCaseDocuments : _dbContext.CipCaseDocuments.AsNoTracking();
        return await query.SingleOrDefaultAsync(
            item => item.CaseKey == caseKey && item.DocumentKey == documentKey,
            cancellationToken);
    }

    public async Task<string> NextCaseKeyAsync(CancellationToken cancellationToken)
    {
        var count = await _dbContext.CipCases.CountAsync(cancellationToken);
        for (var next = count + 1; ; next++)
        {
            var candidate = $"CIP-2026-{next:000}";
            if (!await _dbContext.CipCases.AnyAsync(item => item.CaseKey == candidate, cancellationToken))
            {
                return candidate;
            }
        }
    }

    public void AddCase(CipCase cipCase) => _dbContext.CipCases.Add(cipCase);

    public void AddDocument(CipCaseDocument document) => _dbContext.CipCaseDocuments.Add(document);

    public void AddActivity(CipCaseActivity activity) => _dbContext.CipCaseActivities.Add(activity);

    public async Task DeleteCaseGraphsAsync(IReadOnlyCollection<string> caseKeys, CancellationToken cancellationToken)
    {
        if (caseKeys.Count == 0)
        {
            return;
        }

        await _dbContext.CipCaseActivities.Where(item => caseKeys.Contains(item.CaseKey)).ExecuteDeleteAsync(cancellationToken);
        await _dbContext.CipCaseDocuments.Where(item => caseKeys.Contains(item.CaseKey)).ExecuteDeleteAsync(cancellationToken);
        await _dbContext.CipCases.Where(item => caseKeys.Contains(item.CaseKey)).ExecuteDeleteAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
