namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>
/// Cross-module read contract for the proposal's commercial/award result (from Bid Evaluation or
/// Negotiation). Consumed by the Contract Initiation Platform to create a Term Sheet case per winning
/// vendor. Returns DTO views only — consumers stay decoupled from the Tracker schema.
/// </summary>
public interface ITrackerBidEvaluationReadPort
{
    /// <summary>The award result with its winner vendors for a proposal, or null when none recorded.</summary>
    Task<TrackerAwardResultView?> GetAwardResultAsync(string proposalKey, CancellationToken cancellationToken);
}

public sealed record TrackerAwardResultView(
    string ProposalKey,
    string Source,
    string? Method,
    DateTimeOffset? EvaluatedAt,
    IReadOnlyList<TrackerAwardWinnerView> Winners);

public sealed record TrackerAwardWinnerView(
    string VendorId,
    string VendorName,
    decimal AwardValue,
    decimal AwardPercent,
    string? TermsPayloadJson);
