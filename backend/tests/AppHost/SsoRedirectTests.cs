using SisTemplate.Platform.InternalIdentity.Application.Sso;
using SisTemplate.Platform.InternalIdentity.Infrastructure.Sso;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace SisTemplate.AppHost.Api.IntegrationTests;

/// <summary>
/// Pure unit tests for per-host SISWarrior <c>redirectUrl</c> resolution. No database.
/// </summary>
public sealed class SsoRedirectTests
{
    private static readonly SsoOptions Staging = new()
    {
        Enabled = true,
        SsoUrl = "https://app-saptaindra.msappproxy.net/SISApps-Test/auth/redirect",
        ApplicationUrl = "https://contractone-staging.azurewebsites.net/",
        Application = "Contract One",
        AllowedApplicationUrls =
        [
            "https://contractone-staging.azurewebsites.net/",
            "https://proposal-tracker-staging.azurewebsites.net/",
            "https://vendor-onboarding-staging.azurewebsites.net/",
            "https://contract-monitoring-staging.azurewebsites.net/",
        ],
    };

    [Fact]
    public void ResolveWithoutRequestUsesApplicationUrl()
    {
        Assert.Equal(
            "https://contractone-staging.azurewebsites.net/",
            SsoRedirect.ResolveApplicationUrl(Staging));
    }

    [Fact]
    public void ResolveMatchesPortalHostFromRequestHost()
    {
        var request = new DefaultHttpContext().Request;
        request.Scheme = "https";
        request.Host = new HostString("proposal-tracker-staging.azurewebsites.net");

        Assert.Equal(
            "https://proposal-tracker-staging.azurewebsites.net/",
            SsoRedirect.ResolveApplicationUrl(Staging, request));
    }

    [Fact]
    public void ResolvePrefersForwardedHostOverRequestHost()
    {
        var request = new DefaultHttpContext().Request;
        request.Scheme = "https";
        request.Host = new HostString("contractone-staging.azurewebsites.net");
        request.Headers["X-Forwarded-Host"] = "vendor-onboarding-staging.azurewebsites.net";

        Assert.Equal(
            "https://vendor-onboarding-staging.azurewebsites.net/",
            SsoRedirect.ResolveApplicationUrl(Staging, request));
    }

    [Fact]
    public void ResolveIgnoresUnknownHost()
    {
        var request = new DefaultHttpContext().Request;
        request.Scheme = "https";
        request.Host = new HostString("evil.example");
        request.Headers["X-Forwarded-Host"] = "evil.example";

        Assert.Equal(
            "https://contractone-staging.azurewebsites.net/",
            SsoRedirect.ResolveApplicationUrl(Staging, request));
    }

    [Fact]
    public void ResolveMatchesAllowlistWhenIncomingSchemeIsHttp()
    {
        var request = new DefaultHttpContext().Request;
        request.Scheme = "http";
        request.Host = new HostString("contract-monitoring-staging.azurewebsites.net");

        Assert.Equal(
            "https://contract-monitoring-staging.azurewebsites.net/",
            SsoRedirect.ResolveApplicationUrl(Staging, request));
    }

    [Fact]
    public void ResolveIsCaseInsensitive()
    {
        var request = new DefaultHttpContext().Request;
        request.Host = new HostString("Proposal-Tracker-Staging.Azurewebsites.net");

        Assert.Equal(
            "https://proposal-tracker-staging.azurewebsites.net/",
            SsoRedirect.ResolveApplicationUrl(Staging, request));
    }

    [Fact]
    public void EnumerateDedupesApplicationUrl()
    {
        var urls = SsoRedirect.EnumerateAllowedApplicationUrls(Staging);
        Assert.Equal(4, urls.Count);
        Assert.Equal("https://contractone-staging.azurewebsites.net/", urls[0]);
    }

    [Fact]
    public void BuildLoginUrlIncludesApplicationAndResolvedHost()
    {
        var request = new DefaultHttpContext().Request;
        request.Host = new HostString("proposal-tracker-staging.azurewebsites.net");

        var url = SsoRedirect.BuildSisWarriorLoginUrl(Staging, request);
        Assert.StartsWith(Staging.SsoUrl, url, StringComparison.Ordinal);
        Assert.Contains("application=Contract%20One", url, StringComparison.Ordinal);
        Assert.Contains(
            Uri.EscapeDataString("https://proposal-tracker-staging.azurewebsites.net/"),
            url,
            StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/proposals", true)]
    [InlineData("/proposal-tracker/proposals?x=1", true)]
    [InlineData("/#hash", true)]
    [InlineData("//evil.example", false)]
    [InlineData("https://evil.example/", false)]
    [InlineData("/\\evil", false)]
    [InlineData("proposals", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void SafeRelativeReturnPath(string? value, bool expected)
    {
        Assert.Equal(expected, SsoRedirect.IsSafeRelativeReturnPath(value));
    }

    [Fact]
    public void ConfigurationBinderReadsAllowedApplicationUrls()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["SSO:ApplicationUrl"] = "https://contractone-staging.azurewebsites.net/",
                ["SSO:AllowedApplicationUrls:0"] = "https://proposal-tracker-staging.azurewebsites.net/",
                ["SSO:AllowedApplicationUrls:1"] = "https://vendor-onboarding-staging.azurewebsites.net/",
            })
            .Build();

        var options = config.GetSection("SSO").Get<SsoOptions>();
        Assert.NotNull(options);
        var urls = SsoRedirect.EnumerateAllowedApplicationUrls(options);
        Assert.Equal(3, urls.Count);
        Assert.Contains("https://proposal-tracker-staging.azurewebsites.net/", urls);
    }

    [Fact]
    public void NormalizeStripsPathAndQuery()
    {
        Assert.Equal(
            "https://contractone-staging.azurewebsites.net/",
            SsoRedirect.NormalizeApplicationUrl("https://contractone-staging.azurewebsites.net/app?x=1#y"));
    }
}
