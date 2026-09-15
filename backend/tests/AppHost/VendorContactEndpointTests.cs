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

public sealed class VendorContactEndpointTests
{
    [Fact]
    public async Task AdminCanSetContactPasswordAndVendorCanSignIn()
    {
        await using var app = new IsolatedVendorContactApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        var contactId = await app.SeedPicContactAsync(
            email: "pic.password@example.test",
            password: "OldPass123!@",
            vendorName: "PT Password Admin",
            contactName: "PIC Password");

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client, "00109610");

        using var weak = await client.PostAsJsonAsync(
            $"/api/v1/vendor-onboarding/contacts/{contactId}/password",
            new { newPassword = "short" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);

        using var set = await client.PostAsJsonAsync(
            $"/api/v1/vendor-onboarding/contacts/{contactId}/password",
            new { newPassword = "NewPass123!@" });
        Assert.Equal(HttpStatusCode.OK, set.StatusCode);
        var body = await set.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("hasLogin").GetBoolean());

        using var vendorClient = app.Factory.CreateClient();
        using var login = await vendorClient.PostAsJsonAsync(
            "/api/v1/vendor/auth/login",
            new { email = "pic.password@example.test", password = "NewPass123!@" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    private static async Task DevLoginAsync(HttpClient client, string personnelNo)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class IsolatedVendorContactApi : IAsyncDisposable
    {
        private const string DbMarker = "IntegratedProcurement_VendorContactTests_";
        private readonly string _connectionString;
        private readonly string? _previousConnectionString;

        public IsolatedVendorContactApi()
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

        public async Task<Guid> SeedPicContactAsync(string email, string password, string vendorName, string contactName)
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
            Assert.True(createResult.Succeeded, string.Join("; ", createResult.Errors.Select(error => error.Description)));
            var roleResult = await userManager.AddToRoleAsync(identityUser, VendorIdentityRoleNames.Vendor);
            Assert.True(roleResult.Succeeded, string.Join("; ", roleResult.Errors.Select(error => error.Description)));

            var link = VendorUser.Create(identityUser.Id, vendor.Id, isWorkspacePic: true);
            dbContext.VendorUsers.Add(link);
            await dbContext.SaveChangesAsync();
            return link.Id;
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
                throw new InvalidOperationException("Vendor contact tests must not touch the shared development database.");
            }
        }
    }
}
