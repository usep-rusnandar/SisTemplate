namespace IntegratedProcurement.AppHost.Api.Endpoints;

using System.Text;
using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Certificates;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Documents;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.VendorIdentity.Application;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// External vendor self-service ("vendor portal"). Every route is scoped to the vendor company the
/// authenticated <see cref="AuthorizationPolicies.VendorUser"/> belongs to — the owning vendor id is
/// resolved from the principal and is never taken from the route or body, so a vendor can only ever
/// read/write its own registration profile and documents. Thin: all logic lives in the module
/// use-cases (<see cref="VendorProfileService"/>, <see cref="VendorDocumentService"/>).
/// </summary>
public static class VendorPortalEndpoints
{
    private const string VendorModule = "vendorOnboarding";

    public static IEndpointRouteBuilder MapVendorPortalEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/vendor-portal")
            .WithTags("Vendor Portal")
            .RequireAuthorization(AuthorizationPolicies.VendorUser);

        // Load the current vendor's own registration profile (scalars + addresses + child collections).
        group.MapGet("/profile", async (
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            VendorProfileService profiles,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var dto = await profiles.GetAsync(vendorId, cancellationToken);
            return dto is null ? Results.NotFound(new { code = "vendor_not_found" }) : Results.Ok(dto);
        });

        // Current e-certificate for the signed-in vendor. The vendor id always comes from the
        // authenticated account, never from the route, so certificates cannot be read cross-company.
        group.MapGet("/certificate", async (
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            VendorCertificateService certificates,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var dto = await certificates.GetForVendorAsync(vendorId, cancellationToken);
            return dto is null ? Results.NoContent() : Results.Ok(dto);
        });

        // Read-only master-data lookup for the registration wizard (countries, regions, commodity tree,
        // brands, KBLI, …). The internal /api/v1/master-data group is InternalUser-only, so vendors need
        // this vendor-scoped mirror to populate their own registration form. Reference data only.
        group.MapGet("/master-data/{key}", async (
            string key,
            string? parent,
            string? search,
            int? take,
            IAdminConsoleMasterDataService masterData,
            CancellationToken cancellationToken) =>
        {
            var set = await masterData.GetSetAsync(key, parent, search, take, cancellationToken);
            return set is null
                ? Results.Ok(new { records = Array.Empty<object>() })
                : Results.Ok(new { records = set.Records });
        });

        // Azure Maps config for the location picker. Key is read from server config (never hard-coded);
        // an empty key tells the client to fall back to manual lat/lng entry.
        group.MapGet("/map-config", (IConfiguration configuration) =>
            Results.Ok(new
            {
                subscriptionKey = configuration["AzureMaps:SubscriptionKey"] ?? string.Empty,
                country = configuration["AzureMaps:CountrySet"] ?? "IDN",
            }));

        // Save the current vendor's own registration profile (editable only while registering/revising).
        group.MapPut("/profile", async (
            SaveVendorProfileCommand body,
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            VendorProfileService profiles,
            IVendorOnboardingMailer mailer,
            CancellationToken cancellationToken) =>
        {
            if (body is null)
            {
                return Results.BadRequest(new { code = "vendor_profile_invalid" });
            }

            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var command = body with
            {
                VendorId = vendorId,
                // VENDOR_STATUS_T records who acted. Use the signed-in portal account rather than the
                // company: for a vendor's primary account the two are the same string by the legacy
                // convention, but a second account would otherwise be logged as the primary PIC.
                Actor = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? vendorId,
                RequireEditableStatus = true,
            };
            var result = await profiles.SaveAsync(command, cancellationToken);
            if (!result.Found)
            {
                return Results.NotFound(new { code = "vendor_not_found" });
            }

            if (result.NotEditable)
            {
                return Results.Conflict(new { code = "vendor_not_editable", status = result.Status });
            }

            if (result.ValidationErrors is { Count: > 0 })
            {
                return Results.BadRequest(new { code = "kbli_rule_unsatisfied", errors = result.ValidationErrors });
            }

            if (body.Submit && !string.IsNullOrWhiteSpace(result.ApproverRoleCode))
            {
                await mailer.NotifySubmissionAsync(result, cancellationToken);
            }

            return Results.Ok(new { result.VendorId, result.Status });
        });

        var documents = group.MapGroup("/documents");

        // Upload a file to the vendor Blob container and record it against the current vendor.
        documents.MapPost("/upload", async (
            IFormFile? file,
            HttpRequest request,
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            IDocumentStorage storage,
            VendorDocumentService docs,
            VendorOfficerPortfolioService officerPortfolios,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            if (file is null || file.Length == 0)
            {
                return Results.BadRequest(new { code = "file_required" });
            }

            var docType = request.Form["docType"].ToString().Trim();
            if (string.IsNullOrEmpty(docType))
            {
                return Results.BadRequest(new { code = "doc_type_required" });
            }

            // The extension/size rules are enforced HERE, not just in the browser: the portal's
            // pre-check is a courtesy, this is what protects the store. See VendorDocumentRules.
            // Reject an illegal file before asking whether Blob is configured, so the caller
            // sees file_too_large rather than a storage outage.
            if (VendorDocumentRules.Validate(docType, file.FileName, file.Length) is var rejection && rejection is not null)
            {
                return Results.BadRequest(new { code = rejection.Value.Code, message = rejection.Value.Message });
            }

            if (!storage.IsConfigured)
            {
                return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var ownerKeyRaw = request.Form["ownerKey"].ToString().Trim();
            var ownerKey = ownerKeyRaw.Length == 0 ? null : ownerKeyRaw;

            if (await IsOfficerOwnedPortfolioSlotAsync(vendorId, docType, ownerKey, officerPortfolios, cancellationToken))
            {
                return OfficerOwnedPortfolioSlot();
            }

            var container = storage.ContainerForModule(VendorModule);
            var blobKey = $"{vendorId}/{Slug(docType)}/{Guid.NewGuid():N}-{SafeFileName(file.FileName)}";

            await using var stream = file.OpenReadStream();
            var uploaded = await storage.UploadAsync(
                container,
                blobKey,
                stream,
                string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                cancellationToken);

            var dto = await docs.RecordAsync(
                new RecordVendorDocumentCommand(
                    vendorId, docType, ownerKey, file.FileName,
                    uploaded.ContentType, uploaded.Size, uploaded.Container, uploaded.BlobKey,
                    user.Identity?.Name),
                cancellationToken);

            return Results.Ok(dto);
        })
        .DisableAntiforgery()
        // Match Program.cs MaxUploadBodyBytes (32 MB). Prevents the default ~28 MB IIS/Kestrel
        // caps from rejecting akta / multi-MB PDFs that VendorDocumentRules already allow.
        .WithMetadata(new RequestSizeLimitAttribute(32 * 1024 * 1024));

        // Begin a direct-to-Blob upload (write SAS). Used by the vendor portal so multi-MB files
        // go browser→Blob instead of browser→gateway→AppHost→Blob.
        documents.MapPost("/upload-session", async (
            BeginVendorDocumentUploadRequest body,
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            IDocumentStorage storage,
            VendorOfficerPortfolioService officerPortfolios,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var docType = (body.DocType ?? string.Empty).Trim();
            var fileName = (body.FileName ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(docType))
            {
                return Results.BadRequest(new { code = "doc_type_required" });
            }

            if (VendorDocumentRules.Validate(docType, fileName, body.Size) is var rejection && rejection is not null)
            {
                return Results.BadRequest(new { code = rejection.Value.Code, message = rejection.Value.Message });
            }

            if (await IsOfficerOwnedPortfolioSlotAsync(vendorId, docType, body.OwnerKey, officerPortfolios, cancellationToken))
            {
                return OfficerOwnedPortfolioSlot();
            }

            if (!storage.IsConfigured)
            {
                return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var container = storage.ContainerForModule(VendorModule);
            var blobKey = $"{vendorId}/{Slug(docType)}/{Guid.NewGuid():N}-{SafeFileName(fileName)}";
            var ttl = TimeSpan.FromMinutes(15);
            var sasUri = await storage.TryCreateWriteSasUriAsync(container, blobKey, ttl, cancellationToken);
            var uploadUrl = sasUri?.ToString() ?? DocumentReadLinks.VendorProxyUploadUrl(container, blobKey);
            return Results.Ok(new
            {
                uploadUrl,
                container,
                blobKey,
                mode = sasUri is null ? "proxy" : "sas",
                expiresAt = DateTimeOffset.UtcNow.Add(ttl),
            });
        });

        // Browser PUT of file bytes when User Delegation write SAS cannot be signed.
        // Same cookie-auth vendor scope as the rest of this group.
        documents.MapPut("/upload-bytes", UploadVendorDocumentBytesAsync)
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(32 * 1024 * 1024));

        // After the browser PUTs bytes to the write SAS, record the blob against the vendor slot.
        documents.MapPost("/complete-upload", async (
            CompleteVendorDocumentUploadRequest body,
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            IDocumentStorage storage,
            VendorDocumentService docs,
            VendorOfficerPortfolioService officerPortfolios,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            if (!storage.IsConfigured)
            {
                return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var docType = (body.DocType ?? string.Empty).Trim();
            var fileName = (body.FileName ?? string.Empty).Trim();
            var container = (body.Container ?? string.Empty).Trim();
            var blobKey = (body.BlobKey ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(docType) || string.IsNullOrEmpty(fileName)
                || string.IsNullOrEmpty(container) || string.IsNullOrEmpty(blobKey))
            {
                return Results.BadRequest(new { code = "upload_incomplete" });
            }

            // Blob keys are minted as "{vendorId}/…"; reject cross-vendor keys even with a valid SAS leftover.
            if (!blobKey.StartsWith(vendorId + "/", StringComparison.Ordinal))
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var expectedContainer = storage.ContainerForModule(VendorModule);
            if (!string.Equals(container, expectedContainer, StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { code = "container_mismatch" });
            }

            var uploaded = await storage.TryGetAsync(container, blobKey, cancellationToken);
            if (uploaded is null || uploaded.Size <= 0)
            {
                return Results.BadRequest(new { code = "blob_missing", message = "Upload to storage did not complete." });
            }

            if (VendorDocumentRules.Validate(docType, fileName, uploaded.Size) is var rejection && rejection is not null)
            {
                await storage.DeleteAsync(container, blobKey, cancellationToken);
                return Results.BadRequest(new { code = rejection.Value.Code, message = rejection.Value.Message });
            }

            var ownerKeyRaw = (body.OwnerKey ?? string.Empty).Trim();
            var ownerKey = ownerKeyRaw.Length == 0 ? null : ownerKeyRaw;
            if (await IsOfficerOwnedPortfolioSlotAsync(vendorId, docType, ownerKey, officerPortfolios, cancellationToken))
            {
                return OfficerOwnedPortfolioSlot();
            }

            var contentType = string.IsNullOrWhiteSpace(body.ContentType)
                ? uploaded.ContentType
                : body.ContentType.Trim();

            var dto = await docs.RecordAsync(
                new RecordVendorDocumentCommand(
                    vendorId, docType, ownerKey, fileName,
                    contentType, uploaded.Size, uploaded.Container, uploaded.BlobKey,
                    user.Identity?.Name),
                cancellationToken);

            return Results.Ok(dto);
        });

        // The upload rules themselves, so the portal shows the same limits it will be held to instead
        // of keeping its own copy that can drift.
        documents.MapGet("/rules", () => Results.Ok(
            VendorDocumentRules.All.Select(rule => new
            {
                docType = rule.DocumentType,
                accept = rule.Extensions,
                maxBytes = rule.MaxBytes,
            })));

        // List the current vendor's documents.
        documents.MapGet("", async (
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            VendorDocumentService docs,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            return vendorId is null
                ? Results.StatusCode(StatusCodes.Status403Forbidden)
                : Results.Ok(await docs.ListAsync(vendorId, cancellationToken));
        });

        // Short-lived read SAS URL for one of the current vendor's own documents.
        documents.MapGet("/{documentId:guid}/download", async (
            Guid documentId,
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            VendorDocumentService docs,
            IDocumentStorage storage,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var doc = await docs.GetAsync(vendorId, documentId, cancellationToken);
            if (doc is null)
            {
                return Results.NotFound(new { code = "vendor_document_not_found" });
            }

            if (!storage.IsConfigured)
            {
                return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var fallback = $"/api/v1/vendor-portal/documents/{documentId:D}/file";
            return await DocumentReadLinks.JsonUrlAsync(
                storage, doc.Container, doc.BlobKey, fallback, cancellationToken);
        });

        documents.MapGet("/{documentId:guid}/file", async (
            Guid documentId,
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            VendorDocumentService docs,
            IDocumentStorage storage,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var doc = await docs.GetAsync(vendorId, documentId, cancellationToken);
            if (doc is null)
            {
                return Results.NotFound(new { code = "vendor_document_not_found" });
            }

            if (!storage.IsConfigured)
            {
                return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            return await DocumentReadLinks.StreamAsync(storage, doc.Container, doc.BlobKey, cancellationToken);
        });

        // Delete one of the current vendor's documents (also removes the blob).
        documents.MapDelete("/{documentId:guid}", async (
            Guid documentId,
            System.Security.Claims.ClaimsPrincipal user,
            IVendorAuthService vendorAuth,
            VendorDocumentService docs,
            VendorOfficerPortfolioService officerPortfolios,
            CancellationToken cancellationToken) =>
        {
            var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
            if (vendorId is null)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var existing = await docs.GetAsync(vendorId, documentId, cancellationToken);
            if (existing is null)
            {
                return Results.NotFound(new { code = "vendor_document_not_found" });
            }

            if (await IsOfficerOwnedPortfolioSlotAsync(vendorId, existing.DocumentType, existing.OwnerKey, officerPortfolios, cancellationToken))
            {
                return OfficerOwnedPortfolioSlot();
            }

            return await docs.DeleteAsync(vendorId, documentId, cancellationToken)
                ? Results.NoContent()
                : Results.NotFound(new { code = "vendor_document_not_found" });
        });

        return endpoints;
    }

    private static async Task<IResult> UploadVendorDocumentBytesAsync(
        string container,
        string key,
        HttpRequest request,
        System.Security.Claims.ClaimsPrincipal user,
        IVendorAuthService vendorAuth,
        IDocumentStorage storage,
        CancellationToken cancellationToken)
    {
        var vendorId = await vendorAuth.GetCurrentVendorIdAsync(user, cancellationToken);
        if (vendorId is null)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        if (!storage.IsConfigured)
        {
            return Results.Problem("Document storage is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var blobKey = (key ?? string.Empty).Trim();
        var blobContainer = (container ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(blobContainer) || string.IsNullOrWhiteSpace(blobKey))
        {
            return Results.BadRequest(new { code = "upload_incomplete" });
        }

        if (!blobKey.StartsWith(vendorId + "/", StringComparison.Ordinal))
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        var expectedContainer = storage.ContainerForModule(VendorModule);
        if (!string.Equals(blobContainer, expectedContainer, StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { code = "container_mismatch" });
        }

        var contentType = string.IsNullOrWhiteSpace(request.ContentType)
            ? "application/octet-stream"
            : request.ContentType.Split(';')[0].Trim();
        if (string.IsNullOrWhiteSpace(contentType) || contentType.Equals("application/x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase))
        {
            contentType = "application/octet-stream";
        }

        var uploaded = await storage.UploadAsync(blobContainer, blobKey, request.Body, contentType, cancellationToken);
        return Results.Ok(new { container = uploaded.Container, blobKey = uploaded.BlobKey, size = uploaded.Size });
    }

    private static async Task<bool> IsOfficerOwnedPortfolioSlotAsync(
        string vendorId,
        string? docType,
        string? ownerKey,
        VendorOfficerPortfolioService officerPortfolios,
        CancellationToken cancellationToken) =>
        docType is not null
        && docType.Equals("portfolio", StringComparison.OrdinalIgnoreCase)
        && await officerPortfolios.IsSlotOwnedByPartyAsync(
            vendorId, ownerKey, VendorPortfolioParties.Officer, cancellationToken);

    private static IResult OfficerOwnedPortfolioSlot() =>
        Results.Json(
            new
            {
                code = "portfolio_officer_owned",
                message = "This portfolio was entered by an Officer and cannot be changed from the vendor portal.",
            },
            statusCode: StatusCodes.Status403Forbidden);

    private sealed record BeginVendorDocumentUploadRequest(
        string? DocType,
        string? OwnerKey,
        string? FileName,
        string? ContentType,
        long Size);

    private sealed record CompleteVendorDocumentUploadRequest(
        string? DocType,
        string? OwnerKey,
        string? FileName,
        string? ContentType,
        string? Container,
        string? BlobKey);

    private static string SafeFileName(string fileName)
    {
        var name = Path.GetFileName(fileName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(name))
        {
            return "document";
        }

        var builder = new StringBuilder(name.Length);
        foreach (var ch in name)
        {
            builder.Append(char.IsLetterOrDigit(ch) || ch is '.' or '-' or '_' ? ch : '-');
        }

        return builder.ToString();
    }

    private static string Slug(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "doc";
        }

        var builder = new StringBuilder(value.Length);
        foreach (var ch in value.Trim())
        {
            builder.Append(char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '-');
        }

        var slug = builder.ToString();
        return slug.Length == 0 ? "doc" : slug;
    }
}
