using System.Reflection;
using System.Text.Json;
using IntegratedProcurement.Platform.Administration.Domain;
using IntegratedProcurement.Platform.Settings.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Platform.Persistence.Seeding;

public static class InitialPlatformDataSeeder
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    // Master-data seed. Source data lives in the BACKEND as embedded JSON resources
    // (Seeding/SeedData/*.json) — no longer read from frontend source files at runtime.
    private static readonly MasterDataSetSeed[] CoreMasterDataSeeds =
    [
        new("province", "Province", "MSTR_PROVINCE_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<ProvinceSeedRecord>("province.json")
                .Select(record => new MasterDataSeedRecord(record.ProvinceId, record.ProvinceName, "Active", string.Empty, null))
                .ToArray()),
        new("city", "City", "MSTR_CITY_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<CitySeedRecord>("city.json")
                .Select(record => new MasterDataSeedRecord(record.CityId, record.CityName, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.ProvinceId }, JsonOptions), record.ProvinceId))
                .ToArray()),
        new("district", "District", "MSTR_DISTRICT_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<DistrictSeedRecord>("district.json")
                .Select(record => new MasterDataSeedRecord(record.DistrictId, record.DistrictName, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.CityId }, JsonOptions), record.CityId))
                .ToArray()),
        new("village", "Village", "MSTR_VILLAGE_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<VillageSeedRecord>("village.json")
                .Select(record => new MasterDataSeedRecord(record.VillageId, record.VillageName, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.DistrictId }, JsonOptions), record.DistrictId))
                .ToArray()),
        new("special-requirement", "Special Requirement", "MSTR_SPECIAL_REQUIREMENT_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<SpecialRequirementSeedRecord>("special-requirement.json")
                .Select(record => new MasterDataSeedRecord(record.SpecialReqId, record.SpecialReqDesc,
                    record.SpecialReqIsActive ? "Active" : "Inactive", string.Empty,
                    JsonSerializer.Serialize(new { record.SpecialReqIsActive, record.SpecialReqOrder }, JsonOptions)))
                .ToArray()),
        new("commodity-category", "Commodity Category", "MSTR_COMMODITY_CATEGORY_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<CategorySeedRecord>("commodity-category.json")
                .Select(record => new MasterDataSeedRecord(record.CategoryId, record.CategoryDesc, "Active", string.Empty, null))
                .ToArray()),
        new("commodity-classification", "Commodity Classification", "MSTR_COMMODITY_CLASSIFICATION_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<ClassificationSeedRecord>("commodity-classification.json")
                .Select(record => new MasterDataSeedRecord(record.ClassificationId, record.ClassificationDesc, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.CategoryId }, JsonOptions), record.CategoryId))
                .ToArray()),
        new("commodity-subclassification", "Commodity Sub-classification", "MSTR_COMMODITY_SUBCLASSIFICATION_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<SubClassificationSeedRecord>("commodity-subclassification.json")
                .Select(record => new MasterDataSeedRecord(record.SubClassificationId, record.SubClassificationDesc, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.ClassificationId }, JsonOptions), record.ClassificationId))
                .ToArray()),
        new("commodity-subclassification-kbli", "Commodity Sub-classification KBLI", "MSTR_COMMODITY_SUBCLASSIFICATION_KBLI_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<SubClassificationKbliSeedRecord>("commodity-subclassification-kbli.json")
                // Aggregate legacy pair rows into one DNF rule per sub (OR-of-singles = prior "at least one" semantics).
                .GroupBy(record => record.SubClassificationId, StringComparer.OrdinalIgnoreCase)
                .Select(group =>
                {
                    var groups = group
                        .Select(r => r.KbliId)
                        .Where(id => !string.IsNullOrWhiteSpace(id))
                        .Distinct(StringComparer.Ordinal)
                        .OrderBy(id => id, StringComparer.Ordinal)
                        .Select(id => new[] { id })
                        .ToArray();
                    return new MasterDataSeedRecord(
                        group.Key,
                        group.Key,
                        "Active",
                        string.Empty,
                        JsonSerializer.Serialize(new { SubClassificationId = group.Key, mode = "dnf", groups }, JsonOptions));
                })
                .ToArray()),
        new("commodity-subclassification-special-requirement", "Commodity Sub-classification Special Requirement", "MSTR_COMMODITY_SUBCLASSIFICATION_SPECIAL_REQ_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<SubClassificationSpecialRequirementSeedRecord>("commodity-subclassification-special-requirement.json")
                .Select(record => new MasterDataSeedRecord($"{record.SubClassificationId}|{record.SpecialReqId}", record.SpecialReqId, "Active", string.Empty,
                    JsonSerializer.Serialize(new { record.SubClassificationId, record.SpecialReqId }, JsonOptions)))
                .ToArray()),
        new("brand", "Brand", "MSTR_BRAND_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<string>("brand.json")
                .Select(name => new MasterDataSeedRecord(name, name, "Active", string.Empty, null))
                .ToArray()),
        new("kbli", "KBLI", "MSTR_KBLI_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<KbliSeedRecord>("kbli.json")
                .Select(record => new MasterDataSeedRecord(record.KbliId, record.KbliDesc, "Active", string.Empty, null))
                .ToArray()),
        new("country", "Country", "MSTR_COUNTRY_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<CountrySeedRecord>("country.json")
                .Select(record => new MasterDataSeedRecord(record.CountryCode, record.CountryName, "Active", string.Empty, null))
                .ToArray()),
        // Structured reference data — the full object is kept verbatim in PayloadJson (code = id).
        new("holiday", "Holiday", "MSTR_HOLIDAY_T", "Administration", false, () => WholeObjectRecords("holiday.json")),
        new("tracker-step", "Proposal Tracker Step", "MSTR_TRACKER_STEP_T", "Proposal Tracker", false, () => WholeObjectRecords("tracker-step.json")),
        new("tracker-method", "Proposal Tracker Method", "MSTR_TRACKER_METHOD_T", "Proposal Tracker", false, () => WholeObjectRecords("tracker-method.json")),
        // distributor-type is the same set the vendor portal reads and VendorBrand.DistributorTypeCode
        // points at, so its records are keyed by the business code (PRIN, DIST, …), not the id.
        new("distributor-type", "Distributor Type", "MSTR_DISTRIBUTOR_TYPE_T", "VendorOnboarding", false, () => CodedObjectRecords("distributor-type.json")),
        new("vendor-document-requirement", "Vendor Document Requirement", "MSTR_VENDOR_DOC_REQUIREMENT_T", "VendorOnboarding", false, () => CodedObjectRecords("vendor-document-requirement.json")),
        // VendorConnect lookup tables, split out of the old read-only viewer into their own editable
        // master-data sets. Vendor status carries a NextId lifecycle chain + order in its payload.
        // The approval route: approverRoleCode says who must act while a vendor sits on the status,
        // nextId says where approving sends it, and slaDays is the working-day target for that wait.
        new("vendor-status", "Vendor Status", "MSTR_STATUS_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<VendorStatusSeedRecord>("vendor-status.json")
                .Select(record => new MasterDataSeedRecord(record.StatusId, record.StatusName, "Active", string.Empty,
                    JsonSerializer.Serialize(new
                    {
                        description = record.StatusDesc,
                        nextId = record.NextId,
                        order = record.StatusOrder,
                        approverRoleCode = record.ApproverRoleCode,
                        slaDays = record.SlaDays,
                    }, JsonOptions)))
                .ToArray()),
        new("kbli-type", "KBLI Type", "MSTR_KBLI_TYPE_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<KbliTypeSeedRecord>("kbli-type.json")
                .Select(record => new MasterDataSeedRecord(record.KbliTypeId, record.KbliTypeDesc, "Active", string.Empty, null))
                .ToArray()),
        new("kbli-status", "KBLI Status", "MSTR_KBLI_STATUS_T", "VendorOnboarding", false,
            () => EmbeddedSeedDataLoader.LoadArray<KbliStatusSeedRecord>("kbli-status.json")
                .Select(record => new MasterDataSeedRecord(record.KbliStatusId, record.KbliStatusDesc, "Active", string.Empty, null))
                .ToArray())
    ];

    // Master-data records whose PayloadJson is the whole source object (id → Code, name → Name).
    private static MasterDataSeedRecord[] WholeObjectRecords(string fileName)
    {
        using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw(fileName));
        return doc.RootElement.EnumerateArray()
            .Select(element => new MasterDataSeedRecord(
                element.GetProperty("id").GetString() ?? string.Empty,
                element.GetProperty("name").GetString() ?? string.Empty,
                "Active",
                string.Empty,
                element.GetRawText()))
            .ToArray();
    }

    // Like WholeObjectRecords, but keys each record by the business `code` (e.g. PRIN, NIB) rather
    // than the id — used where the record code is referenced elsewhere (VendorBrand.DistributorTypeCode,
    // the vendor portal dropdowns, and the admin master upsert/delete keys).
    private static MasterDataSeedRecord[] CodedObjectRecords(string fileName)
    {
        using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw(fileName));
        return doc.RootElement.EnumerateArray()
            .Select(element => new MasterDataSeedRecord(
                element.GetProperty("code").GetString() ?? string.Empty,
                element.GetProperty("name").GetString() ?? string.Empty,
                "Active",
                string.Empty,
                element.GetRawText()))
            .ToArray();
    }

    public static async Task SeedInitialPlatformDataAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        await dbContext.Database.MigrateAsync();
        await SeedMasterDataAsync(dbContext);
        await SyncTrackerProcessModelFromSeedAsync(dbContext);
        // EnsureMasterDataSeedAsync skips once any row exists — keep curated labels in sync with seed.
        await SyncMasterDataSetFromSeedAsync(dbContext, "distributor-type", () => CodedObjectRecords("distributor-type.json"));
        await SyncMasterDataSetFromSeedAsync(dbContext, "vendor-document-requirement", () => CodedObjectRecords("vendor-document-requirement.json"));
        await SyncMasterDataSetFromSeedAsync(dbContext, "kbli", () =>
            EmbeddedSeedDataLoader.LoadArray<KbliSeedRecord>("kbli.json")
                .Select(record => new MasterDataSeedRecord(record.KbliId, record.KbliDesc, "Active", string.Empty, null))
                .ToArray());
        await SyncMasterDataSetFromSeedAsync(dbContext, "kbli-type", () =>
            EmbeddedSeedDataLoader.LoadArray<KbliTypeSeedRecord>("kbli-type.json")
                .Select(record => new MasterDataSeedRecord(record.KbliTypeId, record.KbliTypeDesc, "Active", string.Empty, null))
                .ToArray());
        await SyncMasterDataSetFromSeedAsync(dbContext, "kbli-status", () =>
            EmbeddedSeedDataLoader.LoadArray<KbliStatusSeedRecord>("kbli-status.json")
                .Select(record => new MasterDataSeedRecord(record.KbliStatusId, record.KbliStatusDesc, "Active", string.Empty, null))
                .ToArray());
        // Commodity sets skip EnsureMasterDataSeedAsync once any row exists; upsert production-captured
        // codes/labels without deleting extra rows an administrator may have added later.
        foreach (var key in new[]
        {
            "commodity-category",
            "commodity-classification",
            "commodity-subclassification",
            "commodity-subclassification-kbli",
            "commodity-subclassification-special-requirement",
        })
        {
            var definition = CoreMasterDataSeeds.First(seed => seed.Key == key);
            await SyncMasterDataSetFromSeedAsync(dbContext, definition.Key, () => definition.BuildRecords().ToArray());
        }
        await SeedConfigurationAsync(dbContext);
    }

    /// <summary>
    /// Upsert master-data records for a set from seed (e.g. Principal → Brand Owner, Belum TerBit → Belum Terbit).
    /// </summary>
    private static async Task SyncMasterDataSetFromSeedAsync(
        ProcurementDbContext dbContext,
        string setKey,
        Func<MasterDataSeedRecord[]> buildRecords)
    {
        var seedRecords = buildRecords();
        if (seedRecords.Length == 0)
        {
            return;
        }

        var timestamp = DateTimeOffset.UtcNow;
        var existing = await dbContext.MasterDataRecords
            .Where(record => record.SetKey == setKey)
            .ToListAsync();
        var byCode = existing.ToDictionary(record => record.Code, StringComparer.OrdinalIgnoreCase);
        var changed = false;

        foreach (var seed in seedRecords)
        {
            if (string.IsNullOrWhiteSpace(seed.Code))
            {
                continue;
            }

            if (byCode.TryGetValue(seed.Code, out var row))
            {
                if (!string.Equals(row.Name, seed.Name, StringComparison.Ordinal)
                    || !string.Equals(row.PayloadJson ?? string.Empty, seed.PayloadJson ?? string.Empty, StringComparison.Ordinal)
                    || !string.Equals(row.ParentCode ?? string.Empty, seed.ParentCode ?? string.Empty, StringComparison.Ordinal))
                {
                    row.Update(seed.Name, seed.Status, seed.Description, seed.PayloadJson, timestamp, seed.ParentCode);
                    changed = true;
                }
            }
            else
            {
                dbContext.MasterDataRecords.Add(new MasterDataRecordEntry(
                    Guid.NewGuid(),
                    setKey,
                    seed.Code,
                    seed.Name,
                    seed.Status,
                    seed.Description,
                    seed.PayloadJson,
                    timestamp,
                    seed.ParentCode));
                changed = true;
            }
        }

        if (changed)
        {
            await dbContext.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Tracker step/method are a system process model: keep DB rows aligned with embedded seed
    /// (code/name/payload), including sortOrder and TERM-before-LOA SLA keys.
    /// Does not delete admin-added extra rows; only upserts known seed codes.
    /// </summary>
    private static async Task SyncTrackerProcessModelFromSeedAsync(ProcurementDbContext dbContext)
    {
        var timestamp = DateTimeOffset.UtcNow;
        foreach (var setKey in new[] { "tracker-step", "tracker-method" })
        {
            var fileName = setKey + ".json";
            var seedRecords = WholeObjectRecords(fileName);
            if (seedRecords.Length == 0)
            {
                continue;
            }

            var existing = await dbContext.MasterDataRecords
                .Where(record => record.SetKey == setKey)
                .ToListAsync();
            var byCode = existing.ToDictionary(record => record.Code, StringComparer.OrdinalIgnoreCase);

            foreach (var seed in seedRecords)
            {
                if (string.IsNullOrWhiteSpace(seed.Code))
                {
                    continue;
                }

                if (byCode.TryGetValue(seed.Code, out var row))
                {
                    if (!string.Equals(row.Name, seed.Name, StringComparison.Ordinal)
                        || !string.Equals(row.PayloadJson ?? string.Empty, seed.PayloadJson ?? string.Empty, StringComparison.Ordinal)
                        || !string.Equals(row.Status, seed.Status, StringComparison.Ordinal))
                    {
                        row.Update(seed.Name, seed.Status, seed.Description, seed.PayloadJson, timestamp, seed.ParentCode);
                    }
                }
                else
                {
                    dbContext.MasterDataRecords.Add(new MasterDataRecordEntry(
                        Guid.NewGuid(),
                        setKey,
                        seed.Code,
                        seed.Name,
                        seed.Status,
                        seed.Description,
                        seed.PayloadJson,
                        timestamp,
                        seed.ParentCode));
                }
            }

            await dbContext.SaveChangesAsync();
        }
    }

    // Settings, languages, language text, and email templates — seed source moved from the frontend
    // into backend embedded JSON. Stored exactly as the admin PUT endpoints would (per-key rows for
    // settings; payloadJson verbatim keyed by code/key/id for the others). Idempotent per table.
    private static async Task SeedConfigurationAsync(ProcurementDbContext dbContext)
    {
        var now = DateTimeOffset.UtcNow;

        // Additive backfill: add any settings key from the seed that isn't already stored, without
        // touching keys the admin has since edited. This lets NEW keys (e.g. per-module from_/mailbox_)
        // land on an already-seeded database without a reset — not just on a fresh, empty table.
        {
            var existingKeys = new HashSet<string>(
                await dbContext.Settings.Select(entry => entry.Key).ToListAsync(),
                StringComparer.OrdinalIgnoreCase);
            using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw("settings.json"));
            string? seedBaseUrlRaw = null;
            var seedFromByKey = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var added = false;
            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (string.Equals(property.Name, "baseUrl", StringComparison.OrdinalIgnoreCase))
                {
                    seedBaseUrlRaw = property.Value.GetRawText();
                }

                if (property.Name.StartsWith("from_", StringComparison.OrdinalIgnoreCase))
                {
                    seedFromByKey[property.Name] = property.Value.GetRawText();
                }

                if (existingKeys.Contains(property.Name))
                {
                    continue;
                }

                dbContext.Settings.Add(new SettingEntry(Guid.NewGuid(), property.Name, property.Value.GetRawText(), now));
                added = true;
            }

            if (added)
            {
                await dbContext.SaveChangesAsync();
            }

            // Previous seed reused the SSO app path (SISwarrior) as the email API base. Rewrite only that
            // exact leftover so a custom admin URL is never overwritten.
            if (seedBaseUrlRaw is not null)
            {
                var baseUrl = await dbContext.Settings.SingleOrDefaultAsync(entry => entry.Key == "baseUrl");
                var current = baseUrl is null ? null : JsonSerializer.Deserialize<string>(baseUrl.ValueJson);
                var retired = "https://app-saptaindra.msappproxy.net/SISwarrior";
                if (baseUrl is not null
                    && string.Equals((current ?? string.Empty).Trim().TrimEnd('/'), retired, StringComparison.OrdinalIgnoreCase))
                {
                    baseUrl.UpdateValue(seedBaseUrlRaw, now);
                    await dbContext.SaveChangesAsync();
                }
            }

            // Previous seed sent every module from procurement@. Rewrite only that leftover so a
            // Super Admin From that was later customized is never overwritten.
            const string retiredFrom = "procurement@saptaindra.co.id";
            var fromRewritten = false;
            foreach (var (key, seedRaw) in seedFromByKey)
            {
                var entry = await dbContext.Settings.SingleOrDefaultAsync(item => item.Key == key);
                var current = entry is null ? null : JsonSerializer.Deserialize<string>(entry.ValueJson);
                if (entry is not null
                    && string.Equals((current ?? string.Empty).Trim(), retiredFrom, StringComparison.OrdinalIgnoreCase))
                {
                    entry.UpdateValue(seedRaw, now);
                    fromRewritten = true;
                }
            }

            if (fromRewritten)
            {
                await dbContext.SaveChangesAsync();
            }

            // Global toTest predates per-module toTest_{slug}. It is no longer read or shown.
            var obsoleteGlobalToTest = await dbContext.Settings.SingleOrDefaultAsync(entry => entry.Key == "toTest");
            if (obsoleteGlobalToTest is not null)
            {
                dbContext.Settings.Remove(obsoleteGlobalToTest);
                await dbContext.SaveChangesAsync();
            }
        }

        // About Application document — keep aligned with embedded seed until a dedicated admin
        // editor exists (no UI writer yet, so seed remains the source of truth).
        {
            var payload = EmbeddedSeedDataLoader.LoadRaw("application-about.json");
            var existing = await dbContext.ApplicationAbout.OrderBy(entry => entry.CreatedAt).FirstOrDefaultAsync();
            if (existing is null)
            {
                dbContext.ApplicationAbout.Add(new ApplicationAboutEntry(Guid.NewGuid(), payload, now));
            }
            else if (!string.Equals(existing.PayloadJson, payload, StringComparison.Ordinal))
            {
                existing.UpdatePayload(payload, now);
            }

            await dbContext.SaveChangesAsync();
        }

        if (!await dbContext.Languages.AnyAsync())
        {
            using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw("languages.json"));
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                dbContext.Languages.Add(new LanguageEntry(Guid.NewGuid(), element.GetProperty("code").GetString() ?? string.Empty, element.GetRawText(), now));
            }

            await dbContext.SaveChangesAsync();
        }

        if (!await dbContext.LanguageTextEntries.AnyAsync())
        {
            using var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw("language-text.json"));
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                dbContext.LanguageTextEntries.Add(new LanguageTextEntry(Guid.NewGuid(), element.GetProperty("key").GetString() ?? string.Empty, element.GetRawText(), now));
            }

            await dbContext.SaveChangesAsync();
        }

        // Add newly introduced system templates without overwriting administrator-edited copy. When a
        // shipped default is revised, upgrade it only when the stored JSON still exactly matches the
        // previous system default. Any edit made in Email Template therefore remains authoritative.
        var existingEmailTemplates = await dbContext.EmailTemplates.ToListAsync();
        var existingEmailTemplatesById = existingEmailTemplates.ToDictionary(
            template => template.TemplateId,
            StringComparer.OrdinalIgnoreCase);
        using var previousDefaultsDocument = JsonDocument.Parse(
            EmbeddedSeedDataLoader.LoadRaw("email-template-defaults-v1.json"));
        var previousDefaultsById = previousDefaultsDocument.RootElement
            .EnumerateArray()
            .Where(element => element.TryGetProperty("id", out _))
            .ToDictionary(
                element => element.GetProperty("id").GetString() ?? string.Empty,
                element => element.Clone(),
                StringComparer.OrdinalIgnoreCase);
        using (var doc = JsonDocument.Parse(EmbeddedSeedDataLoader.LoadRaw("email-templates.json")))
        {
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                var templateId = element.GetProperty("id").GetString() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(templateId))
                {
                    continue;
                }

                var category = element.TryGetProperty("category", out var c) ? c.GetString() ?? string.Empty : string.Empty;
                var status = element.TryGetProperty("status", out var s) ? s.GetString() ?? string.Empty : string.Empty;
                if (existingEmailTemplatesById.TryGetValue(templateId, out var existingTemplate))
                {
                    if (previousDefaultsById.TryGetValue(templateId, out var previousDefault)
                        && JsonPayloadEquals(existingTemplate.PayloadJson, previousDefault))
                    {
                        existingTemplate.Update(category, status, element.GetRawText(), now);
                    }

                    continue;
                }

                var newTemplate = new EmailTemplateEntry(
                    Guid.NewGuid(), templateId, category, status, element.GetRawText(), now);
                dbContext.EmailTemplates.Add(newTemplate);
                existingEmailTemplatesById[templateId] = newTemplate;
            }

            await dbContext.SaveChangesAsync();
        }

        // Display rename: legacy email category "Tracker" → "Proposal Tracker" (column + payload).
        var renamed = false;
        foreach (var template in await dbContext.EmailTemplates
                     .Where(item => item.Category == "Tracker")
                     .ToListAsync())
        {
            var payload = template.PayloadJson
                .Replace("\"category\": \"Tracker\"", "\"category\": \"Proposal Tracker\"", StringComparison.Ordinal)
                .Replace("\"category\":\"Tracker\"", "\"category\":\"Proposal Tracker\"", StringComparison.Ordinal);
            template.Update("Proposal Tracker", template.Status, payload, now);
            renamed = true;
        }

        if (renamed)
        {
            await dbContext.SaveChangesAsync();
        }
    }

    private static bool JsonPayloadEquals(string payloadJson, JsonElement expected)
    {
        try
        {
            using var current = JsonDocument.Parse(payloadJson);
            return JsonElement.DeepEquals(current.RootElement, expected);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    // Hierarchical master-data sets: the parent id was originally seeded only inside PayloadJson, leaving
    // the ParentCode column null so the cascade endpoint (filters on ParentCode) returned nothing (e.g.
    // City empty after picking a Province). Key = set, value = the parent id property inside PayloadJson.
    private static readonly (string SetKey, string ParentProperty)[] HierarchicalParentSeeds =
    [
        ("city", "ProvinceId"),
        ("district", "CityId"),
        ("village", "DistrictId"),
        ("commodity-classification", "CategoryId"),
        ("commodity-subclassification", "ClassificationId"),
    ];

    private static async Task SeedMasterDataAsync(ProcurementDbContext dbContext)
    {
        foreach (var seed in CoreMasterDataSeeds)
        {
            await EnsureMasterDataSeedAsync(dbContext, seed);
        }

        await BackfillHierarchicalParentCodesAsync(dbContext);
    }

    // Idempotent repair for databases seeded before ParentCode was populated. The set-seed step above is
    // skipped once records exist, so newly-fixed builders never reach an already-seeded DB — this fills
    // the ParentCode column from the parent id stored in PayloadJson. Runs only when a null remains.
    private static async Task BackfillHierarchicalParentCodesAsync(ProcurementDbContext dbContext)
    {
        var timestamp = DateTimeOffset.UtcNow;
        foreach (var (setKey, parentProperty) in HierarchicalParentSeeds)
        {
            var needsBackfill = await dbContext.MasterDataRecords
                .AnyAsync(record => record.SetKey == setKey && record.ParentCode == null);
            if (!needsBackfill)
            {
                continue;
            }

            var records = await dbContext.MasterDataRecords
                .Where(record => record.SetKey == setKey && record.ParentCode == null)
                .ToListAsync();

            var updated = false;
            foreach (var record in records)
            {
                var parentCode = ExtractPayloadValue(record.PayloadJson, parentProperty);
                if (string.IsNullOrWhiteSpace(parentCode))
                {
                    continue;
                }

                record.Update(record.Name, record.Status, record.Description, record.PayloadJson, timestamp, parentCode);
                updated = true;
            }

            if (updated)
            {
                await dbContext.SaveChangesAsync();
            }
        }
    }

    // Case-insensitive read of a scalar property from a PayloadJson object (seed writes camelCase, the
    // wilayah.id sync writes PascalCase — accept either).
    private static string? ExtractPayloadValue(string? payloadJson, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (!string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                return property.Value.ValueKind == JsonValueKind.String
                    ? property.Value.GetString()
                    : property.Value.ToString();
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private static async Task EnsureMasterDataSeedAsync(ProcurementDbContext dbContext, MasterDataSetSeed seed)
    {
        var timestamp = DateTimeOffset.UtcNow;
        var set = await dbContext.MasterDataSets.SingleOrDefaultAsync(item => item.Key == seed.Key);
        if (set is null)
        {
            set = new MasterDataSetEntry(
                Guid.NewGuid(),
                seed.Key,
                seed.Name,
                seed.TableName,
                seed.Owner,
                seed.IsReadOnly,
                timestamp);
            dbContext.MasterDataSets.Add(set);
            await dbContext.SaveChangesAsync();
        }
        else if (!string.Equals(set.Name, seed.Name, StringComparison.Ordinal)
                 || !string.Equals(set.Owner, seed.Owner, StringComparison.Ordinal))
        {
            set.UpdateMetadata(seed.Name, seed.Owner, timestamp);
            await dbContext.SaveChangesAsync();
        }

        var hasAnyRecord = await dbContext.MasterDataRecords.AnyAsync(item => item.SetKey == seed.Key);
        if (hasAnyRecord)
        {
            return;
        }

        var records = seed.BuildRecords();
        foreach (var record in records)
        {
            if (string.IsNullOrWhiteSpace(record.Code) || string.IsNullOrWhiteSpace(record.Name))
            {
                continue;
            }

            dbContext.MasterDataRecords.Add(new MasterDataRecordEntry(
                Guid.NewGuid(),
                seed.Key,
                record.Code,
                record.Name,
                record.Status,
                record.Description,
                record.PayloadJson,
                timestamp,
                record.ParentCode));
        }

        await dbContext.SaveChangesAsync();
    }

    private sealed record MasterDataSetSeed(
        string Key,
        string Name,
        string TableName,
        string Owner,
        bool IsReadOnly,
        Func<IReadOnlyCollection<MasterDataSeedRecord>> BuildRecords);

    private sealed record MasterDataSeedRecord(
        string Code,
        string Name,
        string Status,
        string Description,
        string? PayloadJson,
        string? ParentCode = null);

    private sealed record ProvinceSeedRecord(string ProvinceId, string ProvinceName);

    private sealed record CitySeedRecord(string CityId, string CityName, string ProvinceId);

    private sealed record DistrictSeedRecord(string DistrictId, string DistrictName, string CityId);

    private sealed record VillageSeedRecord(string VillageId, string DistrictId, string VillageName);

    private sealed record SpecialRequirementSeedRecord(
        string SpecialReqId,
        string SpecialReqDesc,
        bool SpecialReqIsActive,
        int SpecialReqOrder);

    private sealed record CategorySeedRecord(string CategoryId, string CategoryDesc);

    private sealed record ClassificationSeedRecord(string ClassificationId, string ClassificationDesc, string CategoryId);

    private sealed record SubClassificationSeedRecord(string SubClassificationId, string SubClassificationDesc, string ClassificationId);

    private sealed record SubClassificationKbliSeedRecord(string SubClassificationId, string KbliId);

    private sealed record SubClassificationSpecialRequirementSeedRecord(string SubClassificationId, string SpecialReqId);

    private sealed record KbliSeedRecord(string KbliId, string KbliDesc);

    private sealed record CountrySeedRecord(string CountryCode, string CountryName);

    private sealed record VendorStatusSeedRecord(
        string StatusId,
        string StatusName,
        string StatusDesc,
        string NextId,
        int StatusOrder,
        string? ApproverRoleCode = null,
        int? SlaDays = null);

    private sealed record KbliTypeSeedRecord(string KbliTypeId, string KbliTypeDesc);

    private sealed record KbliStatusSeedRecord(string KbliStatusId, string KbliStatusDesc);
}

internal static class EmbeddedSeedDataLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly Assembly Assembly = typeof(EmbeddedSeedDataLoader).Assembly;

    // Loads an embedded seed resource (Seeding/SeedData/<fileName>) shipped inside this assembly.
    public static IReadOnlyCollection<T> LoadArray<T>(string fileName)
    {
        var resourceName = Assembly.GetManifestResourceNames()
            .FirstOrDefault(name => name.EndsWith("." + fileName, StringComparison.OrdinalIgnoreCase))
            ?? throw new FileNotFoundException($"Embedded seed resource '{fileName}' was not found.");

        using var stream = Assembly.GetManifestResourceStream(resourceName)
            ?? throw new FileNotFoundException($"Embedded seed resource stream '{resourceName}' could not be opened.");

        return JsonSerializer.Deserialize<T[]>(stream, JsonOptions) ?? [];
    }

    // Raw text of an embedded seed resource (for object/verbatim payloads, e.g. settings + config).
    public static string LoadRaw(string fileName)
    {
        var resourceName = Assembly.GetManifestResourceNames()
            .FirstOrDefault(name => name.EndsWith("." + fileName, StringComparison.OrdinalIgnoreCase))
            ?? throw new FileNotFoundException($"Embedded seed resource '{fileName}' was not found.");

        using var stream = Assembly.GetManifestResourceStream(resourceName)
            ?? throw new FileNotFoundException($"Embedded seed resource stream '{resourceName}' could not be opened.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
