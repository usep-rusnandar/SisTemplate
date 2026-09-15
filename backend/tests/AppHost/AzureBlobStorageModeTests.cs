using SisTemplate.Platform.Documents.Application;

namespace SisTemplate.AppHost.Api.IntegrationTests;

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
        Assert.Equal("app-platform-users", AzureBlobStorageMode.DefaultContainers["platformUser"]);
    }
}
