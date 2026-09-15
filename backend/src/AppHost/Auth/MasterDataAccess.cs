using System.Security.Claims;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Security;

namespace IntegratedProcurement.AppHost.Api.Auth;

public static class MasterDataAccess
{
    public static string ModuleFor(string? setKey) =>
        MasterDataScreens.ForSet(setKey)?.DefaultModule ?? ModuleKeys.Administration;

    public static string ViewPermission(string? setKey) => $"masterData.{ModuleFor(setKey)}.view";

    public static string ManagePermission(string? setKey) => $"masterData.{ModuleFor(setKey)}.manage";

    private static bool Has(ClaimsPrincipal user, string permission) =>
        user.HasClaim(claim => claim.Type == AppClaimTypes.Permission
            && string.Equals(claim.Value, permission, StringComparison.OrdinalIgnoreCase));

    public static bool CanView(ClaimsPrincipal user, string? setKey) =>
        Has(user, ViewPermission(setKey))
        || (MasterDataScreens.ForSet(setKey) is MasterDataScreen screen && Has(user, screen.ViewPermission));

    public static bool CanManage(ClaimsPrincipal user, string? setKey) =>
        Has(user, ManagePermission(setKey))
        || (MasterDataScreens.ForSet(setKey) is MasterDataScreen screen && Has(user, screen.ManagePermission));

    public static bool HasAnyView(ClaimsPrincipal user) =>
        user.Claims.Any(claim => claim.Type == AppClaimTypes.Permission
            && claim.Value.StartsWith("masterData.", StringComparison.OrdinalIgnoreCase)
            && claim.Value.EndsWith(".view", StringComparison.OrdinalIgnoreCase));

    public static bool CanViewScreen(ClaimsPrincipal user, MasterDataScreen screen) =>
        Has(user, screen.ViewPermission) || Has(user, screen.ModuleViewPermission);

    public static bool CanManageScreen(ClaimsPrincipal user, MasterDataScreen screen) =>
        Has(user, screen.ManagePermission) || Has(user, screen.ModuleManagePermission);
}
