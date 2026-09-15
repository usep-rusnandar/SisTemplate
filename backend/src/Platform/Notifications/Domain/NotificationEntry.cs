namespace SisTemplate.Platform.Notifications.Domain;

/// <summary>
/// A system-generated notification. Notifications are never seeded with dummy data; each row is
/// produced by a real system event. Audience targeting: scope "all" (announcement), "role" (one or
/// more role names), or "user" (a single username).
/// </summary>
public sealed class NotificationEntry
{
    private NotificationEntry()
    {
        Severity = string.Empty;
        Title = string.Empty;
        AudienceScope = string.Empty;
    }

    public NotificationEntry(
        Guid id,
        string severity,
        string title,
        string? detail,
        string audienceScope,
        string? audienceRoles,
        string? audienceUser,
        string? audienceLabel,
        string? module,
        string? linkPath,
        string? createdBy,
        DateTimeOffset createdAt)
    {
        Id = id;
        Severity = severity;
        Title = title;
        Detail = detail;
        AudienceScope = audienceScope;
        AudienceRoles = audienceRoles;
        AudienceUser = audienceUser;
        AudienceLabel = audienceLabel;
        Module = module;
        LinkPath = linkPath;
        CreatedBy = createdBy;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    /// <summary>danger | warning | success | info</summary>
    public string Severity { get; private set; }

    public string Title { get; private set; }

    public string? Detail { get; private set; }

    /// <summary>all | role | user</summary>
    public string AudienceScope { get; private set; }

    /// <summary>Comma-separated role names when <see cref="AudienceScope"/> is "role".</summary>
    public string? AudienceRoles { get; private set; }

    /// <summary>Recipient username (email local-part) when <see cref="AudienceScope"/> is "user".</summary>
    public string? AudienceUser { get; private set; }

    /// <summary>Optional display label shown in the audience badge.</summary>
    public string? AudienceLabel { get; private set; }

    /// <summary>Originating module (e.g. Proposal Tracker), for filtering/analytics.</summary>
    public string? Module { get; private set; }

    public string? LinkPath { get; private set; }

    public string? CreatedBy { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
}

/// <summary>
/// Per-recipient read/dismiss state for a notification, keyed by internal user (PersonnelNo).
/// </summary>
public sealed class NotificationRecipientState
{
    private NotificationRecipientState()
    {
        PersonnelNo = string.Empty;
    }

    public NotificationRecipientState(
        Guid id,
        Guid notificationId,
        string personnelNo,
        DateTimeOffset timestamp)
    {
        Id = id;
        NotificationId = notificationId;
        PersonnelNo = personnelNo;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public Guid NotificationId { get; private set; }

    public string PersonnelNo { get; private set; }

    public DateTimeOffset? ReadAt { get; private set; }

    public DateTimeOffset? DismissedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void MarkRead(DateTimeOffset timestamp)
    {
        ReadAt ??= timestamp;
        UpdatedAt = timestamp;
    }

    public void MarkUnread(DateTimeOffset timestamp)
    {
        ReadAt = null;
        UpdatedAt = timestamp;
    }

    public void Dismiss(DateTimeOffset timestamp)
    {
        DismissedAt ??= timestamp;
        ReadAt ??= timestamp;
        UpdatedAt = timestamp;
    }
}
