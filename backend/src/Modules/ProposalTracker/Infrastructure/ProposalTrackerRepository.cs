using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.ProposalTracker.Infrastructure;

/// <summary>
/// EF Core implementation of the Proposal Tracker data-access contract over the shared
/// <see cref="ProcurementDbContext"/>; touches only Tracker entities.
/// </summary>
internal sealed class ProposalTrackerRepository : IProposalTrackerRepository
{
    private readonly ProcurementDbContext _dbContext;

    public ProposalTrackerRepository(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<TrackerProposal>> ListProposalsAsync(CancellationToken cancellationToken) =>
        await _dbContext.TrackerProposals
            .AsNoTracking()
            .OrderBy(proposal => proposal.ProposalNumber)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<string, TrackerProposal>> GetProposalsByKeyAsync(bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking ? _dbContext.TrackerProposals : _dbContext.TrackerProposals.AsNoTracking();
        var rows = await query.ToListAsync(cancellationToken);
        return rows.ToDictionary(proposal => proposal.ProposalKey, StringComparer.OrdinalIgnoreCase);
    }

    public void AddProposal(TrackerProposal proposal) => _dbContext.TrackerProposals.Add(proposal);

    public async Task<TrackerProposal?> GetProposalAsync(string proposalIdOrNumber, bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking ? _dbContext.TrackerProposals : _dbContext.TrackerProposals.AsNoTracking();
        return await query
            .Where(item => item.ProposalKey == proposalIdOrNumber || item.ProposalNumber == proposalIdOrNumber)
            .OrderBy(item => item.ProposalKey == proposalIdOrNumber ? 0 : 1)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TrackerProposalActivity>> GetActivitiesAsync(string proposalKey, bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking ? _dbContext.TrackerProposalActivities : _dbContext.TrackerProposalActivities.AsNoTracking();
        return await query
            .Where(activity => activity.ProposalKey == proposalKey)
            .OrderBy(activity => activity.ActivityKey)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TrackerProposalActivity>> ListActivitiesAsync(CancellationToken cancellationToken) =>
        await _dbContext.TrackerProposalActivities
            .AsNoTracking()
            .OrderBy(activity => activity.ProposalKey)
            .ThenBy(activity => activity.ActivityKey)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<TrackerLoaDocument>> ListLoaDocumentsAsync(CancellationToken cancellationToken) =>
        await _dbContext.TrackerLoaDocuments
            .AsNoTracking()
            .OrderBy(document => document.GeneratedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<TrackerLoaDocument>> GetLoaDocumentsAsync(string proposalKey, CancellationToken cancellationToken) =>
        await _dbContext.TrackerLoaDocuments
            .AsNoTracking()
            .Where(document => document.ProposalKey == proposalKey)
            .OrderBy(document => document.ActivityKey)
            .ThenBy(document => document.VendorName)
            .ToListAsync(cancellationToken);

    public async Task<TrackerLoaDocument?> FindLoaDocumentAsync(string proposalKey, string activityKey, string vendorId, CancellationToken cancellationToken) =>
        await _dbContext.TrackerLoaDocuments.SingleOrDefaultAsync(
            item => item.ProposalKey == proposalKey && item.ActivityKey == activityKey && item.VendorId == vendorId,
            cancellationToken);

    public void AddLoaDocument(TrackerLoaDocument document) => _dbContext.TrackerLoaDocuments.Add(document);

    public async Task<ProposalAwardResult?> GetAwardResultAsync(string proposalKey, bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking ? _dbContext.ProposalAwardResults : _dbContext.ProposalAwardResults.AsNoTracking();
        return await query.SingleOrDefaultAsync(item => item.ProposalKey == proposalKey, cancellationToken);
    }

    public async Task<IReadOnlyList<ProposalAwardResultVendor>> GetAwardResultVendorsAsync(string proposalKey, CancellationToken cancellationToken) =>
        await _dbContext.ProposalAwardResultVendors
            .AsNoTracking()
            .Where(vendor => vendor.ProposalKey == proposalKey)
            .OrderByDescending(vendor => vendor.IsWinner)
            .ThenBy(vendor => vendor.Rank)
            .ThenBy(vendor => vendor.VendorName)
            .ToListAsync(cancellationToken);

    public void AddAwardResult(ProposalAwardResult result) => _dbContext.ProposalAwardResults.Add(result);

    public async Task ReplaceAwardResultVendorsAsync(string proposalKey, IReadOnlyCollection<ProposalAwardResultVendor> vendors, CancellationToken cancellationToken)
    {
        await _dbContext.ProposalAwardResultVendors
            .Where(vendor => vendor.ProposalKey == proposalKey)
            .ExecuteDeleteAsync(cancellationToken);
        if (vendors.Count > 0)
        {
            _dbContext.ProposalAwardResultVendors.AddRange(vendors);
        }
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
