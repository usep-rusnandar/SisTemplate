using System.Net;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;
using SisTemplate.Platform.Documents.Application;

namespace SisTemplate.Platform.Documents.Infrastructure;

/// <summary>
/// App Service / IIS credential picker for Blob and SharePoint.
/// <para>
/// Do not use <see cref="DefaultAzureCredential"/> on Azure: it tries EnvironmentCredential and
/// WorkloadIdentity first. App Service often sets a partial <c>AZURE_CLIENT_ID</c> (or ops set it
/// to the SharePoint App Registration id), which produces the
/// "Environment variables are not fully configured" dump and never reaches a working identity.
/// </para>
/// Staging and Production: App Registration client secret when configured (same Graph grants as
/// Development); otherwise the slot's Managed Identity only (system-assigned unless a user-assigned
/// client id is set).
/// </summary>
public static class AzureHostCredential
{
    public static TokenCredential ForSharePoint(SharePointOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (HasClientSecret(options))
        {
            return new ClientSecretCredential(options.TenantId, options.ClientId, options.ClientSecret);
        }

        return ForManagedIdentity(options.ManagedIdentityClientId);
    }

    public static TokenCredential ForManagedIdentity(string? userAssignedClientId)
    {
        return string.IsNullOrWhiteSpace(userAssignedClientId)
            ? new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned)
            : new ManagedIdentityCredential(ManagedIdentityId.FromUserAssignedClientId(userAssignedClientId.Trim()));
    }

    public static string DescribeSharePoint(SharePointOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (HasClientSecret(options))
        {
            return "ClientSecretCredential (App Registration)";
        }

        return string.IsNullOrWhiteSpace(options.ManagedIdentityClientId)
            ? "ManagedIdentityCredential (system-assigned)"
            : "ManagedIdentityCredential (user-assigned)";
    }

    public static bool HasClientSecret(SharePointOptions options) =>
        options is not null
        && !string.IsNullOrWhiteSpace(options.TenantId)
        && !string.IsNullOrWhiteSpace(options.ClientId)
        && !string.IsNullOrWhiteSpace(options.ClientSecret);

    /// <summary>
    /// Reads <c>appid</c>/<c>azp</c> and <c>roles</c> from a JWT so Graph 401 can name the identity
    /// that has no Sites.Read.All / Sites.Selected grant.
    /// </summary>
    public static GraphTokenInfo InspectGraphToken(string jwt)
    {
        if (string.IsNullOrWhiteSpace(jwt))
        {
            return GraphTokenInfo.Empty;
        }

        var parts = jwt.Split('.');
        if (parts.Length < 2)
        {
            return GraphTokenInfo.Empty;
        }

        try
        {
            var json = Encoding.UTF8.GetString(Base64UrlDecode(parts[1]));
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            var appId = ReadString(root, "appid") ?? ReadString(root, "azp");
            var roles = new List<string>();
            if (root.TryGetProperty("roles", out var rolesEl) && rolesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var role in rolesEl.EnumerateArray())
                {
                    var value = role.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        roles.Add(value);
                    }
                }
            }

            return new GraphTokenInfo(appId, roles);
        }
        catch (Exception ex) when (ex is JsonException or FormatException or ArgumentException)
        {
            return GraphTokenInfo.Empty;
        }
    }

    public static string FormatSharePointAuthFailure(Exception ex)
    {
        var detail = Flatten(ex);
        return "SharePoint authentication failed. This App Service slot needs either "
            + "SharePoint__ClientSecret (App Registration SisTemplate-SharePoint, same as Development) "
            + "or a Managed Identity on the slot with Graph Sites.Read.All / Sites.Selected. "
            + detail;
    }

    public static string FormatGraphHttpFailure(
        HttpStatusCode status,
        string? reasonPhrase,
        string? body,
        GraphTokenInfo token)
    {
        var roles = token.Roles.Count == 0 ? "(none)" : string.Join(", ", token.Roles);
        var identity = string.IsNullOrWhiteSpace(token.AppId) ? "unknown" : token.AppId;
        var excerpt = Truncate(CollapseWhitespace(body), 220);
        var hint = status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden && token.Roles.Count == 0
            ? " The Graph token has no roles — grant Sites.Read.All or Sites.Selected to this identity, or set SharePoint__ClientSecret."
            : status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden
                ? " Confirm the identity has site permission on ProcurementSourcingDocument."
                : string.Empty;
        var graph = string.IsNullOrWhiteSpace(excerpt) ? string.Empty : $" Graph: {excerpt}";
        return $"SharePoint Graph {(int)status} ({reasonPhrase ?? status.ToString()}). Identity {identity}, roles {roles}.{hint}{graph}";
    }

    private static string Flatten(Exception ex)
    {
        var parts = new List<string>();
        for (var current = ex; current is not null && parts.Count < 4; current = current.InnerException)
        {
            var line = FirstLine(current.Message);
            if (string.IsNullOrWhiteSpace(line) || parts.Contains(line, StringComparer.Ordinal))
            {
                continue;
            }

            parts.Add(line);
        }

        return parts.Count == 0 ? ex.GetType().Name : string.Join(" | ", parts);
    }

    private static string FirstLine(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        var trimmed = CollapseWhitespace(message);
        var cut = trimmed.IndexOf("See the troubleshooting guide", StringComparison.OrdinalIgnoreCase);
        if (cut > 40)
        {
            trimmed = trimmed[..cut].TrimEnd(' ', '-', '.');
        }

        return Truncate(trimmed, 240);
    }

    private static string CollapseWhitespace(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static string Truncate(string value, int max)
    {
        if (value.Length <= max)
        {
            return value;
        }

        return value[..Math.Max(0, max - 1)].TrimEnd() + "…";
    }

    private static string? ReadString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() : null;

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }

        return Convert.FromBase64String(padded);
    }
}

public readonly record struct GraphTokenInfo(string? AppId, IReadOnlyList<string> Roles)
{
    public static GraphTokenInfo Empty { get; } = new(null, Array.Empty<string>());
}
