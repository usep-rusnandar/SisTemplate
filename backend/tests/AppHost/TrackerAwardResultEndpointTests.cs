using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Guards the Bid Evaluation → award-result hand-off (WORK.md task #6, Phase 1). The Tracker frontend,
/// on completing the Bid Evaluation activity, PUTs the winners to <c>/award-result</c>; this test drives
/// that exact endpoint with an FE-shaped body and asserts the winners land in <c>trk.AWARD_RESULT_*</c>
/// AND are visible through <see cref="ITrackerBidEvaluationReadPort"/> — the contract CIP F4 consumes to
/// build the Term Sheet per winner (unblocks task #3).
/// </summary>
public sealed class TrackerAwardResultEndpointTests : IClassFixture<IsolatedApiFixture>
{
    private readonly IsolatedApiFixture _factory;

    public TrackerAwardResultEndpointTests(IsolatedApiFixture factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SaveAwardResultPersistsWinnersAndExposesThemToCip()
    {
        const string proposalKey = "2026/S.03.02/GeneralAffair/JAHO/AWARD-6";
        var encodedProposalKey = Uri.EscapeDataString(proposalKey);
        await SeedProposalAsync(proposalKey);

        using var client = _factory.CreateClient();
        await DevLoginAsync(client);

        // Shape mirrors trkBuildAwardResultRequest (TrackerData.jsx): source, method, winners with
        // awardValue/awardPercent/isWinner + a per-winner term-sheet payloadJson.
        var body = new
        {
            source = "BidEvaluation",
            method = "Tender",
            evaluatedBy = "USEP RUSNANDAR",
            vendors = new[]
            {
                new { vendorId = "VDR-001", vendorName = "PT Alpha", awardValue = 60_000_000m, awardPercent = 60m, isWinner = true, payloadJson = "{\"awardPercent\":60}" },
                new { vendorId = "VDR-002", vendorName = "PT Beta", awardValue = 40_000_000m, awardPercent = 40m, isWinner = true, payloadJson = "{\"awardPercent\":40}" },
            },
            payloadJson = "{\"winnerCount\":2}",
        };

        using var put = await client.PutAsJsonAsync($"/api/v1/proposal-tracker/award-result?proposalId={encodedProposalKey}", body);
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        // Read-back through the module endpoint.
        using var get = await client.GetAsync($"/api/v1/proposal-tracker/award-result?proposalId={encodedProposalKey}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        var view = await get.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("BidEvaluation", view.GetProperty("source").GetString());
        var vendors = view.GetProperty("vendors").EnumerateArray().ToArray();
        Assert.Equal(2, vendors.Length);
        Assert.All(vendors, v => Assert.True(v.GetProperty("isWinner").GetBoolean()));
        var alpha = vendors.Single(v => v.GetProperty("vendorId").GetString() == "VDR-001");
        Assert.Equal(60m, alpha.GetProperty("awardPercent").GetDecimal());
        Assert.Equal(60_000_000m, alpha.GetProperty("awardValue").GetDecimal());

        // The cross-module contract CIP F4 actually reads.
        using var scope = _factory.Factory.Services.CreateScope();
        var readPort = scope.ServiceProvider.GetRequiredService<ITrackerBidEvaluationReadPort>();
        var award = await readPort.GetAwardResultAsync(proposalKey, CancellationToken.None);
        Assert.NotNull(award);
        Assert.Equal("BidEvaluation", award.Source);
        Assert.Equal(2, award.Winners.Count);
        var alphaWinner = award.Winners.Single(w => w.VendorId == "VDR-001");
        Assert.Equal("PT Alpha", alphaWinner.VendorName);
        Assert.Equal(60_000_000m, alphaWinner.AwardValue);
        Assert.Equal(60m, alphaWinner.AwardPercent);
        Assert.False(string.IsNullOrWhiteSpace(alphaWinner.TermsPayloadJson));
    }

    [Fact]
    public async Task SaveAwardResultForUnknownProposalReturnsNotFound()
    {
        using var client = _factory.CreateClient();
        await DevLoginAsync(client);

        var body = new
        {
            source = "BidEvaluation",
            vendors = new[] { new { vendorId = "VDR-001", vendorName = "PT Alpha", awardValue = 1m, awardPercent = 100m, isWinner = true, payloadJson = "{}" } },
        };

        using var put = await client.PutAsJsonAsync("/api/v1/proposal-tracker/proposals/DOES-NOT-EXIST-6/award-result", body);
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
    }

    private async Task SeedProposalAsync(string proposalKey)
    {
        using var scope = _factory.Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        dbContext.TrackerProposals.Add(new TrackerProposal(
            Guid.NewGuid(),
            proposalKey,
            "PR-AWARD-6",
            "Award hand-off test proposal",
            "ARIBA-AWARD-6",
            "Services",
            "ADMO",
            "Vendor Onboarding",
            "Contractual",
            "Service Agreement",
            100_000_000m,
            "standard",
            "OnProgress",
            "Bid Evaluation",
            "High",
            "Owner",
            "Officer",
            new DateOnly(2026, 7, 1),
            2,
            10,
            0,
            "{}"));
        await dbContext.SaveChangesAsync();
    }

    private static async Task DevLoginAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo = "00109610", displayName = "USEP RUSNANDAR" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
