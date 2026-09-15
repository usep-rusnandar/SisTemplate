using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class DomainCommandEndpointTests
{
    private static readonly string[] TrackerEvidenceNames = ["proof-a.pdf", "proof-b.pdf"];

    [Fact]
    public async Task TrackerCompleteActivityUpdatesNormalizedWorkflow()
    {
        await using var app = new IsolatedCommandApi("tracker_complete");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        await app.SeedAsync(dbContext =>
        {
            dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(),
                "TST-TRK-001",
                "PR-TST-001",
                "Test tracker proposal",
                "ARIBA-TST",
                "Fuel",
                "ADMO",
                "Mining Operation",
                "Non Contractual",
                null,
                100_000_000m,
                "standard",
                "OnProgress",
                "Activity 1",
                "High",
                "Section Head",
                "Officer",
                new DateOnly(2026, 7, 1),
                2,
                10,
                0,
                "{}"));
            dbContext.TrackerProposalActivities.AddRange(
                new TrackerProposalActivity(
                    Guid.NewGuid(),
                    "TST-TRK-001",
                    "ACT-001",
                    "stage-1",
                    "Activity 1",
                    "Officer",
                    "Pending",
                    2,
                    2,
                    new DateOnly(2026, 6, 24),
                    null,
                    null,
                    0,
                    null,
                    "{}"),
                new TrackerProposalActivity(
                    Guid.NewGuid(),
                    "TST-TRK-001",
                    "ACT-002",
                    "stage-2",
                    "Activity 2",
                    "Officer",
                    "Pending",
                    3,
                    3,
                    new DateOnly(2026, 6, 27),
                    null,
                    null,
                    0,
                    null,
                    "{}"));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);
        using var response = await client.PostAsJsonAsync(
            "/api/v1/proposal-tracker/proposals/TST-TRK-001/activities/ACT-001/complete",
            new { evidenceNames = TrackerEvidenceNames, completedAt = "2026-08-10 14:30:00" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("OnProgress", payload.GetProperty("proposal").GetProperty("lifecycleStatus").GetString());
        Assert.Equal("Activity 2", payload.GetProperty("proposal").GetProperty("currentStage").GetString());
        var completedActivity = payload.GetProperty("activities")
            .EnumerateArray()
            .Single(activity => activity.GetProperty("activityKey").GetString() == "ACT-001");
        Assert.Equal("Completed", completedActivity.GetProperty("status").GetString());
        Assert.Equal(2, completedActivity.GetProperty("evidenceCount").GetInt32());

        await AssertAuditLoggedAsync(app, "Update", "Proposal Tracker", "Completed activity ACT-001");
    }

    [Fact]
    public async Task CipRepositoryProjectsLinkedTrackerLoaAndLegacyInboxEndpointsAreGone()
    {
        await using var app = new IsolatedCommandApi("cip_repo_loa");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        const string proposalKey = "TST-TRK-LOA";
        const string vendorId = "VDR-001";
        const string caseKey = "CIP-2026-001";
        const string loaFileName = "loa-test.pdf";
        const string container = "app-proposaltracker";
        const string blobKey = "loa/TST-TRK-LOA/VDR-001.pdf";
        var loaPayload = JsonSerializer.Serialize(new
        {
            loaNumber = "123/LOA/TST/VI/2026",
            vendorId,
            fileName = loaFileName,
            container,
            blobKey
        });
        await app.SeedAsync(dbContext =>
        {
            dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(),
                proposalKey,
                "PR-TST-LOA",
                "Award-linked CIP case",
                null,
                "Services",
                "BIB",
                "Engineering",
                "Contractual",
                "Service Agreement",
                250_000_000m,
                "standard",
                "OnProgress",
                "LOA",
                "Medium",
                "Requestor",
                "Procurement",
                new DateOnly(2026, 7, 10),
                4,
                12,
                0,
                "{}"));
            dbContext.CipCases.Add(new CipCase(
                Guid.NewGuid(),
                caseKey,
                $"{proposalKey}-{vendorId}",
                null,
                "Award-linked CIP case",
                vendorId,
                "PT Test Vendor",
                "BIB",
                "Engineering",
                125_000_000m,
                250_000_000m,
                50m,
                "termsheet",
                "inprogress",
                null,
                "Requestor",
                "Procurement",
                null,
                new DateOnly(2026, 7, 10),
                "tracker-bidevaluation",
                proposalKey,
                "PR-TST-LOA",
                $"TS/{caseKey}/VI/2026",
                $"CTR/{caseKey}/VI/2026",
                "{}"));
            dbContext.TrackerLoaDocuments.Add(new TrackerLoaDocument(
                Guid.NewGuid(),
                proposalKey,
                "ACT-LOA",
                vendorId,
                "123/LOA/TST/VI/2026",
                "PT Test Vendor",
                125_000_000m,
                50m,
                new DateTimeOffset(2026, 8, 10, 8, 0, 0, TimeSpan.Zero),
                loaFileName,
                loaPayload));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var repositoryResponse = await client.GetAsync("/api/v1/contract-initiation-platform/repository");
        Assert.Equal(HttpStatusCode.OK, repositoryResponse.StatusCode);
        var repository = await repositoryResponse.Content.ReadFromJsonAsync<JsonElement>();
        var loaDoc = Assert.Single(
            repository.EnumerateArray(),
            document =>
                document.GetProperty("caseKey").GetString() == caseKey
                && document.GetProperty("documentType").GetString() == "loa");
        Assert.Equal(loaFileName, loaDoc.GetProperty("fileName").GetString());
        Assert.Equal(container, loaDoc.GetProperty("container").GetString());
        Assert.Equal(blobKey, loaDoc.GetProperty("blobKey").GetString());

        using var inboxResponse = await client.GetAsync("/api/v1/contract-initiation-platform/loa-inbox");
        Assert.Equal(HttpStatusCode.NotFound, inboxResponse.StatusCode);

        using var fromLoaResponse = await client.PostAsJsonAsync(
            "/api/v1/contract-initiation-platform/cases/from-loa",
            new { loaId = $"{proposalKey}-{vendorId}", actorName = "Procurement" });
        Assert.Equal(HttpStatusCode.NotFound, fromLoaResponse.StatusCode);
    }

    [Fact]
    public async Task CipTermsheetGenerateRejectsMissingBlobAndUpsertsOnRegenerate()
    {
        await using var app = new IsolatedCommandApi("cip_termsheet_generate_upsert");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        const string caseKey = "CIP-TST-TS-001";
        await app.SeedAsync(dbContext =>
        {
            dbContext.CipCases.Add(new CipCase(
                Guid.NewGuid(), caseKey, "ep::proposal-VDR-001", null, "Termsheet generate upsert", "VDR-001", "PT Winner",
                "ADMO", "Plant", 100_000m, 100_000m, 100m, "termsheet", "inprogress", null,
                "Section Head", "CIP Officer", null, new DateOnly(2026, 8, 10), "tracker-bidevaluation",
                "ep::proposal", "2026/A.01.01/Plant/ADMO/SMP03051601", $"TS/{caseKey}/VI/2026", $"CTR/{caseKey}/VI/2026", "{}"));
            dbContext.CipCaseDocuments.Add(new CipCaseDocument(
                Guid.NewGuid(), caseKey, $"{caseKey}:termsheet", "termsheet", "Termsheet_stale.pdf",
                new DateTimeOffset(2026, 8, 1, 9, 0, 0, TimeSpan.Zero), 32, null,
                "{\"payload\":{\"transaction\":\"stale\"}}",
                null, null));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var missingBlob = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseKey}/termsheet/generate",
            new { documentNumber = $"TS/{caseKey}/VI/2026", fileName = "Termsheet_missing.pdf", actorName = "CIP Officer" });
        Assert.Equal(HttpStatusCode.BadRequest, missingBlob.StatusCode);
        var missingPayload = await missingBlob.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("termsheet_blob_required", missingPayload.GetProperty("code").GetString());

        using var firstGenerate = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseKey}/termsheet/generate",
            new
            {
                documentNumber = $"TS/{caseKey}/VI/2026",
                fileName = "Termsheet_first.pdf",
                generatedAt = "2026-08-28T04:00:00Z",
                container = "documents",
                blobKey = $"cip/{caseKey}/termsheet-first.pdf",
                payload = new { transaction = "first generate" },
                actorName = "CIP Officer"
            });
        Assert.Equal(HttpStatusCode.OK, firstGenerate.StatusCode);

        using var regenerate = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseKey}/termsheet/generate",
            new
            {
                documentNumber = $"TS/{caseKey}/VI/2026",
                fileName = "Termsheet_regenerated.pdf",
                generatedAt = "2026-08-28T05:00:00Z",
                container = "documents",
                blobKey = $"cip/{caseKey}/termsheet-regenerated.pdf",
                payload = new { transaction = "regenerated" },
                actorName = "CIP Officer"
            });
        Assert.Equal(HttpStatusCode.OK, regenerate.StatusCode);

        using (var scope = app.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var documents = await db.CipCaseDocuments.AsNoTracking()
                .Where(item => item.CaseKey == caseKey && item.DocumentType == "termsheet")
                .ToListAsync();
            var document = Assert.Single(documents);
            Assert.Equal("Termsheet_regenerated.pdf", document.FileName);
            Assert.Equal("documents", document.Container);
            Assert.Equal($"cip/{caseKey}/termsheet-regenerated.pdf", document.BlobKey);
            Assert.Contains("regenerated", document.PayloadJson, StringComparison.Ordinal);
        }

        using var repository = await client.GetAsync("/api/v1/contract-initiation-platform/repository");
        Assert.Equal(HttpStatusCode.OK, repository.StatusCode);
        var rows = await repository.Content.ReadFromJsonAsync<JsonElement>();
        var termsheet = Assert.Single(
            rows.EnumerateArray(),
            item => item.GetProperty("caseKey").GetString() == caseKey
                && item.GetProperty("documentType").GetString() == "termsheet");
        Assert.Equal($"cip/{caseKey}/termsheet-regenerated.pdf", termsheet.GetProperty("blobKey").GetString());
        Assert.Equal("Termsheet_regenerated.pdf", termsheet.GetProperty("fileName").GetString());
    }

    [Fact]
    public async Task CipTermsheetGenerateRejectsSectionHead()
    {
        await using var app = new IsolatedCommandApi("cip_termsheet_generate_section_head");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        const string caseKey = "CIP-TST-TS-SECHD";
        await app.SeedAsync(dbContext =>
        {
            dbContext.CipCases.Add(new CipCase(
                Guid.NewGuid(), caseKey, "ep::proposal-VDR-SECHD", null, "Termsheet generate section head", "VDR-001", "PT Winner",
                "ADMO", "Plant", 100_000m, 100_000m, 100m, "termsheet", "inprogress", null,
                "Section Head", "CIP Officer", null, new DateOnly(2026, 8, 10), "tracker-bidevaluation",
                "ep::proposal", "2026/A.01.01/Plant/ADMO/SMP03051601", $"TS/{caseKey}/VI/2026", $"CTR/{caseKey}/VI/2026", "{}"));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client, "00109501");

        using var response = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseKey}/termsheet/generate",
            new
            {
                documentNumber = $"TS/{caseKey}/VI/2026",
                fileName = "Termsheet_blocked.pdf",
                generatedAt = "2026-08-28T04:00:00Z",
                container = "documents",
                blobKey = $"cip/{caseKey}/termsheet-blocked.pdf",
                payload = new { transaction = "blocked" },
                actorName = "Section Head"
            });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("officer_only", payload.GetProperty("code").GetString());
    }

    [Fact]
    public async Task CipActivityCompletionPersistsDatesAndUpdatesLinkedTrackerWorkflow()
    {
        await using var app = new IsolatedCommandApi("cip_complete_linked_tracker");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        const string proposalKey = "ep::2026/S.03.02/GeneralAffair/JAHO/001";
        const string caseKey = "CIP-TST-001";
        await app.SeedAsync(dbContext =>
        {
            dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(), proposalKey, "2026/S.03.02/GeneralAffair/JAHO/001", "Linked workflow test",
                null, "Services", "JAHO", "General Affair", "Contractual", null, 190_000m,
                "standard", "OnProgress", "Term Sheet", "Normal", "Section Head", "Tracker Officer",
                new DateOnly(2026, 9, 10), 3, 12, 0, "{}"));
            dbContext.TrackerProposalActivities.AddRange(
                new TrackerProposalActivity(Guid.NewGuid(), proposalKey, "ACT-07-TERM", "stage-term", "Term Sheet", "CIP Officer", "Pending", 2, 2, new DateOnly(2026, 9, 4), null, null, 0, null, "{}"),
                new TrackerProposalActivity(Guid.NewGuid(), proposalKey, "ACT-08-LOA", "TS-6", "Letter of Award (LOA)", "Tracker Officer", "Locked", 2, 2, new DateOnly(2026, 9, 7), null, null, 0, "Complete Term Sheet first.", "{}"),
                new TrackerProposalActivity(Guid.NewGuid(), proposalKey, "ACT-09-CTR", "stage-ctr", "Contract", "CIP Officer", "Locked", 2, 2, new DateOnly(2026, 9, 9), null, null, 0, "Complete Term Sheet first.", "{}"));
            dbContext.ProposalAwardResults.Add(new ProposalAwardResult(
                Guid.NewGuid(), proposalKey, "BidEvaluation", "Pemilihan Langsung",
                new DateTimeOffset(2026, 8, 7, 10, 0, 0, TimeSpan.FromHours(7)), "Tracker Officer", null, "{}"));
            dbContext.ProposalAwardResultVendors.Add(new ProposalAwardResultVendor(
                Guid.NewGuid(), proposalKey, "VDR-001", "PT Winner", 190_000m, 90m, 90m, 90m, 1,
                190_000m, 190_000m, 100m, true, "{}"));
            dbContext.CipCases.Add(new CipCase(
                Guid.NewGuid(), caseKey, $"{proposalKey}-VDR-001", null, "Linked workflow test", "VDR-001", "PT Winner",
                "JAHO", "General Affair", 190_000m, 190_000m, 100m, "termsheet", "inprogress", null,
                "Section Head", "CIP Officer", null, new DateOnly(2026, 8, 10), "tracker-bidevaluation",
                proposalKey, "2026/S.03.02/GeneralAffair/JAHO/001", $"TS/{caseKey}/VI/2026", $"CTR/{caseKey}/VI/2026", "{}"));
            dbContext.CipCaseDocuments.Add(new CipCaseDocument(
                Guid.NewGuid(), caseKey, $"{caseKey}:termsheet", "termsheet", $"Termsheet_{caseKey}.pdf",
                new DateTimeOffset(2026, 8, 8, 9, 0, 0, TimeSpan.FromHours(7)), 128, null,
                "{\"payload\":{\"periodStart\":\"2026-01-01\",\"periodEnd\":\"2026-12-31\",\"transaction\":\"Linked workflow test\"}}",
                "documents", $"cip/{caseKey}/termsheet.pdf"));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);
        var termsheetCompletedAt = new DateTimeOffset(2026, 8, 8, 10, 0, 0, TimeSpan.FromHours(7));
        using var termResponse = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseKey}/activities/termsheet/complete",
            new { completedAt = termsheetCompletedAt, actorName = "CIP Officer", remark = "Term Sheet reviewed." });
        Assert.Equal(HttpStatusCode.OK, termResponse.StatusCode);

        using (var scope = app.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var trackerActivities = await db.TrackerProposalActivities.AsNoTracking().Where(item => item.ProposalKey == proposalKey).ToListAsync();
            Assert.Equal("Completed", trackerActivities.Single(item => item.Title == "Term Sheet").Status);
            Assert.Equal(termsheetCompletedAt, trackerActivities.Single(item => item.Title == "Term Sheet").CompletedAt);
            Assert.Equal("Pending", trackerActivities.Single(item => item.Title.Contains("Letter of Award")).Status);
            Assert.Equal("Pending", trackerActivities.Single(item => item.Title == "Contract").Status);
        }

        using var supportResponse = await client.GetAsync(
            $"/api/v1/proposal-tracker/loa-support?proposalId={Uri.EscapeDataString(proposalKey)}&vendorId=VDR-001");
        Assert.Equal(HttpStatusCode.OK, supportResponse.StatusCode);
        var supportPayload = await supportResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(supportPayload.GetProperty("available").GetBoolean());
        Assert.Equal($"TS/{caseKey}/VI/2026", supportPayload.GetProperty("termsheetNumber").GetString());

        using var loaResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/loa-documents?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new
            {
                vendorId = "VDR-001",
                vendorName = "Untrusted client value",
                loaNumber = "LOA/TST/001",
                awardValue = 1,
                awardPercent = 1,
                fileName = "LOA_TST_001.pdf",
                generatedAt = "2026-08-10 14:30:00",
                payload = new { termsheetNumber = $"TS/{caseKey}/VI/2026" }
            });
        Assert.Equal(HttpStatusCode.OK, loaResponse.StatusCode);

        using var loaCompleteResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/complete?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new { completedAt = termsheetCompletedAt.AddHours(1) });
        Assert.Equal(HttpStatusCode.OK, loaCompleteResponse.StatusCode);
        using var loaRecycleResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/recycle?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new { reason = "Recheck LOA without interrupting the parallel Contract activity." });
        Assert.Equal(HttpStatusCode.OK, loaRecycleResponse.StatusCode);
        var loaRecyclePayload = await loaRecycleResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Pending", loaRecyclePayload.GetProperty("activities").EnumerateArray().Single(item => item.GetProperty("title").GetString() == "Contract").GetProperty("status").GetString());
        using var loaRecompleteResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/complete?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new { completedAt = termsheetCompletedAt.AddHours(2) });
        Assert.Equal(HttpStatusCode.OK, loaRecompleteResponse.StatusCode);

        using var draftResponse = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseKey}/transition",
            new { fromStage = "template", toStage = "draft", occurredAt = "2026-08-08 11:00:00", actorName = "CIP Officer" });
        Assert.Equal(HttpStatusCode.OK, draftResponse.StatusCode);
        using var repeatedTermResponse = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseKey}/activities/termsheet/complete",
            new { completedAt = termsheetCompletedAt, actorName = "CIP Officer" });
        Assert.Equal(HttpStatusCode.OK, repeatedTermResponse.StatusCode);
        var repeatedTermPayload = await repeatedTermResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("draft", repeatedTermPayload.GetProperty("case").GetProperty("stage").GetString());

        await app.SeedAsync(dbContext => dbContext.CipCaseDocuments.Add(new CipCaseDocument(
            Guid.NewGuid(), caseKey, $"{caseKey}:final", "final", $"Final_{caseKey}.pdf",
            new DateTimeOffset(2026, 8, 9, 9, 0, 0, TimeSpan.FromHours(7)), 256, null,
            "{}", "documents", $"cip/{caseKey}/final.pdf")));

        var contractCompletedAt = new DateTimeOffset(2026, 8, 9, 10, 0, 0, TimeSpan.FromHours(7));
        using var contractResponse = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseKey}/activities/contract/complete",
            new { completedAt = contractCompletedAt, actorName = "CIP Officer", remark = "Final contract registered." });
        Assert.Equal(HttpStatusCode.OK, contractResponse.StatusCode);

        using var listResponse = await client.GetAsync("/api/v1/contract-initiation-platform/cases");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var cases = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        var item = Assert.Single(cases.EnumerateArray());
        Assert.Equal("approved", item.GetProperty("status").GetString());
        Assert.Equal("2026-09-10", item.GetProperty("requirementDate").GetString());
        Assert.Equal("2026-09-09", item.GetProperty("estimatedFinishDate").GetString());
        Assert.Equal(termsheetCompletedAt, item.GetProperty("termsheetTrackerDate").GetProperty("actual").GetDateTimeOffset());
        Assert.Equal(contractCompletedAt, item.GetProperty("contractTrackerDate").GetProperty("actual").GetDateTimeOffset());
        Assert.Equal(termsheetCompletedAt, item.GetProperty("termsheetActivityCompletedAt").GetDateTimeOffset());
        Assert.Equal(contractCompletedAt, item.GetProperty("contractActivityCompletedAt").GetDateTimeOffset());

        using (var scope = app.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var proposal = await db.TrackerProposals.AsNoTracking().SingleAsync(row => row.ProposalKey == proposalKey);
            var loa = await db.TrackerLoaDocuments.AsNoTracking().SingleAsync(row => row.ProposalKey == proposalKey);
            Assert.Equal("Completed", proposal.LifecycleStatus);
            Assert.Equal("PT Winner", loa.VendorName);
            Assert.Equal(190_000m, loa.AwardValue);
            Assert.Equal(100m, loa.AwardPercent);
            Assert.Contains($"TS/{caseKey}/VI/2026", loa.PayloadJson);

            var contractKey = $"CTR/{caseKey}/VI/2026";
            var monitoring = await db.Contracts.AsNoTracking().SingleAsync(row => row.ContractKey == contractKey);
            Assert.Equal("PT Winner", monitoring.SupplierName);
            Assert.Equal("Linked workflow test", monitoring.Title);
            Assert.Equal(190_000m, monitoring.ContractValue);
            Assert.Equal(new DateOnly(2026, 12, 31), monitoring.CurrentExpiryDate);
            Assert.Equal($"blob://documents/cip/{caseKey}/final.pdf", monitoring.DocumentLink);
        }

        using var monitoringList = await client.GetAsync("/api/v1/contract-monitoring/");
        Assert.Equal(HttpStatusCode.OK, monitoringList.StatusCode);
        var monitoringPayload = await monitoringList.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            monitoringPayload.EnumerateArray(),
            row => row.GetProperty("contractId").GetString() == $"CTR/{caseKey}/VI/2026");
    }

    [Fact]
    public async Task FirstWinnerTermSheetOpensLoaWithoutClosingTermUntilAllWinnersComplete()
    {
        await using var app = new IsolatedCommandApi("cip_multi_winner_term");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        const string proposalKey = "ep::2026/S.03.02/GeneralAffair/JAHO/002";
        const string caseA = "CIP-TST-A";
        const string caseB = "CIP-TST-B";
        await app.SeedAsync(dbContext =>
        {
            dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(), proposalKey, "2026/S.03.02/GeneralAffair/JAHO/002", "Multi-winner Term Sheet",
                null, "Services", "JAHO", "General Affair", "Contractual", null, 400_000m,
                "standard", "OnProgress", "Term Sheet", "Normal", "Section Head", "Tracker Officer",
                new DateOnly(2026, 9, 10), 3, 12, 0, "{}"));
            dbContext.TrackerProposalActivities.AddRange(
                new TrackerProposalActivity(Guid.NewGuid(), proposalKey, "ACT-07-TERM", "stage-term", "Term Sheet", "CIP Officer", "Pending", 2, 2, new DateOnly(2026, 9, 4), null, null, 0, null, "{}"),
                new TrackerProposalActivity(Guid.NewGuid(), proposalKey, "ACT-08-LOA", "TS-6", "Letter of Award (LOA)", "Tracker Officer", "Locked", 2, 2, new DateOnly(2026, 9, 7), null, null, 0, "Complete Term Sheet first.", "{}"),
                new TrackerProposalActivity(Guid.NewGuid(), proposalKey, "ACT-09-CTR", "stage-ctr", "Contract", "CIP Officer", "Locked", 2, 2, new DateOnly(2026, 9, 9), null, null, 0, "Complete Term Sheet first.", "{}"));
            dbContext.ProposalAwardResults.Add(new ProposalAwardResult(
                Guid.NewGuid(), proposalKey, "BidEvaluation", "Pemilihan Langsung",
                new DateTimeOffset(2026, 8, 7, 10, 0, 0, TimeSpan.FromHours(7)), "Tracker Officer", null, "{}"));
            dbContext.ProposalAwardResultVendors.AddRange(
                new ProposalAwardResultVendor(
                    Guid.NewGuid(), proposalKey, "VDR-001", "PT Winner A", 200_000m, 50m, 50m, 50m, 1,
                    200_000m, 200_000m, 50m, true, "{}"),
                new ProposalAwardResultVendor(
                    Guid.NewGuid(), proposalKey, "VDR-002", "PT Winner B", 200_000m, 50m, 50m, 50m, 2,
                    200_000m, 200_000m, 50m, true, "{}"));
            dbContext.CipCases.AddRange(
                new CipCase(
                    Guid.NewGuid(), caseA, $"{proposalKey}-VDR-001", null, "Multi-winner A", "VDR-001", "PT Winner A",
                    "JAHO", "General Affair", 200_000m, 400_000m, 50m, "termsheet", "inprogress", null,
                    "Section Head", "CIP Officer", null, new DateOnly(2026, 8, 10), "tracker-bidevaluation",
                    proposalKey, "2026/S.03.02/GeneralAffair/JAHO/002", $"TS/{caseA}/VI/2026", $"CTR/{caseA}/VI/2026", "{}"),
                new CipCase(
                    Guid.NewGuid(), caseB, $"{proposalKey}-VDR-002", null, "Multi-winner B", "VDR-002", "PT Winner B",
                    "JAHO", "General Affair", 200_000m, 400_000m, 50m, "termsheet", "inprogress", null,
                    "Section Head", "CIP Officer", null, new DateOnly(2026, 8, 10), "tracker-bidevaluation",
                    proposalKey, "2026/S.03.02/GeneralAffair/JAHO/002", $"TS/{caseB}/VI/2026", $"CTR/{caseB}/VI/2026", "{}"));
            dbContext.CipCaseDocuments.AddRange(
                new CipCaseDocument(
                    Guid.NewGuid(), caseA, $"{caseA}:termsheet", "termsheet", $"Termsheet_{caseA}.pdf",
                    new DateTimeOffset(2026, 8, 8, 9, 0, 0, TimeSpan.FromHours(7)), 128, null,
                    "{\"payload\":{\"periodStart\":\"2026-01-01\",\"periodEnd\":\"2026-12-31\",\"transaction\":\"Multi-winner A\"}}",
                    "documents", $"cip/{caseA}/termsheet.pdf"),
                new CipCaseDocument(
                    Guid.NewGuid(), caseB, $"{caseB}:termsheet", "termsheet", $"Termsheet_{caseB}.pdf",
                    new DateTimeOffset(2026, 8, 8, 9, 0, 0, TimeSpan.FromHours(7)), 128, null,
                    "{\"payload\":{\"periodStart\":\"2026-01-01\",\"periodEnd\":\"2026-12-31\",\"transaction\":\"Multi-winner B\"}}",
                    "documents", $"cip/{caseB}/termsheet.pdf"));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);
        var firstCompletedAt = new DateTimeOffset(2026, 8, 8, 10, 0, 0, TimeSpan.FromHours(7));
        using var firstResponse = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseA}/activities/termsheet/complete",
            new { completedAt = firstCompletedAt, actorName = "CIP Officer", remark = "Winner A Term Sheet." });
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

        using (var scope = app.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var trackerActivities = await db.TrackerProposalActivities.AsNoTracking().Where(item => item.ProposalKey == proposalKey).ToListAsync();
            Assert.Equal("Pending", trackerActivities.Single(item => item.Title == "Term Sheet").Status);
            Assert.Null(trackerActivities.Single(item => item.Title == "Term Sheet").CompletedAt);
            Assert.Equal("Pending", trackerActivities.Single(item => item.Title.Contains("Letter of Award")).Status);
            Assert.Equal("Pending", trackerActivities.Single(item => item.Title == "Contract").Status);
        }

        using var loaAResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/loa-documents?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new
            {
                vendorId = "VDR-001",
                loaNumber = "LOA/TST/A",
                fileName = "LOA_A.pdf",
                generatedAt = "2026-08-10 14:30:00",
                payload = new { termsheetNumber = $"TS/{caseA}/VI/2026" }
            });
        Assert.Equal(HttpStatusCode.OK, loaAResponse.StatusCode);

        using var loaBBlocked = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/loa-documents?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new
            {
                vendorId = "VDR-002",
                loaNumber = "LOA/TST/B",
                fileName = "LOA_B.pdf",
                generatedAt = "2026-08-10 14:31:00",
                payload = new { termsheetNumber = $"TS/{caseB}/VI/2026" }
            });
        Assert.Equal(HttpStatusCode.BadRequest, loaBBlocked.StatusCode);
        var blockedPayload = await loaBBlocked.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("termsheet_not_completed", blockedPayload.GetProperty("code").GetString());

        var secondCompletedAt = new DateTimeOffset(2026, 8, 8, 11, 0, 0, TimeSpan.FromHours(7));
        using var secondResponse = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/{caseB}/activities/termsheet/complete",
            new { completedAt = secondCompletedAt, actorName = "CIP Officer", remark = "Winner B Term Sheet." });
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);

        using (var scope = app.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var trackerActivities = await db.TrackerProposalActivities.AsNoTracking().Where(item => item.ProposalKey == proposalKey).ToListAsync();
            Assert.Equal("Completed", trackerActivities.Single(item => item.Title == "Term Sheet").Status);
            Assert.Equal(secondCompletedAt, trackerActivities.Single(item => item.Title == "Term Sheet").CompletedAt);
            Assert.Equal("Pending", trackerActivities.Single(item => item.Title.Contains("Letter of Award")).Status);
            Assert.Equal("Pending", trackerActivities.Single(item => item.Title == "Contract").Status);
        }

        using var loaBResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/loa-documents?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new
            {
                vendorId = "VDR-002",
                loaNumber = "LOA/TST/B",
                fileName = "LOA_B.pdf",
                generatedAt = "2026-08-10 15:00:00",
                payload = new { termsheetNumber = $"TS/{caseB}/VI/2026" }
            });
        Assert.Equal(HttpStatusCode.OK, loaBResponse.StatusCode);

        using var completeA = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/loa-complete?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new { vendorId = "VDR-001", completedAt = "2026-08-10 16:00:00", remark = "Winner A LOA reviewed." });
        Assert.Equal(HttpStatusCode.OK, completeA.StatusCode);
        using (var scope = app.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var loaActivity = await db.TrackerProposalActivities.AsNoTracking().SingleAsync(item => item.ProposalKey == proposalKey && item.Title.Contains("Letter of Award"));
            Assert.Equal("Pending", loaActivity.Status);
        }

        using var completeB = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/loa-complete?proposalId={Uri.EscapeDataString(proposalKey)}&activityId=ACT-08-LOA",
            new { vendorId = "VDR-002", completedAt = "2026-08-10 16:30:00", remark = "Winner B LOA reviewed." });
        Assert.Equal(HttpStatusCode.OK, completeB.StatusCode);
        using (var scope = app.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            var loaActivity = await db.TrackerProposalActivities.AsNoTracking().SingleAsync(item => item.ProposalKey == proposalKey && item.Title.Contains("Letter of Award"));
            Assert.Equal("Completed", loaActivity.Status);
        }
    }

    [Fact]
    public async Task ContractReminderSendPersistsCurrentTierReminder()
    {
        await using var app = new IsolatedCommandApi("contract_reminder");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        await app.SeedAsync(dbContext =>
        {
            dbContext.Contracts.Add(new Contract(
                Guid.NewGuid(),
                "CTR-TST-001",
                "PT Reminder Vendor",
                "Reminder test contract",
                "Services",
                "Maintenance",
                "ADMO",
                "Standard",
                "Monthly",
                "Contract Owner",
                "Supply Chain",
                "Contract PIC",
                "pic@example.test",
                500_000_000m,
                new DateOnly(2026, 7, 13),
                new DateOnly(2026, 1, 1),
                new DateOnly(2026, 1, 1),
                new DateOnly(2026, 1, 2),
                "Internal",
                null,
                "https://example.test/contract.pdf",
                null,
                "Expiring",
                20,
                1,
                "MAIN CONTRACT",
                "{}"));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);
        using var response = await client.PostAsJsonAsync(
            "/api/v1/contract-monitoring/CTR-TST-001/reminders/send",
            new { trigger = "Manual", force = true });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var reminder = Assert.Single(payload.GetProperty("reminders").EnumerateArray());
        Assert.Equal("d30", reminder.GetProperty("tier").GetString());
        Assert.Equal("Manual", reminder.GetProperty("trigger").GetString());
        Assert.True(reminder.GetProperty("escalated").GetBoolean());

        await AssertAuditLoggedAsync(app, "Create", "Contract Monitoring", "Sent reminder for contract CTR-TST-001");
    }

    [Fact]
    public async Task EproposalMaterialsStayLiveUntilAwardThenSnapshotToContractMaterial()
    {
        const string proposalKey = "2026/S.03.02/GeneralAffair/JAHO/001";
        var encodedProposalKey = Uri.EscapeDataString(proposalKey);
        var sourceRows = Enumerable.Range(1, 11)
            .Select(index => new EproposalMaterialRow(
                "SRC-MAT-001",
                $"90101003-{index:0000}",
                index == 1 ? "BANQUET AND CATERING SERVICES" : $"Test material {index}",
                "S.03.02",
                "GENERAL",
                1m,
                190_000m,
                190_000m,
                "USD",
                new DateOnly(2026, 9, 10),
                "JAHO",
                "40A0",
                null,
                null))
            .ToArray();
        await using var app = new IsolatedCommandApi("eproposal_material_award", sourceRows);
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        await app.SeedAsync(dbContext => dbContext.TrackerProposals.Add(new TrackerProposal(
            Guid.NewGuid(),
            proposalKey,
            "PR-TST-MATERIAL",
            "Material snapshot proposal",
            null,
            "S.03.02",
            "JAHO",
            "General Affair",
            "Contractual",
            "Service Agreement",
            190_000m,
            "direct-selection",
            "OnProgress",
            "Bid Evaluation",
            "Normal",
            "Section Head",
            "Officer",
            new DateOnly(2026, 9, 10),
            0,
            20,
            0,
            "{\"source\":\"eproposal\",\"eproposalId\":\"SRC-MAT-001\"}")));

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var listResponse = await client.GetAsync("/api/v1/proposal-tracker/proposals");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        var listedProposal = Assert.Single(list.EnumerateArray());
        Assert.Equal("SRC-MAT-001", listedProposal.GetProperty("sourceProposalId").GetString());
        Assert.Equal("USD", listedProposal.GetProperty("currency").GetString());

        var projectedStore = JsonSerializer.Serialize(new
        {
            proposals = new[]
            {
                new
                {
                    id = proposalKey,
                    proposalNumber = "PR-TST-MATERIAL",
                    title = "Material snapshot proposal",
                    sourceProposalId = "SRC-MAT-001",
                    amount = 190_000m,
                    lifecycleStatus = "OnProgress",
                    currentStage = "Bid Evaluation",
                    activities = Array.Empty<object>()
                }
            },
            loaDocuments = new { }
        });
        using var storeResponse = await client.PutAsJsonAsync(
            "/api/v1/proposal-tracker/storage/ag_tracker_rebuild_v14",
            new { value = projectedStore });
        Assert.Equal(HttpStatusCode.OK, storeResponse.StatusCode);

        using var projectedListResponse = await client.GetAsync("/api/v1/proposal-tracker/proposals");
        Assert.Equal(HttpStatusCode.OK, projectedListResponse.StatusCode);
        var projectedList = await projectedListResponse.Content.ReadFromJsonAsync<JsonElement>();
        var projectedProposal = Assert.Single(projectedList.EnumerateArray());
        Assert.Equal("SRC-MAT-001", projectedProposal.GetProperty("sourceProposalId").GetString());
        Assert.Equal("USD", projectedProposal.GetProperty("currency").GetString());

        using var materialResponse = await client.GetAsync($"/api/v1/proposal-tracker/proposal-materials?proposalId={encodedProposalKey}&page=2&pageSize=10");
        Assert.Equal(HttpStatusCode.OK, materialResponse.StatusCode);
        var liveMaterial = await materialResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("USD", liveMaterial.GetProperty("currency").GetString());
        Assert.Equal(2, liveMaterial.GetProperty("page").GetInt32());
        Assert.Equal(10, liveMaterial.GetProperty("pageSize").GetInt32());
        Assert.Equal(11, liveMaterial.GetProperty("totalRows").GetInt32());
        Assert.Equal(2, liveMaterial.GetProperty("totalPages").GetInt32());
        var materialTotal = Assert.Single(liveMaterial.GetProperty("totals").EnumerateArray());
        Assert.Equal("USD", materialTotal.GetProperty("currency").GetString());
        Assert.Equal(2_090_000m, materialTotal.GetProperty("totalPrice").GetDecimal());
        var secondPageRow = Assert.Single(liveMaterial.GetProperty("rows").EnumerateArray());
        Assert.Equal("90101003-0011", secondPageRow.GetProperty("materialCode").GetString());

        using var hundredRowsResponse = await client.GetAsync($"/api/v1/proposal-tracker/proposal-materials?proposalId={encodedProposalKey}&page=1&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, hundredRowsResponse.StatusCode);
        var hundredRowsPage = await hundredRowsResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(100, hundredRowsPage.GetProperty("pageSize").GetInt32());
        Assert.Equal(11, hundredRowsPage.GetProperty("rows").GetArrayLength());

        using (var beforeScope = app.Factory.Services.CreateScope())
        {
            var beforeDb = beforeScope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            Assert.Equal(0, await beforeDb.ContractMaterials.CountAsync());
        }

        using var awardResponse = await client.PutAsJsonAsync(
            $"/api/v1/proposal-tracker/award-result?proposalId={encodedProposalKey}",
            new
            {
                source = "BidEvaluation",
                method = "Pemilihan Langsung",
                evaluatedBy = "USEP RUSNANDAR",
                vendors = new[]
                {
                    new
                    {
                        vendorId = "VDR-001",
                        vendorName = "PT Winner",
                        awardValue = 190_000m,
                        awardPercent = 100m,
                        isWinner = true,
                        payloadJson = "{}"
                    }
                },
                payloadJson = "{}"
            });
        Assert.Equal(HttpStatusCode.OK, awardResponse.StatusCode);

        using var finalizeResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/finalize-award?proposalId={encodedProposalKey}",
            new { actorName = "USEP RUSNANDAR" });
        Assert.Equal(HttpStatusCode.OK, finalizeResponse.StatusCode);
        var finalized = await finalizeResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(11, finalized.GetProperty("materialRows").GetInt32());
        Assert.Equal(1, finalized.GetProperty("materialContracts").GetInt32());
        Assert.Equal(11, finalized.GetProperty("materialsCopied").GetInt32());

        using var afterScope = app.Factory.Services.CreateScope();
        var afterDb = afterScope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        var storedRows = await afterDb.ContractMaterials.AsNoTracking().OrderBy(row => row.MaterialNumber).ToListAsync();
        Assert.Equal(11, storedRows.Count);
        var stored = storedRows[0];
        Assert.Equal("90101003-0001", stored.MaterialNumber);
        Assert.Equal("BANQUET AND CATERING SERVICES", stored.Description);
        Assert.Equal("JAHO", stored.Site);
        Assert.Equal("USD", stored.Currency);
        Assert.Equal(190_000m, stored.UnitPrice);
        var sync = Assert.Single(await afterDb.MaterialSyncFiles.AsNoTracking().ToListAsync());
        Assert.Equal(MaterialSyncFile.Sources.EproposalAward, sync.SourceType);
        Assert.Equal(stored.ContractKey, sync.ContractKey);
    }

    [Fact]
    public async Task FinalizeAwardCaseSurvivesEmptyCipStorePutAndListsWithSlashProposalKey()
    {
        const string proposalKey = "2026/A.01.01/Plant/ADMO/SMP153001";
        var encodedProposalKey = Uri.EscapeDataString(proposalKey);
        await using var app = new IsolatedCommandApi("cip_store_put_preserves_award_case");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        await app.SeedAsync(dbContext => dbContext.TrackerProposals.Add(new TrackerProposal(
            Guid.NewGuid(),
            proposalKey,
            proposalKey,
            "Pengadaan Spare Parts Unit Dump Truck — ADMO FY2026",
            "DOC123456789",
            "A.01.01 Spare Parts",
            "ADMO",
            "Plant",
            "Non Contractual",
            null,
            1_386_000_000m,
            "TM-1",
            "OnProgress",
            "Bid Evaluation",
            "Normal",
            "Section Head",
            "Officer",
            new DateOnly(2026, 9, 10),
            0,
            20,
            0,
            "{\"source\":\"sample\"}")));

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var awardResponse = await client.PutAsJsonAsync(
            $"/api/v1/proposal-tracker/award-result?proposalId={encodedProposalKey}",
            new
            {
                source = "BidEvaluation",
                method = "Tender",
                evaluatedBy = "USEP RUSNANDAR",
                vendors = new[]
                {
                    new
                    {
                        vendorId = "074DFA5288",
                        vendorName = "PT Tambang Sarana Mandiri",
                        awardValue = 1_386_000_000m,
                        awardPercent = 100m,
                        isWinner = true,
                        payloadJson = "{}"
                    }
                },
                payloadJson = "{}"
            });
        Assert.Equal(HttpStatusCode.OK, awardResponse.StatusCode);

        using var finalizeResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/finalize-award?proposalId={encodedProposalKey}",
            new { actorName = "USEP RUSNANDAR" });
        Assert.Equal(HttpStatusCode.OK, finalizeResponse.StatusCode);
        var finalized = await finalizeResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, finalized.GetProperty("casesCreated").GetInt32());

        using var emptyStoreResponse = await client.PutAsJsonAsync(
            "/api/v1/contract-initiation-platform/storage/ag_cip_store_v7",
            new { value = "{\"version\":\"tracker-loa-v7\",\"seedSource\":\"tracker-award\",\"cases\":[]}" });
        Assert.Equal(HttpStatusCode.OK, emptyStoreResponse.StatusCode);

        using var listResponse = await client.GetAsync("/api/v1/contract-initiation-platform/cases");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var cases = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        var item = Assert.Single(cases.EnumerateArray());
        Assert.Equal(proposalKey, item.GetProperty("proposalKey").GetString());
        Assert.Equal("termsheet", item.GetProperty("stage").GetString());
        Assert.Equal("PT Tambang Sarana Mandiri", item.GetProperty("vendorName").GetString());
    }

    [Fact]
    public async Task RecycleBidEvaluationWithdrawsCipTermSheetCases()
    {
        const string proposalKey = "2026/A.01.01/Plant/ADMO/SMP160001";
        var encodedProposalKey = Uri.EscapeDataString(proposalKey);
        await using var app = new IsolatedCommandApi("recycle_eval_drops_cip");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        var completedAt = new DateTimeOffset(2026, 8, 18, 16, 20, 0, TimeSpan.FromHours(7));
        await app.SeedAsync(dbContext =>
        {
            dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(),
                proposalKey,
                proposalKey,
                "Pengadaan Spare Parts Unit Dump Truck — ADMO FY2026",
                "DOC123456789",
                "A.01.01 Spare Parts",
                "ADMO",
                "Plant",
                "Non Contractual",
                null,
                1_386_000_000m,
                "TM-1",
                "OnProgress",
                "Term Sheet",
                "Normal",
                "Section Head",
                "Officer",
                new DateOnly(2026, 9, 10),
                0,
                20,
                0,
                "{\"source\":\"sample\"}"));
            dbContext.TrackerProposalActivities.AddRange(
                new TrackerProposalActivity(
                    Guid.NewGuid(), proposalKey, "ACT-04-NEGO", "TS-4", "Negotiation", "Officer",
                    "Completed", 2, 2, new DateOnly(2026, 8, 16), completedAt.AddDays(-2), completedAt.AddDays(-2), 1, null, "{}"),
                new TrackerProposalActivity(
                    Guid.NewGuid(), proposalKey, "ACT-05-EVAL", "TS-5", "Bid Evaluation", "User",
                    "Completed", 2, 2, new DateOnly(2026, 8, 18), completedAt, completedAt, 2, null, "{}"),
                new TrackerProposalActivity(
                    Guid.NewGuid(), proposalKey, "ACT-07-TERM", "TS-7", "Term Sheet", "CIP Officer",
                    "Pending", 2, 2, new DateOnly(2026, 8, 20), null, null, 0, null, "{}"));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var awardResponse = await client.PutAsJsonAsync(
            $"/api/v1/proposal-tracker/award-result?proposalId={encodedProposalKey}",
            new
            {
                source = "BidEvaluation",
                method = "Tender",
                evaluatedBy = "USEP RUSNANDAR",
                vendors = new[]
                {
                    new
                    {
                        vendorId = "074DFA5288",
                        vendorName = "PT Tambang Sarana Mandiri",
                        awardValue = 831_600_000m,
                        awardPercent = 60m,
                        isWinner = true,
                        payloadJson = "{}"
                    },
                    new
                    {
                        vendorId = "VDR-002",
                        vendorName = "PT Karya Multi Energi",
                        awardValue = 554_400_000m,
                        awardPercent = 40m,
                        isWinner = true,
                        payloadJson = "{}"
                    }
                },
                payloadJson = "{}"
            });
        Assert.Equal(HttpStatusCode.OK, awardResponse.StatusCode);

        using var finalizeResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/finalize-award?proposalId={encodedProposalKey}",
            new { actorName = "USEP RUSNANDAR" });
        Assert.Equal(HttpStatusCode.OK, finalizeResponse.StatusCode);
        var finalized = await finalizeResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, finalized.GetProperty("casesCreated").GetInt32());

        using var beforeList = await client.GetAsync("/api/v1/contract-initiation-platform/cases");
        Assert.Equal(HttpStatusCode.OK, beforeList.StatusCode);
        Assert.Equal(2, (await beforeList.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength());

        using var recycleResponse = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/activities/recycle?proposalId={encodedProposalKey}&activityId=ACT-05-EVAL",
            new { reason = "Re-evaluate winners before opening Term Sheet." });
        Assert.Equal(HttpStatusCode.OK, recycleResponse.StatusCode);

        using var afterList = await client.GetAsync("/api/v1/contract-initiation-platform/cases");
        Assert.Equal(HttpStatusCode.OK, afterList.StatusCode);
        Assert.Equal(0, (await afterList.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength());
    }

    [Fact]
    public async Task TrackerStorageItemRoundTripsEncodedSlashKey()
    {
        const string proposalKey = "2026/A.01.01/Plant/ADMO/SMP160001";
        var storageKey = "ag_tracker_activity_notes_v1:" + Uri.EscapeDataString(proposalKey);
        const string notesJson = """{"ACT-01":[{"id":"note-1","activityId":"ACT-01","authorName":"Dinda","authorRole":"Officer","message":"Need vendor clarification","createdAt":"2026-08-19T08:00:00+07:00"}]}""";

        await using var app = new IsolatedCommandApi("tracker_storage_slash_key");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var putResponse = await client.PutAsJsonAsync(
            $"/api/v1/proposal-tracker/storage/item?key={Uri.EscapeDataString(storageKey)}",
            new { value = notesJson });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        using var getResponse = await client.GetAsync(
            $"/api/v1/proposal-tracker/storage/item?key={Uri.EscapeDataString(storageKey)}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var stored = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(storageKey, stored.GetProperty("key").GetString());
        Assert.Equal(notesJson, stored.GetProperty("value").GetString());

        using var listResponse = await client.GetAsync("/api/v1/proposal-tracker/storage");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            list.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("key").GetString() == storageKey
                && item.GetProperty("value").GetString() == notesJson);
    }

    [Fact]
    public async Task SlashContainingKeysRoundTripThroughQueryStringCommands()
    {
        const string proposalKey = "2026/A.01.01/Plant/ADMO/SMP160001";
        const string caseKey = "CIP/2026/001";
        const string contractKey = "CTR/CIP-2026-001/VI/2026";
        var encodedProposal = Uri.EscapeDataString(proposalKey);
        var encodedCase = Uri.EscapeDataString(caseKey);
        var encodedContract = Uri.EscapeDataString(contractKey);

        await using var app = new IsolatedCommandApi("slash_key_query_commands");
        await app.InitializeAsync();
        await app.SeedInitialIamDataAsync();
        await app.SeedAsync(dbContext =>
        {
            dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(),
                proposalKey,
                proposalKey,
                "Slash-key query command proposal",
                null,
                "Spare Parts",
                "ADMO",
                "Plant",
                "Non Contractual",
                null,
                1_000_000m,
                "TM-1",
                "OnProgress",
                "Negotiation",
                "Normal",
                "Section Head",
                "Officer",
                new DateOnly(2026, 9, 10),
                0,
                20,
                0,
                "{}"));
            dbContext.CipCases.Add(new CipCase(
                Guid.NewGuid(),
                caseKey,
                null,
                null,
                "Slash-key CIP case",
                "074DFA5288",
                "PT Tambang Sarana Mandiri",
                "ADMO",
                "Plant",
                600_000m,
                1_000_000m,
                60m,
                "termsheet",
                "inprogress",
                null,
                "Requestor",
                "Procurement",
                null,
                new DateOnly(2026, 8, 19),
                "tracker-bidevaluation",
                proposalKey,
                proposalKey,
                $"TS/{caseKey}/VI/2026",
                contractKey,
                "{}"));
            dbContext.Contracts.Add(new Contract(
                Guid.NewGuid(),
                contractKey,
                "PT Tambang Sarana Mandiri",
                "Slash-key monitored contract",
                "Services",
                "Spare Parts",
                "ADMO",
                "Standard",
                "Monthly",
                "Contract Owner",
                "Plant",
                "Contract PIC",
                "pic@example.test",
                600_000m,
                new DateOnly(2026, 12, 31),
                new DateOnly(2026, 1, 1),
                new DateOnly(2026, 1, 1),
                new DateOnly(2026, 1, 2),
                "Internal",
                null,
                null,
                null,
                "Active",
                90,
                1,
                "MAIN CONTRACT",
                "{}"));
        });

        using var client = app.Factory.CreateClient();
        await DevLoginAsync(client);

        using var aribaResponse = await client.PatchAsJsonAsync(
            $"/api/v1/proposal-tracker/ariba-id?proposalId={encodedProposal}",
            new { aribaId = "ARIBA-SLASH-1" });
        Assert.Equal(HttpStatusCode.OK, aribaResponse.StatusCode);

        using var detailResponse = await client.GetAsync(
            $"/api/v1/proposal-tracker/proposal-detail?proposalId={encodedProposal}");
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        var detail = await detailResponse.Content.ReadFromJsonAsync<JsonElement>();
        var proposal = detail.GetProperty("proposal");
        Assert.Equal(proposalKey, proposal.GetProperty("proposalKey").GetString());
        Assert.Equal("ARIBA-SLASH-1", proposal.GetProperty("aribaId").GetString());

        using var verifyResponse = await client.PostAsJsonAsync(
            $"/api/v1/contract-initiation-platform/cases/verify?caseId={encodedCase}",
            new { actorName = "USEP RUSNANDAR" });
        Assert.Equal(HttpStatusCode.OK, verifyResponse.StatusCode);

        using var caseDetail = await client.GetAsync(
            $"/api/v1/contract-initiation-platform/case-detail?caseId={encodedCase}");
        Assert.Equal(HttpStatusCode.OK, caseDetail.StatusCode);
        Assert.Equal(caseKey, (await caseDetail.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("case").GetProperty("caseKey").GetString());

        using var contractDetail = await client.GetAsync(
            $"/api/v1/contract-monitoring/contract-detail?contractId={encodedContract}");
        Assert.Equal(HttpStatusCode.OK, contractDetail.StatusCode);
        Assert.Equal(
            contractKey,
            (await contractDetail.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("contract").GetProperty("contractId").GetString());
    }

    private static async Task AssertAuditLoggedAsync(
        IsolatedCommandApi app,
        string expectedAction,
        string expectedModule,
        string descriptionContains)
    {
        using var scope = app.Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        var auditLog = await dbContext.AuditLogs
            .AsNoTracking()
            .OrderByDescending(log => log.OccurredAt)
            .FirstOrDefaultAsync();

        Assert.NotNull(auditLog);
        Assert.Equal(expectedAction, auditLog.Action);
        Assert.Equal(expectedModule, auditLog.Module);
        Assert.Equal("USEP RUSNANDAR", auditLog.ActorName);
        Assert.Contains(descriptionContains, auditLog.Description, StringComparison.Ordinal);
    }

    private sealed class IsolatedCommandApi : IAsyncDisposable
    {
        private readonly string _connectionString;
        private readonly string? _previousConnectionString;

        public IsolatedCommandApi(string name, IReadOnlyList<EproposalMaterialRow>? materialRows = null)
        {
            var databaseName = $"IntegratedProcurement_CommandTests_{name}_{Guid.NewGuid():N}";
            _connectionString = BuildCommandTestConnectionString(databaseName);
            _previousConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _connectionString);

            Factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.UseEnvironment("Development");
                    builder.UseSetting("ConnectionStrings:DefaultConnection", _connectionString);
                    builder.ConfigureAppConfiguration((_, configuration) =>
                    {
                        configuration.AddInMemoryCollection(new Dictionary<string, string?>
                        {
                            ["ConnectionStrings:DefaultConnection"] = _connectionString,
                            ["DataSeeding:SeedInitialIam"] = "false",
                            ["DataSeeding:SeedInitialPlatformData"] = "false",
                            ["SSO:Enabled"] = "false",
                            ["Auth:AllowPasswordlessDevLogin"] = "true"
                        });
                    });
                    if (materialRows is not null)
                    {
                        builder.ConfigureTestServices(services =>
                        {
                            services.RemoveAll<IEproposalMaterialService>();
                            services.AddScoped<IEproposalMaterialService>(_ => new StubEproposalMaterialService(materialRows));
                        });
                    }
                });
        }

        private static string BuildCommandTestConnectionString(string databaseName)
        {
            var sa = Environment.GetEnvironmentVariable("MSSQL_SA_PASSWORD");
            if (!string.IsNullOrWhiteSpace(sa))
            {
                var host = Environment.GetEnvironmentVariable("PROC_DB_HOST") ?? "127.0.0.1";
                var port = Environment.GetEnvironmentVariable("PROC_DB_PORT") ?? "1433";
                return $"Server={host},{port};Database={databaseName};User Id=sa;Password={sa};Encrypt=False;TrustServerCertificate=True";
            }

            return $"Server=(localdb)\\MSSQLLocalDB;Database={databaseName};Trusted_Connection=True;TrustServerCertificate=True";
        }

        public WebApplicationFactory<Program> Factory { get; }

        public async Task InitializeAsync()
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            EnsureTestDatabase(dbContext);
            await dbContext.Database.EnsureDeletedAsync();
            await dbContext.Database.MigrateAsync();
        }

        public async Task SeedInitialIamDataAsync()
        {
            EnsureTestConnectionString();
            await Factory.Services.SeedInitialIamDataAsync();
        }

        public async Task SeedAsync(Action<ProcurementDbContext> seed)
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            seed(dbContext);
            await dbContext.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            using var scope = Factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            EnsureTestDatabase(dbContext);
            await dbContext.Database.EnsureDeletedAsync();
            await Factory.DisposeAsync();
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _previousConnectionString);
        }

        private static void EnsureTestDatabase(ProcurementDbContext dbContext)
        {
            var connectionString = dbContext.Database.GetConnectionString() ?? string.Empty;
            if (!connectionString.Contains("IntegratedProcurement_CommandTests_", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Command endpoint tests must not delete or seed the shared development database.");
            }
        }

        private void EnsureTestConnectionString()
        {
            if (!_connectionString.Contains("IntegratedProcurement_CommandTests_", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Command endpoint tests must not delete or seed the shared development database.");
            }
        }
    }

    private sealed class StubEproposalMaterialService : IEproposalMaterialService
    {
        private readonly IReadOnlyList<EproposalMaterialRow> _rows;

        public StubEproposalMaterialService(IReadOnlyList<EproposalMaterialRow> rows)
        {
            _rows = rows;
        }

        public Task<EproposalMaterialCurrencyReadResult> ListCurrenciesAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new EproposalMaterialCurrencyReadResult(
                true,
                _rows
                    .Where(row => !string.IsNullOrWhiteSpace(row.Currency))
                    .Select(row => new EproposalMaterialCurrencyRow(row.SourceProposalId, row.Currency!))
                    .Distinct()
                    .ToArray()));

        public Task<EproposalMaterialPageReadResult> GetPageBySourceProposalIdAsync(
            string sourceProposalId,
            int page,
            int pageSize,
            CancellationToken cancellationToken)
        {
            var filtered = _rows.Where(row => string.Equals(
                row.SourceProposalId,
                sourceProposalId,
                StringComparison.OrdinalIgnoreCase)).ToArray();
            var totalPages = Math.Max(1, (int)Math.Ceiling(filtered.Length / (double)pageSize));
            var actualPage = Math.Min(page, totalPages);
            var rows = filtered.Skip((actualPage - 1) * pageSize).Take(pageSize).ToArray();
            var totals = filtered
                .GroupBy(row => string.IsNullOrWhiteSpace(row.Currency) ? "IDR" : row.Currency!, StringComparer.OrdinalIgnoreCase)
                .Select(group => new EproposalMaterialCurrencyTotal(group.Key, group.Sum(row => row.TotalPrice)))
                .ToArray();
            return Task.FromResult(new EproposalMaterialPageReadResult(
                true,
                actualPage,
                pageSize,
                filtered.Length,
                totals,
                rows));
        }

        public Task<EproposalMaterialReadResult> GetBySourceProposalIdAsync(
            string sourceProposalId,
            CancellationToken cancellationToken) =>
            Task.FromResult(new EproposalMaterialReadResult(
                true,
                _rows.Where(row => string.Equals(
                    row.SourceProposalId,
                    sourceProposalId,
                    StringComparison.OrdinalIgnoreCase)).ToArray()));
    }

    private static Task DevLoginAsync(HttpClient client) => DevLoginAsync(client, "00109610");

    private static async Task DevLoginAsync(HttpClient client, string personnelNo)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new
            {
                personnelNo,
                displayName = personnelNo == "00109610" ? "USEP RUSNANDAR" : null
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
