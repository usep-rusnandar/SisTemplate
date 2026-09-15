using SisTemplate.Platform.InternalIdentity.Application.Access;
using SisTemplate.Platform.InternalIdentity.Application.Auth;
using SisTemplate.Platform.InternalIdentity.Application.Directory;
using SisTemplate.Platform.InternalIdentity.Application.Profiles;
using SisTemplate.Platform.InternalIdentity.Application.Sso;
using SisTemplate.Platform.InternalIdentity.Domain;
using SisTemplate.Platform.InternalIdentity.Infrastructure.Access;
using SisTemplate.Platform.InternalIdentity.Infrastructure.Auth;
using SisTemplate.Platform.InternalIdentity.Infrastructure.Directory;
using SisTemplate.Platform.InternalIdentity.Infrastructure.Profiles;
using SisTemplate.Platform.InternalIdentity.Infrastructure.Sso;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace SisTemplate.Platform.InternalIdentity.Infrastructure;

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
