using SisTemplate.BuildingBlocks.Domain.Entities;

namespace SisTemplate.Platform.InternalIdentity.Domain;

public sealed class InternalUser : SoftDeleteEntity
{
    private InternalUser()
    {
    }

    private InternalUser(
        Guid id,
        string personnelNo,
        string completeName,
        string? email,
        string? department,
        string? position,
        string status)
        : base(id)
    {
        PersonnelNo = personnelNo;
        CompleteName = completeName;
        Email = email;
        Department = department;
        Position = position;
        Status = status;
    }

    public string PersonnelNo { get; private set; } = string.Empty;

    public string CompleteName { get; private set; } = string.Empty;

    public string? Email { get; private set; }

    public string? Department { get; private set; }

    public string? Position { get; private set; }

    public string Status { get; private set; } = InternalIdentityStatuses.Active;

    /// <summary>Direct manager in the internal reporting line (e.g. Officer → Section Head).</summary>
    public Guid? ManagerUserId { get; private set; }

    public string? PasswordHash { get; private set; }

    public string? SecurityStamp { get; private set; }

    public DateTimeOffset? LockoutEnd { get; private set; }

    public int AccessFailedCount { get; private set; }

    public bool MustChangePassword { get; private set; }

    public DateTimeOffset? PasswordSetAt { get; private set; }

    public bool HasLocalPassword => !string.IsNullOrEmpty(PasswordHash);

    public bool IsLockedOut => LockoutEnd is DateTimeOffset end && end > DateTimeOffset.UtcNow;

    public bool IsActive => Status == InternalIdentityStatuses.Active;

    public void UpdateProfile(
        string completeName,
        string? email = null,
        string? department = null,
        string? position = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(completeName);

        CompleteName = completeName.Trim();
        Email = email?.Trim();
        Department = department?.Trim();
        Position = position?.Trim();
    }

    public void SetManager(Guid? managerUserId)
    {
        if (managerUserId == Id)
        {
            throw new InvalidOperationException("A user cannot report to themselves.");
        }

        ManagerUserId = managerUserId;
    }

    public void SetStatus(string status)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(status);
        if (status is not InternalIdentityStatuses.Active
            and not InternalIdentityStatuses.Inactive
            and not InternalIdentityStatuses.Suspended)
        {
            throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported internal user status.");
        }

        Status = status.Trim();
    }

    public void SetLocalPassword(string passwordHash, bool mustChangePassword)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);

        PasswordHash = passwordHash;
        SecurityStamp = Guid.NewGuid().ToString("N");
        PasswordSetAt = DateTimeOffset.UtcNow;
        MustChangePassword = mustChangePassword;
        AccessFailedCount = 0;
        LockoutEnd = null;
    }

    public void ReplacePasswordHash(string passwordHash)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);
        PasswordHash = passwordHash;
    }

    public void ClearMustChangePassword()
    {
        MustChangePassword = false;
    }

    public void RegisterFailedAccess(int maxAttempts, TimeSpan lockoutDuration)
    {
        AccessFailedCount++;
        if (AccessFailedCount >= Math.Max(1, maxAttempts))
        {
            LockoutEnd = DateTimeOffset.UtcNow.Add(lockoutDuration);
        }
    }

    public void RegisterSuccessfulAccess()
    {
        AccessFailedCount = 0;
        LockoutEnd = null;
    }

    public static InternalUser Create(
        string personnelNo,
        string completeName,
        string? email = null,
        string? department = null,
        string? position = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(personnelNo);
        ArgumentException.ThrowIfNullOrWhiteSpace(completeName);

        return new InternalUser(
            Guid.NewGuid(),
            personnelNo.Trim(),
            completeName.Trim(),
            email?.Trim(),
            department?.Trim(),
            position?.Trim(),
            InternalIdentityStatuses.Active);
    }
}
