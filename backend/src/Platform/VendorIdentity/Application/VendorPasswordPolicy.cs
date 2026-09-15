using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.Platform.VendorIdentity.Application;

/// <summary>
/// Vendor-facing alias for the shared Super Admin password-complexity policy.
/// </summary>
public sealed record VendorPasswordPolicy(
    int MinLength,
    bool RequireDigit,
    bool RequireLowercase,
    bool RequireUppercase,
    bool RequireNonAlphanumeric)
{
    public static readonly VendorPasswordPolicy Default = From(AccountPasswordPolicy.Default);

    public static async Task<VendorPasswordPolicy> ResolveAsync(
        IAdminConsoleConfigurationService configurationService,
        CancellationToken cancellationToken) =>
        From(await AccountPasswordPolicy.ResolveAsync(configurationService, cancellationToken));

    private static VendorPasswordPolicy From(AccountPasswordPolicy policy) =>
        new(
            policy.MinLength,
            policy.RequireDigit,
            policy.RequireLowercase,
            policy.RequireUppercase,
            policy.RequireNonAlphanumeric);
}
