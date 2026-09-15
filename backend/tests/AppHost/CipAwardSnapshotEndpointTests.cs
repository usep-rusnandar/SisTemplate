using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Modules.VendorOnboarding.Application;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// CIP Term Sheet snapshot: vendor office address from <c>vdr.VENDOR_T</c> via
/// <see cref="IVendorOfficeAddressReadPort"/>, and award-step documents from Tracker KV via
/// <see cref="ITrackerAwardSnapshotReadPort"/>.
/// </summary>
public sealed class CipAwardSnapshotEndpointTests : IClassFixture<IsolatedApiFixture>
{
    private readonly IsolatedApiFixture _factory;

    public CipAwardSnapshotEndpointTests(IsolatedApiFixture factory) => _factory = factory;

    [Fact]
    public async Task CipCasesPayloadIncludesVendorOfficeAddressAndAwardDocuments()
    {
        const string proposalKey = "2026/S.03.02/GeneralAffair/JAHO/SNAP-1";
        const string vendorId = "GOBEL0001";
        const string vendorName = "PT GOBEL DHARMA SARANA KARYA";
        const string officeAddress = "Jl. Raya Bekasi Km 28, Cakung, Jakarta Timur";
        const string caseKey = "CIP-2026-SNAP-1";
        const string activityKey = "ACT-EVAL";

        var vendor = Vendor.ImportLegacy(vendorId, vendorName, VendorStatuses.Registered);
        vendor.SetOfficeAddress(VendorAddress.Create(officeAddress, null, null, null, null, null, null, "Indonesia", null, null));

        using (var scope = _factory.Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            dbContext.Vendors.Add(vendor);
            dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(),
                proposalKey,
                "PR-SNAP-1",
                "Snapshot document wiring",
                "ARIBA-SNAP-1",
                "Services",
                "JAHO",
                "General Affair",
                "Contractual",
                "Service Agreement",
                190_000m,
                "standard",
                "OnProgress",
                "Bid Evaluation",
                "Normal",
                "Owner",
                "Officer",
                new DateOnly(2026, 7, 1),
                1,
                10,
                0,
                "{}"));
            dbContext.TrackerProposalActivities.Add(new TrackerProposalActivity(
                Guid.NewGuid(),
                proposalKey,
                activityKey,
                "EVAL",
                "Bid Evaluation",
                "Officer",
                "Completed",
                2,
                2,
                new DateOnly(2026, 8, 1),
                DateTimeOffset.UtcNow.AddDays(-2),
                DateTimeOffset.UtcNow.AddDays(-1),
                1,
                null,
                "{}"));
            dbContext.CipCases.Add(new CipCase(
                Guid.NewGuid(),
                caseKey,
                $"{proposalKey}-{vendorId}",
                null,
                "Snapshot CIP case",
                vendorId,
                vendorName,
                "JAHO",
                "GeneralAffair",
                190_000m,
                190_000m,
                100m,
                "termsheet",
                "inprogress",
                null,
                "Requestor",
                "Procurement",
                null,
                new DateOnly(2026, 8, 10),
                "tracker-bidevaluation",
                proposalKey,
                proposalKey,
                $"TS/{caseKey}/VI/2026",
                $"CTR/{caseKey}/VI/2026",
                """{"source":"BidEvaluation","vendorId":"GOBEL0001","vendorName":"PT GOBEL DHARMA SARANA KARYA"}"""));
            var encoded = Uri.EscapeDataString(proposalKey);
            dbContext.TrackerStates.Add(new TrackerStateEntry(
                Guid.NewGuid(),
                $"ag_tracker_step_vendor_docs_v1:{encoded}",
                "{\"ACT-EVAL\":{\"GOBEL0001\":[{\"fileName\":\"bid-eval.pdf\",\"blobKey\":\"docs/bid-eval.pdf\",\"container\":\"app-proposal-tracker\"}]}}"));
            dbContext.TrackerStates.Add(new TrackerStateEntry(
                Guid.NewGuid(),
                $"ag_tracker_bid_eval_v1:{encoded}",
                "{\"ACT-EVAL\":{\"winnerVendorIds\":[\"GOBEL0001\"],\"proofDocuments\":[{\"fileName\":\"winner-bid.pdf\",\"blobKey\":\"docs/winner-bid.pdf\",\"container\":\"app-proposal-tracker\"}]}}"));
            await dbContext.SaveChangesAsync();
        }

        using var scopePorts = _factory.Factory.Services.CreateScope();
        var addressPort = scopePorts.ServiceProvider.GetRequiredService<IVendorOfficeAddressReadPort>();
        var snapshotPort = scopePorts.ServiceProvider.GetRequiredService<ITrackerAwardSnapshotReadPort>();
        var addresses = await addressPort.ResolveAsync(
            [new VendorOfficeAddressLookup(vendorId, vendorName)],
            CancellationToken.None);
        Assert.Equal(officeAddress, addresses[vendorId]);

        var snapshots = await snapshotPort.GetAsync(
            [new TrackerAwardSnapshotQuery(proposalKey, vendorId, "BidEvaluation")],
            CancellationToken.None);
        var snapshot = Assert.Single(snapshots.Values);
        Assert.Equal("bid-eval.pdf", snapshot.AwardSourceDocument?.FileName);
        Assert.Equal("docs/bid-eval.pdf", snapshot.AwardSourceDocument?.BlobKey);
        Assert.Equal("winner-bid.pdf", snapshot.WinnerBidDocument?.FileName);

        using var client = _factory.CreateClient();
        await DevLoginAsync(client);
        using var response = await client.GetAsync("/api/v1/contract-initiation-platform/cases");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var rows = await response.Content.ReadFromJsonAsync<JsonElement>();
        var match = rows.EnumerateArray().Single(item => item.GetProperty("caseKey").GetString() == caseKey);
        using var payload = JsonDocument.Parse(match.GetProperty("payloadJson").GetString()!);
        Assert.Equal(officeAddress, payload.RootElement.GetProperty("vendorAddress").GetString());
        Assert.Equal("docs/bid-eval.pdf", payload.RootElement.GetProperty("awardSourceDocument").GetProperty("blobKey").GetString());
        Assert.Equal("docs/winner-bid.pdf", payload.RootElement.GetProperty("winnerBidDocument").GetProperty("blobKey").GetString());
    }

    [Fact]
    public async Task WinnerBidDocumentIsSharedForEveryWinner()
    {
        const string proposalKey = "2026/S.03.02/GeneralAffair/JAHO/SNAP-WIN";
        const string activityKey = "ACT-EVAL-SHARE";
        const string vendorA = "1B15AD8F4C";
        const string vendorB = "13962F6C69";

        using (var scope = _factory.Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            dbContext.TrackerProposalActivities.Add(new TrackerProposalActivity(
                Guid.NewGuid(),
                proposalKey,
                activityKey,
                "EVAL",
                "Bid Evaluation",
                "Officer",
                "Completed",
                2,
                2,
                new DateOnly(2026, 8, 1),
                DateTimeOffset.UtcNow.AddDays(-2),
                DateTimeOffset.UtcNow.AddDays(-1),
                1,
                null,
                "{}"));
            var encoded = Uri.EscapeDataString(proposalKey);
            dbContext.TrackerStates.Add(new TrackerStateEntry(
                Guid.NewGuid(),
                $"ag_tracker_bid_eval_v1:{encoded}",
                "{\"ACT-EVAL-SHARE\":{\"winnerVendorIds\":[\"1B15AD8F4C\",\"13962F6C69\"],\"proofDocuments\":["
                + "{\"fileName\":\"Bukti_Pemenang_PT-Karya.pdf\",\"vendorId\":\"1B15AD8F4C\",\"blobKey\":\"docs/karya.pdf\",\"container\":\"app-proposal-tracker\"},"
                + "{\"fileName\":\"Bukti_Pemenang_PT-Mandiri.pdf\",\"vendorId\":\"13962F6C69\",\"blobKey\":\"docs/mandiri.pdf\",\"container\":\"app-proposal-tracker\"},"
                + "{\"fileName\":\"Bukti_Pemenang_SNAP-WIN.pdf\",\"blobKey\":\"docs/shared-winner.pdf\",\"container\":\"app-proposal-tracker\"}"
                + "]}}"));
            await dbContext.SaveChangesAsync();
        }

        using var scopePorts = _factory.Factory.Services.CreateScope();
        var snapshotPort = scopePorts.ServiceProvider.GetRequiredService<ITrackerAwardSnapshotReadPort>();
        var snapshots = await snapshotPort.GetAsync(
            [
                new TrackerAwardSnapshotQuery(proposalKey, vendorA, "BidEvaluation"),
                new TrackerAwardSnapshotQuery(proposalKey, vendorB, "BidEvaluation"),
            ],
            CancellationToken.None);

        Assert.Equal(2, snapshots.Count);
        Assert.All(snapshots.Values, view =>
        {
            Assert.Equal("Bukti_Pemenang_SNAP-WIN.pdf", view.WinnerBidDocument?.FileName);
            Assert.Equal("docs/shared-winner.pdf", view.WinnerBidDocument?.BlobKey);
        });
    }

    private static async Task DevLoginAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo = "00109610", displayName = "USEP RUSNANDAR" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
