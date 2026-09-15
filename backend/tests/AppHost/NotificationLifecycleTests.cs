using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Notifications start empty (no dummy seed) and are produced by real system events. Distributing a
/// tracker proposal raises a module notification that the actor can read and then dismiss.
/// </summary>
public sealed class NotificationLifecycleTests
{
    [Fact]
    public async Task NotificationsStartEmptyThenReflectSystemEventsAndStateChanges()
    {
        await using var app = new IsolatedNotificationApi();
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        await app.SeedAsync(dbContext =>
        {
            dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(),
                "NTF-TRK-001",
                "PR-NTF-001",
                "Notification source proposal",
                "ARIBA-NTF",
                "Services",
                "ADMO",
                "Engineering",
                "Contractual",
                "Service Agreement",
                100_000_000m,
                "standard",
                "Distribution",
                "Activity 1",
                "High",
                "Section Head",
                "Officer",
                new DateOnly(2026, 7, 1),
                0,
                10,
                0,
                "{}"));
            dbContext.TrackerProposalActivities.Add(new TrackerProposalActivity(
                Guid.NewGuid(),
                "NTF-TRK-001",
                "ACT-001",
                "stage-1",
                "Activity 1",
                "Officer",
                "Pending",
                2,
                2,
                new DateOnly(2026, 6, 24),
                null,
                null,
                0,
                null,
                "{}"));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        var empty = await client.GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        Assert.Equal(0, empty.GetProperty("items").GetArrayLength());
        Assert.Equal(0, empty.GetProperty("unread").GetInt32());

        using var distribute = await client.PostAsJsonAsync(
            "/api/v1/proposal-tracker/proposals/NTF-TRK-001/distribute",
            new { assignedOfficerName = "ALDJI ISMAIL KAHAR" });
        Assert.Equal(HttpStatusCode.OK, distribute.StatusCode);

        var afterEvent = await client.GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        var item = Assert.Single(afterEvent.GetProperty("items").EnumerateArray());
        Assert.Equal(1, afterEvent.GetProperty("unread").GetInt32());
        Assert.False(item.GetProperty("read").GetBoolean());
        Assert.Contains("distributed", item.GetProperty("title").GetString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("role", item.GetProperty("audience").GetProperty("scope").GetString());
        var notificationId = item.GetProperty("id").GetString();

        using var read = await client.PostAsync($"/api/v1/notifications/{notificationId}/read", content: null);
        Assert.Equal(HttpStatusCode.NoContent, read.StatusCode);

        var afterRead = await client.GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        Assert.Equal(0, afterRead.GetProperty("unread").GetInt32());
        Assert.True(afterRead.GetProperty("items").EnumerateArray().Single().GetProperty("read").GetBoolean());

        using var dismiss = await client.DeleteAsync($"/api/v1/notifications/{notificationId}");
        Assert.Equal(HttpStatusCode.NoContent, dismiss.StatusCode);

        var afterDismiss = await client.GetFromJsonAsync<JsonElement>("/api/v1/notifications");
        Assert.Equal(0, afterDismiss.GetProperty("items").GetArrayLength());
    }

    private static async Task DevLoginAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo = "00109610", displayName = "USEP RUSNANDAR" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class IsolatedNotificationApi : IAsyncDisposable
    {
        private readonly string _connectionString;
        private readonly string? _previousConnectionString;

        public IsolatedNotificationApi()
        {
            var databaseName = $"IntegratedProcurement_NotificationTests_{Guid.NewGuid():N}";
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
            if (!connectionString.Contains("IntegratedProcurement_NotificationTests_", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Notification tests must not touch the shared development database.");
            }
        }

        private void EnsureTestConnectionString()
        {
            if (!_connectionString.Contains("IntegratedProcurement_NotificationTests_", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Notification tests must not touch the shared development database.");
            }
        }
    }
}
