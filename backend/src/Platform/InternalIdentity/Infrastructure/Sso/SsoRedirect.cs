using SisTemplate.Platform.InternalIdentity.Application.Sso;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;

namespace SisTemplate.Platform.InternalIdentity.Infrastructure.Sso;

/// <summary>
/// Single source of truth for the SISWarrior login redirect URL. Shared by <see cref="SsoMiddleware"/>
/// (auto-redirect of anonymous navigations) and the <c>/sso/login</c> endpoint (explicit "Continue with
/// SSO" from the SPA) so both send the user to exactly the same portal URL.
///
/// <see cref="ResolveApplicationUrl"/> picks the callback host from the incoming request
/// (<c>X-Forwarded-Host</c>, then <c>Host</c>) when that host matches the configured allowlist.
/// Suite and each module portal can then complete SSO on their own hostname. Unknown hosts fall
/// back to <see cref="SsoOptions.ApplicationUrl"/> — never an open redirect. Matching is by host
/// (and port), not by reconstructed scheme, so Azure's http-behind-TLS does not miss an https
/// allowlist entry.
/// </summary>
public static class SsoRedirect
{
    public const string CallbackPath = "/api/v1/internal/sso/callback";

    public static string BuildSisWarriorLoginUrl(SsoOptions options, HttpRequest? request = null)
    {
        var parameters = new Dictionary<string, string?>
        {
            ["redirectUrl"] = ResolveApplicationUrl(options, request)
        };

        if (!string.IsNullOrWhiteSpace(options.Application))
        {
            parameters["application"] = options.Application;
        }

        return QueryHelpers.AddQueryString(options.SsoUrl, parameters);
    }

    public static string ResolveApplicationUrl(SsoOptions options, HttpRequest? request = null)
    {
        var allowed = EnumerateAllowedApplicationUrls(options);
        if (request is not null)
        {
            var match = MatchAllowedByHost(allowed, IncomingHost(request));
            if (match.Length > 0)
            {
                return match;
            }
        }

        var fallback = NormalizeApplicationUrl(options.ApplicationUrl);
        return fallback.Length > 0 ? fallback : (allowed.Count > 0 ? allowed[0] : string.Empty);
    }

    public static IReadOnlyList<string> EnumerateAllowedApplicationUrls(SsoOptions options)
    {
        var urls = new List<string>();
        AddAllowed(urls, options.ApplicationUrl);
        foreach (var url in options.AllowedApplicationUrls ?? [])
        {
            AddAllowed(urls, url);
        }

        return urls;
    }

    public static bool IsSafeRelativeReturnPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        if (!value.StartsWith('/') || value.StartsWith("//", StringComparison.Ordinal) || value.Contains('\\'))
        {
            return false;
        }

        return !value.Contains("://", StringComparison.Ordinal);
    }

    public static string NormalizeApplicationUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)
            || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
            || string.IsNullOrWhiteSpace(uri.Host))
        {
            return string.Empty;
        }

        var builder = new UriBuilder(uri)
        {
            Path = "/",
            Query = string.Empty,
            Fragment = string.Empty,
            UserName = string.Empty,
            Password = string.Empty
        };
        return builder.Uri.GetLeftPart(UriPartial.Path);
    }

    private static void AddAllowed(List<string> urls, string? value)
    {
        var normalized = NormalizeApplicationUrl(value);
        if (normalized.Length == 0)
        {
            return;
        }

        if (!urls.Exists(url => string.Equals(url, normalized, StringComparison.OrdinalIgnoreCase)))
        {
            urls.Add(normalized);
        }
    }

    private static string IncomingHost(HttpRequest request)
    {
        var forwardedHost = FirstHeaderValue(request.Headers["X-Forwarded-Host"].ToString());
        return string.IsNullOrWhiteSpace(forwardedHost) ? request.Host.Value ?? string.Empty : forwardedHost;
    }

    private static string MatchAllowedByHost(IReadOnlyList<string> allowed, string rawHost)
    {
        if (string.IsNullOrWhiteSpace(rawHost)
            || !Uri.TryCreate($"https://{rawHost.Trim()}/", UriKind.Absolute, out var incoming)
            || string.IsNullOrWhiteSpace(incoming.Host))
        {
            return string.Empty;
        }

        foreach (var url in allowed)
        {
            if (Uri.TryCreate(url, UriKind.Absolute, out var allowedUri)
                && string.Equals(allowedUri.Host, incoming.Host, StringComparison.OrdinalIgnoreCase)
                && allowedUri.Port == incoming.Port)
            {
                return url;
            }
        }

        return string.Empty;
    }

    private static string FirstHeaderValue(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var comma = raw.IndexOf(',');
        return (comma < 0 ? raw : raw[..comma]).Trim();
    }
}
