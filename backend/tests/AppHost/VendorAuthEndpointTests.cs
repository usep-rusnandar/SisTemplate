using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorAuthEndpointTests
{
    [Fact]
    public async Task MeEndpointReturnsUnauthorizedWithoutRedirectWhenAnonymous()
    {
        await using var app = new IsolatedVendorAuthApi();
        await app.InitializeAsync();

        using var client = app.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        using var response = await client.GetAsync("/api/v1/vendor/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task LoginThenMeReturnsCurrentVendorContext()
    {
        await using var app = new IsolatedVendorAuthApi();
        await app.InitializeAsync();
        await app.SeedVendorAsync(
            email: "vendor.admin@example.test",
            password: "ValidPass123!",
            vendorName: "PT Vendor Test",
            contactName: "Vendor Admin");

        using var client = app.Factory.CreateClient();

        using var loginResponse = await client.PostAsJsonAsync(
            "/api/v1/vendor/auth/login",
            new { email = "vendor.admin@example.test", password = "ValidPass123!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginPayload = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("signed_in", loginPayload.GetProperty("status").GetString());

        using var meResponse = await client.GetAsync("/api/v1/vendor/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

        var mePayload = await meResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("vendor.admin@example.test", mePayload.GetProperty("email").GetString());
        Assert.Equal("PT Vendor Test", mePayload.GetProperty("vendorName").GetString());
        Assert.Equal("Vendor Admin", mePayload.GetProperty("name").GetString());
        Assert.Contains(mePayload.GetProperty("roles").EnumerateArray(), role => role.GetString() == VendorIdentityRoleNames.Vendor);
    }

    [Fact]
    public async Task BackupContactCannotSignInToVendorWorkspace()
    {
        await using var app = new IsolatedVendorAuthApi();
        await app.InitializeAsync();
        var vendorId = await app.SeedVendorAsync(
            email: "vendor.pic@example.test",
            password: "ValidPass123!",
            vendorName: "PT Vendor Pic",
            contactName: "Vendor Pic");
        await app.SeedBackupContactAsync(
            vendorId,
            email: "vendor.backup@example.test",
            password: "ValidPass123!",
            contactName: "Vendor Backup");

        using var client = app.Factory.CreateClient();
        using var loginResponse = await client.PostAsJsonAsync(
            "/api/v1/vendor/auth/login",
            new { email = "vendor.backup@example.test", password = "ValidPass123!" });

        Assert.Equal(HttpStatusCode.Forbidden, loginResponse.StatusCode);
        var payload = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("not_workspace_pic", payload.GetProperty("code").GetString());
    }

    [Fact]
    public async Task VendorPortalCertificateReturnsOnlyTheSignedInVendorsCertificate()
    {
        await using var app = new IsolatedVendorAuthApi();
        await app.InitializeAsync();
        var vendorId = await app.SeedVendorAsync(
            email: "vendor.certificate@example.test",
            password: "ValidPass123!",
            vendorName: "PT Vendor Certificate",
            contactName: "Vendor Certificate");
        var documentId = await app.SeedCertificateAsync(vendorId, "VC/2026/TEST001");

        using var client = app.Factory.CreateClient();
        using var loginResponse = await client.PostAsJsonAsync(
            "/api/v1/vendor/auth/login",
            new { email = "vendor.certificate@example.test", password = "ValidPass123!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        using var response = await client.GetAsync("/api/v1/vendor-portal/certificate");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(documentId, payload.GetProperty("documentId").GetGuid());
        Assert.Equal(vendorId, payload.GetProperty("vendorId").GetString());
        Assert.Equal("VC/2026/TEST001", payload.GetProperty("certificateNumber").GetString());
        Assert.Equal(JsonValueKind.String, payload.GetProperty("issuedAt").ValueKind);
    }

    [Fact]
    public async Task MeEndpointReturnsForbiddenForAuthenticatedVendorWithoutRequiredRole()
    {
        await using var app = new IsolatedVendorAuthApi();
        await app.InitializeAsync();
        await app.SeedVendorAsync(
            email: "vendor.norole@example.test",
            password: "ValidPass123!",
            vendorName: "PT Vendor No Role",
            contactName: "Vendor No Role",
            roleName: null);

        using var client = app.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        using var loginResponse = await client.PostAsJsonAsync(
            "/api/v1/vendor/auth/login",
            new { email = "vendor.norole@example.test", password = "ValidPass123!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        using var meResponse = await client.GetAsync("/api/v1/vendor/auth/me");
        Assert.Equal(HttpStatusCode.Forbidden, meResponse.StatusCode);
    }

    [Fact]
    public async Task PasswordResetRequestReturnsAcceptedForUnknownEmail()
    {
        await using var app = new IsolatedVendorAuthApi();
        await app.InitializeAsync();

        using var client = app.Factory.CreateClient();

        using var response = await client.PostAsJsonAsync(
            "/api/v1/vendor/auth/password-reset/request",
            new { email = "unknown.vendor@example.test" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("accepted", payload.GetProperty("status").GetString());
        Assert.True(payload.GetProperty("resetToken").ValueKind is JsonValueKind.Null or JsonValueKind.Undefined);
    }

    private sealed class IsolatedVendorAuthApi : IAsyncDisposable
    {
        private readonly string _connectionString;
        private readonly string? _previousConnectionString;

        public IsolatedVendorAuthApi()
        {
            var databaseName = $"IntegratedProcurement_VendorAuthTests_{Guid.NewGuid():N}";
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
            await dbContext.Database.EnsureDeletedAsync();
            await dbContext.Database.MigrateAsync();
        }

        public async Task<string> SeedVendorAsync(string email, string password, string vendorName, string contactName, string? roleName = VendorIdentityRoleNames.Vendor)
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

            if (!string.IsNullOrWhiteSpace(roleName))
            {
                var roleResult = await userManager.AddToRoleAsync(identityUser, roleName);
                Assert.True(roleResult.Succeeded, string.Join("; ", roleResult.Errors.Select(error => error.Description)));
            }

            dbContext.VendorUsers.Add(VendorUser.Create(identityUser.Id, vendor.Id, isWorkspacePic: true));
            await dbContext.SaveChangesAsync();
            return vendor.Id;
        }

        public async Task SeedBackupContactAsync(string vendorId, string email, string password, string contactName)
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<VendorIdentityUser>>();

            var identityUser = new VendorIdentityUser
            {
                Id = Guid.NewGuid().ToString("N")[..10].ToUpperInvariant(),
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

            dbContext.VendorUsers.Add(VendorUser.Create(identityUser.Id, vendorId, isWorkspacePic: false));
            await dbContext.SaveChangesAsync();
        }

        public async Task<Guid> SeedCertificateAsync(string vendorId, string certificateNumber)
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var certificate = VendorDocument.Create(
                vendorId,
                "e-certificate",
                certificateNumber,
                $"{certificateNumber.Replace('/', '-')}.pdf",
                "application/pdf",
                1024,
                "test-container",
                $"certificates/{vendorId}/test.pdf",
                "00109610");
            dbContext.VendorDocuments.Add(certificate);
            await dbContext.SaveChangesAsync();
            return certificate.Id;
        }

        public async ValueTask DisposeAsync()
        {
            try
            {
                using var scope = Factory.Services.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
                await dbContext.Database.EnsureDeletedAsync();
            }
            catch
            {
            }

            Factory.Dispose();
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _previousConnectionString);
        }
    }
}
