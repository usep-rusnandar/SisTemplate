using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.BuildingBlocks.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class AuthorizationPoliciesTests
{
    [Fact]
    public void AnyPermissionJoinsKeysWithPipe()
    {
        Assert.Equal(
            "perm-any:settings.update|audit.export",
            AuthorizationPolicies.AnyPermission(
                PermissionKeys.SettingsUpdate,
                PermissionKeys.AuditExport));
    }

    [Fact]
    public void AnyPermissionSkipsBlankKeys()
    {
        Assert.Equal(
            "perm-any:audit.export",
            AuthorizationPolicies.AnyPermission(" ", PermissionKeys.AuditExport, ""));
    }

    [Fact]
    public void AnyPermissionPrefixIsDistinctFromSinglePermissionPrefix()
    {
        Assert.StartsWith(
            AuthorizationPolicies.AnyPermissionPrefix,
            AuthorizationPolicies.AnyPermission(
                PermissionKeys.SettingsUpdate,
                PermissionKeys.AuditExport));
        Assert.False(AuthorizationPolicies.AnyPermissionPrefix.StartsWith(
            AuthorizationPolicies.PermissionPrefix,
            StringComparison.Ordinal));
    }
}
