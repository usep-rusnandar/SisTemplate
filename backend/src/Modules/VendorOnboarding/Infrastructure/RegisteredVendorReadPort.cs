using IntegratedProcurement.Modules.VendorOnboarding.Application;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>
/// Lists Vendor Database companies in status <see cref="VendorStatuses.Registered"/> for other modules.
/// </summary>
internal sealed class RegisteredVendorReadPort : IRegisteredVendorReadPort
{
    private readonly ProcurementDbContext _dbContext;

    public RegisteredVendorReadPort(ProcurementDbContext dbContext) => _dbContext = dbContext;

    public async Task<IReadOnlyList<RegisteredVendorReadRow>> ListRegisteredAsync(CancellationToken cancellationToken)
    {
        var vendors = await _dbContext.Vendors.AsNoTracking()
            .Where(vendor => vendor.DeletedAt == null && vendor.Status == VendorStatuses.Registered)
            .OrderBy(vendor => vendor.Name)
            .ThenBy(vendor => vendor.Id)
            .Select(vendor => new { vendor.Id, vendor.Name, vendor.OfficeAddress })
            .ToListAsync(cancellationToken);

        if (vendors.Count == 0)
        {
            return [];
        }

        var ids = vendors.Select(vendor => vendor.Id).ToArray();
        var contacts = await (
            from link in _dbContext.VendorUsers.AsNoTracking()
            join identity in _dbContext.Users.AsNoTracking() on link.IdentityUserId equals identity.Id
            where ids.Contains(link.VendorId)
            select new { link.VendorId, link.IsWorkspacePic, identity.CompleteName })
            .ToListAsync(cancellationToken);

        var picByVendor = contacts
            .GroupBy(item => item.VendorId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(item => item.IsWorkspacePic)
                    .Select(item => item.CompleteName)
                    .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)),
                StringComparer.OrdinalIgnoreCase);

        return vendors
            .Select(vendor => new RegisteredVendorReadRow(
                vendor.Id,
                vendor.Name,
                picByVendor.TryGetValue(vendor.Id, out var pic) ? pic : null,
                vendor.OfficeAddress))
            .ToArray();
    }
}
