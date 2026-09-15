using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorRegistrySortTests
{
    [Theory]
    [InlineData("name", "asc", true, "name", false)]
    [InlineData("NAME", "DESC", true, "name", true)]
    [InlineData("statusDescription", "desc", true, "statusDescription", true)]
    [InlineData("picName", null, true, "picName", false)]
    [InlineData("commodityCodes", "asc", true, "commodityCodes", false)]
    [InlineData("not-a-column", "asc", false, "", true)]
    [InlineData(null, "desc", false, "", true)]
    [InlineData(" ", "asc", false, "", true)]
    public void TryNormalizeAcceptsKnownColumns(
        string? sortBy,
        string? sortDir,
        bool expectedOk,
        string expectedKey,
        bool expectedDescending)
    {
        var ok = VendorRegistrySort.TryNormalize(sortBy, sortDir, out var key, out var descending);
        Assert.Equal(expectedOk, ok);
        Assert.Equal(expectedKey, key);
        Assert.Equal(expectedDescending, descending);
    }

    [Fact]
    public void KeysCoverTheVendorDatabaseGrid()
    {
        Assert.Equal(26, VendorRegistrySort.Keys.Count);
        Assert.Contains(VendorRegistrySort.Name, VendorRegistrySort.Keys);
        Assert.Contains(VendorRegistrySort.CertificateDescriptions, VendorRegistrySort.Keys);
        Assert.Equal(VendorRegistrySort.Keys.Count, VendorRegistrySort.Keys.Distinct(StringComparer.OrdinalIgnoreCase).Count());
    }
}
