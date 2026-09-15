using System.Text.Json;

namespace SisTemplate.Platform.Administration.Application;

internal static class SettingsValueReader
{
    public static bool GetBool(IReadOnlyDictionary<string, JsonElement> values, string key, bool fallback)
    {
        if (!values.TryGetValue(key, out var element))
        {
            return fallback;
        }

        return element.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => bool.TryParse(element.GetString(), out var parsed) ? parsed : fallback,
            _ => fallback,
        };
    }

    public static int GetInt(IReadOnlyDictionary<string, JsonElement> values, string key, int fallback)
    {
        if (!values.TryGetValue(key, out var element))
        {
            return fallback;
        }

        return element.ValueKind switch
        {
            JsonValueKind.Number => element.TryGetInt32(out var n) ? n : fallback,
            JsonValueKind.String => int.TryParse(element.GetString(), out var parsed) ? parsed : fallback,
            _ => fallback,
        };
    }
}
