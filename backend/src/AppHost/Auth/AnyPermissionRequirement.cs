using Microsoft.AspNetCore.Authorization;

namespace SisTemplate.AppHost.Api.Auth;

/// <summary>Satisfied when the current internal actor carries any of the listed permission claims.</summary>
public sealed class AnyPermissionRequirement : IAuthorizationRequirement
{
    public AnyPermissionRequirement(IReadOnlyList<string> permissions)
    {
        Permissions = permissions;
    }

    public IReadOnlyList<string> Permissions { get; }
}
