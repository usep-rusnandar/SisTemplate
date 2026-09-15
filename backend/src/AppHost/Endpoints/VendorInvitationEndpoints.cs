using IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;
using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.VendorIdentity.Application;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

public static class VendorInvitationEndpoints
{
    public static IEndpointRouteBuilder MapVendorInvitationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Vendor invitations are restricted to the Vendor Onboarding Officer (permission
        // `vendorOnboarding.invite`); all invitation reads/writes gate on it above the InternalUser baseline.
        var internalGroup = endpoints.MapGroup("/api/v1/vendor-onboarding/invitations")
            .WithTags("Vendor Invitations")
            .RequireAuthorization(AuthorizationPolicies.InternalUser)
            .RequirePermission(PermissionKeys.VendorOnboardingInvite);

        internalGroup.MapGet("/", async (
            IVendorInvitationService invitations,
            CancellationToken cancellationToken) =>
        {
            var result = await invitations.ListAsync(cancellationToken);
            return Results.Ok(result);
        });

        internalGroup.MapGet("/{id:guid}", async (
            Guid id,
            IVendorInvitationService invitations,
            CancellationToken cancellationToken) =>
        {
            var result = await invitations.GetAsync(id, cancellationToken);
            return result is null ? Results.NotFound(new { code = "not_found" }) : Results.Ok(result);
        });

        internalGroup.MapPost("/", async (
            CreateInvitationRequest request,
            IVendorInvitationService invitations,
            IVendorOnboardingMailer mailer,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var result = await invitations.CreateAsync(request.ToCommand(), cancellationToken);
                await mailer.NotifyInvitationAsync(
                    result.Invitation, result.InvitationCode, result.RegistrationUrl, cancellationToken);
                return Results.Created($"/api/v1/vendor-onboarding/invitations/{result.Invitation.Id}", result);
            }
            catch (VendorInvitationRuleException ex)
            {
                return ToRuleResult(ex);
            }
        });

        internalGroup.MapPost("/{id:guid}/resend", async (
            Guid id,
            IVendorInvitationService invitations,
            IVendorOnboardingMailer mailer,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var result = await invitations.ReissueAsync(id, cancellationToken);
                await mailer.NotifyInvitationAsync(
                    result.Invitation, result.InvitationCode, result.RegistrationUrl, cancellationToken);
                return Results.Ok(result);
            }
            catch (VendorInvitationRuleException ex)
            {
                return ToRuleResult(ex);
            }
        });

        internalGroup.MapPost("/{id:guid}/revoke", async (
            Guid id,
            IVendorInvitationService invitations,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var result = await invitations.RevokeAsync(id, cancellationToken);
                return result is null ? Results.NotFound(new { code = "not_found" }) : Results.Ok(result);
            }
            catch (VendorInvitationRuleException ex)
            {
                return ToRuleResult(ex);
            }
        });

        var publicGroup = endpoints.MapGroup("/api/v1/public/vendor-registration")
            .WithTags("Vendor Registration");

        publicGroup.MapPost("/validate-invitation", async (
            ValidateInvitationRequest request,
            HttpContext httpContext,
            IVendorInvitationService invitations,
            CancellationToken cancellationToken) =>
        {
            var result = await invitations.ValidateAsync(
                request.ToCommand(GetIpAddress(httpContext), GetUserAgent(httpContext)),
                cancellationToken);

            return result.IsValid ? Results.Ok(result) : ToValidationResult(result);
        });

        publicGroup.MapPost("/register", async (
            RegisterVendorRequest request,
            HttpContext httpContext,
            IVendorInvitationService invitations,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var result = await invitations.RegisterAsync(
                    request.ToCommand(GetIpAddress(httpContext), GetUserAgent(httpContext)),
                    cancellationToken);

                return Results.Created($"/api/v1/vendor/users/{result.VendorUserId}", result);
            }
            catch (VendorInvitationRuleException ex)
            {
                return ToRuleResult(ex);
            }
        });

        // Effective password-complexity policy (Super Admin > Settings > Security), so the vendor
        // portal's checklist + client-side validation mirror exactly what the backend enforces.
        publicGroup.MapGet("/password-policy", async (
            IAdminConsoleConfigurationService configurationService,
            CancellationToken cancellationToken) =>
        {
            var policy = await VendorPasswordPolicy
                .ResolveAsync(configurationService, cancellationToken);
            return Results.Ok(new
            {
                minLength = policy.MinLength,
                requireDigit = policy.RequireDigit,
                requireLowercase = policy.RequireLowercase,
                requireUppercase = policy.RequireUppercase,
                requireNonAlphanumeric = policy.RequireNonAlphanumeric,
            });
        });

        return endpoints;
    }

    private static IResult ToValidationResult(ValidateInvitationResult result)
    {
        var statusCode = result.FailureReason == InvitationFailureReasons.TooManyAttempts
            ? StatusCodes.Status429TooManyRequests
            : StatusCodes.Status400BadRequest;

        return Results.Json(new
        {
            isValid = result.IsValid,
            failureReason = result.FailureReason,
            invitation = result.Invitation
        }, statusCode: statusCode);
    }

    private static IResult ToRuleResult(VendorInvitationRuleException ex)
    {
        var statusCode = ex.Code switch
        {
            InvitationFailureReasons.TooManyAttempts => StatusCodes.Status429TooManyRequests,
            InvitationFailureReasons.EmailRegistered
                or InvitationFailureReasons.Used
                or InvitationFailureReasons.Revoked
                or "active_invitation_exists" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };

        return Results.Json(new
        {
            code = ex.Code,
            message = ex.Message
        }, statusCode: statusCode);
    }

    private static string? GetIpAddress(HttpContext httpContext) =>
        httpContext.Connection.RemoteIpAddress?.ToString();

    private static string? GetUserAgent(HttpContext httpContext) =>
        httpContext.Request.Headers.UserAgent.ToString();

    private sealed record CreateInvitationRequest(
        string Email,
        string VendorName,
        string PicName,
        string? Category,
        string? VendorId,
        DateTimeOffset? ExpiredAt,
        string? Note)
    {
        public CreateInvitationCommand ToCommand() =>
            new(Email, VendorName, PicName, Category, VendorId, ExpiredAt, Note);
    }

    private sealed record ValidateInvitationRequest(
        string InvitationCode,
        string? Email)
    {
        public ValidateInvitationCommand ToCommand(string? ipAddress, string? userAgent) =>
            new(InvitationCode, Email, ipAddress, userAgent);
    }

    private sealed record RegisterVendorRequest(
        string InvitationCode,
        string Password,
        string? Email,
        string? VendorName,
        string? PicName,
        string? Phone,
        string? Position,
        string? Category,
        string? Npwp,
        string? Nib,
        string? Address)
    {
        public RegisterVendorCommand ToCommand(string? ipAddress, string? userAgent) =>
            new(InvitationCode, Password, Email, VendorName, PicName, Phone, Position, Category, Npwp, Nib, Address, ipAddress, userAgent);
    }
}
