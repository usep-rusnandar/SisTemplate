namespace SisTemplate.Platform.Administration.Application;

public sealed record RetentionResult(int AuditDeleted, int NotificationsDeleted, int NotificationStatesDeleted, int EmailLogsDeleted);

public interface IRetentionService
{
    /// <summary>Applies the configured data-retention policy (audit / notification / email log) and returns the deletion counts.</summary>
    Task<RetentionResult> RunAsync(CancellationToken cancellationToken);
}
