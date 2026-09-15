using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class AzureBlobStorageModeTests
{
    [Theory]
    [InlineData(null, "Development", true)]
    [InlineData(null, "development", true)]
    [InlineData(true, "Development", true)]
    [InlineData(false, "Development", false)]
    [InlineData(null, "Staging", false)]
    [InlineData(true, "Staging", false)]
    [InlineData(true, "Production", false)]
    [InlineData(false, "Production", false)]
    [InlineData(null, "Production", false)]
    public void ShouldUseLocalIsDevelopmentOnly(bool? configured, string environment, bool expected)
        => Assert.Equal(expected, AzureBlobStorageMode.ShouldUseLocal(configured, environment));

    [Fact]
    public void DefaultContainersCoverEveryModule()
    {
        Assert.Equal("app-proposaltracker", AzureBlobStorageMode.DefaultContainers["proposalTracker"]);
        Assert.Equal("app-contractmanagement", AzureBlobStorageMode.DefaultContainers["contractInitiationPlatform"]);
        Assert.Equal("app-vendormanagement", AzureBlobStorageMode.DefaultContainers["vendorOnboarding"]);
        Assert.Equal("app-platform-users", AzureBlobStorageMode.DefaultContainers["platformUser"]);
    }
}
