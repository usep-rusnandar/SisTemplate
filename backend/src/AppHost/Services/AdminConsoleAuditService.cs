using IntegratedProcurement.AppHost.Api.ReadModels;
using IntegratedProcurement.Platform.Audit.Application;
using Microsoft.AspNetCore.Http;
using System.Globalization;

namespace IntegratedProcurement.AppHost.Api.Services;

internal interface IAdminConsoleAuditService
{
    Task<IReadOnlyCollection<AuditItem>> GetAuditLogsAsync(CancellationToken cancellationToken);

    Task WriteAuditAsync(HttpContext httpContext, string action, string module, string description, CancellationToken cancellationToken);
}

/// <summary>
/// Web-layer adapter over the platform <see cref="IAuditTrail"/>: extracts actor + request metadata
/// from the <see cref="HttpContext"/> on write, and shapes the platform audit view into the admin
/// console <see cref="AuditItem"/> read model on read. All persistence lives in the Audit platform service.
/// </summary>
internal sealed class AdminConsoleAuditService : IAdminConsoleAuditService
{
    private readonly IAuditTrail _auditTrail;

    public AdminConsoleAuditService(IAuditTrail auditTrail)
    {
        _auditTrail = auditTrail;
    }

    public async Task<IReadOnlyCollection<AuditItem>> GetAuditLogsAsync(CancellationToken cancellationToken)
    {
        var entries = await _auditTrail.GetRecentAsync(500, cancellationToken);
        return entries
            .Select((entry, index) => new AuditItem(
                index + 1,
                entry.Action,
                entry.ActorName ?? "System",
                entry.Module,
                entry.Description,
                entry.IpAddress ?? "-",
                entry.OccurredAt.UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)))
            .ToArray();
    }

    public async Task WriteAuditAsync(
        HttpContext httpContext,
        string action,
        string module,
        string description,
        CancellationToken cancellationToken)
    {
        var actorName = httpContext.User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(actorName))
        {
            actorName = httpContext.Request.Headers.TryGetValue("X-Actor-Name", out var actorHeader)
                ? actorHeader.ToString()
                : "System";
        }

        var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = httpContext.Request.Headers.UserAgent.ToString();
        await _auditTrail.WriteAsync(action, actorName, module, description, ipAddress, userAgent, cancellationToken);
    }
}