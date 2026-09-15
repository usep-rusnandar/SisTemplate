namespace IntegratedProcurement.BuildingBlocks.Application;

/// <summary>
/// Login gate for module-portal hosts. Suite (no header) stays open to every internal user.
/// A module portal is allowed when the actor has at least one <c>{moduleKey}.*</c> permission.
/// Administration / master-data / dashboard keys do not count.
/// </summary>
public static class PortalModuleAccess
{
    public const string HeaderName = "X-App-Module";

    private static readonly HashSet<string> GatedKeys = new(StringComparer.Ordinal)
    {
        ModuleKeys.VendorOnboarding,
        ModuleKeys.ProposalTracker,
        ModuleKeys.ContractMonitoring,
    };

    private static readonly Dictionary<string, string> DisplayNames = new(StringComparer.Ordinal)
    {
        [ModuleKeys.VendorOnboarding] = "Vendor Onboarding",
        [ModuleKeys.ProposalTracker] = "Proposal Tracker",
        [ModuleKeys.ContractMonitoring] = "Contract Monitoring",
    };

    /// <summary>Canonical module key when the header is a gated portal slug; otherwise null (Suite / ignore).</summary>
    public static string? ResolveGatedModuleKey(string? headerValue)
    {
        var key = ModuleKeys.KeyForSlug(headerValue?.Trim());
        // Retired CIP Azure host: map leftover X-App-Module to Tracker until that App Service is deleted.
        if (string.Equals(key, ModuleKeys.ContractInitiationPlatform, StringComparison.Ordinal))
        {
            key = ModuleKeys.ProposalTracker;
        }

        return key is not null && GatedKeys.Contains(key) ? key : null;
    }

    public static bool HasAccess(IEnumerable<string>? permissions, string moduleKey)
    {
        if (string.IsNullOrWhiteSpace(moduleKey) || permissions is null)
        {
            return false;
        }

        return AccessPrefixes(moduleKey).Any(prefix =>
            permissions.Any(permission =>
                !string.IsNullOrWhiteSpace(permission)
                && permission.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>
    /// CIP screens live in Proposal Tracker. Tracker login accepts Tracker or CIP module permissions
    /// so remapped officers (and leftover CIP-only grants) can sign in.
    /// </summary>
    private static IEnumerable<string> AccessPrefixes(string moduleKey)
    {
        if (string.Equals(moduleKey, ModuleKeys.ProposalTracker, StringComparison.Ordinal))
        {
            return
            [
                ModuleKeys.ProposalTracker + ".",
                ModuleKeys.ContractInitiationPlatform + ".",
            ];
        }

        return [moduleKey + "."];
    }

    public static string DeniedTitle(string moduleKey)
    {
        var name = DisplayNames.TryGetValue(moduleKey, out var display) ? display : moduleKey;
        return $"This account does not have access to {name}.";
    }
}
