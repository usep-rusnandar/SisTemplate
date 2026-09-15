using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Verifies the shared frontend key-value store is no longer anonymous: reads and writes require
/// an authenticated actor (internal session or vendor identity cookie), and the bulk clear that
/// wipes the whole scope is reserved for internal users.
/// </summary>
public sealed class FrontendStateEndpointTests : IClassFixture<IsolatedApiFixture>
{
    private readonly IsolatedApiFixture _factory;

    public FrontendStateEndpointTests(IsolatedApiFixture factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AnonymousCallerIsRejectedOnEveryVerb()
    {
        using var client = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/frontend-state?scope=anon-test")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync("/api/v1/frontend-state/some-key?scope=anon-test", new { value = "v" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync("/api/v1/frontend-state/some-key?scope=anon-test")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync("/api/v1/frontend-state?scope=anon-test")).StatusCode);
    }

    [Fact]
    public async Task InternalUserCanReadWriteAndClear()
    {
        using var client = _factory.CreateClient();
        await DevLoginAsync(client, "00109610");

        // Dotted keys are real bridge-state keys (e.g. "cip.workflow.sticky-case") and must not
        // fall into the SSO middleware's static-asset extension bypass.
        using var putResponse = await client.PutAsJsonAsync(
            "/api/v1/frontend-state/cip.workflow.sticky-case?scope=internal-test",
            new { value = "case-1" });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        using var listResponse = await client.GetAsync("/api/v1/frontend-state?scope=internal-test");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var payload = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            payload.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("key").GetString() == "cip.workflow.sticky-case"
                && item.GetProperty("value").GetString() == "case-1");

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/v1/frontend-state/cip.workflow.sticky-case?scope=internal-test")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/v1/frontend-state?scope=internal-test")).StatusCode);
    }

    [Fact]
    public async Task InternalUserCanReadWriteSlashKeyViaItemQuery()
    {
        using var client = _factory.CreateClient();
        await DevLoginAsync(client, "00109610");

        const string key = "sticky/proposal/2026/A.01.01";
        using var putResponse = await client.PutAsJsonAsync(
            $"/api/v1/frontend-state/item?key={Uri.EscapeDataString(key)}&scope=slash-key-test",
            new { value = "open" });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        using var listResponse = await client.GetAsync("/api/v1/frontend-state?scope=slash-key-test");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var payload = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            payload.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("key").GetString() == key
                && item.GetProperty("value").GetString() == "open");

        Assert.Equal(
            HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/v1/frontend-state/item?key={Uri.EscapeDataString(key)}&scope=slash-key-test")).StatusCode);
    }

    [Fact]
    public async Task VendorUserCanReadAndWriteButNotClear()
    {
        await SeedVendorAsync("vendor.state@example.test", "ValidPass123!");

        using var client = _factory.CreateClient();
        using var loginResponse = await client.PostAsJsonAsync(
            "/api/v1/vendor/auth/login",
            new { email = "vendor.state@example.test", password = "ValidPass123!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        using var putResponse = await client.PutAsJsonAsync(
            "/api/v1/frontend-state/ag_theme?scope=vendor-test",
            new { value = "dark" });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        using var listResponse = await client.GetAsync("/api/v1/frontend-state?scope=vendor-test");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var payload = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            payload.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("key").GetString() == "ag_theme");

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/v1/frontend-state/ag_theme?scope=vendor-test")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync("/api/v1/frontend-state?scope=vendor-test")).StatusCode);
    }

    private static async Task DevLoginAsync(HttpClient client, string personnelNo)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task SeedVendorAsync(string email, string password)
    {
        using var scope = _factory.Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<VendorIdentityUser>>();

        var vendor = Vendor.Register("PT Frontend State Test", initialStatus: VendorStatuses.Approved, actor: "test-seed");
        dbContext.Vendors.Add(vendor);
        await dbContext.SaveChangesAsync();

        var identityUser = new VendorIdentityUser
        {
            Id = vendor.Id,
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            CompleteName = "Frontend State Vendor",
            IsActive = true,
            HasLogin = true
        };

        var createResult = await userManager.CreateAsync(identityUser, password);
        Assert.True(createResult.Succeeded, string.Join("; ", createResult.Errors.Select(error => error.Description)));

        var roleResult = await userManager.AddToRoleAsync(identityUser, VendorIdentityRoleNames.Vendor);
        Assert.True(roleResult.Succeeded, string.Join("; ", roleResult.Errors.Select(error => error.Description)));

        dbContext.VendorUsers.Add(VendorUser.Create(identityUser.Id, vendor.Id));
        await dbContext.SaveChangesAsync();
    }
}
