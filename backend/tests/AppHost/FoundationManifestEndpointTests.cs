using System.Net;
using System.Net.Http.Json;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class FoundationManifestEndpointTests : IClassFixture<IsolatedApiFixture>
{
    private readonly IsolatedApiFixture _factory;

    public FoundationManifestEndpointTests(IsolatedApiFixture factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task FoundationManifestReturnsModuleContracts()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/v1/platform/foundation-manifest");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<FoundationManifestResponse>();
        Assert.NotNull(payload);
        Assert.Contains(payload.Modules, module => module.Key == "proposalTracker" && module.Route == "/proposal-tracker");
        Assert.Contains(payload.Modules, module => module.Key == "contractInitiationPlatform");
        Assert.Contains(payload.Modules, module => module.Key == "contractMonitoring");
    }

    // Naming-convention guard: module keys are camelCase (identifier), routes are kebab-case (URL).
    // Prevents regressing to the mixed cip/contract-monitoring/contractMon spellings.
    [Fact]
    public async Task ModuleKeysAreCamelCaseAndRoutesAreKebabCase()
    {
        using var client = _factory.CreateClient();
        var payload = await client.GetFromJsonAsync<FoundationManifestResponse>("/api/v1/platform/foundation-manifest");
        Assert.NotNull(payload);

        foreach (var module in payload.Modules)
        {
            Assert.Matches("^[a-z][a-zA-Z]*$", module.Key);   // camelCase, no hyphen/underscore/abbreviation-casing
            Assert.Matches("^/[a-z][a-z-]*$", module.Route);  // kebab-case URL
        }
    }

    // Verifies the platform seeder loads master data from the BACKEND embedded JSON resources
    // (Seeding/SeedData/*.json) — the frontend source files are gone.
    [Fact]
    public async Task PlatformSeederLoadsMasterDataFromEmbeddedResources()
    {
        using var scope = _factory.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();

        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "province") >= 30);
        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "brand") >= 300);
        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "kbli") >= 400);
        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "country") >= 190);
        // Structured reference data also moved to backend master-data sets.
        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "holiday") >= 19);
        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "tracker-step") >= 8);
        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "distributor-type") >= 4);
        Assert.True(await db.MasterDataSets.CountAsync() >= 18);

        // Config seed (settings/languages/language-text/email-templates) also moved to backend embedded JSON.
        Assert.True(await db.Settings.CountAsync() >= 20);
        Assert.True(await db.Languages.CountAsync() >= 2);
        Assert.True(await db.LanguageTextEntries.CountAsync() >= 20);
        Assert.True(await db.EmailTemplates.CountAsync() >= 15);
    }

    private sealed record FoundationManifestResponse(IReadOnlyCollection<FoundationModule> Modules);

    private sealed record FoundationModule(string Key, string Route);
}
