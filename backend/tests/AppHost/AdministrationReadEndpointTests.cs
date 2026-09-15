using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SisTemplate.BuildingBlocks.Application;
using SisTemplate.Platform.InternalIdentity.Domain;
using SisTemplate.Platform.Persistence;
using SisTemplate.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace SisTemplate.AppHost.Api.IntegrationTests;

public sealed class AdministrationReadEndpointTests
{
    private static readonly string[] CommandRolePermissions = ["users.view", "roles.view"];
    private static readonly string[] ReducedRolePermissions = ["users.view"];
    private static readonly string[] CommandUserRoles = ["Command Test Role"];
    private static readonly string[] AuditUserRoles = ["Platform Auditor"];
    private static readonly string[] DuplicateSourceUserRoles = ["Duplicate Source Role"];

    [Fact]
    public async Task InitialIamSeederProvidesMockupInternalAdministrationData()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        var users = await client.GetFromJsonAsync<JsonElement>("/api/v1/administration/users");
        var roles = await client.GetFromJsonAsync<JsonElement>("/api/v1/administration/roles");
        var permissionGroups = await client.GetFromJsonAsync<JsonElement>("/api/v1/super-admin/permissions");

        Assert.Equal(3, users.GetArrayLength());
        Assert.Equal(3, roles.GetArrayLength());
        Assert.Equal(9, permissionGroups.GetArrayLength());
        Assert.Contains(users.EnumerateArray(), user =>
            user.GetProperty("fullName").GetString() == "USEP RUSNANDAR"
            && user.GetProperty("status").GetString() == "Active");
        Assert.Contains(users.EnumerateArray(), user =>
            user.GetProperty("fullName").GetString() == "WITA APRILIA"
            && user.GetProperty("roles").EnumerateArray().Any(role => role.GetString() == "Platform Administrator"));
        Assert.Contains(roles.EnumerateArray(), role =>
            role.GetProperty("name").GetString() == "Super Admin"
            && role.GetProperty("permissions").GetInt32() == PermissionKeys.All.Count);
    }

    [Fact]
    public async Task AdministrationCommandEndpointsCreateAndUpdateIamData()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var createRoleResponse = await client.PostAsJsonAsync(
            "/api/v1/administration/roles",
            new
            {
                roleId = "R-CMD-001",
                name = "Command Test Role",
                moduleKey = "tracker",
                permissions = CommandRolePermissions
            });
        Assert.Equal(HttpStatusCode.Created, createRoleResponse.StatusCode);
        var createdRole = await createRoleResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("R-CMD-001", createdRole.GetProperty("roleId").GetString());
        Assert.Equal(2, createdRole.GetProperty("permissions").GetInt32());

        using var createUserResponse = await client.PostAsJsonAsync(
            "/api/v1/administration/users",
            new
            {
                personnelNo = "P-CMD-001",
                fullName = "Command Test User",
                email = "command.user@example.test",
                department = "Quality Assurance",
                position = "Tester",
                status = "Active",
                roles = CommandUserRoles
            });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);
        var createdUser = await createUserResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("command.user", createdUser.GetProperty("username").GetString());
        Assert.Contains(createdUser.GetProperty("roles").EnumerateArray(), role => role.GetString() == "Command Test Role");

        using var statusResponse = await client.PutAsJsonAsync(
            "/api/v1/administration/users/P-CMD-001/status",
            new { status = "Suspended" });
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var suspendedUser = await statusResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Suspended", suspendedUser.GetProperty("status").GetString());

        using var permissionsResponse = await client.PutAsJsonAsync(
            "/api/v1/administration/roles/R-CMD-001/permissions",
            new { permissions = ReducedRolePermissions });
        Assert.Equal(HttpStatusCode.OK, permissionsResponse.StatusCode);
        var updatedRole = await permissionsResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, updatedRole.GetProperty("permissions").GetInt32());
    }

    [Fact]
    public async Task AdministrationRoleDuplicateAndDeleteEndpoints()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var createRoleResponse = await client.PostAsJsonAsync(
            "/api/v1/administration/roles",
            new
            {
                roleId = "R-DUP-001",
                name = "Duplicate Source Role",
                moduleKey = "proposalTracker",
                permissions = CommandRolePermissions
            });
        Assert.Equal(HttpStatusCode.Created, createRoleResponse.StatusCode);

        using var duplicateResponse = await client.PostAsJsonAsync(
            "/api/v1/administration/roles/R-DUP-001/duplicate",
            new { });
        Assert.Equal(HttpStatusCode.Created, duplicateResponse.StatusCode);
        var copy = await duplicateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("R-DUP-001-COPY", copy.GetProperty("roleId").GetString());
        Assert.Equal("Duplicate Source Role (copy)", copy.GetProperty("name").GetString());
        Assert.Equal(2, copy.GetProperty("permissions").GetInt32());
        Assert.Equal(0, copy.GetProperty("users").GetInt32());
        Assert.False(copy.GetProperty("isSystem").GetBoolean());

        var matrix = await client.GetFromJsonAsync<JsonElement>("/api/v1/administration/role-permissions");
        var assignments = matrix.GetProperty("assignments");
        var sourceKeys = assignments.GetProperty("R-DUP-001").EnumerateArray().Select(item => item.GetString()).OrderBy(item => item).ToArray();
        var copyKeys = assignments.GetProperty("R-DUP-001-COPY").EnumerateArray().Select(item => item.GetString()).OrderBy(item => item).ToArray();
        Assert.Equal(sourceKeys, copyKeys);

        using var deleteCopyResponse = await client.DeleteAsync("/api/v1/administration/roles/R-DUP-001-COPY");
        Assert.Equal(HttpStatusCode.NoContent, deleteCopyResponse.StatusCode);

        using var missingCopyResponse = await client.GetAsync("/api/v1/administration/roles");
        var remaining = await missingCopyResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.DoesNotContain(remaining.EnumerateArray(), role => role.GetProperty("roleId").GetString() == "R-DUP-001-COPY");

        using var deleteSystemResponse = await client.DeleteAsync("/api/v1/administration/roles/SPR-ADM");
        Assert.Equal(HttpStatusCode.Conflict, deleteSystemResponse.StatusCode);
        var systemConflict = await deleteSystemResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("role_is_system", systemConflict.GetProperty("code").GetString());

        using var createUserResponse = await client.PostAsJsonAsync(
            "/api/v1/administration/users",
            new
            {
                personnelNo = "P-DUP-001",
                fullName = "Role In Use User",
                email = "role.inuse@example.test",
                department = "Quality Assurance",
                position = "Tester",
                status = "Active",
                roles = DuplicateSourceUserRoles
            });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);

        using var deleteInUseResponse = await client.DeleteAsync("/api/v1/administration/roles/R-DUP-001");
        Assert.Equal(HttpStatusCode.Conflict, deleteInUseResponse.StatusCode);
        var inUseConflict = await deleteInUseResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("role_in_use", inUseConflict.GetProperty("code").GetString());
        Assert.Equal(1, inUseConflict.GetProperty("users").GetInt32());

        using var deleteMissingResponse = await client.DeleteAsync("/api/v1/administration/roles/R-MISSING");
        Assert.Equal(HttpStatusCode.NotFound, deleteMissingResponse.StatusCode);
    }

    [Fact]
    public async Task AuditEndpointStartsEmptyAndRecordsAdministrationCommands()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);
        using var emptyAuditResponse = await client.GetAsync("/api/v1/super-admin/audit");
        Assert.Equal(HttpStatusCode.OK, emptyAuditResponse.StatusCode);
        var emptyAudit = await emptyAuditResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, emptyAudit.GetArrayLength());

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/administration/users")
        {
            Content = JsonContent.Create(new
            {
                personnelNo = "P-AUD-001",
                fullName = "Audit Test User",
                email = "audit.user@example.test",
                department = "Audit",
                position = "Tester",
                status = "Active",
                roles = AuditUserRoles
            })
        };
        request.Headers.Add("X-Actor-Name", "Audit Tester");
        using var createUserResponse = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);

        var audit = await client.GetFromJsonAsync<JsonElement>("/api/v1/super-admin/audit");
        var entry = Assert.Single(audit.EnumerateArray());
        Assert.Equal("Create", entry.GetProperty("action").GetString());
        Assert.Equal("USEP RUSNANDAR", entry.GetProperty("user").GetString());
        Assert.Equal("Users", entry.GetProperty("module").GetString());
        Assert.Contains("Audit Test User", entry.GetProperty("description").GetString());
    }

    [Fact]
    public async Task MenuAndSettingsEndpointsStartEmptyAndPersistValues()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        var emptyMenu = await client.GetFromJsonAsync<JsonElement>("/api/v1/super-admin/menu-tree");
        Assert.False(emptyMenu.GetProperty("hasData").GetBoolean());
        Assert.Equal(JsonValueKind.Null, emptyMenu.GetProperty("payloadJson").ValueKind);

        using var putMenuResponse = await client.PutAsJsonAsync(
            "/api/v1/super-admin/menu-tree",
            new { payloadJson = "[{\"id\":\"m-test\",\"type\":\"group\",\"key\":\"test\",\"roles\":[\"Super Admin\"],\"children\":[]}]" });
        Assert.Equal(HttpStatusCode.OK, putMenuResponse.StatusCode);
        var savedMenu = await putMenuResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(savedMenu.GetProperty("hasData").GetBoolean());
        Assert.Contains("m-test", savedMenu.GetProperty("payloadJson").GetString());

        var emptySettings = await client.GetFromJsonAsync<JsonElement>("/api/v1/super-admin/settings");
        Assert.False(emptySettings.GetProperty("hasData").GetBoolean());
        Assert.Equal(JsonValueKind.Null, emptySettings.GetProperty("values").ValueKind);

        using var putSettingsResponse = await client.PutAsJsonAsync(
            "/api/v1/super-admin/settings",
            new { values = new Dictionary<string, object> { ["timeout"] = "240", ["lockEnabled"] = true } });
        Assert.Equal(HttpStatusCode.OK, putSettingsResponse.StatusCode);
        var savedSettings = await putSettingsResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(savedSettings.GetProperty("hasData").GetBoolean());
        Assert.Equal("240", savedSettings.GetProperty("values").GetProperty("timeout").GetString());
        Assert.True(savedSettings.GetProperty("values").GetProperty("lockEnabled").GetBoolean());
    }

    [Fact]
    public async Task CommunicationEndpointsStartEmptyAndPersistCollections()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        var emptyLanguages = await client.GetFromJsonAsync<JsonElement>("/api/v1/super-admin/languages");
        Assert.False(emptyLanguages.GetProperty("hasData").GetBoolean());
        Assert.Equal(JsonValueKind.Null, emptyLanguages.GetProperty("items").ValueKind);

        using var putLanguages = await client.PutAsJsonAsync(
            "/api/v1/super-admin/languages",
            new
            {
                items = new object[]
                {
                    new { code = "en", name = "English", active = true },
                    new { code = "id", name = "Bahasa Indonesia", active = true }
                }
            });
        Assert.Equal(HttpStatusCode.OK, putLanguages.StatusCode);
        var savedLanguages = await putLanguages.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(savedLanguages.GetProperty("hasData").GetBoolean());
        Assert.Equal(2, savedLanguages.GetProperty("items").GetArrayLength());

        using var putLanguageText = await client.PutAsJsonAsync(
            "/api/v1/super-admin/language-text",
            new
            {
                items = new object[]
                {
                    new { key = "nav.dashboard", en = "Dashboard", id = "Dasbor" }
                }
            });
        Assert.Equal(HttpStatusCode.OK, putLanguageText.StatusCode);
        var savedLanguageText = await putLanguageText.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(savedLanguageText.GetProperty("hasData").GetBoolean());
        var languageText = Assert.Single(savedLanguageText.GetProperty("items").EnumerateArray());
        Assert.Equal("nav.dashboard", languageText.GetProperty("key").GetString());

        using var putTemplates = await client.PutAsJsonAsync(
            "/api/v1/super-admin/email-templates",
            new
            {
                items = new object[]
                {
                    new { id = "ET-100", category = "Users", status = "Active", subject = "Welcome user" }
                }
            });
        Assert.Equal(HttpStatusCode.OK, putTemplates.StatusCode);
        var savedTemplates = await putTemplates.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(savedTemplates.GetProperty("hasData").GetBoolean());
        var template = Assert.Single(savedTemplates.GetProperty("items").EnumerateArray());
        Assert.Equal("ET-100", template.GetProperty("id").GetString());

        var emptyEmailSent = await client.GetFromJsonAsync<JsonElement>("/api/v1/super-admin/email-sent");
        Assert.False(emptyEmailSent.GetProperty("hasData").GetBoolean());
        Assert.Equal(JsonValueKind.Null, emptyEmailSent.GetProperty("items").ValueKind);

        using var postEmailSent = await client.PostAsJsonAsync(
            "/api/v1/super-admin/email-sent",
            new
            {
                id = "MSG-9001",
                category = "Users",
                status = "Delivered",
                sentAt = "2026-06-24T09:30:00+07:00",
                subject = "User invitation"
            });
        Assert.Equal(HttpStatusCode.Accepted, postEmailSent.StatusCode);

        var savedEmailSent = await client.GetFromJsonAsync<JsonElement>("/api/v1/super-admin/email-sent");
        Assert.True(savedEmailSent.GetProperty("hasData").GetBoolean());
        var emailSent = Assert.Single(savedEmailSent.GetProperty("items").EnumerateArray());
        Assert.Equal("MSG-9001", emailSent.GetProperty("id").GetString());
        Assert.Equal("Users", emailSent.GetProperty("category").GetString());
    }

    [Fact]
    public async Task MasterDataEndpointFallsBackThenPersistsDatabaseRecords()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        var fallbackHoliday = await client.GetFromJsonAsync<JsonElement>("/api/v1/master-data/sets/holiday");
        Assert.False(fallbackHoliday.GetProperty("hasData").GetBoolean());
        Assert.Equal("holiday", fallbackHoliday.GetProperty("key").GetString());
        Assert.True(fallbackHoliday.GetProperty("records").GetArrayLength() > 0);

        using var putResponse = await client.PutAsJsonAsync(
            "/api/v1/master-data/sets/holiday/records/TEST-HOLIDAY",
            new
            {
                setName = "Holiday",
                tableName = "MSTR_HOLIDAY_T",
                owner = "Administration",
                name = "Test Holiday",
                status = "Active",
                description = "Database-backed holiday"
            });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var databaseHoliday = await client.GetFromJsonAsync<JsonElement>("/api/v1/master-data/sets/holiday");
        Assert.True(databaseHoliday.GetProperty("hasData").GetBoolean());
        Assert.Equal("holiday", databaseHoliday.GetProperty("key").GetString());
        var record = Assert.Single(databaseHoliday.GetProperty("records").EnumerateArray());
        Assert.Equal("TEST-HOLIDAY", record.GetProperty("code").GetString());
        Assert.Equal("Test Holiday", record.GetProperty("name").GetString());
    }

    [Fact]
    public async Task MasterDataEndpointSupportsBulkUpsertAndDelete()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var bulkResponse = await client.PutAsJsonAsync(
            "/api/v1/master-data/sets/country/records",
            new
            {
                setName = "Country",
                tableName = "MSTR_COUNTRY_T",
                owner = "Administration",
                records = new object[]
                {
                    new
                    {
                        code = "+62",
                        name = "Indonesia (+62)",
                        status = "Active",
                        description = "Dial code"
                    },
                    new
                    {
                        code = "+65",
                        name = "Singapore (+65)",
                        status = "Active",
                        description = "Dial code"
                    }
                }
            });
        Assert.Equal(HttpStatusCode.OK, bulkResponse.StatusCode);

        var bulkPayload = await bulkResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(bulkPayload.GetProperty("hasData").GetBoolean());
        Assert.Equal(2, bulkPayload.GetProperty("records").GetArrayLength());

        using var deleteResponse = await client.DeleteAsync("/api/v1/master-data/sets/country/records/%2B65");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var remaining = await client.GetFromJsonAsync<JsonElement>("/api/v1/master-data/sets/country");
        Assert.True(remaining.GetProperty("hasData").GetBoolean());
        var countryRecord = Assert.Single(remaining.GetProperty("records").EnumerateArray());
        Assert.Equal("+62", countryRecord.GetProperty("code").GetString());
    }

    [Fact]
    public async Task MasterDataEndpointSupportsReplacingEntireSet()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var firstReplace = await client.PutAsJsonAsync(
            "/api/v1/master-data/sets/province/records:replace",
            new
            {
                setName = "Province",
                tableName = "MSTR_PROVINCE_T",
                owner = "Administration",
                records = new object[]
                {
                    new { code = "11", name = "ACEH", status = "Active", description = "", payloadJson = (string?)null },
                    new { code = "31", name = "DKI JAKARTA", status = "Active", description = "", payloadJson = (string?)null }
                }
            });
        Assert.Equal(HttpStatusCode.OK, firstReplace.StatusCode);

        using var secondReplace = await client.PutAsJsonAsync(
            "/api/v1/master-data/sets/province/records:replace",
            new
            {
                setName = "Province",
                tableName = "MSTR_PROVINCE_T",
                owner = "Administration",
                records = new object[]
                {
                    new { code = "32", name = "JAWA BARAT", status = "Active", description = "", payloadJson = (string?)null }
                }
            });
        Assert.Equal(HttpStatusCode.OK, secondReplace.StatusCode);

        var provinces = await client.GetFromJsonAsync<JsonElement>("/api/v1/master-data/sets/province");
        Assert.True(provinces.GetProperty("hasData").GetBoolean());
        var record = Assert.Single(provinces.GetProperty("records").EnumerateArray());
        Assert.Equal("32", record.GetProperty("code").GetString());
        Assert.Equal("JAWA BARAT", record.GetProperty("name").GetString());
    }

    [Fact]
    public async Task AdministrationReadEndpointsReturnIamDatabaseDataWhenPresent()
    {
        await using var app = new IsolatedAdministrationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        await app.SeedAsync(dbContext =>
        {
            var user = InternalUser.Create(
                "P-90001",
                "Database Backed User",
                "db.user@example.test",
                "Engineering",
                "Officer");
            var role = InternalRole.Create(
                "R-DB-001",
                "Database Backed Role",
                "sampleModule",
                isSystem: true);
            var permission = PermissionDefinition.Create(
                "database-backed.permission",
                "sampleModule",
                "Database Backed Permission",
                "Permission loaded from IAM database.");

            dbContext.InternalUsers.Add(user);
            dbContext.InternalRoles.Add(role);
            dbContext.Permissions.Add(permission);
            dbContext.InternalUserRoles.Add(InternalUserRole.Create(user.Id, role.Id));
            dbContext.InternalRolePermissions.Add(InternalRolePermissionAssignment.Create(role.Id, permission.Id));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var usersResponse = await client.GetAsync("/api/v1/administration/users");
        using var rolesResponse = await client.GetAsync("/api/v1/administration/roles");
        using var permissionsResponse = await client.GetAsync("/api/v1/super-admin/permissions");
        using var matrixResponse = await client.GetAsync("/api/v1/administration/role-permissions");

        Assert.Equal(HttpStatusCode.OK, usersResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, rolesResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, permissionsResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, matrixResponse.StatusCode);

        var users = await usersResponse.Content.ReadFromJsonAsync<JsonElement>();
        var userItem = Assert.Single(
            users.EnumerateArray(), item => item.GetProperty("username").GetString() == "db.user");
        Assert.Equal("Database Backed User", userItem.GetProperty("fullName").GetString());
        Assert.Contains(userItem.GetProperty("roles").EnumerateArray(), role => role.GetString() == "Database Backed Role");

        var roles = await rolesResponse.Content.ReadFromJsonAsync<JsonElement>();
        var roleItem = Assert.Single(
            roles.EnumerateArray(), item => item.GetProperty("roleId").GetString() == "R-DB-001");
        Assert.Equal(1, roleItem.GetProperty("users").GetInt32());
        Assert.Equal(1, roleItem.GetProperty("permissions").GetInt32());
        Assert.True(roleItem.GetProperty("isSystem").GetBoolean());

        var permissionGroups = await permissionsResponse.Content.ReadFromJsonAsync<JsonElement>();
        var permissionGroup = Assert.Single(
            permissionGroups.EnumerateArray(), group => group.GetProperty("module").GetString() == "Sample Module");
        Assert.Contains(permissionGroup.GetProperty("permissions").EnumerateArray(), permission =>
            permission.GetProperty("key").GetString() == "database-backed.permission");

        var matrix = await matrixResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEmpty(matrix.GetProperty("roles").EnumerateArray());
        Assert.Contains(matrix.GetProperty("permissionGroups").EnumerateArray(), group =>
            group.GetProperty("module").GetString() == "Sample Module");
    }

    private sealed class IsolatedAdministrationApi : IAsyncDisposable
    {
        private readonly string _connectionString;
        private readonly string? _previousConnectionString;

        public IsolatedAdministrationApi()
        {
            var databaseName = $"SisTemplate_AdminReadTests_{Guid.NewGuid():N}";
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
                            ["SSO:Enabled"] = "false",
                            ["Auth:AllowPasswordlessDevLogin"] = "true"
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

        public async Task SeedAsync(Action<ProcurementDbContext> seed)
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            EnsureTestDatabase(dbContext);
            seed(dbContext);
            await dbContext.SaveChangesAsync();
        }

        public async Task SeedInitialIamDataAsync()
        {
            EnsureTestConnectionString();
            await Factory.Services.SeedInitialIamDataAsync();
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
            if (!connectionString.Contains("SisTemplate_AdminReadTests_", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Administration read tests must not touch the shared development database.");
            }
        }

        private void EnsureTestConnectionString()
        {
            if (!_connectionString.Contains("SisTemplate_AdminReadTests_", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Administration read tests must not touch the shared development database.");
            }
        }
    }

    private static async Task DevLoginAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new
            {
                personnelNo = "00109610",
                displayName = "USEP RUSNANDAR"
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
