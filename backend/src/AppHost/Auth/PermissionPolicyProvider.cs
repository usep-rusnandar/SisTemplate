using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.AppHost.Api.Auth;

/// <summary>
/// Builds permission policies on demand for any policy name prefixed with
/// <see cref="AuthorizationPolicies.PermissionPrefix"/>, so endpoints can require an arbitrary
/// permission key without registering each policy up front. All other policy names fall through
/// to the default provider.
/// </summary>
public sealed class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider _fallbackPolicyProvider;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallbackPolicyProvider = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() =>
        _fallbackPolicyProvider.GetDefaultPolicyAsync();

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() =>
        _fallbackPolicyProvider.GetFallbackPolicyAsync();

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(AuthorizationPolicies.AnyPermissionPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var permissions = policyName[AuthorizationPolicies.AnyPermissionPrefix.Length..]
                .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new AnyPermissionRequirement(permissions))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        if (policyName.StartsWith(AuthorizationPolicies.PermissionPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var permission = policyName[AuthorizationPolicies.PermissionPrefix.Length..];
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new PermissionRequirement(permission))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return _fallbackPolicyProvider.GetPolicyAsync(policyName);
    }
}
