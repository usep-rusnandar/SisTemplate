using SisTemplate.BuildingBlocks.Application.Abstractions;
using SisTemplate.BuildingBlocks.Infrastructure.Security;
using SisTemplate.BuildingBlocks.Infrastructure.Time;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace SisTemplate.BuildingBlocks.Infrastructure;

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
