using IntegratedProcurement.Modules.ContractInitiationPlatform.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Modules.ContractMonitoring.Infrastructure;

/// <summary>
/// Composition for the Contract Monitoring module: registers the module's data-access
/// implementations behind their Domain-owned interfaces, plus its Application use-cases.
/// </summary>
public static class ContractMonitoringModule
{
    public static IServiceCollection AddContractMonitoringModule(this IServiceCollection services)
    {
        services.AddScoped<IContractRepository, ContractRepository>();
        services.AddScoped<IImportJobRepository, ImportJobRepository>();
        services.AddScoped<IContractMaterialRepository, ContractMaterialRepository>();
        services.AddScoped<IContractMonitoringHandoffPort, ContractMonitoringHandoffAdapter>();
        services.AddScoped<ContractReminderService>();
        services.AddScoped<IContractReminderMailer, ContractReminderMailer>();
        services.AddScoped<ContractImportService>();
        services.AddScoped<ContractMaterialService>();
        services.AddScoped<MaterialFolderSyncService>();
        services.AddScoped<ImportJobService>();
        services.AddScoped<ImportJobProcessor>();
        return services;
    }
}
