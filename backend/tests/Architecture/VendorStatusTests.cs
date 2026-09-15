using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.ArchitectureTests;

public sealed class VendorStatusTests
{
    [Fact]
    public void ApplicationWritesInitialStatusForImportedVendors()
    {
        Assert.Equal("INITL", VendorStatuses.Initial);
        Assert.Contains(VendorStatuses.Initial, VendorStatuses.All);
        Assert.True(VendorStatuses.AllowsOfficerReinvite(VendorStatuses.Initial));
        Assert.False(VendorStatuses.AllowsOfficerReinvite(VendorStatuses.Draft));
        Assert.False(VendorStatuses.AllowsOfficerReinvite(VendorStatuses.Invited));
    }

    [Fact]
    public void OfficerInviteReuseAllowsInitialAndInvitedOnly()
    {
        Assert.True(VendorStatuses.AllowsOfficerInviteReuse(VendorStatuses.Initial));
        Assert.True(VendorStatuses.AllowsOfficerInviteReuse(VendorStatuses.Invited));
        Assert.False(VendorStatuses.AllowsOfficerInviteReuse(VendorStatuses.Responded));
        Assert.False(VendorStatuses.AllowsOfficerInviteReuse(VendorStatuses.Draft));
        Assert.False(VendorStatuses.AllowsOfficerInviteReuse(null));
    }

    [Fact]
    public void InviteFactoryStartsAsInvited()
    {
        var vendor = Vendor.Invite("PT UNDANGAN BARU", actor: "00109610");
        Assert.Equal(VendorStatuses.Invited, vendor.Status);
        Assert.Equal("PT UNDANGAN BARU", vendor.Name);
        Assert.Single(vendor.StatusHistory);
        Assert.Equal(VendorStatuses.Invited, vendor.StatusHistory.Single().StatusCode);
    }

    [Fact]
    public void InitialIsNotSubmittableUntilTheVendorIsInvited()
    {
        Assert.False(VendorStatuses.IsSubmittableFrom(VendorStatuses.Initial));
        Assert.True(VendorStatuses.IsSubmittableFrom(VendorStatuses.Invited));
    }
}
