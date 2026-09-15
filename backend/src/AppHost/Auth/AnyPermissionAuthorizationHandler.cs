using System.Security.Claims;
using SisTemplate.BuildingBlocks.Application.Security;
using Microsoft.AspNetCore.Authorization;

namespace SisTemplate.AppHost.Api.Auth;

/// <summary>
/// Grants an <see cref="AnyPermissionRequirement"/> when the internal principal holds at least one
/// of the listed permission claims. Used so Proposal Tracker officers can run Term Sheet / Contract
/// commands without a separate CIP-only role.
/// </summary>
public sealed class AnyPermissionAuthorizationHandler : AuthorizationHandler<AnyPermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AnyPermissionRequirement requirement)
    {
        var user = context.User;
        var isInternal = user.HasClaim(AppClaimTypes.ActorType, "Internal")
            && !string.IsNullOrWhiteSpace(user.FindFirstValue(AppClaimTypes.PersonnelNo));
        if (!isInternal)
        {
            return Task.CompletedTask;
        }

        foreach (var permission in requirement.Permissions)
        {
            if (user.HasClaim(claim =>
                    claim.Type == AppClaimTypes.Permission
                    && string.Equals(claim.Value, permission, StringComparison.OrdinalIgnoreCase)))
            {
                context.Succeed(requirement);
                break;
            }
        }

        return Task.CompletedTask;
    }
}
