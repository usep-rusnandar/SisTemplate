using System.Text.Json;

namespace SisTemplate.Platform.Administration.Application;

/// <summary>
/// Reads and writes administration configuration: the internal menu tree and the Super Admin settings
/// bag. Returns framework-agnostic result records (JSON payload / value dictionaries).
/// </summary>
public interface IAdminConsoleConfigurationService
{
    Task<MenuTreeResult> GetMenuTreeAsync(CancellationToken cancellationToken);

    Task<MenuTreeMutationResult> SaveMenuTreeAsync(string payloadJson, CancellationToken cancellationToken);

    Task<SettingsResult> GetSettingsAsync(CancellationToken cancellationToken);

    Task<SettingsMutationResult> SaveSettingsAsync(IReadOnlyDictionary<string, JsonElement> values, CancellationToken cancellationToken);
}

public sealed record MenuTreeResult(string? PayloadJson, bool HasData, DateTimeOffset? UpdatedAt);

public sealed record MenuTreeMutationResult(string PayloadJson, bool HasData, DateTimeOffset UpdatedAt);

public sealed record SettingsResult(IReadOnlyDictionary<string, JsonElement>? Values, bool HasData, DateTimeOffset? UpdatedAt);

public sealed record SettingsMutationResult(IReadOnlyDictionary<string, JsonElement>? Values, bool HasData, DateTimeOffset? UpdatedAt);
