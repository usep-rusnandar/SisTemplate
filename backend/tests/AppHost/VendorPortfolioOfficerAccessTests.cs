using IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorPortfolioOfficerAccessTests
{
    private static VendorStatusDto Status(
        string code,
        int order,
        string? nextId = null,
        string? approverRole = null) =>
        new(code, code, null, null, null, order, true, nextId, approverRole, null);

    private static VendorApprovalChain Chain() => new(
    [
        Status("DRAFT", 3, nextId: "SBMIT"),
        Status("SBMIT", 4, nextId: "APPR1", approverRole: "OFFCR-VDR"),
        Status("APPR1", 5, nextId: "APPR2", approverRole: "DEPHD-VDR"),
        Status("APPR2", 6, nextId: "APPRV", approverRole: "DIV-HD"),
        Status("APPRV", 7, nextId: "RGSTD"),
        Status("RGSTD", 8),
        Status("REPIR", 9),
        Status("RJCTD", 10),
    ]);

    [Theory]
    [InlineData("OFFCR-VDR", true)]
    [InlineData("SPR-ADM", true)]
    [InlineData("offcr-vdr", true)]
    [InlineData("ADM-VDR", false)]
    [InlineData("DEPHD-VDR", false)]
    public void OfficerPartyIsTheVendorOnboardingOfficerOrSuperAdmin(string role, bool expected)
    {
        Assert.Equal(expected, VendorPortfolioOfficerAccess.HasOfficerPartyRole([role]));
    }

    [Fact]
    public void AdministratorVendorOnboardingIsNotTheOfficerParty()
    {
        Assert.False(VendorPortfolioOfficerAccess.HasOfficerPartyRole(["ADM-VDR", "DEPHD-VDR"]));
        Assert.True(VendorPortfolioOfficerAccess.HasOfficerPartyRole(["ADM-VDR", "OFFCR-VDR"]));
    }

    [Theory]
    [InlineData("SBMIT", true)]
    [InlineData("APPR1", true)]
    [InlineData("APPR2", true)]
    [InlineData("APPRV", true)]
    [InlineData("RGSTD", true)]
    [InlineData("DRAFT", false)]
    [InlineData("REPIR", false)]
    [InlineData("RJCTD", false)]
    [InlineData("INVTD", false)]
    public void OfficerMutatesWhileAwaitingApprovalOrAfterApproved(string status, bool expected)
    {
        Assert.Equal(expected, VendorPortfolioOfficerAccess.CanMutateForStatus(status, Chain()));
    }

    [Fact]
    public void ApprovedStaysEditableEvenWithoutAChain()
    {
        Assert.True(VendorPortfolioOfficerAccess.CanMutateForStatus(VendorStatuses.Approved, null));
        Assert.True(VendorPortfolioOfficerAccess.CanMutateForStatus(VendorStatuses.Registered, null));
        Assert.False(VendorPortfolioOfficerAccess.CanMutateForStatus(VendorStatuses.Submitted, null));
    }
}

public sealed class VendorPortfolioReplacementTests
{
    [Fact]
    public void IncomingVendorRowsSkipOfficerOwnerKeys()
    {
        var officer = VendorPortfolio.Create(
            "V0001", "PT A", "Scope A", 1, new DateOnly(2024, 8, 1), new DateOnly(2025, 1, 1),
            VendorPortfolioParties.Officer);
        var incoming = new VendorPortfolioInput[]
        {
            new("PT A", "Should not clone officer", 9, new DateOnly(2024, 8, 1), new DateOnly(2025, 1, 1)),
            new("PT B", "Vendor own", 2, new DateOnly(2023, 1, 1), new DateOnly(2023, 12, 1)),
        };

        var rows = VendorPortfolioReplacement.VendorOwnedIncoming("V0001", incoming, [officer]);

        Assert.Single(rows);
        Assert.Equal("PT B", rows[0].Client);
        Assert.Equal(VendorPortfolioParties.Vendor, rows[0].EnteredByParty);
    }

    [Fact]
    public void EmptyPayloadDoesNotTouchOfficerSemantics()
    {
        var officer = VendorPortfolio.Create(
            "V0001", "PT A", "Scope A", 1, new DateOnly(2024, 8, 1), new DateOnly(2025, 1, 1),
            VendorPortfolioParties.Officer);

        Assert.Empty(VendorPortfolioReplacement.VendorOwnedIncoming("V0001", [], [officer]));
        Assert.Empty(VendorPortfolioReplacement.VendorOwnedIncoming("V0001", null, [officer]));
    }
}

public sealed class VendorPortfolioTests
{
    [Fact]
    public void CreateDefaultsToVendorParty()
    {
        var row = VendorPortfolio.Create("V0001", " Client ", "Work", 10, new DateOnly(2024, 8, 1), new DateOnly(2024, 9, 1));

        Assert.Equal(VendorPortfolioParties.Vendor, row.EnteredByParty);
        Assert.False(row.IsOfficerEntered);
        Assert.Equal("Client", row.Client);
        Assert.Equal("Client|2024-08-01", row.DocumentOwnerKey);
    }

    [Fact]
    public void CreateRejectsUnknownParty()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            VendorPortfolio.Create("V0001", "C", "S", 1, new DateOnly(2024, 1, 1), new DateOnly(2024, 2, 1), "Admin"));
    }

    [Fact]
    public void UpdateDoesNotChangeParty()
    {
        var row = VendorPortfolio.Create(
            "V0001", "A", "S1", 1, new DateOnly(2024, 1, 1), new DateOnly(2024, 2, 1),
            VendorPortfolioParties.Officer);
        row.Update("B", "S2", 3, new DateOnly(2024, 3, 1), new DateOnly(2024, 4, 1));

        Assert.Equal(VendorPortfolioParties.Officer, row.EnteredByParty);
        Assert.True(row.IsOfficerEntered);
        Assert.Equal("B|2024-03-01", row.DocumentOwnerKey);
    }
}
