using IntegratedProcurement.ModuleGateway;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using Yarp.ReverseProxy.Configuration;
using Yarp.ReverseProxy.Transforms;

// Internal module-portal edge on azurewebsites.net. Hosts one module SPA (plus Administration)
// and reverse-proxies platform + that host's business API paths to AppHost — same-origin so Lax
// cookies work. Tracker also proxies CIP APIs (Term Sheet lives in Proposal Tracker). Unmatched
// /api is 404. Cookie sharing across *.azurewebsites.net is impossible (Public Suffix List).
// Per-host SSO (option B): each portal sends its own allowlisted redirectUrl; PIC returns
// ?token= to that host; we rewrite it onto /api/v1/internal/sso/callback so AppHost can mint
// a host-only session cookie.
var builder = WebApplication.CreateBuilder(args);

var backendBaseUrl = (builder.Configuration["Backend:BaseUrl"] ?? string.Empty).TrimEnd('/');
if (string.IsNullOrWhiteSpace(backendBaseUrl))
{
    throw new InvalidOperationException(
        "Backend:BaseUrl is required (e.g. https://contractone.azurewebsites.net) — set it as an App Service setting.");
}

var moduleKey = (builder.Configuration["Module:Key"] ?? string.Empty).Trim();
if (!ModuleAllowlists.TryGetValue(moduleKey, out var modulePaths))
{
    throw new InvalidOperationException(
        "Module:Key must be one of: vendor-onboarding, proposal-tracker, contract-monitoring.");
}

string[] platformPaths =
[
    "/api/health/{**catchall}",
    "/api/v1/internal/{**catchall}",
    "/api/v1/administration/{**catchall}",
    "/api/v1/super-admin/{**catchall}",
    "/api/v1/master-data/{**catchall}",
    "/api/v1/documents/{**catchall}",
    "/api/v1/notifications/{**catchall}",
    "/api/v1/frontend-state/{**catchall}",
    "/api/v1/dashboard/{**catchall}",
    "/api/v1/platform/{**catchall}",
    "/api/v1/about",
];

var allowlist = platformPaths.Concat(modulePaths).ToArray();

var routes = allowlist
    .Select((path, index) => new RouteConfig
    {
        RouteId = $"module-{index}",
        ClusterId = "backend",
        Match = new RouteMatch { Path = path },
    })
    .ToArray();

var clusters = new[]
{
    new ClusterConfig
    {
        ClusterId = "backend",
        Destinations = new Dictionary<string, DestinationConfig>
        {
            ["backend"] = new DestinationConfig { Address = backendBaseUrl },
        },
    },
};

builder.Services.AddReverseProxy()
    .LoadFromMemory(routes, clusters)
    .AddTransforms(context =>
    {
        // Trusted portal identity for AppHost login gating. Strip any client-supplied value first.
        context.AddRequestHeaderRemove("X-App-Module");
        context.AddRequestHeader("X-App-Module", moduleKey, append: false);
        context.AddRequestHeaderRemove("X-Forwarded-Host");
        context.AddRequestTransform(transformContext =>
        {
            PortalForwardedHost.Apply(transformContext);
            return ValueTask.CompletedTask;
        });
    });

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    // Trust proto/for from Azure's load balancer. Do not trust X-Forwarded-Host — a client
    // could point AppHost SSO at another allowlisted portal. Host comes from Request.Host.
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
});

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    // SAMEORIGIN so in-app document previews can iframe same-origin stream
    // fallbacks when Blob User Delegation SAS is unavailable. DENY produced
    // Chrome's "refused to connect" on vendor-onboarding.azurewebsites.net.
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});

// PIC lands on /?token=JWT. Rewrite the path, then re-run routing so YARP matches
// /api/v1/internal/sso/callback. WebApplication selects endpoints before this Use()
// middleware; leaving the original `/` endpoint selected made MapFallback 404 the
// rewritten /api path.
app.Use((context, next) =>
{
    if (SsoCallbackRewrite.TryRewriteDocumentToken(context.Request))
    {
        context.SetEndpoint(null);
    }

    return next();
});
app.UseRouting();

var webRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var fileProvider = new PhysicalFileProvider(webRoot);

app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = fileProvider,
    OnPrepareResponse = context =>
    {
        context.Context.Response.Headers.CacheControl =
            context.Context.Request.Path.StartsWithSegments("/assets")
                ? "public,max-age=31536000,immutable"
                : "no-cache";
    },
});

app.MapGet("/healthz", () => Results.Ok(new { status = "Ready", module = moduleKey }));

app.MapReverseProxy();

app.MapFallback(async context =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    context.Response.ContentType = "text/html; charset=utf-8";
    context.Response.Headers.CacheControl = "no-cache";
    await context.Response.SendFileAsync(fileProvider.GetFileInfo("index.html"));
});

app.Run();

internal static class ModuleAllowlists
{
    public static bool TryGetValue(string moduleKey, out string[] paths)
    {
        if (Known.TryGetValue(moduleKey, out paths!))
        {
            return true;
        }

        paths = [];
        return false;
    }

    private static readonly Dictionary<string, string[]> Known = new(StringComparer.OrdinalIgnoreCase)
    {
        ["vendor-onboarding"] = ["/api/v1/vendor-onboarding/{**catchall}"],
        ["proposal-tracker"] =
        [
            "/api/v1/proposal-tracker/{**catchall}",
            "/api/v1/contract-initiation-platform/{**catchall}",
        ],
        ["contract-monitoring"] = ["/api/v1/contract-monitoring/{**catchall}"],
    };
}
