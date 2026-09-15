namespace IntegratedProcurement.BuildingBlocks.Application;

/// <summary>
/// One administrable Master Data screen and the record sets behind it. The screen — not the raw set —
/// is the unit of access: Administrative Regions and Commodity each edit several sets in one place,
/// and Approval Workflow edits no <c>MASTER_DATA_T</c> set at all.
/// </summary>
/// <param name="Id">camelCase identifier; also the middle segment of the permission keys.</param>
/// <param name="DefaultModule">
/// Module whose broad <c>masterData.{module}.view|manage</c> keys also unlock this screen. It is the
/// default, not a boundary: granting the per-screen key gives any role access regardless of module.
/// </param>
public sealed record MasterDataScreen(
    string Id,
    string Name,
    string DefaultModule,
    IReadOnlyList<string> SetKeys)
{
    public string ViewPermission => $"masterData.{Id}.view";
    public string ManagePermission => $"masterData.{Id}.manage";
    public string ModuleViewPermission => $"masterData.{DefaultModule}.view";
    public string ModuleManagePermission => $"masterData.{DefaultModule}.manage";
}

/// <summary>
/// Source of truth for Master Data access. Each screen carries its own view/manage permission, so any
/// administrator role can be granted any screen from the Roles page — no code change per assignment.
/// The older module-wide keys still work as a broad default; to restrict a role to specific screens,
/// drop its module-wide key and grant the per-screen ones.
/// </summary>
public static class MasterDataScreens
{
    public static IReadOnlyList<MasterDataScreen> All { get; } =
    [
        new("holiday", "Holiday", ModuleKeys.ProposalTracker, ["holiday"]),
        new("trackerStep", "Proposal Tracker Step", ModuleKeys.ProposalTracker, ["tracker-step"]),
        new("trackerMethod", "Proposal Tracker Method", ModuleKeys.ProposalTracker, ["tracker-method"]),
        new("cipAuthorization", "CIP Authorization", ModuleKeys.ProposalTracker, ["cip-authorization"]),
        new("distributorType", "Distributor Type", ModuleKeys.VendorOnboarding, ["distributor-type"]),
        new("vendorDocumentRequirement", "Vendor Document Requirement", ModuleKeys.VendorOnboarding, ["vendor-document-requirement"]),
        new("brand", "Brand", ModuleKeys.VendorOnboarding, ["brand"]),
        new("kbli", "KBLI", ModuleKeys.VendorOnboarding, ["kbli"]),
        new("country", "Country", ModuleKeys.VendorOnboarding, ["country"]),
        new("administrativeRegions", "Administrative Regions", ModuleKeys.VendorOnboarding,
            ["province", "city", "district", "village"]),
        new("specialRequirement", "Special Requirement", ModuleKeys.VendorOnboarding, ["special-requirement"]),
        new("commodity", "Commodity", ModuleKeys.VendorOnboarding,
        [
            "commodity-category",
            "commodity-classification",
            "commodity-subclassification",
            "commodity-subclassification-kbli",
            "commodity-subclassification-special-requirement",
        ]),
        new("vendorStatus", "Vendor Status", ModuleKeys.VendorOnboarding, ["vendor-status"]),
        new("kbliType", "KBLI Type", ModuleKeys.VendorOnboarding, ["kbli-type"]),
        new("kbliStatus", "KBLI Status", ModuleKeys.VendorOnboarding, ["kbli-status"]),
    ];

    private static readonly Dictionary<string, MasterDataScreen> BySet =
        All.SelectMany(screen => screen.SetKeys.Select(setKey => (setKey, screen)))
            .ToDictionary(pair => pair.setKey, pair => pair.screen, StringComparer.OrdinalIgnoreCase);

    /// <summary>The screen that administers a record set, or null for a set no screen claims.</summary>
    public static MasterDataScreen? ForSet(string? setKey) =>
        setKey is not null && BySet.TryGetValue(setKey.Trim(), out var screen) ? screen : null;

    public static MasterDataScreen? ById(string? screenId) =>
        screenId is null
            ? null
            : All.FirstOrDefault(screen => string.Equals(screen.Id, screenId.Trim(), StringComparison.OrdinalIgnoreCase));

    /// <summary>Every per-screen permission key, in catalog order (view then manage per screen).</summary>
    public static IEnumerable<string> PermissionKeys =>
        All.SelectMany(screen => new[] { screen.ViewPermission, screen.ManagePermission });
}
