using SisTemplate.AppHost.Api.Endpoints;
using SisTemplate.AppHost.Api.Services;
using SisTemplate.Platform.Documents.Application;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace SisTemplate.AppHost.Api.IntegrationTests;

public sealed class UserAvatarBlobTests
{
    [Fact]
    public async Task ReplaceReturnsStreamUrlWhenReadSasCannotBeSigned()
    {
        var storage = new SasUnavailableAvatarStorage();
        var file = new FakePngFormFile();

        var url = await UserAvatarBlob.ReplaceAsync(
            storage, Config(), "00109610", file, CancellationToken.None);

        Assert.Equal(
            DocumentReadLinks.StreamUrl("app-platform-users", "avatars/00109610"),
            url);
        Assert.False(storage.CreateReadSasCalled);
        Assert.True(storage.Uploaded);
    }

    [Fact]
    public async Task TryReadUrlReturnsStreamUrlWhenPhotoExistsButSasCannotBeSigned()
    {
        var storage = new SasUnavailableAvatarStorage { Existing = true };

        var url = await UserAvatarBlob.TryReadUrlAsync(
            storage, Config(), "00109610", CancellationToken.None);

        Assert.Equal(
            DocumentReadLinks.StreamUrl("app-platform-users", "avatars/00109610"),
            url);
    }

    [Fact]
    public async Task TryReadUrlReturnsNullWhenPhotoIsMissing()
    {
        var storage = new SasUnavailableAvatarStorage { Existing = false };

        var url = await UserAvatarBlob.TryReadUrlAsync(
            storage, Config(), "00109610", CancellationToken.None);

        Assert.Null(url);
    }

    private static IConfiguration Config() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AzureBlob:Containers:platformUser"] = "app-platform-users",
            })
            .Build();

    private sealed class FakePngFormFile : IFormFile
    {
        private readonly byte[] _bytes = [0x89, 0x50, 0x4E, 0x47];

        public string ContentType => "image/png";

        public string ContentDisposition => "form-data; name=\"file\"; filename=\"photo.png\"";

        public IHeaderDictionary Headers => new HeaderDictionary();

        public long Length => _bytes.Length;

        public string Name => "file";

        public string FileName => "photo.png";

        public void CopyTo(Stream target) => target.Write(_bytes);

        public Task CopyToAsync(Stream target, CancellationToken cancellationToken = default)
        {
            target.Write(_bytes);
            return Task.CompletedTask;
        }

        public Stream OpenReadStream() => new MemoryStream(_bytes, writable: false);
    }

    private sealed class SasUnavailableAvatarStorage : IDocumentStorage
    {
        public bool Existing { get; set; }

        public bool Uploaded { get; private set; }

        public bool CreateReadSasCalled { get; private set; }

        public bool IsConfigured => true;

        public string ContainerForModule(string moduleKey) => "app-platform-users";

        public Task EnsureContainerAsync(string container, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<DocumentUploadResult> UploadAsync(
            string container, string blobKey, Stream content, string contentType, CancellationToken cancellationToken)
        {
            Uploaded = true;
            Existing = true;
            return Task.FromResult(new DocumentUploadResult(container, blobKey, content.Length, contentType));
        }

        public Task<Uri> CreateReadSasUriAsync(
            string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken)
        {
            CreateReadSasCalled = true;
            throw new InvalidOperationException("AuthorizationPermissionMismatch");
        }

        public Task<Uri> CreateWriteSasUriAsync(
            string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Uri?> TryCreateWriteSasUriAsync(
            string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken) =>
            Task.FromResult<Uri?>(null);

        public Task<Uri?> TryCreateReadSasUriAsync(
            string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken) =>
            Task.FromResult<Uri?>(null);

        public Task<DocumentUploadResult?> TryGetAsync(
            string container, string blobKey, CancellationToken cancellationToken) =>
            Task.FromResult<DocumentUploadResult?>(
                Existing ? new DocumentUploadResult(container, blobKey, 4, "image/png") : null);

        public Task<byte[]?> TryDownloadAsync(
            string container, string blobKey, CancellationToken cancellationToken) =>
            Task.FromResult<byte[]?>(Existing ? [1, 2, 3, 4] : null);

        public Task DeleteAsync(string container, string blobKey, CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public Task<bool> ContainerExistsAsync(string container, CancellationToken cancellationToken) =>
            Task.FromResult(true);
    }
}
