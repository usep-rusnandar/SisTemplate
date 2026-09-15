using System.Security.Claims;
using SisTemplate.BuildingBlocks.Application.Security;
using SisTemplate.Platform.InternalIdentity.Application.Sso;
using SisTemplate.Platform.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SisTemplate.Platform.InternalIdentity.Infrastructure.Sso;

public sealed class SsoMiddleware
{
    private const string TokenQueryName = "token";
    private const string InternalSsoScheme = "InternalSso";
    private static readonly Action<ILogger, string?, Exception?> RejectedToken =
        LoggerMessage.Define<string?>(
            LogLevel.Warning,
            new EventId(1001, nameof(RejectedToken)),
            "Rejected SISWarrior token: {Reason}");

    private static readonly Action<ILogger, string, Exception?> MissingPersonnelMapping =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(1002, nameof(MissingPersonnelMapping)),
            "SISWarrior NRP {Nrp} has no PersonnelNo mapping.");

    private readonly RequestDelegate _next;
    private readonly ILogger<SsoMiddleware> _logger;

    public SsoMiddleware(RequestDelegate next, ILogger<SsoMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(
        HttpContext context,
        IOptions<SsoOptions> options,
        ISsoJwtHelper jwtHelper,
        ISsoPersonnelMapper personnelMapper)
    {
        var ssoOptions = options.Value;
        if (IsBypassed(context.Request))
        {
            await _next(context);
            return;
        }

        var rawToken = context.Request.Query[TokenQueryName].FirstOrDefault();
        if (ssoOptions.Enabled && !string.IsNullOrWhiteSpace(rawToken))
        {
            await HandleTokenCallbackAsync(context, rawToken, jwtHelper, personnelMapper);
            return;
        }

        if (ssoOptions.Enabled && await TryUseJwtSessionAsync(context, jwtHelper))
        {
            await _next(context);
            return;
        }

        if (await TryUseLocalSessionAsync(context))
        {
            await _next(context);
            return;
        }

        if (IsAnonymousInternalAuth(context.Request))
        {
            await _next(context);
            return;
        }

        if (!ssoOptions.Enabled)
        {
            await _next(context);
            return;
        }

        // Browser document navigations go to SISWarrior. Fetch/XHR under /api must not:
        // following that redirect turns Generate Sample Data / KV PUTs into a hung
        // "Generating..." state and surfaces as `Backend state API put failed (401)`
        // once the portal rejects the API-style request. Authorization returns 401 JSON
        // so the SPA can send the user back to login.
        if (context.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        context.Response.Redirect(SsoRedirect.BuildSisWarriorLoginUrl(ssoOptions, context.Request));
    }

    private async Task HandleTokenCallbackAsync(
        HttpContext context,
        string rawToken,
        ISsoJwtHelper jwtHelper,
        ISsoPersonnelMapper personnelMapper)
    {
        if (!jwtHelper.TryDecode(rawToken, out var jwt, out var failureReason) || jwt is null)
        {
            RejectedToken(_logger, failureReason, null);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { title = "Invalid SSO token", detail = failureReason });
            return;
        }

        if (jwtHelper.IsExpired(jwt))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { title = "Expired SSO token" });
            return;
        }

        var mapped = await personnelMapper.MapNrpAsync(jwt.Nrp, context.RequestAborted);
        if (mapped is null)
        {
            MissingPersonnelMapping(_logger, jwt.Nrp, null);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { title = "SSO user is not mapped" });
            return;
        }

        context.Session.SetString(SsoSessionKeys.JwtToken, jwt.RawToken);
        context.Session.SetString(SsoSessionKeys.PersonnelNo, mapped.PersonnelNo);
        context.Session.SetString(SsoSessionKeys.DisplayName, mapped.DisplayName);
        context.User = await CreatePrincipalAsync(context, mapped.PersonnelNo, mapped.DisplayName, context.RequestAborted);
        context.Response.Redirect(BuildCleanCallbackUrl(context.Request));
    }

    private static async Task<bool> TryUseJwtSessionAsync(HttpContext context, ISsoJwtHelper jwtHelper)
    {
        var rawToken = context.Session.GetString(SsoSessionKeys.JwtToken);
        var personnelNo = context.Session.GetString(SsoSessionKeys.PersonnelNo);
        var displayName = context.Session.GetString(SsoSessionKeys.DisplayName);

        if (string.IsNullOrWhiteSpace(rawToken)
            || string.IsNullOrWhiteSpace(personnelNo)
            || string.IsNullOrWhiteSpace(displayName))
        {
            return false;
        }

        if (!jwtHelper.TryDecode(rawToken, out var jwt, out _) || jwt is null || jwtHelper.IsExpired(jwt))
        {
            context.Session.Remove(SsoSessionKeys.JwtToken);
            context.Session.Remove(SsoSessionKeys.PersonnelNo);
            context.Session.Remove(SsoSessionKeys.DisplayName);
            return false;
        }

        context.User = await CreatePrincipalAsync(context, personnelNo, displayName, context.RequestAborted);
        return true;
    }

    private static async Task<bool> TryUseLocalSessionAsync(HttpContext context)
    {
        var personnelNo = context.Session.GetString(SsoSessionKeys.PersonnelNo);
        var displayName = context.Session.GetString(SsoSessionKeys.DisplayName);
        if (string.IsNullOrWhiteSpace(personnelNo) || string.IsNullOrWhiteSpace(displayName))
        {
            return false;
        }

        context.User = await CreatePrincipalAsync(context, personnelNo, displayName, context.RequestAborted);
        return true;
    }

    private static async Task<ClaimsPrincipal> CreatePrincipalAsync(
        HttpContext context,
        string personnelNo,
        string displayName,
        CancellationToken cancellationToken)
    {
        var dbContext = context.RequestServices.GetRequiredService<ProcurementDbContext>();
        var user = await dbContext.InternalUsers
            .AsNoTracking()
            .Where(item => item.PersonnelNo == personnelNo && item.DeletedAt == null)
            .Select(item => new { item.Id, item.CompleteName })
            .SingleOrDefaultAsync(cancellationToken);

        var effectiveDisplayName = user?.CompleteName ?? displayName;
        var roles = user is null
            ? []
            : await (
                    from userRole in dbContext.InternalUserRoles.AsNoTracking()
                    join role in dbContext.InternalRoles.AsNoTracking()
                        on userRole.RoleId equals role.Id
                    where userRole.UserId == user.Id
                    orderby role.Name
                    select role.Name)
                .Distinct()
                .ToArrayAsync(cancellationToken);

        var permissions = user is null
            ? []
            : await (
                    from userRole in dbContext.InternalUserRoles.AsNoTracking()
                    join rolePermission in dbContext.InternalRolePermissions.AsNoTracking()
                        on userRole.RoleId equals rolePermission.RoleId
                    join permission in dbContext.Permissions.AsNoTracking()
                        on rolePermission.PermissionId equals permission.Id
                    where userRole.UserId == user.Id
                    orderby permission.Key
                    select permission.Key)
                .Distinct()
                .ToArrayAsync(cancellationToken);

        var claims = new List<Claim>
        {
            new(AppClaimTypes.ActorType, "Internal"),
            new(AppClaimTypes.PersonnelNo, personnelNo),
            new(ClaimTypes.NameIdentifier, personnelNo),
            new(ClaimTypes.Name, effectiveDisplayName)
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        claims.AddRange(permissions.Select(permission => new Claim(AppClaimTypes.Permission, permission)));

        var identity = new ClaimsIdentity(
            claims,
            InternalSsoScheme);

        return new ClaimsPrincipal(identity);
    }

    private static bool IsAnonymousInternalAuth(HttpRequest request)
    {
        var path = request.Path;
        return path.Equals("/api/v1/internal/auth/me", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/internal/auth/login", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/internal/auth/logout", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/internal/auth/dev-login", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/internal/auth/password-policy", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/internal/auth/password-reset/request", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/internal/auth/password-reset/confirm", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/internal/sso/login", StringComparison.OrdinalIgnoreCase)
            || path.Equals(SsoRedirect.CallbackPath, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsBypassed(HttpRequest request)
    {
        var path = request.Path;
        return path.StartsWithSegments("/api/health", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/health", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/openapi", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/swagger", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/scalar", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/favicon.ico", StringComparison.OrdinalIgnoreCase)
            // The extension bypass targets static frontend assets only; API routes may carry
            // dotted segments (e.g. frontend-state keys such as "app.workflow.sticky-case")
            // and still need the internal principal attached.
            || (!path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase)
                && Path.HasExtension(path.Value));
    }

    private static string BuildCleanCallbackUrl(HttpRequest request)
    {
        if (request.Path.Equals(SsoRedirect.CallbackPath, StringComparison.OrdinalIgnoreCase))
        {
            var returnPath = request.Query["return"].FirstOrDefault();
            return SsoRedirect.IsSafeRelativeReturnPath(returnPath) ? returnPath! : "/";
        }

        var queryBuilder = new QueryBuilder();
        foreach (var item in request.Query)
        {
            if (string.Equals(item.Key, TokenQueryName, StringComparison.OrdinalIgnoreCase)
                || string.Equals(item.Key, "return", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            foreach (var value in item.Value)
            {
                if (!string.IsNullOrEmpty(value))
                {
                    queryBuilder.Add(item.Key, value);
                }
            }
        }

        return string.Concat(request.PathBase, request.Path, queryBuilder.ToQueryString());
    }
}
