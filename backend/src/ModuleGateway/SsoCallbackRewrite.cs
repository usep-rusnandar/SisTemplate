using Microsoft.AspNetCore.Http;

namespace IntegratedProcurement.ModuleGateway;

/// <summary>
/// PIC Auth returns <c>?token=</c> to the portal origin. ModuleGateway would otherwise serve
/// <c>index.html</c> and the JWT would never reach AppHost. Rewrite document navigations that
/// carry a token onto the internal SSO callback (YARP already proxies <c>/api/v1/internal/**</c>).
/// </summary>
public static class SsoCallbackRewrite
{
    public const string CallbackPath = "/api/v1/internal/sso/callback";

    public static bool TryRewriteDocumentToken(HttpRequest request)
    {
        if (request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase)
            || request.Path.StartsWithSegments("/healthz", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(request.Query["token"].FirstOrDefault()))
        {
            return false;
        }

        request.Path = CallbackPath;
        return true;
    }
}
