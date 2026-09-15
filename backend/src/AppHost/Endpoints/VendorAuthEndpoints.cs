using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.Platform.VendorIdentity.Application;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

public static class VendorAuthEndpoints
{
    public static IEndpointRouteBuilder MapVendorAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/vendor/auth")
            .WithTags("Vendor Auth");

        group.MapGet("/me", async (
            HttpContext httpContext,
            IVendorAuthService vendorAuthService,
            CancellationToken cancellationToken) =>
        {
            var result = await vendorAuthService.GetCurrentVendorAsync(httpContext.User, cancellationToken);
            if (result is null)
            {
                return Results.Unauthorized();
            }

            if (result.IsNotFound)
            {
                return Results.NotFound(new { code = "vendor_user_not_found" });
            }

            return Results.Ok(result.Payload);
            })
            .RequireAuthorization(AuthorizationPolicies.VendorUser);

        group.MapPost("/login", async (
            VendorLoginRequest request,
            IVendorAuthService vendorAuthService) =>
        {
            var result = await vendorAuthService.SignInAsync(request.Email, request.Password);
            return result switch
            {
                VendorSignInResult.SignedIn => Results.Ok(new { status = "signed_in" }),
                VendorSignInResult.OtpRequired => Results.Ok(new { status = "otp_required" }),
                // Still HTTP 401, but carry a machine code so the client can show a specific,
                // human-friendly reason. "invalid_credentials" is deliberately generic (also used
                // for unknown emails) to avoid account enumeration.
                VendorSignInResult.LockedOut => Results.Json(
                    new { code = "account_locked" }, statusCode: StatusCodes.Status401Unauthorized),
                VendorSignInResult.NotAllowed => Results.Json(
                    new { code = "email_not_confirmed" }, statusCode: StatusCodes.Status401Unauthorized),
                VendorSignInResult.NotWorkspacePic => Results.Json(
                    new { code = "not_workspace_pic" }, statusCode: StatusCodes.Status403Forbidden),
                _ => Results.Json(
                    new { code = "invalid_credentials" }, statusCode: StatusCodes.Status401Unauthorized),
            };
        });

        // Second step of an OTP-gated sign-in: the code was emailed by /login.
        group.MapPost("/login/otp", async (
            VendorOtpRequest request,
            IVendorAuthService vendorAuthService) =>
        {
            var succeeded = await vendorAuthService.VerifyOtpAsync(request.Email, request.Code);
            return succeeded ? Results.Ok(new { status = "signed_in" }) : Results.Unauthorized();
        });

        // Verify the current vendor's password without any sign-in side effects (used by the lock screen).
        group.MapPost("/verify-password", async (
            VendorVerifyPasswordRequest request,
            HttpContext httpContext,
            IVendorAuthService vendorAuthService,
            CancellationToken cancellationToken) =>
        {
            var valid = await vendorAuthService.VerifyCurrentPasswordAsync(httpContext.User, request.Password, cancellationToken);
            return Results.Ok(new { valid });
        })
        .RequireAuthorization(AuthorizationPolicies.VendorUser);

        // Change the current vendor's password (post-login, current password required).
        group.MapPost("/change-password", async (
            VendorChangePasswordRequest request,
            HttpContext httpContext,
            IVendorAuthService vendorAuthService,
            CancellationToken cancellationToken) =>
        {
            var result = await vendorAuthService.ChangePasswordAsync(
                httpContext.User, request.CurrentPassword, request.NewPassword, cancellationToken);

            if (result.IsUnauthorized)
            {
                return Results.Unauthorized();
            }

            if (result.InvalidCurrentPassword)
            {
                return Results.BadRequest(new { code = "invalid_current_password" });
            }

            if (!result.Succeeded)
            {
                return Results.BadRequest(new { code = "password_change_failed", errors = result.Errors });
            }

            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.VendorUser);

        group.MapPost("/logout", async (IVendorAuthService vendorAuthService) =>
        {
            await vendorAuthService.SignOutAsync();
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.VendorUser);

        group.MapPost("/password-reset/request", async (
            VendorPasswordResetRequest request,
            IVendorAuthService vendorAuthService) =>
        {
            var result = await vendorAuthService.RequestPasswordResetAsync(request.Email);
            return Results.Ok(new
            {
                status = result.Status,
                resetToken = result.ResetToken
            });
        });

        group.MapPost("/password-reset/confirm", async (
            VendorPasswordResetConfirmRequest request,
            IVendorAuthService vendorAuthService) =>
        {
            var result = await vendorAuthService.ConfirmPasswordResetAsync(
                request.Email,
                request.ResetToken,
                request.NewPassword);

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
                return Results.BadRequest(new
                {
                    code = "password_reset_failed",
                    errors = result.Errors
                });
            }

            return Results.NoContent();
        });

        return endpoints;
    }

    private sealed record VendorLoginRequest(string Email, string Password);

    private sealed record VendorVerifyPasswordRequest(string Password);

    private sealed record VendorChangePasswordRequest(string CurrentPassword, string NewPassword);

    private sealed record VendorOtpRequest(string Email, string Code);

    private sealed record VendorPasswordResetRequest(string Email);

    private sealed record VendorPasswordResetConfirmRequest(
        string Email,
        string ResetToken,
        string NewPassword);
}
