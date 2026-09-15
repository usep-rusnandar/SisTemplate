using IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

namespace IntegratedProcurement.ArchitectureTests;

public sealed class VendorBrandRulesTests
{
    [Fact]
    public void EmptyCollectionIsValid()
    {
        Assert.Empty(VendorBrandRules.Validate(null));
        Assert.Empty(VendorBrandRules.Validate([]));
    }

    [Fact]
    public void CompleteRowIsValid()
    {
        var errors = VendorBrandRules.Validate(
        [
            new VendorBrandInput("SEDUS", "DIST", null),
        ]);

        Assert.Empty(errors);
    }

    [Fact]
    public void BrandNameIsRequired()
    {
        var errors = VendorBrandRules.Validate(
        [
            new VendorBrandInput("  ", "DIST", null),
        ]);

        Assert.Equal(["Brand Name is required."], errors);
    }

    [Fact]
    public void DistributorTypeIsRequiredWhenBrandNameIsPresent()
    {
        var errors = VendorBrandRules.Validate(
        [
            new VendorBrandInput("SEDUS", null, null),
            new VendorBrandInput("ABB", "  ", null),
        ]);

        Assert.Equal(
        [
            "Brand SEDUS: Distributor Type is required.",
            "Brand ABB: Distributor Type is required.",
        ], errors);
    }
}
