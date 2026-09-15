namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>
/// Write-port so other modules can complete a Tracker stage without taking the concrete
/// <see cref="ProposalTrackerService"/>.
/// </summary>
public interface ITrackerWorkflowCommandPort
{
    Task<TrackerActivityCommandResult> CompleteStageAsync(
        string proposalId,
        string stageCode,
        int? evidenceCount,
        DateTimeOffset? completedAt,
        CancellationToken cancellationToken);

    /// <summary>
    /// Unlock LOA and Contract after a winner completes Term Sheet, without closing the TERM step.
    /// The TERM step stays Active until every sibling CIP case has completed Term Sheet.
    /// </summary>
    Task<TrackerActivityCommandResult> OpenParallelAfterTermAsync(
        string proposalId,
        DateTimeOffset? openedAt,
        CancellationToken cancellationToken);
}
