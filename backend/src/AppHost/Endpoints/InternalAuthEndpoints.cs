using System.Security.Claims;
using SisTemplate.BuildingBlocks.Application;
using SisTemplate.BuildingBlocks.Application.Abstractions;
using SisTemplate.BuildingBlocks.Application.Security;
using SisTemplate.AppHost.Api.Auth;
using SisTemplate.AppHost.Api.Services;
using SisTemplate.Platform.Administration.Application;
using SisTemplate.Platform.Documents.Application;
using SisTemplate.Platform.InternalIdentity.Application.Access;
using SisTemplate.Platform.InternalIdentity.Application.Auth;
using SisTemplate.Platform.InternalIdentity.Application.Profiles;
using SisTemplate.Platform.InternalIdentity.Application.Sso;
using SisTemplate.Platform.InternalIdentity.Domain;
using SisTemplate.Platform.InternalIdentity.Infrastructure.Sso;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace SisTemplate.AppHost.Api.Endpoints;

public static class InternalAuthEndpoints
{
    public static IEndpointRouteBuilder MapInternalAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/internal")
            .WithTags("Internal Auth");

        group.MapGet("/auth/me", async (
            HttpContext httpContext,
            ICurrentActor currentActor,
            IInternalUserProfileReader profileReader,
            IOptions<SsoOptions> ssoOptions,
            IDocumentStorage storage,
            IConfiguration configuration,
            CancellationToken cancellationToken) =>
        {
            var personnelNo = httpContext.Session.GetString(SsoSessionKeys.PersonnelNo);
            var isInternal = currentActor.Actor.ActorType == ActorType.Internal && !string.IsNullOrWhiteSpace(personnelNo);
            if (isInternal)
            {
                var denied = DenyIfPortalUnauthorized(httpContext, currentActor.Actor.Permissions);
                if (denied is not null)
                {
                    ClearInternalSession(httpContext);
                    return denied;
                }
            }

            var user = isInternal
                ? await profileReader.FindByPersonnelNoAsync(personnelNo!, cancellationToken)
                : null;

            // Avatar lives in Blob (per personnelNo); return a short-lived read URL, or null when unset.
            string? avatarUrl = isInternal
                ? await UserAvatarBlob.TryReadUrlAsync(storage, configuration, personnelNo ?? string.Empty, cancellationToken)
                : null;

            return Results.Ok(new
            {
                user,
                isAuthenticated = isInternal,
                actorType = currentActor.Actor.ActorType.ToString(),
                currentActor.Actor.ActorId,
                currentActor.Actor.DisplayName,
                roles = currentActor.Actor.Roles,
                permissions = currentActor.Actor.Permissions,
                personnelNo,
                avatarUrl,
                sessionDisplayName = httpContext.Session.GetString(SsoSessionKeys.DisplayName),
                ssoEnabled = ssoOptions.Value.Enabled,
                ssoHomeUrl = ssoOptions.Value.HomeUrl,
                hasLocalPassword = user?.HasLocalPassword ?? false,
                mustChangePassword = user?.MustChangePassword ?? false,
            });
        })
        .WithName("InternalAuthMe");

        // Upload/replace the CURRENT internal user's avatar (own account only — personnelNo comes from
        // the principal, never the request). Stored in Blob at avatars/{personnelNo}; no DB column needed.
        group.MapPost("/auth/avatar", async Task<IResult> (
            IFormFile? file,
            ClaimsPrincipal principal,
            IDocumentStorage storage,
            IConfiguration configuration,
            CancellationToken cancellationToken) =>
        {
            var personnelNo = principal.FindFirstValue(AppClaimTypes.PersonnelNo);
            if (string.IsNullOrWhiteSpace(personnelNo))
            {
                return Results.Unauthorized();
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

            var url = await UserAvatarBlob.ReplaceAsync(storage, configuration, personnelNo, file!, cancellationToken);
            return Results.Ok(new { avatarUrl = url });
        })
        .RequireAuthorization(AuthorizationPolicies.InternalUser)
        .DisableAntiforgery();

        group.MapDelete("/auth/avatar", async (
            ClaimsPrincipal principal,
            IDocumentStorage storage,
            IConfiguration configuration,
            CancellationToken cancellationToken) =>
        {
            var personnelNo = principal.FindFirstValue(AppClaimTypes.PersonnelNo);
            if (string.IsNullOrWhiteSpace(personnelNo))
            {
                return Results.Unauthorized();
            }

            await UserAvatarBlob.DeleteAsync(storage, configuration, personnelNo, cancellationToken);

            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.InternalUser);

        // Effective permissions for any personnel number — used by the Super Admin impersonation
        // feature to render the acted-user's permission-gated menu. Gated by users.view.
        group.MapGet("/auth/effective-permissions/{personnelNo}", async (
            string personnelNo,
            IInternalUserAccessService accessService,
            CancellationToken cancellationToken) =>
            Results.Ok(new { personnelNo, permissions = await accessService.GetEffectivePermissionsAsync(personnelNo, cancellationToken) }))
            .RequirePermission("users.view");

        // Explicit "Continue with SSO" entry point used by the SPA (window.__internalAuth.startSso).
        // Sends the user to SISWarrior with redirectUrl = the incoming portal host when that host is
        // on SSO:AllowedApplicationUrls (else ApplicationUrl). PIC returns ?token=<JWT> to that host.
        // On Suite, SsoMiddleware intercepts token on any path. On a module portal, ModuleGateway
        // rewrites /?token= to this callback (and the SPA does the same if the token is still visible).
        group.MapGet("/sso/login", (HttpContext httpContext, IOptions<SsoOptions> ssoOptions) =>
        {
            var options = ssoOptions.Value;
            if (!options.Enabled)
            {
                return Results.BadRequest(new { code = "sso_disabled", message = "SSO is not enabled in this environment." });
            }

            return Results.Redirect(SsoRedirect.BuildSisWarriorLoginUrl(options, httpContext.Request));
        })
        .WithName("InternalSsoLogin");

        group.MapGet("/sso/callback", (HttpContext httpContext) =>
        {
            // When SSO is on, SsoMiddleware consumes ?token= before this runs and redirects to a
            // clean relative path. If we get here, there was no token (or SSO is off).
            var returnPath = httpContext.Request.Query["return"].FirstOrDefault();
            return Results.Redirect(SsoRedirect.IsSafeRelativeReturnPath(returnPath) ? returnPath! : "/");
        })
        .WithName("InternalSsoCallback");

        group.MapGet("/auth/password-policy", async (
            IAdminConsoleConfigurationService configurationService,
            CancellationToken cancellationToken) =>
        {
            var policy = await AccountPasswordPolicy.ResolveAsync(configurationService, cancellationToken);
            return Results.Ok(new
            {
                minLength = policy.MinLength,
                requireDigit = policy.RequireDigit,
                requireLowercase = policy.RequireLowercase,
                requireUppercase = policy.RequireUppercase,
                requireNonAlphanumeric = policy.RequireNonAlphanumeric,
            });
        })
        .WithName("InternalPasswordPolicy");

        group.MapPost("/auth/login", HandleLocalLoginAsync)
            .WithName("InternalLocalLogin");

        group.MapPost("/auth/change-password", HandleChangePasswordAsync)
            .RequireAuthorization(AuthorizationPolicies.InternalUser)
            .WithName("InternalChangePassword");

        group.MapPost("/auth/verify-password", HandleVerifyPasswordAsync)
            .RequireAuthorization(AuthorizationPolicies.InternalUser)
            .WithName("InternalVerifyPassword");

        group.MapPost("/auth/password-reset/request", HandlePasswordResetRequestAsync)
            .WithName("InternalPasswordResetRequest");

        group.MapPost("/auth/password-reset/confirm", HandlePasswordResetConfirmAsync)
            .WithName("InternalPasswordResetConfirm");

        group.MapPost("/auth/logout", (HttpContext httpContext) =>
        {
            httpContext.Session.Remove(SsoSessionKeys.JwtToken);
            httpContext.Session.Remove(SsoSessionKeys.PersonnelNo);
            httpContext.Session.Remove(SsoSessionKeys.DisplayName);
            return Results.NoContent();
        });
        group.MapPost("/auth/dev-login", HandleDevelopmentLoginAsync);

        return endpoints;
    }

    private static async Task<IResult> HandleLocalLoginAsync(
        InternalLocalLoginRequest request,
        HttpContext httpContext,
        IInternalLocalAuthService localAuth,
        IInternalUserAccessService accessService,
        CancellationToken cancellationToken)
    {
        var identifier = FirstNonEmpty(request.Identifier, request.PersonnelNo, request.Email);
        if (identifier is null || string.IsNullOrEmpty(request.Password))
        {
            return Results.Json(
                new { code = "invalid_credentials" },
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var result = await localAuth.LoginAsync(identifier, request.Password, cancellationToken);
        return result.Status switch
        {
            InternalLocalLoginStatus.Succeeded => await CompleteInternalLoginAsync(
                httpContext,
                accessService,
                result.PersonnelNo!,
                result.DisplayName!,
                result.Email,
                result.MustChangePassword,
                cancellationToken),
            InternalLocalLoginStatus.LockedOut => Results.Json(
                new { code = "account_locked" },
                statusCode: StatusCodes.Status401Unauthorized),
            InternalLocalLoginStatus.Inactive => Results.Json(
                new { code = "internal_user_inactive", title = "This account is not active." },
                statusCode: StatusCodes.Status403Forbidden),
            _ => Results.Json(
                new { code = "invalid_credentials" },
                statusCode: StatusCodes.Status401Unauthorized),
        };
    }

    private static async Task<IResult> HandleChangePasswordAsync(
        InternalChangePasswordRequest request,
        ClaimsPrincipal principal,
        IInternalLocalAuthService localAuth,
        CancellationToken cancellationToken)
    {
        var personnelNo = principal.FindFirstValue(AppClaimTypes.PersonnelNo);
        if (string.IsNullOrWhiteSpace(personnelNo))
        {
            return Results.Unauthorized();
        }

        var result = await localAuth.ChangePasswordAsync(
            personnelNo,
            request.CurrentPassword ?? string.Empty,
            request.NewPassword ?? string.Empty,
            cancellationToken);
        if (result.Succeeded)
        {
            return Results.NoContent();
        }

        var status = result.ErrorCode switch
        {
            "user_not_found" => StatusCodes.Status404NotFound,
            "password_not_set" => StatusCodes.Status400BadRequest,
            "invalid_current_password" => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status400BadRequest,
        };
        return Results.Json(
            new { code = result.ErrorCode, errors = result.Errors },
            statusCode: status);
    }

    private static async Task<IResult> HandleVerifyPasswordAsync(
        InternalVerifyPasswordRequest request,
        ClaimsPrincipal principal,
        IInternalLocalAuthService localAuth,
        CancellationToken cancellationToken)
    {
        var personnelNo = principal.FindFirstValue(AppClaimTypes.PersonnelNo);
        if (string.IsNullOrWhiteSpace(personnelNo))
        {
            return Results.Unauthorized();
        }

        var valid = await localAuth.VerifyPasswordAsync(
            personnelNo,
            request.Password ?? string.Empty,
            cancellationToken);
        return valid
            ? Results.Ok(new { valid = true })
            : Results.Json(new { valid = false, code = "invalid_credentials" }, statusCode: StatusCodes.Status401Unauthorized);
    }

    private static async Task<IResult> HandlePasswordResetRequestAsync(
        InternalPasswordResetRequest request,
        IInternalLocalAuthService localAuth,
        CancellationToken cancellationToken)
    {
        var identifier = FirstNonEmpty(request.Identifier, request.Email, request.PersonnelNo) ?? string.Empty;
        var result = await localAuth.RequestPasswordResetAsync(identifier, cancellationToken);
        return Results.Ok(new { status = result.Status, resetToken = result.ResetToken });
    }

    private static async Task<IResult> HandlePasswordResetConfirmAsync(
        InternalPasswordResetConfirmRequest request,
        IInternalLocalAuthService localAuth,
        CancellationToken cancellationToken)
    {
        var identifier = FirstNonEmpty(request.Identifier, request.Email, request.PersonnelNo) ?? string.Empty;
        var result = await localAuth.ConfirmPasswordResetAsync(
            identifier,
            request.ResetToken ?? string.Empty,
            request.NewPassword ?? string.Empty,
            cancellationToken);

        if (result.InvalidRequest)
        {
            return Results.BadRequest(new { code = "invalid_reset_request" });
        }

        if (result.InvalidToken)
        {
            return Results.BadRequest(new { code = "reset_token_invalid" });
        }

        if (!result.Succeeded)
        {
            return Results.BadRequest(new { code = "password_reset_failed", errors = result.Errors });
        }

        return Results.NoContent();
    }

    private static async Task<IResult> HandleDevelopmentLoginAsync(
        DevelopmentInternalLoginRequest request,
        HttpContext httpContext,
        IInternalUserProfileReader profileReader,
        IInternalUserAccessService accessService,
        IOptions<InternalAuthOptions> authOptions,
        IHostEnvironment environment,
        CancellationToken cancellationToken)
    {
        if (!environment.IsDevelopment() || !authOptions.Value.AllowPasswordlessDevLogin)
        {
            return Results.NotFound();
        }

        var identifier = FirstNonEmpty(request.Identifier, request.PersonnelNo, request.Email);
        if (identifier is null)
        {
            return Results.BadRequest(new { code = "internal_login_identifier_required" });
        }

        var user = await profileReader.FindByPersonnelNoOrEmailAsync(identifier.Trim(), cancellationToken);
        if (user is null)
        {
            return Results.NotFound(new { code = "internal_user_not_found", identifier = identifier.Trim() });
        }

        if (!string.Equals(user.Status, InternalIdentityStatuses.Active, StringComparison.OrdinalIgnoreCase))
        {
            return Results.Json(
                new { code = "internal_user_inactive", title = "This account is not active." },
                statusCode: StatusCodes.Status403Forbidden);
        }

        return await CompleteInternalLoginAsync(
            httpContext,
            accessService,
            user.PersonnelNo,
            user.FullName,
            user.Email,
            user.MustChangePassword,
            cancellationToken);
    }

    private static async Task<IResult> CompleteInternalLoginAsync(
        HttpContext httpContext,
        IInternalUserAccessService accessService,
        string personnelNo,
        string displayName,
        string? email,
        bool mustChangePassword,
        CancellationToken cancellationToken)
    {
        var permissions = await accessService.GetEffectivePermissionsAsync(personnelNo, cancellationToken);
        var denied = DenyIfPortalUnauthorized(httpContext, permissions);
        if (denied is not null)
        {
            return denied;
        }

        // Local / passwordless-dev sessions must not keep a leftover SISWarrior JWT, or the
        // next request would re-hydrate the previous SSO principal instead of this user.
        httpContext.Session.Remove(SsoSessionKeys.JwtToken);
        httpContext.Session.SetString(SsoSessionKeys.PersonnelNo, personnelNo);
        httpContext.Session.SetString(SsoSessionKeys.DisplayName, displayName);
        return Results.Ok(new
        {
            personnelNo,
            displayName,
            email,
            mustChangePassword,
            ssoEnabled = false
        });
    }

    private static IResult? DenyIfPortalUnauthorized(HttpContext httpContext, IEnumerable<string>? permissions)
    {
        _ = httpContext;
        _ = permissions;
        return null;
    }

    private static void ClearInternalSession(HttpContext httpContext)
    {
        httpContext.Session.Remove(SsoSessionKeys.JwtToken);
        httpContext.Session.Remove(SsoSessionKeys.PersonnelNo);
        httpContext.Session.Remove(SsoSessionKeys.DisplayName);
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private sealed record DevelopmentInternalLoginRequest(
        string? Identifier,
        string? PersonnelNo,
        string? Email,
        string? DisplayName);

    private sealed record InternalLocalLoginRequest(
        string? Identifier,
        string? PersonnelNo,
        string? Email,
        string? Password);

    private sealed record InternalChangePasswordRequest(string? CurrentPassword, string? NewPassword);

    private sealed record InternalVerifyPasswordRequest(string? Password);

    private sealed record InternalPasswordResetRequest(
        string? Identifier,
        string? Email,
        string? PersonnelNo);

    private sealed record InternalPasswordResetConfirmRequest(
        string? Identifier,
        string? Email,
        string? PersonnelNo,
        string? ResetToken,
        string? NewPassword);
}
