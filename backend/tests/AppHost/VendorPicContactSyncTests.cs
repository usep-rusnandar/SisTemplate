using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorPicContactSyncTests
{
    [Fact]
    public void ApplyWorkspacePicContactCopiesPositionAndMobileAndPreservesOfficePhone()
    {
        var vendor = Vendor.Register("PT PIC SYNC", VendorStatuses.Registered, "test");
        vendor.UpdateContact("Old Job", "+62", "21", "5551234", "+62", "0811000000", "https://vendor.test");

        vendor.ApplyWorkspacePicContact("Sales Manager", "0812 3456 7890");

        Assert.Equal("Sales Manager", vendor.Position);
        Assert.Equal("0812 3456 7890", vendor.HandphoneNumber);
        Assert.Null(vendor.HandphoneCountry);
        Assert.Equal("+62", vendor.OfficePhoneCountry);
        Assert.Equal("21", vendor.OfficePhoneArea);
        Assert.Equal("5551234", vendor.OfficePhoneNumber);
        Assert.Equal("https://vendor.test", vendor.WebAddress);
    }

    [Fact]
    public void ApplyWorkspacePicContactClearsBlankFieldsAndTruncatesLongMobile()
    {
        var vendor = Vendor.Register("PT PIC CLEAR", VendorStatuses.Draft, "test");
        vendor.UpdateContact("Kept Until Sync", null, null, null, "+62", "0811", null);

        vendor.ApplyWorkspacePicContact("  ", "12345678901234567890123");

        Assert.Null(vendor.Position);
        Assert.Equal("12345678901234567890", vendor.HandphoneNumber);
        Assert.Null(vendor.HandphoneCountry);
    }
}
