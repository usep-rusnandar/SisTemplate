using IntegratedProcurement.AppHost.Api.Endpoints;
using IntegratedProcurement.AppHost.Api.Middleware;
using IntegratedProcurement.AppHost.Api.OpenApi;
using IntegratedProcurement.AppHost.Api.Services;
using IntegratedProcurement.BuildingBlocks.Infrastructure;
using IntegratedProcurement.BuildingBlocks.Application.Security;
using IntegratedProcurement.AppHost.Api.Auth;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Infrastructure;
using IntegratedProcurement.Modules.ContractMonitoring.Infrastructure;
using IntegratedProcurement.Modules.ProposalTracker.Infrastructure;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;
using IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Administration.Infrastructure;
using IntegratedProcurement.Platform.Audit.Infrastructure;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Documents.Infrastructure;
using IntegratedProcurement.Platform.Notifications.Application;
using IntegratedProcurement.Platform.Notifications.Infrastructure;
using IntegratedProcurement.Platform.InternalIdentity.Application.Sso;
using IntegratedProcurement.Platform.InternalIdentity.Infrastructure;
using IntegratedProcurement.Platform.VendorIdentity.Application;
using IntegratedProcurement.Platform.VendorIdentity.Infrastructure;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.FrontendState;
using IntegratedProcurement.Platform.Persistence.Identity;
using IntegratedProcurement.Platform.Persistence.ModuleState;
using IntegratedProcurement.Platform.Persistence.Seeding;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);
var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
var allowedCorsOrigins = ResolveCorsOrigins(builder.Configuration, builder.Environment);

// Vendor/internal document uploads allow up to 10MB per slot; leave headroom for multipart
// wrappers. Without this, hosting defaults (notably IIS/FormOptions) can abort mid-body and the
// portal sees progress vanish around a few MB. 32 MB covers akta / multi-MB PDFs.
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
builder.Services.AddScoped<IAdminConsoleAuditService, AdminConsoleAuditService>();
builder.Services.AddScoped<IAppReadinessService, AppReadinessService>();
builder.Services.AddNotificationsModule();
builder.Services.AddDocumentsModule(builder.Configuration);
builder.Services.PostConfigure<IntegratedProcurement.Platform.Documents.Application.ContractTemplateOptions>(options =>
{
    if (string.IsNullOrWhiteSpace(options.RootPath))
    {
        options.RootPath = Path.Combine(builder.Environment.ContentRootPath, "ContractTemplates");
    }
});
builder.Services.AddScoped<FrontendStateStore>();
builder.Services.AddScoped<ModuleStateStore>();
builder.Services.Configure<SsoOptions>(builder.Configuration.GetSection(SsoOptions.SectionName));
builder.Services.Configure<InternalAuthOptions>(builder.Configuration.GetSection(InternalAuthOptions.SectionName));
builder.Services.Configure<VendorRegistrationOptions>(
    builder.Configuration.GetSection(VendorRegistrationOptions.SectionName));
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
builder.Services.AddContractMonitoringModule();
builder.Services.AddSingleton<IntegratedProcurement.AppHost.Api.Services.ImportJobSignal>();
builder.Services.AddHostedService<IntegratedProcurement.AppHost.Api.Services.ImportJobBackgroundRunner>();
builder.Services.AddProposalTrackerModule();
// E-Proposal ingestion: connection from config (absent → ingestion is a no-op). Scheduled pull +
// manual Sync endpoint land proposals in the Tracker domain as ReadyToDistribute.
builder.Services.AddSingleton(sp =>
    new IntegratedProcurement.Modules.ProposalTracker.Application.EproposalIngestionOptions(
        sp.GetRequiredService<IConfiguration>().GetConnectionString("EproposalConnection")));
builder.Services.Configure<IntegratedProcurement.AppHost.Api.Services.EproposalIngestionScheduleOptions>(
    builder.Configuration.GetSection(IntegratedProcurement.AppHost.Api.Services.EproposalIngestionScheduleOptions.SectionName));
builder.Services.AddHostedService<IntegratedProcurement.AppHost.Api.Services.EproposalIngestionScheduler>();
builder.Services.AddScoped<IntegratedProcurement.Platform.Administration.Application.IBackgroundProcessSource, IntegratedProcurement.AppHost.Api.Services.EproposalBackgroundProcessSource>();
builder.Services.AddScoped<IntegratedProcurement.Platform.Administration.Application.IBackgroundProcessRunner, IntegratedProcurement.AppHost.Api.Services.EproposalBackgroundProcessRunner>();
builder.Services.AddScoped<IntegratedProcurement.Platform.Administration.Application.IBackgroundProcessSource, IntegratedProcurement.AppHost.Api.Services.ContractImportQueueProcessSource>();
builder.Services.AddScoped<IntegratedProcurement.Platform.Administration.Application.IBackgroundProcessSource, IntegratedProcurement.AppHost.Api.Services.ContractReminderProcessSource>();
builder.Services.AddCipModule();
builder.Services.AddVendorOnboardingModule();
builder.Services.AddInternalIdentityInfrastructure();
builder.Services.AddVendorIdentityModule();
builder.Services
    .AddIdentityCore<VendorIdentityUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        // Password complexity is governed dynamically by Super Admin > Settings > Security via
        // SettingsVendorPasswordValidator (reads the policy live). Keep the built-in PasswordOptions
        // permissive so they do not double-enforce and override the configured policy.
        options.Password.RequiredLength = 1;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Tokens.PasswordResetTokenProvider = TokenOptions.DefaultProvider;
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromSeconds(2000);
    })
    .AddRoles<VendorIdentityRole>()
    .AddEntityFrameworkStores<ProcurementDbContext>()
    .AddDefaultTokenProviders()
    .AddSignInManager();
builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddCookie(IdentityConstants.ApplicationScheme, options =>
    {
        options.Cookie.Name = ".IntegratedProcurement.Vendor";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.LoginPath = "/api/v1/vendor/auth/login";
        options.LogoutPath = "/api/v1/vendor/auth/logout";
        options.SlidingExpiration = true;
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context => HandleApiRedirectAsync(context, StatusCodes.Status401Unauthorized),
            OnRedirectToAccessDenied = context => HandleApiRedirectAsync(context, StatusCodes.Status403Forbidden)
        };
    });
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, AnyPermissionAuthorizationHandler>();
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(AuthorizationPolicies.InternalUser, policy =>
    {
        policy.RequireClaim(AppClaimTypes.ActorType, "Internal");
        policy.RequireClaim(AppClaimTypes.PersonnelNo);
    })
    .AddPolicy(AuthorizationPolicies.VendorUser, policy =>
    {
        policy.AddAuthenticationSchemes(IdentityConstants.ApplicationScheme);
        policy.RequireRole(VendorIdentityRoleNames.Vendor);
    })
    .AddPolicy(AuthorizationPolicies.FrontendStateUser, policy =>
    {
        // Deliberately no AddAuthenticationSchemes: listing the vendor cookie scheme would make
        // the policy evaluator rebuild HttpContext.User from that scheme alone, discarding the
        // internal principal that SsoMiddleware attaches. The vendor cookie is the default
        // authentication scheme, so its principal is already on HttpContext.User when present.
        policy.RequireAssertion(context =>
            (context.User.HasClaim(AppClaimTypes.ActorType, "Internal")
                && context.User.HasClaim(claim => claim.Type == AppClaimTypes.PersonnelNo))
            || context.User.IsInRole(VendorIdentityRoleNames.Vendor));
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
app.MapVendorAuthEndpoints();
app.MapVendorInvitationEndpoints();
app.MapVendorPortalEndpoints();
app.MapVendorRegistryEndpoints();
app.MapVendorContactEndpoints();
app.MapVendorImportEndpoints();
app.MapVendorPublicEndpoints();
app.MapTrackerEndpoints();
app.MapCipEndpoints();
app.MapContractMonitoringEndpoints();
app.MapAdminConsoleEndpoints();
app.MapNotificationEndpoints();
app.MapDocumentEndpoints();
app.MapFrontendStateEndpoints();

// Diagnostic: verify the app can reach the Azure Blob container with its current credential.
app.MapGet("/api/v1/platform/blob-check", async (
    IDocumentStorage storage,
    IOptions<AzureBlobOptions> blobOptions,
    CancellationToken cancellationToken) =>
{
    var keyPrefix = AzureBlobKeyPrefix.Normalize(blobOptions.Value.KeyPrefix);
    var provider = blobOptions.Value.UseLocalStorage == true ? "local" : "azure";
    if (!storage.IsConfigured)
    {
        return Results.Ok(new
        {
            configured = false,
            reachable = false,
            provider,
            keyPrefix = string.IsNullOrEmpty(keyPrefix) ? null : keyPrefix,
            detail = "AzureBlob:ServiceUri not set",
        });
    }

    try
    {
        var trackerContainer = storage.ContainerForModule("proposalTracker");
        var cipContainer = storage.ContainerForModule("contractInitiationPlatform");
        var trackerReachable = await storage.ContainerExistsAsync(trackerContainer, cancellationToken);
        var cipReachable = await storage.ContainerExistsAsync(cipContainer, cancellationToken);
        var canSignReadSas = false;
        string? sasDetail = null;
        try
        {
            await storage.CreateReadSasUriAsync(
                trackerContainer, "__sas-probe__", TimeSpan.FromMinutes(1), cancellationToken);
            canSignReadSas = true;
        }
        catch (Exception ex)
        {
            sasDetail = ex.GetType().Name + ": " + ex.Message;
        }

        return Results.Ok(new
        {
            configured = true,
            reachable = trackerReachable && cipReachable,
            canSignReadSas,
            sasDetail,
            provider,
            keyPrefix = string.IsNullOrEmpty(keyPrefix) ? null : keyPrefix,
            localRoot = provider == "local" ? blobOptions.Value.LocalRoot : null,
            containers = new { tracker = new { name = trackerContainer, reachable = trackerReachable }, cip = new { name = cipContainer, reachable = cipReachable } },
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
            configuration["Frontend:VendorUrl"],
            configuration["VendorRegistration:RegistrationUrl"]
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

    return new[]
    {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8008",
        "http://127.0.0.1:8008"
    };
}

static string? TryGetOrigin(string? url)
{
    if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri))
    {
        return null;
    }

    return uri.GetLeftPart(UriPartial.Authority);
}

static Task HandleApiRedirectAsync(RedirectContext<CookieAuthenticationOptions> context, int statusCode)
{
    if (context.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = statusCode;
        return Task.CompletedTask;
    }

    context.Response.Redirect(context.RedirectUri);
    return Task.CompletedTask;
}

public partial class Program;
