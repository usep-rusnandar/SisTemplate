using System.Text.Json;

namespace IntegratedProcurement.Platform.Administration.Application;

/// <summary>
/// Resolves the Settings ▸ Email "To (test)" redirect. Each email category maps to
/// <c>toTest_{slug}</c>. An empty or missing value means deliver to the real recipient.
/// The legacy global <c>toTest</c> key is not used — it is hidden from Settings and would
/// keep redirecting mail after the visible per-module field is cleared.
/// </summary>
public static class EmailTestRedirect
{
    public static string? ModuleSlugForCategory(string? category) => category?.Trim() switch
    {
        "Users" => "users",
        _ => null,
    };

    public static string? TestAddress(IReadOnlyDictionary<string, JsonElement>? settings, string? category)
    {
        var slug = ModuleSlugForCategory(category);
        if (slug is null)
        {
            return null;
        }

        var value = Text(settings, $"toTest_{slug}");
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    public static string? EffectiveTo(string? toEmail, IReadOnlyDictionary<string, JsonElement>? settings, string? category)
    {
        var test = TestAddress(settings, category);
        return string.IsNullOrWhiteSpace(test) ? toEmail : test;
    }

    public static bool IsRedirected(IReadOnlyDictionary<string, JsonElement>? settings, string? category) =>
        !string.IsNullOrWhiteSpace(TestAddress(settings, category));

    private static string? Text(IReadOnlyDictionary<string, JsonElement>? values, string key) =>
        values is not null && values.TryGetValue(key, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString()
            : null;
}
