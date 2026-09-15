using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>
/// Records a SharePoint sharing link that has been migrated to Azure Blob Storage. Keyed by a stable hash
/// of the link so the mapping survives the Contract projection being rebuilt on every state push. The
/// projected <see cref="ContractVersion.DocumentLink"/> joins to this by <see cref="LinkHash"/> to expose a
/// previewable blob reference.
/// </summary>
public sealed class SharePointDocument : AuditableEntity
{
    private SharePointDocument()
    {
        LinkHash = string.Empty;
        SharingLink = string.Empty;
        Container = string.Empty;
        BlobKey = string.Empty;
    }

    public SharePointDocument(
        Guid id,
        string linkHash,
        string sharingLink,
        string container,
        string blobKey,
        string? fileName,
        string? contentType,
        long sizeBytes,
        DateTimeOffset migratedAt)
        : base(id)
    {
        LinkHash = linkHash;
        SharingLink = sharingLink;
        Container = container;
        BlobKey = blobKey;
        FileName = fileName;
        ContentType = contentType;
        SizeBytes = sizeBytes;
        MigratedAt = migratedAt;
    }

    public string LinkHash { get; private set; }

    public string SharingLink { get; private set; }

    public string Container { get; private set; }

    public string BlobKey { get; private set; }

    public string? FileName { get; private set; }

    public string? ContentType { get; private set; }

    public long SizeBytes { get; private set; }

    public DateTimeOffset MigratedAt { get; private set; }

    /// <summary>
    /// Matches <c>SHAREPOINT_DOC_T.SharingLink</c> / import-row / contract-version columns.
    /// A longer Graph URL must be hashed both in full and at this prefix.
    /// </summary>
    public const int SharingLinkMaxLength = 1000;

    public static string TruncateSharingLink(string? sharingLink)
    {
        var trimmed = (sharingLink ?? string.Empty).Trim();
        return trimmed.Length <= SharingLinkMaxLength ? trimmed : trimmed[..SharingLinkMaxLength];
    }

    /// <summary>Stable lowercase-hex SHA-256 of the trimmed sharing link — the migration key.</summary>
    public static string HashLink(string sharingLink)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes((sharingLink ?? string.Empty).Trim()));
        var builder = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes)
        {
            builder.Append(b.ToString("x2", CultureInfo.InvariantCulture));
        }

        return builder.ToString();
    }

    /// <summary>True for an http(s) SharePoint sharing URL — the only links worth migrating.</summary>
    public static bool IsSharePointLink(string? link) =>
        !string.IsNullOrWhiteSpace(link)
        && (link.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || link.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        && link.Contains("sharepoint.com", StringComparison.OrdinalIgnoreCase);
}
