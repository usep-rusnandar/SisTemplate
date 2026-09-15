namespace IntegratedProcurement.AppHost.Api.Endpoints;

using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.AppHost.Api.ReadModels;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Security;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Application;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Notifications.Application;
using IntegratedProcurement.Platform.Persistence.ModuleState;

public static class TrackerEndpoints
{
    private const string TrackerModuleKey = "proposalTracker";
    private const string TrackerModuleLabel = "Proposal Tracker";

    public static IEndpointRouteBuilder MapTrackerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/proposal-tracker")
            .WithTags("Proposal Tracker")
            .RequireAuthorization(AuthorizationPolicies.InternalUser)
            .RequirePermission("proposalTracker.view");

        group.MapModuleStorageEndpoints(ModuleStateArea.ProposalTracker);

        group.MapGet("/dashboard", ModuleWorkflowReadModels.TrackerDashboard);
        // Assignable people for distribution/reassignment dropdowns, sourced from real users by role
        // (tracker-scoped so officers who lack users.view can still populate the pickers).
        group.MapGet("/assignable-users", GetTrackerAssignableUsersAsync);
        group.MapGet("/proposals", async Task<IResult> (
            IProposalTrackerRepository repository,
            IEproposalMaterialService materialService,
            CancellationToken cancellationToken) =>
        {
            var proposals = await repository.ListProposalsAsync(cancellationToken);
            var activities = await repository.ListActivitiesAsync(cancellationToken);
            var loaDocuments = await repository.ListLoaDocumentsAsync(cancellationToken);
            var activitiesByProposal = activities
                .GroupBy(activity => activity.ProposalKey, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => (IReadOnlyCollection<TrackerActivityDomainItem>)group.Select(ToActivityItem).ToArray(), StringComparer.OrdinalIgnoreCase);
            var loaByProposal = loaDocuments
                .GroupBy(document => document.ProposalKey, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => (IReadOnlyCollection<TrackerLoaDocumentDomainItem>)group.Select(ToLoaItem).ToArray(), StringComparer.OrdinalIgnoreCase);
            var materialRead = proposals.Count == 0
                ? EproposalMaterialCurrencyReadResult.Disabled
                : await materialService.ListCurrenciesAsync(cancellationToken);
            var materialsBySourceId = materialRead.Rows
                .GroupBy(row => row.SourceProposalId, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => group.Select(row => row.Currency).ToArray(), StringComparer.OrdinalIgnoreCase);
            // Backend-driven: return exactly what is in the database (no sample fallback).
            return Results.Ok(proposals.Select(proposal =>
            {
                var sourceId = ExtractEproposalSourceId(proposal.PayloadJson);
                var currency = sourceId is not null && materialsBySourceId.TryGetValue(sourceId, out var currencies)
                    ? ResolveMaterialCurrency(currencies)
                    : null;
                activitiesByProposal.TryGetValue(proposal.ProposalKey, out var proposalActivities);
                loaByProposal.TryGetValue(proposal.ProposalKey, out var proposalLoaDocuments);
                return ToTrackerSummary(proposal, currency, proposalActivities, proposalLoaDocuments);
            }).ToArray());
        });
        group.MapGet("/proposals/{proposalId}", async Task<IResult> (
            string proposalId,
            IProposalTrackerRepository repository,
            CancellationToken cancellationToken) => await GetTrackerProposalDetailAsync(proposalId, repository, cancellationToken));
        // Query-string variant supports proposal keys containing '/'. It is also used by the
        // Tracker UI to reconcile workflow progress completed from CIP after a page refresh.
        group.MapGet("/proposal-detail", GetTrackerProposalDetailAsync);
        group.MapGet("/proposals/{proposalId}/materials", GetProposalMaterialsAsync);
        // Query-string variant supports real E-Proposal keys containing '/' without route-segment ambiguity.
        group.MapGet("/proposal-materials", GetProposalMaterialsAsync);
        group.MapPost("/proposals/{proposalId}/distribute", DistributeTrackerProposalAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/proposals/{proposalId}/activities/{activityId}/clock-in", ClockInTrackerActivityAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/proposals/{proposalId}/activities/{activityId}/complete", CompleteTrackerActivityAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/proposals/{proposalId}/activities/{activityId}/recycle", RecycleTrackerActivityAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/proposals/{proposalId}/activities/{activityId}/cancel", CancelTrackerProposalAsync).RequirePermission("proposalTracker.manage");
        // Query-string commands: E-Proposal keys contain '/' and Azure/IIS 404s path segments after %2F.
        group.MapPost("/distribute", DistributeTrackerProposalAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/activities/clock-in", ClockInTrackerActivityAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/activities/complete", CompleteTrackerActivityAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/activities/recycle", RecycleTrackerActivityAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/activities/cancel", CancelTrackerProposalAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/reassign-officer", ReassignTrackerOfficerAsync).RequirePermission("proposalTracker.manage");
        group.MapPatch("/ariba-id", UpdateTrackerAribaIdAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/proposals/{proposalId}/reassign-officer", ReassignTrackerOfficerAsync).RequirePermission("proposalTracker.manage");
        group.MapPatch("/proposals/{proposalId}/ariba-id", UpdateTrackerAribaIdAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/proposals/{proposalId}/activities/{activityId}/loa-documents", GenerateTrackerLoaDocumentAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/activities/loa-documents", GenerateTrackerLoaDocumentAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/proposals/{proposalId}/activities/{activityId}/loa-complete", CompleteTrackerLoaVendorAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/activities/loa-complete", CompleteTrackerLoaVendorAsync).RequirePermission("proposalTracker.manage");
        // LOA depends on the completed CIP Term Sheet for the same proposal winner. Tracker users
        // can read this narrow bridge without receiving general CIP access.
        group.MapGet("/loa-support", GetTrackerLoaSupportAsync);
        // Commercial/award result (Bid Evaluation or Negotiation) — the Term Sheet + LOA data source.
        group.MapGet("/proposals/{proposalId}/award-result", GetTrackerAwardResultAsync);
        group.MapPut("/proposals/{proposalId}/award-result", SaveTrackerAwardResultAsync).RequirePermission("proposalTracker.manage");
        // Query-string variants are required for real E-Proposal keys containing '/'. ASP.NET route
        // parameters do not decode an escaped slash back into the original proposal key.
        group.MapGet("/award-result", GetTrackerAwardResultAsync);
        group.MapPut("/award-result", SaveTrackerAwardResultAsync).RequirePermission("proposalTracker.manage");
        // Handoff after Bid Evaluation / Negotiation: create the CIP Term Sheet case(s) from the
        // award result. LOA is deliberately generated later, after the winner's Term Sheet completes.
        group.MapPost("/proposals/{proposalId}/finalize-award", FinalizeAwardAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/finalize-award", FinalizeAwardAsync).RequirePermission("proposalTracker.manage");
        // Manual Sync from E-Proposal views (also runs on a schedule when configured).
        group.MapPost("/ingest/eproposal", IngestEproposalAsync).RequirePermission("proposalTracker.manage");
        // Temporary sample proposals while E-Proposal views are unavailable (Section Head only).
        group.MapPost("/sample-data", GenerateSampleDataAsync).RequirePermission("proposalTracker.manage");
        group.MapPost("/proposals/{proposalId}/historical-evidence", DownloadHistoricalEvidenceAsync);
        group.MapPost("/historical-evidence", DownloadHistoricalEvidenceAsync);
        group.MapGet("/loa-documents", async Task<IResult> (
            IProposalTrackerRepository repository,
            CancellationToken cancellationToken) =>
        {
            var documents = await repository.ListLoaDocumentsAsync(cancellationToken);
            // Backend-driven: return exactly what is in the database (no sample fallback).
            return Results.Ok(documents.Select(ToLoaItem).ToArray());
        });

        return endpoints;
    }

    private static async Task<IResult> GetTrackerAwardResultAsync(
        string proposalId,
        ProposalTrackerService trackerService,
        CancellationToken cancellationToken)
    {
        var view = await trackerService.GetAwardResultAsync(proposalId, cancellationToken);
        return view is null
            ? Results.Ok(new { proposalId, found = false, vendors = Array.Empty<object>() })
            : Results.Ok(view);
    }

    private static async Task<IResult> GetProposalMaterialsAsync(
        string proposalId,
        IProposalTrackerRepository repository,
        IEproposalMaterialService materialService,
        CancellationToken cancellationToken,
        int page = 1,
        int pageSize = 10)
    {
        page = Math.Max(1, page);
        pageSize = NormalizeMaterialPageSize(pageSize);
        var proposal = await repository.GetProposalAsync(proposalId, tracking: false, cancellationToken);
        if (proposal is null)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        if (TryReadSampleMaterials(proposal.PayloadJson, proposal.ProposalKey, out var sampleRows))
        {
            return Results.Ok(BuildSampleMaterialsPage(proposal.ProposalKey, sampleRows, page, pageSize));
        }

        var sourceProposalId = ExtractEproposalSourceId(proposal.PayloadJson);
        if (sourceProposalId is null)
        {
            return Results.Ok(new
            {
                enabled = true,
                proposalKey = proposal.ProposalKey,
                sourceProposalId = (string?)null,
                currency = (string?)null,
                page,
                pageSize,
                totalRows = 0,
                totalPages = 0,
                totals = Array.Empty<EproposalMaterialCurrencyTotal>(),
                rows = Array.Empty<EproposalMaterialRow>()
            });
        }

        var result = await materialService.GetPageBySourceProposalIdAsync(
            sourceProposalId,
            page,
            pageSize,
            cancellationToken);
        return Results.Ok(new
        {
            result.Enabled,
            proposalKey = proposal.ProposalKey,
            sourceProposalId,
            currency = ResolveMaterialCurrency(result.Totals.Select(total => total.Currency)),
            result.Page,
            result.PageSize,
            result.TotalRows,
            totalPages = (int)Math.Ceiling(result.TotalRows / (double)result.PageSize),
            result.Totals,
            rows = result.Rows
        });
    }

    private static async Task<IResult> SaveTrackerAwardResultAsync(
        string proposalId,
        SaveTrackerAwardResultRequest? body,
        ProposalTrackerService trackerService,
        CancellationToken cancellationToken)
    {
        if (body is null)
        {
            return Results.BadRequest(new { code = "award_result_invalid" });
        }

        var result = await trackerService.SaveAwardResultAsync(body.ToCommand(proposalId), cancellationToken);
        return result.ProposalFound
            ? Results.Ok(result.Result)
            : Results.NotFound(new { code = "proposal_not_found" });
    }

    private sealed record SaveTrackerAwardResultRequest(
        string? Source,
        string? Method,
        string? EvaluatedBy,
        string? Notes,
        IReadOnlyList<AwardResultVendorInput>? Vendors,
        string? PayloadJson)
    {
        public SaveAwardResultCommand ToCommand(string proposalId) =>
            new(proposalId, Source ?? "BidEvaluation", Method, EvaluatedBy, Notes,
                Vendors ?? Array.Empty<AwardResultVendorInput>(), PayloadJson);
    }

    // After award (EVAL for Tender/Pemilihan, NEGO for Penunjukan): open CIP Term Sheet case(s).
    // LOA is issued later by the Tracker officer once Term Sheet is done (LOA ∥ CTR).
    private static async Task<IResult> FinalizeAwardAsync(
        string proposalId,
        FinalizeAwardRequest? body,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository trackerRepository,
        CipCaseService cipService,
        IEproposalMaterialService eproposalMaterials,
        ContractMaterialService contractMaterials,
        CancellationToken cancellationToken)
    {
        var award = await trackerService.GetAwardResultAsync(proposalId, cancellationToken);
        var winners = award?.Vendors.Where(vendor => vendor.IsWinner).ToArray() ?? Array.Empty<AwardResultVendorView>();
        if (award is null || winners.Length == 0)
        {
            return Results.NotFound(new { code = "award_result_not_found" });
        }

        var type = string.IsNullOrWhiteSpace(body?.Type) ? award.Method : body!.Type;
        var cip = await cipService.CreateFromAwardResultAsync(award.ProposalKey, body?.ActorName, type, cancellationToken);

        var proposal = await trackerRepository.GetProposalAsync(award.ProposalKey, tracking: false, cancellationToken);
        var sourceProposalId = ExtractEproposalSourceId(proposal?.PayloadJson);
        var materialRead = sourceProposalId is null
            ? EproposalMaterialReadResult.Disabled
            : await eproposalMaterials.GetBySourceProposalIdAsync(sourceProposalId, cancellationToken);
        var materialInputs = materialRead.Rows
            .Where(row => !string.IsNullOrWhiteSpace(row.MaterialCode))
            .Select(row => new MaterialRowInput(
                string.Empty,
                row.MaterialCode!,
                row.MaterialDescription ?? row.MaterialCode!,
                row.Jobsite ?? proposal?.Jobsite ?? string.Empty,
                row.Currency ?? string.Empty,
                row.EstimatedPrice))
            .ToArray();
        var materialContracts = 0;
        var materialsCopied = 0;
        // Never erase a prior award snapshot merely because the external view temporarily returns no usable rows.
        if (materialRead.Enabled && materialInputs.Length > 0)
        {
            foreach (var winner in winners)
            {
                var contractKey = await cipService.GetMaterialContractKeyAsync(
                    award.ProposalKey,
                    winner.VendorId,
                    cancellationToken);
                if (contractKey is null)
                {
                    continue;
                }
                var imported = await contractMaterials.ReplaceFromEproposalAwardAsync(
                    contractKey,
                    award.ProposalKey,
                    materialInputs,
                    cancellationToken);
                materialContracts++;
                materialsCopied += imported.RowCount;
            }
        }

        return Results.Ok(new
        {
            proposalKey = award.ProposalKey,
            type,
            casesCreated = cip.Created.Count,
            existingCases = cip.Existing,
            materialSourceEnabled = materialRead.Enabled,
            materialRows = materialInputs.Length,
            materialContracts,
            materialsCopied,
            cases = cip.Created.Select(item => new { item.CaseKey, item.VendorName, item.Value, item.AwardPercent, item.Stage, item.Source }).ToArray(),
            // Compatibility with the original CIP endpoint response consumed by the legacy frontend.
            created = cip.Created.Select(item => new { item.CaseKey, item.VendorId, item.VendorName, item.Value, item.AwardPercent, item.Stage }).ToArray(),
            existing = cip.Existing
        });
    }

    private sealed record FinalizeAwardRequest(string? Type, string? ActorName);

    private static async Task<IResult> IngestEproposalAsync(
        IEproposalIngestionService ingestionService,
        CancellationToken cancellationToken)
    {
        var result = await ingestionService.IngestAsync(cancellationToken);
        return result.Enabled
            ? Results.Ok(new
            {
                enabled = true,
                result.Fetched,
                result.Inserted,
                result.Updated,
                result.Skipped
            })
            : Results.Ok(new { enabled = false, message = "E-Proposal connection is not configured." });
    }

    private static async Task<IResult> GenerateSampleDataAsync(
        HttpRequest request,
        HttpContext httpContext,
        string? forPersonnelNo,
        IAdminConsoleAuditService auditService,
        ProposalTrackerService trackerService,
        ITrackerRosterService rosterService,
        CancellationToken cancellationToken)
    {
        var personnelNo = httpContext.User.FindFirstValue(AppClaimTypes.PersonnelNo);
        var ownerGate = await rosterService.ResolveSampleOwnerAsync(personnelNo, forPersonnelNo, cancellationToken);
        if (ownerGate.Forbidden)
        {
            return Results.Forbid();
        }

        if (!ownerGate.Ok || string.IsNullOrWhiteSpace(ownerGate.OwnerName))
        {
            return Results.BadRequest(new { code = ownerGate.ErrorCode ?? "owner_not_found" });
        }

        var ownerName = ownerGate.OwnerName;
        var body = await ReadJsonBodyAsync<GenerateSampleDataRequest>(request, cancellationToken);
        var items = (body?.Items ?? Array.Empty<GenerateSampleDataItemRequest>())
            .Select(item => new SampleProposalItemInput(
                item.TrackerMethod,
                ParseDateOnly(item.RequirementDate),
                item.TotalVendor,
                item.Amount,
                item.AssignedOfficerName,
                item.LastStepCode))
            .ToArray();

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.AssignedOfficerName))
            {
                continue;
            }

            var officerCheck = await EnsureAssignableOfficerAsync(
                httpContext, rosterService, item.AssignedOfficerName, forPersonnelNo, cancellationToken);
            if (officerCheck is not null)
            {
                return officerCheck;
            }
        }

        var result = await trackerService.GenerateSampleDataAsync(ownerName, items, cancellationToken);
        if (!result.Ok)
        {
            return Results.BadRequest(new { code = result.ErrorCode });
        }

        await auditService.WriteAuditAsync(
            httpContext,
            "Create",
            TrackerModuleLabel,
            $"Generated {result.Created.Count} sample proposal(s) for {ownerName}",
            cancellationToken);

        return Results.Ok(new
        {
            created = result.Created.Count,
            ownerName,
            proposals = result.Created.Select(ToTrackerSummary).ToArray(),
        });
    }

    private static DateOnly? ParseDateOnly(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateOnly.TryParse(value.Trim(), out var date) ? date : null;
    }

    private static DateTimeOffset? ParseDateTimeOffset(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateTimeOffset.TryParse(
            value.Trim(),
            CultureInfo.InvariantCulture,
            DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeLocal,
            out var timestamp)
            ? timestamp
            : null;
    }

    private static async Task<IResult> GetTrackerAssignableUsersAsync(
        HttpContext httpContext,
        ITrackerRosterService rosterService,
        string? forPersonnelNo,
        CancellationToken cancellationToken)
    {
        var personnelNo = httpContext.User.FindFirstValue(AppClaimTypes.PersonnelNo);
        var result = await rosterService.GetAssignableUsersAsync(personnelNo, forPersonnelNo, cancellationToken);
        return Results.Ok(new TrackerAssignableUsersResponse(
            result.SectionHeads,
            result.Officers,
            result.VisibilityMode,
            result.OwnerNamesUnder));
    }

    private static async Task<IResult> DistributeTrackerProposalAsync(
        string proposalId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        ITrackerRosterService rosterService,
        string? forPersonnelNo,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<DistributeProposalRequest>(request, cancellationToken);
        var officerCheck = await EnsureAssignableOfficerAsync(
            httpContext, rosterService, body?.AssignedOfficerName, forPersonnelNo, cancellationToken);
        if (officerCheck is not null)
        {
            return officerCheck;
        }

        var result = await trackerService.DistributeAsync(proposalId, body?.AssignedOfficerName, body?.TrackerMethod, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        var proposal = result.Proposal!;
        await auditService.WriteAuditAsync(httpContext, "Update", TrackerModuleLabel, $"Distributed proposal {proposal.ProposalNumber} to {result.Officer}", cancellationToken);
        await notificationService.NotifyModuleAsync(
            TrackerModuleKey,
            TrackerModuleLabel,
            "info",
            $"Proposal {proposal.ProposalNumber} distributed",
            $"{proposal.Title} assigned to {result.Officer}.",
            $"/proposal-tracker/proposals?case={Uri.EscapeDataString(proposal.ProposalKey)}",
            cancellationToken);
        return await GetTrackerProposalDetailAsync(proposal.ProposalKey, repository, cancellationToken);
    }

    private static async Task<IResult> DownloadHistoricalEvidenceAsync(
        string proposalId,
        HttpRequest request,
        IProposalTrackerRepository repository,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        var proposal = await repository.GetProposalAsync(proposalId, tracking: false, cancellationToken);
        if (proposal is null)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        if (string.Equals(proposal.LifecycleStatus, "ReadyToDistribute", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Conflict(new { code = "not_distributed" });
        }

        var body = await ReadJsonBodyAsync<HistoricalEvidenceRequest>(request, cancellationToken);
        var activities = await repository.GetActivitiesAsync(proposal.ProposalKey, tracking: false, cancellationToken);
        var loaDocuments = await repository.GetLoaDocumentsAsync(proposal.ProposalKey, cancellationToken);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var parts = new List<TrackerEvidencePart>();

        async Task AddBlobAsync(string stageTitle, string vendorName, string fileName, string? container, string? blobKey, string? contentType, string? note)
        {
            var key = $"{container}|{blobKey}|{fileName}|{stageTitle}|{vendorName}";
            if (!seen.Add(key))
            {
                return;
            }

            byte[]? bytes = null;
            var embedNote = note;
            if (!string.IsNullOrWhiteSpace(container) && !string.IsNullOrWhiteSpace(blobKey) && storage.IsConfigured)
            {
                bytes = await storage.TryDownloadAsync(container, blobKey, cancellationToken);
                if (bytes is null)
                {
                    embedNote = "Listed in Tracker but the blob could not be downloaded.";
                }
            }
            else if (string.IsNullOrWhiteSpace(blobKey))
            {
                embedNote ??= "Listed in Tracker without a stored blob.";
            }

            parts.Add(new TrackerEvidencePart(
                stageTitle,
                vendorName,
                string.IsNullOrWhiteSpace(fileName) ? "document.pdf" : fileName,
                bytes,
                contentType,
                embedNote));
        }

        foreach (var item in body?.Documents ?? [])
        {
            await AddBlobAsync(
                item.StageTitle ?? "",
                item.VendorName ?? "",
                item.FileName ?? "document.pdf",
                item.Container,
                item.BlobKey,
                item.ContentType,
                null);
        }

        var activityTitle = activities.ToDictionary(a => a.ActivityKey, a => a.Title, StringComparer.OrdinalIgnoreCase);
        foreach (var loa in loaDocuments)
        {
            var (container, blobKey) = ReadLoaBlobRef(loa.PayloadJson);
            var stage = activityTitle.TryGetValue(loa.ActivityKey, out var title) ? title : "Letter of Award";
            await AddBlobAsync(stage, loa.VendorName, loa.FileName, container, blobKey, "application/pdf", null);
        }

        var pdf = TrackerHistoricalEvidencePdf.Build(proposal, activities, parts);
        var stamp = JakartaTime.Today().ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var safeNo = new string((proposal.ProposalNumber ?? "proposal")
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
            .Take(48)
            .ToArray());
        var fileName = $"historical-evidence-{safeNo}-{stamp}.pdf";
        return Results.File(pdf, "application/pdf", fileName);
    }

    private static (string? Container, string? BlobKey) ReadLoaBlobRef(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return (null, null);
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            var root = document.RootElement;
            if (root.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Object)
            {
                root = payload;
            }

            static string? Read(JsonElement el, params string[] names)
            {
                foreach (var name in names)
                {
                    if (el.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
                    {
                        return value.GetString();
                    }
                }

                return null;
            }

            return (Read(root, "container", "Container"), Read(root, "blobKey", "BlobKey"));
        }
        catch (JsonException)
        {
            return (null, null);
        }
    }

    private static async Task<IResult> ClockInTrackerActivityAsync(
        string proposalId,
        string activityId,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        CancellationToken cancellationToken)
    {
        var result = await trackerService.ClockInActivityAsync(proposalId, activityId, cancellationToken);
        if (!result.ProposalFound)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        if (!result.ActivityFound)
        {
            return Results.NotFound(new { code = "activity_not_found" });
        }

        var proposal = result.Proposal!;
        await auditService.WriteAuditAsync(httpContext, "Update", TrackerModuleLabel, $"Clocked in activity {activityId} for proposal {proposal.ProposalNumber}", cancellationToken);
        return await GetTrackerProposalDetailAsync(proposal.ProposalKey, repository, cancellationToken);
    }

    private static async Task<IResult> CompleteTrackerActivityAsync(
        string proposalId,
        string activityId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<TrackerActivityCommandRequest>(request, cancellationToken);
        var result = await trackerService.CompleteActivityAsync(
            proposalId,
            activityId,
            body?.EvidenceNames?.Count,
            ParseDateTimeOffset(body?.CompletedAt),
            cancellationToken);
        if (!result.ProposalFound)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        if (!result.ActivityFound)
        {
            return Results.NotFound(new { code = "activity_not_found" });
        }

        var proposal = result.Proposal!;
        await auditService.WriteAuditAsync(httpContext, "Update", TrackerModuleLabel, $"Completed activity {activityId} for proposal {proposal.ProposalNumber}", cancellationToken);
        return await GetTrackerProposalDetailAsync(proposal.ProposalKey, repository, cancellationToken);
    }

    private static async Task<IResult> RecycleTrackerActivityAsync(
        string proposalId,
        string activityId,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        CipCaseService cipService,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        var proposalBefore = await repository.GetProposalAsync(proposalId, tracking: false, cancellationToken);
        var activitiesBefore = proposalBefore is null
            ? Array.Empty<TrackerProposalActivity>()
            : await repository.GetActivitiesAsync(proposalBefore.ProposalKey, tracking: false, cancellationToken);
        var recycled = activitiesBefore.FirstOrDefault(item => item.ActivityKey == activityId);

        var result = await trackerService.RecycleActivityAsync(proposalId, activityId, cancellationToken);
        if (!result.ProposalFound)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        if (!result.ActivityFound)
        {
            return Results.NotFound(new { code = "activity_not_found" });
        }

        var proposal = result.Proposal!;
        if (recycled is not null && ProposalTrackerService.RecycleInvalidatesCipCases(recycled, activitiesBefore))
        {
            await WithdrawCipCasesForProposalAsync(cipService, storage, proposal.ProposalKey, cancellationToken);
        }

        await auditService.WriteAuditAsync(httpContext, "Update", TrackerModuleLabel, $"Recycled activity {activityId} for proposal {proposal.ProposalNumber}", cancellationToken);
        return await GetTrackerProposalDetailAsync(proposal.ProposalKey, repository, cancellationToken);
    }

    private static async Task<IResult> CancelTrackerProposalAsync(
        string proposalId,
        string activityId,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        CipCaseService cipService,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        var result = await trackerService.CancelAsync(proposalId, activityId, cancellationToken);
        if (!result.ProposalFound)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        if (!result.ActivityFound)
        {
            return Results.NotFound(new { code = "activity_not_found" });
        }

        var proposal = result.Proposal!;
        await WithdrawCipCasesForProposalAsync(cipService, storage, proposal.ProposalKey, cancellationToken);
        await auditService.WriteAuditAsync(httpContext, "Update", TrackerModuleLabel, $"Canceled proposal {proposal.ProposalNumber}", cancellationToken);
        return await GetTrackerProposalDetailAsync(proposal.ProposalKey, repository, cancellationToken);
    }

    private static async Task<IResult> UpdateTrackerAribaIdAsync(
        string proposalId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<UpdateAribaIdRequest>(request, cancellationToken);
        var aribaId = Clean(body?.AribaId);
        if (aribaId is not null && aribaId.Length > 64)
        {
            return Results.BadRequest(new { code = "ariba_id_too_long" });
        }

        var result = await trackerService.UpdateAribaIdAsync(proposalId, aribaId, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        var proposal = result.Proposal!;
        await auditService.WriteAuditAsync(
            httpContext,
            "Update",
            TrackerModuleLabel,
            string.IsNullOrWhiteSpace(proposal.AribaId)
                ? $"Cleared ARIBA ID on proposal {proposal.ProposalNumber}"
                : $"Updated ARIBA ID on proposal {proposal.ProposalNumber} to {proposal.AribaId}",
            cancellationToken);
        return Results.Ok(new { proposalKey = proposal.ProposalKey, aribaId = proposal.AribaId });
    }

    private static async Task<IResult> ReassignTrackerOfficerAsync(
        string proposalId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        ITrackerRosterService rosterService,
        string? forPersonnelNo,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<ReassignOfficerRequest>(request, cancellationToken);
        var officer = Clean(body?.AssignedOfficerName);
        if (officer is null)
        {
            return Results.BadRequest(new { code = "assigned_officer_required" });
        }

        var officerCheck = await EnsureAssignableOfficerAsync(
            httpContext, rosterService, officer, forPersonnelNo, cancellationToken);
        if (officerCheck is not null)
        {
            return officerCheck;
        }

        var result = await trackerService.ReassignOfficerAsync(proposalId, officer, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }

        var proposal = result.Proposal!;
        await auditService.WriteAuditAsync(httpContext, "Update", TrackerModuleLabel, $"Reassigned proposal {proposal.ProposalNumber} to {officer}", cancellationToken);
        // Direct notification to the newly assigned officer; falls back to the Tracker team if the
        // officer name does not resolve to an internal user.
        await notificationService.NotifyAssignedUserAsync(
            officer,
            TrackerModuleKey,
            TrackerModuleLabel,
            "info",
            $"You were assigned proposal {proposal.ProposalNumber}",
            $"{proposal.Title} was reassigned to you.",
            $"/proposal-tracker/proposals?case={Uri.EscapeDataString(proposal.ProposalKey)}",
            cancellationToken);
        return await GetTrackerProposalDetailAsync(proposal.ProposalKey, repository, cancellationToken);
    }

    private static async Task<IResult> GenerateTrackerLoaDocumentAsync(
        string proposalId,
        string activityId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        ICipTermSheetReadPort cipTermSheet,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<GenerateLoaDocumentRequest>(request, cancellationToken);
        var support = await cipTermSheet.GetForTrackerLoaAsync(proposalId, body?.VendorId, cancellationToken);
        if (support is null || !support.Available)
        {
            return Results.BadRequest(new { code = support?.Reason ?? "termsheet_not_completed" });
        }
        var result = await trackerService.GenerateLoaDocumentAsync(
            proposalId,
            activityId,
            body?.VendorId,
            body?.VendorName,
            body?.LoaNumber,
            body?.AwardValue,
            body?.AwardPercent,
            body?.FileName,
            ParseDateTimeOffset(body?.GeneratedAt),
            body?.Container,
            body?.BlobKey,
            body?.Payload,
            cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }
        if (result.ErrorCode is not null)
        {
            return Results.BadRequest(new { code = result.ErrorCode });
        }

        var proposal = result.Proposal!;
        await auditService.WriteAuditAsync(httpContext, "Create", TrackerModuleLabel, $"Generated LOA document for proposal {proposal.ProposalNumber}", cancellationToken);
        return await GetTrackerProposalDetailAsync(proposal.ProposalKey, repository, cancellationToken);
    }

    private static async Task<IResult> CompleteTrackerLoaVendorAsync(
        string proposalId,
        string activityId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        ProposalTrackerService trackerService,
        IProposalTrackerRepository repository,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CompleteLoaVendorRequest>(request, cancellationToken);
        var result = await trackerService.CompleteLoaVendorAsync(
            proposalId,
            activityId,
            body?.VendorId,
            ParseDateTimeOffset(body?.CompletedAt),
            body?.Remark,
            cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "proposal_not_found" });
        }
        if (result.ErrorCode is not null)
        {
            return Results.BadRequest(new { code = result.ErrorCode });
        }

        var proposal = result.Proposal!;
        await auditService.WriteAuditAsync(httpContext, "Update", TrackerModuleLabel, $"Completed LOA for vendor {result.VendorName} on proposal {proposal.ProposalNumber}", cancellationToken);
        return await GetTrackerProposalDetailAsync(proposal.ProposalKey, repository, cancellationToken);
    }

    private static async Task<IResult> GetTrackerLoaSupportAsync(
        string proposalId,
        string? vendorId,
        ICipTermSheetReadPort cipTermSheet,
        CancellationToken cancellationToken)
    {
        var support = await cipTermSheet.GetForTrackerLoaAsync(proposalId, vendorId, cancellationToken);
        return support is null
            ? Results.NotFound(new { code = "cip_termsheet_case_not_found" })
            : Results.Ok(support);
    }

    private static async Task<IResult> GetTrackerProposalDetailAsync(
        string proposalId,
        IProposalTrackerRepository repository,
        CancellationToken cancellationToken)
    {
        var proposal = await repository.GetProposalAsync(proposalId, tracking: false, cancellationToken);
        if (proposal is null)
        {
            var fallback = ModuleWorkflowReadModels.ProposalDetail(proposalId);
            return fallback is null
                ? Results.NotFound(new { code = "proposal_not_found" })
                : Results.Ok(fallback);
        }

        var activities = (await repository.GetActivitiesAsync(proposal.ProposalKey, tracking: false, cancellationToken))
            .Select(ToActivityItem)
            .ToArray();

        var loaDocuments = (await repository.GetLoaDocumentsAsync(proposal.ProposalKey, cancellationToken))
            .Select(ToLoaItem)
            .ToArray();

        return Results.Ok(new TrackerProposalDomainDetail(ToTrackerSummary(proposal), activities, loaDocuments));
    }

    private static TrackerActivityDomainItem ToActivityItem(TrackerProposalActivity activity) =>
        new(
            activity.ActivityKey,
            activity.StageId,
            activity.Title,
            activity.Owner,
            activity.Status,
            activity.MasterLeadDays,
            activity.TargetLeadDays,
            activity.TargetDate,
            activity.StartedAt,
            activity.CompletedAt,
            activity.EvidenceCount,
            activity.LockedReason);

    private static TrackerLoaDocumentDomainItem ToLoaItem(TrackerLoaDocument document) =>
        new(
            document.ProposalKey,
            document.ActivityKey,
            document.VendorId,
            document.LoaNumber,
            document.VendorName,
            document.AwardValue,
            document.AwardPercent,
            document.GeneratedAt,
            document.FileName,
            document.PayloadJson);

    private static TrackerProposalDomainSummary ToTrackerSummary(TrackerProposal item) =>
        ToTrackerSummary(item, currency: null);

    private static TrackerProposalDomainSummary ToTrackerSummary(
        TrackerProposal item,
        string? currency,
        IReadOnlyCollection<TrackerActivityDomainItem>? activities = null,
        IReadOnlyCollection<TrackerLoaDocumentDomainItem>? loaDocuments = null)
    {
        TryReadSampleMaterials(item.PayloadJson, item.ProposalKey, out var sampleRows);
        var source = IsSamplePayload(item.PayloadJson, item.ProposalKey) ? "sample" : null;
        return new(
            item.ProposalKey,
            item.ProposalNumber,
            item.Title,
            item.AribaId,
            item.Commodity,
            item.Jobsite,
            item.Department,
            item.ContractType,
            item.ContractualType,
            ExtractEproposalSourceId(item.PayloadJson),
            currency ?? (source is not null ? "IDR" : null),
            item.Amount,
            item.TrackerMethod,
            item.LifecycleStatus,
            item.CurrentStage,
            item.Priority,
            item.OwnerName,
            item.AssignedOfficerName,
            item.RequirementDate,
            item.AgingDays,
            item.SlaDays,
            item.OverdueDays,
            ExtractRecommendedVendors(item.PayloadJson),
            activities,
            loaDocuments,
            source,
            sampleRows.Count > 0 ? sampleRows : null);
    }

    private static bool IsSampleKey(string? proposalKey) =>
        !string.IsNullOrWhiteSpace(proposalKey)
        && proposalKey.Contains("/SMP", StringComparison.OrdinalIgnoreCase);

    private static bool IsSamplePayload(string? payloadJson, string? proposalKey = null)
    {
        if (IsSampleKey(proposalKey))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return false;
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("source", out var source)
                && string.Equals(source.GetString(), "sample", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (doc.RootElement.TryGetProperty("id", out var id) && IsSampleKey(id.GetString()))
            {
                return true;
            }

            return doc.RootElement.TryGetProperty("proposalNumber", out var number)
                && IsSampleKey(number.GetString());
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryReadSampleMaterials(string? payloadJson, string proposalKey, out List<EproposalMaterialRow> rows)
    {
        rows = [];
        if (!IsSamplePayload(payloadJson, proposalKey) || string.IsNullOrWhiteSpace(payloadJson))
        {
            return false;
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("sampleMaterials", out var materials)
                || materials.ValueKind != JsonValueKind.Array)
            {
                return true;
            }

            foreach (var item in materials.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var quantity = ReadJsonDecimal(item, "quantity");
                var estimated = ReadJsonDecimal(item, "estimatedPrice");
                var total = ReadJsonDecimal(item, "totalPrice");
                if (total == 0m && quantity != 0m)
                {
                    total = quantity * estimated;
                }

                DateOnly? requiredDate = null;
                var requiredRaw = ReadJsonString(item, "requiredDate");
                if (!string.IsNullOrWhiteSpace(requiredRaw)
                    && DateOnly.TryParse(requiredRaw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                {
                    requiredDate = parsed;
                }

                rows.Add(new EproposalMaterialRow(
                    proposalKey,
                    ReadJsonString(item, "materialCode"),
                    ReadJsonString(item, "materialDescription"),
                    ReadJsonString(item, "materialSubclass"),
                    ReadJsonString(item, "brand"),
                    quantity,
                    estimated,
                    total,
                    ReadJsonString(item, "currency") ?? "IDR",
                    requiredDate,
                    ReadJsonString(item, "jobsite"),
                    ReadJsonString(item, "plant"),
                    ReadJsonString(item, "contractNo"),
                    ReadJsonString(item, "contractName")));
            }

            return true;
        }
        catch (JsonException)
        {
            return true;
        }
    }

    private static object BuildSampleMaterialsPage(
        string proposalKey,
        List<EproposalMaterialRow> rows,
        int page,
        int pageSize)
    {
        var totalRows = rows.Count;
        var skip = (page - 1) * pageSize;
        var pageRows = rows.Skip(skip).Take(pageSize).ToArray();
        var totals = rows
            .GroupBy(row => string.IsNullOrWhiteSpace(row.Currency) ? "IDR" : row.Currency.Trim().ToUpperInvariant())
            .Select(group => new EproposalMaterialCurrencyTotal(group.Key, group.Sum(row => row.TotalPrice)))
            .ToArray();
        return new
        {
            enabled = true,
            sample = true,
            source = "sample",
            proposalKey,
            sourceProposalId = (string?)null,
            currency = ResolveMaterialCurrency(totals.Select(total => total.Currency)),
            page,
            pageSize,
            totalRows,
            totalPages = totalRows == 0 ? 0 : (int)Math.Ceiling(totalRows / (double)pageSize),
            totals,
            rows = pageRows,
        };
    }

    private static string? ReadJsonString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property)
            || property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.String ? Clean(property.GetString()) : Clean(property.GetRawText());
    }

    private static decimal ReadJsonDecimal(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property)
            || property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return 0m;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetDecimal(out var value))
        {
            return value;
        }

        return decimal.TryParse(property.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0m;
    }

    private static string? ExtractEproposalSourceId(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("eproposalId", out var sourceId)
                && !doc.RootElement.TryGetProperty("sourceProposalId", out sourceId))
            {
                return null;
            }

            return sourceId.ValueKind switch
            {
                JsonValueKind.String => Clean(sourceId.GetString()),
                JsonValueKind.Number => sourceId.GetRawText(),
                _ => null
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? ResolveMaterialCurrency(IEnumerable<EproposalMaterialRow> rows) =>
        ResolveMaterialCurrency(rows.Select(row => row.Currency));

    private static string? ResolveMaterialCurrency(IEnumerable<string?> values)
    {
        var currencies = values
            .Select(currency => Clean(currency)?.ToUpperInvariant())
            .Where(currency => currency is not null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return currencies.Length switch
        {
            0 => null,
            1 => currencies[0],
            _ => "MULTI"
        };
    }

    private static int NormalizeMaterialPageSize(int pageSize) =>
        pageSize is 10 or 25 or 50 or 100 ? pageSize : 10;

    private static TrackerRecommendedVendorItem[] ExtractRecommendedVendors(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return [];
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("recommendedVendors", out var vendors)
                || vendors.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            return vendors.EnumerateArray()
                .Select(item => new TrackerRecommendedVendorItem(
                    ReadJsonString(item, "vendorId", "VendorId"),
                    ReadJsonString(item, "vendorName", "VendorName") ?? string.Empty,
                    ReadJsonString(item, "director", "Director"),
                    ReadJsonString(item, "address", "Address")))
                .Where(item => !string.IsNullOrWhiteSpace(item.VendorName) || !string.IsNullOrWhiteSpace(item.VendorId))
                .ToArray();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static async Task<T?> ReadJsonBodyAsync<T>(HttpRequest request, CancellationToken cancellationToken)
    {
        if (request.ContentLength is null or 0)
        {
            return default;
        }

        return await JsonSerializer.DeserializeAsync<T>(request.Body, JsonOptions, cancellationToken);
    }

    private static async Task<IResult?> EnsureAssignableOfficerAsync(
        HttpContext httpContext,
        ITrackerRosterService rosterService,
        string? assignedOfficerName,
        string? scopedPersonnelNo,
        CancellationToken cancellationToken)
    {
        var personnelNo = httpContext.User.FindFirstValue(AppClaimTypes.PersonnelNo);
        var gate = await rosterService.EnsureAssignableOfficerAsync(
            personnelNo, scopedPersonnelNo, assignedOfficerName, cancellationToken);
        if (gate.Ok)
        {
            return null;
        }

        if (gate.Forbidden)
        {
            return Results.Forbid();
        }

        return gate.ErrorCode == "assigned_officer_unknown"
            ? Results.BadRequest(new { code = gate.ErrorCode, assignedOfficerName = gate.AssignedOfficerName })
            : Results.BadRequest(new { code = gate.ErrorCode ?? "assigned_officer_required" });
    }

    private static async Task WithdrawCipCasesForProposalAsync(
        CipCaseService cipService,
        IDocumentStorage storage,
        string proposalKey,
        CancellationToken cancellationToken)
    {
        var withdrawn = await cipService.WithdrawCasesForProposalAsync(proposalKey, cancellationToken);
        if (!storage.IsConfigured)
        {
            return;
        }

        foreach (var blob in withdrawn.Blobs)
        {
            await storage.DeleteAsync(blob.Container, blob.BlobKey, cancellationToken);
        }
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? ReadJsonString(JsonElement item, string camel, string pascal)
    {
        if (item.TryGetProperty(camel, out var camelValue) && camelValue.ValueKind == JsonValueKind.String)
        {
            return camelValue.GetString();
        }

        if (item.TryGetProperty(pascal, out var pascalValue) && pascalValue.ValueKind == JsonValueKind.String)
        {
            return pascalValue.GetString();
        }

        return null;
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

internal sealed record TrackerRecommendedVendorItem(
    string? VendorId,
    string VendorName,
    string? Director = null,
    string? Address = null);

internal sealed record TrackerProposalDomainSummary(
    string ProposalKey,
    string ProposalNumber,
    string Title,
    string? AribaId,
    string? Commodity,
    string? Jobsite,
    string? Department,
    string? ContractType,
    string? ContractualType,
    string? SourceProposalId,
    string? Currency,
    decimal Amount,
    string? TrackerMethod,
    string LifecycleStatus,
    string CurrentStage,
    string? Priority,
    string? OwnerName,
    string? AssignedOfficerName,
    DateOnly? RequirementDate,
    int AgingDays,
    int SlaDays,
    int OverdueDays,
    IReadOnlyCollection<TrackerRecommendedVendorItem> RecommendedVendors,
    IReadOnlyCollection<TrackerActivityDomainItem>? Activities = null,
    IReadOnlyCollection<TrackerLoaDocumentDomainItem>? LoaDocuments = null,
    string? Source = null,
    IReadOnlyList<EproposalMaterialRow>? SampleMaterials = null);

internal sealed record TrackerActivityDomainItem(
    string ActivityKey,
    string StageId,
    string Title,
    string Owner,
    string Status,
    int MasterLeadDays,
    int TargetLeadDays,
    DateOnly? TargetDate,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    int EvidenceCount,
    string? LockedReason);

internal sealed record TrackerLoaDocumentDomainItem(
    string ProposalKey,
    string ActivityKey,
    string VendorId,
    string? LoaNumber,
    string VendorName,
    decimal AwardValue,
    decimal AwardPercent,
    DateTimeOffset? GeneratedAt,
    string FileName,
    string PayloadJson);

internal sealed record TrackerProposalDomainDetail(
    TrackerProposalDomainSummary Proposal,
    IReadOnlyCollection<TrackerActivityDomainItem> Activities,
    IReadOnlyCollection<TrackerLoaDocumentDomainItem> LoaDocuments);

internal sealed record HistoricalEvidenceDocumentRequest(
    string? StageTitle,
    string? VendorName,
    string? FileName,
    string? Container,
    string? BlobKey,
    string? ContentType);

internal sealed record HistoricalEvidenceRequest(
    IReadOnlyList<HistoricalEvidenceDocumentRequest>? Documents);

internal sealed record DistributeProposalRequest(
    string? AssignedOfficerName,
    string? DistributedByName,
    string? StartActivityDate,
    string? TrackerMethod,
    JsonElement? AdjustedSla,
    string? Strategy);

internal sealed record TrackerActivityCommandRequest(
    string? ActorName,
    string? Remark,
    IReadOnlyCollection<string>? EvidenceNames,
    string? Reason,
    string? CompletedAt);

internal sealed record ReassignOfficerRequest(
    string? AssignedOfficerName,
    string? ActorName,
    string? Reason);

internal sealed record UpdateAribaIdRequest(string? AribaId);

internal sealed record GenerateSampleDataItemRequest(
    string? TrackerMethod,
    string? RequirementDate,
    int TotalVendor,
    decimal? Amount = null,
    string? AssignedOfficerName = null,
    string? LastStepCode = null);

internal sealed record GenerateSampleDataRequest(
    IReadOnlyList<GenerateSampleDataItemRequest>? Items);

internal sealed record GenerateLoaDocumentRequest(
    string? VendorId,
    string? VendorName,
    string? LoaNumber,
    decimal? AwardValue,
    decimal? AwardPercent,
    string? FileName,
    string? GeneratedAt,
    string? Container,
    string? BlobKey,
    JsonElement? Payload);

internal sealed record CompleteLoaVendorRequest(
    string? VendorId,
    string? CompletedAt,
    string? Remark);

internal sealed record TrackerAssignableUsersResponse(
    IReadOnlyCollection<string> SectionHeads,
    IReadOnlyCollection<string> Officers,
    string VisibilityMode,
    IReadOnlyCollection<string> OwnerNamesUnder);
