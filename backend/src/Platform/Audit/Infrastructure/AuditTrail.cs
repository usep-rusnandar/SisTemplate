using SisTemplate.Platform.Audit.Application;
using SisTemplate.Platform.Audit.Domain;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.Audit.Infrastructure;

/// <summary>
/// EF Core implementation of the platform audit trail over the shared <see cref="ProcurementDbContext"/>.
/// </summary>
internal sealed class AuditTrail : IAuditTrail
{
    private readonly ProcurementDbContext _dbContext;

    public AuditTrail(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<AuditTrailEntry>> GetRecentAsync(int limit, CancellationToken cancellationToken) =>
        await _dbContext.AuditLogs
            .AsNoTracking()
            .OrderByDescending(log => log.OccurredAt)
            .Take(limit)
            .Select(log => new AuditTrailEntry(
                log.Action,
                log.ActorName,
                log.Module,
                log.Description,
                log.IpAddress,
                log.OccurredAt))
            .ToListAsync(cancellationToken);

    public async Task WriteAsync(
        string action,
        string? actorName,
        string moduleName,
        string description,
        string? ipAddress,
        string? userAgent,
        CancellationToken cancellationToken)
    {
        _dbContext.AuditLogs.Add(new AuditLogEntry(
            Guid.NewGuid(),
            action,
            actorName ?? "System",
            moduleName,
            description,
            ipAddress,
            userAgent,
            DateTimeOffset.UtcNow));
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
