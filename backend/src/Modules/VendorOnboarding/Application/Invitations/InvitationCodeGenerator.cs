using System.Security.Cryptography;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public static class InvitationCodeGenerator
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string Generate()
    {
        return $"VW-{GenerateBlock()}-{GenerateBlock()}";
    }

    public static string Normalize(string value)
    {
        return value.Trim().ToUpperInvariant();
    }

    public static string Mask(string value)
    {
        var normalized = Normalize(value);
        return normalized.Length <= 4
            ? "****"
            : $"VW-****-{normalized[^4..]}";
    }

    private static string GenerateBlock()
    {
        Span<char> block = stackalloc char[4];
        Span<byte> random = stackalloc byte[4];
        RandomNumberGenerator.Fill(random);

        for (var index = 0; index < block.Length; index++)
        {
            block[index] = Alphabet[random[index] % Alphabet.Length];
        }

        return new string(block);
    }
}
