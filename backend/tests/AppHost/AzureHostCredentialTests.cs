using System.Net;
using System.Text;
using System.Text.Json;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Documents.Infrastructure;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class AzureHostCredentialTests
{
    [Fact]
    public void ForSharePointUsesClientSecretWhenComplete()
    {
        var credential = AzureHostCredential.ForSharePoint(new SharePointOptions
        {
            TenantId = "tenant",
            ClientId = "client",
            ClientSecret = "secret",
        });
        Assert.Equal("ClientSecretCredential", credential.GetType().Name);
        Assert.Equal("ClientSecretCredential (App Registration)", AzureHostCredential.DescribeSharePoint(
            new SharePointOptions { TenantId = "t", ClientId = "c", ClientSecret = "s" }));
    }

    [Fact]
    public void ForSharePointUsesSystemAssignedManagedIdentityWithoutSecret()
    {
        var credential = AzureHostCredential.ForSharePoint(new SharePointOptions
        {
            TenantId = "tenant",
            ClientId = "client",
        });
        Assert.Equal("ManagedIdentityCredential", credential.GetType().Name);
        Assert.Equal(
            "ManagedIdentityCredential (system-assigned)",
            AzureHostCredential.DescribeSharePoint(new SharePointOptions { TenantId = "tenant" }));
    }

    [Fact]
    public void InspectGraphTokenReadsAppIdAndRoles()
    {
        var jwt = TestJwt(new { appid = "d5f6728d-4c47-4df0-a18c-3a3bee0f690e", roles = new[] { "Sites.Selected" } });
        var info = AzureHostCredential.InspectGraphToken(jwt);
        Assert.Equal("d5f6728d-4c47-4df0-a18c-3a3bee0f690e", info.AppId);
        Assert.Equal("Sites.Selected", Assert.Single(info.Roles));
    }

    [Fact]
    public void FormatGraphHttpFailureExplainsEmptyRolesOn401()
    {
        var message = AzureHostCredential.FormatGraphHttpFailure(
            HttpStatusCode.Unauthorized,
            "Unauthorized",
            """{"error":{"code":"InvalidAuthenticationToken","message":"Access token validation failure."}}""",
            new GraphTokenInfo("abc-mi", Array.Empty<string>()));
        Assert.Contains("SharePoint Graph 401", message, StringComparison.Ordinal);
        Assert.Contains("Identity abc-mi", message, StringComparison.Ordinal);
        Assert.Contains("no roles", message, StringComparison.Ordinal);
        Assert.Contains("SharePoint__ClientSecret", message, StringComparison.Ordinal);
        Assert.DoesNotContain("Response status code does not indicate success", message, StringComparison.Ordinal);
    }

    [Fact]
    public void FormatSharePointAuthFailureStopsDefaultAzureCredentialDump()
    {
        var dumped = new InvalidOperationException(
            "DefaultAzureCredential failed to retrieve a token from the included credentials. See the troubleshooting guide for more information. https://aka.ms/azsdk/net/identity/defaultazurecredential/troubleshoot "
            + "- EnvironmentCredential authentication unavailable. Environment variables are not fully configured.");
        var message = AzureHostCredential.FormatSharePointAuthFailure(dumped);
        Assert.Contains("SharePoint__ClientSecret", message, StringComparison.Ordinal);
        Assert.Contains("Managed Identity", message, StringComparison.Ordinal);
        Assert.DoesNotContain("https://aka.ms", message, StringComparison.Ordinal);
    }

    [Fact]
    public void ShareLinkToTokenUsesUrlSafeBase64()
    {
        var token = GraphSharePointDocumentFetcher.ShareLinkToToken(
            "https://saptaindra.sharepoint.com/:b:/s/ProcurementSourcingDocument/abc");
        Assert.StartsWith("u!", token, StringComparison.Ordinal);
        Assert.DoesNotContain("+", token, StringComparison.Ordinal);
        Assert.DoesNotContain("/", token, StringComparison.Ordinal);
        Assert.DoesNotContain("=", token, StringComparison.Ordinal);
    }

    private static string TestJwt(object payload)
    {
        var json = JsonSerializer.Serialize(payload);
        var header = Base64Url("""{"alg":"none"}""");
        var body = Base64Url(json);
        return $"{header}.{body}.sig";
    }

    private static string Base64Url(string value)
    {
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
