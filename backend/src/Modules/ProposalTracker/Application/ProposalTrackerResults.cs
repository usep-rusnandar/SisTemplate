using IntegratedProcurement.Modules.ProposalTracker.Domain;

namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>Result of a proposal-level command. <see cref="Proposal"/> is the mutated entity (for side effects).</summary>
public sealed record TrackerProposalCommandResult(bool Found, TrackerProposal? Proposal);

/// <summary>Distribute carries the resolved officer name alongside the proposal.</summary>
public sealed record TrackerDistributeResult(bool Found, TrackerProposal? Proposal, string? Officer);

/// <summary>Activity-level command outcome — distinguishes a missing proposal from a missing activity.</summary>
public sealed record TrackerActivityCommandResult(bool ProposalFound, bool ActivityFound, TrackerProposal? Proposal);

/// <summary>LOA generation carries the resolved vendor name (for the CIP-inbox notification).</summary>
public sealed record TrackerLoaResult(bool Found, TrackerProposal? Proposal, string VendorName, string? ErrorCode = null);

/// <summary>One user-supplied row for temporary sample proposal generation (stand-in for E-Proposal).</summary>
public sealed record SampleProposalItemInput(
    string? TrackerMethod,
    DateOnly? RequirementDate,
    int TotalVendor,
    decimal? Amount = null,
    string? AssignedOfficerName = null,
    string? LastStepCode = null);

/// <summary>Outcome of sample-data generation.</summary>
public sealed record TrackerSampleDataResult(bool Ok, string? ErrorCode, IReadOnlyList<TrackerProposal> Created);
