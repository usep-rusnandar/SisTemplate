namespace IntegratedProcurement.BuildingBlocks.Application;

/// <summary>
/// Single source of truth for module identifiers. Two spellings per module, by convention:
/// <list type="bullet">
///   <item><b>Key</b> — camelCase, the canonical identity used for RBAC (role/permission ModuleKey),
///   admin scope, the frontend module registry/menu, the foundation-manifest key, and the Azure Blob
///   container lookup (<c>IDocumentStorage.ContainerForModule</c> + appsettings <c>AzureBlob:Containers</c>).</item>
///   <item><b>Slug</b> — kebab-case, the URL form used for API route groups, SPA routes, and the
///   documents endpoint path segment. Bridged back to <b>Key</b> via <see cref="KeyForSlug"/>.</item>
/// </list>
/// Names are never abbreviated (e.g. contractInitiationPlatform, not cip).
/// </summary>
public static class ModuleKeys
{
    public const string VendorWorkspace = "vendorWorkspace";
    public const string VendorOnboarding = "vendorOnboarding";
    public const string ProposalTracker = "proposalTracker";
    public const string ContractInitiationPlatform = "contractInitiationPlatform";
    public const string ContractMonitoring = "contractMonitoring";
    public const string MasterData = "masterData";
    public const string SuperAdmin = "superAdmin";
    public const string Administration = "administration";
    public const string VendorInvitations = "vendorInvitations";

    public static class Slugs
    {
        public const string VendorWorkspace = "vendor-workspace";
        public const string VendorOnboarding = "vendor-onboarding";
        public const string ProposalTracker = "proposal-tracker";
        public const string ContractInitiationPlatform = "contract-initiation-platform";
        public const string ContractMonitoring = "contract-monitoring";
        public const string MasterData = "master-data";
        public const string SuperAdmin = "super-admin";
        public const string Administration = "administration";
        public const string VendorInvitations = "vendor-invitations";
    }

    private static readonly Dictionary<string, string> SlugToKey = new(StringComparer.OrdinalIgnoreCase)
    {
        [Slugs.VendorWorkspace] = VendorWorkspace,
        [Slugs.VendorOnboarding] = VendorOnboarding,
        [Slugs.ProposalTracker] = ProposalTracker,
        [Slugs.ContractInitiationPlatform] = ContractInitiationPlatform,
        [Slugs.ContractMonitoring] = ContractMonitoring,
        [Slugs.MasterData] = MasterData,
        [Slugs.SuperAdmin] = SuperAdmin,
        [Slugs.Administration] = Administration,
        [Slugs.VendorInvitations] = VendorInvitations,
    };

    /// <summary>Resolve a kebab URL slug to its canonical camelCase module key (null if unknown).</summary>
    public static string? KeyForSlug(string? slug) =>
        slug is not null && SlugToKey.TryGetValue(slug, out var key) ? key : null;

    /// <summary>Every canonical module key (for guard tests / validation).</summary>
    public static IReadOnlyCollection<string> All =>
    [
        VendorWorkspace, VendorOnboarding, ProposalTracker, ContractInitiationPlatform,
        ContractMonitoring, MasterData, SuperAdmin, Administration, VendorInvitations,
    ];
}
