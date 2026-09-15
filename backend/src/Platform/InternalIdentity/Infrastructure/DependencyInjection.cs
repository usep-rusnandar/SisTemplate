using IntegratedProcurement.Platform.InternalIdentity.Application.Access;
using IntegratedProcurement.Platform.InternalIdentity.Application.Auth;
using IntegratedProcurement.Platform.InternalIdentity.Application.Directory;
using IntegratedProcurement.Platform.InternalIdentity.Application.Profiles;
using IntegratedProcurement.Platform.InternalIdentity.Application.Sso;
using IntegratedProcurement.Platform.InternalIdentity.Domain;
using IntegratedProcurement.Platform.InternalIdentity.Infrastructure.Access;
using IntegratedProcurement.Platform.InternalIdentity.Infrastructure.Auth;
using IntegratedProcurement.Platform.InternalIdentity.Infrastructure.Directory;
using IntegratedProcurement.Platform.InternalIdentity.Infrastructure.Profiles;
using IntegratedProcurement.Platform.InternalIdentity.Infrastructure.Sso;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Platform.InternalIdentity.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInternalIdentityInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<ISsoJwtHelper, SsoJwtHelper>();
        services.AddScoped<IInternalUserAccessService, InternalUserAccessService>();
        services.AddScoped<IInternalUserProfileReader, InternalUserProfileReader>();
        services.AddScoped<IInternalDirectoryReadPort, InternalDirectoryReadPort>();
        services.AddScoped<ISsoPersonnelMapper, InternalUserAccessService>();
        services.AddScoped<IPasswordHasher<InternalUser>, PasswordHasher<InternalUser>>();
        services.AddScoped<IInternalLocalAuthService, InternalLocalAuthService>();
        return services;
    }

    public static IApplicationBuilder UseInternalSso(this IApplicationBuilder app)
    {
        return app.UseMiddleware<SsoMiddleware>();
    }
}
