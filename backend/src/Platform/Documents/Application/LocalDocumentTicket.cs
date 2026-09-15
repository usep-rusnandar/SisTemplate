using System.Security.Cryptography;
using System.Text;

namespace IntegratedProcurement.Platform.Documents.Application;

/// <summary>HMAC tickets for Development local-disk read/write URLs (stand-in for Azure SAS).</summary>
public static class LocalDocumentTicket
{
    public const string Path = "/api/v1/documents/local";

    public static string Sign(byte[] secret, string permission, string container, string blobKey, long expiresUnix)
    {
        ArgumentNullException.ThrowIfNull(secret);
        var payload = $"{permission}\n{container}\n{blobKey}\n{expiresUnix}";
        var hash = HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static bool IsValid(byte[] secret, string permission, string container, string blobKey, long expiresUnix, string? signature)
    {
        if (secret is null || secret.Length == 0 || string.IsNullOrWhiteSpace(signature))
        {
            return false;
        }

        if (expiresUnix < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
        {
            return false;
        }

        if (permission is not ("r" or "w"))
        {
            return false;
        }

        byte[] actual;
        try
        {
            actual = Convert.FromHexString(signature.Trim());
        }
        catch (FormatException)
        {
            return false;
        }

        var expected = Convert.FromHexString(Sign(secret, permission, container, blobKey, expiresUnix));
        return actual.Length == expected.Length && CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    public static Uri CreateRelativeUri(byte[] secret, string permission, string container, string blobKey, TimeSpan timeToLive)
    {
        var expiresUnix = DateTimeOffset.UtcNow.Add(timeToLive).ToUnixTimeSeconds();
        var signature = Sign(secret, permission, container, blobKey, expiresUnix);
        var query =
            "container=" + Uri.EscapeDataString(container)
            + "&key=" + Uri.EscapeDataString(blobKey)
            + "&exp=" + expiresUnix
            + "&perm=" + Uri.EscapeDataString(permission)
            + "&sig=" + signature;
        return new Uri(Path + "?" + query, UriKind.Relative);
    }
}
