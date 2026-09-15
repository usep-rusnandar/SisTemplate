using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

internal sealed class VendorDocumentRepository : IVendorDocumentRepository
{
    private readonly ProcurementDbContext _dbContext;

    public VendorDocumentRepository(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public void Add(VendorDocument document) => _dbContext.VendorDocuments.Add(document);

    public void Remove(VendorDocument document) => _dbContext.VendorDocuments.Remove(document);

    public Task<VendorDocument?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        _dbContext.VendorDocuments.FirstOrDefaultAsync(document => document.Id == id, cancellationToken);

    public Task<VendorDocument?> FindSlotAsync(string vendorId, string documentType, string ownerKey, CancellationToken cancellationToken) =>
        _dbContext.VendorDocuments.FirstOrDefaultAsync(
            document => document.VendorId == vendorId && document.DocumentType == documentType && document.OwnerKey == ownerKey,
            cancellationToken);

    public Task<VendorDocument?> FindByTypeAndOwnerAsync(string documentType, string ownerKey, CancellationToken cancellationToken) =>
        _dbContext.VendorDocuments.AsNoTracking().FirstOrDefaultAsync(
            document => document.DocumentType == documentType && document.OwnerKey == ownerKey,
            cancellationToken);

    public Task<VendorDocument?> FindLatestByVendorAndTypeAsync(string vendorId, string documentType, CancellationToken cancellationToken) =>
        _dbContext.VendorDocuments.AsNoTracking()
            .Where(document => document.VendorId == vendorId && document.DocumentType == documentType && document.IsActive)
            .OrderByDescending(document => document.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<VendorDocument>> ListByVendorAsync(string vendorId, CancellationToken cancellationToken) =>
        await _dbContext.VendorDocuments
            .AsNoTracking()
            .Where(document => document.VendorId == vendorId)
            .OrderBy(document => document.DocumentType)
            .ThenBy(document => document.OwnerKey)
            .ToArrayAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
