using IntegratedProcurement.Platform.Notifications.Application;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Platform.Notifications.Infrastructure;

/// <summary>Composition for the Notifications platform service.</summary>
public static class NotificationsModule
{
    public static IServiceCollection AddNotificationsModule(this IServiceCollection services)
    {
        services.AddScoped<INotificationService, NotificationService>();
        return services;
    }
}
