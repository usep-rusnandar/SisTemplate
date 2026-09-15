using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using IntegratedProcurement.Platform.Documents.Application;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.Platform.Documents.Infrastructure;

/// <summary>
/// Azure Blob document store. Dev authenticates with the account connection string; Azure slots use
/// Managed Identity (<see cref="AzureHostCredential"/>) with no secrets. Documents live in Blob
/// Storage; only metadata (container, blob key, content type, size) is persisted in the database.
/// Download links are short-lived SAS URLs so the browser fetches blobs directly.
/// <para>
/// Development and Staging share <c>stsisdevidc001</c>. Physical blob names are prefixed
/// (<c>dev/…</c> / <c>staging/…</c>) so the environments cannot overwrite or delete each other.
/// The database still stores the unprefixed key (vendor ownership checks depend on it).
/// Production uses a dedicated account and keeps blobs at the container root.
/// </para>
/// </summary>
public sealed class BlobDocumentStorage : IDocumentStorage
{
    private readonly BlobServiceClient? _serviceClient;
    private readonly AzureBlobOptions _options;

    public BlobDocumentStorage(IOptions<AzureBlobOptions> options)
    {
        _options = options.Value;

        // Large contract PDFs (multi-MB) over modest upstream links can exceed Azure SDK's default
        // ~100s per-try network timeout. Raise it so big document uploads complete instead of aborting.
        var clientOptions = new BlobClientOptions
        {
            Retry = { NetworkTimeout = TimeSpan.FromMinutes(Math.Max(1, _options.UploadTimeoutMinutes)) },
        };

        if (!string.IsNullOrWhiteSpace(_options.ConnectionString))
        {
            // Dev: connection string (shared key) — also enables Service SAS generation.
            _serviceClient = new BlobServiceClient(_options.ConnectionString, clientOptions);
        }
        else if (!string.IsNullOrWhiteSpace(_options.ServiceUri))
        {
            // Prod/Staging: Managed Identity only — never DefaultAzureCredential (see AzureHostCredential).
            _serviceClient = new BlobServiceClient(
                new Uri(_options.ServiceUri),
                AzureHostCredential.ForManagedIdentity(_options.ManagedIdentityClientId),
                clientOptions);
        }
    }

    public bool IsConfigured => _serviceClient is not null;

    public string ContainerForModule(string moduleKey)
    {
        if (_options.Containers.TryGetValue(moduleKey, out var container) && !string.IsNullOrWhiteSpace(container))
        {
            return container;
        }

        // Fall back to the first configured container so a single-container setup still works.
        var first = _options.Containers.Values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
        return first ?? throw new InvalidOperationException($"No Azure Blob container configured for module '{moduleKey}'.");
    }

    public async Task EnsureContainerAsync(string container, CancellationToken cancellationToken)
    {
        if (_serviceClient is null)
        {
            throw new InvalidOperationException("Azure Blob storage is not configured (set AzureBlob:ConnectionString or AzureBlob:ServiceUri).");
        }

        await _serviceClient.GetBlobContainerClient(container).CreateIfNotExistsAsync(cancellationToken: cancellationToken);
    }

    public async Task<Uri?> TryCreateReadSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        CancellationToken cancellationToken)
    {
        if (_serviceClient is null)
        {
            return null;
        }

        try
        {
            var exists = await Blob(container, blobKey).ExistsAsync(cancellationToken);
            return exists.Value
                ? await CreateReadSasUriAsync(container, blobKey, timeToLive, cancellationToken)
                : null;
        }
        catch (Exception ex) when (
            ex is Azure.Identity.AuthenticationFailedException
            or Azure.Identity.CredentialUnavailableException
            or Azure.RequestFailedException)
        {
            // Avatar / optional reads must not fail login when Managed Identity is down.
            return null;
        }
    }

    public async Task<DocumentUploadResult> UploadAsync(
        string container,
        string blobKey,
        Stream content,
        string contentType,
        CancellationToken cancellationToken)
    {
        var blob = Blob(container, blobKey);
        var upload = new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType },
        };
        var environmentTag = AzureBlobKeyPrefix.Normalize(_options.KeyPrefix);
        if (environmentTag.Length > 0)
        {
            upload.Metadata = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["environment"] = environmentTag,
            };
        }

        try
        {
            await blob.UploadAsync(content, upload, cancellationToken);
        }
        catch (Azure.Identity.AuthenticationFailedException ex)
        {
            throw new InvalidOperationException(
                "Azure Blob authentication failed. Enable Managed Identity on this App Service slot and grant "
                + "Storage Blob Data Contributor on the storage account, or set AzureBlob__ConnectionString. "
                + ex.Message,
                ex);
        }

        var properties = await blob.GetPropertiesAsync(cancellationToken: cancellationToken);
        return new DocumentUploadResult(container, blobKey, properties.Value.ContentLength, contentType);
    }

    public Task<Uri> CreateReadSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        CancellationToken cancellationToken) =>
        CreateSasUriAsync(container, blobKey, timeToLive, BlobSasPermissions.Read, cancellationToken);

    public Task<Uri> CreateWriteSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        CancellationToken cancellationToken) =>
        CreateSasUriAsync(
            container,
            blobKey,
            timeToLive,
            BlobSasPermissions.Create | BlobSasPermissions.Write,
            cancellationToken);

    public async Task<Uri?> TryCreateWriteSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        CancellationToken cancellationToken)
    {
        if (_serviceClient is null || string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(blobKey))
        {
            return null;
        }

        try
        {
            return await CreateWriteSasUriAsync(container, blobKey, timeToLive, cancellationToken);
        }
        catch (Exception ex) when (
            ex is Azure.Identity.AuthenticationFailedException
            or Azure.Identity.CredentialUnavailableException
            or Azure.RequestFailedException)
        {
            return null;
        }
    }

    public async Task<DocumentUploadResult?> TryGetAsync(
        string container,
        string blobKey,
        CancellationToken cancellationToken)
    {
        var blob = Blob(container, blobKey);
        if (!await blob.ExistsAsync(cancellationToken))
        {
            return null;
        }

        var properties = await blob.GetPropertiesAsync(cancellationToken: cancellationToken);
        return new DocumentUploadResult(
            container,
            blobKey,
            properties.Value.ContentLength,
            properties.Value.ContentType ?? "application/octet-stream");
    }

    public async Task<byte[]?> TryDownloadAsync(
        string container,
        string blobKey,
        CancellationToken cancellationToken)
    {
        if (_serviceClient is null || string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(blobKey))
        {
            return null;
        }

        var blob = Blob(container, blobKey);
        if (!await blob.ExistsAsync(cancellationToken))
        {
            return null;
        }

        var response = await blob.DownloadContentAsync(cancellationToken);
        var bytes = response.Value.Content.ToArray();
        return bytes.Length == 0 ? null : bytes;
    }

    private async Task<Uri> CreateSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        BlobSasPermissions permissions,
        CancellationToken cancellationToken)
    {
        var blob = Blob(container, blobKey);
        var expiresOn = DateTimeOffset.UtcNow.Add(timeToLive);
        var physicalKey = AzureBlobKeyPrefix.Apply(_options.KeyPrefix, blobKey);

        // Connection-string clients can sign a Service SAS directly with the shared key.
        if (blob.CanGenerateSasUri)
        {
            return blob.GenerateSasUri(permissions, expiresOn);
        }

        // Managed Identity: sign a User Delegation SAS (no account key needed).
        var startsOn = DateTimeOffset.UtcNow.AddMinutes(-5);
        var delegationKey = await _serviceClient!.GetUserDelegationKeyAsync(startsOn, expiresOn, cancellationToken);
        var builder = new BlobSasBuilder
        {
            BlobContainerName = container,
            BlobName = physicalKey,
            Resource = "b",
            StartsOn = startsOn,
            ExpiresOn = expiresOn,
        };
        builder.SetPermissions(permissions);
        var sas = builder.ToSasQueryParameters(delegationKey.Value, _serviceClient.AccountName).ToString();
        return new Uri($"{blob.Uri}?{sas}");
    }

    public async Task DeleteAsync(string container, string blobKey, CancellationToken cancellationToken)
    {
        await Blob(container, blobKey).DeleteIfExistsAsync(cancellationToken: cancellationToken);
    }

    public async Task<bool> ContainerExistsAsync(string container, CancellationToken cancellationToken)
    {
        if (_serviceClient is null)
        {
            return false;
        }

        var response = await _serviceClient.GetBlobContainerClient(container).ExistsAsync(cancellationToken);
        return response.Value;
    }

    private BlobClient Blob(string container, string blobKey)
    {
        if (_serviceClient is null)
        {
            throw new InvalidOperationException("Azure Blob storage is not configured (set AzureBlob:ConnectionString or AzureBlob:ServiceUri).");
        }

        return _serviceClient.GetBlobContainerClient(container)
            .GetBlobClient(AzureBlobKeyPrefix.Apply(_options.KeyPrefix, blobKey));
    }
}
