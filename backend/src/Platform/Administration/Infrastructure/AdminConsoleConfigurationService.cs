using System.Text.Json;
using SisTemplate.Platform.Administration.Application;
using SisTemplate.Platform.Administration.Domain;
using SisTemplate.Platform.Persistence;
using SisTemplate.Platform.Settings.Domain;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.Administration.Infrastructure;

public sealed class AdminConsoleConfigurationService : IAdminConsoleConfigurationService
{
    private readonly ProcurementDbContext _dbContext;

    public AdminConsoleConfigurationService(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<MenuTreeResult> GetMenuTreeAsync(CancellationToken cancellationToken)
    {
        var entry = await _dbContext.MenuTrees
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.MenuKey == "internal", cancellationToken);

        return entry is null
            ? new MenuTreeResult(null, false, null)
            : new MenuTreeResult(entry.PayloadJson, true, entry.UpdatedAt);
    }

    public async Task<MenuTreeMutationResult> SaveMenuTreeAsync(string payloadJson, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var entry = await _dbContext.MenuTrees.SingleOrDefaultAsync(item => item.MenuKey == "internal", cancellationToken);
        if (entry is null)
        {
            entry = new MenuTreeEntry(Guid.NewGuid(), "internal", payloadJson, now);
            _dbContext.MenuTrees.Add(entry);
        }
        else
        {
            entry.UpdatePayload(payloadJson, now);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new MenuTreeMutationResult(entry.PayloadJson, true, entry.UpdatedAt);
    }

    public async Task<SettingsResult> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await _dbContext.Settings
            .AsNoTracking()
            .OrderBy(item => item.Key)
            .ToArrayAsync(cancellationToken);
        if (settings.Length == 0)
        {
            return new SettingsResult(null, false, null);
        }

        var values = settings.ToDictionary(
            setting => setting.Key,
            setting => JsonSerializer.Deserialize<JsonElement>(setting.ValueJson, AdminConsoleJson.SerializerOptions));
        var updatedAt = settings.Max(setting => setting.UpdatedAt);
        return new SettingsResult(values, true, updatedAt);
    }

    public async Task<SettingsMutationResult> SaveSettingsAsync(IReadOnlyDictionary<string, JsonElement> values, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var (key, value) in values)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            var trimmedKey = key.Trim();
            if (string.Equals(trimmedKey, "toTest", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var valueJson = value.GetRawText();
            var entry = await _dbContext.Settings.SingleOrDefaultAsync(item => item.Key == trimmedKey, cancellationToken);
            if (entry is null)
            {
                _dbContext.Settings.Add(new SettingEntry(Guid.NewGuid(), trimmedKey, valueJson, now));
            }
            else
            {
                entry.UpdateValue(valueJson, now);
            }
        }

        var obsoleteGlobalToTest = await _dbContext.Settings
            .SingleOrDefaultAsync(item => item.Key == "toTest", cancellationToken);
        if (obsoleteGlobalToTest is not null)
        {
            _dbContext.Settings.Remove(obsoleteGlobalToTest);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        var snapshot = await GetSettingsAsync(cancellationToken);
        return new SettingsMutationResult(snapshot.Values, snapshot.HasData, snapshot.UpdatedAt);
    }
}

internal static class AdminConsoleJson
{
    public static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
}
