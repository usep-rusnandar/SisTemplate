using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class HealthEndpointTests
{
    [Fact]
    public async Task ReadyEndpointReturnsSuccessWhenDatabaseIsReachable()
    {
        await using var app = IsolatedHealthApi.CreateValid();
        await app.InitializeAsync();

        using var client = app.Factory.CreateClient();

        using var response = await client.GetAsync("/api/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Ready", payload.GetProperty("status").GetString());
        var checks = payload.GetProperty("checks");
        Assert.Equal("database", checks[0].GetProperty("name").GetString());
        Assert.Equal("Ready", checks[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task ReadyEndpointReturnsServiceUnavailableWhenDatabaseIsNotReachable()
    {
        await using var app = IsolatedHealthApi.CreateInvalid();
        using var client = app.Factory.CreateClient();

        using var response = await client.GetAsync("/api/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("NotReady", payload.GetProperty("status").GetString());
        var checks = payload.GetProperty("checks");
        Assert.Equal("database", checks[0].GetProperty("name").GetString());
        Assert.Equal("Unavailable", checks[0].GetProperty("status").GetString());
    }

    private sealed class IsolatedHealthApi : IAsyncDisposable
    {
        private readonly string _connectionString;
        private readonly string? _previousConnectionString;

        private IsolatedHealthApi(string connectionString)
        {
            _connectionString = connectionString;
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

        public static IsolatedHealthApi CreateValid()
        {
            var databaseName = $"IntegratedProcurement_HealthTests_{Guid.NewGuid():N}";
            var connectionString = $"Server=(localdb)\\MSSQLLocalDB;Database={databaseName};Trusted_Connection=True;TrustServerCertificate=True";
            return new IsolatedHealthApi(connectionString);
        }

        public static IsolatedHealthApi CreateInvalid()
        {
            var databaseName = $"IntegratedProcurement_HealthTests_Invalid_{Guid.NewGuid():N}";
            var connectionString = $"Server=127.0.0.1,65001;Database={databaseName};User Id=sa;Password=NotARealPassword123!;TrustServerCertificate=True;Connect Timeout=1";
            return new IsolatedHealthApi(connectionString);
        }

        public async Task InitializeAsync()
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            await dbContext.Database.EnsureDeletedAsync();
            await dbContext.Database.MigrateAsync();
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
