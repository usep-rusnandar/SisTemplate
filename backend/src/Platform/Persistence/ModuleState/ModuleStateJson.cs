using System.Text.Json;

namespace SisTemplate.Platform.Persistence.ModuleState;

/// <summary>
/// Module-state KV payload helpers. An empty JSON array is the stale-bridge /
/// login-migrate failure mode and must not wipe a populated domain projection.
/// </summary>
public static class ModuleStateJson
{
    public static bool IsEmptyArray(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return true;
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            foreach (var row in root.EnumerateArray())
            {
                if (row.ValueKind == JsonValueKind.Object)
                {
                    return false;
                }
            }

            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
