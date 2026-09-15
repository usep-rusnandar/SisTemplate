using SisTemplate.Platform.Administration.Application;

namespace SisTemplate.ArchitectureTests;

public sealed class EmailTemplateCategoryMergeTests
{
    private const string Cm = EmailTemplateCategoryMerge.ContractMonitoringCategory;

    [Fact]
    public void ForcesCategoryAndKeepsRequestedId()
    {
        var prepared = EmailTemplateCategoryMerge.Prepare(
            [new KeyedJsonItem("ET-11", """{"id":"ET-11","category":"Vendor Onboarding","name":"Expiry"}""")],
            ["ET-01"],
            Cm);

        var item = Assert.Single(prepared);
        Assert.Equal("ET-11", item.Key);
        Assert.Contains("\"category\":\"Contract Monitoring\"", item.PayloadJson, StringComparison.Ordinal);
        Assert.Contains("\"id\":\"ET-11\"", item.PayloadJson, StringComparison.Ordinal);
        Assert.DoesNotContain("Vendor Onboarding", item.PayloadJson, StringComparison.Ordinal);
    }

    [Fact]
    public void RewritesIdThatCollidesWithAnotherCategory()
    {
        var prepared = EmailTemplateCategoryMerge.Prepare(
            [new KeyedJsonItem("ET-01", """{"id":"ET-01","category":"Contract Monitoring","name":"Copy"}""")],
            ["ET-01", "ET-02"],
            Cm);

        var item = Assert.Single(prepared);
        Assert.Equal("ET-CM-0001", item.Key);
        Assert.Contains("\"id\":\"ET-CM-0001\"", item.PayloadJson, StringComparison.Ordinal);
        Assert.Contains($"\"category\":\"{Cm}\"", item.PayloadJson, StringComparison.Ordinal);
    }

    [Fact]
    public void RewritesDuplicateIncomingIds()
    {
        var prepared = EmailTemplateCategoryMerge.Prepare(
            [
                new KeyedJsonItem("ET-11", """{"id":"ET-11"}"""),
                new KeyedJsonItem("ET-11", """{"id":"ET-11"}"""),
            ],
            [],
            Cm);

        Assert.Equal(["ET-11", "ET-CM-0001"], prepared.Select(item => item.Key));
    }

    [Fact]
    public void AssignsIdWhenIncomingKeyIsBlank()
    {
        var prepared = EmailTemplateCategoryMerge.Prepare(
            [new KeyedJsonItem("  ", "{}")],
            [],
            Cm);

        Assert.Equal("ET-CM-0001", Assert.Single(prepared).Key);
    }

    [Fact]
    public void MatchesCategoryIgnoresCaseAndPadding()
    {
        Assert.True(EmailTemplateCategoryMerge.MatchesCategory("  contract monitoring ", Cm));
        Assert.False(EmailTemplateCategoryMerge.MatchesCategory("Vendor Onboarding", Cm));
    }
}
