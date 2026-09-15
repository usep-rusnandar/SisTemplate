using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Platform.InternalIdentity.Domain;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Verifies fine-grained permission enforcement: a Super Admin reaches every internal surface,
/// while a module officer is allowed only into their own module and is denied elsewhere.
/// </summary>
public sealed class PermissionEnforcementTests
{
    private static readonly string[] TrackerOfficerRole = ["Officer Proposal Tracker"];
    private static readonly string[] VendorAdministratorAndOfficerRoles =
        ["Administrator Vendor Onboarding", "Officer Vendor Onboarding"];

    [Fact]
    public async Task SuperAdminReachesEveryInternalSurface()
    {
        await using var app = new IsolatedPermissionApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client, "00109610");

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/proposal-tracker/proposals")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/contract-initiation-platform/cases")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/contract-monitoring")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/administration/users")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/super-admin/audit")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/super-admin/background-processes")).StatusCode);
    }

    [Fact]
    public async Task ModuleOfficerIsConfinedToOwnModule()
    {
        await using var app = new IsolatedPermissionApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        // P-00015 = Agus Pratama, Officer Tracker (Tracker + Term Sheet keys after CIP→Tracker merge).
        await DevLoginAsync(client, "80010029");

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/proposal-tracker/proposals")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/contract-initiation-platform/cases")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/contract-monitoring")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/administration/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/super-admin/audit")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/super-admin/background-processes")).StatusCode);
    }

    [Theory]
    [InlineData("80010029")] // Officer Proposal Tracker
    [InlineData("80010439")] // Officer Proposal Tracker (remapped from CIP)
    public async Task OperationalConsumersCanReadButNotManageTrackerProcessModel(string personnelNo)
    {
        await using var app = new IsolatedPermissionApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client, personnelNo);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/master-data/sets/tracker-step")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/master-data/sets/tracker-method")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/master-data/sets/brand")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/master-data/sets/brand/import/template")).StatusCode);

        using var manageResponse = await client.PutAsJsonAsync(
            "/api/v1/master-data/sets/tracker-step/records/TEST",
            new
            {
                name = "Unauthorized process step",
                status = "Active"
            });
        Assert.Equal(HttpStatusCode.Forbidden, manageResponse.StatusCode);
    }

    [Fact]
    public async Task VendorReviewerCanReadButNotManageVendorReferenceSets()
    {
        await using var app = new IsolatedPermissionApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        // 00117404 = Yusuf Binsar, Read Only Vendor Onboarding (vendorOnboarding.view only — no masterData.*).
        await DevLoginAsync(client, "00117404");

        // Every reference set the View Vendor Profile dossier resolves must be READable by a vendor-access
        // role even without master-data admin — otherwise its labels degrade (commodity Classification /
        // KBLI Description fall back to "-", and address Province/City/District/Village to raw codes).
        string[] vendorReferenceSets =
        [
            "commodity-category", "commodity-classification", "commodity-subclassification",
            "commodity-subclassification-kbli", "commodity-subclassification-special-requirement",
            "kbli", "kbli-type", "kbli-status", "distributor-type", "special-requirement",
            "brand", "country", "province", "city", "district", "village",
            "vendor-document-requirement", "vendor-status",
        ];
        foreach (var setKey in vendorReferenceSets)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/master-data/sets/{setKey}")).StatusCode);
        }

        // But not another module's master data, and not managing the reference sets.
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/master-data/sets/holiday")).StatusCode);

        using var manageResponse = await client.PutAsJsonAsync(
            "/api/v1/master-data/sets/commodity-classification/records/TEST",
            new
            {
                name = "Unauthorized classification",
                status = "Active"
            });
        Assert.Equal(HttpStatusCode.Forbidden, manageResponse.StatusCode);
    }

    [Fact]
    public async Task ModuleAdministratorCanAdministerOnlyUsersAndRolesInOwnModule()
    {
        await using var app = new IsolatedPermissionApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        await app.SeedAsync(dbContext =>
        {
            var siti = dbContext.InternalUsers.Single(user => user.PersonnelNo == "00105155");
            var trackerOfficer = dbContext.InternalRoles.Single(role => role.Name == "Officer Proposal Tracker");
            dbContext.InternalUserRoles.Add(InternalUserRole.Create(siti.Id, trackerOfficer.Id));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client, "00105155"); // Siti Fatimah — Administrator + Officer Vendor Onboarding.

        using var usersResponse = await client.GetAsync("/api/v1/administration/users");
        using var rolesResponse = await client.GetAsync("/api/v1/administration/roles");
        using var matrixResponse = await client.GetAsync("/api/v1/administration/role-permissions");

        Assert.Equal(HttpStatusCode.OK, usersResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, rolesResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, matrixResponse.StatusCode);

        var users = await usersResponse.Content.ReadFromJsonAsync<JsonElement>();
        var roles = await rolesResponse.Content.ReadFromJsonAsync<JsonElement>();
        var matrix = await matrixResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.NotEmpty(users.EnumerateArray());
        Assert.All(users.EnumerateArray(), user =>
            Assert.All(user.GetProperty("roles").EnumerateArray(), role =>
                Assert.Contains("Vendor", role.GetString(), StringComparison.OrdinalIgnoreCase)));
        Assert.Contains(users.EnumerateArray(), user =>
            user.GetProperty("email").GetString() == "s.fatimah@saptaindra.co.id"
            && user.GetProperty("roles").GetArrayLength() == 2);

        Assert.NotEmpty(roles.EnumerateArray());
        Assert.All(roles.EnumerateArray(), role =>
        {
            Assert.NotEqual("Super Admin", role.GetProperty("name").GetString());
            Assert.Equal("vendorOnboarding", Assert.Single(role.GetProperty("modules").EnumerateArray()).GetString());
        });
        Assert.Equal(roles.GetArrayLength(), matrix.GetProperty("roles").GetArrayLength());

        // A module administrator cannot mutate a user who belongs only to another module.
        using var outOfScopeUpdate = await client.PutAsJsonAsync(
            "/api/v1/administration/users/80010029",
            new
            {
                fullName = "AHMAD ZAKKI IDHAM",
                email = "ahmad.idham@saptaindra.co.id",
                department = "VENDOR ONBOARDING DEPARTMENT",
                position = "SENIOR OFFICER - GENERAL VENDOR SELECTIO",
                status = "Active"
            });
        Assert.Equal(HttpStatusCode.NotFound, outOfScopeUpdate.StatusCode);

        // Role assignment is also fail-closed: a Vendor administrator cannot assign Tracker roles.
        using var outOfScopeRole = await client.PutAsJsonAsync(
            "/api/v1/administration/users/01111041/roles",
            new { roles = TrackerOfficerRole });
        Assert.Equal(HttpStatusCode.BadRequest, outOfScopeRole.StatusCode);

        using var outOfScopeCreate = await client.PostAsJsonAsync(
            "/api/v1/administration/users",
            new
            {
                personnelNo = "SCOPE-TEST-001",
                fullName = "Out Of Scope User",
                email = "out.of.scope@example.test",
                department = "Test",
                position = "Test",
                status = "Active",
                roles = TrackerOfficerRole
            });
        Assert.Equal(HttpStatusCode.BadRequest, outOfScopeCreate.StatusCode);

        // Supplying roles through the profile endpoint cannot bypass users.permissions.
        using var profileUpdate = await client.PutAsJsonAsync(
            "/api/v1/administration/users/01111041",
            new
            {
                fullName = "IMANIAR RUSYDIAWAN",
                email = "imaniar.rusydiawan@saptaindra.co.id",
                department = "IT & OT DEVELOPMENT DEPARTMENT",
                position = "SECTION HEAD - ERP & INTEGRATION SYSTEM",
                status = "Active",
                roles = TrackerOfficerRole
            });
        Assert.Equal(HttpStatusCode.OK, profileUpdate.StatusCode);
        var updatedUser = await profileUpdate.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Administrator Vendor Onboarding", Assert.Single(updatedUser.GetProperty("roles").EnumerateArray()).GetString());

        using var inScopeRole = await client.PutAsJsonAsync(
            "/api/v1/administration/users/01111041/roles",
            new { roles = VendorAdministratorAndOfficerRoles });
        Assert.Equal(HttpStatusCode.OK, inScopeRole.StatusCode);
        var roleUpdatedUser = await inScopeRole.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, roleUpdatedUser.GetProperty("roles").GetArrayLength());
    }

    [Fact]
    public async Task UnauthenticatedRequestIsRejected()
    {
        await using var app = new IsolatedPermissionApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/proposal-tracker/proposals")).StatusCode);
    }

    private static async Task DevLoginAsync(HttpClient client, string personnelNo)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class IsolatedPermissionApi : IAsyncDisposable
    {
        private readonly string _connectionString;
        private readonly string? _previousConnectionString;

        public IsolatedPermissionApi()
        {
            var databaseName = $"IntegratedProcurement_PermissionTests_{Guid.NewGuid():N}";
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

        public async Task SeedInitialIamDataAsync()
        {
            EnsureTestConnectionString();
            await Factory.Services.SeedInitialIamDataAsync();
        }

        public async Task SeedAsync(Action<ProcurementDbContext> seed)
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            EnsureTestDatabase(dbContext);
            seed(dbContext);
            await dbContext.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            EnsureTestDatabase(dbContext);
            await dbContext.Database.EnsureDeletedAsync();
            await Factory.DisposeAsync();
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _previousConnectionString);
        }

        private static void EnsureTestDatabase(ProcurementDbContext dbContext)
        {
            var connectionString = dbContext.Database.GetConnectionString() ?? string.Empty;
            if (!connectionString.Contains("IntegratedProcurement_PermissionTests_", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Permission tests must not touch the shared development database.");
            }
        }

        private void EnsureTestConnectionString()
        {
            if (!_connectionString.Contains("IntegratedProcurement_PermissionTests_", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Permission tests must not touch the shared development database.");
            }
        }
    }
}
