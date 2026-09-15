namespace IntegratedProcurement.AppHost.Api.Endpoints;

using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.AppHost.Api.ReadModels;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Application;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.VendorOnboarding.Application;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Notifications.Application;
using IntegratedProcurement.Platform.Persistence.ModuleState;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;

public static class CipEndpoints
{
    private const string CipModuleKey = "contractInitiationPlatform";
    private const string CipModuleLabel = "Proposal Tracker";
    private const string DocxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    public static IEndpointRouteBuilder MapCipEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/contract-initiation-platform")
            .WithTags("Proposal Tracker Term Sheet")
            .RequireAuthorization(AuthorizationPolicies.InternalUser)
            .RequireAnyPermission(PermissionKeys.ContractInitiationPlatformView, PermissionKeys.ProposalTrackerView);

        group.MapModuleStorageEndpoints(ModuleStateArea.ContractInitiationPlatform);

        group.MapGet("/dashboard", ModuleWorkflowReadModels.CipDashboard);
        // Create Term Sheet case(s) from a proposal's award result (Bid Evaluation / Negotiation), one per winner.
        group.MapPost("/cases/from-award-result", CreateCipCaseFromAwardResultAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapGet("/cases", async Task<IResult> (
            ICipRepository repository,
            ITrackerLoaReadPort trackerWorkflow,
            IVendorOfficeAddressReadPort vendorAddresses,
            ITrackerAwardSnapshotReadPort snapshots,
            CancellationToken cancellationToken) =>
        {
            var cases = await repository.ListCasesAsync(cancellationToken);
            // Backend-driven: return exactly what is in the database (no sample fallback).
            var payloadByCase = await EnrichCasePayloadsAsync(cases, vendorAddresses, snapshots, cancellationToken);
            var summaries = new List<CipCaseDomainSummary>(cases.Count);
            foreach (var item in cases)
            {
                TrackerWorkflowView? workflow = null;
                if (!string.IsNullOrWhiteSpace(item.ProposalKey))
                {
                    try
                    {
                        workflow = await trackerWorkflow.GetWorkflowAsync(item.ProposalKey, cancellationToken);
                    }
                    catch (InvalidOperationException)
                    {
                        workflow = null;
                    }
                }

                var activities = await repository.GetActivitiesAsync(item.CaseKey, cancellationToken);
                summaries.Add(ToCipSummary(item, workflow, activities, payloadByCase.GetValueOrDefault(item.CaseKey)));
            }

            return Results.Ok(summaries);
        });
        group.MapGet("/cases/{caseId}", async Task<IResult> (
            string caseId,
            ICipRepository repository,
            ITrackerLoaReadPort trackerLoa,
            IVendorOfficeAddressReadPort vendorAddresses,
            ITrackerAwardSnapshotReadPort snapshots,
            CancellationToken cancellationToken) => await GetCipCaseDetailAsync(caseId, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken));
        group.MapPost("/cases/{caseId}/verify", VerifyCipCaseAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/{caseId}/termsheet/generate", GenerateCipTermsheetAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/{caseId}/template/select", SelectCipTemplateAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/{caseId}/draft/render", RenderCipDraftAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/{caseId}/draft/generate", GenerateCipDraftAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/{caseId}/final-contract", RegisterCipFinalContractAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/{caseId}/transition", TransitionCipCaseAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/{caseId}/activities/{activityKey}/complete", CompleteCipActivityAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/{caseId}/recycle", RecycleCipStageAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        // Query-string variants: case keys and contract numbers can contain '/'.
        group.MapGet("/case-detail", GetCipCaseDetailAsync);
        group.MapPost("/cases/verify", VerifyCipCaseAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/termsheet/generate", GenerateCipTermsheetAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/template/select", SelectCipTemplateAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/draft/render", RenderCipDraftAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/draft/generate", GenerateCipDraftAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/final-contract", RegisterCipFinalContractAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/transition", TransitionCipCaseAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/activities/complete", CompleteCipActivityAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/cases/recycle", RecycleCipStageAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/templates/sample", GenerateCipTemplateSampleAsync);
        group.MapGet("/templates", ModuleWorkflowReadModels.CipTemplates);
        group.MapGet("/templates/merge-catalog", GetCipTemplateMergeCatalogAsync);
        group.MapPost("/templates/{templateKey}/sample", GenerateCipTemplateSampleAsync);
        group.MapGet("/repository", async Task<IResult> (
            ICipRepository repository,
            ITrackerLoaReadPort trackerLoa,
            CancellationToken cancellationToken) =>
        {
            var documents = await BuildRepositoryDocumentsAsync(repository, trackerLoa, caseKey: null, cancellationToken);
            return Results.Ok(documents);
        });
        group.MapGet("/authorization-master", ModuleWorkflowReadModels.CipAuthorizationMaster);
        group.MapPut("/authorization-master", () =>
            Results.Accepted("/api/v1/contract-initiation-platform/authorization-master", new { status = "authorization_master_update_accepted" }))
            .RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);
        group.MapPost("/tools/migrate-datauris", MigrateDataUrisAsync).RequireAnyPermission(PermissionKeys.ContractInitiationPlatformManage, PermissionKeys.ProposalTrackerManage);

        return endpoints;
    }

    private static async Task<IResult> MigrateDataUrisAsync(
        ModuleStateStore store,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        var cipState = await store.GetAsync(ModuleStateArea.ContractInitiationPlatform, "ag_cip_store_v7", cancellationToken);
        if (cipState is null || string.IsNullOrWhiteSpace(cipState.Value))
        {
            return Results.Ok(new { status = "no_data", count = 0 });
        }

        var rootNode = JsonNode.Parse(cipState.Value);
        if (rootNode is null) return Results.Ok(new { status = "parse_failed" });

        var casesNode = rootNode["cases"] as JsonArray;
        if (casesNode is null) return Results.Ok(new { status = "no_cases", count = 0 });

        var container = storage.ContainerForModule(CipModuleKey);
        await storage.EnsureContainerAsync(container, cancellationToken);
        int migratedDocs = 0;

        foreach (var c in casesNode)
        {
            if (c is JsonObject caseObj)
            {
                var caseId = caseObj["id"]?.ToString() ?? "unknown";

                async Task MigrateFieldAsync(string dataUriField, string docType, string prefix)
                {
                    if (caseObj[dataUriField] != null)
                    {
                        var dataUri = caseObj[dataUriField]!.ToString();
                        if (dataUri.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                        {
                            var commaIndex = dataUri.IndexOf(',');
                            if (commaIndex > 0)
                            {
                                var meta = dataUri.Substring(0, commaIndex);
                                var base64 = dataUri.Substring(commaIndex + 1);
                                var bytes = Convert.FromBase64String(base64);
                                var contentType = meta.Replace("data:", "").Replace(";base64", "");
                                if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

                                var ext = contentType.Contains("pdf") ? ".pdf" : contentType.Contains("openxml") ? ".docx" : ".bin";
                                var blobKey = $"cases/{BlobSafe(caseId)}/{docType}/{Guid.NewGuid():N}{ext}";

                                using var stream = new MemoryStream(bytes);
                                await storage.UploadAsync(container, blobKey, stream, contentType, cancellationToken);

                                caseObj.Remove(dataUriField);
                                caseObj[$"{prefix}Container"] = container;
                                caseObj[$"{prefix}BlobKey"] = blobKey;
                                
                                if (prefix == "finalContract")
                                {
                                    caseObj[$"{prefix}Size"] = bytes.Length;
                                }

                                migratedDocs++;
                            }
                        }
                    }
                }

                await MigrateFieldAsync("loaDataUri", "loa", "loa");
                await MigrateFieldAsync("termsheetDataUri", "termsheet", "termsheet");
                await MigrateFieldAsync("draftDataUri", "draft", "draft");
                await MigrateFieldAsync("finalContractDataUri", "final", "finalContract");
            }
        }

        if (migratedDocs > 0)
        {
            var newPayloadJson = rootNode.ToJsonString();
            await store.SetAsync(ModuleStateArea.ContractInitiationPlatform, "ag_cip_store_v7", newPayloadJson, cancellationToken);
        }

        return Results.Ok(new { status = "success", migratedDocs });
    }

    private static async Task<IResult> CreateCipCaseFromAwardResultAsync(
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        CipCaseService cipService,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CreateCaseFromAwardResultRequest>(request, cancellationToken);
        var proposalKey = Clean(body?.ProposalKey);
        if (proposalKey is null)
        {
            return Results.BadRequest(new { code = "proposal_key_required" });
        }

        var result = await cipService.CreateFromAwardResultAsync(proposalKey, body?.ActorName, Clean(body?.Type), cancellationToken);
        if (!result.AwardFound)
        {
            return Results.NotFound(new { code = "award_result_not_found" });
        }

        if (result.Created.Count > 0)
        {
            await auditService.WriteAuditAsync(httpContext, "Create", "CIP", $"Created {result.Created.Count} CIP case(s) from award result for {proposalKey}", cancellationToken);
            await notificationService.NotifyModuleAsync(
                CipModuleKey,
                CipModuleLabel,
                "info",
                $"{result.Created.Count} Term Sheet case(s) created",
                $"From the award result for proposal {proposalKey}.",
                "/proposal-tracker/workflow",
                cancellationToken);
        }

        return Results.Ok(new
        {
            proposalKey,
            created = result.Created.Select(item => new { item.CaseKey, item.VendorId, item.VendorName, item.Value, item.AwardPercent, item.Stage }).ToArray(),
            existing = result.Existing
        });
    }

    private sealed record CreateCaseFromAwardResultRequest(string? ProposalKey, string? ActorName, string? Type);

    private static async Task<IResult> VerifyCipCaseAsync(
        string caseId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        CipCaseService cipService,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CipActionRequest>(request, cancellationToken);
        var result = await cipService.VerifyAsync(caseId, body?.ActorName, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "cip_case_not_found" });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "CIP", $"Verified CIP case {result.Case!.CaseKey}", cancellationToken);
        return await GetCipCaseDetailAsync(result.Case.CaseKey, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken);
    }

    private static async Task<IResult> GenerateCipTermsheetAsync(
        string caseId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        CipCaseService cipService,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CipDocumentCommandRequest>(request, cancellationToken);
        var forbidden = ForbidUnlessTermsheetOfficer(httpContext);
        if (forbidden is not null)
        {
            return forbidden;
        }

        var result = await cipService.GenerateTermsheetAsync(
            caseId, body?.DocumentNumber, body?.FileName, ParseDateTimeOffset(body?.GeneratedAt), body?.Size, body?.Payload, body?.Container, body?.BlobKey, body?.ActorName, cancellationToken);
        if (!result.Found)
        {
            if (result.ErrorCode is not null)
            {
                return Results.BadRequest(new { code = result.ErrorCode });
            }

            return Results.NotFound(new { code = "cip_case_not_found" });
        }

        await auditService.WriteAuditAsync(httpContext, "Create", "CIP", $"Generated termsheet for CIP case {result.Case!.CaseKey}", cancellationToken);
        return await GetCipCaseDetailAsync(result.Case.CaseKey, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken);
    }

    private static async Task<IResult> SelectCipTemplateAsync(
        string caseId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        CipCaseService cipService,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<SelectCipTemplateRequest>(request, cancellationToken);
        var result = await cipService.SelectTemplateAsync(caseId, body?.TemplateCode, body?.ActorName, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "cip_case_not_found" });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "CIP", $"Selected template for CIP case {result.Case!.CaseKey}", cancellationToken);
        return await GetCipCaseDetailAsync(result.Case.CaseKey, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken);
    }

    private static async Task<IResult> GenerateCipDraftAsync(
        string caseId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        CipCaseService cipService,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CipDocumentCommandRequest>(request, cancellationToken);
        var result = await cipService.GenerateDraftAsync(
            caseId, body?.DocumentNumber, body?.FileName, ParseDateTimeOffset(body?.GeneratedAt), body?.Size, body?.Payload, body?.Container, body?.BlobKey, body?.ActorName, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "cip_case_not_found" });
        }

        await auditService.WriteAuditAsync(httpContext, "Create", "CIP", $"Generated draft contract for CIP case {result.Case!.CaseKey}", cancellationToken);
        return await GetCipCaseDetailAsync(result.Case.CaseKey, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken);
    }

    // Merge a token-annotated Word template (server-side) and store the resulting .docx in Blob.
    // The case record/state is still persisted by /draft/generate; this only produces the editable
    // contract document and returns its Blob reference so the caller can attach it to the case.
    private static async Task<IResult> RenderCipDraftAsync(
        string caseId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        IContractTemplateMerger templateMerger,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CipDraftRenderRequest>(request, cancellationToken);
        var templateKey = body?.TemplateKey?.Trim();
        if (string.IsNullOrWhiteSpace(templateKey) || !templateMerger.TemplateExists(templateKey))
        {
            return Results.BadRequest(new { code = "cip_template_unavailable", templateKey });
        }

        if (!storage.IsConfigured)
        {
            return Results.BadRequest(new { code = "blob_not_configured" });
        }

        var tokens = body!.Tokens is { Count: > 0 }
            ? body.Tokens.ToDictionary(kv => kv.Key, kv => kv.Value ?? string.Empty, StringComparer.Ordinal)
            : new Dictionary<string, string>(StringComparer.Ordinal);

        var merged = await templateMerger.MergeAsync(templateKey, tokens, cancellationToken);
        var container = storage.ContainerForModule(CipModuleKey);
        var blobKey = $"cases/{BlobSafe(caseId)}/draft/{templateKey}-{Guid.NewGuid():N}.docx";
        await using var stream = new MemoryStream(merged, writable: false);
        var upload = await storage.UploadAsync(container, blobKey, stream, DocxContentType, cancellationToken);

        await auditService.WriteAuditAsync(
            httpContext, "Create", "CIP",
            $"Rendered draft contract from template '{templateKey}' for CIP case {caseId}", cancellationToken);

        return Results.Ok(new
        {
            container = upload.Container,
            blobKey = upload.BlobKey,
            size = upload.Size,
            fileName = string.IsNullOrWhiteSpace(body.FileName) ? templateKey + ".docx" : body.FileName,
        });
    }

    // Review aid: list every annotated template plus the {{TOKEN}} set it carries, so the CIP team
    // can see merge coverage per template without opening each .docx.
    private static async Task<IResult> GetCipTemplateMergeCatalogAsync(
        IContractTemplateMerger templateMerger,
        CancellationToken cancellationToken)
    {
        var keys = templateMerger.ListTemplateKeys();
        var items = new List<object>(keys.Count);
        foreach (var key in keys)
        {
            var tokens = await templateMerger.TokensInTemplateAsync(key, cancellationToken);
            items.Add(new { templateKey = key, tokens });
        }

        return Results.Ok(items);
    }

    // Review aid: merge a template with canned sample data and stream the result so a reviewer can
    // see how the filled contract reads. format=pdf converts for in-app preview; default is .docx.
    // Nothing is persisted.
    private static async Task<IResult> GenerateCipTemplateSampleAsync(
        string templateKey,
        string? format,
        IContractTemplateMerger templateMerger,
        IDocumentPdfConverter pdfConverter,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(templateKey) || !templateMerger.TemplateExists(templateKey))
        {
            return Results.NotFound(new { code = "cip_template_unavailable", templateKey });
        }

        var bytes = await templateMerger.MergeAsync(templateKey, SampleTokens, cancellationToken);

        if (string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
        {
            if (!pdfConverter.IsAvailable)
            {
                return Results.Json(new { code = "pdf_unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var pdf = await pdfConverter.ConvertDocxToPdfAsync(bytes, cancellationToken);
            return pdf is null
                ? Results.Json(new { code = "pdf_conversion_failed" }, statusCode: StatusCodes.Status503ServiceUnavailable)
                : Results.File(pdf, "application/pdf");  // inline (no download name) for iframe preview
        }

        return Results.File(bytes, DocxContentType, templateKey + "-SAMPLE.docx");
    }

    // Canned, obviously-fake sample values covering the full builder token set.
    private static readonly Dictionary<string, string> SampleTokens = new(StringComparer.Ordinal)
    {
        ["NOMOR_KONTRAK"] = "CTR/CONTOH-001/VI/2026",
        ["OBJEK_JASA"] = "Pekerjaan Contoh untuk Review",
        ["TGL_TTD"] = "1 Juli 2026",
        ["TGL_MULAI"] = "1 Januari 2026",
        ["TGL_SELESAI"] = "31 Desember 2026",
        ["LOKASI_JASA"] = "Jobsite Contoh",
        ["ENTITAS_SIS"] = "Saptaindra Sejati",
        ["DOMISILI_PIHAK1"] = "Jakarta Selatan",
        ["NAMA_TTD_PIHAK1"] = "Nama Penandatangan SIS 1",
        ["JABATAN_TTD_PIHAK1"] = "Direktur Utama",
        ["NAMA_TTD_PIHAK1_2"] = "Nama Penandatangan SIS 2",
        ["JABATAN_TTD_PIHAK1_2"] = "Direktur",
        ["NAMA_VENDOR"] = "PT VENDOR CONTOH",
        ["DOMISILI_VENDOR"] = "Jakarta Pusat",
        ["NAMA_TTD_VENDOR"] = "Nama Penandatangan Vendor",
        ["JABATAN_TTD_VENDOR"] = "Direktur",
    };

    // Keep only characters that are safe in a Blob path segment; collapse anything else to '-'.
    private static string BlobSafe(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "unknown";
        }

        var chars = value.Select(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '-').ToArray();
        return new string(chars);
    }

    private static async Task<IResult> RegisterCipFinalContractAsync(
        string caseId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        CipCaseService cipService,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CipDocumentCommandRequest>(request, cancellationToken);
        var result = await cipService.RegisterFinalContractAsync(
            caseId, body?.DocumentNumber, body?.FileName, ParseDateTimeOffset(body?.GeneratedAt), body?.Size, body?.Payload, body?.Container, body?.BlobKey, body?.ActorName, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "cip_case_not_found" });
        }

        var cipCase = result.Case!;
        await auditService.WriteAuditAsync(httpContext, "Create", "CIP", $"Registered final contract for CIP case {cipCase.CaseKey}", cancellationToken);
        await notificationService.NotifyModuleAsync(
            CipModuleKey,
            CipModuleLabel,
            "success",
            $"Contract registered for {cipCase.CaseKey}",
            $"Final executed contract {cipCase.ContractNumber} registered for {cipCase.VendorName}.",
            $"/proposal-tracker/workflow?case={Uri.EscapeDataString(cipCase.CaseKey)}",
            cancellationToken);
        return await GetCipCaseDetailAsync(cipCase.CaseKey, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken);
    }

    private static async Task<IResult> TransitionCipCaseAsync(
        string caseId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        CipCaseService cipService,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CipTransitionRequest>(request, cancellationToken);
        var result = await cipService.TransitionAsync(
            caseId, body?.FromStage, body?.ToStage, ParseDateTimeOffset(body?.OccurredAt), body?.ActorName, body?.Remark, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "cip_case_not_found" });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "CIP",
            $"Transitioned CIP case {result.Case!.CaseKey} to stage {result.Case.Stage}", cancellationToken);
        return await GetCipCaseDetailAsync(result.Case.CaseKey, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken);
    }

    private static async Task<IResult> CompleteCipActivityAsync(
        string caseId,
        string activityKey,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        CipCaseService cipService,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CipCompleteActivityRequest>(request, cancellationToken);
        if (string.Equals(activityKey, "termsheet", StringComparison.OrdinalIgnoreCase))
        {
            var forbidden = ForbidUnlessTermsheetOfficer(httpContext);
            if (forbidden is not null)
            {
                return forbidden;
            }
        }

        var result = await cipService.CompleteActivityAsync(
            caseId, activityKey, ParseDateTimeOffset(body?.CompletedAt), body?.ActorName, body?.Remark, cancellationToken);
        if (!result.Found)
        {
            if (result.Case is not null && result.ErrorCode is not null)
            {
                return Results.BadRequest(new { code = result.ErrorCode });
            }
            return Results.NotFound(new { code = "cip_case_or_activity_not_found" });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "CIP",
            $"Completed {activityKey} activity for CIP case {result.Case!.CaseKey}", cancellationToken);
        return await GetCipCaseDetailAsync(result.Case.CaseKey, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken);
    }

    private static async Task<IResult> RecycleCipStageAsync(
        string caseId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        CipCaseService cipService,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<CipRecycleRequest>(request, cancellationToken);
        var result = await cipService.RecycleAsync(caseId, body?.StageKey, body?.Reason, body?.ActorName, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "cip_case_not_found" });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "CIP", $"Recycled CIP case {result.Case!.CaseKey} to stage {result.Case.Stage}", cancellationToken);
        return await GetCipCaseDetailAsync(result.Case.CaseKey, repository, trackerLoa, vendorAddresses, snapshots, cancellationToken);
    }

    private static IResult? ForbidUnlessTermsheetOfficer(HttpContext httpContext)
    {
        var roles = httpContext.User.FindAll(ClaimTypes.Role).Select(claim => claim.Value);
        var allowed = roles.Any(role =>
            string.Equals(role, "Super Admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "Officer Proposal Tracker", StringComparison.OrdinalIgnoreCase));
        return allowed
            ? null
            : Results.Json(new { code = "officer_only" }, statusCode: StatusCodes.Status403Forbidden);
    }

    private static async Task<IResult> GetCipCaseDetailAsync(
        string caseId,
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var cipCase = await repository.GetCaseAsync(caseId, tracking: false, cancellationToken);
        if (cipCase is null)
        {
            var fallback = ModuleWorkflowReadModels.CipCaseDetail(caseId);
            return fallback is null
                ? Results.NotFound(new { code = "cip_case_not_found" })
                : Results.Ok(fallback);
        }

        var payloadByCase = await EnrichCasePayloadsAsync([cipCase], vendorAddresses, snapshots, cancellationToken);
        var documents = await BuildRepositoryDocumentsAsync(repository, trackerLoa, caseId, cancellationToken);
        var activities = (await repository.GetActivitiesAsync(caseId, cancellationToken))
            .Select(ToActivityItem)
            .ToArray();

        return Results.Ok(new CipCaseDomainDetail(
            ToCipSummary(cipCase, payloadJson: payloadByCase.GetValueOrDefault(cipCase.CaseKey)),
            documents,
            activities));
    }

    /// <summary>
    /// CIP case documents plus Tracker LOA rows projected as supporting <c>loa</c> documents for matching cases
    /// (linkage key = <c>{proposalKey}-{vendorId}</c> ↔ <see cref="CipCase.LoaKey"/>). Read-only; does not copy LOA rows.
    /// </summary>
    private static async Task<IReadOnlyList<CipCaseDocumentDomainItem>> BuildRepositoryDocumentsAsync(
        ICipRepository repository,
        ITrackerLoaReadPort trackerLoa,
        string? caseKey,
        CancellationToken cancellationToken)
    {
        var cases = await repository.ListCasesAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(caseKey))
        {
            cases = cases.Where(item => string.Equals(item.CaseKey, caseKey, StringComparison.OrdinalIgnoreCase)).ToArray();
        }

        var stored = string.IsNullOrWhiteSpace(caseKey)
            ? await repository.ListAllDocumentsAsync(cancellationToken)
            : await repository.GetDocumentsAsync(caseKey, cancellationToken);
        var result = stored.Select(ToDocumentItem).ToList();

        var casesWithLoa = result
            .Where(item => string.Equals(item.DocumentType, "loa", StringComparison.OrdinalIgnoreCase))
            .Select(item => item.CaseKey)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var caseByLoaKey = cases
            .Where(item => !string.IsNullOrWhiteSpace(item.LoaKey))
            .GroupBy(item => item.LoaKey!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var loa in await trackerLoa.ListLoaDocumentsAsync(cancellationToken))
        {
            var linkageKey = $"{loa.ProposalKey}-{loa.VendorId}";
            if (!caseByLoaKey.TryGetValue(linkageKey, out var cipCase))
            {
                continue;
            }

            if (casesWithLoa.Contains(cipCase.CaseKey))
            {
                continue;
            }

            var (container, blobKey) = ParseLoaBlobRefs(loa.PayloadJson);
            result.Add(new CipCaseDocumentDomainItem(
                cipCase.CaseKey,
                $"{cipCase.CaseKey}:loa:{loa.ActivityKey}:{loa.VendorId}",
                "loa",
                loa.FileName,
                loa.GeneratedAt,
                0,
                blobKey is not null,
                container,
                blobKey,
                string.IsNullOrWhiteSpace(loa.PayloadJson) ? "{}" : loa.PayloadJson));
            casesWithLoa.Add(cipCase.CaseKey);
        }

        return result;
    }

    private static (string? Container, string? BlobKey) ParseLoaBlobRefs(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return (null, null);
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            var root = document.RootElement;
            return (ReadJsonString(root, "container", "Container"), ReadJsonString(root, "blobKey", "BlobKey"));
        }
        catch (JsonException)
        {
            return (null, null);
        }
    }

    private static string? ReadJsonString(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
            {
                var text = value.GetString();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    return text.Trim();
                }
            }
        }

        return null;
    }

    private static CipCaseDocumentDomainItem ToDocumentItem(CipCaseDocument item) =>
        new(
            item.CaseKey,
            item.DocumentKey,
            item.DocumentType,
            item.FileName,
            item.GeneratedAt,
            item.Size,
            item.DataUri != null || item.BlobKey != null,
            item.Container,
            item.BlobKey,
            item.PayloadJson);

    private static CipCaseActivityDomainItem ToActivityItem(CipCaseActivity item) =>
        new(
            item.CaseKey,
            item.ActivityKey,
            item.ActivityType,
            item.StageKey,
            item.OccurredAt,
            item.ActorName,
            item.Message);

    /// <summary>
    /// Live-enrich CIP award payloads: vendor office address from Vendor Onboarding, award-step documents
    /// from Tracker. Does not persist; GET stays the composition root so CIP never queries vdr/trk tables.
    /// </summary>
    private static async Task<Dictionary<string, string>> EnrichCasePayloadsAsync(
        IReadOnlyCollection<CipCase> cases,
        IVendorOfficeAddressReadPort vendorAddresses,
        ITrackerAwardSnapshotReadPort snapshots,
        CancellationToken cancellationToken)
    {
        var payloadByCase = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (cases.Count == 0)
        {
            return payloadByCase;
        }

        var addressLookups = cases
            .Select(item => new VendorOfficeAddressLookup(item.VendorId, item.VendorName))
            .ToArray();
        var addresses = await vendorAddresses.ResolveAsync(addressLookups, cancellationToken);

        var snapshotQueries = cases
            .Where(item => !string.IsNullOrWhiteSpace(item.ProposalKey) && !string.IsNullOrWhiteSpace(item.VendorId))
            .Select(item => new TrackerAwardSnapshotQuery(
                item.ProposalKey!,
                item.VendorId!,
                AwardSourceFromCase(item)))
            .ToArray();
        var snapshotViews = snapshotQueries.Length == 0
            ? new Dictionary<string, TrackerAwardSnapshotView>(StringComparer.OrdinalIgnoreCase)
            : await snapshots.GetAsync(snapshotQueries, cancellationToken);

        foreach (var item in cases)
        {
            string? officeAddress = null;
            if (!string.IsNullOrWhiteSpace(item.VendorId))
            {
                addresses.TryGetValue(item.VendorId, out officeAddress);
            }

            if (string.IsNullOrWhiteSpace(officeAddress) && !string.IsNullOrWhiteSpace(item.VendorName))
            {
                addresses.TryGetValue(item.VendorName, out officeAddress);
            }

            TrackerAwardSnapshotView? snapshot = null;
            if (!string.IsNullOrWhiteSpace(item.ProposalKey) && !string.IsNullOrWhiteSpace(item.VendorId))
            {
                snapshotViews.TryGetValue($"{item.ProposalKey}|{item.VendorId}", out snapshot);
            }

            payloadByCase[item.CaseKey] = MergeAwardSnapshotIntoPayload(item.PayloadJson, officeAddress, snapshot);
        }

        return payloadByCase;
    }

    private static string? AwardSourceFromCase(CipCase item)
    {
        var source = item.Source;
        if (!string.IsNullOrWhiteSpace(source)
            && source.StartsWith("tracker-", StringComparison.OrdinalIgnoreCase))
        {
            source = source["tracker-".Length..];
        }

        if (string.IsNullOrWhiteSpace(item.PayloadJson))
        {
            return source;
        }

        try
        {
            using var document = JsonDocument.Parse(item.PayloadJson);
            if (document.RootElement.ValueKind == JsonValueKind.Object
                && (document.RootElement.TryGetProperty("source", out var property)
                    || document.RootElement.TryGetProperty("Source", out property))
                && property.ValueKind == JsonValueKind.String)
            {
                var fromPayload = property.GetString();
                if (!string.IsNullOrWhiteSpace(fromPayload))
                {
                    return fromPayload;
                }
            }
        }
        catch (JsonException)
        {
            // Keep the case-level source when the payload is not JSON.
        }

        return source;
    }

    private static string MergeAwardSnapshotIntoPayload(
        string? payloadJson,
        string? vendorAddress,
        TrackerAwardSnapshotView? snapshot)
    {
        JsonObject node;
        try
        {
            node = string.IsNullOrWhiteSpace(payloadJson)
                ? new JsonObject()
                : JsonNode.Parse(payloadJson) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            node = new JsonObject();
        }

        if (!string.IsNullOrWhiteSpace(vendorAddress))
        {
            node["vendorAddress"] = vendorAddress;
        }

        if (snapshot?.AwardSourceDocument is { } awardSource)
        {
            node["awardSourceDocument"] = SnapshotDocumentNode(awardSource);
        }

        if (snapshot?.WinnerBidDocument is { } winnerBid)
        {
            node["winnerBidDocument"] = SnapshotDocumentNode(winnerBid);
        }

        return node.ToJsonString(JsonOptions);
    }

    private static JsonObject SnapshotDocumentNode(TrackerAwardSnapshotDocument document) =>
        new()
        {
            ["title"] = document.Title,
            ["fileName"] = document.FileName,
            ["blobKey"] = document.BlobKey,
            ["container"] = document.Container,
        };

    private static CipCaseDomainSummary ToCipSummary(
        CipCase item,
        TrackerWorkflowView? workflow = null,
        IReadOnlyCollection<CipCaseActivity>? activities = null,
        string? payloadJson = null) =>
        new(
            item.CaseKey,
            item.LoaKey,
            item.LoaNumber,
            item.Title,
            item.VendorId,
            item.VendorName,
            item.Jobsite,
            item.Department,
            item.Value,
            item.ProposalTotalValue,
            item.AwardPercent,
            item.Stage,
            item.Status,
            item.Template,
            item.Requestor,
            item.Procurement,
            item.Legal,
            item.CreatedAtDate,
            item.Source,
            item.ProposalKey,
            item.ProposalNumber,
            item.TermsheetNumber,
            item.ContractNumber,
            payloadJson ?? item.PayloadJson,
            workflow?.RequirementDate,
            workflow?.EstimatedDate,
            ToTrackerDateSnapshot(workflow?.Termsheet),
            ToTrackerDateSnapshot(workflow?.Contract),
            CompletionDate(activities, "termsheet"),
            CompletionDate(activities, "contract"));

    private static TrackerDateDomainSnapshot? ToTrackerDateSnapshot(TrackerWorkflowActivityView? activity) => activity is null
        ? null
        : new TrackerDateDomainSnapshot(activity.Plan, activity.Actual, activity.Status, activity.Title);

    private static DateTimeOffset? CompletionDate(IReadOnlyCollection<CipCaseActivity>? activities, string stageKey) =>
        activities?
            .Where(item => item.ActivityType == "Completed" && item.StageKey == stageKey)
            .OrderByDescending(item => item.OccurredAt)
            .Select(item => item.OccurredAt)
            .FirstOrDefault();

    private static async Task<T?> ReadJsonBodyAsync<T>(HttpRequest request, CancellationToken cancellationToken)
    {
        if (request.ContentLength is null or 0)
        {
            return default;
        }

        return await JsonSerializer.DeserializeAsync<T>(request.Body, JsonOptions, cancellationToken);
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private sealed record CipActionRequest(string? ActorName, string? Remark);

    private sealed record CipDocumentCommandRequest(
        string? DocumentNumber,
        string? FileName,
        string? GeneratedAt,
        long? Size,
        string? DataUri,
        string? Container,
        string? BlobKey,
        string? ActorName,
        JsonElement? Payload);

    private sealed record CipDraftRenderRequest(
        string? TemplateKey,
        string? FileName,
        Dictionary<string, string>? Tokens);

    private sealed record SelectCipTemplateRequest(string? TemplateCode, string? ActorName);

    private sealed record CipRecycleRequest(string? StageKey, string? Reason, string? ActorName);

    private sealed record CipTransitionRequest(
        string? FromStage,
        string? ToStage,
        string? OccurredAt,
        string? ActorName,
        string? Remark);

    private sealed record CipCompleteActivityRequest(string? CompletedAt, string? ActorName, string? Remark);
}

internal sealed record CipCaseDomainSummary(
    string CaseKey,
    string? LoaKey,
    string? LoaNumber,
    string Title,
    string? VendorId,
    string? VendorName,
    string? Jobsite,
    string? Department,
    decimal Value,
    decimal ProposalTotalValue,
    decimal AwardPercent,
    string Stage,
    string Status,
    string? Template,
    string? Requestor,
    string? Procurement,
    string? Legal,
    DateOnly? CreatedAtDate,
    string? Source,
    string? ProposalKey,
    string? ProposalNumber,
    string? TermsheetNumber,
    string? ContractNumber,
    string PayloadJson,
    DateOnly? RequirementDate,
    DateOnly? EstimatedFinishDate,
    TrackerDateDomainSnapshot? TermsheetTrackerDate,
    TrackerDateDomainSnapshot? ContractTrackerDate,
    DateTimeOffset? TermsheetActivityCompletedAt,
    DateTimeOffset? ContractActivityCompletedAt);

internal sealed record TrackerDateDomainSnapshot(
    DateOnly? Plan,
    DateTimeOffset? Actual,
    string Status,
    string Title);

internal sealed record CipCaseDocumentDomainItem(
    string CaseKey,
    string DocumentKey,
    string DocumentType,
    string FileName,
    DateTimeOffset? GeneratedAt,
    long Size,
    bool HasDataUri,
    string? Container,
    string? BlobKey,
    string PayloadJson);

internal sealed record CipCaseActivityDomainItem(
    string CaseKey,
    string ActivityKey,
    string ActivityType,
    string StageKey,
    DateTimeOffset? OccurredAt,
    string? ActorName,
    string? Message);

internal sealed record CipCaseDomainDetail(
    CipCaseDomainSummary Case,
    IReadOnlyCollection<CipCaseDocumentDomainItem> Documents,
    IReadOnlyCollection<CipCaseActivityDomainItem> Activities);
