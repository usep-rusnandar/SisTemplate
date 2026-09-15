using IntegratedProcurement.Platform.Persistence.ModuleState;
using Microsoft.AspNetCore.Mvc;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

internal static class ModuleStateEndpointConventions
{
    public static RouteGroupBuilder MapModuleStorageEndpoints(
        this RouteGroupBuilder group,
        ModuleStateArea area)
    {
        group.MapGet("/storage", async (
            ModuleStateStore store,
            CancellationToken cancellationToken) =>
        {
            var result = await store.ListAsync(area, cancellationToken);
            return Results.Ok(new ModuleStateListResponse(result));
        });

        // Query-string item routes: storage keys include encoded proposal ids with '/'
        // (e.g. ag_tracker_activity_notes_v1:2026%2F...). Putting that in a path segment
        // 404s on Azure/IIS after percent-decoding, so notes/docs never persist.
        group.MapGet("/storage/item", async (
            [FromQuery] string key,
            ModuleStateStore store,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { code = "module_state_key_required" });
            }

            var result = await store.GetAsync(area, key, cancellationToken);
            return result is null
                ? Results.NotFound(new { code = "module_state_not_found", key })
                : Results.Ok(result);
        });

        group.MapPut("/storage/item", async Task<IResult> (
            [FromQuery] string key,
            ModuleStateUpsertRequest request,
            ModuleStateStore store,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { code = "module_state_key_required" });
            }

            var item = await store.SetAsync(area, key, request.Value, cancellationToken);
            return Results.Ok(item);
        });

        group.MapDelete("/storage/item", async (
            [FromQuery] string key,
            ModuleStateStore store,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { code = "module_state_key_required" });
            }

            await store.RemoveAsync(area, key, cancellationToken);
            return Results.NoContent();
        });

        group.MapGet("/storage/{key}", async (
            string key,
            ModuleStateStore store,
            CancellationToken cancellationToken) =>
        {
            var result = await store.GetAsync(area, key, cancellationToken);
            return result is null
                ? Results.NotFound(new { code = "module_state_not_found", key })
                : Results.Ok(result);
        });

        group.MapPut("/storage/{key}", async Task<IResult> (
            string key,
            ModuleStateUpsertRequest request,
            ModuleStateStore store,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { code = "module_state_key_required" });
            }

            var item = await store.SetAsync(area, key, request.Value, cancellationToken);
            return Results.Ok(item);
        });

        group.MapDelete("/storage/{key}", async (
            string key,
            ModuleStateStore store,
            CancellationToken cancellationToken) =>
        {
            await store.RemoveAsync(area, key, cancellationToken);
            return Results.NoContent();
        });

        group.MapDelete("/storage", async (
            ModuleStateStore store,
            CancellationToken cancellationToken) =>
        {
            await store.ClearAsync(area, cancellationToken);
            return Results.NoContent();
        });

        return group;
    }
}

internal sealed record ModuleStateListResponse(IReadOnlyCollection<ModuleStateItem> Items);

internal sealed record ModuleStateUpsertRequest(string? Value);
