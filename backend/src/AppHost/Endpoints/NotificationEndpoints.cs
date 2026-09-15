using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.Platform.Notifications.Application;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Any authenticated internal user may read and manage their own notification state.
        var group = endpoints.MapGroup("/api/v1/notifications")
            .WithTags("Notifications")
            .RequireAuthorization(AuthorizationPolicies.InternalUser);

        group.MapGet("/", async (INotificationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetForCurrentActorAsync(cancellationToken)));

        group.MapPost("/{id}/read", async (string id, INotificationService service, CancellationToken cancellationToken) =>
            await MutateAsync(id, service.MarkReadAsync, cancellationToken));

        group.MapPost("/{id}/unread", async (string id, INotificationService service, CancellationToken cancellationToken) =>
            await MutateAsync(id, service.MarkUnreadAsync, cancellationToken));

        group.MapPost("/read-all", async (INotificationService service, CancellationToken cancellationToken) =>
            Results.Ok(new { updated = await service.MarkAllReadAsync(cancellationToken) }));

        group.MapDelete("/{id}", async (string id, INotificationService service, CancellationToken cancellationToken) =>
            await MutateAsync(id, service.DismissAsync, cancellationToken));

        return endpoints;
    }

    private static async Task<IResult> MutateAsync(
        string id,
        Func<Guid, CancellationToken, Task<bool>> action,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(id, out var notificationId))
        {
            return Results.NotFound(new { code = "notification_not_found" });
        }

        var applied = await action(notificationId, cancellationToken);
        return applied
            ? Results.NoContent()
            : Results.NotFound(new { code = "notification_not_found" });
    }
}
