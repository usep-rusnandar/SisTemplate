using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.BuildingBlocks.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class AuthorizationPoliciesTests
{
    [Fact]
    public void AnyPermissionJoinsKeysWithPipe()
    {
        Assert.Equal(
            "perm-any:contractInitiationPlatform.manage|proposalTracker.manage",
            AuthorizationPolicies.AnyPermission(
                PermissionKeys.ContractInitiationPlatformManage,
                PermissionKeys.ProposalTrackerManage));
    }

    [Fact]
    public void AnyPermissionSkipsBlankKeys()
    {
        Assert.Equal(
            "perm-any:proposalTracker.manage",
            AuthorizationPolicies.AnyPermission(" ", PermissionKeys.ProposalTrackerManage, ""));
    }

    [Fact]
    public void AnyPermissionPrefixIsDistinctFromSinglePermissionPrefix()
    {
        Assert.StartsWith(
            AuthorizationPolicies.AnyPermissionPrefix,
            AuthorizationPolicies.AnyPermission(
                PermissionKeys.ContractInitiationPlatformManage,
                PermissionKeys.ProposalTrackerManage));
        Assert.False(AuthorizationPolicies.AnyPermissionPrefix.StartsWith(
            AuthorizationPolicies.PermissionPrefix,
            StringComparison.Ordinal));
    }
}
