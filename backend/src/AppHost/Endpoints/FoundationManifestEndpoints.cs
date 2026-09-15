namespace IntegratedProcurement.AppHost.Api.Endpoints;

public static class FoundationManifestEndpoints
{
    private sealed record FoundationModule(string Key, string Name, string Status, string Route);

    private static readonly FoundationModule[] Modules =
    [
        new("proposalTracker", "Proposal Tracker", "MVP", "/proposal-tracker"),
        new("contractInitiationPlatform", "Contract Initiation Platform", "Retired", "/proposal-tracker/term-sheet"),
        new("contractMonitoring", "Contract Monitoring", "MVP", "/contract-monitoring"),
        new("vendorInvitations", "Vendor Invitations", "Foundation", "/vendor-invitations"),
        new("superAdmin", "Super Admin", "Phase 7", "/super-admin"),
        new("administration", "Administration", "Phase 7", "/administration"),
        new("masterData", "Master Data", "Phase 7", "/master-data")
    ];

    public static IEndpointRouteBuilder MapFoundationManifestEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/platform/foundation-manifest", () => Results.Ok(new
        {
            application = "Integrated Procurement",
            phase = "Phase 7 - Admin and Master Data Console",
            backend = "ASP.NET Core 10 modular monolith",
            frontend = "React/Vite/TypeScript",
            identityBoundaries = new
            {
                internalIdentity = "iam.USER_T + PersonnelNo + SISWarrior SSO",
                vendorIdentity = "vdr.USERS_T + ASP.NET Core Identity cookie auth"
            },
            modules = Modules
        }))
        .WithTags("Platform")
        .WithName("FoundationManifest");

        return endpoints;
    }
}
