using SisTemplate.AppHost.Api.Auth;
using SisTemplate.Platform.Persistence.FrontendState;
using Microsoft.AspNetCore.Mvc;

namespace SisTemplate.AppHost.Api.Endpoints;

public static class FrontendStateEndpoints
{
    public static IEndpointRouteBuilder MapFrontendStateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/frontend-state")
            .WithTags("Frontend State")
            .RequireAuthorization(AuthorizationPolicies.FrontendStateUser);

        group.MapGet("/", async (
            string? scope,
            FrontendStateStore store,
            CancellationToken cancellationToken) =>
        {
            var result = await store.ListAsync(NormalizeScope(scope), cancellationToken);
            return Results.Ok(new FrontendStateListResponse(result));
        });

        // Query-string item routes keep keys with '/' or encoded slashes intact (Azure/IIS path decode).
        group.MapPut("/item", async Task<IResult> (
            [FromQuery] string key,
            string? scope,
            FrontendStateUpsertRequest request,
            FrontendStateStore store,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { code = "frontend_state_key_required" });
            }

            var item = await store.SetAsync(NormalizeScope(scope), key, request.Value, cancellationToken);
            return Results.Ok(item);
        });

        group.MapDelete("/item", async (
            [FromQuery] string key,
            string? scope,
            FrontendStateStore store,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { code = "frontend_state_key_required" });
            }

            await store.RemoveAsync(NormalizeScope(scope), key, cancellationToken);
            return Results.NoContent();
        });

        group.MapPut("/{key}", async Task<IResult> (
            string key,
            string? scope,
            FrontendStateUpsertRequest request,
            FrontendStateStore store,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { code = "frontend_state_key_required" });
            }

            var item = await store.SetAsync(NormalizeScope(scope), key, request.Value, cancellationToken);
            return Results.Ok(item);
        });

        group.MapDelete("/{key}", async (
            string key,
            string? scope,
            FrontendStateStore store,
            CancellationToken cancellationToken) =>
        {
            await store.RemoveAsync(NormalizeScope(scope), key, cancellationToken);
            return Results.NoContent();
        });

        // Clearing wipes the whole shared scope for every user, so vendors may not do it.
        group.MapDelete("/", async (
            string? scope,
            FrontendStateStore store,
            CancellationToken cancellationToken) =>
        {
            await store.ClearAsync(NormalizeScope(scope), cancellationToken);
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.InternalUser);

        return endpoints;
    }

    private static string NormalizeScope(string? scope) =>
        string.IsNullOrWhiteSpace(scope) ? FrontendStateStore.DefaultScope : scope.Trim().ToLowerInvariant();
}

public sealed record FrontendStateListResponse(IReadOnlyCollection<FrontendStateItem> Items);

public sealed record FrontendStateUpsertRequest(string? Value);
