namespace IntegratedProcurement.AppHost.Api.Auth;

public static class AuthorizationPolicies
{
    public const string InternalUser = "InternalUser";
    public const string VendorUser = "VendorUser";

    /// <summary>
    /// Shared frontend key-value state: any authenticated actor (internal SSO principal or
    /// vendor identity cookie) may read and write; bulk clear additionally requires
    /// <see cref="InternalUser"/>.
    /// </summary>
    public const string FrontendStateUser = "FrontendStateUser";

    /// <summary>
    /// Prefix used for dynamically-built permission policies (see <see cref="PermissionPolicyProvider"/>).
    /// </summary>
    public const string PermissionPrefix = "perm:";
    public const string AnyPermissionPrefix = "perm-any:";

    /// <summary>
    /// Builds the policy name that enforces a single internal permission key.
    /// </summary>
    public static string Permission(string permissionKey) => $"{PermissionPrefix}{permissionKey}";

    /// <summary>Satisfied when the actor holds any of the listed permission keys.</summary>
    public static string AnyPermission(params string[] permissionKeys) =>
        $"{AnyPermissionPrefix}{string.Join("|", permissionKeys.Where(key => !string.IsNullOrWhiteSpace(key)))}";
}
