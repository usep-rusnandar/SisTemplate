namespace IntegratedProcurement.AppHost.Api.Endpoints;

using IntegratedProcurement.Modules.VendorOnboarding.Application.Certificates;

/// <summary>
/// Public (anonymous) vendor endpoints. Certificate verification is reachable from the QR code printed
/// on the e-certificate; it returns only non-sensitive validity information.
/// </summary>
public static class VendorPublicEndpoints
{
    public static IEndpointRouteBuilder MapVendorPublicEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/public/vendor-certificate/verify", async (
            string? no,
            VendorCertificateService certificates,
            CancellationToken cancellationToken) =>
            Results.Ok(await certificates.VerifyAsync(no ?? string.Empty, cancellationToken)))
            .WithTags("Public")
            .AllowAnonymous();

        return endpoints;
    }
}
