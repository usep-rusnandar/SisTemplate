using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using Yarp.ReverseProxy.Configuration;

// Public vendor edge on azurewebsites.net. Hosts the vendor SPA and reverse-proxies ONLY the
// vendor-facing API paths to AppHost — same-origin so Lax cookies work; unmatched /api is 404.
var builder = WebApplication.CreateBuilder(args);

var backendBaseUrl = (builder.Configuration["Backend:BaseUrl"] ?? string.Empty).TrimEnd('/');
if (string.IsNullOrWhiteSpace(backendBaseUrl))
{
    throw new InvalidOperationException(
        "Backend:BaseUrl is required (e.g. https://contractone.azurewebsites.net) — set it as an App Service setting.");
}

string[] allowlist =
[
    "/api/v1/vendor/auth/{**catchall}",
    "/api/v1/public/vendor-registration/{**catchall}",
    "/api/v1/vendor-portal/{**catchall}",
];

var routes = allowlist
    .Select((path, index) => new RouteConfig
    {
        RouteId = $"vendor-{index}",
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

builder.Services.AddReverseProxy().LoadFromMemory(routes, clusters);

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost,
});

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});

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

app.MapGet("/healthz", () => Results.Ok(new { status = "Ready" }));

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
