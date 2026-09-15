namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>
/// Cross-module read contract published by the Proposal Tracker module for consumers (e.g. the
/// Contract Initiation Platform) that need read-only access to Tracker LOA documents and proposal
/// context. Returns DTO views — never Tracker domain entities — so consumers stay decoupled from the
/// Tracker schema. Implemented in Tracker Infrastructure.
/// </summary>
public interface ITrackerLoaReadPort
{
    /// <summary>All LOA documents, newest first (for the CIP Document Repository projection).</summary>
    Task<IReadOnlyList<TrackerLoaView>> ListLoaDocumentsAsync(CancellationToken cancellationToken);

    /// <summary>Proposal context for enriching a CIP case created from an award result.</summary>
    Task<TrackerProposalView?> GetProposalAsync(string proposalKey, CancellationToken cancellationToken);

    /// <summary>Plan/actual workflow dates projected for CIP without exposing Tracker entities.</summary>
    Task<TrackerWorkflowView?> GetWorkflowAsync(string proposalKey, CancellationToken cancellationToken);
}

public sealed record TrackerLoaView(
    string ProposalKey,
    string ActivityKey,
    string VendorId,
    string? LoaNumber,
    string VendorName,
    decimal AwardValue,
    decimal AwardPercent,
    DateTimeOffset? GeneratedAt,
    string FileName,
    string PayloadJson);

public sealed record TrackerProposalView(
    string ProposalKey,
    string ProposalNumber,
    string Title,
    string? Jobsite,
    string? Department,
    decimal Amount,
    string? OwnerName,
    string? AssignedOfficerName);

public sealed record TrackerWorkflowActivityView(
    DateOnly? Plan,
    DateTimeOffset? Actual,
    string Status,
    string Title);

public sealed record TrackerWorkflowView(
    DateOnly? RequirementDate,
    DateOnly? EstimatedDate,
    TrackerWorkflowActivityView? Termsheet,
    TrackerWorkflowActivityView? Contract);
