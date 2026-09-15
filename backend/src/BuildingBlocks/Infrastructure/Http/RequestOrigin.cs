using Microsoft.AspNetCore.Http;

namespace IntegratedProcurement.BuildingBlocks.Infrastructure.Http;

/// <summary>
/// Public origin of the current request, honouring the first X-Forwarded-* hop used by Azure App Service.
/// </summary>
public static class RequestOrigin
{
    public static string? Read(HttpRequest? request)
    {
        if (request is null || !request.Host.HasValue)
        {
            return null;
        }

        var scheme = FirstForwarded(request.Headers, "X-Forwarded-Proto") ?? request.Scheme;
        var host = FirstForwarded(request.Headers, "X-Forwarded-Host") ?? request.Host.Value;
        if (string.IsNullOrWhiteSpace(scheme) || string.IsNullOrWhiteSpace(host))
        {
            return null;
        }

        return $"{scheme}://{host}".TrimEnd('/');
    }

    private static string? FirstForwarded(IHeaderDictionary headers, string name)
    {
        var raw = headers[name].ToString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var first = raw.Split(',', 2, StringSplitOptions.TrimEntries)[0];
        return string.IsNullOrWhiteSpace(first) ? null : first;
    }
}
