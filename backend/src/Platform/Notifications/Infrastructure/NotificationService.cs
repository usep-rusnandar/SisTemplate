using System.Globalization;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Platform.Notifications.Application;
using IntegratedProcurement.Platform.Notifications.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Platform.Notifications.Infrastructure;

internal sealed class NotificationService : INotificationService
{
    private const int MaxFeedSize = 200;

    private readonly ProcurementDbContext _dbContext;
    private readonly ICurrentActor _currentActor;

    public NotificationService(ProcurementDbContext dbContext, ICurrentActor currentActor)
    {
        _dbContext = dbContext;
        _currentActor = currentActor;
    }

    public async Task<NotificationFeed> GetForCurrentActorAsync(CancellationToken cancellationToken)
    {
        var context = await ResolveActorAsync(cancellationToken);
        if (context is null)
        {
            return new NotificationFeed([], 0);
        }

        var visible = await LoadVisibleAsync(context, cancellationToken);
        var states = await LoadStatesAsync(context.PersonnelNo, visible.Select(item => item.Id), cancellationToken);

        var items = new List<NotificationItem>(visible.Count);
        var unread = 0;
        foreach (var notification in visible)
        {
            states.TryGetValue(notification.Id, out var state);
            if (state?.DismissedAt is not null)
            {
                continue;
            }

            var isRead = state?.ReadAt is not null;
            if (!isRead)
            {
                unread++;
            }

            items.Add(ToItem(notification, context, isRead));
        }

        return new NotificationFeed(items, unread);
    }

    public async Task<bool> MarkReadAsync(Guid notificationId, CancellationToken cancellationToken)
    {
        var context = await ResolveActorAsync(cancellationToken);
        if (context is null)
        {
            return false;
        }

        var state = await EnsureStateAsync(notificationId, context.PersonnelNo, cancellationToken);
        if (state is null)
        {
            return false;
        }

        state.MarkRead(DateTimeOffset.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> MarkUnreadAsync(Guid notificationId, CancellationToken cancellationToken)
    {
        var context = await ResolveActorAsync(cancellationToken);
        if (context is null)
        {
            return false;
        }

        var state = await EnsureStateAsync(notificationId, context.PersonnelNo, cancellationToken);
        if (state is null)
        {
            return false;
        }

        state.MarkUnread(DateTimeOffset.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<int> MarkAllReadAsync(CancellationToken cancellationToken)
    {
        var context = await ResolveActorAsync(cancellationToken);
        if (context is null)
        {
            return 0;
        }

        var visible = await LoadVisibleAsync(context, cancellationToken);
        var states = await LoadStatesAsync(context.PersonnelNo, visible.Select(item => item.Id), cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var changed = 0;

        foreach (var notification in visible)
        {
            states.TryGetValue(notification.Id, out var state);
            if (state?.DismissedAt is not null)
            {
                continue;
            }

            if (state is null)
            {
                state = new NotificationRecipientState(Guid.NewGuid(), notification.Id, context.PersonnelNo, now);
                _dbContext.NotificationRecipientStates.Add(state);
            }

            if (state.ReadAt is null)
            {
                state.MarkRead(now);
                changed++;
            }
        }

        if (changed > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return changed;
    }

    public async Task<bool> DismissAsync(Guid notificationId, CancellationToken cancellationToken)
    {
        var context = await ResolveActorAsync(cancellationToken);
        if (context is null)
        {
            return false;
        }

        var state = await EnsureStateAsync(notificationId, context.PersonnelNo, cancellationToken);
        if (state is null)
        {
            return false;
        }

        state.Dismiss(DateTimeOffset.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task NotifyAllAsync(string severity, string title, string? detail, string? linkPath, CancellationToken cancellationToken)
    {
        _dbContext.Notifications.Add(new NotificationEntry(
            Guid.NewGuid(),
            severity,
            title,
            detail,
            "all",
            audienceRoles: null,
            audienceUser: null,
            audienceLabel: "Announcement",
            module: null,
            linkPath: linkPath,
            createdBy: _currentActor.Actor.DisplayName,
            createdAt: DateTimeOffset.UtcNow));
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyModuleAsync(
        string moduleKey,
        string moduleLabel,
        string severity,
        string title,
        string? detail,
        string? linkPath,
        CancellationToken cancellationToken)
    {
        var roleNames = await _dbContext.InternalRoles
            .AsNoTracking()
            .Where(role => role.ModuleKey == moduleKey || role.IsSystem)
            .Select(role => role.Name)
            .ToArrayAsync(cancellationToken);

        if (roleNames.Length == 0)
        {
            return;
        }

        _dbContext.Notifications.Add(new NotificationEntry(
            Guid.NewGuid(),
            severity,
            title,
            detail,
            "role",
            audienceRoles: string.Join(',', roleNames),
            audienceUser: null,
            audienceLabel: moduleLabel,
            module: moduleLabel,
            linkPath: linkPath,
            createdBy: _currentActor.Actor.DisplayName,
            createdAt: DateTimeOffset.UtcNow));
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyUserAsync(
        string username,
        string severity,
        string title,
        string? detail,
        string? linkPath,
        string? moduleName,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return;
        }

        _dbContext.Notifications.Add(new NotificationEntry(
            Guid.NewGuid(),
            severity,
            title,
            detail,
            "user",
            audienceRoles: null,
            audienceUser: username,
            audienceLabel: "Direct",
            module: moduleName,
            linkPath: linkPath,
            createdBy: _currentActor.Actor.DisplayName,
            createdAt: DateTimeOffset.UtcNow));
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyAssignedUserAsync(
        string displayName,
        string fallbackModuleKey,
        string fallbackModuleLabel,
        string severity,
        string title,
        string? detail,
        string? linkPath,
        CancellationToken cancellationToken)
    {
        var username = await ResolveUsernameByDisplayNameAsync(displayName, cancellationToken);
        if (username is not null)
        {
            await NotifyUserAsync(username, severity, title, detail, linkPath, fallbackModuleLabel, cancellationToken);
            return;
        }

        await NotifyModuleAsync(fallbackModuleKey, fallbackModuleLabel, severity, title, detail, linkPath, cancellationToken);
    }

    public async Task NotifyPermissionHoldersAsync(
        string permissionKey,
        string label,
        string severity,
        string title,
        string? detail,
        string? linkPath,
        CancellationToken cancellationToken)
    {
        var roleNames = await (
                from rolePermission in _dbContext.InternalRolePermissions.AsNoTracking()
                join role in _dbContext.InternalRoles.AsNoTracking() on rolePermission.RoleId equals role.Id
                join permission in _dbContext.Permissions.AsNoTracking() on rolePermission.PermissionId equals permission.Id
                where permission.Key == permissionKey
                select role.Name)
            .Distinct()
            .ToArrayAsync(cancellationToken);

        if (roleNames.Length == 0)
        {
            return;
        }

        _dbContext.Notifications.Add(new NotificationEntry(
            Guid.NewGuid(),
            severity,
            title,
            detail,
            "role",
            audienceRoles: string.Join(',', roleNames),
            audienceUser: null,
            audienceLabel: label,
            module: label,
            linkPath: linkPath,
            createdBy: _currentActor.Actor.DisplayName,
            createdAt: DateTimeOffset.UtcNow));
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<string?> ResolveUsernameByDisplayNameAsync(string displayName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return null;
        }

        var email = await _dbContext.InternalUsers
            .AsNoTracking()
            .Where(user => user.CompleteName == displayName && user.DeletedAt == null)
            .Select(user => user.Email)
            .FirstOrDefaultAsync(cancellationToken);

        return string.IsNullOrWhiteSpace(email) ? null : ToUsername(email, displayName);
    }

    private async Task<IReadOnlyList<NotificationEntry>> LoadVisibleAsync(ActorContext context, CancellationToken cancellationToken)
    {
        var candidates = await _dbContext.Notifications
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAt)
            .Take(MaxFeedSize)
            .ToArrayAsync(cancellationToken);

        return candidates.Where(item => IsVisibleTo(item, context)).ToArray();
    }

    private static bool IsVisibleTo(NotificationEntry notification, ActorContext context) =>
        notification.AudienceScope switch
        {
            "all" => true,
            "role" => SplitRoles(notification.AudienceRoles).Any(context.Roles.Contains),
            "user" => !string.IsNullOrWhiteSpace(notification.AudienceUser)
                && string.Equals(notification.AudienceUser, context.Username, StringComparison.OrdinalIgnoreCase),
            _ => false
        };

    private async Task<Dictionary<Guid, NotificationRecipientState>> LoadStatesAsync(
        string personnelNo,
        IEnumerable<Guid> notificationIds,
        CancellationToken cancellationToken)
    {
        var ids = notificationIds.ToArray();
        if (ids.Length == 0)
        {
            return [];
        }

        var states = await _dbContext.NotificationRecipientStates
            .Where(state => state.PersonnelNo == personnelNo && ids.Contains(state.NotificationId))
            .ToArrayAsync(cancellationToken);

        return states.ToDictionary(state => state.NotificationId);
    }

    private async Task<NotificationRecipientState?> EnsureStateAsync(
        Guid notificationId,
        string personnelNo,
        CancellationToken cancellationToken)
    {
        var notificationExists = await _dbContext.Notifications
            .AnyAsync(item => item.Id == notificationId, cancellationToken);
        if (!notificationExists)
        {
            return null;
        }

        var state = await _dbContext.NotificationRecipientStates
            .SingleOrDefaultAsync(
                item => item.NotificationId == notificationId && item.PersonnelNo == personnelNo,
                cancellationToken);
        if (state is null)
        {
            state = new NotificationRecipientState(Guid.NewGuid(), notificationId, personnelNo, DateTimeOffset.UtcNow);
            _dbContext.NotificationRecipientStates.Add(state);
        }

        return state;
    }

    private async Task<ActorContext?> ResolveActorAsync(CancellationToken cancellationToken)
    {
        var actor = _currentActor.Actor;
        if (actor.ActorType != ActorType.Internal || string.IsNullOrWhiteSpace(actor.ActorId))
        {
            return null;
        }

        var personnelNo = actor.ActorId;
        var email = await _dbContext.InternalUsers
            .AsNoTracking()
            .Where(user => user.PersonnelNo == personnelNo && user.DeletedAt == null)
            .Select(user => user.Email)
            .SingleOrDefaultAsync(cancellationToken);

        var roles = actor.Roles?.ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];
        return new ActorContext(personnelNo, ToUsername(email, personnelNo), roles);
    }

    private static NotificationItem ToItem(NotificationEntry notification, ActorContext context, bool isRead)
    {
        var audience = notification.AudienceScope switch
        {
            "role" => new NotificationAudience("role", SplitRoles(notification.AudienceRoles), null, notification.AudienceLabel),
            "user" => new NotificationAudience("user", null, context.Username, notification.AudienceLabel),
            _ => new NotificationAudience("all", null, null, notification.AudienceLabel ?? "Announcement")
        };

        return new NotificationItem(
            notification.Id.ToString(),
            notification.Severity,
            notification.Title,
            notification.Detail,
            audience,
            notification.CreatedAt.UtcDateTime.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
            isRead,
            notification.Module);
    }

    private static string[] SplitRoles(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? []
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string ToUsername(string? email, string personnelNo)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return personnelNo;
        }

        var atIndex = email.IndexOf('@', StringComparison.Ordinal);
        return atIndex > 0 ? email[..atIndex] : email;
    }

    private sealed record ActorContext(string PersonnelNo, string Username, HashSet<string> Roles);
}
