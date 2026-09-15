using SisTemplate.Platform.Documents.Application;

namespace SisTemplate.AppHost.Api.Endpoints;

/// <summary>
/// Download URLs prefer a Blob SAS. When User Delegation SAS cannot be signed
/// (missing Storage Blob Delegator on the storage account) the file is streamed
/// through AppHost instead — Managed Identity can still read with Data Contributor.
/// </summary>
public static class DocumentReadLinks
{
    public static string StreamUrl(string container, string blobKey) =>
        "/api/v1/documents/stream?container="
        + Uri.EscapeDataString(container)
        + "&key=" + Uri.EscapeDataString(blobKey);

    /// <summary>
    /// SAS when the account can sign User Delegation keys; otherwise the same-origin
    /// stream path. Always returns a URL when container/key are known — do not 404
    /// here; the stream endpoint answers existence.
    /// </summary>
    public static async Task<string?> TryBuildMappedReadUrlAsync(
        IDocumentStorage storage,
        string container,
        string blobKey,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(blobKey))
        {
            return null;
        }

        var sasUri = await storage.TryCreateReadSasUriAsync(
            container, blobKey, TimeSpan.FromMinutes(15), cancellationToken);
        return sasUri?.ToString() ?? StreamUrl(container, blobKey);
    }

    public static async Task<IResult> JsonUrlAsync(
        IDocumentStorage storage,
        string container,
        string blobKey,
        string fallbackRelativeUrl,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(blobKey))
        {
            return Results.NotFound(new { code = "document_not_found" });
        }

        var sasUri = await storage.TryCreateReadSasUriAsync(
            container, blobKey, TimeSpan.FromMinutes(15), cancellationToken);
        if (sasUri is not null)
        {
            return Results.Ok(new { url = sasUri.ToString() });
        }

        var existing = await storage.TryGetAsync(container, blobKey, cancellationToken);
        if (existing is null)
        {
            return Results.NotFound(new { code = "document_not_found" });
        }

        return Results.Ok(new { url = fallbackRelativeUrl });
    }

    public static async Task<IResult> StreamAsync(
        IDocumentStorage storage,
        string container,
        string blobKey,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(blobKey))
        {
            return Results.NotFound(new { code = "document_not_found" });
        }

        var meta = await storage.TryGetAsync(container, blobKey, cancellationToken);
        var bytes = await storage.TryDownloadAsync(container, blobKey, cancellationToken);
        if (meta is null || bytes is null)
        {
            return Results.NotFound(new { code = "document_not_found" });
        }

        return Results.File(bytes, meta.ContentType);
    }
}
