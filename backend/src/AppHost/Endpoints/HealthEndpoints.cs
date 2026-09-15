using IntegratedProcurement.AppHost.Api.Services;

namespace IntegratedProcurement.AppHost.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints, bool includeRootRedirect = true)
    {
        // API-only convenience: with no internal SPA served, "/" points at readiness.
        // When the SPA is hosted, "/" must stay free so index.html is served instead.
        if (includeRootRedirect)
        {
            endpoints.MapGet("/", () => Results.Redirect("/api/health/ready"));
        }
        endpoints.MapGet("/api/health/live", () => Results.Ok(new { status = "Live" }))
            .WithTags("Health")
            .WithName("HealthLive");
        endpoints.MapGet("/api/health/ready", async (
            IAppReadinessService readinessService,
            CancellationToken cancellationToken) =>
        {
            const string application = "Integrated Procurement";
            const string phase = "Foundation Skeleton";
            var readiness = await readinessService.CheckAsync(cancellationToken);

            if (!readiness.IsReady)
            {
                return Results.Json(new
                {
                    status = "NotReady",
                    application,
                    phase,
                    checks = readiness.Checks.Select(check => new { name = check.Name, status = check.Status, detail = check.Detail })
                }, statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            return Results.Ok(new
            {
                status = "Ready",
                application,
                phase,
                checks = readiness.Checks.Select(check => new { name = check.Name, status = check.Status, detail = check.Detail })
            });
        })
        .WithTags("Health")
        .WithName("HealthReady");

        return endpoints;
    }
}
