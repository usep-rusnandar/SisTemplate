using System.Text.Json;
using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class EmailTestRedirectTests
{
    [Fact]
    public void EmptyModuleToTestSendsToRealRecipientEvenWhenGlobalToTestIsSet()
    {
        var settings = Dict(
            ("toTest_vendorWorkspace", ""),
            ("toTest", "it.saptaindra@gmail.com"));

        Assert.Equal(
            "pic@vendor.test",
            EmailTestRedirect.EffectiveTo("pic@vendor.test", settings, "Vendor Workspace"));
        Assert.False(EmailTestRedirect.IsRedirected(settings, "Vendor Workspace"));
    }

    [Fact]
    public void FilledModuleToTestRedirectsOnlyThatModule()
    {
        var settings = Dict(
            ("toTest_vendorWorkspace", "qa@sis.test"),
            ("toTest_users", ""),
            ("toTest", "it.saptaindra@gmail.com"));

        Assert.Equal("qa@sis.test", EmailTestRedirect.EffectiveTo("pic@vendor.test", settings, "Vendor Workspace"));
        Assert.Equal("usep@sis.test", EmailTestRedirect.EffectiveTo("usep@sis.test", settings, "Users"));
        Assert.True(EmailTestRedirect.IsRedirected(settings, "Vendor Workspace"));
        Assert.False(EmailTestRedirect.IsRedirected(settings, "Users"));
    }

    [Fact]
    public void InternalUsersIgnoresObsoleteGlobalToTest()
    {
        var settings = Dict(("toTest", "it.saptaindra@gmail.com"));

        Assert.Equal(
            "usep.rusnandar@saptaindra.co.id",
            EmailTestRedirect.EffectiveTo("usep.rusnandar@saptaindra.co.id", settings, "Users"));
        Assert.Null(EmailTestRedirect.TestAddress(settings, "Users"));
    }

    [Fact]
    public void UnknownCategoryNeverUsesGlobalToTest()
    {
        var settings = Dict(("toTest", "it.saptaindra@gmail.com"));

        Assert.Equal("real@sis.test", EmailTestRedirect.EffectiveTo("real@sis.test", settings, "Settings"));
        Assert.Null(EmailTestRedirect.ModuleSlugForCategory("Settings"));
    }

    [Fact]
    public void UsersSlugIsUsers() =>
        Assert.Equal("users", EmailTestRedirect.ModuleSlugForCategory("Users"));

    private static Dictionary<string, JsonElement> Dict(params (string Key, string Value)[] pairs)
    {
        var values = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in pairs)
        {
            values[key] = JsonSerializer.SerializeToElement(value);
        }

        return values;
    }
}
