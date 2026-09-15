namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Evaluates a DNF (sum-of-products) KBLI rule: groups are OR'd; codes inside a group are AND'd.
/// </summary>
public static class CommodityKbliRuleEvaluator
{
    public static bool IsSatisfied(
        IReadOnlyList<IReadOnlyList<string>>? groups,
        IEnumerable<string> vendorKbliCodes)
    {
        if (groups is null || groups.Count == 0)
        {
            return true;
        }

        var held = new HashSet<string>(
            vendorKbliCodes.Where(c => !string.IsNullOrWhiteSpace(c)),
            StringComparer.OrdinalIgnoreCase);

        return groups.Any(group =>
            group.Count > 0 && group.All(code => held.Contains(code)));
    }

    public static string Preview(IReadOnlyList<IReadOnlyList<string>> groups)
    {
        if (groups.Count == 0)
        {
            return string.Empty;
        }

        return string.Join(" OR ", groups.Select(g =>
            g.Count > 1 ? $"({string.Join(" AND ", g)})" : g[0]));
    }
}
