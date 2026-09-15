using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.BuildingBlocks.Infrastructure.Security;
using IntegratedProcurement.BuildingBlocks.Infrastructure.Time;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.BuildingBlocks.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddBuildingBlocksInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        services.AddScoped<ICurrentActor, HttpContextCurrentActor>();
        services.AddSingleton<IClock, SystemClock>();
        return services;
    }
}
