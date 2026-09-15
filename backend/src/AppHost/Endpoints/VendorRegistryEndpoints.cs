namespace IntegratedProcurement.AppHost.Api.Endpoints;

using System.Security.Claims;
using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.BuildingBlocks.Application.Security;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Certificates;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Documents;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.VendorIdentity.Application;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Internal vendor registry + approval workflow (procurement reviewers). Lists vendors, shows the full
/// profile / documents / status trail, and drives the review FSM (approve / reject / request revision /
/// blacklist). Thin — transition rules live in the Vendor aggregate, use-cases in the module Application.
/// </summary>
public static class VendorRegistryEndpoints
{
    public static IEndpointRouteBuilder MapVendorRegistryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/vendor-onboarding/vendors")
            .WithTags("Vendor Registry")
            .RequireAuthorization(AuthorizationPolicies.InternalUser);

        group.AddEndpointFilter(async (context, next) =>
        {
            var currentActor = context.HttpContext.RequestServices.GetRequiredService<ICurrentActor>();
            return HasAnyVendorAccess(currentActor)
                ? await next(context)
                : Results.StatusCode(StatusCodes.Status403Forbidden);
        });

        group.MapGet("", async (string? status, string? search, VendorReviewService review, CancellationToken ct) =>
            Results.Ok(await review.ListAsync(status, search, ct)));

        group.MapGet("/database", async (
            string? status,
            string? search,
            int? page,
            int? pageSize,
            string? sortBy,
            string? sortDir,
            IVendorRegistryReadPort registry,
            CancellationToken ct) =>
        {
            var statuses = string.IsNullOrWhiteSpace(status) || status.Equals("all", StringComparison.OrdinalIgnoreCase)
                ? null
                : new[] { status.Trim() };
            return Results.Ok(await registry.ReadAsync(
                new VendorRegistryQuery(search, statuses, page ?? 1, pageSize ?? 50, SortBy: sortBy, SortDir: sortDir), ct));
        });

        group.MapGet("/database/export", async (
            string? status,
            string? search,
            string? language,
            IVendorDatabaseExportService exporter,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            if (!HasPermission(currentActor, PermissionKeys.VendorOnboardingView))
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var file = await exporter.ExportAsync(
                new VendorDatabaseExportQuery(search, status, language ?? "en"),
                ct);
            return Results.File(file.Content, file.ContentType, file.FileName);
        });

        // Count only, for the menu badge: how many vendors are waiting on THIS user's approval roles.
        group.MapGet("/approval-queue/count", async (
            IVendorRegistryReadPort registry,
            VendorApprovalService approvals,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            if (!HasPermission(currentActor, PermissionKeys.VendorOnboardingApprove))
            {
                return Results.Ok(new { count = 0 });
            }

            var roleCodes = await approvals.GetActorRoleCodesAsync(currentActor.Actor.ActorId, ct);
            return Results.Ok(new { count = await registry.CountAwaitingApprovalAsync(roleCodes, ct) });
        });

        group.MapGet("/approval-queue", async (
            string? search,
            int? page,
            int? pageSize,
            bool? overdueOnly,
            IVendorRegistryReadPort registry,
            VendorApprovalService approvals,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            if (!HasPermission(currentActor, PermissionKeys.VendorOnboardingApprove))
            {
                return Results.Ok(new VendorRegistryPageDto([], 0, Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? 50, 10, 200)));
            }

            var roleCodes = await approvals.GetActorRoleCodesAsync(currentActor.Actor.ActorId, ct);
            return Results.Ok(await registry.ReadAsync(
                new VendorRegistryQuery(search, null, page ?? 1, pageSize ?? 50, roleCodes, overdueOnly ?? false), ct));
        });

        // Vendor lifecycle status labels from Master Data ▸ Vendor Status. Every reviewer needs these to
        // read a badge, so it is gated on plain vendor view access rather than a master-data permission.
        group.MapGet("/statuses", async (
            IVendorStatusCatalogReadPort statuses,
            ICurrentActor currentActor,
            CancellationToken ct) =>
            HasPermission(currentActor, PermissionKeys.VendorOnboardingView)
                ? Results.Ok(await statuses.ReadAsync(ct))
                : Results.StatusCode(StatusCodes.Status403Forbidden));

        // Internal reviewer mirror of the vendor portal's read-only map configuration. The browser
        // uses this to render the same right-hand static-map preview as Vendor Workspace.
        group.MapGet("/map-config", (IConfiguration configuration) =>
            Results.Ok(new
            {
                subscriptionKey = configuration["AzureMaps:SubscriptionKey"] ?? string.Empty,
                country = configuration["AzureMaps:CountrySet"] ?? "IDN",
            }));

        group.MapGet("/{vendorId}", async (string vendorId, VendorProfileService profiles, CancellationToken ct) =>
        {
            var dto = await profiles.GetAsync(vendorId, ct);
            return dto is null ? Results.NotFound(new { code = "vendor_not_found" }) : Results.Ok(dto);
        });

        group.MapGet("/{vendorId}/documents", async (string vendorId, VendorDocumentService docs, CancellationToken ct) =>
            Results.Ok(await docs.ListAsync(vendorId, ct)));

        group.MapGet("/{vendorId}/documents/{documentId:guid}/download", async (
            string vendorId,
            Guid documentId,
            VendorDocumentService docs,
            IDocumentStorage storage,
            CancellationToken ct) =>
        {
            var doc = await docs.GetAsync(vendorId, documentId, ct);
            if (doc is null)
            {
                return Results.NotFound(new { code = "vendor_document_not_found" });
            }

            if (!storage.IsConfigured)
            {
                return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            if (string.IsNullOrWhiteSpace(doc.Container) || string.IsNullOrWhiteSpace(doc.BlobKey))
            {
                return Results.NotFound(new { code = "document_not_found" });
            }

            var fallback = $"/api/v1/vendor-onboarding/vendors/{Uri.EscapeDataString(vendorId)}/documents/{documentId:D}/file";
            return await DocumentReadLinks.JsonUrlAsync(storage, doc.Container, doc.BlobKey, fallback, ct);
        });

        group.MapGet("/{vendorId}/documents/{documentId:guid}/file", async (
            string vendorId,
            Guid documentId,
            VendorDocumentService docs,
            IDocumentStorage storage,
            CancellationToken ct) =>
        {
            var doc = await docs.GetAsync(vendorId, documentId, ct);
            if (doc is null)
            {
                return Results.NotFound(new { code = "vendor_document_not_found" });
            }

            if (!storage.IsConfigured)
            {
                return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            return await DocumentReadLinks.StreamAsync(storage, doc.Container, doc.BlobKey, ct);
        });

        group.MapPost("/{vendorId}/portfolios", async (
            string vendorId,
            SaveOfficerPortfolioCommand? body,
            VendorOfficerPortfolioService portfolios,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            if (body is null)
            {
                return Results.BadRequest(new { code = "portfolio_invalid" });
            }

            return ToOfficerPortfolioResult(
                await portfolios.CreateAsync(vendorId, body, currentActor.Actor.ActorId, ct));
        });

        group.MapPut("/{vendorId}/portfolios/{portfolioId:guid}", async (
            string vendorId,
            Guid portfolioId,
            SaveOfficerPortfolioCommand? body,
            VendorOfficerPortfolioService portfolios,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            if (body is null)
            {
                return Results.BadRequest(new { code = "portfolio_invalid" });
            }

            return ToOfficerPortfolioResult(
                await portfolios.UpdateAsync(vendorId, portfolioId, body, currentActor.Actor.ActorId, ct));
        });

        group.MapDelete("/{vendorId}/portfolios/{portfolioId:guid}", async (
            string vendorId,
            Guid portfolioId,
            VendorOfficerPortfolioService portfolios,
            ICurrentActor currentActor,
            CancellationToken ct) =>
            ToOfficerPortfolioResult(
                await portfolios.DeleteAsync(vendorId, portfolioId, currentActor.Actor.ActorId, ct),
                noContent: true));

        group.MapPost("/{vendorId}/portfolio-documents", async (
            string vendorId,
            IFormFile? file,
            HttpRequest request,
            VendorOfficerPortfolioService portfolios,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
            {
                return Results.BadRequest(new { code = "file_required" });
            }

            var ownerKey = request.Form["ownerKey"].ToString().Trim();
            await using var stream = file.OpenReadStream();
            return ToOfficerPortfolioResult(
                await portfolios.UploadDocumentAsync(
                    vendorId,
                    ownerKey,
                    file.FileName,
                    file.ContentType,
                    file.Length,
                    stream,
                    currentActor.Actor.ActorId,
                    ct));
        })
        .DisableAntiforgery()
        .WithMetadata(new RequestSizeLimitAttribute(32 * 1024 * 1024));

        group.MapDelete("/{vendorId}/portfolio-documents/{documentId:guid}", async (
            string vendorId,
            Guid documentId,
            VendorOfficerPortfolioService portfolios,
            ICurrentActor currentActor,
            CancellationToken ct) =>
            ToOfficerPortfolioResult(
                await portfolios.DeleteDocumentAsync(vendorId, documentId, currentActor.Actor.ActorId, ct),
                noContent: true));

        group.MapGet("/{vendorId}/history", async (
            string vendorId,
            VendorReviewService review,
            IVendorActorNameReadPort actorNameReader,
            CancellationToken ct) =>
        {
            var history = await review.GetHistoryAsync(vendorId, ct);
            // Internal personnel, vendor portal accounts and account-less vendor ids all end up in
            // CreatedBy; one resolver knows all three (see IVendorActorNameReadPort).
            var actorNames = await actorNameReader.ResolveAsync(
                history.Select(item => item.CreatedBy).ToArray(), ct);

            return Results.Ok(history.Select(item => new
            {
                item.StatusCode,
                item.CreatedBy,
                actorName = item.CreatedBy is not null && actorNames.TryGetValue(item.CreatedBy, out var name) ? name : null,
                item.Reason,
                item.ChangedAt,
            }));
        });

        group.MapGet("/{vendorId}/approval-context", async (
            string vendorId,
            VendorReviewService review,
            ICurrentActor currentActor,
            CancellationToken ct) =>
            Results.Ok(await review.GetApprovalContextAsync(vendorId, currentActor.Actor, ct)));

        // Login-account state for the vendor. Vendors sign in with an ASP.NET Identity account
        // (VendorIdentityUser); internal users are SSO-only and never appear here. Returns [] when
        // the vendor has not registered an account yet.
        group.MapGet("/{vendorId}/account", async (
            string vendorId,
            IVendorAccountAdminService accounts,
            CancellationToken ct) =>
            Results.Ok(await accounts.ListAccountsAsync(vendorId, ct)));

        // Manually clear the lockout for a vendor's login account(s) before the auto-unlock window
        // (Settings ▸ Security ▸ lockDuration) elapses. Resets the lockout end + failed-attempt counter.
        group.MapPost("/{vendorId}/unlock-account", async (
            string vendorId,
            IVendorAccountAdminService accounts,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            if (!HasPermission(currentActor, PermissionKeys.VendorOnboardingManage))
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var result = await accounts.UnlockAccountsAsync(vendorId, ct);
            if (!result.Found)
            {
                return Results.NotFound(new { code = "vendor_account_not_found" });
            }

            return Results.Ok(new { vendorId, unlocked = result.Unlocked, accounts = result.Accounts });
        });

        // Imported Ariba accounts have no password by design. Officers send the standard, expiring
        // password-reset link; they never choose or communicate a shared initial password.
        group.MapPost("/{vendorId}/send-activation-link", async (
            string vendorId,
            IVendorAccountAdminService accounts,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            if (!HasPermission(currentActor, PermissionKeys.VendorOnboardingImport)
                && !HasPermission(currentActor, PermissionKeys.VendorOnboardingManage))
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var result = await accounts.SendActivationLinkAsync(vendorId, ct);
            if (!result.Found)
            {
                return Results.NotFound(new { code = "vendor_account_not_found" });
            }

            return Results.Ok(new { vendorId, email = result.Email, status = result.Status, result.ResetToken });
        });

        // Current e-certificate for a vendor (204 when none issued yet).
        group.MapGet("/{vendorId}/certificate", async (string vendorId, VendorCertificateService certificates, CancellationToken ct) =>
        {
            var dto = await certificates.GetForVendorAsync(vendorId, ct);
            return dto is null ? Results.NoContent() : Results.Ok(dto);
        });

        // Issue the e-certificate (only from Approved) — generates the QR PDF, stores it, and registers the vendor.
        group.MapPost("/{vendorId}/issue-certificate", async (
            string vendorId,
            HttpRequest request,
            ClaimsPrincipal user,
            VendorCertificateService certificates,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            // Registering an approved vendor is the Officer's step, not general vendor administration.
            if (!HasPermission(currentActor, PermissionKeys.VendorOnboardingRegister))
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var verifyBaseUrl = $"{request.Scheme}://{request.Host}/api/v1/public/vendor-certificate/verify";
            var result = await certificates.IssueAsync(vendorId, user.FindFirstValue(AppClaimTypes.PersonnelNo) ?? user.Identity?.Name, verifyBaseUrl, DateTimeOffset.UtcNow, ct);
            if (!result.Found)
            {
                return Results.NotFound(new { code = "vendor_not_found" });
            }

            return result.Ok
                ? Results.Ok(new { vendorId, result.Status, certificate = result.Certificate })
                : Results.Conflict(new { code = "certificate_not_issuable", message = result.Error, status = result.Status });
        });

        MapAction(group, "approve", (s, id, actor, reason, ct) => s.ApproveAsync(id, actor, reason, ct));
        MapAction(group, "reject", (s, id, actor, reason, ct) => s.RejectAsync(id, actor, reason, ct));
        MapAction(group, "request-revision", (s, id, actor, reason, ct) => s.RequestRevisionAsync(id, actor, reason, ct));
        MapAction(group, "blacklist", (s, id, actor, reason, ct) => s.BlacklistAsync(id, actor.ActorId, reason, ct));
        MapAction(group, "unblacklist", (s, id, actor, reason, ct) => s.UnblacklistAsync(id, actor.ActorId, reason, ct));

        return endpoints;
    }

    private static void MapAction(
        RouteGroupBuilder group,
        string verb,
        Func<VendorReviewService, string, CurrentActor, string?, CancellationToken, Task<VendorReviewResult>> act)
    {
        group.MapPost($"/{{vendorId}}/{verb}", async (
            string vendorId,
            VendorReviewActionRequest? body,
            VendorReviewService review,
            IVendorOnboardingMailer mailer,
            ICurrentActor currentActor,
            CancellationToken ct) =>
        {
            var requiredPermission = verb is "blacklist" or "unblacklist"
                ? PermissionKeys.VendorOnboardingManage
                : PermissionKeys.VendorOnboardingApprove;
            if (!HasPermission(currentActor, requiredPermission))
            {
                return Results.Json(
                    new { code = "vendor_step_forbidden", message = $"This step requires the '{requiredPermission}' permission." },
                    statusCode: StatusCodes.Status403Forbidden);
            }

            if (verb is "reject" or "request-revision" && string.IsNullOrWhiteSpace(body?.Reason))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["reason"] = ["A reason is required for rejection or revision."]
                });
            }

            VendorReviewResult result;
            try
            {
                result = await act(review, vendorId, currentActor.Actor, body?.Reason, ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Conflict(new
                {
                    code = "vendor_approval_conflict",
                    message = "This approval step was already changed by another reviewer. Refresh and try again."
                });
            }
            if (!result.Found)
            {
                return Results.NotFound(new { code = "vendor_not_found" });
            }

            if (!result.Ok)
            {
                if (result.Forbidden)
                {
                    return Results.Json(
                        new { code = "vendor_step_forbidden", message = result.Error },
                        statusCode: StatusCodes.Status403Forbidden);
                }
                return Results.Conflict(new { code = "vendor_transition_invalid", message = result.Error, status = result.Status });
            }

            await mailer.NotifyReviewActionAsync(vendorId, verb, result, body?.Reason, ct);
            return Results.Ok(new { vendorId, result.Status });
        });
    }

    private static IResult ToOfficerPortfolioResult(OfficerPortfolioMutationResult result, bool noContent = false)
    {
        if (!result.Found)
        {
            return Results.NotFound(new { code = result.Code });
        }

        if (!result.Ok)
        {
            return Results.Json(
                new { code = result.Code, message = result.Message },
                statusCode: result.StatusCode);
        }

        if (noContent)
        {
            return Results.NoContent();
        }

        return result.Document is not null ? Results.Ok(result.Document) : Results.Ok(result.Portfolio);
    }

    private static bool HasPermission(ICurrentActor currentActor, string permissionKey) =>
        currentActor.Actor.Permissions.Contains(permissionKey, StringComparer.OrdinalIgnoreCase);

    private static bool HasAnyVendorAccess(ICurrentActor currentActor) =>
        VendorAccessPermissions.Any(permission => HasPermission(currentActor, permission));

    private static readonly string[] VendorAccessPermissions =
    [
        PermissionKeys.VendorOnboardingView,
        PermissionKeys.VendorOnboardingManage,
        PermissionKeys.VendorOnboardingApprove,
        PermissionKeys.VendorOnboardingApprove1,
        PermissionKeys.VendorOnboardingApprove2,
        PermissionKeys.VendorOnboardingApproveFinal,
    ];

    private sealed record VendorReviewActionRequest(string? Reason);
}
