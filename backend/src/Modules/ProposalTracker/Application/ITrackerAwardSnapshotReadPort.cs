namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>
/// Cross-module read of the award-step documents CIP shows on the Term Sheet snapshot
/// (vendor Negotiation uploads, plus the shared Bid Evaluation winner-bid proof).
/// Winner evidence is one document for all winners. Returns DTO views only.
/// </summary>
public interface ITrackerAwardSnapshotReadPort
{
    Task<IReadOnlyDictionary<string, TrackerAwardSnapshotView>> GetAsync(
        IReadOnlyCollection<TrackerAwardSnapshotQuery> queries,
        CancellationToken cancellationToken);
}

public sealed record TrackerAwardSnapshotQuery(string ProposalKey, string VendorId, string? AwardSource)
{
    public string Key => $"{ProposalKey}|{VendorId}";
}

public sealed record TrackerAwardSnapshotView(
    string ProposalKey,
    string VendorId,
    TrackerAwardSnapshotDocument? AwardSourceDocument,
    TrackerAwardSnapshotDocument? WinnerBidDocument);

public sealed record TrackerAwardSnapshotDocument(
    string Title,
    string FileName,
    string? BlobKey,
    string? Container);
