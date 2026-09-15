using System.Security.Claims;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.BuildingBlocks.Application.Security;
using Microsoft.AspNetCore.Http;

namespace IntegratedProcurement.BuildingBlocks.Infrastructure.Security;

public sealed class HttpContextCurrentActor : ICurrentActor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpContextCurrentActor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public CurrentActor Actor
    {
        get
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true)
            {
                return new CurrentActor(
                    ActorType.Anonymous,
                    "anonymous",
                    "Anonymous",
                    [],
                    []);
            }

            var actorType = ResolveActorType(user);
            return new CurrentActor(
                actorType,
                ResolveActorId(user, actorType),
                ResolveDisplayName(user),
                user.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToArray(),
                user.FindAll(AppClaimTypes.Permission).Select(claim => claim.Value).ToArray(),
                user.FindFirstValue(AppClaimTypes.VendorId),
                user.FindFirstValue(AppClaimTypes.VendorUserId));
        }
    }

    private static ActorType ResolveActorType(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue(AppClaimTypes.ActorType);
        return Enum.TryParse<ActorType>(raw, ignoreCase: true, out var actorType)
            ? actorType
            : ActorType.Anonymous;
    }

    private static string ResolveActorId(ClaimsPrincipal user, ActorType actorType)
    {
        return actorType switch
        {
            ActorType.Internal => user.FindFirstValue(AppClaimTypes.PersonnelNo) ?? "internal",
            // Legacy convention: vendor-side audit columns record the VendorId.
            ActorType.Vendor => user.FindFirstValue(AppClaimTypes.VendorId)
                ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? "vendor",
            ActorType.System => "system",
            _ => user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous"
        };
    }

    private static string ResolveDisplayName(ClaimsPrincipal user)
    {
        return user.FindFirstValue(ClaimTypes.Name)
            ?? user.FindFirstValue("name")
            ?? user.Identity?.Name
            ?? "Unknown";
    }
}
