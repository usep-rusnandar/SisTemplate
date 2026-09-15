using IntegratedProcurement.AppHost.Api.Endpoints;
using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.AppHost.Api.Services;

/// <summary>
/// Shared blob layout for internal-user avatars (own-account /auth/avatar and admin Users).
/// Key is deterministic per personnel number so upload replaces the previous photo.
/// Read URLs prefer a Blob SAS; when User Delegation SAS cannot be signed the same-origin
/// stream path is used so upload and /auth/me never throw UNHANDLED_SERVER_ERROR.
/// </summary>
internal static class UserAvatarBlob
{
    public const long MaxBytes = 2 * 1024 * 1024;

    public static readonly TimeSpan ReadSasTtl = TimeSpan.FromHours(1);

    public static string Container(IConfiguration configuration) =>
        configuration["AzureBlob:Containers:platformUser"] is { Length: > 0 } configured
            ? configured
            : "app-platform-users";

    public static string BlobKey(string personnelNo)
    {
        var safe = new string(personnelNo.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
        return $"avatars/{(safe.Length == 0 ? "user" : safe)}";
    }

    public static IResult? ValidateUpload(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return Results.BadRequest(new { code = "file_required" });
        }

        var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
        if (contentType is not ("image/png" or "image/jpeg" or "image/jpg" or "image/webp"))
        {
            return Results.BadRequest(new { code = "invalid_image_type", message = "Use a JPG, PNG, or WebP image." });
        }

        if (file.Length > MaxBytes)
        {
            return Results.BadRequest(new { code = "image_too_large", message = "Image must be 2MB or smaller." });
        }

        return null;
    }

    public static async Task<string?> TryReadUrlAsync(
        IDocumentStorage storage,
        IConfiguration configuration,
        string personnelNo,
        CancellationToken cancellationToken)
    {
        if (!storage.IsConfigured || string.IsNullOrWhiteSpace(personnelNo))
        {
            return null;
        }

        try
        {
            return await ResolveReadUrlAsync(
                storage, Container(configuration), BlobKey(personnelNo), cancellationToken);
        }
        catch
        {
            // Optional chrome: a Blob / Managed Identity outage must not block /auth/me.
            return null;
        }
    }

    public static async Task<string> ReplaceAsync(
        IDocumentStorage storage,
        IConfiguration configuration,
        string personnelNo,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        var container = Container(configuration);
        var blobKey = BlobKey(personnelNo);
        var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "image/jpeg" : file.ContentType;
        await storage.EnsureContainerAsync(container, cancellationToken);
        await storage.DeleteAsync(container, blobKey, cancellationToken);
        await using (var stream = file.OpenReadStream())
        {
            await storage.UploadAsync(container, blobKey, stream, contentType, cancellationToken);
        }

        return await ResolveReadUrlAsync(storage, container, blobKey, cancellationToken)
            ?? DocumentReadLinks.StreamUrl(container, blobKey);
    }

    public static async Task DeleteAsync(
        IDocumentStorage storage,
        IConfiguration configuration,
        string personnelNo,
        CancellationToken cancellationToken)
    {
        if (!storage.IsConfigured || string.IsNullOrWhiteSpace(personnelNo))
        {
            return;
        }

        await storage.DeleteAsync(Container(configuration), BlobKey(personnelNo), cancellationToken);
    }

    /// <summary>
    /// SAS when the account can sign User Delegation keys; otherwise the same-origin
    /// stream path when the blob exists. Null when the photo has not been uploaded.
    /// </summary>
    private static async Task<string?> ResolveReadUrlAsync(
        IDocumentStorage storage,
        string container,
        string blobKey,
        CancellationToken cancellationToken)
    {
        var sasUri = await storage.TryCreateReadSasUriAsync(
            container, blobKey, ReadSasTtl, cancellationToken);
        if (sasUri is not null)
        {
            return sasUri.ToString();
        }

        var existing = await storage.TryGetAsync(container, blobKey, cancellationToken);
        return existing is null ? null : DocumentReadLinks.StreamUrl(container, blobKey);
    }
}
