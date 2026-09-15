using SisTemplate.Platform.Persistence;
using SisTemplate.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace SisTemplate.AppHost.Api.IntegrationTests;

/// <summary>
/// Like <see cref="IsolatedApiFixture"/> but boots the API with <c>SSO:Enabled=true</c> and the
/// SISWarrior portal settings, so tests can exercise the real <c>SsoMiddleware</c> token flow
/// (anonymous redirect, <c>?token=</c> callback, expiry, NRP mapping). Uses its own isolated
/// per-run LocalDB database — never the shared development/Azure database.
/// </summary>
public sealed class SsoEnabledApiFixture : IAsyncLifetime
{
    public const string SsoUrl = "https://sso.example.test/SISwarrior/auth/redirect";
    public const string ApplicationUrl = "https://procurement.example.test/";
    public const string Application = "SisTemplate";

    private readonly string _connectionString;

    public SsoEnabledApiFixture()
    {
        var databaseName = $"SisTemplate_SsoApiTests_{Guid.NewGuid():N}";
        _connectionString = $"Server=(localdb)\\MSSQLLocalDB;Database={databaseName};Trusted_Connection=True;TrustServerCertificate=True";

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
                        ["SSO:Enabled"] = "true",
                        ["SSO:SsoUrl"] = SsoUrl,
                        ["SSO:ApplicationUrl"] = ApplicationUrl,
                        ["SSO:Application"] = Application,
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
    }

    private static void EnsureTestDatabase(ProcurementDbContext dbContext)
    {
        var connectionString = dbContext.Database.GetConnectionString() ?? string.Empty;
        if (!connectionString.Contains("SisTemplate_SsoApiTests_", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("SSO API tests must not touch the shared development database.");
        }
    }
}
