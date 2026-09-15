using Microsoft.AspNetCore.Authorization;

namespace IntegratedProcurement.AppHost.Api.Auth;

/// <summary>
/// Authorization requirement satisfied when the current internal actor carries a matching permission claim.
/// </summary>
public sealed class PermissionRequirement : IAuthorizationRequirement
{
    public PermissionRequirement(string permission)
    {
        Permission = permission;
    }

    public string Permission { get; }
}
