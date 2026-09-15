namespace SisTemplate.Platform.Administration.Application;

/// <summary>
/// Resolves public portal origins used in outbound email links. Empty Azure App Settings
/// must not win over a real fallback (null-coalescing does not treat "" as missing).
/// </summary>
public static class FrontendPortalUrls
{
    public static string FirstAbsolute(params string?[] candidates)
    {
        foreach (var raw in candidates)
        {
            var value = (raw ?? string.Empty).Trim().TrimEnd('/');
            if (value.Length == 0)
            {
                continue;
            }

            if (Uri.TryCreate(value, UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
            {
                return value;
            }
        }

        return string.Empty;
    }

    public static string BuildQueryUrl(string? portalUrl, string email, string token)
    {
        var query = string.Format(
            System.Globalization.CultureInfo.InvariantCulture,
            "?email={0}&reset={1}",
            Uri.EscapeDataString(email),
            Uri.EscapeDataString(token));
        var origin = (portalUrl ?? string.Empty).Trim().TrimEnd('/');
        return origin.Length == 0 ? query : origin + query;
    }

    public static string SupportContact(string? configured) =>
        string.IsNullOrWhiteSpace(configured) ? "Alamtri Procurement" : configured.Trim();
}
