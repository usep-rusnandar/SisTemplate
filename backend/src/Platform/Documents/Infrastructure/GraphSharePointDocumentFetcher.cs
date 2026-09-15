using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;
using IntegratedProcurement.Platform.Documents.Application;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.Platform.Documents.Infrastructure;

/// <summary>
/// Microsoft Graph implementation of <see cref="ISharePointDocumentFetcher"/>. Resolves a sharing link to a
/// share token (<c>u!</c> + url-safe base64), then reads the drive item's metadata and content via the
/// Graph <c>/shares/{token}</c> endpoint. Dev/Staging/Production use an App Registration client
/// secret when <c>SharePoint__ClientSecret</c> is set; otherwise the App Service Managed Identity
/// (<see cref="AzureHostCredential"/>) — the same identity pattern as Azure Blob.
/// </summary>
public sealed class GraphSharePointDocumentFetcher : ISharePointDocumentFetcher, IDisposable
{
    private const string GraphBaseUrl = "https://graph.microsoft.com/v1.0";
    private const int MaxThrottleRetries = 5;

    // Shared client (recommended pattern) — avoids socket exhaustion and disposal concerns in a singleton.
    private static readonly HttpClient HttpClient = new();
    private static readonly string[] GraphScopes = ["https://graph.microsoft.com/.default"];

    private static readonly Action<ILogger, int, double, Exception?> LogThrottled =
        LoggerMessage.Define<int, double>(
            LogLevel.Warning,
            new EventId(1, "SharePointGraphThrottled"),
            "SharePoint Graph throttled (attempt {Attempt}); retrying in {DelaySeconds}s.");
    private static readonly Action<ILogger, string, string, string, Exception?> LogCredential =
        LoggerMessage.Define<string, string, string>(
            LogLevel.Information,
            new EventId(2, "SharePointGraphCredential"),
            "SharePoint Graph credential {Credential} appid={AppId} roles={Roles}");

    private readonly SharePointOptions _options;
    private readonly ILogger<GraphSharePointDocumentFetcher> _logger;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private TokenCredential? _credential;
    private string? _cachedToken;
    private GraphTokenInfo _cachedTokenInfo = GraphTokenInfo.Empty;
    private DateTimeOffset _tokenExpiresOn = DateTimeOffset.MinValue;

    public GraphSharePointDocumentFetcher(IOptions<SharePointOptions> options, ILogger<GraphSharePointDocumentFetcher> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.TenantId);

    public async Task<SharePointFile> DownloadAsync(string sharingLink, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sharingLink))
        {
            throw new ArgumentException("Sharing link is required.", nameof(sharingLink));
        }

        if (!IsConfigured)
        {
            throw new InvalidOperationException("SharePoint is not configured (set SharePoint:TenantId).");
        }

        // Bound the whole fetch (headers + body stream). With ResponseHeadersRead, HttpClient.Timeout
        // does NOT cover reading the body, so a stalled download would hang forever without this.
        var timeout = TimeSpan.FromSeconds(Math.Max(15, _options.DownloadTimeoutSeconds));
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);
        var token = timeoutCts.Token;

        var shareToken = ShareLinkToToken(sharingLink);

        try
        {
            var (fileName, contentType) = await ReadMetadataAsync(shareToken, token);

            using var response = await SendWithRetryAsync(
                () => new Uri($"{GraphBaseUrl}/shares/{shareToken}/driveItem/content"),
                HttpCompletionOption.ResponseHeadersRead,
                token);
            await EnsureGraphSuccessAsync(response, token);

            // Buffer to a seekable, response-independent stream so the caller can upload it after disposal.
            var buffer = new MemoryStream();
            await using (var content = await response.Content.ReadAsStreamAsync(token))
            {
                await content.CopyToAsync(buffer, token);
            }

            buffer.Position = 0;
            contentType = response.Content.Headers.ContentType?.MediaType ?? contentType;
            return new SharePointFile(buffer, fileName, contentType);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException($"SharePoint download exceeded {timeout.TotalSeconds:N0}s.");
        }
    }

    private async Task<(string FileName, string ContentType)> ReadMetadataAsync(string shareToken, CancellationToken cancellationToken)
    {
        using var response = await SendWithRetryAsync(
            () => new Uri($"{GraphBaseUrl}/shares/{shareToken}/driveItem?$select=name,file,size"),
            HttpCompletionOption.ResponseContentRead,
            cancellationToken);
        await EnsureGraphSuccessAsync(response, cancellationToken);

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var root = document.RootElement;

        var fileName = root.TryGetProperty("name", out var nameElement) ? nameElement.GetString() ?? "document" : "document";
        var contentType = "application/octet-stream";
        if (root.TryGetProperty("file", out var fileElement)
            && fileElement.ValueKind == JsonValueKind.Object
            && fileElement.TryGetProperty("mimeType", out var mimeElement))
        {
            contentType = mimeElement.GetString() ?? contentType;
        }

        return (fileName, contentType);
    }

    public async Task<IReadOnlyList<SharePointDriveChild>> ListFolderChildrenAsync(
        string folderSharingLink,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(folderSharingLink))
        {
            throw new ArgumentException("Folder sharing link is required.", nameof(folderSharingLink));
        }

        if (!IsConfigured)
        {
            throw new InvalidOperationException("SharePoint is not configured (set SharePoint:TenantId).");
        }

        var shareToken = ShareLinkToToken(folderSharingLink);
        var (driveId, itemId, isFolder) = await ReadDriveItemIdentityAsync(shareToken, cancellationToken);
        if (!isFolder)
        {
            throw new InvalidOperationException("The SharePoint link must point to a folder, not a file.");
        }

        var children = new List<SharePointDriveChild>();
        string? nextUrl = $"{GraphBaseUrl}/drives/{Uri.EscapeDataString(driveId)}/items/{Uri.EscapeDataString(itemId)}/children"
            + "?$select=id,name,size,lastModifiedDateTime,file,folder,parentReference&$top=200";

        while (!string.IsNullOrEmpty(nextUrl))
        {
            using var response = await SendWithRetryAsync(
                () => new Uri(nextUrl),
                HttpCompletionOption.ResponseContentRead,
                cancellationToken);
            await EnsureGraphSuccessAsync(response, cancellationToken);

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var root = document.RootElement;
            if (root.TryGetProperty("value", out var value) && value.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in value.EnumerateArray())
                {
                    var name = item.TryGetProperty("name", out var nameEl) ? nameEl.GetString() ?? string.Empty : string.Empty;
                    var childId = item.TryGetProperty("id", out var idEl) ? idEl.GetString() ?? string.Empty : string.Empty;
                    var childDriveId = driveId;
                    if (item.TryGetProperty("parentReference", out var parent)
                        && parent.ValueKind == JsonValueKind.Object
                        && parent.TryGetProperty("driveId", out var driveEl)
                        && !string.IsNullOrWhiteSpace(driveEl.GetString()))
                    {
                        childDriveId = driveEl.GetString()!;
                    }

                    var folder = item.TryGetProperty("folder", out var folderEl) && folderEl.ValueKind == JsonValueKind.Object;
                    DateTimeOffset lastModified = DateTimeOffset.UtcNow;
                    if (item.TryGetProperty("lastModifiedDateTime", out var modifiedEl)
                        && modifiedEl.ValueKind == JsonValueKind.String
                        && DateTimeOffset.TryParse(modifiedEl.GetString(), out var parsed))
                    {
                        lastModified = parsed.ToUniversalTime();
                    }

                    long? size = null;
                    if (item.TryGetProperty("size", out var sizeEl) && sizeEl.TryGetInt64(out var sizeVal))
                    {
                        size = sizeVal;
                    }

                    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(childId))
                    {
                        continue;
                    }

                    children.Add(new SharePointDriveChild(childDriveId, childId, name, folder, lastModified, size));
                }
            }

            nextUrl = root.TryGetProperty("@odata.nextLink", out var next) ? next.GetString() : null;
        }

        return children;
    }

    public async Task<Stream> DownloadDriveItemAsync(string driveId, string itemId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(driveId) || string.IsNullOrWhiteSpace(itemId))
        {
            throw new ArgumentException("Drive id and item id are required.");
        }

        if (!IsConfigured)
        {
            throw new InvalidOperationException("SharePoint is not configured (set SharePoint:TenantId).");
        }

        var timeout = TimeSpan.FromSeconds(Math.Max(15, _options.DownloadTimeoutSeconds));
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);
        var token = timeoutCts.Token;

        try
        {
            using var response = await SendWithRetryAsync(
                () => new Uri($"{GraphBaseUrl}/drives/{Uri.EscapeDataString(driveId)}/items/{Uri.EscapeDataString(itemId)}/content"),
                HttpCompletionOption.ResponseHeadersRead,
                token);
            await EnsureGraphSuccessAsync(response, token);

            var buffer = new MemoryStream();
            await using (var content = await response.Content.ReadAsStreamAsync(token))
            {
                await content.CopyToAsync(buffer, token);
            }

            buffer.Position = 0;
            return buffer;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException($"SharePoint download exceeded {timeout.TotalSeconds:N0}s.");
        }
    }

    private async Task<(string DriveId, string ItemId, bool IsFolder)> ReadDriveItemIdentityAsync(
        string shareToken,
        CancellationToken cancellationToken)
    {
        using var response = await SendWithRetryAsync(
            () => new Uri($"{GraphBaseUrl}/shares/{shareToken}/driveItem?$select=id,folder,parentReference"),
            HttpCompletionOption.ResponseContentRead,
            cancellationToken);
        await EnsureGraphSuccessAsync(response, cancellationToken);

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var root = document.RootElement;
        var itemId = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        var driveId = root.TryGetProperty("parentReference", out var parent)
            && parent.ValueKind == JsonValueKind.Object
            && parent.TryGetProperty("driveId", out var driveEl)
            ? driveEl.GetString()
            : null;
        var isFolder = root.TryGetProperty("folder", out var folderEl) && folderEl.ValueKind == JsonValueKind.Object;

        if (string.IsNullOrWhiteSpace(itemId) || string.IsNullOrWhiteSpace(driveId))
        {
            throw new InvalidOperationException("Could not resolve SharePoint folder drive item.");
        }

        return (driveId, itemId, isFolder);
    }

    private async Task<HttpResponseMessage> SendWithRetryAsync(
        Func<Uri> uriFactory,
        HttpCompletionOption completionOption,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            var token = await GetAccessTokenAsync(cancellationToken);
            using var request = new HttpRequestMessage(HttpMethod.Get, uriFactory());
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Headers.TryAddWithoutValidation("Prefer", "redeemSharingLink");

            var response = await HttpClient.SendAsync(request, completionOption, cancellationToken);
            if (response.StatusCode is not (HttpStatusCode.TooManyRequests or HttpStatusCode.ServiceUnavailable)
                || attempt >= MaxThrottleRetries)
            {
                return response;
            }

            var delay = response.Headers.RetryAfter?.Delta
                ?? TimeSpan.FromSeconds(Math.Min(30, Math.Pow(2, attempt)));
            response.Dispose();
            LogThrottled(_logger, attempt, delay.TotalSeconds, null);
            await Task.Delay(delay, cancellationToken);
        }
    }

    private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        // 5-minute safety margin before expiry.
        if (_cachedToken is not null && _tokenExpiresOn > DateTimeOffset.UtcNow.AddMinutes(5))
        {
            return _cachedToken;
        }

        await _tokenLock.WaitAsync(cancellationToken);
        try
        {
            if (_cachedToken is not null && _tokenExpiresOn > DateTimeOffset.UtcNow.AddMinutes(5))
            {
                return _cachedToken;
            }

            _credential ??= AzureHostCredential.ForSharePoint(_options);
            // Managed Identity on a slot without Graph grants can hang well past the download
            // CancellationToken. Bound token acquisition so Import Center leaves Fetching.
            var tokenTimeout = TimeSpan.FromSeconds(20);
            using var tokenCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            tokenCts.CancelAfter(tokenTimeout);
            AccessToken token;
            try
            {
                var tokenTask = _credential
                    .GetTokenAsync(new TokenRequestContext(GraphScopes), tokenCts.Token)
                    .AsTask();
                var winner = await Task.WhenAny(tokenTask, Task.Delay(tokenTimeout + TimeSpan.FromSeconds(2), cancellationToken));
                if (winner != tokenTask)
                {
                    throw new TimeoutException(
                        $"SharePoint token request exceeded {tokenTimeout.TotalSeconds:N0}s using {AzureHostCredential.DescribeSharePoint(_options)}.");
                }

                token = await tokenTask;
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                throw new TimeoutException(
                    $"SharePoint token request exceeded {tokenTimeout.TotalSeconds:N0}s using {AzureHostCredential.DescribeSharePoint(_options)}.");
            }
            catch (AuthenticationFailedException ex)
            {
                throw new InvalidOperationException(AzureHostCredential.FormatSharePointAuthFailure(ex), ex);
            }

            _cachedToken = token.Token;
            _cachedTokenInfo = AzureHostCredential.InspectGraphToken(token.Token);
            _tokenExpiresOn = token.ExpiresOn;
            if (_logger.IsEnabled(LogLevel.Information))
            {
                LogCredential(
                    _logger,
                    AzureHostCredential.DescribeSharePoint(_options),
                    _cachedTokenInfo.AppId ?? "(none)",
                    _cachedTokenInfo.Roles.Count == 0 ? "(none)" : string.Join(',', _cachedTokenInfo.Roles),
                    null);
            }
            return _cachedToken;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    private async Task EnsureGraphSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        string? body = null;
        try
        {
            body = await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (Exception)
        {
            // Keep the status-code message even if the error payload cannot be read.
        }

        throw new HttpRequestException(
            AzureHostCredential.FormatGraphHttpFailure(response.StatusCode, response.ReasonPhrase, body, _cachedTokenInfo));
    }

    /// <summary>Encodes a sharing URL into a Graph share token: <c>u!</c> + url-safe base64 (no padding).</summary>
    public static string ShareLinkToToken(string sharingLink)
    {
        var base64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(sharingLink))
            .Replace("+", "-", StringComparison.Ordinal)
            .Replace("/", "_", StringComparison.Ordinal)
            .TrimEnd('=');
        return "u!" + base64;
    }

    public void Dispose() => _tokenLock.Dispose();
}
