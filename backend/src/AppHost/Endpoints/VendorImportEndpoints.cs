using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

public static class VendorImportEndpoints
{
    public static IEndpointRouteBuilder MapVendorImportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/vendor-onboarding/imports")
            .WithTags("Vendor Ariba Import")
            .RequireAuthorization(AuthorizationPolicies.InternalUser)
            .AddEndpointFilter(async (context, next) =>
            {
                var actor = context.HttpContext.RequestServices.GetRequiredService<ICurrentActor>().Actor;
                return actor.Permissions.Contains(PermissionKeys.VendorOnboardingImport, StringComparer.OrdinalIgnoreCase)
                    ? await next(context)
                    : Results.StatusCode(StatusCodes.Status403Forbidden);
            });

        group.MapGet("/template", (IVendorAribaImportService service) =>
            Results.File(service.CreateTemplate(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Ariba-Vendor-Import-Template.xlsx"));

        group.MapPost("/validate", async (HttpRequest request, IVendorAribaImportService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return Results.BadRequest(new { code = "multipart_form_required" });
            var form = await request.ReadFormAsync(ct);
            var file = form.Files.GetFile("file");
            if (file is null || file.Length == 0) return Results.BadRequest(new { code = "file_required" });
            if (file.Length > 10 * 1024 * 1024) return Results.BadRequest(new { code = "file_too_large", maxMb = 10 });
            if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest(new { code = "xlsx_required" });
            try
            {
                await using var stream = file.OpenReadStream();
                return Results.Ok(await service.ValidateAsync(stream, Path.GetFileName(file.FileName), ct));
            }
            catch (Exception exception) when (exception is InvalidDataException or ArgumentException or FormatException)
            {
                return Results.BadRequest(new { code = "invalid_workbook", message = exception.Message });
            }
        }).DisableAntiforgery();

        group.MapPost("/{batchId:guid}/commit", async (Guid batchId, IVendorAribaImportService service, CancellationToken ct) =>
        {
            try
            {
                var result = await service.CommitAsync(batchId, ct);
                return result is null ? Results.NotFound(new { code = "import_batch_not_found" }) : Results.Ok(result);
            }
            catch (VendorImportCommitException exception)
            {
                return Results.Conflict(new { code = "import_not_ready", message = exception.Message });
            }
        });
        group.MapGet("/{batchId:guid}", async (Guid batchId, IVendorAribaImportService service, CancellationToken ct) =>
        {
            var result = await service.GetAsync(batchId, ct);
            return result is null ? Results.NotFound(new { code = "import_batch_not_found" }) : Results.Ok(result);
        });
        group.MapGet("", async (IVendorAribaImportService service, CancellationToken ct) => Results.Ok(await service.ListAsync(ct)));
        return endpoints;
    }
}
