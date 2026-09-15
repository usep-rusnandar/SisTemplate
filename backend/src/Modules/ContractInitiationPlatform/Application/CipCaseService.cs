using System.Text.Json;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.VendorOnboarding.Application;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Application;

/// <summary>
/// Command logic for the Contract Initiation Platform workflow: create a case from a Tracker award
/// result, verify, generate termsheet/draft, select template, register the final contract, and recycle
/// a stage. Owns the workflow transitions and persistence through <see cref="ICipRepository"/>; reads
/// Tracker data only through the cross-module <see cref="ITrackerLoaReadPort"/> and
/// <see cref="ITrackerBidEvaluationReadPort"/>. Vendor office address comes from
/// <see cref="IVendorOfficeAddressReadPort"/> (vdr.VENDOR_T.OfficeAddress), never a CIP query of vdr.
/// Completing the Contract activity hands the executed contract to Contract Monitoring via
/// <see cref="IContractMonitoringHandoffPort"/>. Cross-cutting side effects (audit, notification) stay
/// with the caller, which receives the mutated case.
/// </summary>
public sealed class CipCaseService : ICipTermSheetReadPort
{
    private static readonly JsonSerializerOptions PayloadOptions = new(JsonSerializerDefaults.Web);

    private readonly ICipRepository _repository;
    private readonly ITrackerLoaReadPort _trackerLoa;
    private readonly ITrackerBidEvaluationReadPort _trackerBidEval;
    private readonly ITrackerWorkflowCommandPort _trackerWorkflow;
    private readonly IContractMonitoringHandoffPort _contractMonitoring;
    private readonly IVendorOfficeAddressReadPort _vendorOfficeAddresses;

    public CipCaseService(
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        ITrackerBidEvaluationReadPort trackerBidEval,
        ITrackerWorkflowCommandPort trackerWorkflow,
        IContractMonitoringHandoffPort contractMonitoring,
        IVendorOfficeAddressReadPort vendorOfficeAddresses)
    {
        _repository = repository;
        _trackerLoa = trackerLoa;
        _trackerBidEval = trackerBidEval;
        _trackerWorkflow = trackerWorkflow;
        _contractMonitoring = contractMonitoring;
        _vendorOfficeAddresses = vendorOfficeAddresses;
    }

    /// <summary>
    /// Create a CIP Term Sheet case per winning vendor from the proposal's award result (Bid Evaluation
    /// for Tender / Pemilihan Langsung, or Negotiation for Penunjukan Langsung). Split award → one case
    /// per winner. Idempotent per (proposal, vendor): existing cases are left untouched.
    /// </summary>
    public async Task<CipCreateFromAwardResult> CreateFromAwardResultAsync(string proposalKey, string? actorName, string? procurementType, CancellationToken cancellationToken)
    {
        var award = await _trackerBidEval.GetAwardResultAsync(proposalKey, cancellationToken);
        if (award is null || award.Winners.Count == 0)
        {
            return new CipCreateFromAwardResult(false, 0, Array.Empty<CipCase>());
        }

        var proposal = await _trackerLoa.GetProposalAsync(proposalKey, cancellationToken);
        var officeAddresses = await _vendorOfficeAddresses.ResolveAsync(
            award.Winners.Select(winner => new VendorOfficeAddressLookup(winner.VendorId, winner.VendorName)).ToArray(),
            cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var createdAt = DateOnly.FromDateTime(now.DateTime);
        // Type comes from the caller, falling back to the award method; recorded on the case payload.
        var type = string.IsNullOrWhiteSpace(procurementType) ? award.Method : procurementType;
        var source = $"tracker-{award.Source.ToLowerInvariant()}";
        var created = new List<CipCase>();
        var existing = 0;

        foreach (var winner in award.Winners)
        {
            // {proposalKey}-{vendorId} is the stable per-winner linkage key used for award/LOA matching.
            var caseLoaKey = $"{proposalKey}-{winner.VendorId}";
            if (await _repository.GetCaseByLoaKeyAsync(caseLoaKey, cancellationToken) is not null)
            {
                existing++;
                continue;
            }

            var caseKey = await _repository.NextCaseKeyAsync(cancellationToken);
            officeAddresses.TryGetValue(winner.VendorId, out var vendorAddress);
            var payloadJson = JsonSerializer.Serialize(new
            {
                ProposalKey = proposalKey,
                award.Source,
                award.Method,
                ProcurementType = type,
                winner.VendorId,
                winner.VendorName,
                VendorAddress = string.IsNullOrWhiteSpace(vendorAddress) ? null : vendorAddress,
                winner.AwardValue,
                winner.AwardPercent,
                Terms = winner.TermsPayloadJson
            }, PayloadOptions);

            var cipCase = new CipCase(
                Guid.NewGuid(),
                caseKey,
                caseLoaKey,
                null,
                proposal?.Title ?? caseKey,
                winner.VendorId,
                winner.VendorName,
                proposal?.Jobsite,
                proposal?.Department,
                winner.AwardValue,
                proposal?.Amount ?? winner.AwardValue,
                winner.AwardPercent,
                "termsheet",
                CipStagePolicy.StatusForStage("termsheet"),
                null,
                proposal?.OwnerName,
                proposal?.AssignedOfficerName,
                null,
                createdAt,
                source,
                proposal?.ProposalKey ?? proposalKey,
                proposal?.ProposalNumber,
                $"TS/{caseKey}/VI/2026",
                $"CTR/{caseKey}/VI/2026",
                payloadJson);
            _repository.AddCase(cipCase);
            AddActivity(cipCase.CaseKey, "Created", "termsheet", now, actorName, $"CIP case created from Tracker {award.Source} (award result).");
            // Save per winner so NextCaseKeyAsync (which counts committed rows) yields a fresh key each iteration.
            await _repository.SaveChangesAsync(cancellationToken);
            created.Add(cipCase);
        }

        return new CipCreateFromAwardResult(true, existing, created);
    }

    /// <summary>
    /// Drop CIP Term Sheet cases for a Tracker proposal (recycle/cancel of the award-defining step).
    /// Returns blob refs so the host can delete Azure files without this module taking IDocumentStorage.
    /// </summary>
    public async Task<CipWithdrawResult> WithdrawCasesForProposalAsync(string proposalKey, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(proposalKey))
        {
            return new CipWithdrawResult(0, Array.Empty<CipBlobRef>());
        }

        var loaPrefix = proposalKey + "-";
        var cases = (await _repository.ListCasesAsync(cancellationToken))
            .Where(item =>
                string.Equals(item.ProposalKey, proposalKey, StringComparison.OrdinalIgnoreCase)
                || (!string.IsNullOrWhiteSpace(item.LoaKey)
                    && item.LoaKey.StartsWith(loaPrefix, StringComparison.OrdinalIgnoreCase)))
            .ToArray();
        if (cases.Length == 0)
        {
            return new CipWithdrawResult(0, Array.Empty<CipBlobRef>());
        }

        var blobs = new List<CipBlobRef>();
        foreach (var cipCase in cases)
        {
            foreach (var document in await _repository.GetDocumentsAsync(cipCase.CaseKey, cancellationToken))
            {
                if (!string.IsNullOrWhiteSpace(document.Container) && !string.IsNullOrWhiteSpace(document.BlobKey))
                {
                    blobs.Add(new CipBlobRef(document.Container, document.BlobKey));
                }
            }
        }

        await _repository.DeleteCaseGraphsAsync(cases.Select(item => item.CaseKey).ToArray(), cancellationToken);
        return new CipWithdrawResult(cases.Length, blobs);
    }

    public async Task<CipCommandResult> VerifyAsync(string caseId, string? actorName, CancellationToken cancellationToken)
    {
        var cipCase = await _repository.GetCaseAsync(caseId, tracking: true, cancellationToken);
        if (cipCase is null)
        {
            return new CipCommandResult(false, null);
        }

        cipCase.SetWorkflowStage("termsheet", CipStagePolicy.StatusForStage("termsheet"));
        AddActivity(cipCase.CaseKey, "Verified", "verify", DateTimeOffset.UtcNow, actorName, "Source data verified for Term Sheet generation.");
        await _repository.SaveChangesAsync(cancellationToken);
        return new CipCommandResult(true, cipCase);
    }

    public async Task<CipCommandResult> GenerateTermsheetAsync(
        string caseId,
        string? documentNumber,
        string? fileName,
        DateTimeOffset? generatedAt,
        long? size,
        JsonElement? payload,
        string? container,
        string? blobKey,
        string? actorName,
        CancellationToken cancellationToken)
    {
        var cipCase = await _repository.GetCaseAsync(caseId, tracking: true, cancellationToken);
        if (cipCase is null)
        {
            return new CipCommandResult(false, null);
        }

        if (string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(blobKey))
        {
            return new CipCommandResult(false, cipCase, "termsheet_blob_required");
        }

        var termsheetNumber = Clean(documentNumber) ?? cipCase.TermsheetNumber ?? $"TS/{cipCase.CaseKey}/VI/2026";
        cipCase.RegisterTermsheet(termsheetNumber);
        await UpsertGeneratedDocumentAsync(
            cipCase.CaseKey,
            "termsheet",
            Clean(fileName) ?? $"Termsheet_{cipCase.CaseKey}.pdf",
            generatedAt ?? DateTimeOffset.UtcNow,
            size ?? 0,
            null,
            JsonSerializer.Serialize(new { termsheetNumber, payload }, PayloadOptions),
            container,
            blobKey,
            cancellationToken);
        AddActivity(cipCase.CaseKey, "Generated", "termsheet", DateTimeOffset.UtcNow, actorName, "Term Sheet generated from the approved award source payload.");

        await _repository.SaveChangesAsync(cancellationToken);
        return new CipCommandResult(true, cipCase);
    }

    public async Task<CipCommandResult> SelectTemplateAsync(string caseId, string? templateCode, string? actorName, CancellationToken cancellationToken)
    {
        var cipCase = await _repository.GetCaseAsync(caseId, tracking: true, cancellationToken);
        if (cipCase is null)
        {
            return new CipCommandResult(false, null);
        }

        cipCase.SelectTemplate(Clean(templateCode) ?? cipCase.Template);
        AddActivity(cipCase.CaseKey, "Selected", "template", DateTimeOffset.UtcNow, actorName, "Legal template selected for draft generation.");
        await _repository.SaveChangesAsync(cancellationToken);
        return new CipCommandResult(true, cipCase);
    }

    public async Task<CipCommandResult> GenerateDraftAsync(
        string caseId,
        string? documentNumber,
        string? fileName,
        DateTimeOffset? generatedAt,
        long? size,
        JsonElement? payload,
        string? container,
        string? blobKey,
        string? actorName,
        CancellationToken cancellationToken)
    {
        var cipCase = await _repository.GetCaseAsync(caseId, tracking: true, cancellationToken);
        if (cipCase is null)
        {
            return new CipCommandResult(false, null);
        }

        cipCase.RegisterContractNumber(Clean(documentNumber) ?? cipCase.ContractNumber ?? $"CTR/{cipCase.CaseKey}/VI/2026");
        cipCase.SetWorkflowStage("draft", CipStagePolicy.StatusForStage("draft"));
        await UpsertGeneratedDocumentAsync(
            cipCase.CaseKey,
            "draft-pdf",
            Clean(fileName) ?? $"Draft_{cipCase.Template ?? "Contract"}_{cipCase.CaseKey}.pdf",
            generatedAt ?? DateTimeOffset.UtcNow,
            size ?? 0,
            null,
            JsonSerializer.Serialize(new { documentNumber, payload }, PayloadOptions),
            container,
            blobKey,
            cancellationToken);
        AddActivity(cipCase.CaseKey, "Generated", "draft", DateTimeOffset.UtcNow, actorName, "Draft contract generated from selected template.");

        await _repository.SaveChangesAsync(cancellationToken);
        return new CipCommandResult(true, cipCase);
    }

    public async Task<CipCommandResult> TransitionAsync(
        string caseId,
        string? fromStage,
        string? toStage,
        DateTimeOffset? occurredAt,
        string? actorName,
        string? remark,
        CancellationToken cancellationToken)
    {
        var cipCase = await _repository.GetCaseAsync(caseId, tracking: true, cancellationToken);
        var nextStage = Clean(toStage);
        if (cipCase is null || nextStage is null)
        {
            return new CipCommandResult(false, cipCase);
        }

        var at = occurredAt ?? DateTimeOffset.UtcNow;
        var previousStage = Clean(fromStage) ?? cipCase.Stage;
        cipCase.SetWorkflowStage(nextStage, CipStagePolicy.StatusForStage(nextStage));
        AddActivity(cipCase.CaseKey, "Transitioned", nextStage, at, actorName,
            Clean(remark) ?? $"CIP workflow moved from {previousStage} to {nextStage}.");
        await _repository.SaveChangesAsync(cancellationToken);
        return new CipCommandResult(true, cipCase);
    }

    public async Task<CipCommandResult> CompleteActivityAsync(
        string caseId,
        string? activityKey,
        DateTimeOffset? completedAt,
        string? actorName,
        string? remark,
        CancellationToken cancellationToken)
    {
        var cipCase = await _repository.GetCaseAsync(caseId, tracking: true, cancellationToken);
        var normalizedActivity = (Clean(activityKey) ?? string.Empty).ToLowerInvariant();
        if (cipCase is null || normalizedActivity is not ("termsheet" or "contract"))
        {
            return new CipCommandResult(false, cipCase);
        }

        var existingActivities = await _repository.GetActivitiesAsync(cipCase.CaseKey, cancellationToken);
        var existingCompletion = existingActivities
            .Where(item => item.ActivityType == "Completed" && item.StageKey == normalizedActivity)
            .OrderByDescending(item => item.OccurredAt)
            .FirstOrDefault();
        if (existingCompletion is null)
        {
            var documents = await _repository.GetDocumentsAsync(cipCase.CaseKey, cancellationToken);
            var requiredDocumentType = normalizedActivity == "termsheet" ? "termsheet" : "final";
            if (!documents.Any(item =>
                    item.DocumentType == requiredDocumentType
                    && !string.IsNullOrWhiteSpace(item.BlobKey)))
            {
                return new CipCommandResult(false, cipCase, $"{requiredDocumentType}_document_required");
            }
        }
        var at = existingCompletion?.OccurredAt ?? completedAt ?? DateTimeOffset.UtcNow;
        if (existingCompletion is null)
        {
            AddActivity(cipCase.CaseKey, "Completed", normalizedActivity, at, actorName,
                Clean(remark) ?? $"Completed CIP {normalizedActivity} activity.");
        }

        if (normalizedActivity == "termsheet")
        {
            if (StageOrder(cipCase.Stage) < StageOrder("template"))
            {
                cipCase.SetWorkflowStage("template", CipStagePolicy.StatusForStage("template"));
            }
        }
        else
        {
            cipCase.SetWorkflowStage("final", "approved");
        }

        await _repository.SaveChangesAsync(cancellationToken);
        if (normalizedActivity == "contract")
        {
            await HandOffFinalContractToMonitoringAsync(cipCase, at, cancellationToken);
        }

        await CompleteLinkedTrackerStageWhenReadyAsync(cipCase, normalizedActivity, at, cancellationToken);
        return new CipCommandResult(true, cipCase);
    }

    private async Task HandOffFinalContractToMonitoringAsync(
        CipCase cipCase,
        DateTimeOffset completedAt,
        CancellationToken cancellationToken)
    {
        var documents = await _repository.GetDocumentsAsync(cipCase.CaseKey, cancellationToken);
        var finalDocument = documents.FirstOrDefault(item => item.DocumentType == "final");
        var termsheetDocument = documents.FirstOrDefault(item => item.DocumentType == "termsheet");
        var (periodStart, periodEnd) = ReadTermsheetPeriod(termsheetDocument?.PayloadJson);
        var contractKey = Clean(cipCase.ContractNumber) ?? cipCase.CaseKey;
        var received = JakartaTime.DateOf(completedAt);

        await _contractMonitoring.UpsertFromCipAsync(
            new CipContractHandoffCommand(
                contractKey,
                cipCase.CaseKey,
                cipCase.Title,
                cipCase.VendorName ?? contractKey,
                cipCase.Jobsite,
                cipCase.Department,
                cipCase.Value,
                cipCase.Procurement,
                cipCase.Requestor,
                cipCase.Template,
                periodStart,
                periodEnd,
                cipCase.CreatedAtDate,
                received,
                finalDocument?.Container,
                finalDocument?.BlobKey,
                finalDocument?.FileName,
                cipCase.ProposalKey,
                cipCase.ProposalNumber,
                cipCase.TermsheetNumber,
                cipCase.Source),
            cancellationToken);
    }

    private static (DateOnly? Start, DateOnly? End) ReadTermsheetPeriod(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return (null, null);
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            var root = document.RootElement;
            var payload = root.TryGetProperty("payload", out var nested) && nested.ValueKind == JsonValueKind.Object
                ? nested
                : root;
            return (ReadDateOnly(payload, "periodStart", "startDate"), ReadDateOnly(payload, "periodEnd", "endDate"));
        }
        catch (JsonException)
        {
            return (null, null);
        }
    }

    private static DateOnly? ReadDateOnly(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
            {
                continue;
            }

            var text = value.GetString();
            if (DateOnly.TryParse(text, out var date))
            {
                return date;
            }

            if (DateTimeOffset.TryParse(text, out var timestamp))
            {
                return DateOnly.FromDateTime(timestamp.Date);
            }
        }

        return null;
    }

    private async Task CompleteLinkedTrackerStageWhenReadyAsync(
        CipCase completedCase,
        string activityKey,
        DateTimeOffset completedAt,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(completedCase.ProposalKey))
        {
            return;
        }

        if (activityKey == "termsheet")
        {
            await _trackerWorkflow.OpenParallelAfterTermAsync(
                completedCase.ProposalKey,
                completedAt,
                cancellationToken);
        }

        var siblingCases = (await _repository.ListCasesAsync(cancellationToken))
            .Where(item => string.Equals(item.ProposalKey, completedCase.ProposalKey, StringComparison.OrdinalIgnoreCase))
            .ToArray();
        foreach (var sibling in siblingCases)
        {
            var activities = await _repository.GetActivitiesAsync(sibling.CaseKey, cancellationToken);
            if (!activities.Any(item => item.ActivityType == "Completed" && item.StageKey == activityKey))
            {
                return;
            }
        }

        await _trackerWorkflow.CompleteStageAsync(
            completedCase.ProposalKey,
            activityKey == "termsheet" ? "TERM" : "CTR",
            evidenceCount: 1,
            completedAt,
            cancellationToken);
    }

    private static int StageOrder(string? stage) => stage switch
    {
        "loa" => 0,
        "verify" => 1,
        "termsheet" => 2,
        "template" => 3,
        "draft" => 4,
        "final" or "review" => 5,
        _ => -1
    };

    public async Task<CipCommandResult> RegisterFinalContractAsync(
        string caseId,
        string? documentNumber,
        string? fileName,
        DateTimeOffset? generatedAt,
        long? size,
        JsonElement? payload,
        string? container,
        string? blobKey,
        string? actorName,
        CancellationToken cancellationToken)
    {
        var cipCase = await _repository.GetCaseAsync(caseId, tracking: true, cancellationToken);
        if (cipCase is null)
        {
            return new CipCommandResult(false, null);
        }

        cipCase.RegisterContractNumber(Clean(documentNumber) ?? cipCase.ContractNumber);
        cipCase.SetWorkflowStage("final", CipStagePolicy.StatusForStage("final"));
        await UpsertGeneratedDocumentAsync(
            cipCase.CaseKey,
            "final",
            Clean(fileName) ?? $"Perjanjian_{cipCase.CaseKey}_signed.pdf",
            generatedAt ?? DateTimeOffset.UtcNow,
            size ?? 0,
            null,
            JsonSerializer.Serialize(new { documentNumber, payload }, PayloadOptions),
            container,
            blobKey,
            cancellationToken);
        AddActivity(cipCase.CaseKey, "Registered", "final", DateTimeOffset.UtcNow, actorName, "Final executed contract registered.");

        await _repository.SaveChangesAsync(cancellationToken);
        return new CipCommandResult(true, cipCase);
    }

    public async Task<CipCommandResult> RecycleAsync(string caseId, string? stageKey, string? reason, string? actorName, CancellationToken cancellationToken)
    {
        var cipCase = await _repository.GetCaseAsync(caseId, tracking: true, cancellationToken);
        if (cipCase is null)
        {
            return new CipCommandResult(false, null);
        }

        var stage = Clean(stageKey) ?? cipCase.Stage;
        cipCase.SetWorkflowStage(stage, CipStagePolicy.StatusForStage(stage));
        AddActivity(cipCase.CaseKey, "Recycle", stage, DateTimeOffset.UtcNow, actorName, Clean(reason) ?? $"Recycle {stage}.");
        await _repository.SaveChangesAsync(cancellationToken);
        return new CipCommandResult(true, cipCase);
    }

    private async Task UpsertGeneratedDocumentAsync(
        string caseKey,
        string documentType,
        string fileName,
        DateTimeOffset? generatedAt,
        long size,
        string? dataUri,
        string payloadJson,
        string? container,
        string? blobKey,
        CancellationToken cancellationToken)
    {
        var documentKey = $"{caseKey}:{documentType}";
        var existing = await _repository.GetDocumentAsync(caseKey, documentKey, tracking: true, cancellationToken);
        if (existing is not null)
        {
            existing.ReplaceGeneratedFile(fileName, generatedAt, size, dataUri, payloadJson, container, blobKey);
            return;
        }

        AddDocument(caseKey, documentType, fileName, generatedAt, size, dataUri, payloadJson, container, blobKey);
    }

    private void AddDocument(
        string caseKey,
        string documentType,
        string? fileName,
        DateTimeOffset? generatedAt,
        long size,
        string? dataUri,
        string payloadJson,
        string? container = null,
        string? blobKey = null)
    {
        _repository.AddDocument(new CipCaseDocument(
            Guid.NewGuid(),
            caseKey,
            $"{caseKey}:{documentType}",
            documentType,
            string.IsNullOrWhiteSpace(fileName) ? $"{caseKey}-{documentType}" : fileName,
            generatedAt,
            size,
            dataUri,
            payloadJson,
            container,
            blobKey));
    }

    private void AddActivity(
        string caseKey,
        string activityType,
        string stageKey,
        DateTimeOffset occurredAt,
        string? actorName,
        string message)
    {
        _repository.AddActivity(new CipCaseActivity(
            Guid.NewGuid(),
            caseKey,
            $"{caseKey}:{stageKey}:{activityType}:{Guid.NewGuid():N}",
            activityType,
            stageKey,
            occurredAt,
            actorName,
            message,
            JsonSerializer.Serialize(new { activityType, stageKey, occurredAt, actorName, message }, PayloadOptions)));
    }

    public async Task<string?> GetMaterialContractKeyAsync(
        string proposalKey,
        string vendorId,
        CancellationToken cancellationToken)
    {
        var loaKey = $"{proposalKey}-{vendorId}";
        var cipCase = await _repository.GetCaseByLoaKeyAsync(loaKey, cancellationToken);
        return cipCase is null ? null : Clean(cipCase.ContractNumber) ?? cipCase.CaseKey;
    }

    public async Task<CipTermSheetSupport?> GetForTrackerLoaAsync(
        string proposalId,
        string? vendorId,
        CancellationToken cancellationToken)
    {
        var caseRow = (await _repository.ListCasesAsync(cancellationToken))
            .Where(item => string.Equals(item.ProposalKey, proposalId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(item.ProposalNumber, proposalId, StringComparison.OrdinalIgnoreCase))
            .Where(item => string.IsNullOrWhiteSpace(vendorId)
                || string.Equals(item.VendorId, vendorId, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(item => item.CreatedAtDate)
            .FirstOrDefault();
        if (caseRow is null)
        {
            return null;
        }

        var activities = await _repository.GetActivitiesAsync(caseRow.CaseKey, cancellationToken);
        var completion = activities
            .Where(item => item.ActivityType == "Completed" && item.StageKey == "termsheet")
            .OrderByDescending(item => item.OccurredAt)
            .FirstOrDefault();
        var documents = await _repository.GetDocumentsAsync(caseRow.CaseKey, cancellationToken);
        var document = documents
            .Where(item => item.DocumentType == "termsheet")
            .OrderByDescending(item => item.GeneratedAt)
            .FirstOrDefault();

        return new CipTermSheetSupport(
            completion is not null,
            completion is null ? "termsheet_not_completed" : null,
            caseRow.CaseKey,
            caseRow.TermsheetNumber,
            completion?.OccurredAt,
            caseRow.VendorId ?? string.Empty,
            caseRow.VendorName ?? string.Empty,
            caseRow.Value,
            caseRow.AwardPercent,
            ExtractNestedJsonProperty(caseRow.PayloadJson, "terms"),
            document is null ? null : ExtractNestedJsonProperty(document.PayloadJson, "payload"),
            document is null ? null : new CipTermSheetSupportDocument(
                document.FileName,
                document.GeneratedAt,
                document.Container,
                document.BlobKey));
    }

    private static JsonElement? ExtractNestedJsonProperty(string? payloadJson, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            if (!document.RootElement.TryGetProperty(propertyName, out var value))
            {
                return null;
            }

            if (value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()))
            {
                using var nested = JsonDocument.Parse(value.GetString()!);
                return nested.RootElement.Clone();
            }

            return value.ValueKind is JsonValueKind.Object or JsonValueKind.Array ? value.Clone() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
