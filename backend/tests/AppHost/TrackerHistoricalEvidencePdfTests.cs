using System.Text;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.Modules.ProposalTracker.Domain;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class TrackerHistoricalEvidencePdfTests
{
    [Fact]
    public void CoverPdfStartsWithPdfHeader()
    {
        var proposal = new TrackerProposal(
            Guid.NewGuid(),
            "TST-EVIDENCE-001",
            "PR-EVID-001",
            "Historical evidence cover",
            null,
            "IT",
            "JAHO",
            "General Affair",
            "Contractual",
            null,
            190_000m,
            "TM-2",
            "OnProgress",
            "Request for Quotation",
            "Normal",
            "Section Head",
            "Officer",
            new DateOnly(2026, 10, 10),
            1,
            10,
            0,
            "{}");
        var activities = new[]
        {
            new TrackerProposalActivity(
                Guid.NewGuid(),
                proposal.ProposalKey,
                "ACT-RFQ",
                "stage-rfq",
                "Request for Quotation",
                "Officer",
                "Pending",
                3,
                3,
                new DateOnly(2026, 9, 1),
                null,
                null,
                0,
                null,
                "{}"),
        };
        var pdf = TrackerHistoricalEvidencePdf.Build(proposal, activities, Array.Empty<TrackerEvidencePart>());
        Assert.True(pdf.Length > 200);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(pdf, 0, 4));
    }

    [Fact]
    public void BundleMergesPlaceholderPagesForMissingFiles()
    {
        var proposal = new TrackerProposal(
            Guid.NewGuid(),
            "TST-EVIDENCE-002",
            "PR-EVID-002",
            "Historical evidence merge",
            null,
            "IT",
            "JAHO",
            "General Affair",
            "Contractual",
            null,
            190_000m,
            "TM-2",
            "OnProgress",
            "Request for Quotation",
            "Normal",
            "Section Head",
            "Officer",
            new DateOnly(2026, 10, 10),
            1,
            10,
            0,
            "{}");
        var parts = new[]
        {
            new TrackerEvidencePart("Request for Quotation", "PT Example", "rfq-letter.pdf", null, "application/pdf", "Listed in Tracker without a stored blob."),
        };
        var pdf = TrackerHistoricalEvidencePdf.Build(proposal, Array.Empty<TrackerProposalActivity>(), parts);
        Assert.True(pdf.Length > 400);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
