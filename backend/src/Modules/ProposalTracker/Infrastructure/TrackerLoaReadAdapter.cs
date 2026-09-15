using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.ProposalTracker.Infrastructure;

/// <summary>
/// Tracker-side implementation of the cross-module LOA read contract. Reads Tracker tables through
/// the shared <see cref="ProcurementDbContext"/> and projects to DTO views, keeping the consuming
/// module (CIP) decoupled from Tracker entities.
/// </summary>
internal sealed class TrackerLoaReadAdapter : ITrackerLoaReadPort
{
    private readonly ProcurementDbContext _dbContext;

    public TrackerLoaReadAdapter(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<TrackerLoaView>> ListLoaDocumentsAsync(CancellationToken cancellationToken) =>
        await _dbContext.TrackerLoaDocuments
            .AsNoTracking()
            .OrderByDescending(item => item.GeneratedAt)
            .Select(item => new TrackerLoaView(
                item.ProposalKey,
                item.ActivityKey,
                item.VendorId,
                item.LoaNumber,
                item.VendorName,
                item.AwardValue,
                item.AwardPercent,
                item.GeneratedAt,
                item.FileName,
                item.PayloadJson))
            .ToListAsync(cancellationToken);

    public async Task<TrackerProposalView?> GetProposalAsync(string proposalKey, CancellationToken cancellationToken) =>
        await _dbContext.TrackerProposals
            .AsNoTracking()
            .Where(item => item.ProposalKey == proposalKey)
            .Select(item => new TrackerProposalView(
                item.ProposalKey,
                item.ProposalNumber,
                item.Title,
                item.Jobsite,
                item.Department,
                item.Amount,
                item.OwnerName,
                item.AssignedOfficerName))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<TrackerWorkflowView?> GetWorkflowAsync(string proposalKey, CancellationToken cancellationToken)
    {
        var proposal = await _dbContext.TrackerProposals
            .AsNoTracking()
            .Where(item => item.ProposalKey == proposalKey || item.ProposalNumber == proposalKey)
            .OrderBy(item => item.ProposalKey == proposalKey ? 0 : 1)
            .FirstOrDefaultAsync(cancellationToken);
        if (proposal is null)
        {
            return null;
        }

        var activities = await _dbContext.TrackerProposalActivities
            .AsNoTracking()
            .Where(item => item.ProposalKey == proposal.ProposalKey)
            .OrderBy(item => item.ActivityKey)
            .ToListAsync(cancellationToken);
        var termsheet = activities.FirstOrDefault(item => item.Title is "Term Sheet" or "Termsheet");
        var contract = activities.FirstOrDefault(item => item.Title == "Contract");
        var estimatedDate = contract?.TargetDate ?? activities.LastOrDefault(item => item.TargetDate.HasValue)?.TargetDate;
        TrackerWorkflowActivityView? Snapshot(TrackerProposalActivity? activity) => activity is null
            ? null
            : new TrackerWorkflowActivityView(activity.TargetDate, activity.CompletedAt, activity.Status, activity.Title);

        return new TrackerWorkflowView(proposal.RequirementDate, estimatedDate, Snapshot(termsheet), Snapshot(contract));
    }
}
