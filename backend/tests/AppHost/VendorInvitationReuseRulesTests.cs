using IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorInvitationReuseRulesTests
{
    [Fact]
    public void NewEmailCreatesVendor()
    {
        var action = VendorInvitationReuseRules.Decide(
            identityExists: false,
            hasLogin: false,
            vendorStatus: null);

        Assert.Equal(VendorInvitationBindAction.CreateVendor, action);
    }

    [Theory]
    [InlineData(VendorStatuses.Initial, false)]
    [InlineData(VendorStatuses.Initial, true)]
    [InlineData(VendorStatuses.Invited, false)]
    [InlineData(VendorStatuses.Invited, true)]
    public void InitialOrInvitedReusesVendorEvenIfHasLogin(string status, bool hasLogin)
    {
        var action = VendorInvitationReuseRules.Decide(
            identityExists: true,
            hasLogin: hasLogin,
            vendorStatus: status);

        Assert.Equal(VendorInvitationBindAction.ReuseVendor, action);
    }

    [Theory]
    [InlineData(VendorStatuses.Responded, false)]
    [InlineData(VendorStatuses.Responded, true)]
    [InlineData(VendorStatuses.Draft, false)]
    [InlineData(VendorStatuses.Draft, true)]
    [InlineData(null, false)]
    [InlineData(null, true)]
    public void NonReusableStatusRejects(string? status, bool hasLogin)
    {
        var action = VendorInvitationReuseRules.Decide(
            identityExists: true,
            hasLogin: hasLogin,
            vendorStatus: status);

        Assert.Equal(VendorInvitationBindAction.RejectRegistered, action);
    }
}
