using System.Net;
using System.Net.Http.Json;
using System.Text;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Exercises the SISWarrior <c>SsoMiddleware</c> flow end-to-end with <c>SSO:Enabled=true</c>:
/// anonymous <em>document</em> navigations are redirected to the portal, anonymous <em>API</em>
/// callers receive 401 (so SPA fetch/XHR such as Generate Sample Data is not hung on an HTML
/// SSO redirect), a valid <c>?token=</c> establishes an internal session, and expired /
/// unmapped-NRP tokens are rejected. Per the security-team spec the JWT is trusted on shape +
/// expiry only (no signature validation), so these tests forge unsigned (<c>alg=none</c>) tokens
/// directly.
/// </summary>
public sealed class SsoMiddlewareFlowTests : IClassFixture<SsoEnabledApiFixture>
{
    // Seeded active internal user (see InitialIamDataSeeder) — NRP == PersonnelNo.
    private const string MappedNrp = "00109610";

    private readonly SsoEnabledApiFixture _factory;

    public SsoMiddlewareFlowTests(SsoEnabledApiFixture factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AnonymousInternalApiReturns401WhenSsoIsEnabled()
    {
        using var client = NoRedirectClient();
        using var users = await client.GetAsync("/api/v1/administration/users");
        using var sample = await client.PostAsJsonAsync(
            "/api/v1/proposal-tracker/sample-data",
            new { items = Array.Empty<object>() });
        using var storage = await client.PutAsJsonAsync(
            "/api/v1/proposal-tracker/storage/item?key=ag_tracker_probe",
            new { value = "x" });

        Assert.Equal(HttpStatusCode.Unauthorized, users.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, sample.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, storage.StatusCode);
        Assert.Null(users.Headers.Location);
    }

    [Fact]
    public async Task AnonymousDocumentRequestRedirectsToSisWarrior()
    {
        using var client = NoRedirectClient();
        using var response = await client.GetAsync("/proposal-tracker/proposals");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location?.ToString();
        Assert.NotNull(location);
        Assert.StartsWith(SsoEnabledApiFixture.SsoUrl, location);
        Assert.Contains("application=IntegratedProcurement", location);
        Assert.Contains(Uri.EscapeDataString(SsoEnabledApiFixture.ApplicationUrl), location);
    }

    [Fact]
    public async Task AnonymousMeDoesNotRedirectWhenSsoIsEnabled()
    {
        using var client = NoRedirectClient();

        using var response = await client.GetAsync("/api/v1/internal/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(payload);
        Assert.False(payload.IsAuthenticated);
        Assert.True(payload.SsoEnabled);
    }

    [Fact]
    public async Task SsoLoginEndpointLandsOnSisWarrior()
    {
        // The SPA "Continue with SSO" button navigates here; the user must end up at the portal.
        using var client = NoRedirectClient();

        using var response = await client.GetAsync("/api/v1/internal/sso/login");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.StartsWith(SsoEnabledApiFixture.SsoUrl, response.Headers.Location?.ToString());
    }

    [Fact]
    public async Task ValidTokenEstablishesInternalSession()
    {
        using var client = NoRedirectClient();

        var token = ForgeToken(MappedNrp, DateTimeOffset.UtcNow.AddHours(1));
        using var callback = await client.GetAsync($"/api/v1/internal/auth/me?token={token}");
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        // The clean redirect target drops the token but keeps the path.
        Assert.Equal("/api/v1/internal/auth/me", callback.Headers.Location?.ToString());

        // The session cookie set by the callback authenticates the follow-up request.
        using var response = await client.GetAsync("/api/v1/internal/auth/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsAuthenticated);
        Assert.Equal("Internal", payload.ActorType);
        Assert.Equal(MappedNrp, payload.PersonnelNo);
        Assert.True(payload.SsoEnabled);
    }

    [Fact]
    public async Task ExpiredTokenIsRejected()
    {
        using var client = NoRedirectClient();

        var token = ForgeToken(MappedNrp, DateTimeOffset.UtcNow.AddMinutes(-5));
        using var response = await client.GetAsync($"/api/v1/internal/auth/me?token={token}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UnmappedNrpIsForbidden()
    {
        using var client = NoRedirectClient();

        var token = ForgeToken("99999999", DateTimeOffset.UtcNow.AddHours(1));
        using var response = await client.GetAsync($"/api/v1/internal/auth/me?token={token}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task LocalPasswordLoginWorksWhenSsoIsEnabled()
    {
        using var client = _factory.CreateClient();
        var token = ForgeToken(MappedNrp, DateTimeOffset.UtcNow.AddHours(1));
        using var callback = await client.GetAsync($"/api/v1/internal/auth/me?token={token}");
        Assert.Equal(HttpStatusCode.OK, callback.StatusCode);

        const string password = "LocalPass12!";
        using var setPassword = await client.PutAsJsonAsync(
            "/api/v1/administration/users/00116251/password",
            new { password });
        Assert.Equal(HttpStatusCode.OK, setPassword.StatusCode);

        using var logout = await client.PostAsync("/api/v1/internal/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/login",
            new { identifier = "wita.aprilia@saptaindra.co.id", password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        using var me = await client.GetAsync("/api/v1/internal/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var payload = await me.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsAuthenticated);
        Assert.Equal("00116251", payload.PersonnelNo);
        Assert.True(payload.SsoEnabled);
    }

    [Fact]
    public async Task AnonymousPasswordResetDoesNotRedirectWhenSsoIsEnabled()
    {
        using var client = NoRedirectClient();

        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/password-reset/request",
            new { identifier = "nobody@example.test" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private HttpClient NoRedirectClient() =>
        _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

    // Unsecured JWT (alg=none): header.payload. — accepted by JwtSecurityTokenHandler.ReadJwtToken,
    // which the middleware uses without signature validation (security-team spec).
    private static string ForgeToken(string nrp, DateTimeOffset expiresAt)
    {
        var header = Base64Url("{\"alg\":\"none\",\"typ\":\"JWT\"}");
        var payload = Base64Url($"{{\"NRP\":\"{nrp}\",\"exp\":{expiresAt.ToUnixTimeSeconds()}}}");
        return $"{header}.{payload}.";
    }

    private static string Base64Url(string json) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(json))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    private sealed record MeResponse(
        bool IsAuthenticated,
        string ActorType,
        string PersonnelNo,
        bool SsoEnabled);
}
