using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

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
    public async Task DevLoginReturnsProfileForOperationalUserWithoutAdministrationScope()
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
        Assert.Contains("Officer Contract Monitoring", payload.Roles);
        Assert.NotNull(payload.User);
        Assert.Equal("wita.aprilia@saptaindra.co.id", payload.User.Email);
        Assert.Contains("Officer Contract Monitoring", payload.User.Roles);
    }

    [Fact]
    public async Task DevLoginOnSuiteAllowsOfficerWithoutModuleHeader()
    {
        using var client = _factory.CreateClient();

        using var tracker = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "celiska.renigiyanti@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.OK, tracker.StatusCode);

        using var cip = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "dita.irmayani@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.OK, cip.StatusCode);
    }

    [Fact]
    public async Task DevLoginOnProposalTrackerAllowsTrackerOfficerAndSuperAdmin()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-App-Module", "proposal-tracker");

        using var officer = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "celiska.renigiyanti@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.OK, officer.StatusCode);

        using var admin = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "00109610" });
        Assert.Equal(HttpStatusCode.OK, admin.StatusCode);
    }

    [Fact]
    public async Task DevLoginWithRetiredCipPortalHeaderAliasesToTracker()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-App-Module", "contract-initiation-platform");

        using var officer = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "celiska.renigiyanti@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.OK, officer.StatusCode);
    }

    [Fact]
    public async Task DevLoginOnProposalTrackerAllowsRemappedCipOfficer()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-App-Module", "proposal-tracker");

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "dita.irmayani@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        using var me = await client.GetAsync("/api/v1/internal/auth/me");
        var payload = await me.Content.ReadFromJsonAsync<InternalAuthMeResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.IsAuthenticated);
        Assert.Contains("Officer Proposal Tracker", payload.Roles);
        Assert.DoesNotContain(payload.Roles, role => role.Contains("Contract Initiation", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task DevLoginOnProposalTrackerRejectsContractMonitoringOfficerWithoutWritingSession()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-App-Module", "proposal-tracker");

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "wita.aprilia@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);

        var denied = await login.Content.ReadFromJsonAsync<ModuleAccessDeniedResponse>();
        Assert.NotNull(denied);
        Assert.Equal("module_access_denied", denied.Code);
        Assert.Equal("proposalTracker", denied.Module);
        Assert.Contains("Proposal Tracker", denied.Title);

        using var me = await client.GetAsync("/api/v1/internal/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var payload = await me.Content.ReadFromJsonAsync<InternalAuthMeResponse>();
        Assert.NotNull(payload);
        Assert.False(payload.IsAuthenticated);
    }

    [Fact]
    public async Task MeOnForeignModulePortalClearsSession()
    {
        using var client = _factory.CreateClient();

        using var login = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { identifier = "wita.aprilia@saptaindra.co.id" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/internal/auth/me");
        request.Headers.Add("X-App-Module", "proposal-tracker");
        using var me = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, me.StatusCode);

        using var after = await client.GetAsync("/api/v1/internal/auth/me");
        var payload = await after.Content.ReadFromJsonAsync<InternalAuthMeResponse>();
        Assert.NotNull(payload);
        Assert.False(payload.IsAuthenticated);
    }

    private sealed record ModuleAccessDeniedResponse(string Code, string Module, string Title);

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
