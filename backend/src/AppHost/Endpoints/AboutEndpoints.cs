using SisTemplate.Platform.Administration.Application;

namespace SisTemplate.AppHost.Api.Endpoints;

public static class AboutEndpoints
{
    public static IEndpointRouteBuilder MapAboutEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/about", async (
                IApplicationAboutService aboutService,
                CancellationToken cancellationToken) =>
            {
                var document = await aboutService.GetDocumentAsync(cancellationToken);
                if (document is null)
                {
                    return Results.NotFound(new { detail = "About Application content is not configured." });
                }

                // Bilingual payload as stored (en/id localized strings). The SPA picks by active language.
                return Results.Json(document.Value);
            })
            .AllowAnonymous()
            .WithTags("About")
            .WithName("GetAboutApplication");

        return endpoints;
    }
}
