using System.Text.Json;
using SisTemplate.Platform.Documents.Application;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace SisTemplate.Platform.Documents.Infrastructure;

/// <summary>
/// Development stand-in for Azure Blob. Uploads, deletes, and SAS-shaped read/write URLs stay on
/// the local disk so VM UAT can finish document steps without reaching Azure. Staging/Production
/// never register this type.
/// </summary>
public sealed class LocalFileDocumentStorage : IDocumentStorage
{
    private static readonly JsonSerializerOptions MetaJson = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly AzureBlobOptions _options;
    private readonly LocalDocumentAccess _access;
    private readonly string _root;

    public LocalFileDocumentStorage(
        IOptions<AzureBlobOptions> options,
        LocalDocumentAccess access,
        IHostEnvironment environment)
    {
        _options = options.Value;
        _access = access;
        var configured = string.IsNullOrWhiteSpace(_options.LocalRoot)
            ? Path.Combine(environment.ContentRootPath, "App_Data", "local-blob")
            : _options.LocalRoot;
        _root = Path.GetFullPath(configured);
        Directory.CreateDirectory(_root);
    }

    public bool IsConfigured => true;

    public string ContainerForModule(string moduleKey)
    {
        if (_options.Containers.TryGetValue(moduleKey, out var container) && !string.IsNullOrWhiteSpace(container))
        {
            return container;
        }

        if (AzureBlobStorageMode.DefaultContainers.TryGetValue(moduleKey, out var fallback) && !string.IsNullOrWhiteSpace(fallback))
        {
            return fallback;
        }

        var first = _options.Containers.Values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
        return first ?? throw new InvalidOperationException($"No document container configured for module '{moduleKey}'.");
    }

    public Task EnsureContainerAsync(string container, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(ContainerRoot(container));
        return Task.CompletedTask;
    }

    public async Task<DocumentUploadResult> UploadAsync(
        string container,
        string blobKey,
        Stream content,
        string contentType,
        CancellationToken cancellationToken)
    {
        var path = ResolvePath(container, blobKey);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using (var file = File.Create(path))
        {
            await content.CopyToAsync(file, cancellationToken);
        }

        var size = new FileInfo(path).Length;
        var type = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType;
        await WriteMetaAsync(path, type, cancellationToken);
        return new DocumentUploadResult(container, blobKey, size, type);
    }

    public Task<Uri> CreateReadSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        CancellationToken cancellationToken) =>
        Task.FromResult(LocalDocumentTicket.CreateRelativeUri(_access.Secret, "r", container, blobKey, timeToLive));

    public Task<Uri> CreateWriteSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        CancellationToken cancellationToken) =>
        Task.FromResult(LocalDocumentTicket.CreateRelativeUri(_access.Secret, "w", container, blobKey, timeToLive));

    public async Task<Uri?> TryCreateWriteSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        CancellationToken cancellationToken) =>
        await CreateWriteSasUriAsync(container, blobKey, timeToLive, cancellationToken);

    public async Task<Uri?> TryCreateReadSasUriAsync(
        string container,
        string blobKey,
        TimeSpan timeToLive,
        CancellationToken cancellationToken)
    {
        var existing = await TryGetAsync(container, blobKey, cancellationToken);
        return existing is null
            ? null
            : await CreateReadSasUriAsync(container, blobKey, timeToLive, cancellationToken);
    }

    public Task<DocumentUploadResult?> TryGetAsync(
        string container,
        string blobKey,
        CancellationToken cancellationToken)
    {
        var path = ResolvePath(container, blobKey);
        if (!File.Exists(path))
        {
            return Task.FromResult<DocumentUploadResult?>(null);
        }

        var info = new FileInfo(path);
        return Task.FromResult<DocumentUploadResult?>(
            new DocumentUploadResult(container, blobKey, info.Length, ReadContentType(path)));
    }

    public async Task<byte[]?> TryDownloadAsync(
        string container,
        string blobKey,
        CancellationToken cancellationToken)
    {
        var path = ResolvePath(container, blobKey);
        if (!File.Exists(path))
        {
            return null;
        }

        var bytes = await File.ReadAllBytesAsync(path, cancellationToken);
        return bytes.Length == 0 ? null : bytes;
    }

    public Task DeleteAsync(string container, string blobKey, CancellationToken cancellationToken)
    {
        var path = ResolvePath(container, blobKey);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        var meta = MetaPath(path);
        if (File.Exists(meta))
        {
            File.Delete(meta);
        }

        return Task.CompletedTask;
    }

    public Task<bool> ContainerExistsAsync(string container, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(ContainerRoot(container));
        return Task.FromResult(true);
    }

    public string ContentTypeFor(string container, string blobKey) => ReadContentType(ResolvePath(container, blobKey));

    private string ContainerRoot(string container)
    {
        var safe = SanitizeSegment(container);
        return Path.Combine(_root, safe);
    }

    private string ResolvePath(string container, string blobKey)
    {
        var physicalKey = AzureBlobKeyPrefix.Apply(_options.KeyPrefix, blobKey);
        if (string.IsNullOrWhiteSpace(physicalKey))
        {
            throw new InvalidOperationException("Document key is required.");
        }

        var relative = physicalKey.Replace('/', Path.DirectorySeparatorChar).Replace('\\', Path.DirectorySeparatorChar);
        var full = Path.GetFullPath(Path.Combine(ContainerRoot(container), relative));
        var rootPrefix = _root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(rootPrefix, StringComparison.Ordinal) && !string.Equals(full, _root, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Document key is outside the local storage root.");
        }

        return full;
    }

    private static string SanitizeSegment(string value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length == 0 || trimmed.Contains("..", StringComparison.Ordinal) || trimmed.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        {
            throw new InvalidOperationException("Document container is invalid.");
        }

        return trimmed;
    }

    private static string MetaPath(string filePath) => filePath + ".meta.json";

    private static async Task WriteMetaAsync(string filePath, string contentType, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(new LocalBlobMeta(contentType), MetaJson);
        await File.WriteAllTextAsync(MetaPath(filePath), json, cancellationToken);
    }

    private static string ReadContentType(string filePath)
    {
        var meta = MetaPath(filePath);
        if (!File.Exists(meta))
        {
            return "application/octet-stream";
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<LocalBlobMeta>(File.ReadAllText(meta), MetaJson);
            return string.IsNullOrWhiteSpace(parsed?.ContentType) ? "application/octet-stream" : parsed.ContentType;
        }
        catch (JsonException)
        {
            return "application/octet-stream";
        }
    }

    private sealed record LocalBlobMeta(string ContentType);
}
