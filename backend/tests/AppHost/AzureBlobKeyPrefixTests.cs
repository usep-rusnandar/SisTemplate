using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class AzureBlobKeyPrefixTests
{
    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("  ", "")]
    [InlineData("dev", "dev")]
    [InlineData("/staging/", "staging")]
    [InlineData("  staging  ", "staging")]
    public void NormalizeStripsSlashesAndWhitespace(string? prefix, string expected)
        => Assert.Equal(expected, AzureBlobKeyPrefix.Normalize(prefix));

    [Theory]
    [InlineData("dev", "Development")]
    [InlineData("dev", "development")]
    [InlineData("staging", "Staging")]
    [InlineData("staging", "staging")]
    public void ResolveUsesHostEnvironmentWhenConfigIsEmpty(string expected, string environment)
        => Assert.Equal(expected, AzureBlobKeyPrefix.Resolve(null, environment));

    [Fact]
    public void ResolveLeavesProductionUnprefixed()
        => Assert.Equal(string.Empty, AzureBlobKeyPrefix.Resolve(null, "Production"));

    [Fact]
    public void ResolvePrefersConfiguredPrefix()
        => Assert.Equal("staging", AzureBlobKeyPrefix.Resolve("/staging/", "Development"));

    [Theory]
    [InlineData(null, "vendors/V001/doc.pdf", "vendors/V001/doc.pdf")]
    [InlineData("", "vendors/V001/doc.pdf", "vendors/V001/doc.pdf")]
    [InlineData("dev", "vendors/V001/doc.pdf", "dev/vendors/V001/doc.pdf")]
    [InlineData("staging", "/vendors/V001/doc.pdf", "staging/vendors/V001/doc.pdf")]
    [InlineData("dev", "dev/vendors/V001/doc.pdf", "dev/vendors/V001/doc.pdf")]
    [InlineData("DEV", "dev/vendors/V001/doc.pdf", "dev/vendors/V001/doc.pdf")]
    public void ApplyPrefixesWithoutDoubling(string? prefix, string blobKey, string expected)
        => Assert.Equal(expected, AzureBlobKeyPrefix.Apply(prefix, blobKey));

    [Fact]
    public void ApplyDoesNotPrefixVendorOwnershipKeysIntoTheStoredShape()
    {
        // Callers (and the DB) keep the unprefixed key so vendor portal can check
        // blobKey.StartsWith(vendorId + "/"). Isolation happens only in storage.
        var stored = "GOBEL0001/siup/file.pdf";
        Assert.Equal("dev/GOBEL0001/siup/file.pdf", AzureBlobKeyPrefix.Apply("dev", stored));
        Assert.StartsWith("GOBEL0001/", stored, StringComparison.Ordinal);
    }
}
