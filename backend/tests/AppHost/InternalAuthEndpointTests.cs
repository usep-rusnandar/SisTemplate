using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SisTemplate.AppHost.Api.IntegrationTests;

public sealed class InternalAuthEndpointTests : IClassFixture<IsolatedApiFixture>
{
    private readonly IsolatedApiFixture _factory;

    public InternalAuthEndpointTests(IsolatedApiFixture factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task MeEndpointDoesNotRedirectWhenSsoIsDisabled()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        using var response = await client.GetAsync("/api/v1/internal/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<InternalAuthMeResponse>();
        Assert.NotNull(payload);
        Assert.False(payload.SsoEnabled);
        Assert.False(payload.IsAuthenticated);
    }

    [Fact]
    public async Task DevLoginThenMeReturnsInternalRolesAndPermissions()
    {
        using var client = _factory.CreateClient();

        using var loginResponse = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo = "00109610", displayName = "USEP RUSNANDAR" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        using var response = await client.GetAsync("/api/v1/internal/auth/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<InternalAuthMeResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsAuthenticated);
        Assert.Equal("Internal", payload.ActorType);
        Assert.Equal("00109610", payload.PersonnelNo);
        Assert.Equal("USEP RUSNANDAR", payload.DisplayName);
        Assert.Contains("Super Admin", payload.Roles);
        Assert.Contains("users.view", payload.Permissions);
        Assert.Contains("audit.export", payload.Permissions);
    }

    [Fact]
    public async Task DevLoginAcceptsRegisteredInternalEmail()
    {
        using var client = _factory.CreateClient();

        using var loginResponse = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "usep.rusnandar@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        using var response = await client.GetAsync("/api/v1/internal/auth/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<InternalAuthMeResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsAuthenticated);
        Assert.Equal("00109610", payload.PersonnelNo);
        Assert.Equal("USEP RUSNANDAR", payload.DisplayName);
        Assert.Contains("Super Admin", payload.Roles);
    }

    [Fact]
    public async Task DevLoginReturnsProfileForAdministratorUser()
    {
        using var client = _factory.CreateClient();

        using var loginResponse = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "wita.aprilia@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        using var response = await client.GetAsync("/api/v1/internal/auth/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<InternalAuthMeResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsAuthenticated);
        Assert.Equal("00116251", payload.PersonnelNo);
        Assert.Contains("Platform Administrator", payload.Roles);
        Assert.NotNull(payload.User);
        Assert.Equal("wita.aprilia@saptaindra.co.id", payload.User.Email);
        Assert.Contains("Platform Administrator", payload.User.Roles);
    }

    private sealed record InternalAuthMeResponse(
        bool IsAuthenticated,
        string ActorType,
        string DisplayName,
        string PersonnelNo,
        IReadOnlyCollection<string> Roles,
        IReadOnlyCollection<string> Permissions,
        bool SsoEnabled,
        InternalAuthUser? User);

    private sealed record InternalAuthUser(
        string PersonnelNo,
        string Email,
        IReadOnlyCollection<string> Roles);
}
