using System.Security.Cryptography;
using System.Text;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public static class InvitationCodeHasher
{
    public static string Hash(string invitationCode)
    {
        var normalized = InvitationCodeGenerator.Normalize(invitationCode);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(bytes);
    }
}
