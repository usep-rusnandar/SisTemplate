using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Class fixture that boots the API against an isolated per-run LocalDB database (never the shared
/// development/Azure database), applies the current EF migrations, and seeds the initial IAM data.
/// Used by endpoint tests that exercise the real app pipeline without managing their own database.
/// </summary>
public sealed class IsolatedApiFixture : IAsyncLifetime
{
    private readonly string _connectionString;
    private readonly string? _previousConnectionString;

    public IsolatedApiFixture()
    {
        var databaseName = $"IntegratedProcurement_InternalApiTests_{Guid.NewGuid():N}";
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

    public HttpClient CreateClient() => Factory.CreateClient();

    public HttpClient CreateClient(WebApplicationFactoryClientOptions options) => Factory.CreateClient(options);

    public async Task InitializeAsync()
    {
        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            EnsureTestDatabase(dbContext);
            await dbContext.Database.EnsureDeletedAsync();
            await dbContext.Database.MigrateAsync();
        }

        await Factory.Services.SeedInitialIamDataAsync();
        await Factory.Services.SeedInitialPlatformDataAsync();
    }

    public async Task DisposeAsync()
    {
        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            EnsureTestDatabase(dbContext);
            await dbContext.Database.EnsureDeletedAsync();
        }

        await Factory.DisposeAsync();
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _previousConnectionString);
    }

    private static void EnsureTestDatabase(ProcurementDbContext dbContext)
    {
        var connectionString = dbContext.Database.GetConnectionString() ?? string.Empty;
        if (!connectionString.Contains("IntegratedProcurement_InternalApiTests_", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Internal API tests must not touch the shared development database.");
        }
    }
}
