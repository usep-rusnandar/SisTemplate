using IntegratedProcurement.AppHost.Api.ReadModels;
using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Audit.Application;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.InternalIdentity.Application.Auth;
using IntegratedProcurement.Platform.Notifications.Application;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

public static class AdminConsoleEndpoints
{
    public static IEndpointRouteBuilder MapAdminConsoleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var superAdmin = endpoints.MapGroup("/api/v1/super-admin")
            .WithTags("Super Admin")
            .RequireAuthorization(AuthorizationPolicies.InternalUser);

        superAdmin.MapGet("/overview", AdminConsoleReadModels.SuperAdminOverview).RequirePermission("settings.view");
        superAdmin.MapGet("/modules", AdminConsoleReadModels.ModulesList).RequirePermission("settings.view");
        superAdmin.MapGet("/permissions", GetPermissionGroupsAsync).RequirePermission("permissions.view");
        superAdmin.MapGet("/menus", AdminConsoleReadModels.MenuList).RequirePermission("settings.view");
        superAdmin.MapGet("/menu-tree", GetMenuTreeAsync).RequirePermission("settings.view");
        superAdmin.MapPut("/menu-tree", PutMenuTreeAsync).RequirePermission("settings.update");
        superAdmin.MapGet("/languages", GetLanguagesAsync).RequirePermission("languages.view");
        superAdmin.MapPut("/languages", PutLanguagesAsync).RequirePermission("languages.manage");
        superAdmin.MapGet("/language-text", GetLanguageTextAsync).RequirePermission("languages.view");
        superAdmin.MapPut("/language-text", PutLanguageTextAsync).RequirePermission("languages.translate");
        superAdmin.MapGet("/email-templates", GetEmailTemplatesAsync).RequirePermission("email.templates.view");
        superAdmin.MapPut("/email-templates", PutEmailTemplatesAsync).RequirePermission("email.templates.manage");
        superAdmin.MapGet("/email-sent", GetEmailSentAsync).RequirePermission("email.logs.view");
        superAdmin.MapPut("/email-sent", PutEmailSentAsync).RequirePermission("email.templates.manage");
        superAdmin.MapPost("/email-sent", PostEmailSentAsync).RequirePermission("email.templates.manage");
        superAdmin.MapGet("/audit", GetAuditLogsAsync).RequirePermission("audit.view");
        superAdmin.MapGet("/settings", GetSettingsAsync).RequirePermission("settings.view");
        superAdmin.MapPut("/settings", PutSettingsAsync).RequirePermission("settings.update");
        superAdmin.MapPost("/settings/retention/run", RunRetentionAsync).RequirePermission("settings.update");
        superAdmin.MapPost("/settings/test-email", SendTestEmailAsync).RequirePermission("settings.update");
        superAdmin.MapGet("/background-processes", ListBackgroundProcessesAsync).RequirePermission("settings.view");
        superAdmin.MapPost("/background-processes/{key}/run", RunBackgroundProcessAsync).RequirePermission("settings.update");

        var administration = endpoints.MapGroup("/api/v1/administration")
            .WithTags("Administration")
            .RequireAuthorization(AuthorizationPolicies.InternalUser);

        administration.MapGet("/overview", AdminConsoleReadModels.AdministrationOverview).RequirePermission("users.view");
        administration.MapGet("/users", GetUsersAsync).RequirePermission("users.view");
        administration.MapGet("/roles", GetRolesAsync).RequirePermission("roles.view");
        administration.MapGet("/role-permissions", GetRolePermissionMatrixAsync).RequirePermission("roles.view");
        administration.MapPost("/users", CreateUserAsync).RequirePermission("users.create");
        administration.MapPut("/users/{personnelNo}", UpdateUserAsync).RequirePermission("users.update");
        administration.MapPut("/users/{personnelNo}/status", SetUserStatusAsync).RequirePermission("users.update");
        administration.MapPost("/users/{personnelNo}/avatar", UploadUserAvatarAsync).RequirePermission("users.update").DisableAntiforgery();
        administration.MapDelete("/users/{personnelNo}/avatar", DeleteUserAvatarAsync).RequirePermission("users.update");
        administration.MapPut("/users/{personnelNo}/roles", SetUserRolesAsync).RequirePermission("users.permissions");
        administration.MapPut("/users/{personnelNo}/password", SetUserPasswordAsync).RequirePermission("users.update");
        administration.MapPost("/roles", CreateRoleAsync).RequirePermission("roles.create");
        administration.MapPost("/roles/{roleCode}/duplicate", DuplicateRoleAsync).RequirePermission("roles.create");
        administration.MapPut("/roles/{roleCode}", UpdateRoleAsync).RequirePermission("roles.update");
        administration.MapPut("/roles/{roleCode}/permissions", SetRolePermissionsAsync).RequirePermission("permissions.assign");
        administration.MapDelete("/roles/{roleCode}", DeleteRoleAsync).RequirePermission("roles.delete");

        var masterData = endpoints.MapGroup("/api/v1/master-data")
            .WithTags("Master Data")
            .RequireAuthorization(AuthorizationPolicies.InternalUser);

        // Master data is broken down per owning module: each set is gated by masterData.<module>.view|manage,
        // enforced per-set inside the handlers (the required permission depends on the {key} route value).
        // See MasterDataAccess. Overview needs any master-data view; regions are Vendor Onboarding master data.
        masterData.MapGet("/overview", (HttpContext httpContext) =>
            MasterDataAccess.HasAnyView(httpContext.User) ? Results.Ok(AdminConsoleReadModels.MasterDataOverview()) : Results.Forbid());
        masterData.MapGet("/sets", GetMasterDataSetsAsync);
        masterData.MapGet("/sets/{key}", GetMasterDataSetAsync);
        masterData.MapPut("/sets/{key}/records", PutMasterDataRecordsAsync);
        masterData.MapPut("/sets/{key}/records:replace", ReplaceMasterDataRecordsAsync);
        masterData.MapPut("/sets/{key}/records/{code}", PutMasterDataRecordAsync);
        masterData.MapDelete("/sets/{key}/records/{code}", DeleteMasterDataRecordAsync);

        // Administrative Regions external sync (wilayah.id): trigger a manual (ad-hoc) sync and read status.
        // Gated on the Administrative Regions screen (its province/city/district/village sets), so a role
        // granted just that screen can run the sync without holding every Vendor Onboarding master data key.
        masterData.MapGet("/regions/sync", (HttpContext httpContext, IWilayahSyncCoordinator syncCoordinator) =>
            MasterDataAccess.CanView(httpContext.User, "province")
                ? GetRegionSyncStatus(syncCoordinator)
                : Results.Forbid());
        masterData.MapPost("/regions/sync", async (
            HttpContext httpContext,
            IWilayahSyncCoordinator syncCoordinator,
            IAdminConsoleAuditService auditService,
            CancellationToken cancellationToken) =>
            MasterDataAccess.CanManage(httpContext.User, "province")
                ? await TriggerRegionSyncAsync(httpContext, syncCoordinator, auditService, cancellationToken)
                : Results.Forbid());

        var dashboard = endpoints.MapGroup("/api/v1/dashboard")
            .WithTags("Dashboard")
            .RequireAuthorization(AuthorizationPolicies.InternalUser);

        dashboard.MapGet("/metrics", GetDashboardMetricsAsync).RequirePermission("dashboard.view");

        return endpoints;
    }

    private static readonly string[] UnassignedRoleFallback = ["Unassigned"];

    // Real dashboard metrics computed from the live database (no fabricated numbers): entity counts,
    // users-per-role distribution, a 12-month audit-activity trend, and the most recent audit events.
    private static async Task<IResult> GetDashboardMetricsAsync(
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleCommunicationService communicationService,
        IAuditTrail auditTrail,
        CancellationToken cancellationToken)
    {
        var users = await identityReadService.GetUsersAsync(cancellationToken);
        var roles = await identityReadService.GetRolesAsync(cancellationToken);
        var permissionGroups = await identityReadService.GetPermissionGroupsAsync(cancellationToken);
        var languages = await communicationService.GetLanguagesAsync(cancellationToken);
        var languagesCount = languages.Items?.Count ?? 0;
        var audit = await auditTrail.GetRecentAsync(1000, cancellationToken);

        // "Today" is the Jakarta (WIB) calendar day — audit timestamps are stored UTC, so compare
        // both in WIB, otherwise the day boundary is off by 7 hours (early-morning WIB = previous UTC day).
        var today = JakartaTime.Today();
        var auditToday = audit.Count(entry => JakartaTime.DateOf(entry.OccurredAt) == today);

        var roleDistribution = users
            .SelectMany(user => user.Roles.Count > 0 ? user.Roles : UnassignedRoleFallback)
            .GroupBy(role => role)
            .Select(group => new DashboardDistributionSlice(group.Key, group.Count()))
            .OrderByDescending(slice => slice.Value)
            .ToArray();

        var firstMonth = new DateTime(today.Year, today.Month, 1).AddMonths(-11);
        var monthlyActivity = Enumerable.Range(0, 12)
            .Select(offset => firstMonth.AddMonths(offset))
            .Select(month => new DashboardMonthlyPoint(
                month.ToString("MMM", CultureInfo.InvariantCulture),
                month.Year,
                audit.Count(entry => entry.OccurredAt.UtcDateTime.Year == month.Year && entry.OccurredAt.UtcDateTime.Month == month.Month)))
            .ToArray();

        var recentActivity = audit
            .OrderByDescending(entry => entry.OccurredAt)
            .Take(8)
            .Select(entry => new DashboardActivityItem(
                string.IsNullOrWhiteSpace(entry.ActorName) ? "System" : entry.ActorName!,
                entry.Action,
                entry.Module,
                entry.Description,
                entry.OccurredAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                ActivityTone(entry.Action)))
            .ToArray();

        return Results.Ok(new DashboardMetricsResponse(
            users.Count,
            roles.Count,
            permissionGroups.Sum(group => group.Permissions.Count),
            languagesCount,
            auditToday,
            roleDistribution,
            monthlyActivity,
            recentActivity));
    }

    private static string ActivityTone(string action) => action switch
    {
        "Create" or "Approve" => "success",
        "Delete" or "Reject" or "Failed login" => "danger",
        "Update" => "brand",
        "Login" or "Logout" => "info",
        _ => "neutral",
    };

    private static async Task<IResult> GetMenuTreeAsync(
        IAdminConsoleConfigurationService configurationService,
        CancellationToken cancellationToken)
    {
        var result = await configurationService.GetMenuTreeAsync(cancellationToken);
        return Results.Ok(new MenuTreeResponse(result.PayloadJson, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> PutMenuTreeAsync(
        MenuTreeUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleConfigurationService configurationService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PayloadJson))
        {
            return Results.BadRequest(new { code = "menu_payload_required" });
        }

        var result = await configurationService.SaveMenuTreeAsync(request.PayloadJson, cancellationToken);
        await auditService.WriteAuditAsync(httpContext, "Update", "Menus", "Updated internal navigation menu tree", cancellationToken);
        return Results.Ok(new MenuTreeResponse(result.PayloadJson, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> GetSettingsAsync(
        IAdminConsoleConfigurationService configurationService,
        CancellationToken cancellationToken)
    {
        var result = await configurationService.GetSettingsAsync(cancellationToken);
        return Results.Ok(new SettingsResponse(result.Values, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> PutSettingsAsync(
        SettingsUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleConfigurationService configurationService,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        CancellationToken cancellationToken)
    {
        if (request.Values is null)
        {
            return Results.BadRequest(new { code = "settings_values_required" });
        }

        var result = await configurationService.SaveSettingsAsync(request.Values, cancellationToken);
        await auditService.WriteAuditAsync(httpContext, "Update", "Settings", "Updated platform settings", cancellationToken);
        await notificationService.NotifyPermissionHoldersAsync(
            "settings.view",
            "Settings",
            "info",
            "Platform settings updated",
            "System and security settings were changed.",
            "/super-admin/settings",
            cancellationToken);
        return Results.Ok(new SettingsResponse(result.Values, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> RunRetentionAsync(
        HttpContext httpContext,
        IRetentionService retentionService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var result = await retentionService.RunAsync(cancellationToken);
        await auditService.WriteAuditAsync(
            httpContext,
            "Delete",
            "Settings",
            $"Retention cleanup removed audit={result.AuditDeleted}, notifications={result.NotificationsDeleted}, emailLogs={result.EmailLogsDeleted}",
            cancellationToken);
        return Results.Ok(new
        {
            result.AuditDeleted,
            result.NotificationsDeleted,
            result.NotificationStatesDeleted,
            result.EmailLogsDeleted,
        });
    }

    private static async Task<IResult> ListBackgroundProcessesAsync(
        IBackgroundProcessCatalog catalog,
        CancellationToken cancellationToken) =>
        Results.Ok(await catalog.ListAsync(cancellationToken));

    private static async Task<IResult> RunBackgroundProcessAsync(
        string key,
        HttpContext httpContext,
        IBackgroundProcessCatalog catalog,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var result = await catalog.RunNowAsync(key, cancellationToken);
        if (string.Equals(result.Outcome, BackgroundProcessOutcomes.Rejected, StringComparison.Ordinal))
        {
            var code = result.Message ?? "not_runnable";
            return code is "not_runnable" && result.Process is null
                ? Results.NotFound(new { code, key = result.Key })
                : Results.BadRequest(new { code, key = result.Key, process = result.Process });
        }

        await auditService.WriteAuditAsync(
            httpContext,
            "Update",
            "Background processes",
            $"Requested run of {result.Key} ({result.Outcome})",
            cancellationToken);

        return string.Equals(result.Outcome, BackgroundProcessOutcomes.Accepted, StringComparison.Ordinal)
            ? Results.Accepted(value: result)
            : Results.Ok(result);
    }

    /// <summary>
    /// Sends a test email to the Settings ▸ Email per-module "To (test)" address via the configured delivery mode.
    /// Body: { module, subject?, body? }. <c>module</c> is the sender slug (e.g. vendorOnboarding).
    /// </summary>
    private static async Task<IResult> SendTestEmailAsync(
        TestEmailRequest? request,
        IAdminConsoleConfigurationService configurationService,
        IEmailSender emailSender,
        CancellationToken cancellationToken)
    {
        var settings = (await configurationService.GetSettingsAsync(cancellationToken)).Values;

        string? SettingText(string key) =>
            settings is not null
            && settings.TryGetValue(key, out var el)
            && el.ValueKind == System.Text.Json.JsonValueKind.String
                ? el.GetString()
                : null;

        var moduleSlug = string.IsNullOrWhiteSpace(request?.Module) ? null : request!.Module!.Trim();
        var category = CategoryForModuleSlug(moduleSlug);
        if (string.IsNullOrWhiteSpace(moduleSlug) || category is null)
        {
            return Results.BadRequest(new
            {
                code = "module_required",
                message = "Specify which module to test (module slug, e.g. vendorOnboarding).",
            });
        }

        var toTest = SettingText($"toTest_{moduleSlug}");
        if (string.IsNullOrWhiteSpace(toTest))
        {
            return Results.BadRequest(new
            {
                code = "to_test_missing",
                message = $"Fill the 'To (test)' field for {category} in Settings ▸ Email first.",
            });
        }

        var isSmtp = string.Equals(SettingText("emailMode") ?? "api", "smtp", StringComparison.OrdinalIgnoreCase);
        var endpoint = isSmtp
            ? $"{SettingText("smtp") ?? "—"}:{SettingText("port") ?? "25"}"
            : (SettingText("baseUrl") ?? "—");
        var fromAddress = FirstNonEmptySetting(
            SettingText($"from_{moduleSlug}"),
            SettingText("fromDefault"),
            SettingText("from")) ?? "—";
        var sentAt = JakartaTime.Now().ToString("dd MMM yyyy, HH:mm 'WIB'", System.Globalization.CultureInfo.InvariantCulture);

        var subject = string.IsNullOrWhiteSpace(request?.Subject)
            ? $"SisTemplate — {category} email test"
            : $"[TEST] {request!.Subject}";
        var body = string.IsNullOrWhiteSpace(request?.Body)
            ? BuildTestEmailHtml(isSmtp ? "SMTP server" : "API gateway", endpoint, fromAddress, toTest!, sentAt)
            : WrapTemplateTestBody(request!.Subject, request.Body, category, request.Cta);

        // Pass the module category so SmtpEmailSender uses that module's From / To (test).
        var delivered = await emailSender.SendAsync(toTest, subject, body, category, cancellationToken);
        return Results.Ok(new { delivered, to = toTest, module = moduleSlug });
    }

    private static string WrapTemplateTestBody(string? subject, string body, string category, string? cta)
    {
        if (EmailHtmlEnvelope.IsWrapped(body))
        {
            return body;
        }

        var inner = EmailHtmlEnvelope.LooksLikeHtml(body)
            ? body
            : EmailTemplateNotifier.ToHtml(body);
        var title = string.IsNullOrWhiteSpace(subject) ? "Email template test" : subject;
        return EmailHtmlEnvelope.Wrap(title, inner, category, cta, ctaHref: null);
    }

    private static string? CategoryForModuleSlug(string? slug) => slug switch
    {
        "users" => "Users",
        _ => null,
    };

    private static string? FirstNonEmptySetting(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    /// <summary>
    /// Default test-email body: an email-client-safe (table layout + inline CSS, no external assets),
    /// on-brand HTML message that also echoes the delivery config so the recipient can confirm what was used.
    /// </summary>
    private static string BuildTestEmailHtml(string mode, string endpoint, string from, string to, string sentAt)
    {
        static string E(string value) => System.Net.WebUtility.HtmlEncode(value ?? string.Empty);

        return $"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f4;margin:0;padding:24px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;">
      <tr><td style="background-color:#013B52;padding:22px 32px;">
        <span style="font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">AlamTri <span style="color:#8FE3E8;">geo</span></span>
        <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-top:4px;">Integrated Procurement</span>
      </td></tr>
      <tr><td style="padding:34px 32px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td width="46" style="width:46px;height:46px;background-color:#e7f7ee;border-radius:23px;text-align:center;vertical-align:middle;font-size:24px;color:#16a34a;line-height:46px;">&#10004;</td>
          <td style="padding-left:14px;font-size:22px;font-weight:800;color:#0f2b34;line-height:1.25;">Your email settings are working<span style="display:block;font-size:15px;font-weight:600;color:#5a6b73;margin-top:3px;">Pengaturan email Anda berfungsi</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:16px 32px 4px;font-size:14px;line-height:1.6;color:#3f5661;">
        This is an automated test message from the <strong>Integrated Procurement</strong> platform. If you are reading it, outbound email configured under <strong>Settings &#9656; Email</strong> is being delivered correctly.
        <div style="height:1px;background-color:#eef2f4;margin:14px 0;"></div>
        Ini adalah pesan uji otomatis dari platform <strong>Integrated Procurement</strong>. Jika Anda menerima pesan ini, pengiriman email keluar yang dikonfigurasi di <strong>Pengaturan &#9656; Email</strong> berjalan dengan benar.
      </td></tr>
      <tr><td style="padding:20px 32px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3eaed;border-radius:10px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #eef2f4;font-size:12px;color:#7c8f98;width:150px;">Delivery mode<span style="display:block;font-size:10.5px;color:#a9b6bd;">Mode pengiriman</span></td><td style="padding:12px 16px;border-bottom:1px solid #eef2f4;font-size:13px;font-weight:600;color:#0f2b34;">{E(mode)}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #eef2f4;font-size:12px;color:#7c8f98;">Endpoint</td><td style="padding:12px 16px;border-bottom:1px solid #eef2f4;font-size:13px;color:#0f2b34;word-break:break-all;">{E(endpoint)}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #eef2f4;font-size:12px;color:#7c8f98;">From<span style="display:block;font-size:10.5px;color:#a9b6bd;">Pengirim</span></td><td style="padding:12px 16px;border-bottom:1px solid #eef2f4;font-size:13px;color:#0f2b34;">{E(from)}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #eef2f4;font-size:12px;color:#7c8f98;">Recipient<span style="display:block;font-size:10.5px;color:#a9b6bd;">Penerima</span></td><td style="padding:12px 16px;border-bottom:1px solid #eef2f4;font-size:13px;color:#0f2b34;">{E(to)}</td></tr>
          <tr><td style="padding:12px 16px;font-size:12px;color:#7c8f98;">Sent at<span style="display:block;font-size:10.5px;color:#a9b6bd;">Waktu kirim</span></td><td style="padding:12px 16px;font-size:13px;color:#0f2b34;">{E(sentAt)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 32px 30px;font-size:12px;line-height:1.6;color:#9aa9b0;">
        No action is required. This message was generated by the "Send test email" action in Settings.<br/>
        Tidak ada tindakan yang diperlukan. Pesan ini dibuat oleh aksi "Kirim email uji" di Pengaturan.
      </td></tr>
      <tr><td style="background-color:#f7fafb;padding:16px 32px;border-top:1px solid #eef2f4;font-size:11.5px;line-height:1.6;color:#9aa9b0;">
        Automated message — please do not reply. &middot; Pesan otomatis — mohon tidak membalas.<br/>
        &copy; 2026 Saptaindra Sejati &middot; Integrated Procurement.
      </td></tr>
    </table>
  </td></tr>
</table>
""";
    }

    private sealed record TestEmailRequest(string? Subject, string? Body, string? Module, string? Cta);

    private static async Task<IResult> GetLanguagesAsync(
        IAdminConsoleCommunicationService communicationService,
        CancellationToken cancellationToken)
    {
        var result = await communicationService.GetLanguagesAsync(cancellationToken);
        return Results.Ok(new JsonCollectionResponse<JsonElement>(result.Items, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> PutLanguagesAsync(
        JsonCollectionUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleCommunicationService communicationService,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        ProcurementDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var result = await ReplaceJsonCollectionAsync(
            request,
            httpContext,
            auditService,
            dbContext,
            item => item.GetProperty("code").GetString(),
            "Languages",
            "Replaced language configuration",
            (items, now) => communicationService.ReplaceLanguagesAsync(items, now, cancellationToken),
            cancellationToken);
        if (result is not null)
        {
            return result;
        }

        // Language availability affects everyone — broadcast as an announcement.
        await notificationService.NotifyAllAsync(
            "info",
            "Language configuration updated",
            "Available languages were changed by an administrator.",
            "/super-admin/languages",
            cancellationToken);
        return await GetLanguagesAsync(communicationService, cancellationToken);
    }

    private static async Task<IResult> GetLanguageTextAsync(
        IAdminConsoleCommunicationService communicationService,
        CancellationToken cancellationToken)
    {
        var result = await communicationService.GetLanguageTextAsync(cancellationToken);
        return Results.Ok(new JsonCollectionResponse<JsonElement>(result.Items, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> PutLanguageTextAsync(
        JsonCollectionUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleCommunicationService communicationService,
        IAdminConsoleAuditService auditService,
        ProcurementDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var result = await ReplaceJsonCollectionAsync(
            request,
            httpContext,
            auditService,
            dbContext,
            item => item.GetProperty("key").GetString(),
            "Language Text",
            "Replaced language text entries",
            (items, now) => communicationService.ReplaceLanguageTextAsync(items, now, cancellationToken),
            cancellationToken);
        if (result is not null)
        {
            return result;
        }

        return await GetLanguageTextAsync(communicationService, cancellationToken);
    }

    private static async Task<IResult> GetEmailTemplatesAsync(
        IAdminConsoleCommunicationService communicationService,
        CancellationToken cancellationToken)
    {
        var result = await communicationService.GetEmailTemplatesAsync(cancellationToken);
        return Results.Ok(new JsonCollectionResponse<JsonElement>(result.Items, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> PutEmailTemplatesAsync(
        JsonCollectionUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleCommunicationService communicationService,
        IAdminConsoleAuditService auditService,
        ProcurementDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var result = await ReplaceJsonCollectionAsync(
            request,
            httpContext,
            auditService,
            dbContext,
            item => item.GetProperty("id").GetString(),
            "Email Templates",
            "Replaced email templates",
            (items, now) => communicationService.ReplaceEmailTemplatesAsync(items, now, cancellationToken),
            cancellationToken);
        if (result is not null)
        {
            return result;
        }

        return await GetEmailTemplatesAsync(communicationService, cancellationToken);
    }

    private static async Task<IResult> GetEmailSentAsync(
        IAdminConsoleCommunicationService communicationService,
        CancellationToken cancellationToken)
    {
        var result = await communicationService.GetEmailSentAsync(cancellationToken);
        return Results.Ok(new JsonCollectionResponse<JsonElement>(result.Items, result.HasData, result.UpdatedAt));
    }

    private static async Task<IResult> PutEmailSentAsync(
        JsonCollectionUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleCommunicationService communicationService,
        IAdminConsoleAuditService auditService,
        ProcurementDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var result = await ReplaceJsonCollectionAsync(
            request,
            httpContext,
            auditService,
            dbContext,
            item => item.GetProperty("id").GetString(),
            "Email Sent",
            "Replaced email sent log",
            (items, _) => communicationService.ReplaceEmailSentAsync(items, cancellationToken),
            cancellationToken);
        if (result is not null)
        {
            return result;
        }

        return await GetEmailSentAsync(communicationService, cancellationToken);
    }

    private static async Task<IResult> PostEmailSentAsync(
        JsonElement request,
        HttpContext httpContext,
        IAdminConsoleCommunicationService communicationService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        if (request.ValueKind != JsonValueKind.Object
            || !request.TryGetProperty("id", out var idElement)
            || string.IsNullOrWhiteSpace(idElement.GetString()))
        {
            return Results.BadRequest(new { code = "email_sent_id_required" });
        }

        var messageId = idElement.GetString()!.Trim();
        var payloadJson = request.GetRawText();
        var category = request.TryGetProperty("category", out var categoryElement) ? categoryElement.GetString() ?? string.Empty : string.Empty;
        var status = request.TryGetProperty("status", out var statusElement) ? statusElement.GetString() ?? string.Empty : string.Empty;
        var sentAt = request.TryGetProperty("sentAt", out var sentAtElement) && DateTimeOffset.TryParse(sentAtElement.GetString(), out var parsedSentAt)
            ? parsedSentAt
            : DateTimeOffset.UtcNow;

        var created = await communicationService.TryAddEmailSentAsync(messageId, category, status, sentAt, payloadJson, cancellationToken);
        if (!created)
        {
            return Results.Ok();
        }

        await auditService.WriteAuditAsync(httpContext, "Create", "Email Sent", $"Logged email {messageId}", cancellationToken);
        return Results.Accepted();
    }

    private static async Task<IResult> CreateUserAsync(
        UpsertUserRequest request,
        HttpContext httpContext,
        IAdminConsoleUserManagementService userManagementService,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var personnelNo = Clean(request.PersonnelNo);
        var fullName = Clean(request.FullName);
        if (personnelNo is null || fullName is null)
        {
            return Results.BadRequest(new { code = "user_required_fields_missing" });
        }

        CreateInternalUserResult result;
        try
        {
            result = await userManagementService.CreateUserAsync(
                new CreateInternalUserCommand(
                    personnelNo,
                    fullName,
                    Clean(request.Email),
                    Clean(request.Department),
                    Clean(request.Position),
                    Clean(request.Status),
                    request.Roles ?? [],
                    request.ReportTo),
                cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { code = "invalid_role_assignment", message = exception.Message });
        }

        if (result.AlreadyExists)
        {
            return Results.Conflict(new { code = "user_already_exists", personnelNo });
        }

        await auditService.WriteAuditAsync(httpContext, "Create", "Users", $"Created user {result.DisplayName} ({result.PersonnelNo})", cancellationToken);
        await notificationService.NotifyPermissionHoldersAsync(
            "users.view",
            "Users",
            "info",
            $"New user {result.DisplayName}",
            $"User {result.PersonnelNo} was created.",
            "/administration/users",
            cancellationToken);
        return await GetUserResultAsync(result.PersonnelNo, identityReadService, storage, configuration, cancellationToken, created: true);
    }

    private static async Task<IResult> UpdateUserAsync(
        string personnelNo,
        UpsertUserRequest request,
        HttpContext httpContext,
        IAdminConsoleUserManagementService userManagementService,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var fullName = Clean(request.FullName);
        if (fullName is null)
        {
            return Results.BadRequest(new { code = "full_name_required" });
        }

        UpdateInternalUserResult? result;
        try
        {
            result = await userManagementService.UpdateUserAsync(
                personnelNo,
                new UpdateInternalUserCommand(
                    fullName,
                    Clean(request.Email),
                    Clean(request.Department),
                    Clean(request.Position),
                    request.Status,
                    request.ReportTo),
                cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { code = "invalid_role_assignment", message = exception.Message });
        }

        if (result is null)
        {
            return Results.NotFound(new { code = "user_not_found", personnelNo });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Users", $"Updated user {result.DisplayName} ({result.PersonnelNo})", cancellationToken);
        return await GetUserResultAsync(result.PersonnelNo, identityReadService, storage, configuration, cancellationToken);
    }

    private static async Task<IResult> SetUserStatusAsync(
        string personnelNo,
        SetUserStatusRequest request,
        HttpContext httpContext,
        IAdminConsoleUserManagementService userManagementService,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var status = Clean(request.Status);
        if (status is null)
        {
            return Results.BadRequest(new { code = "status_required" });
        }

        var result = await userManagementService.SetUserStatusAsync(personnelNo, status, cancellationToken);
        if (result is null)
        {
            return Results.NotFound(new { code = "user_not_found", personnelNo });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Users", $"Changed user {result.DisplayName} status to {status}", cancellationToken);
        await notificationService.NotifyPermissionHoldersAsync(
            "users.view",
            "Users",
            status.Equals("Suspended", StringComparison.OrdinalIgnoreCase) ? "warning" : "info",
            $"User {result.DisplayName} status set to {status}",
            $"{result.PersonnelNo} is now {status}.",
            "/administration/users",
            cancellationToken);
        return await GetUserResultAsync(result.PersonnelNo, identityReadService, storage, configuration, cancellationToken);
    }

    private static async Task<IResult> SetUserRolesAsync(
        string personnelNo,
        SetUserRolesRequest request,
        HttpContext httpContext,
        IAdminConsoleUserManagementService userManagementService,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        SetInternalUserRolesResult? result;
        try
        {
            result = await userManagementService.SetUserRolesAsync(personnelNo, request.Roles ?? [], cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { code = "invalid_role_assignment", message = exception.Message });
        }

        if (result is null)
        {
            return Results.NotFound(new { code = "user_not_found", personnelNo });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Users", $"Updated roles for user {result.DisplayName}", cancellationToken);
        return await GetUserResultAsync(result.PersonnelNo, identityReadService, storage, configuration, cancellationToken);
    }

    private static async Task<IResult> SetUserPasswordAsync(
        string personnelNo,
        SetUserPasswordRequest request,
        HttpContext httpContext,
        IInternalLocalAuthService localAuth,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(request.Password))
        {
            return Results.BadRequest(new { code = "password_required" });
        }

        var existing = await identityReadService.GetUserAsync(personnelNo, cancellationToken);
        if (existing is null)
        {
            return Results.NotFound(new { code = "user_not_found", personnelNo });
        }

        var result = await localAuth.SetPasswordAsync(personnelNo, request.Password, cancellationToken);
        if (!result.Succeeded)
        {
            return Results.Json(
                new { code = result.ErrorCode, errors = result.Errors },
                statusCode: StatusCodes.Status400BadRequest);
        }

        await auditService.WriteAuditAsync(
            httpContext,
            "Update",
            "Users",
            $"Set local password for user {existing.FullName} ({personnelNo})",
            cancellationToken);
        return await GetUserResultAsync(personnelNo, identityReadService, storage, configuration, cancellationToken);
    }

    private static async Task<IResult> CreateRoleAsync(
        UpsertRoleRequest request,
        HttpContext httpContext,
        IAdminConsoleRoleManagementService roleManagementService,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var code = Clean(request.RoleId ?? request.Code);
        var name = Clean(request.Name);
        if (code is null || name is null)
        {
            return Results.BadRequest(new { code = "role_required_fields_missing" });
        }

        CreateInternalRoleResult result;
        try
        {
            result = await roleManagementService.CreateRoleAsync(
                new CreateInternalRoleCommand(
                    code,
                    name,
                    Clean(request.ModuleKey),
                    request.IsSystem ?? false,
                    request.Permissions),
                cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { code = "invalid_permission_assignment", message = exception.Message });
        }

        if (result.AlreadyExists)
        {
            return Results.Conflict(new { code = "role_already_exists", roleCode = code });
        }

        await auditService.WriteAuditAsync(httpContext, "Create", "Roles", $"Created role {result.Name} ({result.RoleCode})", cancellationToken);
        return await GetRoleResultAsync(result.RoleCode, identityReadService, cancellationToken, created: true);
    }

    private static async Task<IResult> UpdateRoleAsync(
        string roleCode,
        UpsertRoleRequest request,
        HttpContext httpContext,
        IAdminConsoleRoleManagementService roleManagementService,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var name = Clean(request.Name);
        if (name is null)
        {
            return Results.BadRequest(new { code = "role_name_required" });
        }

        UpdateInternalRoleResult? result;
        try
        {
            result = await roleManagementService.UpdateRoleAsync(
                roleCode,
                new UpdateInternalRoleCommand(
                    name,
                    Clean(request.ModuleKey),
                    request.IsSystem,
                    request.Permissions),
                cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { code = "invalid_permission_assignment", message = exception.Message });
        }

        if (result is null)
        {
            return Results.NotFound(new { code = "role_not_found", roleCode });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Roles", $"Updated role {result.Name} ({result.RoleCode})", cancellationToken);
        return await GetRoleResultAsync(result.RoleCode, identityReadService, cancellationToken);
    }

    private static async Task<IResult> SetRolePermissionsAsync(
        string roleCode,
        SetRolePermissionsRequest request,
        HttpContext httpContext,
        IAdminConsoleRoleManagementService roleManagementService,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        INotificationService notificationService,
        CancellationToken cancellationToken)
    {
        SetInternalRolePermissionsResult? result;
        try
        {
            result = await roleManagementService.SetRolePermissionsAsync(roleCode, request.Permissions ?? [], cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { code = "invalid_permission_assignment", message = exception.Message });
        }

        if (result is null)
        {
            return Results.NotFound(new { code = "role_not_found", roleCode });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Permissions", $"Updated permissions for role {result.Name}", cancellationToken);
        await notificationService.NotifyPermissionHoldersAsync(
            "roles.view",
            "Roles",
            "info",
            $"Permissions updated for role {result.Name}",
            "Role permission assignments were changed.",
            "/administration/roles",
            cancellationToken);
        return await GetRoleResultAsync(result.RoleCode, identityReadService, cancellationToken);
    }

    private static async Task<IResult> DuplicateRoleAsync(
        string roleCode,
        DuplicateRoleRequest? request,
        HttpContext httpContext,
        IAdminConsoleRoleManagementService roleManagementService,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        DuplicateInternalRoleResult result;
        try
        {
            result = await roleManagementService.DuplicateRoleAsync(
                roleCode,
                new DuplicateInternalRoleCommand(
                    Clean(request?.RoleId ?? request?.Code),
                    Clean(request?.Name)),
                cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { code = "invalid_permission_assignment", message = exception.Message });
        }

        if (!result.Found)
        {
            return Results.NotFound(new { code = "role_not_found", roleCode });
        }

        if (result.AlreadyExists)
        {
            return Results.Conflict(new { code = "role_already_exists", roleCode = result.RoleCode });
        }

        await auditService.WriteAuditAsync(
            httpContext,
            "Create",
            "Roles",
            $"Duplicated role {roleCode} as {result.Name} ({result.RoleCode})",
            cancellationToken);
        return await GetRoleResultAsync(result.RoleCode!, identityReadService, cancellationToken, created: true);
    }

    private static async Task<IResult> DeleteRoleAsync(
        string roleCode,
        HttpContext httpContext,
        IAdminConsoleRoleManagementService roleManagementService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var result = await roleManagementService.DeleteRoleAsync(roleCode, cancellationToken);
        if (!result.Found)
        {
            return Results.NotFound(new { code = "role_not_found", roleCode });
        }

        if (!result.Deleted)
        {
            return Results.Conflict(new
            {
                code = result.ErrorCode,
                message = result.Message,
                roleCode,
                users = result.AssignedUsers
            });
        }

        await auditService.WriteAuditAsync(httpContext, "Delete", "Roles", $"Deleted role {roleCode}", cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> GetAuditLogsAsync(
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var logs = await auditService.GetAuditLogsAsync(cancellationToken);
        return Results.Ok(logs);
    }

    private static async Task<IResult> GetMasterDataSetsAsync(
        HttpContext httpContext,
        IAdminConsoleMasterDataService masterDataService,
        CancellationToken cancellationToken)
    {
        if (!MasterDataAccess.HasAnyView(httpContext.User))
        {
            return Results.Forbid();
        }

        // Return only the sets whose owning module the caller can view (per-module master data).
        var sets = await masterDataService.GetSetsAsync(cancellationToken);
        if (sets.Count == 0)
        {
            return Results.Ok(AdminConsoleReadModels.MasterDataSets()
                .Where(set => MasterDataAccess.CanView(httpContext.User, set.Key))
                .ToArray());
        }

        return Results.Ok(sets.Where(set => MasterDataAccess.CanView(httpContext.User, set.Key)).ToArray());
    }

    private static async Task<IResult> GetMasterDataSetAsync(
        string key,
        string? parent,
        string? search,
        int? take,
        HttpContext httpContext,
        IAdminConsoleMasterDataService masterDataService,
        CancellationToken cancellationToken)
    {
        if (!MasterDataAccess.CanView(httpContext.User, key))
        {
            return Results.Forbid();
        }

        var set = await masterDataService.GetSetAsync(key, parent, search, take, cancellationToken);
        if (set is null)
        {
            // No DB-backed set — fall back to the host's canned read model (if any) for known keys.
            var fallback = AdminConsoleReadModels.MasterDataSet(key);
            return fallback is null
                ? Results.NotFound(new { code = "master_data_not_found" })
                : Results.Ok(new MasterDataSetResponse(fallback.Key, fallback.Name, fallback.TableName, fallback.Owner, false, fallback.Records));
        }

        return Results.Ok(new MasterDataSetResponse(set.Key, set.Name, set.TableName, set.Owner, set.HasData, set.Records));
    }

    private static async Task<IResult> PutMasterDataRecordsAsync(
        string key,
        MasterDataRecordsUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleMasterDataService masterDataService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim();
        if (!MasterDataAccess.CanManage(httpContext.User, normalizedKey)) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(normalizedKey) || request.Records is null || request.Records.Count == 0)
        {
            return Results.BadRequest(new { code = "master_data_records_required" });
        }

        var validRecords = request.Records
            .Where(record => !string.IsNullOrWhiteSpace(record.Code) && !string.IsNullOrWhiteSpace(record.Name))
            .Select(record => new MasterDataRecordInput(
                record.Code!.Trim(),
                record.Name!.Trim(),
                record.Status ?? "Active",
                record.Description ?? string.Empty,
                record.PayloadJson))
            .ToArray();
        if (validRecords.Length == 0)
        {
            return Results.BadRequest(new { code = "master_data_records_required" });
        }

        var result = await masterDataService.UpsertRecordsAsync(
            normalizedKey,
            new MasterDataSetDefinition(request.SetName, request.TableName, request.Owner, request.IsReadOnly),
            validRecords,
            cancellationToken);
        if (result.Outcome == MasterDataMutationOutcome.ReadOnly)
        {
            return Results.BadRequest(new { code = "master_data_read_only", key = normalizedKey });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Master Data", $"Upserted {validRecords.Length} records in {normalizedKey}", cancellationToken);
        return await GetMasterDataSetAsync(normalizedKey, null, null, null, httpContext, masterDataService, cancellationToken);
    }

    private static async Task<IResult> ReplaceMasterDataRecordsAsync(
        string key,
        MasterDataRecordsUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleMasterDataService masterDataService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim();
        if (!MasterDataAccess.CanManage(httpContext.User, normalizedKey)) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(normalizedKey) || request.Records is null)
        {
            return Results.BadRequest(new { code = "master_data_records_required" });
        }

        var validRecords = request.Records
            .Where(record => !string.IsNullOrWhiteSpace(record.Code) && !string.IsNullOrWhiteSpace(record.Name))
            .Select(record => new MasterDataRecordInput(
                record.Code!.Trim(),
                record.Name!.Trim(),
                record.Status ?? "Active",
                record.Description ?? string.Empty,
                record.PayloadJson))
            .ToArray();

        var result = await masterDataService.ReplaceRecordsAsync(
            normalizedKey,
            new MasterDataSetDefinition(request.SetName, request.TableName, request.Owner, request.IsReadOnly),
            validRecords,
            cancellationToken);
        if (result.Outcome == MasterDataMutationOutcome.ReadOnly)
        {
            return Results.BadRequest(new { code = "master_data_read_only", key = normalizedKey });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Master Data", $"Replaced {validRecords.Length} records in {normalizedKey}", cancellationToken);
        return await GetMasterDataSetAsync(normalizedKey, null, null, null, httpContext, masterDataService, cancellationToken);
    }

    private static async Task<IResult> PutMasterDataRecordAsync(
        string key,
        string code,
        MasterDataRecordUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleMasterDataService masterDataService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim();
        if (!MasterDataAccess.CanManage(httpContext.User, normalizedKey)) return Results.Forbid();
        var normalizedCode = code.Trim();
        if (string.IsNullOrWhiteSpace(normalizedKey) || string.IsNullOrWhiteSpace(normalizedCode) || string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { code = "master_data_required_fields_missing" });
        }

        var result = await masterDataService.UpsertRecordAsync(
            normalizedKey,
            normalizedCode,
            new MasterDataSetDefinition(request.SetName, request.TableName, request.Owner, request.IsReadOnly),
            new MasterDataRecordInput(
                normalizedCode,
                request.Name.Trim(),
                request.Status ?? "Active",
                request.Description ?? string.Empty,
                request.PayloadJson),
            cancellationToken);
        if (result.Outcome == MasterDataMutationOutcome.ReadOnly)
        {
            return Results.BadRequest(new { code = "master_data_read_only", key = normalizedKey });
        }

        await auditService.WriteAuditAsync(httpContext, "Update", "Master Data", $"Upserted {normalizedKey}:{normalizedCode}", cancellationToken);
        return Results.Ok(new MasterDataRecord(result.Code, result.Name, result.Status, result.Description));
    }

    private static async Task<IResult> DeleteMasterDataRecordAsync(
        string key,
        string code,
        HttpContext httpContext,
        IAdminConsoleMasterDataService masterDataService,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim();
        if (!MasterDataAccess.CanManage(httpContext.User, normalizedKey)) return Results.Forbid();
        var normalizedCode = code.Trim();
        if (string.IsNullOrWhiteSpace(normalizedKey) || string.IsNullOrWhiteSpace(normalizedCode))
        {
            return Results.BadRequest(new { code = "master_data_required_fields_missing" });
        }

        var result = await masterDataService.DeleteRecordAsync(normalizedKey, normalizedCode, cancellationToken);
        if (result.Outcome == DeleteMasterDataRecordOutcome.SetNotFound)
        {
            return Results.NotFound(new { code = "master_data_not_found", key = normalizedKey });
        }

        if (result.Outcome == DeleteMasterDataRecordOutcome.ReadOnly)
        {
            return Results.BadRequest(new { code = "master_data_read_only", key = normalizedKey });
        }

        if (result.Outcome == DeleteMasterDataRecordOutcome.RecordNotFound)
        {
            return Results.NotFound(new { code = "master_data_record_not_found", key = normalizedKey, recordCode = normalizedCode });
        }

        await auditService.WriteAuditAsync(httpContext, "Delete", "Master Data", $"Deleted {normalizedKey}:{normalizedCode}", cancellationToken);
        return Results.NoContent();
    }

    private static IResult GetRegionSyncStatus(IWilayahSyncCoordinator syncCoordinator) =>
        Results.Ok(RegionSyncStatusResponse.From(syncCoordinator.Current));

    private static async Task<IResult> TriggerRegionSyncAsync(
        HttpContext httpContext,
        IWilayahSyncCoordinator syncCoordinator,
        IAdminConsoleAuditService auditService,
        CancellationToken cancellationToken)
    {
        var snapshot = syncCoordinator.Current;
        if (!snapshot.Enabled)
        {
            return Results.BadRequest(new { code = "wilayah_sync_disabled", message = "Region sync is disabled by configuration." });
        }

        if (snapshot.Phase == WilayahSyncPhase.Running)
        {
            // Idempotent: a sync is already in flight — report its status rather than queuing a duplicate.
            return Results.Accepted(value: RegionSyncStatusResponse.From(snapshot));
        }

        syncCoordinator.RequestRun();
        await auditService.WriteAuditAsync(
            httpContext, "Sync", "Administrative Regions", "Requested manual region sync from wilayah.id", cancellationToken);
        return Results.Accepted(value: RegionSyncStatusResponse.From(syncCoordinator.Current));
    }

    private static async Task<IResult> GetUsersAsync(
        IAdminConsoleIdentityReadService identityReadService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var users = await identityReadService.GetUsersAsync(cancellationToken);
        return Results.Ok(await AttachAvatarsAsync(users, storage, configuration, cancellationToken));
    }

    private static async Task<IResult> GetRolesAsync(
        IAdminConsoleIdentityReadService identityReadService,
        CancellationToken cancellationToken)
    {
        var roles = await identityReadService.GetRolesAsync(cancellationToken);
        return Results.Ok(roles);
    }

    private static async Task<IResult> GetPermissionGroupsAsync(
        IAdminConsoleIdentityReadService identityReadService,
        CancellationToken cancellationToken)
    {
        var groups = await identityReadService.GetPermissionGroupsAsync(cancellationToken);
        return Results.Ok(groups.Count == 0 ? AdminConsoleReadModels.PermissionList() : groups);
    }

    private static async Task<IResult> GetRolePermissionMatrixAsync(
        IAdminConsoleIdentityReadService identityReadService,
        CancellationToken cancellationToken)
    {
        var roles = await identityReadService.GetRolesAsync(cancellationToken);
        var permissionGroups = await identityReadService.GetPermissionGroupsAsync(cancellationToken);
        return Results.Ok(new RolePermissionMatrix(
            roles,
            permissionGroups,
            await identityReadService.GetRolePermissionAssignmentsAsync(cancellationToken)));
    }

    private static async Task<IResult> GetUserResultAsync(
        string personnelNo,
        IAdminConsoleIdentityReadService identityReadService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken,
        bool created = false)
    {
        var user = await identityReadService.GetUserAsync(personnelNo, cancellationToken);
        if (user is null)
        {
            return Results.NotFound(new { code = "user_not_found", personnelNo });
        }

        user = await AttachAvatarAsync(user, storage, configuration, cancellationToken);
        return created
            ? Results.Created($"/api/v1/administration/users/{personnelNo}", user)
            : Results.Ok(user);
    }

    private static async Task<IResult> UploadUserAvatarAsync(
        string personnelNo,
        IFormFile? file,
        HttpContext httpContext,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var user = await identityReadService.GetUserAsync(personnelNo, cancellationToken);
        if (user is null)
        {
            return Results.NotFound(new { code = "user_not_found", personnelNo });
        }

        if (!storage.IsConfigured)
        {
            return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var invalid = UserAvatarBlob.ValidateUpload(file);
        if (invalid is not null)
        {
            return invalid;
        }

        var avatarUrl = await UserAvatarBlob.ReplaceAsync(storage, configuration, user.PersonnelNo, file!, cancellationToken);
        await auditService.WriteAuditAsync(httpContext, "Update", "Users", $"Updated avatar for user {user.FullName} ({user.PersonnelNo})", cancellationToken);
        return Results.Ok(new { avatarUrl });
    }

    private static async Task<IResult> DeleteUserAvatarAsync(
        string personnelNo,
        HttpContext httpContext,
        IAdminConsoleIdentityReadService identityReadService,
        IAdminConsoleAuditService auditService,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var user = await identityReadService.GetUserAsync(personnelNo, cancellationToken);
        if (user is null)
        {
            return Results.NotFound(new { code = "user_not_found", personnelNo });
        }

        await UserAvatarBlob.DeleteAsync(storage, configuration, user.PersonnelNo, cancellationToken);
        await auditService.WriteAuditAsync(httpContext, "Update", "Users", $"Removed avatar for user {user.FullName} ({user.PersonnelNo})", cancellationToken);
        return Results.NoContent();
    }

    private static async Task<AdminUserItem> AttachAvatarAsync(
        AdminUserItem user,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var avatarUrl = await UserAvatarBlob.TryReadUrlAsync(storage, configuration, user.PersonnelNo, cancellationToken);
        return user with { AvatarUrl = avatarUrl };
    }

    private static async Task<IReadOnlyCollection<AdminUserItem>> AttachAvatarsAsync(
        IReadOnlyCollection<AdminUserItem> users,
        IDocumentStorage storage,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        if (users.Count == 0 || !storage.IsConfigured)
        {
            return users;
        }

        return await Task.WhenAll(users.Select(user => AttachAvatarAsync(user, storage, configuration, cancellationToken)));
    }

    private static async Task<IResult> GetRoleResultAsync(
        string roleCode,
        IAdminConsoleIdentityReadService identityReadService,
        CancellationToken cancellationToken,
        bool created = false)
    {
        var role = await identityReadService.GetRoleAsync(roleCode, cancellationToken);
        return role is null
            ? Results.NotFound(new { code = "role_not_found", roleCode })
            : created
                ? Results.Created($"/api/v1/administration/roles/{roleCode}", role)
                : Results.Ok(role);
    }

    private static async Task<IResult?> ReplaceJsonCollectionAsync(
        JsonCollectionUpsertRequest request,
        HttpContext httpContext,
        IAdminConsoleAuditService auditService,
        ProcurementDbContext dbContext,
        Func<JsonElement, string?> keySelector,
        string auditModule,
        string auditDescription,
        Func<IReadOnlyCollection<KeyedJsonItem>, DateTimeOffset, Task> replaceAsync,
        CancellationToken cancellationToken)
    {
        if (request.Items is null)
        {
            return Results.BadRequest(new { code = "items_required" });
        }

        var items = request.Items
            .Where(item => item.ValueKind == JsonValueKind.Object)
            .Select(item => new { Key = Clean(keySelector(item)), PayloadJson = item.GetRawText() })
            .Where(item => item.Key is not null)
            .Select(item => new KeyedJsonItem(item.Key!, item.PayloadJson))
            .ToArray();

        var now = DateTimeOffset.UtcNow;
        await replaceAsync(items, now);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.WriteAuditAsync(httpContext, "Update", auditModule, auditDescription, cancellationToken);
        return null;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

}

internal sealed record UpsertUserRequest(
    string? PersonnelNo,
    string? FullName,
    string? Email,
    string? Department,
    string? Position,
    string? Status,
    IReadOnlyCollection<string>? Roles,
    string? ReportTo = null);

internal sealed record SetUserStatusRequest(string? Status);

internal sealed record SetUserRolesRequest(IReadOnlyCollection<string>? Roles);

internal sealed record SetUserPasswordRequest(string? Password);

internal sealed record UpsertRoleRequest(
    string? RoleId,
    string? Code,
    string? Name,
    string? ModuleKey,
    bool? IsSystem,
    IReadOnlyCollection<string>? Permissions);

internal sealed record SetRolePermissionsRequest(IReadOnlyCollection<string>? Permissions);

internal sealed record DuplicateRoleRequest(string? RoleId, string? Code, string? Name);

internal sealed record MenuTreeResponse(
    string? PayloadJson,
    bool HasData,
    DateTimeOffset? UpdatedAt);

internal sealed record JsonCollectionResponse<T>(
    IReadOnlyCollection<T>? Items,
    bool HasData,
    DateTimeOffset? UpdatedAt);

internal sealed record MenuTreeUpsertRequest(string? PayloadJson);

internal sealed record JsonCollectionUpsertRequest(IReadOnlyCollection<JsonElement>? Items);

internal sealed record SettingsResponse(
    IReadOnlyDictionary<string, JsonElement>? Values,
    bool HasData,
    DateTimeOffset? UpdatedAt);

internal sealed record SettingsUpsertRequest(IReadOnlyDictionary<string, JsonElement>? Values);

internal sealed record MasterDataSetResponse(
    string Key,
    string Name,
    string TableName,
    string Owner,
    bool HasData,
    IReadOnlyCollection<MasterDataRecord> Records);

internal sealed record MasterDataRecordsUpsertRequest(
    string? SetName,
    string? TableName,
    string? Owner,
    bool? IsReadOnly,
    IReadOnlyCollection<MasterDataRecordUpsertItem>? Records);

internal sealed record MasterDataRecordUpsertRequest(
    string? SetName,
    string? TableName,
    string? Owner,
    bool? IsReadOnly,
    string? Name,
    string? Status,
    string? Description,
    string? PayloadJson);

internal sealed record MasterDataRecordUpsertItem(
    string? Code,
    string? Name,
    string? Status,
    string? Description,
    string? PayloadJson);

internal sealed record DashboardMetricsResponse(
    int UsersCount,
    int RolesCount,
    int PermissionsCount,
    int LanguagesCount,
    int AuditToday,
    IReadOnlyCollection<DashboardDistributionSlice> RoleDistribution,
    IReadOnlyCollection<DashboardMonthlyPoint> MonthlyActivity,
    IReadOnlyCollection<DashboardActivityItem> RecentActivity);

internal sealed record DashboardDistributionSlice(string Label, int Value);

internal sealed record DashboardMonthlyPoint(string Month, int Year, int Count);

internal sealed record DashboardActivityItem(string User, string Action, string Module, string Description, string Time, string Tone);

internal sealed record RegionSyncStatusResponse(
    string Phase,
    bool Enabled,
    bool Running,
    string? Trigger,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? LastSyncAt,
    int Provinces,
    int Regencies,
    int Districts,
    int Villages,
    string? CurrentStep,
    string? StepKey,
    int ProgressPercent,
    int ProgressDone,
    int ProgressTotal,
    string? Error,
    string? SourceUpdatedAt)
{
    public static RegionSyncStatusResponse From(WilayahSyncSnapshot snapshot) => new(
        snapshot.Phase.ToString(),
        snapshot.Enabled,
        snapshot.Phase == WilayahSyncPhase.Running,
        snapshot.Trigger,
        snapshot.StartedAt,
        snapshot.FinishedAt,
        snapshot.LastSuccessAt,
        snapshot.Provinces,
        snapshot.Regencies,
        snapshot.Districts,
        snapshot.Villages,
        snapshot.CurrentStep,
        snapshot.StepKey,
        snapshot.ProgressPercent,
        snapshot.ProgressDone,
        snapshot.ProgressTotal,
        snapshot.Error,
        WilayahDatasetStamp.Format(snapshot.SourceUpdatedAt));
}

