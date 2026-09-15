using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Vendor-wizard replace-all for portfolios: incoming rows are always Vendor-owned, and any payload
/// whose document owner-key already belongs to an Officer row is dropped so the wizard cannot clone
/// or overwrite registry-owned projects.
/// </summary>
public static class VendorPortfolioReplacement
{
    public static IReadOnlyList<VendorPortfolio> VendorOwnedIncoming(
        string vendorId,
        IEnumerable<VendorPortfolioInput>? incoming,
        IEnumerable<VendorPortfolio> existing)
    {
        var officerKeys = existing
            .Where(row => row.IsOfficerEntered)
            .Select(row => row.DocumentOwnerKey)
            .Where(key => key.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var rows = new List<VendorPortfolio>();
        foreach (var item in incoming ?? [])
        {
            var key = VendorPortfolio.DocumentOwnerKeyFor(item.Client, item.ContractStartDate);
            if (key.Length > 0 && officerKeys.Contains(key))
            {
                continue;
            }

            rows.Add(VendorPortfolio.Create(
                vendorId,
                item.Client,
                item.ScopeOfWork,
                item.TotalValue,
                item.ContractStartDate,
                item.ContractEndDate,
                VendorPortfolioParties.Vendor));
        }

        return rows;
    }
}
