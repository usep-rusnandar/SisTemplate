using IntegratedProcurement.Platform.Audit.Application;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Platform.Audit.Infrastructure;

/// <summary>Composition for the Audit platform service.</summary>
public static class AuditModule
{
    public static IServiceCollection AddAuditModule(this IServiceCollection services)
    {
        services.AddScoped<IAuditTrail, AuditTrail>();
        return services;
    }
}
