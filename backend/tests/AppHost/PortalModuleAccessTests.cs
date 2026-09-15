using IntegratedProcurement.BuildingBlocks.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class PortalModuleAccessTests
{
    [Theory]
    [InlineData("proposalTracker.view")]
    [InlineData("contractInitiationPlatform.view")]
    public void TrackerPortalAcceptsTrackerOrCipModulePermission(string permission)
    {
        Assert.True(PortalModuleAccess.HasAccess([permission], ModuleKeys.ProposalTracker));
    }

    [Fact]
    public void RetiredCipPortalHeaderAliasesToProposalTracker()
    {
        Assert.Equal(
            ModuleKeys.ProposalTracker,
            PortalModuleAccess.ResolveGatedModuleKey("contract-initiation-platform"));
        Assert.Equal(
            ModuleKeys.ProposalTracker,
            PortalModuleAccess.ResolveGatedModuleKey("proposal-tracker"));
        Assert.Null(PortalModuleAccess.ResolveGatedModuleKey(null));
        Assert.Null(PortalModuleAccess.ResolveGatedModuleKey("suite"));
    }

    [Fact]
    public void ContractMonitoringPortalStillRejectsTrackerPermissions()
    {
        Assert.False(PortalModuleAccess.HasAccess(
            ["proposalTracker.view", "contractInitiationPlatform.manage"],
            ModuleKeys.ContractMonitoring));
        Assert.True(PortalModuleAccess.HasAccess(
            ["contractMonitoring.view"],
            ModuleKeys.ContractMonitoring));
    }
}
