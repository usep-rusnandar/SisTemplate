using IntegratedProcurement.Platform.Persistence.Identity;
using IntegratedProcurement.Platform.VendorIdentity.Application;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Platform.VendorIdentity.Infrastructure;

public static class VendorIdentityModule
{
    public static IServiceCollection AddVendorIdentityModule(this IServiceCollection services)
    {
        services.AddScoped<IVendorAuthService, VendorAuthService>();
        services.AddScoped<IVendorAccountAdminService, VendorAccountAdminService>();
        services.AddScoped<IPasswordValidator<VendorIdentityUser>, SettingsVendorPasswordValidator>();
        return services;
    }
}
