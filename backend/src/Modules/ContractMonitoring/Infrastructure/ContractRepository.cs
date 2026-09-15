using IntegratedProcurement.Modules.ContractMonitoring.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.ContractMonitoring.Infrastructure;

/// <summary>
/// EF Core implementation of the Contract Monitoring data-access contract. Uses the shared
/// <see cref="ProcurementDbContext"/> but only touches Contract Monitoring entities, so the module
/// owns its data access while persistence remains a single physical context.
/// </summary>
internal sealed class ContractRepository : IContractRepository
{
    private readonly ProcurementDbContext _dbContext;

    public ContractRepository(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<Contract>> ListAsync(string? status, CancellationToken cancellationToken)
    {
        var query = _dbContext.Contracts.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(item => item.Status == status);
        }

        return await query
            .OrderBy(item => item.CurrentExpiryDate)
            .ThenBy(item => item.ContractKey)
            .ToListAsync(cancellationToken);
    }

    public async Task<Contract?> GetByKeyAsync(string contractKey, CancellationToken cancellationToken) =>
        await _dbContext.Contracts.SingleOrDefaultAsync(item => item.ContractKey == contractKey, cancellationToken);

    public async Task<IReadOnlyList<ContractVersion>> GetVersionsAsync(string contractKey, CancellationToken cancellationToken) =>
        await _dbContext.ContractVersions
            .AsNoTracking()
            .Where(item => item.ContractKey == contractKey)
            .OrderBy(item => item.ExpiredDate)
            .ThenBy(item => item.RowIndex)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ContractReminder>> GetRemindersAsync(string? contractKey, CancellationToken cancellationToken)
    {
        var query = _dbContext.ContractReminders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(contractKey))
        {
            query = query.Where(item => item.ContractKey == contractKey);
        }

        return await query
            .OrderByDescending(item => item.SentAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Contract>> GetDueForScanAsync(CancellationToken cancellationToken) =>
        await _dbContext.Contracts
            .Where(item => item.Status == "Expiring" || (item.DaysToExpiry >= 0 && item.DaysToExpiry <= 180))
            .OrderBy(item => item.DaysToExpiry)
            .ToListAsync(cancellationToken);

    public async Task<bool> ReminderExistsAsync(string contractKey, string tier, CancellationToken cancellationToken) =>
        await _dbContext.ContractReminders.AnyAsync(
            item => item.ContractKey == contractKey && item.Tier == tier,
            cancellationToken);

    public void AddReminder(ContractReminder reminder) => _dbContext.ContractReminders.Add(reminder);

    public async Task<ContractImportStats> GetImportStatsAsync(CancellationToken cancellationToken)
    {
        var distinctContracts = await _dbContext.Contracts.CountAsync(cancellationToken);
        var versionRows = await _dbContext.ContractVersions.CountAsync(cancellationToken);
        var versionsWithLinks = await _dbContext.ContractVersions
            .CountAsync(item => item.DocumentLink != null && item.DocumentLink != string.Empty, cancellationToken);
        return new ContractImportStats(distinctContracts, versionRows, versionsWithLinks);
    }

    public async Task<IReadOnlyList<string>> GetDocumentLinksAsync(CancellationToken cancellationToken) =>
        await _dbContext.ContractVersions
            .AsNoTracking()
            .Where(item => item.DocumentLink != null && item.DocumentLink != string.Empty)
            .Select(item => item.DocumentLink!)
            .Distinct()
            .ToListAsync(cancellationToken);

    public async Task<SharePointDocument?> GetSharePointDocumentByHashAsync(string linkHash, CancellationToken cancellationToken) =>
        await _dbContext.SharePointDocuments
            .SingleOrDefaultAsync(item => item.LinkHash == linkHash, cancellationToken);

    public async Task<SharePointDocument?> FindSharePointDocumentAsync(string sharingLink, CancellationToken cancellationToken)
    {
        var hashes = SharePointDocumentLookup.LinkHashCandidates(sharingLink);
        if (hashes.Count > 0)
        {
            var byHash = await _dbContext.SharePointDocuments
                .AsNoTracking()
                .Where(item => hashes.Contains(item.LinkHash))
                .ToListAsync(cancellationToken);
            foreach (var hash in hashes)
            {
                var match = byHash.FirstOrDefault(item =>
                    string.Equals(item.LinkHash, hash, StringComparison.OrdinalIgnoreCase));
                if (match is not null)
                {
                    return match;
                }
            }
        }

        var trimmed = (sharingLink ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return null;
        }

        var exact = await _dbContext.SharePointDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.SharingLink == trimmed, cancellationToken);
        if (exact is not null)
        {
            return exact;
        }

        if (trimmed.Length > SharePointDocument.SharingLinkMaxLength)
        {
            var prefix = trimmed[..SharePointDocument.SharingLinkMaxLength];
            return await _dbContext.SharePointDocuments
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.SharingLink == prefix, cancellationToken);
        }

        return null;
    }

    public async Task<IReadOnlyDictionary<string, SharePointDocument>> GetSharePointDocumentsByHashesAsync(
        IReadOnlyCollection<string> linkHashes,
        CancellationToken cancellationToken)
    {
        if (linkHashes.Count == 0)
        {
            return new Dictionary<string, SharePointDocument>();
        }

        var matches = await _dbContext.SharePointDocuments
            .AsNoTracking()
            .Where(item => linkHashes.Contains(item.LinkHash))
            .ToListAsync(cancellationToken);

        return matches.ToDictionary(item => item.LinkHash, StringComparer.Ordinal);
    }

    public void AddSharePointDocument(SharePointDocument document) => _dbContext.SharePointDocuments.Add(document);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
