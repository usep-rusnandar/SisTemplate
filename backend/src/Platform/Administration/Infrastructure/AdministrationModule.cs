using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Platform.Administration.Application;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

/// <summary>
/// Composition for the Administration platform services: configuration (menu tree + settings),
/// email delivery, and the data-retention policy (plus its daily background runner).
/// </summary>
public static class AdministrationModule
{
    public static IServiceCollection AddAdministrationModule(this IServiceCollection services)
    {
        services.AddScoped<IAdminConsoleConfigurationService, AdminConsoleConfigurationService>();
        services.AddScoped<IApplicationAboutService, ApplicationAboutService>();
        services.AddScoped<IAdminConsoleCommunicationService, AdminConsoleCommunicationService>();
        services.AddScoped<IAdminConsoleAccessScope, AdminConsoleAccessScopeService>();
        services.AddScoped<IAdminConsoleIdentityReadService, AdminConsoleIdentityReadService>();
        services.AddScoped<IAdminConsoleMasterDataService, AdminConsoleMasterDataService>();
        services.AddScoped<IAdminConsoleUserManagementService, AdminConsoleUserManagementService>();
        // Holiday-aware working-day math, shared by every module that measures an SLA.
        services.AddScoped<IWorkingDayCalendarProvider, HolidayWorkingDayCalendarProvider>();
        services.AddScoped<IAdminConsoleRoleManagementService, AdminConsoleRoleManagementService>();
        services.AddHttpClient();
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        services.AddSingleton<IBackgroundProcessRuntime, BackgroundProcessRuntimeStore>();
        services.AddScoped<IBackgroundProcessCatalog, BackgroundProcessCatalog>();
        services.AddScoped<IBackgroundProcessSource, WilayahBackgroundProcessSource>();
        services.AddScoped<IBackgroundProcessRunner, WilayahBackgroundProcessRunner>();
        services.AddScoped<IBackgroundProcessSource, RetentionBackgroundProcessSource>();
        services.AddScoped<IBackgroundProcessRunner, RetentionBackgroundProcessRunner>();
        services.AddScoped<IRetentionService, RetentionService>();
        services.AddHostedService<RetentionBackgroundService>();
        // Administrative Regions sync (wilayah.id): shared status/trigger singleton, scoped worker, and
        // the background runner that fires it monthly and on manual request. The singleton is exposed to
        // the API layer through the Application-level IWilayahSyncCoordinator (same instance) so endpoints
        // stay free of Infrastructure types; Infrastructure services keep the concrete type.
        services.AddSingleton<WilayahSyncSignal>();
        services.AddSingleton<IWilayahSyncCoordinator>(provider => provider.GetRequiredService<WilayahSyncSignal>());
        services.AddScoped<IWilayahSyncService, WilayahSyncService>();
        services.AddHostedService<WilayahSyncBackgroundService>();
        return services;
    }
}
