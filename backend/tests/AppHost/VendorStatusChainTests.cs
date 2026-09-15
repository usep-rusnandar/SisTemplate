using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// The approval route IS the master-data chain: SBMIT → APPR1 → APPR2 → APPRV, with the approving role
/// held in a separate field. Status codes and role codes are deliberately different here — the queue must
/// resolve one from the other, not assume they match.
/// </summary>
public sealed class VendorStatusChainTests
{
    private static VendorStatusDto Status(
        string code,
        int order,
        string? nextId = null,
        string? approverRole = null,
        int? slaDays = null) =>
        new(code, code, null, null, null, order, true, nextId, approverRole, slaDays);

    private static VendorApprovalChain Chain() => new(
    [
        Status("DRAFT", 3, nextId: "SBMIT"),
        Status("SBMIT", 4, nextId: "APPR1", approverRole: "OFFCR-VDR", slaDays: 2),
        Status("APPR1", 5, nextId: "APPR2", approverRole: "DEPHD-VDR", slaDays: 3),
        Status("APPR2", 6, nextId: "APPRV", approverRole: "DIV-HD", slaDays: 2),
        Status("APPRV", 7, nextId: "RGSTD"),
        Status("RGSTD", 8),
    ]);

    [Fact]
    public void ApprovalStationsAreTheStatusesThatNameARole()
    {
        var stations = Chain().ApprovalStations().Select(station => station.Code).ToArray();

        Assert.Equal(["SBMIT", "APPR1", "APPR2"], stations);
    }

    [Theory]
    [InlineData("SBMIT", "APPR1")]
    [InlineData("APPR1", "APPR2")]
    [InlineData("APPR2", "APPRV")]
    public void ApprovingMovesToTheConfiguredNextStatus(string from, string expected)
    {
        Assert.Equal(expected, Chain().NextAfter(from));
    }

    [Fact]
    public void TheEndOfTheChainHasNoNextStatus()
    {
        Assert.Null(Chain().NextAfter("RGSTD"));
    }

    [Fact]
    public void TheQueueShowsOnlyStatusesTheActorsRolesApprove()
    {
        var chain = Chain();

        // Role DEPHD-VDR approves the status APPR1 — the two vocabularies are separate.
        Assert.Equal(["APPR1"], chain.StatusesAwaiting(["DEPHD-VDR"]));
        Assert.Empty(chain.StatusesAwaiting(["ADM-TRK"]));
        Assert.Equal(
            ["APPR2", "SBMIT"],
            chain.StatusesAwaiting(["OFFCR-VDR", "DIV-HD"]).OrderBy(code => code).ToArray());
    }

    [Fact]
    public void AStatusWithoutARoleIsNotWaitingOnAnybody()
    {
        var chain = Chain();

        Assert.False(chain.IsAwaitingApproval("DRAFT"));
        Assert.False(chain.IsAwaitingApproval("APPRV"));
        Assert.True(chain.IsAwaitingApproval("SBMIT"));
    }

    [Fact]
    public void EveryStatusTheApplicationWritesFitsTheStorageColumns()
    {
        foreach (var code in VendorStatuses.All)
        {
            Assert.InRange(code.Length, 1, VendorStatuses.MaxCodeLength);
        }
    }
}
