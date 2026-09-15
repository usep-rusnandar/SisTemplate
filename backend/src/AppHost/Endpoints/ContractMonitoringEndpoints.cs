namespace IntegratedProcurement.AppHost.Api.Endpoints;

using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.AppHost.Api.ReadModels;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Modules.ContractMonitoring.Application;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Notifications.Application;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.ModuleState;
using System.Globalization;
using System.Text.Json;

public static class ContractMonitoringEndpoints
{
    private const string ContractModuleKey = "contractMonitoring";
    private const string ContractModuleLabel = "Contract Monitoring";

    public static IEndpointRouteBuilder MapContractMonitoringEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/contract-monitoring")
            .WithTags("Contract Monitoring")
            .RequireAuthorization(AuthorizationPolicies.InternalUser)
            .RequirePermission("contractMonitoring.view");

        group.MapModuleStorageEndpoints(ModuleStateArea.ContractMonitoring);

        group.MapGet("/dashboard", async (IContractRepository repository, CancellationToken cancellationToken) =>
        {
            var contracts = await repository.ListAsync(null, cancellationToken);
            if (contracts.Count == 0)
            {
                return Results.Ok(ModuleWorkflowReadModels.ContractDashboard());
            }

            return Results.Ok(new ContractDashboardDomainResult(
                "Contract Monitoring",
                [
                    new("Contracts", contracts.Count.ToString("N0", CultureInfo.InvariantCulture), "Register aktif"),
                    new("Active", contracts.Count(item => item.Status == "Active").ToString("N0", CultureInfo.InvariantCulture), "Kontrak berjalan"),
                    new("Expiring soon", contracts.Count(item => item.Status == "Expiring").ToString("N0", CultureInfo.InvariantCulture), "Perlu tindak lanjut"),
                    new("Total value", $"Rp {(contracts.Sum(item => item.ContractValue) / 1_000_000_000m):N1}B", "Nilai kontrak terpantau")
                ]));
        });

        group.MapGet("/", async (IContractRepository repository, CancellationToken cancellationToken) =>
        {
            var contracts = await GetContractSummariesAsync(repository, cancellationToken);
            return Results.Ok(contracts);
        });

        group.MapGet("/expiry", async (IContractRepository repository, CancellationToken cancellationToken) =>
        {
            var contracts = await GetContractSummariesAsync(repository, cancellationToken, "Expiring");
            return Results.Ok(contracts);
        });

        group.MapGet("/reminders", async (IContractRepository repository, CancellationToken cancellationToken) =>
        {
            var reminders = await repository.GetRemindersAsync(null, cancellationToken);
            return Results.Ok(reminders.Select(ToReminderItem).ToArray());
        });
        group.MapGet("/documents/resolve", ResolveContractDocumentGetAsync);
        group.MapPost("/documents/resolve", ResolveContractDocumentPostAsync);

        // Background document-migration jobs (Import Center).
        group.MapGet("/imports", ListImportJobsAsync);
        group.MapGet("/imports/{jobId:guid}", GetImportJobAsync);
        group.MapGet("/imports/{jobId:guid}/stream", StreamImportJobAsync);
        group.MapPost("/imports", CreateImportJobAsync).RequirePermission("contractMonitoring.manage");
        group.MapPost("/imports/{jobId:guid}/retry", RetryImportJobAsync).RequirePermission("contractMonitoring.manage");
        group.MapPost("/imports/{jobId:guid}/rows/{rowId:guid}/retry", RetryImportRowAsync).RequirePermission("contractMonitoring.manage");
        group.MapPost("/imports/{jobId:guid}/pause", (Guid jobId, ImportJobService svc, ImportJobSignal signal, CancellationToken ct) => SetImportJobPausedAsync(jobId, true, svc, signal, ct)).RequirePermission("contractMonitoring.manage");
        group.MapPost("/imports/{jobId:guid}/resume", (Guid jobId, ImportJobService svc, ImportJobSignal signal, CancellationToken ct) => SetImportJobPausedAsync(jobId, false, svc, signal, ct)).RequirePermission("contractMonitoring.manage");

        // List of Material — contract keys contain '/', so identify by query/body (not path segments).
        group.MapGet("/materials", ListMaterialsAsync);
        group.MapGet("/materials/summary", GetMaterialSummaryAsync);
        group.MapGet("/materials/template", () =>
            Results.File(
                ContractMaterialTemplate.Create(),
                ContractMaterialTemplate.ContentType,
                ContractMaterialTemplate.FileName));
        group.MapPost("/materials/upload", UploadMaterialsAsync).RequirePermission("contractMonitoring.manage");
        group.MapPost("/materials/sync-folder", SyncMaterialFolderAsync).RequirePermission("contractMonitoring.manage");

        // Query-string first: contract numbers contain '/' (e.g. CTR/CIP-2026-001/VI/2026).
        group.MapGet("/contract-detail", GetContractDetailAsync);
        group.MapPost("/reminders/send", SendContractReminderAsync).RequirePermission("contractMonitoring.manage");
        group.MapGet("/{contractId}", GetContractDetailAsync);
        // Contract create + versioning are handled through the Import → KV → domain projection path
        // (ModuleStateStore), not dedicated endpoints. The former POST "/" and POST "/{id}/versions"
        // were unused stubs that persisted nothing and have been removed.
        group.MapPost("/{contractId}/reminders/send", SendContractReminderAsync).RequirePermission("contractMonitoring.manage");
        // Body-based reminder send: the caller supplies the contract details it is reminding about, so
        // this works regardless of whether the contract key is URL-safe (contract numbers contain "/")
        // or present in the domain. Always sends + records the email to core.EMAIL_SENT_T (category
        // "Contract Monitoring") so every reminder shows up on the Reminder Sent page.
        group.MapPost("/reminders/send-email", SendReminderEmailAsync).RequirePermission("contractMonitoring.manage");
        group.MapPost("/reminders/run-scan", RunContractReminderScanAsync).RequirePermission("contractMonitoring.manage");

        group.MapGet("/email-templates", GetContractMonitoringEmailTemplatesAsync)
            .RequireAnyPermission(PermissionKeys.EmailTemplatesView, PermissionKeys.MasterDataContractMonitoringManage);
        group.MapPut("/email-templates", PutContractMonitoringEmailTemplatesAsync)
            .RequireAnyPermission(PermissionKeys.EmailTemplatesManage, PermissionKeys.MasterDataContractMonitoringManage);

        return endpoints;
    }

    private static async Task<IResult> GetContractMonitoringEmailTemplatesAsync(
        IAdminConsoleCommunicationService communicationService,
        CancellationToken cancellationToken)
    {
        var result = await communicationService.GetEmailTemplatesByCategoryAsync(
            EmailTemplateCategoryMerge.ContractMonitoringCategory,
            cancellationToken);
        return Results.Ok(new JsonCollectionResponse<JsonElement>(result.Items, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> PutContractMonitoringEmailTemplatesAsync(
        JsonCollectionUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleCommunicationService communicationService,
        IAdminConsoleAuditService auditService,
        ProcurementDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (request.Items is null)
        {
            return Results.BadRequest(new { code = "items_required" });
        }

        var items = request.Items
            .Where(item => item.ValueKind == JsonValueKind.Object)
            .Select(item => new KeyedJsonItem(
                item.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                item.GetRawText()))
            .ToArray();

        var now = DateTimeOffset.UtcNow;
        await communicationService.ReplaceEmailTemplatesForCategoryAsync(
            EmailTemplateCategoryMerge.ContractMonitoringCategory,
            items,
            now,
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.WriteAuditAsync(
            httpContext,
            "Update",
            "Contract Monitoring",
            "Replaced Contract Monitoring email templates",
            cancellationToken);

        return await GetContractMonitoringEmailTemplatesAsync(communicationService, cancellationToken);
    }

    private static async Task<IResult> SendContractReminderAsync(
        string contractId,
        HttpRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        ContractReminderService reminderService,
        IContractReminderMailer mailer,
        IContractRepository repository,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<SendContractReminderRequest>(request, cancellationToken);
        var result = await reminderService.SendAsync(contractId, body?.Trigger, body?.Force ?? true, cancellationToken);
        if (!result.ContractFound)
        {
            return Results.NotFound(new { code = "contract_not_found" });
        }

        if (!result.Sent)
        {
            return Results.Ok(new ContractReminderCommandResult(false, result.Tier, result.Escalated, result.Reason));
        }

        var contract = result.Contract!;
        await auditService.WriteAuditAsync(httpContext, "Create", "Contract Monitoring", $"Sent reminder for contract {contract.ContractKey}", cancellationToken);
        await notificationService.NotifyModuleAsync(
            ContractModuleKey,
            ContractModuleLabel,
            result.Escalated ? "warning" : "info",
            $"Reminder sent for {contract.ContractKey}",
            $"{contract.Title} expires in {contract.DaysToExpiry} day(s) ({contract.SupplierName}).",
            $"/contract-monitoring/database?case={Uri.EscapeDataString(contract.ContractKey)}",
            cancellationToken);
        await mailer.SendExpiryReminderAsync(
            contract.PicEmail,
            contract.PicNames,
            contract.ContractKey,
            contract.Title,
            FormatExpiry(contract.CurrentExpiryDate),
            contract.DaysToExpiry,
            cancellationToken);
        return await GetContractDetailAsync(contract.ContractKey, repository, cancellationToken);
    }

    private static async Task<IResult> SendReminderEmailAsync(
        SendReminderEmailRequest? body,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        ContractReminderService reminderService,
        IContractReminderMailer mailer,
        CancellationToken cancellationToken)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.ContractNo))
        {
            return Results.BadRequest(new { code = "contract_no_required" });
        }

        var recipient = FirstEmail(body.PicEmail) ?? FirstEmail(body.PicNames);
        if (string.IsNullOrWhiteSpace(recipient))
        {
            return Results.BadRequest(new { code = "recipient_required", message = "No PIC email address to send the reminder to." });
        }

        var days = body.DaysToExpiry ?? 0;
        var escalated = body.Escalated ?? days <= 30;
        var delivered = await mailer.SendExpiryReminderAsync(
            body.PicEmail,
            body.PicNames,
            body.ContractNo,
            body.Title,
            body.ExpiryDate,
            days,
            cancellationToken);

        // Best-effort: also persist a domain reminder record for contracts that exist (feeds GET /reminders).
        // Never blocks the email — the lookup is by key at the service layer, so contract numbers with "/" are fine.
        try
        {
            await reminderService.SendAsync(body.ContractNo, body.Trigger ?? "Manual", true, cancellationToken);
        }
        catch
        {
            // history is optional; the email + EMAIL_SENT_T record is the source of truth for Reminder Sent.
        }

        await auditService.WriteAuditAsync(httpContext, "Create", ContractModuleLabel, $"Sent expiry reminder for {body.ContractNo} to {recipient}", cancellationToken);
        await notificationService.NotifyModuleAsync(
            ContractModuleKey,
            ContractModuleLabel,
            escalated ? "warning" : "info",
            $"Reminder sent for {body.ContractNo}",
            $"{body.Title} expires in {days} day(s) ({body.Supplier}).",
            "/contract-monitoring/reminders",
            cancellationToken);

        return Results.Ok(new { delivered, to = recipient, escalated });
    }

    private static string? FirstEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        foreach (var token in value.Split([',', ';', '\n', '\r', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (token.Contains('@', StringComparison.Ordinal))
            {
                return token;
            }
        }

        return null;
    }

    private static string? FormatExpiry(DateOnly? date) =>
        date?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static async Task<IResult> RunContractReminderScanAsync(
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        ContractReminderService reminderService,
        IContractReminderMailer mailer,
        CancellationToken cancellationToken)
    {
        var summary = await reminderService.RunScanAsync(cancellationToken);

        // Email each reminder the scan recorded, rendered from the tier template (same as manual sends).
        foreach (var item in summary.Items)
        {
            var c = item.Contract;
            await mailer.SendExpiryReminderAsync(
                c.PicEmail,
                c.PicNames,
                c.ContractKey,
                c.Title,
                FormatExpiry(c.CurrentExpiryDate),
                c.DaysToExpiry,
                cancellationToken);
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Contract Monitoring", $"Scanned reminders: {summary.Sent} sent, {summary.Skipped} skipped", cancellationToken);
        if (summary.Sent > 0)
        {
            await notificationService.NotifyModuleAsync(
                ContractModuleKey,
                ContractModuleLabel,
                summary.Escalated > 0 ? "warning" : "info",
                $"Reminder scan sent {summary.Sent} reminder(s)",
                $"Scanned {summary.Scanned} expiring contract(s): {summary.Sent} sent, {summary.Escalated} escalated, {summary.Skipped} skipped.",
                "/contract-monitoring/reminders",
                cancellationToken);
        }

        return Results.Ok(new ContractReminderScanResult(summary.Scanned, summary.Sent, summary.Escalated, summary.Skipped));
    }

    private static async Task<IResult> CreateImportJobAsync(
        CreateImportJobRequest? body,
        HttpContext httpContext,
        ICurrentActor currentActor,
        IAdminConsoleAuditService auditService,
        ImportJobService jobService,
        ImportJobSignal signal,
        CancellationToken cancellationToken)
    {
        if (body?.Rows is null || body.Rows.Count == 0)
        {
            return Results.BadRequest(new { code = "no_rows" });
        }

        var rows = body.Rows
            .Select((r, i) => new NewImportRow(
                r.RowIndex ?? i + 1,
                r.ContractId ?? string.Empty,
                r.Title ?? string.Empty,
                r.Supplier ?? string.Empty,
                r.Link))
            .ToList();

        var job = await jobService.CreateAsync(
            string.IsNullOrWhiteSpace(body.FileName) ? "contract-export.xlsx" : body.FileName,
            currentActor.Actor.ActorId,
            currentActor.Actor.DisplayName,
            rows,
            cancellationToken);

        await auditService.WriteAuditAsync(httpContext, "Import", "Contract Monitoring",
            $"Started document migration {job.BatchCode}: {job.TotalRows} row(s) from {job.FileName}", cancellationToken);
        signal.Notify(); // wake the background runner
        return Results.Accepted($"/api/v1/contract-monitoring/imports/{job.Id}", ToJobSummary(job));
    }

    private static async Task<IResult> ListImportJobsAsync(ImportJobService jobService, CancellationToken cancellationToken)
    {
        var jobs = await jobService.ListAsync(cancellationToken);
        return Results.Ok(jobs.Select(ToJobSummary).ToArray());
    }

    private static async Task<IResult> GetImportJobAsync(Guid jobId, ImportJobService jobService, CancellationToken cancellationToken)
    {
        var detail = await jobService.GetDetailAsync(jobId, cancellationToken);
        return detail is null
            ? Results.NotFound(new { code = "import_job_not_found" })
            : Results.Ok(new ImportJobDetailResult(ToJobSummary(detail.Job), detail.Rows.Select(ToRowItem).ToArray()));
    }

    private static async Task<IResult> RetryImportJobAsync(Guid jobId, ImportJobService jobService, ImportJobSignal signal, CancellationToken cancellationToken)
    {
        var job = await jobService.RetryFailedAsync(jobId, cancellationToken);
        if (job is null)
        {
            return Results.NotFound(new { code = "import_job_not_found" });
        }

        signal.Notify();
        return Results.Ok(ToJobSummary(job));
    }

    private static async Task<IResult> SetImportJobPausedAsync(Guid jobId, bool paused, ImportJobService jobService, ImportJobSignal signal, CancellationToken cancellationToken)
    {
        var job = await jobService.SetPausedAsync(jobId, paused, cancellationToken);
        if (job is null)
        {
            return Results.NotFound(new { code = "import_job_not_found" });
        }

        if (!paused)
        {
            signal.Notify(); // resumed — wake the runner
        }

        return Results.Ok(ToJobSummary(job));
    }

    private static async Task<IResult> RetryImportRowAsync(Guid jobId, Guid rowId, ImportJobService jobService, ImportJobSignal signal, CancellationToken cancellationToken)
    {
        var job = await jobService.RetryRowAsync(jobId, rowId, cancellationToken);
        if (job is null)
        {
            return Results.NotFound(new { code = "import_job_not_found" });
        }

        signal.Notify();
        return Results.Ok(ToJobSummary(job));
    }

    private static async Task StreamImportJobAsync(
        Guid jobId,
        HttpContext httpContext,
        IServiceScopeFactory scopeFactory,
        CancellationToken cancellationToken)
    {
        // Server-Sent Events: push the job's status while the client (Import Center page) is connected,
        // then stop when the job finishes or the client disconnects. No connection = no DB reads.
        var response = httpContext.Response;
        response.Headers.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no";

        while (!cancellationToken.IsCancellationRequested)
        {
            bool terminal;
            using (var scope = scopeFactory.CreateScope())
            {
                var jobService = scope.ServiceProvider.GetRequiredService<ImportJobService>();
                var detail = await jobService.GetDetailAsync(jobId, cancellationToken);
                if (detail is null)
                {
                    await WriteSseAsync(response, "{\"error\":\"not_found\"}", cancellationToken);
                    return;
                }

                var payload = new ImportJobDetailResult(ToJobSummary(detail.Job), detail.Rows.Select(ToRowItem).ToArray());
                await WriteSseAsync(response, JsonSerializer.Serialize(payload, JsonOptions), cancellationToken);
                terminal = detail.Job.IsTerminal;
            }

            if (terminal)
            {
                return; // final snapshot sent — close the stream
            }

            try
            {
                await Task.Delay(TimeSpan.FromMilliseconds(1500), cancellationToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private static async Task WriteSseAsync(HttpResponse response, string json, CancellationToken cancellationToken)
    {
        await response.WriteAsync($"data: {json}\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    private static ImportJobSummary ToJobSummary(ImportJob j) => new(
        j.Id, j.BatchCode, j.FileName, j.StartedByName, j.Status,
        j.TotalRows, j.StoredCount, j.FailedCount, j.SkippedCount,
        j.StartedAt, j.CompletedAt, j.CreatedAt);

    private static ImportJobRowItem ToRowItem(ImportJobRow r) => new(
        r.Id, r.RowIndex, r.ContractId, r.Title, r.Supplier, r.SizeBytes, r.State, r.FailReason, r.BlobContainer, r.BlobKey);

    private static Task<IResult> ResolveContractDocumentGetAsync(
        string? link,
        string? contractId,
        IContractRepository repository,
        IImportJobRepository jobs,
        IDocumentStorage storage,
        CancellationToken cancellationToken) =>
        ResolveContractDocumentAsync(link, contractId, repository, jobs, storage, cancellationToken);

    private static async Task<IResult> ResolveContractDocumentPostAsync(
        HttpRequest request,
        IContractRepository repository,
        IImportJobRepository jobs,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        var body = await ReadJsonBodyAsync<ResolveContractDocumentRequest>(request, cancellationToken);
        return await ResolveContractDocumentAsync(
            body?.Link, body?.ContractId, repository, jobs, storage, cancellationToken);
    }

    private static async Task<IResult> ResolveContractDocumentAsync(
        string? link,
        string? contractId,
        IContractRepository repository,
        IImportJobRepository jobs,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(link) || !storage.IsConfigured)
        {
            return Results.Ok(new ContractDocumentResolveResult(false, null, null));
        }

        string? container = null;
        string? blobKey = null;
        string? fileName = null;

        // CIP handoff stores final contracts as blob://{container}/{blobKey}.
        if (SharePointDocumentLookup.TryParseBlobLink(link, out var blobContainer, out var blobPath))
        {
            container = blobContainer;
            blobKey = blobPath;
            fileName = Path.GetFileName(blobPath);
        }
        else if (SharePointDocument.IsSharePointLink(link))
        {
            var document = await repository.FindSharePointDocumentAsync(link, cancellationToken);
            if (document is not null)
            {
                container = document.Container;
                blobKey = document.BlobKey;
                fileName = document.FileName;
            }
        }

        if (container is null || blobKey is null)
        {
            var storedRow = await jobs.FindLatestStoredRowAsync(link, contractId, cancellationToken);
            if (storedRow?.BlobContainer is not null && storedRow.BlobKey is not null)
            {
                container = storedRow.BlobContainer;
                blobKey = storedRow.BlobKey;
                fileName = Path.GetFileName(storedRow.BlobKey);
            }
        }

        if (container is null || blobKey is null)
        {
            return Results.Ok(new ContractDocumentResolveResult(false, null, null));
        }

        // Prefer a short-lived SAS. Production often cannot sign User Delegation SAS
        // (missing Storage Blob Delegator) — fall back to the same-origin stream path
        // instead of throwing 500, which the View modal treated as "not migrated".
        var url = await DocumentReadLinks.TryBuildMappedReadUrlAsync(
            storage, container, blobKey, cancellationToken);
        return Results.Ok(new ContractDocumentResolveResult(url is not null, url, fileName));
    }

    private static async Task<IResult> ListMaterialsAsync(
        string? contractKey,
        string? q,
        string? site,
        int? page,
        int? pageSize,
        ContractMaterialService materials,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(contractKey))
        {
            return Results.BadRequest(new { error = "contractKey is required." });
        }

        var result = await materials.GetPageAsync(
            contractKey.Trim(),
            q,
            site,
            page ?? 1,
            pageSize ?? 50,
            cancellationToken);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> GetMaterialSummaryAsync(
        string? contractKey,
        ContractMaterialService materials,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(contractKey))
        {
            return Results.BadRequest(new { error = "contractKey is required." });
        }

        var summary = await materials.GetSummaryAsync(contractKey.Trim(), cancellationToken);
        return summary is null ? Results.NotFound() : Results.Ok(summary);
    }

    private static async Task<IResult> UploadMaterialsAsync(
        MaterialUploadRequest request,
        ContractMaterialService materials,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.ContractKey))
        {
            return Results.BadRequest(new { error = "contractKey is required." });
        }

        if (request.Rows is null || request.Rows.Count == 0)
        {
            return Results.BadRequest(new { error = "rows are required." });
        }

        try
        {
            var rows = ContractMaterialService.NormalizeClientRows(request.Rows.Select(row =>
                new MaterialRowInput(
                    row.ContractNo ?? string.Empty,
                    row.MaterialNumber ?? string.Empty,
                    row.Description ?? string.Empty,
                    row.Site ?? string.Empty,
                    row.Currency ?? string.Empty,
                    row.UnitPrice)));
            var result = await materials.UploadManualAsync(
                request.ContractKey.Trim(),
                request.FileName ?? "manual-upload.xlsx",
                rows,
                cancellationToken);
            return Results.Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> SyncMaterialFolderAsync(
        MaterialFolderSyncRequest request,
        MaterialFolderSyncService syncService,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.FolderUrl))
        {
            return Results.BadRequest(new { error = "folderUrl is required." });
        }

        try
        {
            var result = await syncService.SyncFolderAsync(request.FolderUrl.Trim(), cancellationToken);
            return Results.Ok(result);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetContractDetailAsync(
        string contractId,
        IContractRepository repository,
        CancellationToken cancellationToken)
    {
        var contract = await repository.GetByKeyAsync(contractId, cancellationToken);
        if (contract is not null)
        {
            var versionEntities = await repository.GetVersionsAsync(contract.ContractKey, cancellationToken);

            // Join each version's SharePoint link to its migrated Blob copy (if migration has run).
            var linkHashes = versionEntities
                .Where(item => SharePointDocument.IsSharePointLink(item.DocumentLink))
                .SelectMany(item => SharePointDocumentLookup.LinkHashCandidates(item.DocumentLink!))
                .Distinct()
                .ToArray();
            var migratedDocuments = await repository.GetSharePointDocumentsByHashesAsync(linkHashes, cancellationToken);

            var versions = versionEntities
                .Select(item =>
                {
                    SharePointDocument? document = null;
                    if (SharePointDocument.IsSharePointLink(item.DocumentLink))
                    {
                        foreach (var hash in SharePointDocumentLookup.LinkHashCandidates(item.DocumentLink!))
                        {
                            if (migratedDocuments.TryGetValue(hash, out var match))
                            {
                                document = match;
                                break;
                            }
                        }
                    }
                    return new ContractVersionDomainItem(
                        item.VersionKey,
                        item.VersionType,
                        item.Title,
                        item.Status,
                        item.ContractValue,
                        item.ContractDate,
                        item.EffectiveDate,
                        item.ExpiredDate,
                        item.DocumentLink,
                        document?.Container,
                        document?.BlobKey,
                        document?.FileName,
                        document is not null);
                })
                .ToArray();

            var reminders = (await repository.GetRemindersAsync(contract.ContractKey, cancellationToken))
                .Select(ToReminderItem)
                .ToArray();

            return Results.Ok(new ContractDomainDetail(ToContractSummary(contract), versions, reminders));
        }

        var result = ModuleWorkflowReadModels.ContractDetail(contractId);
        return result is null ? Results.NotFound(new { code = "contract_not_found" }) : Results.Ok(result);
    }

    private static async Task<IReadOnlyCollection<ContractDomainSummary>> GetContractSummariesAsync(
        IContractRepository repository,
        CancellationToken cancellationToken,
        string? status = null)
    {
        var contracts = await repository.ListAsync(status, cancellationToken);
        return contracts.Select(ToContractSummary).ToArray();
    }

    private static ContractReminderDomainItem ToReminderItem(ContractReminder item) =>
        new(
            item.ReminderKey,
            item.ContractKey,
            item.Tier,
            item.Trigger,
            item.SentAt,
            item.DaysToExpiry,
            item.Escalated);

    private static ContractDomainSummary ToContractSummary(Contract item) =>
        new(
            item.ContractKey,
            item.ContractKey,
            item.Title,
            item.SupplierName,
            item.Status,
            item.Owner ?? string.Empty,
            item.EffectiveDate,
            item.CurrentExpiryDate,
            string.Empty,
            item.ContractValue,
            item.Jobsite,
            item.Classification,
            item.SubClass,
            item.PicNames,
            item.PicEmail,
            item.DaysToExpiry,
            item.VersionCount,
            item.LatestVersionType);

    private static async Task<T?> ReadJsonBodyAsync<T>(HttpRequest request, CancellationToken cancellationToken)
    {
        if (request.ContentLength is null or 0)
        {
            return default;
        }

        return await JsonSerializer.DeserializeAsync<T>(request.Body, JsonOptions, cancellationToken);
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

internal sealed record ContractDashboardDomainResult(
    string Module,
    IReadOnlyCollection<ContractDashboardMetricDomainItem> Metrics);

internal sealed record ContractDashboardMetricDomainItem(
    string Label,
    string Value,
    string Description);

internal sealed record ContractDomainSummary(
    string ContractId,
    string ContractNo,
    string Title,
    string VendorName,
    string Status,
    string Owner,
    DateOnly? EffectiveDate,
    DateOnly? ExpiryDate,
    string SourceCaseId,
    decimal ContractValue,
    string? Jobsite,
    string? Classification,
    string? SubClass,
    string? PicNames,
    string? PicEmail,
    int DaysToExpiry,
    int VersionCount,
    string? LatestVersionType);

internal sealed record ContractVersionDomainItem(
    string VersionId,
    string Type,
    string Title,
    string Status,
    decimal ContractValue,
    DateOnly? ContractDate,
    DateOnly? EffectiveDate,
    DateOnly? ExpiryDate,
    string? DocumentLink,
    string? DocumentContainer = null,
    string? DocumentBlobKey = null,
    string? DocumentFileName = null,
    bool DocumentMigrated = false);

internal sealed record ContractDocumentResolveResult(
    bool Migrated,
    string? Url,
    string? FileName);

internal sealed record ResolveContractDocumentRequest(string? Link, string? ContractId);

internal sealed record CreateImportJobRequest(
    string? FileName,
    IReadOnlyList<ImportRowInput>? Rows);

internal sealed record ImportRowInput(
    int? RowIndex,
    string? ContractId,
    string? Title,
    string? Supplier,
    string? Link);

internal sealed record ImportJobSummary(
    Guid Id,
    string BatchCode,
    string FileName,
    string? StartedBy,
    string Status,
    int Total,
    int Stored,
    int Failed,
    int Skipped,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    DateTimeOffset CreatedAt);

internal sealed record ImportJobRowItem(
    Guid Id,
    int RowIndex,
    string ContractId,
    string Title,
    string Supplier,
    long? SizeBytes,
    string State,
    string? FailReason,
    string? BlobContainer,
    string? BlobKey);

internal sealed record ImportJobDetailResult(
    ImportJobSummary Job,
    IReadOnlyCollection<ImportJobRowItem> Rows);

internal sealed record ContractReminderDomainItem(
    string ReminderId,
    string ContractId,
    string Tier,
    string Trigger,
    DateTimeOffset? SentAt,
    int DaysToExpiry,
    bool Escalated);

internal sealed record ContractDomainDetail(
    ContractDomainSummary Contract,
    IReadOnlyCollection<ContractVersionDomainItem> Versions,
    IReadOnlyCollection<ContractReminderDomainItem> Reminders);

internal sealed record SendContractReminderRequest(
    string? Trigger,
    bool? Force);

internal sealed record SendReminderEmailRequest(
    string? ContractNo,
    string? Title,
    string? Supplier,
    string? Jobsite,
    string? PicNames,
    string? PicEmail,
    string? ExpiryDate,
    int? DaysToExpiry,
    string? Tier,
    string? Trigger,
    bool? Escalated);

internal sealed record ContractReminderCommandResult(
    bool Sent,
    string? Tier,
    bool Escalated,
    string? Reason);

internal sealed record ContractReminderScanResult(
    int Scanned,
    int Sent,
    int Escalated,
    int Skipped);

internal sealed record MaterialUploadRequest(
    string? ContractKey,
    string? FileName,
    IReadOnlyList<MaterialUploadRowRequest>? Rows);

internal sealed record MaterialUploadRowRequest(
    string? ContractNo,
    string? MaterialNumber,
    string? Description,
    string? Site,
    string? Currency,
    decimal UnitPrice);

internal sealed record MaterialFolderSyncRequest(string? FolderUrl);

