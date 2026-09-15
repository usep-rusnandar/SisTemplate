using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Contacts;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.VendorIdentity.Application;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

public static class VendorContactEndpoints
{
    public static IEndpointRouteBuilder MapVendorContactEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/vendor-onboarding/contacts")
            .WithTags("Vendor Contacts")
            .RequireAuthorization(AuthorizationPolicies.InternalUser)
            .RequirePermission(PermissionKeys.VendorOnboardingContacts);

        group.MapGet("", async (string? search, string? role, IVendorContactService contacts, CancellationToken ct) =>
            Results.Ok(await contacts.ListAsync(search, role, ct)));

        group.MapGet("/vendors", async (IVendorContactService contacts, CancellationToken ct) =>
            Results.Ok(await contacts.ListVendorsAsync(ct)));

        group.MapGet("/password-policy", async (
            IAdminConsoleConfigurationService configuration,
            CancellationToken ct) =>
        {
            var policy = await VendorPasswordPolicy.ResolveAsync(configuration, ct);
            return Results.Ok(new
            {
                minLength = policy.MinLength,
                requireDigit = policy.RequireDigit,
                requireLowercase = policy.RequireLowercase,
                requireUppercase = policy.RequireUppercase,
                requireNonAlphanumeric = policy.RequireNonAlphanumeric,
            });
        });

        group.MapPost("", async (VendorContactWriteRequest request, IVendorContactService contacts, CancellationToken ct) =>
            ToResult(await contacts.CreateAsync(request, ct), created: true));

        group.MapPut("/{contactId:guid}", async (
            Guid contactId,
            VendorContactWriteRequest request,
            IVendorContactService contacts,
            CancellationToken ct) =>
            ToResult(await contacts.UpdateAsync(contactId, request, ct)));

        group.MapPost("/{contactId:guid}/workspace-pic", async (
            Guid contactId,
            IVendorContactService contacts,
            CancellationToken ct) =>
            ToResult(await contacts.SetWorkspacePicAsync(contactId, ct)));

        group.MapPost("/{contactId:guid}/password", async (
            Guid contactId,
            VendorContactSetPasswordRequest request,
            IVendorContactService contacts,
            CancellationToken ct) =>
            ToResult(await contacts.SetPasswordAsync(contactId, request.NewPassword, ct)));

        group.MapDelete("/{contactId:guid}", async (
            Guid contactId,
            IVendorContactService contacts,
            CancellationToken ct) =>
        {
            var result = await contacts.DeleteAsync(contactId, ct);
            if (result.Succeeded)
            {
                return Results.NoContent();
            }

            return ToResult(result);
        });

        return endpoints;
    }

    private static IResult ToResult(VendorContactMutationResult result, bool created = false)
    {
        if (result.Succeeded)
        {
            return created
                ? Results.Created($"/api/v1/vendor-onboarding/contacts/{result.Contact?.Id}", result.Contact)
                : Results.Ok(result.Contact);
        }

        var body = new { code = result.Code, message = result.Message };
        return result.Code switch
        {
            "not_found" or "vendor_not_found" => Results.NotFound(body),
            _ => Results.BadRequest(body),
        };
    }
}
