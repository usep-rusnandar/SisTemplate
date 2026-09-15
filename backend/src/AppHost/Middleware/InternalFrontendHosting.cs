using Microsoft.Extensions.FileProviders;

namespace SisTemplate.AppHost.Api.Middleware;

/// <summary>
/// Serves the built internal SPA (frontend dist/internal) from this process so the internal app
/// and the backend ship as one deployment. The external vendor portal is deliberately not served
/// here — it deploys separately to a public host.
/// </summary>
public static partial class InternalFrontendHosting
{
    [LoggerMessage(Level = LogLevel.Information,
        Message = "Internal frontend build not found — running API-only. Set Frontend:InternalDistPath or publish with frontend/dist/internal present.")]
    private static partial void LogApiOnly(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Serving internal frontend from {Root}.")]
    private static partial void LogServing(ILogger logger, string root);

    /// <returns>True when a built SPA was found and is being served; false when running API-only.</returns>
    public static bool UseInternalFrontend(this WebApplication app)
    {
        var root = ResolveDistRoot(app.Configuration, app.Environment);
        if (root is null)
        {
            LogApiOnly(app.Logger);
            return false;
        }

        LogServing(app.Logger, root);
        var provider = new PhysicalFileProvider(root);

        app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = provider });
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = provider,
            OnPrepareResponse = context =>
            {
                // Vite asset filenames are content-hashed, so they can be cached hard;
                // everything else (index.html, favicon, templates) revalidates.
                context.Context.Response.Headers.CacheControl =
                    context.Context.Request.Path.StartsWithSegments("/assets")
                        ? "public,max-age=31536000,immutable"
                        : "no-cache";
            }
        });

        // SPA fallback: any route no endpoint claimed returns index.html so client-side routing
        // works on deep links — except unknown /api paths, which must stay 404 for API clients.
        app.MapFallback(async context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            context.Response.ContentType = "text/html; charset=utf-8";
            context.Response.Headers.CacheControl = "no-cache";
            await context.Response.SendFileAsync(provider.GetFileInfo("index.html"));
        });

        return true;
    }

    private static string? ResolveDistRoot(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var candidates = new[]
        {
            configuration["Frontend:InternalDistPath"],                                                    // explicit (production)
            Path.Combine(environment.ContentRootPath, "wwwroot"),                                          // dotnet publish output
            Path.Combine(environment.ContentRootPath, "..", "..", "..", "frontend", "dist", "internal"),   // repo layout (development)
        };

        foreach (var candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            var full = Path.GetFullPath(candidate, environment.ContentRootPath);
            if (File.Exists(Path.Combine(full, "index.html")))
            {
                return full;
            }
        }

        return null;
    }
}
