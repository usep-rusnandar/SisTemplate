using SisTemplate.Platform.Administration.Application;

namespace SisTemplate.AppHost.Api.IntegrationTests;

public sealed class EmailHtmlEnvelopeTests
{
    [Fact]
    public void WrapAddsHeaderSubjectCtaAndFooter()
    {
        var html = EmailHtmlEnvelope.Wrap(
            "Reset Password – Alamtri Geo Integrated Procurement",
            "<p>Please use the link.</p>",
            "Users",
            "Reset password",
            "https://contractone.azurewebsites.net?email=a%40b.co&reset=token");

        Assert.Contains(EmailHtmlEnvelope.Marker, html);
        Assert.Contains("AlamTri", html);
        Assert.Contains("USERS", html);
        Assert.Contains("Reset Password", html);
        Assert.Contains("Reset password", html);
        Assert.Contains("href=\"https://contractone.azurewebsites.net?email=a%40b.co&amp;reset=token\"", html);
        Assert.Contains("please do not reply", html, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void WrapDoesNotUseQueryOnlyHref()
    {
        var html = EmailHtmlEnvelope.Wrap(
            "Reset Password",
            "<p>?email=a&amp;reset=x</p>",
            "Users",
            "Reset password",
            "?email=a&reset=x");

        Assert.DoesNotContain("href=\"?email", html);
        Assert.Contains("Reset password", html);
    }

    [Fact]
    public void RenderHtmlFillsTokensLinksUrlAndWraps()
    {
        var template = new EmailTemplateContent(
            "Reset Password – {name}",
            "Dear {name},\n\nUse this link ({expiryHours} hours):\n\n{resetUrl}\n\nContact {contact}.",
            "Reset password");
        var tokens = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["name"] = "USEP RUSNANDAR",
            ["expiryHours"] = "24",
            ["resetUrl"] = "https://contractone.azurewebsites.net?email=usep%40sis.test&reset=abc",
            ["contact"] = "Alamtri Procurement",
        };

        var html = EmailTemplateNotifier.RenderHtml(template, tokens, "Users");

        Assert.Contains("USEP RUSNANDAR", html);
        Assert.Contains("Alamtri Procurement", html);
        Assert.Contains("ag-email-envelope", html);
        Assert.Contains("href=\"https://contractone.azurewebsites.net?email=usep%40sis.test&amp;reset=abc\"", html);
        Assert.Contains("USERS", html);
        Assert.DoesNotContain("{resetUrl}", html);
        Assert.DoesNotContain("{name}", html);
    }

    [Fact]
    public void ToHtmlDoesNotAutoLinkBareQueryString()
    {
        var html = EmailTemplateNotifier.ToHtml("Link:\n\n?email=usep@sis.test&reset=abc");
        Assert.DoesNotContain("<a href", html);
        Assert.Contains("?email=usep@sis.test&amp;reset=abc", html);
    }
}

public sealed class FrontendPortalUrlsTests
{
    [Fact]
    public void FirstAbsoluteSkipsEmptyAndPrefersInternalUrl()
    {
        Assert.Equal(
            "https://contractone.azurewebsites.net",
            FrontendPortalUrls.FirstAbsolute("", "  ", "https://contractone.azurewebsites.net/", "https://other.example"));
    }

    [Fact]
    public void FirstAbsoluteFallsBackToSsoWhenInternalUrlBlank()
    {
        Assert.Equal(
            "https://contractone.azurewebsites.net",
            FrontendPortalUrls.FirstAbsolute(null, "", "https://contractone.azurewebsites.net/"));
    }

    [Fact]
    public void BuildQueryUrlPrefixesHost()
    {
        var url = FrontendPortalUrls.BuildQueryUrl(
            "https://contractone.azurewebsites.net/",
            "usep.rusnandar@saptaindra.co.id",
            "tok/en");
        Assert.StartsWith("https://contractone.azurewebsites.net?email=", url);
        Assert.Contains("usep.rusnandar%40saptaindra.co.id", url);
        Assert.Contains("reset=tok%2Fen", url);
    }

    [Fact]
    public void BuildQueryUrlWithoutHostKeepsQueryOnly()
    {
        var url = FrontendPortalUrls.BuildQueryUrl("", "a@b.co", "t");
        Assert.StartsWith("?email=", url);
        Assert.DoesNotContain("https://", url);
    }

    [Fact]
    public void SupportContactIgnoresBlankConfiguredValue()
    {
        Assert.Equal("Alamtri Procurement", FrontendPortalUrls.SupportContact(""));
        Assert.Equal("Alamtri Procurement", FrontendPortalUrls.SupportContact(null));
        Assert.Equal("help@sis.test", FrontendPortalUrls.SupportContact("help@sis.test"));
    }
}
