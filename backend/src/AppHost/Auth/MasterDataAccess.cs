using System.Security.Claims;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Security;

namespace IntegratedProcurement.AppHost.Api.Auth;

/// <summary>
/// Authorization for a master-data record set. Two keys unlock a set, and holding either is enough:
/// the screen that administers it (<c>masterData.{screenId}.view|manage</c>, see
/// <see cref="MasterDataScreens"/>) or the broad module key (<c>masterData.{module}.view|manage</c>).
/// That is what makes access assignable: grant a role one screen and it gets exactly that screen; the
/// module key stays the shortcut for "this module's admin sees all of its master data". To restrict a
/// role to specific screens, drop its module key and grant the per-screen ones.
/// A set no screen claims falls back to Vendor Onboarding, as it always has.
/// </summary>
public static class MasterDataAccess
{
    /// <summary>Owning module for a set key. Unmapped keys default to Vendor Onboarding.</summary>
    public static string ModuleFor(string? setKey) =>
        MasterDataScreens.ForSet(setKey)?.DefaultModule ?? ModuleKeys.VendorOnboarding;

    public static string ViewPermission(string? setKey) => $"masterData.{ModuleFor(setKey)}.view";

    public static string ManagePermission(string? setKey) => $"masterData.{ModuleFor(setKey)}.manage";

    private static bool Has(ClaimsPrincipal user, string permission) =>
        user.HasClaim(claim => claim.Type == AppClaimTypes.Permission
            && string.Equals(claim.Value, permission, StringComparison.OrdinalIgnoreCase));

    public static bool CanView(ClaimsPrincipal user, string? setKey) =>
        Has(user, ViewPermission(setKey))
        || (MasterDataScreens.ForSet(setKey) is MasterDataScreen screen && Has(user, screen.ViewPermission))
        // Tracker step/method are the runtime process model for ops screens (matrix, CIP handoff),
        // not only Master Data admin UI. Officers with module view must be able to read them.
        || (IsTrackerProcessModelSet(setKey)
            && (Has(user, PermissionKeys.ProposalTrackerView)
                || Has(user, PermissionKeys.ContractInitiationPlatformView)))
        // Vendor Onboarding reference sets (commodity tree, KBLI, distributor type, regions, …) are
        // read to render a vendor dossier for review — the same read-only reference the vendor portal
        // already exposes to vendors. Reviewers/approvers hold vendorOnboarding.view|approve*, not
        // masterData.vendorOnboarding.view, so let any vendor-access role read (not manage) them.
        // Without this, the reviewer's dossier shows commodity Classification / KBLI Description as "-".
        || (IsVendorOnboardingReferenceSet(setKey) && HasAnyVendorAccess(user));

    public static bool CanManage(ClaimsPrincipal user, string? setKey) =>
        Has(user, ManagePermission(setKey))
        || (MasterDataScreens.ForSet(setKey) is MasterDataScreen screen && Has(user, screen.ManagePermission));

    private static bool IsTrackerProcessModelSet(string? setKey) =>
        string.Equals(setKey?.Trim(), "tracker-step", StringComparison.OrdinalIgnoreCase)
        || string.Equals(setKey?.Trim(), "tracker-method", StringComparison.OrdinalIgnoreCase);

    /// <summary>A known Vendor Onboarding-owned reference set (commodity, KBLI, regions, brand, …).</summary>
    private static bool IsVendorOnboardingReferenceSet(string? setKey) =>
        MasterDataScreens.ForSet(setKey) is MasterDataScreen screen
        && string.Equals(screen.DefaultModule, ModuleKeys.VendorOnboarding, StringComparison.OrdinalIgnoreCase);

    /// <summary>Holds any permission that grants access to the internal Vendor Onboarding registry/queue.</summary>
    private static bool HasAnyVendorAccess(ClaimsPrincipal user) =>
        Has(user, PermissionKeys.VendorOnboardingView)
        || Has(user, PermissionKeys.VendorOnboardingManage)
        || Has(user, PermissionKeys.VendorOnboardingApprove)
        || Has(user, PermissionKeys.VendorOnboardingApprove1)
        || Has(user, PermissionKeys.VendorOnboardingApprove2)
        || Has(user, PermissionKeys.VendorOnboardingApproveFinal);

    /// <summary>True if the user can view any master data at all — module-wide or a single screen.</summary>
    public static bool HasAnyView(ClaimsPrincipal user) =>
        user.Claims.Any(claim => claim.Type == AppClaimTypes.Permission
            && claim.Value.StartsWith("masterData.", StringComparison.OrdinalIgnoreCase)
            && claim.Value.EndsWith(".view", StringComparison.OrdinalIgnoreCase));

    /// <summary>Screen-level check for a screen that owns no record set (e.g. Approval Workflow).</summary>
    public static bool CanViewScreen(ClaimsPrincipal user, MasterDataScreen screen) =>
        Has(user, screen.ViewPermission) || Has(user, screen.ModuleViewPermission);

    /// <summary>Screen-level check for a screen that owns no record set (e.g. Approval Workflow).</summary>
    public static bool CanManageScreen(ClaimsPrincipal user, MasterDataScreen screen) =>
        Has(user, screen.ManagePermission) || Has(user, screen.ModuleManagePermission);
}
