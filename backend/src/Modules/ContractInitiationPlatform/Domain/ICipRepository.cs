namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;

/// <summary>
/// Data-access contract for the Contract Initiation Platform module (its own tables only — cases,
/// case documents, case activities). Cross-module reads (Tracker LOA / proposal context) go through
/// the Tracker read-port, not this repository. <paramref name="tracking"/> selects change-tracking
/// for command flows that mutate then save.
/// </summary>
public interface ICipRepository
{
    Task<IReadOnlyList<CipCase>> ListCasesAsync(CancellationToken cancellationToken);

    Task<CipCase?> GetCaseAsync(string caseKey, bool tracking, CancellationToken cancellationToken);

    Task<CipCase?> GetCaseByLoaKeyAsync(string loaKey, CancellationToken cancellationToken);

    Task<IReadOnlyList<CipCaseDocument>> ListAllDocumentsAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<CipCaseDocument>> GetDocumentsAsync(string caseKey, CancellationToken cancellationToken);

    Task<IReadOnlyList<CipCaseActivity>> GetActivitiesAsync(string caseKey, CancellationToken cancellationToken);

    Task<bool> DocumentExistsAsync(string caseKey, string documentKey, CancellationToken cancellationToken);

    Task<CipCaseDocument?> GetDocumentAsync(string caseKey, string documentKey, bool tracking, CancellationToken cancellationToken);

    /// <summary>Allocate the next free CIP case key (CIP-2026-NNN).</summary>
    Task<string> NextCaseKeyAsync(CancellationToken cancellationToken);

    void AddCase(CipCase cipCase);

    void AddDocument(CipCaseDocument document);

    void AddActivity(CipCaseActivity activity);

    Task DeleteCaseGraphsAsync(IReadOnlyCollection<string> caseKeys, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
