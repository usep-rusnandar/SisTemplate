using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Identity;
using IntegratedProcurement.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Covers the internal admin "unlock account" action for locked-out vendor logins:
/// the account endpoint reflects the lockout, and unlock-account clears it (requires
/// the vendorOnboarding.manage permission, held here by the seeded Super Admin).
/// </summary>
public sealed class VendorAccountUnlockEndpointTests
{
    [Fact]
    public async Task AdminSeesLockoutAndCanUnlockVendorAccount()
    {
        await using var app = new IsolatedVendorUnlockApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        var vendorId = await app.SeedLockedVendorAsync(
            email: "locked.vendor@example.test",
            password: "ValidPass123!",
            vendorName: "PT Locked Vendor",
            contactName: "Locked Vendor");

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client, "00109610"); // Super Admin (has vendorOnboarding.manage)

        // The account endpoint reports the lockout.
        using var beforeResponse = await client.GetAsync($"/api/v1/vendor-onboarding/vendors/{vendorId}/account");
        Assert.Equal(HttpStatusCode.OK, beforeResponse.StatusCode);
        var before = await beforeResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, before.GetArrayLength());
        Assert.True(before[0].GetProperty("isLockedOut").GetBoolean());

        // Unlock succeeds and reports one account cleared.
        using var unlockResponse = await client.PostAsync(
            $"/api/v1/vendor-onboarding/vendors/{vendorId}/unlock-account", content: null);
        Assert.Equal(HttpStatusCode.OK, unlockResponse.StatusCode);
        var unlock = await unlockResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, unlock.GetProperty("unlocked").GetInt32());

        // The account is no longer locked out, and the failed-attempt counter is reset.
        using var afterResponse = await client.GetAsync($"/api/v1/vendor-onboarding/vendors/{vendorId}/account");
        var after = await afterResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(after[0].GetProperty("isLockedOut").GetBoolean());
        Assert.Equal(0, after[0].GetProperty("accessFailedCount").GetInt32());
    }

    [Fact]
    public async Task UnlockReturnsNotFoundWhenVendorHasNoAccount()
    {
        await using var app = new IsolatedVendorUnlockApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client, "00109610");

        using var response = await client.PostAsync(
            "/api/v1/vendor-onboarding/vendors/does-not-exist/unlock-account", content: null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task DevLoginAsync(HttpClient client, string personnelNo)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class IsolatedVendorUnlockApi : IAsyncDisposable
    {
        private const string DbMarker = "IntegratedProcurement_VendorUnlockTests_";
        private readonly string _connectionString;
        private readonly string? _previousConnectionString;

        public IsolatedVendorUnlockApi()
        {
            var databaseName = $"{DbMarker}{Guid.NewGuid():N}";
            _connectionString = $"Server=(localdb)\\MSSQLLocalDB;Database={databaseName};Trusted_Connection=True;TrustServerCertificate=True";
            _previousConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _connectionString);

            Factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.UseSetting("ConnectionStrings:DefaultConnection", _connectionString);
                    builder.ConfigureAppConfiguration((_, configuration) =>
                    {
                        configuration.AddInMemoryCollection(new Dictionary<string, string?>
                        {
                            ["ConnectionStrings:DefaultConnection"] = _connectionString,
                            ["DataSeeding:SeedInitialIam"] = "false",
                            ["DataSeeding:SeedInitialPlatformData"] = "false",
                            ["SSO:Enabled"] = "false"
                        });
                    });
                });
        }

        public WebApplicationFactory<Program> Factory { get; }

        public async Task InitializeAsync()
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            EnsureTestDatabase(dbContext);
            await dbContext.Database.EnsureDeletedAsync();
            await dbContext.Database.MigrateAsync();
        }

        public Task SeedInitialIamDataAsync() => Factory.Services.SeedInitialIamDataAsync();

        public async Task<string> SeedLockedVendorAsync(string email, string password, string vendorName, string contactName)
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<VendorIdentityUser>>();

            var vendor = Vendor.Register(vendorName, initialStatus: VendorStatuses.Approved, actor: "test-seed");
            dbContext.Vendors.Add(vendor);
            await dbContext.SaveChangesAsync();

            var identityUser = new VendorIdentityUser
            {
                Id = vendor.Id,
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                CompleteName = contactName,
                IsActive = true,
                HasLogin = true
            };
            var createResult = await userManager.CreateAsync(identityUser, password);
            Assert.True(createResult.Succeeded, string.Join("; ", createResult.Errors.Select(e => e.Description)));

            // Drive it into a locked-out state, as a run of failed sign-ins would.
            await userManager.SetLockoutEnabledAsync(identityUser, true);
            await userManager.SetLockoutEndDateAsync(identityUser, DateTimeOffset.UtcNow.AddMinutes(30));
            await userManager.AccessFailedAsync(identityUser);

            dbContext.VendorUsers.Add(VendorUser.Create(identityUser.Id, vendor.Id));
            await dbContext.SaveChangesAsync();
            return vendor.Id;
        }

        public async ValueTask DisposeAsync()
        {
            try
            {
                using var scope = Factory.Services.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
                EnsureTestDatabase(dbContext);
                await dbContext.Database.EnsureDeletedAsync();
            }
            catch
            {
            }

            await Factory.DisposeAsync();
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _previousConnectionString);
        }

        private static void EnsureTestDatabase(ProcurementDbContext dbContext)
        {
            var connectionString = dbContext.Database.GetConnectionString() ?? string.Empty;
            if (!connectionString.Contains(DbMarker, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Vendor unlock tests must not touch the shared development database.");
            }
        }
    }
}
