namespace SisTemplate.Platform.Notifications.Application;

public interface INotificationService
{
    Task<NotificationFeed> GetForCurrentActorAsync(CancellationToken cancellationToken);

    Task<bool> MarkReadAsync(Guid notificationId, CancellationToken cancellationToken);

    Task<bool> MarkUnreadAsync(Guid notificationId, CancellationToken cancellationToken);

    Task<int> MarkAllReadAsync(CancellationToken cancellationToken);

    Task<bool> DismissAsync(Guid notificationId, CancellationToken cancellationToken);

    /// <summary>Creates a notification visible to everyone (announcement).</summary>
    Task NotifyAllAsync(string severity, string title, string? detail, string? linkPath, CancellationToken cancellationToken);

    /// <summary>
    /// Creates a notification scoped to the roles that own a module (plus system roles such as
    /// Super Admin). Used for real system events raised inside completed modules.
    /// </summary>
    Task NotifyModuleAsync(string moduleKey, string moduleLabel, string severity, string title, string? detail, string? linkPath, CancellationToken cancellationToken);

    /// <summary>Creates a direct notification addressed to a single internal user (by username).</summary>
    Task NotifyUserAsync(string username, string severity, string title, string? detail, string? linkPath, string? moduleName, CancellationToken cancellationToken);

    /// <summary>
    /// Sends a direct notification to the internal user matching <paramref name="displayName"/>.
    /// If no matching user is found, falls back to a module-scoped notification so the event is not lost.
    /// </summary>
    Task NotifyAssignedUserAsync(string displayName, string fallbackModuleKey, string fallbackModuleLabel, string severity, string title, string? detail, string? linkPath, CancellationToken cancellationToken);

    /// <summary>
    /// Creates a notification scoped to every role that holds the given permission key
    /// (e.g. notify all user administrators). Used for admin-domain events.
    /// </summary>
    Task NotifyPermissionHoldersAsync(string permissionKey, string label, string severity, string title, string? detail, string? linkPath, CancellationToken cancellationToken);
}

public sealed record NotificationFeed(IReadOnlyCollection<NotificationItem> Items, int Unread);

public sealed record NotificationItem(
    string Id,
    string Severity,
    string Title,
    string? Detail,
    NotificationAudience Audience,
    string Time,
    bool Read,
    string? Module);

public sealed record NotificationAudience(
    string Scope,
    IReadOnlyCollection<string>? Roles,
    string? User,
    string? Label);
