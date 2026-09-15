namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>
/// Data-access contract for the Contract Monitoring module. The interface lives in the Domain
/// layer (the module owns its persistence contract); the implementation lives in the module's
/// Infrastructure layer. Callers (Application/endpoints) depend only on this abstraction.
/// </summary>
public interface IContractRepository
{
    /// <summary>All contracts, or only those with the given status when <paramref name="status"/> is set.</summary>
    Task<IReadOnlyList<Contract>> ListAsync(string? status, CancellationToken cancellationToken);

    Task<Contract?> GetByKeyAsync(string contractKey, CancellationToken cancellationToken);

    Task<IReadOnlyList<ContractVersion>> GetVersionsAsync(string contractKey, CancellationToken cancellationToken);

    /// <summary>Reminders for one contract, or all reminders when <paramref name="contractKey"/> is null.</summary>
    Task<IReadOnlyList<ContractReminder>> GetRemindersAsync(string? contractKey, CancellationToken cancellationToken);

    /// <summary>Contracts that are candidates for the daily reminder scan (expiring within the window).</summary>
    Task<IReadOnlyList<Contract>> GetDueForScanAsync(CancellationToken cancellationToken);

    Task<bool> ReminderExistsAsync(string contractKey, string tier, CancellationToken cancellationToken);

    void AddReminder(ContractReminder reminder);

    Task<ContractImportStats> GetImportStatsAsync(CancellationToken cancellationToken);

    /// <summary>Distinct SharePoint document links across all versions (for migration planning).</summary>
    Task<IReadOnlyList<string>> GetDocumentLinksAsync(CancellationToken cancellationToken);

    /// <summary>An already-migrated SharePoint document by its link hash, or null when not yet migrated.</summary>
    Task<SharePointDocument?> GetSharePointDocumentByHashAsync(string linkHash, CancellationToken cancellationToken);

    /// <summary>
    /// Find a migrated SharePoint file by the View/import sharing URL. Tries the full-link hash,
    /// the nvarchar(1000) prefix hash, and an exact/prefix SharingLink match.
    /// </summary>
    Task<SharePointDocument?> FindSharePointDocumentAsync(string sharingLink, CancellationToken cancellationToken);

    /// <summary>Migrated SharePoint documents for the given link hashes (for read-side join), keyed by hash.</summary>
    Task<IReadOnlyDictionary<string, SharePointDocument>> GetSharePointDocumentsByHashesAsync(
        IReadOnlyCollection<string> linkHashes,
        CancellationToken cancellationToken);

    void AddSharePointDocument(SharePointDocument document);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

public sealed record ContractImportStats(int DistinctContracts, int VersionRows, int VersionsWithLinks);
