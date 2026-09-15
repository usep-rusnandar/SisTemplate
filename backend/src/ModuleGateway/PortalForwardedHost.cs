using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;
using Yarp.ReverseProxy.Transforms;

namespace IntegratedProcurement.ModuleGateway;

/// <summary>
/// AppHost SSO allowlist reads <c>X-Forwarded-Host</c>. Do not forward a client-supplied value
/// (open-redirect adjacent). Stamp the real incoming <see cref="HttpRequest.Host"/> after TLS
/// termination so Tracker/VO/CM callbacks mint <c>redirectUrl</c> for that portal, not Suite.
/// </summary>
public static class PortalForwardedHost
{
    public static void Apply(RequestTransformContext context)
    {
        var request = context.HttpContext.Request;
        Apply(request.Host.Value, request.Scheme, context.ProxyRequest.Headers);
    }

    public static void Apply(string? host, string? scheme, HttpRequestHeaders headers)
    {
        if (!string.IsNullOrWhiteSpace(host))
        {
            headers.Remove("X-Forwarded-Host");
            headers.TryAddWithoutValidation("X-Forwarded-Host", host);
        }

        if (!string.IsNullOrWhiteSpace(scheme))
        {
            headers.Remove("X-Forwarded-Proto");
            headers.TryAddWithoutValidation("X-Forwarded-Proto", scheme);
        }
    }
}
