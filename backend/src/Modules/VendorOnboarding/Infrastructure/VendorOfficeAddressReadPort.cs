using IntegratedProcurement.Modules.VendorOnboarding.Application;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>
/// Reads <c>vdr.VENDOR_T.OfficeAddress</c> (and Ariba/VendorConnect external-id aliases) for other modules.
/// </summary>
internal sealed class VendorOfficeAddressReadPort : IVendorOfficeAddressReadPort
{
    private readonly ProcurementDbContext _dbContext;

    public VendorOfficeAddressReadPort(ProcurementDbContext dbContext) => _dbContext = dbContext;

    public async Task<IReadOnlyDictionary<string, string>> ResolveAsync(
        IReadOnlyCollection<VendorOfficeAddressLookup> lookups,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var requested = (lookups ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item.VendorId) || !string.IsNullOrWhiteSpace(item.VendorName))
            .ToArray();
        if (requested.Length == 0)
        {
            return result;
        }

        var ids = requested
            .Select(item => item.VendorId?.Trim())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (ids.Length > 0)
        {
            var byId = await _dbContext.Vendors.AsNoTracking()
                .Where(vendor => ids.Contains(vendor.Id))
                .Select(vendor => new { vendor.Id, vendor.OfficeAddress })
                .ToListAsync(cancellationToken);
            foreach (var row in byId)
            {
                TryAdd(result, row.Id, row.OfficeAddress);
            }

            var missing = ids.Where(id => !result.ContainsKey(id!)).ToArray();
            if (missing.Length > 0)
            {
                var byExternal = await (
                    from xref in _dbContext.VendorExternalReferences.AsNoTracking()
                    join vendor in _dbContext.Vendors.AsNoTracking() on xref.VendorId equals vendor.Id
                    where missing.Contains(xref.ExternalVendorId)
                    select new { xref.ExternalVendorId, vendor.OfficeAddress })
                    .ToListAsync(cancellationToken);
                foreach (var row in byExternal)
                {
                    TryAdd(result, row.ExternalVendorId, row.OfficeAddress);
                }
            }
        }

        var unresolvedNames = requested
            .Where(item =>
                (string.IsNullOrWhiteSpace(item.VendorId) || !result.ContainsKey(item.VendorId.Trim()))
                && !string.IsNullOrWhiteSpace(item.VendorName))
            .Select(item => item.VendorName!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (unresolvedNames.Length == 0)
        {
            return result;
        }

        var byName = await _dbContext.Vendors.AsNoTracking()
            .Where(vendor => unresolvedNames.Contains(vendor.Name))
            .Select(vendor => new { vendor.Name, vendor.OfficeAddress })
            .ToListAsync(cancellationToken);
        foreach (var group in byName.GroupBy(row => row.Name, StringComparer.OrdinalIgnoreCase))
        {
            if (group.Count() != 1)
            {
                continue;
            }

            var address = group.First().OfficeAddress;
            if (string.IsNullOrWhiteSpace(address))
            {
                continue;
            }

            foreach (var lookup in requested.Where(item =>
                string.Equals(item.VendorName?.Trim(), group.Key, StringComparison.OrdinalIgnoreCase)))
            {
                var key = string.IsNullOrWhiteSpace(lookup.VendorId) ? group.Key : lookup.VendorId.Trim();
                TryAdd(result, key, address);
            }
        }

        return result;
    }

    private static void TryAdd(IDictionary<string, string> target, string? key, string? address)
    {
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(address))
        {
            return;
        }

        target.TryAdd(key, address.Trim());
    }
}
