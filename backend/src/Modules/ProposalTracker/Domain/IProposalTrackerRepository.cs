namespace IntegratedProcurement.Modules.ProposalTracker.Domain;

/// <summary>
/// Data-access contract for the Proposal Tracker module. The interface lives in the Domain layer
/// (the module owns its persistence contract); the implementation lives in the module's
/// Infrastructure layer. <paramref name="tracking"/> selects whether entities are change-tracked
/// (true for command flows that mutate then save, false for read-only projections).
/// </summary>
public interface IProposalTrackerRepository
{
    Task<IReadOnlyList<TrackerProposal>> ListProposalsAsync(CancellationToken cancellationToken);

    /// <summary>All proposals keyed by <see cref="TrackerProposal.ProposalKey"/> (for ingest upsert).</summary>
    Task<IReadOnlyDictionary<string, TrackerProposal>> GetProposalsByKeyAsync(bool tracking, CancellationToken cancellationToken);

    void AddProposal(TrackerProposal proposal);

    /// <summary>Resolve a proposal by its key or its human-facing number.</summary>
    Task<TrackerProposal?> GetProposalAsync(string proposalIdOrNumber, bool tracking, CancellationToken cancellationToken);

    Task<IReadOnlyList<TrackerProposalActivity>> GetActivitiesAsync(string proposalKey, bool tracking, CancellationToken cancellationToken);

    Task<IReadOnlyList<TrackerProposalActivity>> ListActivitiesAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<TrackerLoaDocument>> ListLoaDocumentsAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<TrackerLoaDocument>> GetLoaDocumentsAsync(string proposalKey, CancellationToken cancellationToken);

    Task<TrackerLoaDocument?> FindLoaDocumentAsync(string proposalKey, string activityKey, string vendorId, CancellationToken cancellationToken);

    void AddLoaDocument(TrackerLoaDocument document);

    /// <summary>The proposal's commercial/award result header (from Bid Evaluation or Negotiation), or null.</summary>
    Task<ProposalAwardResult?> GetAwardResultAsync(string proposalKey, bool tracking, CancellationToken cancellationToken);

    Task<IReadOnlyList<ProposalAwardResultVendor>> GetAwardResultVendorsAsync(string proposalKey, CancellationToken cancellationToken);

    void AddAwardResult(ProposalAwardResult result);

    /// <summary>Replace-all the per-vendor award lines for a proposal.</summary>
    Task ReplaceAwardResultVendorsAsync(string proposalKey, IReadOnlyCollection<ProposalAwardResultVendor> vendors, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
