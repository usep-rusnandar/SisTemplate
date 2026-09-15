namespace SisTemplate.Platform.Documents.Application;

public sealed class AzureBlobOptions
{
    public const string SectionName = "AzureBlob";

    /// <summary>Dev: full account connection string (with AccountKey). Takes precedence when set.</summary>
    public string? ConnectionString { get; set; }

    /// <summary>Prod/Staging: blob service endpoint (https://&lt;account&gt;.blob.core.windows.net) used with Managed Identity.</summary>
    public string? ServiceUri { get; set; }

    /// <summary>User-assigned Managed Identity client id. Omit for the App Service system-assigned identity.</summary>
    public string? ManagedIdentityClientId { get; set; }

    /// <summary>Module key → container name (e.g. tracker → app-proposaltracker, cip → app-contractmanagement).</summary>
    public Dictionary<string, string> Containers { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Virtual folder inside each container so Development and Staging can share
    /// <c>stsisdevidc001</c> without overwriting or deleting each other's blobs.
    /// Empty = store at the container root (Production, where the account is already dedicated).
    /// When omitted, the host environment supplies <c>dev</c> or <c>staging</c>.
    /// </summary>
    public string? KeyPrefix { get; set; }

    /// <summary>Per-try network timeout for blob transfers. Defaults to 10 min so large document uploads on slow links complete.</summary>
    public int UploadTimeoutMinutes { get; set; } = 10;

    /// <summary>
    /// Development only. When true (the Development default) <see cref="IDocumentStorage"/> writes
    /// to the local disk instead of Azure Blob so Cursor-VM / local UAT is not blocked by storage
    /// connectivity. Staging and Production ignore this flag and always use Azure.
    /// Set <c>AzureBlob__UseLocalStorage=false</c> to force real Azure uploads in Development.
    /// </summary>
    public bool? UseLocalStorage { get; set; }

    /// <summary>Root folder for local-disk documents. Defaults to <c>App_Data/local-blob</c> under the host content root.</summary>
    public string? LocalRoot { get; set; }
}

/// <summary>Applies <see cref="AzureBlobOptions.KeyPrefix"/> to a blob name without double-prefixing.</summary>
public static class AzureBlobKeyPrefix
{
    public const string Development = "dev";
    public const string Staging = "staging";

    public static string Normalize(string? prefix)
    {
        return string.IsNullOrWhiteSpace(prefix) ? string.Empty : prefix.Trim().Trim('/');
    }

    /// <summary>
    /// Configured prefix wins. Otherwise Development → <c>dev</c>, Staging → <c>staging</c>,
    /// anything else (Production) stays empty so blobs remain at the container root.
    /// </summary>
    public static string Resolve(string? configured, string? environmentName)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return Normalize(configured);
        }

        if (string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase))
        {
            return Development;
        }

        if (string.Equals(environmentName, "Staging", StringComparison.OrdinalIgnoreCase))
        {
            return Staging;
        }

        return string.Empty;
    }

    public static string Apply(string? prefix, string blobKey)
    {
        var key = (blobKey ?? string.Empty).Trim().TrimStart('/');
        var p = Normalize(prefix);
        if (p.Length == 0 || key.Length == 0)
        {
            return key;
        }

        return key.StartsWith(p + "/", StringComparison.OrdinalIgnoreCase) ? key : p + "/" + key;
    }
}

public sealed record DocumentUploadResult(string Container, string BlobKey, long Size, string ContentType);

public interface IDocumentStorage
{
    /// <summary>True when a blob service endpoint or connection string is configured.</summary>
    bool IsConfigured { get; }

    /// <summary>Resolves the container name for a module key (tracker | cip | contract-monitoring).</summary>
    string ContainerForModule(string moduleKey);

    /// <summary>Creates the container if it does not exist. Used for containers that aren't pre-provisioned (e.g. user avatars).</summary>
    Task EnsureContainerAsync(string container, CancellationToken cancellationToken);

    Task<DocumentUploadResult> UploadAsync(string container, string blobKey, Stream content, string contentType, CancellationToken cancellationToken);

    /// <summary>Short-lived read-only download URL. Uses Service SAS (shared key) in dev, User Delegation SAS (Managed Identity) in prod.</summary>
    Task<Uri> CreateReadSasUriAsync(string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken);

    /// <summary>
    /// Short-lived write URL so the browser can PUT bytes straight to Blob (large vendor documents).
    /// Create+Write only — no read/list/delete.
    /// </summary>
    Task<Uri> CreateWriteSasUriAsync(string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken);

    /// <summary>
    /// Like <see cref="CreateWriteSasUriAsync"/> but returns null when storage is unconfigured
    /// or User Delegation SAS cannot be signed (missing Storage Blob Delegator). Callers then
    /// stream the bytes through AppHost — Managed Identity can still upload with Data Contributor.
    /// </summary>
    Task<Uri?> TryCreateWriteSasUriAsync(string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken);

    /// <summary>
    /// Like <see cref="CreateReadSasUriAsync"/> but returns null when the blob does not exist,
    /// storage is unconfigured, or Blob auth is unavailable (avoids a broken URL / 500 on /auth/me).
    /// </summary>
    Task<Uri?> TryCreateReadSasUriAsync(string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken);

    /// <summary>Null when the blob is missing; otherwise size + content type from Blob properties.</summary>
    Task<DocumentUploadResult?> TryGetAsync(string container, string blobKey, CancellationToken cancellationToken);

    /// <summary>Null when the blob is missing or storage is not configured. Used to pull Vendor Connect blobs into the current container.</summary>
    Task<byte[]?> TryDownloadAsync(string container, string blobKey, CancellationToken cancellationToken);

    Task DeleteAsync(string container, string blobKey, CancellationToken cancellationToken);

    /// <summary>Diagnostic: confirms a container is reachable with the current credential.</summary>
    Task<bool> ContainerExistsAsync(string container, CancellationToken cancellationToken);
}
