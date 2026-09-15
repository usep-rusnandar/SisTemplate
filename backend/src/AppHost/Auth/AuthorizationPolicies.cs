namespace IntegratedProcurement.AppHost.Api.Auth;

public static class AuthorizationPolicies
{
    public const string InternalUser = "InternalUser";
    public const string FrontendStateUser = "FrontendStateUser";
    public const string PermissionPrefix = "perm:";
    public const string AnyPermissionPrefix = "perm-any:";

    public static string Permission(string permissionKey) => $"{PermissionPrefix}{permissionKey}";

    public static string AnyPermission(params string[] permissionKeys) =>
        $"{AnyPermissionPrefix}{string.Join("|", permissionKeys.Where(key => !string.IsNullOrWhiteSpace(key)))}";
}
