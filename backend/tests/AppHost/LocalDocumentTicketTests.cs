using SisTemplate.Platform.Documents.Application;

namespace SisTemplate.AppHost.Api.IntegrationTests;

public sealed class LocalDocumentTicketTests
{
    [Fact]
    public void ValidTicketRoundTrips()
    {
        var secret = "unit-test-secret-unit-test-secret!"u8.ToArray();
        var exp = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
        var sig = LocalDocumentTicket.Sign(secret, "r", "app-proposaltracker", "case/doc.pdf", exp);
        Assert.True(LocalDocumentTicket.IsValid(secret, "r", "app-proposaltracker", "case/doc.pdf", exp, sig));
    }

    [Fact]
    public void TamperedSignatureIsRejected()
    {
        var secret = "unit-test-secret-unit-test-secret!"u8.ToArray();
        var exp = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
        var sig = LocalDocumentTicket.Sign(secret, "w", "app-vendormanagement", "V001/siup/a.pdf", exp);
        Assert.False(LocalDocumentTicket.IsValid(secret, "w", "app-vendormanagement", "V001/siup/a.pdf", exp, sig[..^2] + "00"));
    }

    [Fact]
    public void ExpiredTicketIsRejected()
    {
        var secret = "unit-test-secret-unit-test-secret!"u8.ToArray();
        var exp = DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds();
        var sig = LocalDocumentTicket.Sign(secret, "r", "c", "k", exp);
        Assert.False(LocalDocumentTicket.IsValid(secret, "r", "c", "k", exp, sig));
    }

    [Fact]
    public void RelativeUriKeepsPermissionAndKey()
    {
        var secret = "unit-test-secret-unit-test-secret!"u8.ToArray();
        var uri = LocalDocumentTicket.CreateRelativeUri(secret, "w", "app-proposaltracker", "prop/doc.pdf", TimeSpan.FromMinutes(15));
        Assert.False(uri.IsAbsoluteUri);
        var text = uri.ToString();
        Assert.StartsWith(LocalDocumentTicket.Path + "?", text, StringComparison.Ordinal);
        Assert.Contains("perm=w", text, StringComparison.Ordinal);
        Assert.Contains("key=prop%2Fdoc.pdf", text, StringComparison.Ordinal);
    }
}
