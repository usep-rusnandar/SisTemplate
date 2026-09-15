using IntegratedProcurement.Modules.ContractInitiationPlatform.Application;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Infrastructure;

/// <summary>
/// Composition for the Contract Initiation Platform module: registers its data-access
/// implementation behind the Domain-owned repository port, plus its Application use-cases. The
/// cross-module Tracker LOA read-port is registered by the Proposal Tracker module.
/// </summary>
public static class CipModule
{
    public static IServiceCollection AddCipModule(this IServiceCollection services)
    {
        services.AddScoped<ICipRepository, CipRepository>();
        services.AddScoped<CipCaseService>();
        services.AddScoped<ICipTermSheetReadPort>(sp => sp.GetRequiredService<CipCaseService>());
        return services;
    }
}
