using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

internal sealed class VendorRepository : IVendorRepository
{
    private readonly ProcurementDbContext _dbContext;

    public VendorRepository(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // Tracked (not AsNoTracking) so profile mutations + appended status history are persisted.
    public Task<Vendor?> GetAsync(string vendorId, CancellationToken cancellationToken) =>
        _dbContext.Vendors.FirstOrDefaultAsync(vendor => vendor.Id == vendorId, cancellationToken);

    public async Task ReplaceChildrenAsync(
        string vendorId,
        IReadOnlyList<VendorSubClassification> subClassifications,
        IReadOnlyList<VendorKbli> kblis,
        IReadOnlyList<VendorBrand> brands,
        IReadOnlyList<VendorCertificate> certificates,
        IReadOnlyList<VendorPortfolio> portfolios,
        IReadOnlyList<VendorSpecialRequirement> specialRequirements,
        CancellationToken cancellationToken)
    {
        // Remove existing child rows, then stage the new sets — committed together by SaveChangesAsync.
        _dbContext.VendorSubClassifications.RemoveRange(await _dbContext.VendorSubClassifications.Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken));
        _dbContext.VendorKblis.RemoveRange(await _dbContext.VendorKblis.Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken));
        _dbContext.VendorBrands.RemoveRange(await _dbContext.VendorBrands.Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken));
        _dbContext.VendorCertificates.RemoveRange(await _dbContext.VendorCertificates.Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken));
        // Officer-entered rows are registry-owned; the vendor wizard replace-all must not wipe them.
        _dbContext.VendorPortfolios.RemoveRange(await _dbContext.VendorPortfolios
            .Where(x => x.VendorId == vendorId && x.EnteredByParty != VendorPortfolioParties.Officer)
            .ToListAsync(cancellationToken));
        _dbContext.VendorSpecialRequirements.RemoveRange(await _dbContext.VendorSpecialRequirements.Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken));

        _dbContext.VendorSubClassifications.AddRange(subClassifications);
        _dbContext.VendorKblis.AddRange(kblis);
        _dbContext.VendorBrands.AddRange(brands);
        _dbContext.VendorCertificates.AddRange(certificates);
        _dbContext.VendorPortfolios.AddRange(portfolios);
        _dbContext.VendorSpecialRequirements.AddRange(specialRequirements);
    }

    public async Task<VendorChildrenSnapshot> GetChildrenAsync(string vendorId, CancellationToken cancellationToken)
    {
        return new VendorChildrenSnapshot(
            await _dbContext.VendorSubClassifications.AsNoTracking().Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken),
            await _dbContext.VendorKblis.AsNoTracking().Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken),
            await _dbContext.VendorBrands.AsNoTracking().Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken),
            await _dbContext.VendorCertificates.AsNoTracking().Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken),
            await _dbContext.VendorPortfolios.AsNoTracking().Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken),
            await _dbContext.VendorSpecialRequirements.AsNoTracking().Where(x => x.VendorId == vendorId).ToListAsync(cancellationToken));
    }

    public async Task<IReadOnlyList<Vendor>> ListAsync(string? status, string? search, CancellationToken cancellationToken)
    {
        var query = _dbContext.Vendors.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var code = status.Trim();
            query = query.Where(v => v.Status == code);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(v => v.Name.Contains(term)
                || (v.NpwpNo != null && v.NpwpNo.Contains(term))
                || (v.NibNo != null && v.NibNo.Contains(term)));
        }

        return await query.OrderByDescending(v => v.UpdatedAt ?? v.CreatedAt).ThenBy(v => v.Name).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<VendorStatusHistory>> GetStatusHistoryAsync(string vendorId, CancellationToken cancellationToken) =>
        await _dbContext.VendorStatusHistory.AsNoTracking()
            .Where(h => h.VendorId == vendorId)
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync(cancellationToken);

    // Contact email lives on the identity account (USERS_T). Prefer the workspace PIC so
    // review / activation mail goes to the person who can actually sign in.
    public Task<string?> GetPrimaryContactEmailAsync(string vendorId, CancellationToken cancellationToken) =>
        _dbContext.VendorUsers.AsNoTracking()
            .Where(u => u.VendorId == vendorId)
            .Join(
                _dbContext.Users.AsNoTracking(),
                u => u.IdentityUserId,
                identity => identity.Id,
                (u, identity) => new { u.IsWorkspacePic, identity.Email, identity.Id })
            .OrderByDescending(row => row.IsWorkspacePic)
            .ThenBy(row => row.Id)
            .Select(row => row.Email)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<VendorPortfolio?> GetPortfolioAsync(string vendorId, Guid portfolioId, CancellationToken cancellationToken) =>
        _dbContext.VendorPortfolios.FirstOrDefaultAsync(
            item => item.VendorId == vendorId && item.Id == portfolioId,
            cancellationToken);

    public void AddPortfolio(VendorPortfolio portfolio) => _dbContext.VendorPortfolios.Add(portfolio);

    public void RemovePortfolio(VendorPortfolio portfolio) => _dbContext.VendorPortfolios.Remove(portfolio);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
