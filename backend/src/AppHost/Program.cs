using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.AppHost.Api.Endpoints;
using IntegratedProcurement.AppHost.Api.Middleware;
using IntegratedProcurement.AppHost.Api.OpenApi;
using IntegratedProcurement.BuildingBlocks.Application.Security;
using IntegratedProcurement.BuildingBlocks.Infrastructure;
using IntegratedProcurement.Platform.Administration.Infrastructure;
using IntegratedProcurement.Platform.Audit.Infrastructure;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Documents.Infrastructure;
using IntegratedProcurement.Platform.InternalIdentity.Application.Sso;
using IntegratedProcurement.Platform.InternalIdentity.Infrastructure;
using IntegratedProcurement.Platform.Notifications.Infrastructure;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);
var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
var allowedCorsOrigins = ResolveCorsOrigins(builder.Configuration, builder.Environment);

const long MaxUploadBodyBytes = 32L * 1024 * 1024;
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = MaxUploadBodyBytes;
    options.ValueLengthLimit = (int)Math.Min(int.MaxValue, MaxUploadBodyBytes);
    options.MemoryBufferThreshold = 1024 * 64;
});
builder.Services.Configure<KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = MaxUploadBodyBytes;
});
builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = MaxUploadBodyBytes;
});

builder.Services.AddAppOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddProblemDetails();
builder.Services.AddBuildingBlocksInfrastructure();
builder.Services.AddAuditModule();
builder.Services.AddAdministrationModule();
builder.Services.Configure<IntegratedProcurement.Platform.Administration.Application.WilayahSyncOptions>(
    builder.Configuration.GetSection(IntegratedProcurement.Platform.Administration.Application.WilayahSyncOptions.SectionName));
builder.Services.AddScoped<IntegratedProcurement.AppHost.Api.Services.IAdminConsoleAuditService, IntegratedProcurement.AppHost.Api.Services.AdminConsoleAuditService>();
builder.Services.AddScoped<IntegratedProcurement.Platform.Persistence.FrontendState.FrontendStateStore>();
builder.Services.AddScoped<IntegratedProcurement.AppHost.Api.Services.IAppReadinessService, IntegratedProcurement.AppHost.Api.Services.AppReadinessService>();
builder.Services.AddNotificationsModule();
builder.Services.AddDocumentsModule(builder.Configuration);
builder.Services.Configure<SsoOptions>(builder.Configuration.GetSection(SsoOptions.SectionName));
builder.Services.Configure<InternalAuthOptions>(builder.Configuration.GetSection(InternalAuthOptions.SectionName));
builder.Services.AddDistributedSqlServerCache(options =>
{
    options.ConnectionString = defaultConnection;
    options.SchemaName = "core";
    options.TableName = "SESSION_CACHE_T";
});
var ssoSessionIdleTimeout =
    builder.Configuration.GetSection(SsoOptions.SectionName).Get<SsoOptions>()?.SessionIdleTimeout
    ?? TimeSpan.FromHours(8);
builder.Services.AddSession(options =>
{
    options.Cookie.Name = ".IntegratedProcurement.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.IdleTimeout = ssoSessionIdleTimeout;
});
builder.Services.AddProcurementPersistence(defaultConnection);
builder.Services.AddInternalIdentityInfrastructure();
builder.Services
    .AddAuthentication(InternalAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, InternalAuthenticationHandler>(
        InternalAuthenticationHandler.SchemeName,
        options => { });
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, AnyPermissionAuthorizationHandler>();
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(AuthorizationPolicies.InternalUser, policy =>
    {
        policy.RequireClaim(AppClaimTypes.ActorType, "Internal");
        policy.RequireClaim(AppClaimTypes.PersonnelNo);
    })
    .AddPolicy(AuthorizationPolicies.FrontendStateUser, policy =>
    {
        policy.RequireClaim(AppClaimTypes.ActorType, "Internal");
        policy.RequireClaim(AppClaimTypes.PersonnelNo);
    });
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (allowedCorsOrigins.Length == 0)
        {
            return;
        }

        policy
            .WithOrigins(allowedCorsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Configuration.GetValue("DataSeeding:SeedInitialIam", true))
{
    await app.Services.SeedInitialIamDataAsync();
}

if (app.Configuration.GetValue("DataSeeding:SeedInitialPlatformData", true))
{
    await app.Services.SeedInitialPlatformDataAsync();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseSession();
app.UseInternalSso();
app.UseAuthorization();
app.UseAppOpenApi();
var servingInternalFrontend = app.UseInternalFrontend();

app.MapHealthEndpoints(includeRootRedirect: !servingInternalFrontend);
app.MapAboutEndpoints();
app.MapInternalAuthEndpoints();
app.MapAdminConsoleEndpoints();
app.MapNotificationEndpoints();
app.MapDocumentEndpoints();
app.MapFrontendStateEndpoints();
app.MapGet("/api/v1/platform/blob-check", async (
    IDocumentStorage storage,
    IOptions<AzureBlobOptions> blobOptions,
    CancellationToken cancellationToken) =>
{
    var keyPrefix = AzureBlobKeyPrefix.Normalize(blobOptions.Value.KeyPrefix);
    var provider = blobOptions.Value.UseLocalStorage == true ? "local" : "azure";
    var container = storage.ContainerForModule("platformUser");
    if (!storage.IsConfigured)
    {
        return Results.Ok(new
        {
            configured = false,
            reachable = false,
            provider,
            keyPrefix = string.IsNullOrEmpty(keyPrefix) ? null : keyPrefix,
            detail = provider == "local" ? "Local document storage root is not configured." : "Azure blob storage is not configured.",
        });
    }

    try
    {
        var reachable = await storage.ContainerExistsAsync(container, cancellationToken);
        var canSignReadSas = false;
        string? sasDetail = null;
        try
        {
            await storage.CreateReadSasUriAsync(container, "__blob-check__", TimeSpan.FromMinutes(1), cancellationToken);
            canSignReadSas = true;
        }
        catch (Exception ex)
        {
            sasDetail = ex.GetType().Name + ": " + ex.Message;
        }

        return Results.Ok(new
        {
            configured = true,
            reachable,
            canSignReadSas,
            sasDetail,
            provider,
            keyPrefix = string.IsNullOrEmpty(keyPrefix) ? null : keyPrefix,
            localRoot = provider == "local" ? blobOptions.Value.LocalRoot : null,
            container,
        });
    }
    catch (Exception ex)
    {
        return Results.Ok(new
        {
            configured = true,
            reachable = false,
            provider,
            keyPrefix = string.IsNullOrEmpty(keyPrefix) ? null : keyPrefix,
            detail = ex.GetType().Name + ": " + ex.Message,
        });
    }
});
app.MapFoundationManifestEndpoints();

app.Run();

static string[] ResolveCorsOrigins(IConfiguration configuration, IWebHostEnvironment environment)
{
    var configuredOrigins = configuration
        .GetSection("Cors:AllowedOrigins")
        .Get<string[]>()?
        .Where(origin => !string.IsNullOrWhiteSpace(origin))
        .Select(origin => origin.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    if (configuredOrigins is { Length: > 0 })
    {
        return configuredOrigins;
    }

    var origins = new[]
        {
            configuration["Frontend:InternalUrl"],
            configuration["SSO:ApplicationUrl"]
        }
        .Select(TryGetOrigin)
        .Where(origin => origin is not null)
        .Select(origin => origin!)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    if (origins.Length > 0)
    {
        return origins;
    }

    if (!environment.IsDevelopment())
    {
        return Array.Empty<string>();
    }

    return
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8008",
        "http://127.0.0.1:8008"
    ];
}

static string? TryGetOrigin(string? url)
{
    if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri))
    {
        return null;
    }

    return uri.GetLeftPart(UriPartial.Authority);
}

public partial class Program;
