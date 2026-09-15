using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.ProposalTracker.Infrastructure;

/// <summary>
/// Tracker-side implementation of the award-result read contract. Reads the AWARD_RESULT_T header and
/// its winning AWARD_RESULT_VENDOR_T lines through the shared <see cref="ProcurementDbContext"/> and
/// projects to DTO views, keeping CIP decoupled from Tracker entities.
/// </summary>
internal sealed class TrackerBidEvaluationReadAdapter : ITrackerBidEvaluationReadPort
{
    private readonly ProcurementDbContext _dbContext;

    public TrackerBidEvaluationReadAdapter(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TrackerAwardResultView?> GetAwardResultAsync(string proposalKey, CancellationToken cancellationToken)
    {
        var header = await _dbContext.ProposalAwardResults
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.ProposalKey == proposalKey, cancellationToken);
        if (header is null)
        {
            return null;
        }

        var winners = await _dbContext.ProposalAwardResultVendors
            .AsNoTracking()
            .Where(vendor => vendor.ProposalKey == proposalKey && vendor.IsWinner)
            .OrderBy(vendor => vendor.Rank)
            .ThenBy(vendor => vendor.VendorName)
            .Select(vendor => new TrackerAwardWinnerView(
                vendor.VendorId,
                vendor.VendorName,
                vendor.AwardValue,
                vendor.AwardPercent,
                vendor.PayloadJson))
            .ToListAsync(cancellationToken);

        return new TrackerAwardResultView(header.ProposalKey, header.Source, header.Method, header.EvaluatedAt, winners);
    }
}
