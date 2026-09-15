namespace SisTemplate.AppHost.Api.Endpoints;

public static class FoundationManifestEndpoints
{
    private sealed record FoundationModule(string Key, string Name, string Status, string Route);

    private static readonly FoundationModule[] Modules =
    [
        new("administration", "Administration", "Foundation", "/administration"),
        new("masterData", "Master Data", "Foundation", "/master-data"),
        new("superAdmin", "Super Admin", "Foundation", "/super-admin")
    ];

    public static IEndpointRouteBuilder MapFoundationManifestEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/platform/foundation-manifest", () => Results.Ok(new
        {
            application = "Integrated Procurement",
            phase = "Foundation Template",
            backend = "ASP.NET Core 10 modular monolith",
            frontend = "React/Vite/TypeScript",
            identityBoundaries = new
            {
                internalIdentity = "iam.USER_T + PersonnelNo + SISWarrior SSO"
            },
            modules = Modules
        }))
        .WithTags("Platform")
        .WithName("FoundationManifest");

        return endpoints;
    }
}
