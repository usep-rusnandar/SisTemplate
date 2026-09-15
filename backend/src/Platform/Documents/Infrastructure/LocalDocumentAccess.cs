using System.Security.Cryptography;

namespace IntegratedProcurement.Platform.Documents.Infrastructure;

/// <summary>Process-lifetime HMAC key for Development local-disk document URLs.</summary>
public sealed class LocalDocumentAccess
{
    public byte[] Secret { get; } = RandomNumberGenerator.GetBytes(32);
}
