using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Documents.Infrastructure;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class LocalFileDocumentStorageTests
{
    [Fact]
    public async Task UploadDownloadAndDeleteRoundTrip()
    {
        using var scope = NewStorage();
        var storage = scope.Storage;
        const string container = "app-proposaltracker";
        const string key = "PROP-1/term-sheet/sample.pdf";
        await using var input = new MemoryStream("pdf-bytes"u8.ToArray());

        await storage.EnsureContainerAsync(container, CancellationToken.None);
        var uploaded = await storage.UploadAsync(container, key, input, "application/pdf", CancellationToken.None);
        Assert.Equal(9, uploaded.Size);
        Assert.Equal("application/pdf", uploaded.ContentType);

        var existing = await storage.TryGetAsync(container, key, CancellationToken.None);
        Assert.NotNull(existing);
        Assert.Equal(9, existing!.Size);

        var bytes = await storage.TryDownloadAsync(container, key, CancellationToken.None);
        Assert.Equal("pdf-bytes"u8.ToArray(), bytes);

        var readUrl = await storage.CreateReadSasUriAsync(container, key, TimeSpan.FromMinutes(5), CancellationToken.None);
        Assert.False(readUrl.IsAbsoluteUri);
        Assert.Contains("perm=r", readUrl.ToString(), StringComparison.Ordinal);

        await storage.DeleteAsync(container, key, CancellationToken.None);
        Assert.Null(await storage.TryGetAsync(container, key, CancellationToken.None));
    }

    [Fact]
    public async Task RejectsPathTraversalKeys()
    {
        using var scope = NewStorage();
        await using var input = new MemoryStream("x"u8.ToArray());
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            scope.Storage.UploadAsync("app-proposaltracker", "../../../etc/passwd", input, "text/plain", CancellationToken.None));
    }

    [Fact]
    public async Task WriteTicketThenCompleteLooksLikeAzureSas()
    {
        using var scope = NewStorage();
        const string container = "app-vendormanagement";
        const string key = "GOBEL0001/siup/file.pdf";
        var writeUrl = await scope.Storage.CreateWriteSasUriAsync(container, key, TimeSpan.FromMinutes(10), CancellationToken.None);
        Assert.Contains("perm=w", writeUrl.ToString(), StringComparison.Ordinal);
        var tryWrite = await scope.Storage.TryCreateWriteSasUriAsync(container, key, TimeSpan.FromMinutes(10), CancellationToken.None);
        Assert.NotNull(tryWrite);
        Assert.Equal(writeUrl, tryWrite);

        await using var input = new MemoryStream("akta"u8.ToArray());
        await scope.Storage.UploadAsync(container, key, input, "application/pdf", CancellationToken.None);
        var found = await scope.Storage.TryGetAsync(container, key, CancellationToken.None);
        Assert.NotNull(found);
        Assert.True(found!.Size > 0);
    }

    private static StorageScope NewStorage()
    {
        var root = Path.Combine(Path.GetTempPath(), "ip-local-blob-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var options = Options.Create(new AzureBlobOptions
        {
            UseLocalStorage = true,
            LocalRoot = root,
            KeyPrefix = "dev",
            Containers = new Dictionary<string, string>(AzureBlobStorageMode.DefaultContainers),
        });
        var storage = new LocalFileDocumentStorage(
            options,
            new LocalDocumentAccess(),
            new TestHostEnvironment(root));
        return new StorageScope(storage, root);
    }

    private sealed class StorageScope : IDisposable
    {
        public StorageScope(LocalFileDocumentStorage storage, string root)
        {
            Storage = storage;
            Root = root;
        }

        public LocalFileDocumentStorage Storage { get; }
        public string Root { get; }

        public void Dispose()
        {
            try
            {
                if (Directory.Exists(Root))
                {
                    Directory.Delete(Root, recursive: true);
                }
            }
            catch (IOException)
            {
                // best-effort cleanup of the temp root
            }
        }
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public TestHostEnvironment(string contentRoot) => ContentRootPath = contentRoot;

        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "tests";
        public string ContentRootPath { get; set; }
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
