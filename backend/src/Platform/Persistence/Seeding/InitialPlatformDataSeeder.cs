using System.Reflection;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SisTemplate.Platform.Administration.Domain;
using SisTemplate.Platform.Settings.Domain;

namespace SisTemplate.Platform.Persistence.Seeding;

internal static class EmbeddedSeedDataLoader
{
    private static readonly Assembly Assembly = typeof(EmbeddedSeedDataLoader).Assembly;
    private const string Prefix = "SisTemplate.Platform.Persistence.Seeding.SeedData.";

    public static string LoadRaw(string fileName)
    {
        using var stream = Assembly.GetManifestResourceStream(Prefix + fileName)
            ?? throw new InvalidOperationException($"Embedded seed '{fileName}' was not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    public static T[] LoadArray<T>(string fileName) =>
        JsonSerializer.Deserialize<T[]>(LoadRaw(fileName), new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = true
        }) ?? [];
}

public static class InitialPlatformDataSeeder
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly MasterDataSetSeed[] CoreMasterDataSeeds =
    [
        new("province", "Province", "MSTR_PROVINCE_T", "Administration", false,
            () => EmbeddedSeedDataLoader.LoadArray<ProvinceSeedRecord>("province.json")
                .Select(record => new MasterDataSeedRecord(record.ProvinceId, record.ProvinceName, "Active", string.Empty, null))
                .ToArray()),
        new("city", "City", "MSTR_CITY_T", "Administration", false,
            () => EmbeddedSeedDataLoader.LoadArray<CitySeedRecord>("city.json")
                .Select(record => new MasterDataSeedRecord(record.CityId, record.CityName, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.ProvinceId }, JsonOptions), record.ProvinceId))
                .ToArray()),
        new("district", "District", "MSTR_DISTRICT_T", "Administration", false,
            () => EmbeddedSeedDataLoader.LoadArray<DistrictSeedRecord>("district.json")
                .Select(record => new MasterDataSeedRecord(record.DistrictId, record.DistrictName, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.CityId }, JsonOptions), record.CityId))
                .ToArray()),
        new("village", "Village", "MSTR_VILLAGE_T", "Administration", false,
            () => EmbeddedSeedDataLoader.LoadArray<VillageSeedRecord>("village.json")
                .Select(record => new MasterDataSeedRecord(record.VillageId, record.VillageName, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.DistrictId }, JsonOptions), record.DistrictId))
                .ToArray()),
        new("country", "Country", "MSTR_COUNTRY_T", "Administration", false,
            () => EmbeddedSeedDataLoader.LoadArray<CountrySeedRecord>("country.json")
                .Select(record => new MasterDataSeedRecord(record.CountryCode, record.CountryName, "Active", string.Empty, null))
                .ToArray()),
        new("holiday", "Holiday", "MSTR_HOLIDAY_T", "Administration", false, () => WholeObjectRecords("holiday.json")),
    ];

    public static async Task SeedInitialPlatformDataAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        await dbContext.Database.MigrateAsync();

        foreach (var seed in CoreMasterDataSeeds)
        {
            await UpsertMasterDataSetAsync(dbContext, seed);
        }

        await SeedSettingsAsync(dbContext);
        await SeedLanguagesAsync(dbContext);
        await SeedLanguageTextAsync(dbContext);
        await SeedEmailTemplatesAsync(dbContext);
        await SeedApplicationAboutAsync(dbContext);
    }

    private static async Task UpsertMasterDataSetAsync(ProcurementDbContext dbContext, MasterDataSetSeed seed)
    {
        var now = DateTimeOffset.UtcNow;
        var set = await dbContext.MasterDataSets.SingleOrDefaultAsync(item => item.Key == seed.Key);
        if (set is null)
        {
            dbContext.MasterDataSets.Add(new MasterDataSetEntry(
                Guid.NewGuid(), seed.Key, seed.Name, seed.SourceTable, seed.Module, seed.IsReadOnly, now));
        }
        else
        {
            set.UpdateMetadata(seed.Name, seed.Module, now);
        }

        var existing = await dbContext.MasterDataRecords
            .Where(record => record.SetKey == seed.Key)
            .ToDictionaryAsync(record => record.Code, StringComparer.OrdinalIgnoreCase);
        foreach (var record in seed.BuildRecords())
        {
            if (string.IsNullOrWhiteSpace(record.Code))
            {
                continue;
            }

            if (existing.TryGetValue(record.Code, out var row))
            {
                row.Update(record.Name, record.Status, record.Description, record.PayloadJson, now, record.ParentCode);
            }
            else
            {
                dbContext.MasterDataRecords.Add(new MasterDataRecordEntry(
                    Guid.NewGuid(), seed.Key, record.Code, record.Name, record.Status, record.Description, record.PayloadJson, now, record.ParentCode));
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedSettingsAsync(ProcurementDbContext dbContext)
    {
        var now = DateTimeOffset.UtcNow;
        using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw("settings.json"));
        var existing = await dbContext.Settings.ToDictionaryAsync(item => item.Key, StringComparer.OrdinalIgnoreCase);
        foreach (var property in doc.RootElement.EnumerateObject())
        {
            if (existing.TryGetValue(property.Name, out var row))
            {
                row.UpdateValue(property.Value.GetRawText(), now);
            }
            else
            {
                dbContext.Settings.Add(new SettingEntry(Guid.NewGuid(), property.Name, property.Value.GetRawText(), now));
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedLanguagesAsync(ProcurementDbContext dbContext)
    {
        var now = DateTimeOffset.UtcNow;
        using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw("languages.json"));
        var existing = await dbContext.Languages.ToDictionaryAsync(item => item.Code, StringComparer.OrdinalIgnoreCase);
        foreach (var element in doc.RootElement.EnumerateArray())
        {
            var code = element.GetProperty("code").GetString();
            if (string.IsNullOrWhiteSpace(code))
            {
                continue;
            }

            var payload = element.GetRawText();
            if (existing.TryGetValue(code, out var row))
            {
                row.UpdatePayload(payload, now);
            }
            else
            {
                dbContext.Languages.Add(new LanguageEntry(Guid.NewGuid(), code, payload, now));
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedLanguageTextAsync(ProcurementDbContext dbContext)
    {
        var now = DateTimeOffset.UtcNow;
        using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw("language-text.json"));
        var existing = await dbContext.LanguageTextEntries.ToDictionaryAsync(item => item.TextKey, StringComparer.OrdinalIgnoreCase);
        foreach (var element in doc.RootElement.EnumerateArray())
        {
            var key = element.GetProperty("key").GetString();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            var payload = element.GetRawText();
            if (existing.TryGetValue(key, out var row))
            {
                row.UpdatePayload(payload, now);
            }
            else
            {
                dbContext.LanguageTextEntries.Add(new LanguageTextEntry(Guid.NewGuid(), key, payload, now));
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedEmailTemplatesAsync(ProcurementDbContext dbContext)
    {
        var now = DateTimeOffset.UtcNow;
        using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw("email-templates.json"));
        var existing = await dbContext.EmailTemplates.ToDictionaryAsync(item => item.TemplateId, StringComparer.OrdinalIgnoreCase);
        foreach (var element in doc.RootElement.EnumerateArray())
        {
            var id = element.GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(id))
            {
                continue;
            }

            var category = element.TryGetProperty("category", out var categoryValue)
                ? categoryValue.GetString() ?? "General"
                : "General";
            var status = element.TryGetProperty("status", out var statusValue)
                ? statusValue.GetString() ?? "Active"
                : "Active";
            var payload = element.GetRawText();
            if (existing.TryGetValue(id, out var row))
            {
                row.Update(category, status, payload, now);
            }
            else
            {
                dbContext.EmailTemplates.Add(new EmailTemplateEntry(Guid.NewGuid(), id, category, status, payload, now));
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedApplicationAboutAsync(ProcurementDbContext dbContext)
    {
        var now = DateTimeOffset.UtcNow;
        var payload = EmbeddedSeedDataLoader.LoadRaw("application-about.json");
        var entry = await dbContext.ApplicationAbout.OrderBy(item => item.CreatedAt).FirstOrDefaultAsync();
        if (entry is null)
        {
            dbContext.ApplicationAbout.Add(new ApplicationAboutEntry(Guid.NewGuid(), payload, now));
        }
        else
        {
            entry.UpdatePayload(payload, now);
        }

        await dbContext.SaveChangesAsync();
    }

    private static MasterDataSeedRecord[] WholeObjectRecords(string fileName)
    {
        using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw(fileName));
        return doc.RootElement.EnumerateArray()
            .Select(element => new MasterDataSeedRecord(
                element.GetProperty("id").GetString() ?? string.Empty,
                element.TryGetProperty("name", out var name) ? name.GetString() ?? string.Empty : string.Empty,
                "Active",
                string.Empty,
                element.GetRawText()))
            .ToArray();
    }

    private sealed record MasterDataSetSeed(string Key, string Name, string SourceTable, string Module, bool IsReadOnly, Func<MasterDataSeedRecord[]> BuildRecords);
    private sealed record MasterDataSeedRecord(string Code, string Name, string Status, string Description, string? PayloadJson, string? ParentCode = null);
    private sealed record ProvinceSeedRecord(string ProvinceId, string ProvinceName);
    private sealed record CitySeedRecord(string CityId, string CityName, string ProvinceId);
    private sealed record DistrictSeedRecord(string DistrictId, string DistrictName, string CityId);
    private sealed record VillageSeedRecord(string VillageId, string VillageName, string DistrictId);
    private sealed record CountrySeedRecord(string CountryCode, string CountryName);
}
