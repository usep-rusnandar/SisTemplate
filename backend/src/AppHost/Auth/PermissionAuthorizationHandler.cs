using System.Security.Claims;
using IntegratedProcurement.BuildingBlocks.Application.Security;
using Microsoft.AspNetCore.Authorization;

namespace IntegratedProcurement.AppHost.Api.Auth;

/// <summary>
/// Grants a <see cref="PermissionRequirement"/> only to authenticated internal users whose principal
/// carries the matching permission claim. Internal identity is established by the SSO middleware
/// (or the development session), which projects role-derived permissions onto the principal.
/// </summary>
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var user = context.User;

        var isInternal = user.HasClaim(AppClaimTypes.ActorType, "Internal")
            && !string.IsNullOrWhiteSpace(user.FindFirstValue(AppClaimTypes.PersonnelNo));

        if (isInternal && user.HasClaim(claim =>
                claim.Type == AppClaimTypes.Permission
                && string.Equals(claim.Value, requirement.Permission, StringComparison.OrdinalIgnoreCase)))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
