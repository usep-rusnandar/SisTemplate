namespace SisTemplate.Platform.Administration.Application;

public interface IAdminConsoleUserManagementService
{
    Task<CreateInternalUserResult> CreateUserAsync(CreateInternalUserCommand command, CancellationToken cancellationToken);

    Task<UpdateInternalUserResult?> UpdateUserAsync(string personnelNo, UpdateInternalUserCommand command, CancellationToken cancellationToken);

    Task<SetInternalUserStatusResult?> SetUserStatusAsync(string personnelNo, string status, CancellationToken cancellationToken);

    Task<SetInternalUserRolesResult?> SetUserRolesAsync(string personnelNo, IReadOnlyCollection<string> roleNames, CancellationToken cancellationToken);
}

public sealed record CreateInternalUserCommand(
    string PersonnelNo,
    string FullName,
    string? Email,
    string? Department,
    string? Position,
    string? Status,
    IReadOnlyCollection<string> RoleNames,
    string? ReportTo = null);

public sealed record UpdateInternalUserCommand(
    string FullName,
    string? Email,
    string? Department,
    string? Position,
    string? Status,
    string? ReportTo = null);

public sealed record CreateInternalUserResult(bool Created, bool AlreadyExists, string PersonnelNo, string? DisplayName)
{
    public static CreateInternalUserResult Success(string personnelNo, string displayName) => new(true, false, personnelNo, displayName);

    public static CreateInternalUserResult Duplicate(string personnelNo) => new(false, true, personnelNo, null);
}

public sealed record UpdateInternalUserResult(string PersonnelNo, string DisplayName);

public sealed record SetInternalUserStatusResult(string PersonnelNo, string DisplayName, string Status);

public sealed record SetInternalUserRolesResult(string PersonnelNo, string DisplayName);
