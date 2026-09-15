using IntegratedProcurement.Modules.ContractMonitoring.Domain;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

/// <summary>
/// Summarizes the current contract register for an import batch report (version rows, distinct
/// contracts, merged duplicates, documents carrying a link), reading through the repository port.
/// </summary>
public sealed class ContractImportService
{
    private readonly IContractRepository _repository;

    public ContractImportService(IContractRepository repository)
    {
        _repository = repository;
    }

    public async Task<ContractImportSummary> SummarizeAsync(CancellationToken cancellationToken)
    {
        var stats = await _repository.GetImportStatsAsync(cancellationToken);
        var duplicateRowsMerged = Math.Max(0, stats.VersionRows - stats.DistinctContracts);
        return new ContractImportSummary(
            stats.VersionRows,
            stats.DistinctContracts,
            duplicateRowsMerged,
            stats.VersionsWithLinks);
    }
}
