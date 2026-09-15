using SisTemplate.Platform.Persistence.ModuleState;

namespace SisTemplate.ArchitectureTests;

public sealed class ModuleStateJsonTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("[]")]
    [InlineData("[ ]")]
    [InlineData("[1, \"x\"]")]
    public void TreatsBlankOrNonObjectArraysAsEmpty(string? payload)
    {
        Assert.True(ModuleStateJson.IsEmptyArray(payload));
    }

    [Fact]
    public void KeepsArraysThatContainObjects()
    {
        Assert.False(ModuleStateJson.IsEmptyArray("""[{"contractId":"C-1"}]"""));
    }

    [Fact]
    public void DoesNotTreatObjectsOrInvalidJsonAsEmpty()
    {
        Assert.False(ModuleStateJson.IsEmptyArray("""{"cases":[]}"""));
        Assert.False(ModuleStateJson.IsEmptyArray("{not-json"));
    }
}
