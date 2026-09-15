using IntegratedProcurement.ModuleGateway;
using Microsoft.AspNetCore.Http;

namespace IntegratedProcurement.ModuleGateway.Tests;

public sealed class SsoCallbackRewriteTests
{
    [Fact]
    public void RewritesRootTokenToCallback()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/";
        context.Request.QueryString = new QueryString("?token=aaa.bbb.ccc");

        Assert.True(SsoCallbackRewrite.TryRewriteDocumentToken(context.Request));
        Assert.Equal(SsoCallbackRewrite.CallbackPath, context.Request.Path);
        Assert.Equal("aaa.bbb.ccc", context.Request.Query["token"].ToString());
    }

    [Fact]
    public void DoesNotRewriteApiPaths()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/v1/internal/auth/me";
        context.Request.QueryString = new QueryString("?token=aaa.bbb.ccc");

        Assert.False(SsoCallbackRewrite.TryRewriteDocumentToken(context.Request));
        Assert.Equal("/api/v1/internal/auth/me", context.Request.Path);
    }

    [Fact]
    public void DoesNotRewriteWithoutToken()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/proposals";

        Assert.False(SsoCallbackRewrite.TryRewriteDocumentToken(context.Request));
        Assert.Equal("/proposals", context.Request.Path);
    }

    [Fact]
    public void OverwritesClientForwardedHostWithPortalHost()
    {
        using var message = new HttpRequestMessage();
        message.Headers.TryAddWithoutValidation("X-Forwarded-Host", "evil.example");
        message.Headers.TryAddWithoutValidation("X-Forwarded-Proto", "http");

        PortalForwardedHost.Apply(
            "proposal-tracker-staging.azurewebsites.net",
            "https",
            message.Headers);

        Assert.Equal(
            ["proposal-tracker-staging.azurewebsites.net"],
            message.Headers.GetValues("X-Forwarded-Host"));
        Assert.Equal(["https"], message.Headers.GetValues("X-Forwarded-Proto"));
    }
}
