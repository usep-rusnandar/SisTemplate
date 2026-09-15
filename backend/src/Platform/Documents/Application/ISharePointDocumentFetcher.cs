namespace IntegratedProcurement.Platform.Documents.Application;

/// <summary>
/// App-only fetch of a document from SharePoint Online via the Microsoft Graph <c>/shares</c> endpoint.
/// Dev authenticates with an App Registration client secret; Azure slots use the same secret when
/// <c>SharePoint__ClientSecret</c> is set, otherwise Managed Identity — the implementation picks
/// the credential automatically (same pattern as <see cref="IDocumentStorage"/>).
/// </summary>
public interface ISharePointDocumentFetcher
{
    /// <summary>True when the SharePoint section (at least a TenantId) is configured.</summary>
    bool IsConfigured { get; }

    /// <summary>
    /// Resolves a SharePoint sharing link (e.g. <c>https://contoso.sharepoint.com/:b:/s/Site/xxx</c>) to its
    /// file content. Throws on transport/permission failures after exhausting throttling retries.
    /// </summary>
    Task<SharePointFile> DownloadAsync(string sharingLink, CancellationToken cancellationToken);

    /// <summary>
    /// Lists immediate children of a folder sharing link (files + subfolders). Used by Contract Monitoring
    /// List-of-Material folder sync. Throws when the link does not resolve to a folder.
    /// </summary>
    Task<IReadOnlyList<SharePointDriveChild>> ListFolderChildrenAsync(string folderSharingLink, CancellationToken cancellationToken);

    /// <summary>Downloads file content by drive item id (from <see cref="ListFolderChildrenAsync"/>).</summary>
    Task<Stream> DownloadDriveItemAsync(string driveId, string itemId, CancellationToken cancellationToken);
}

/// <summary>Downloaded SharePoint file: a readable content stream plus the resolved name and MIME type.</summary>
public sealed record SharePointFile(Stream Content, string FileName, string ContentType);

/// <summary>One child under a SharePoint folder (file or subfolder).</summary>
public sealed record SharePointDriveChild(
    string DriveId,
    string ItemId,
    string Name,
    bool IsFolder,
    DateTimeOffset LastModified,
    long? SizeBytes);

public sealed class SharePointOptions
{
    public const string SectionName = "SharePoint";

    /// <summary>Microsoft Entra directory (tenant) ID. Required for any SharePoint access.</summary>
    public string? TenantId { get; set; }

    /// <summary>App Registration application (client) ID. Used with <see cref="ClientSecret"/> on Development, Staging, and Production.</summary>
    public string? ClientId { get; set; }

    /// <summary>
    /// App Registration client secret. When set (App Service <c>SharePoint__ClientSecret</c>), Graph
    /// uses this identity instead of Managed Identity. Required on slots that have no MI, and the
    /// usual fix when MI can get a token but Graph returns 401 (no Sites.Read.All / Sites.Selected).
    /// </summary>
    public string? ClientSecret { get; set; }

    /// <summary>User-assigned Managed Identity client id when no client secret is set. Omit for system-assigned.</summary>
    public string? ManagedIdentityClientId { get; set; }

    /// <summary>Max seconds to fetch one document before failing it. Bounds slow/stalled downloads. Default 300.</summary>
    public int DownloadTimeoutSeconds { get; set; } = 300;
}
