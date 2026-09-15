using Microsoft.AspNetCore.Builder;

namespace IntegratedProcurement.AppHost.Api.Auth;

public static class PermissionEndpointExtensions
{
    /// <summary>
    /// Requires the current internal actor to hold the given permission key in addition to any
    /// group-level authorization (e.g. the InternalUser baseline).
    /// </summary>
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string permissionKey)
        where TBuilder : IEndpointConventionBuilder =>
        builder.RequireAuthorization(AuthorizationPolicies.Permission(permissionKey));

    /// <summary>Any one of the keys is enough (Tracker Officer can run Term Sheet / Contract).</summary>
    public static TBuilder RequireAnyPermission<TBuilder>(this TBuilder builder, params string[] permissionKeys)
        where TBuilder : IEndpointConventionBuilder =>
        builder.RequireAuthorization(AuthorizationPolicies.AnyPermission(permissionKeys));
}
