using IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorInvitationCodeTests
{
    [Fact]
    public void GeneratedCodeUsesVendorInvitationFormat()
    {
        var code = InvitationCodeGenerator.Generate();

        Assert.Matches(@"^VW-[A-Z2-9]{4}-[A-Z2-9]{4}$", code);
        Assert.DoesNotContain("0", code);
        Assert.DoesNotContain("1", code);
        Assert.DoesNotContain("I", code);
        Assert.DoesNotContain("O", code);
    }

    [Fact]
    public void HashNormalizesInvitationCode()
    {
        var upperHash = InvitationCodeHasher.Hash("VW-K7P2-9MQX");
        var mixedHash = InvitationCodeHasher.Hash("  vw-k7p2-9mqx  ");

        Assert.Equal(upperHash, mixedHash);
    }
}
