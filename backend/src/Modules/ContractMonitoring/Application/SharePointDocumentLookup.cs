namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

using IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>
/// Link hashes used to find a migrated SharePoint file. SharingLink columns are
/// nvarchar(1000); a longer Graph sharing URL hashes differently than the stored
/// prefix, so resolve must try both.
/// </summary>
public static class SharePointDocumentLookup
{
    public const int SharingLinkColumnMax = SharePointDocument.SharingLinkMaxLength;

    public static IReadOnlyList<string> LinkHashCandidates(string link)
    {
        var trimmed = (link ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return [];
        }

        var hashes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            SharePointDocument.HashLink(trimmed)
        };
        if (trimmed.Length > SharingLinkColumnMax)
        {
            hashes.Add(SharePointDocument.HashLink(trimmed[..SharingLinkColumnMax]));
        }

        return hashes.ToList();
    }

    public static bool SharingLinkMatches(string storedLink, string requestedLink)
    {
        var stored = (storedLink ?? string.Empty).Trim();
        var requested = (requestedLink ?? string.Empty).Trim();
        if (stored.Length == 0 || requested.Length == 0)
        {
            return false;
        }

        if (string.Equals(stored, requested, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return requested.StartsWith(stored, StringComparison.OrdinalIgnoreCase)
               && stored.Length == SharingLinkColumnMax;
    }

    public static bool TryParseBlobLink(string link, out string container, out string blobKey)
    {
        container = string.Empty;
        blobKey = string.Empty;
        const string prefix = "blob://";
        if (string.IsNullOrWhiteSpace(link) || !link.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var remainder = link[prefix.Length..];
        var slash = remainder.IndexOf('/');
        if (slash <= 0 || slash >= remainder.Length - 1)
        {
            return false;
        }

        container = remainder[..slash].Trim();
        blobKey = remainder[(slash + 1)..].Trim();
        return !string.IsNullOrWhiteSpace(container) && !string.IsNullOrWhiteSpace(blobKey);
    }
}
