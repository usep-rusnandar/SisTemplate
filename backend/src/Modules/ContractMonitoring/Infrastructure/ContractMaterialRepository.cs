using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.ContractMonitoring.Infrastructure;

internal sealed class ContractMaterialRepository : IContractMaterialRepository
{
    private readonly ProcurementDbContext _dbContext;

    public ContractMaterialRepository(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<int> CountAsync(string contractKey, string? search, string? site, CancellationToken cancellationToken)
    {
        return BuildQuery(contractKey, search, site).CountAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ContractMaterial>> ListPageAsync(
        string contractKey,
        string? search,
        string? site,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var skip = Math.Max(0, (page - 1) * pageSize);
        return await BuildQuery(contractKey, search, site)
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.MaterialNumber)
            .Skip(skip)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    public Task<MaterialSyncFile?> GetSyncFileByContractKeyAsync(string contractKey, CancellationToken cancellationToken) =>
        _dbContext.MaterialSyncFiles.SingleOrDefaultAsync(item => item.ContractKey == contractKey, cancellationToken);

    public Task<MaterialSyncFile?> GetSyncFileByFileNameAsync(string fileName, CancellationToken cancellationToken) =>
        _dbContext.MaterialSyncFiles.SingleOrDefaultAsync(item => item.FileName == fileName, cancellationToken);

    public async Task ReplaceMaterialsAsync(
        string contractKey,
        IReadOnlyList<ContractMaterial> materials,
        MaterialSyncFile syncFile,
        CancellationToken cancellationToken)
    {
        var existing = await _dbContext.ContractMaterials
            .Where(item => item.ContractKey == contractKey)
            .ToListAsync(cancellationToken);
        _dbContext.ContractMaterials.RemoveRange(existing);

        _dbContext.ContractMaterials.AddRange(materials);

        var tracked = await _dbContext.MaterialSyncFiles
            .SingleOrDefaultAsync(item => item.ContractKey == contractKey, cancellationToken);
        if (tracked is null)
        {
            _dbContext.MaterialSyncFiles.Add(syncFile);
        }
        else
        {
            tracked.RecordImport(
                syncFile.FileName,
                syncFile.SourceType,
                syncFile.SourceLastModified,
                syncFile.RowCount,
                syncFile.ImportedAt);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        _dbContext.SaveChangesAsync(cancellationToken);

    private IQueryable<ContractMaterial> BuildQuery(string contractKey, string? search, string? site)
    {
        var query = _dbContext.ContractMaterials.Where(item => item.ContractKey == contractKey);
        if (!string.IsNullOrWhiteSpace(site))
        {
            query = query.Where(item => item.Site == site);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(item =>
                item.MaterialNumber.Contains(term)
                || item.Description.Contains(term));
        }

        return query;
    }
}
