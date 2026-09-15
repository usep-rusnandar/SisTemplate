namespace IntegratedProcurement.Platform.Audit.Application;

/// <summary>
/// Platform audit-trail service: appends audit entries and reads the recent log. The interface takes
/// primitives (no web/HttpContext types) so it stays framework-agnostic; the web layer extracts actor
/// and request metadata before calling <see cref="WriteAsync"/>.
/// </summary>
public interface IAuditTrail
{
    Task<IReadOnlyList<AuditTrailEntry>> GetRecentAsync(int limit, CancellationToken cancellationToken);

    Task WriteAsync(
        string action,
        string? actorName,
        string moduleName,
        string description,
        string? ipAddress,
        string? userAgent,
        CancellationToken cancellationToken);
}

public sealed record AuditTrailEntry(
    string Action,
    string? ActorName,
    string Module,
    string Description,
    string? IpAddress,
    DateTimeOffset OccurredAt);
