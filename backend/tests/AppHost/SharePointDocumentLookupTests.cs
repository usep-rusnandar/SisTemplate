using IntegratedProcurement.AppHost.Api.Endpoints;
using IntegratedProcurement.Modules.ContractMonitoring.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class SharePointDocumentLookupTests
{
    [Fact]
    public void LinkHashCandidatesIncludesTruncatedPrefixForLongUrls()
    {
        var link = "https://contoso.sharepoint.com/:b:/s/site/" + new string('a', 1200);
        var hashes = SharePointDocumentLookup.LinkHashCandidates(link);

        Assert.Equal(2, hashes.Count);
        Assert.Contains(SharePointDocument.HashLink(link), hashes);
        Assert.Contains(SharePointDocument.HashLink(link[..SharePointDocument.SharingLinkMaxLength]), hashes);
        Assert.NotEqual(
            SharePointDocument.HashLink(link),
            SharePointDocument.HashLink(link[..SharePointDocument.SharingLinkMaxLength]));
    }

    [Fact]
    public void LinkHashCandidatesIsSingleHashWhenLinkFitsColumn()
    {
        const string link = "https://contoso.sharepoint.com/:b:/s/site/short-token";
        var hashes = SharePointDocumentLookup.LinkHashCandidates(link);

        Assert.Single(hashes);
        Assert.Equal(SharePointDocument.HashLink(link), hashes[0]);
    }

    [Fact]
    public void SharingLinkMatchesStoredPrefixOfLongUrl()
    {
        var full = "https://contoso.sharepoint.com/:b:/s/site/" + new string('b', 1100);
        var stored = full[..SharePointDocument.SharingLinkMaxLength];

        Assert.True(SharePointDocumentLookup.SharingLinkMatches(stored, full));
        Assert.True(SharePointDocumentLookup.SharingLinkMatches(full, full));
        Assert.False(SharePointDocumentLookup.SharingLinkMatches(stored, "https://other.sharepoint.com/file"));
    }

    [Fact]
    public void TryParseBlobLinkReadsContainerAndKey()
    {
        Assert.True(SharePointDocumentLookup.TryParseBlobLink(
            "blob://app-contractmonitoring/sharepoint/abc.pdf", out var container, out var key));
        Assert.Equal("app-contractmonitoring", container);
        Assert.Equal("sharepoint/abc.pdf", key);
        Assert.False(SharePointDocumentLookup.TryParseBlobLink("https://contoso.sharepoint.com/x", out _, out _));
    }

    [Fact]
    public void StreamUrlEscapesContainerAndKey()
    {
        var url = DocumentReadLinks.StreamUrl("app-cm", "sharepoint/ab c/file.pdf");
        Assert.Equal("/api/v1/documents/stream?container=app-cm&key=sharepoint%2Fab%20c%2Ffile.pdf", url);
    }

    [Fact]
    public void VendorProxyUploadUrlEscapesContainerAndKey()
    {
        var url = DocumentReadLinks.VendorProxyUploadUrl("app-vendormanagement", "GOBEL/pact/file.pdf");
        Assert.Equal(
            "/api/v1/vendor-portal/documents/upload-bytes?container=app-vendormanagement&key=GOBEL%2Fpact%2Ffile.pdf",
            url);
    }

    [Fact]
    public void ImportJobRowPersistsTruncatedSharingLink()
    {
        var full = "https://contoso.sharepoint.com/:b:/s/site/" + new string('c', 1100);
        var row = new ImportJobRow(Guid.NewGuid(), Guid.NewGuid(), 1, "030/SIS/K/GAF/VIII/2026", "Title", "Supplier", full);
        Assert.Equal(SharePointDocument.SharingLinkMaxLength, row.SharingLink!.Length);
        Assert.Equal(SharePointDocument.TruncateSharingLink(full), row.SharingLink);
    }

    [Fact]
    public async Task MappedReadUrlFallsBackToStreamWhenSasCannotBeSigned()
    {
        var url = await DocumentReadLinks.TryBuildMappedReadUrlAsync(
            new SasUnavailableStorage(),
            "app-contractmonitoring",
            "sharepoint/abc.pdf",
            CancellationToken.None);

        Assert.Equal(
            "/api/v1/documents/stream?container=app-contractmonitoring&key=sharepoint%2Fabc.pdf",
            url);
    }

    private sealed class SasUnavailableStorage : IDocumentStorage
    {
        public bool IsConfigured => true;

        public string ContainerForModule(string moduleKey) => "app-contractmonitoring";

        public Task EnsureContainerAsync(string container, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<DocumentUploadResult> UploadAsync(
            string container, string blobKey, Stream content, string contentType, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Uri> CreateReadSasUriAsync(
            string container, string blobKey, TimeSpan timeToLive, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("AuthorizationPermissionMismatch");

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
            Task.FromResult<DocumentUploadResult?>(new DocumentUploadResult(container, blobKey, 10, "application/pdf"));

        public Task<byte[]?> TryDownloadAsync(
            string container, string blobKey, CancellationToken cancellationToken) =>
            Task.FromResult<byte[]?>([1, 2, 3]);

        public Task DeleteAsync(string container, string blobKey, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<bool> ContainerExistsAsync(string container, CancellationToken cancellationToken) => Task.FromResult(true);
    }
}
