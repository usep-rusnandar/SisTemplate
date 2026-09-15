namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

public interface IContractMaterialRepository
{
    Task<int> CountAsync(string contractKey, string? search, string? site, CancellationToken cancellationToken);

    Task<IReadOnlyList<ContractMaterial>> ListPageAsync(
        string contractKey,
        string? search,
        string? site,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    Task<MaterialSyncFile?> GetSyncFileByContractKeyAsync(string contractKey, CancellationToken cancellationToken);

    Task<MaterialSyncFile?> GetSyncFileByFileNameAsync(string fileName, CancellationToken cancellationToken);

    Task ReplaceMaterialsAsync(
        string contractKey,
        IReadOnlyList<ContractMaterial> materials,
        MaterialSyncFile syncFile,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
