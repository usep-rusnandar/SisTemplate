using System.Net;
using System.Net.Http.Json;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace SisTemplate.AppHost.Api.IntegrationTests;

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
        Assert.Contains(payload.Modules, module => module.Key == "administration" && module.Route == "/administration");
        Assert.Contains(payload.Modules, module => module.Key == "masterData" && module.Route == "/master-data");
        Assert.Contains(payload.Modules, module => module.Key == "superAdmin" && module.Route == "/super-admin");
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
        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "country") >= 190);
        Assert.True(await db.MasterDataRecords.CountAsync(r => r.SetKey == "holiday") >= 19);
        Assert.True(await db.MasterDataSets.CountAsync() >= 6);

        // Config seed (settings/languages/language-text/email-templates) also moved to backend embedded JSON.
        Assert.True(await db.Settings.CountAsync() >= 5);
        Assert.True(await db.Languages.CountAsync() >= 2);
        Assert.True(await db.LanguageTextEntries.CountAsync() >= 5);
        Assert.True(await db.EmailTemplates.CountAsync() >= 1);
    }

    private sealed record FoundationManifestResponse(IReadOnlyCollection<FoundationModule> Modules);

    private sealed record FoundationModule(string Key, string Route);
}
