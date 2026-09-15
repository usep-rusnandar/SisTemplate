namespace SisTemplate.Platform.Administration.Application;

public interface IAdminConsoleRoleManagementService
{
    Task<CreateInternalRoleResult> CreateRoleAsync(CreateInternalRoleCommand command, CancellationToken cancellationToken);

    Task<UpdateInternalRoleResult?> UpdateRoleAsync(string roleCode, UpdateInternalRoleCommand command, CancellationToken cancellationToken);

    Task<SetInternalRolePermissionsResult?> SetRolePermissionsAsync(string roleCode, IReadOnlyCollection<string> permissionKeys, CancellationToken cancellationToken);

    Task<DuplicateInternalRoleResult> DuplicateRoleAsync(string sourceRoleCode, DuplicateInternalRoleCommand command, CancellationToken cancellationToken);

    Task<DeleteInternalRoleResult> DeleteRoleAsync(string roleCode, CancellationToken cancellationToken);
}

public sealed record CreateInternalRoleCommand(
    string Code,
    string Name,
    string? ModuleKey,
    bool IsSystem,
    IReadOnlyCollection<string>? PermissionKeys);

public sealed record UpdateInternalRoleCommand(
    string Name,
    string? ModuleKey,
    bool? IsSystem,
    IReadOnlyCollection<string>? PermissionKeys);

public sealed record CreateInternalRoleResult(bool Created, bool AlreadyExists, string RoleCode, string? Name)
{
    public static CreateInternalRoleResult Success(string roleCode, string name) => new(true, false, roleCode, name);

    public static CreateInternalRoleResult Duplicate(string roleCode) => new(false, true, roleCode, null);
}

public sealed record UpdateInternalRoleResult(string RoleCode, string Name);

public sealed record SetInternalRolePermissionsResult(string RoleCode, string Name);

public sealed record DuplicateInternalRoleCommand(string? Code, string? Name);

public sealed record DuplicateInternalRoleResult(bool Found, bool Created, bool AlreadyExists, string? RoleCode, string? Name)
{
    public static DuplicateInternalRoleResult NotFound() => new(false, false, false, null, null);

    public static DuplicateInternalRoleResult Duplicate(string roleCode) => new(true, false, true, roleCode, null);

    public static DuplicateInternalRoleResult Success(string roleCode, string name) => new(true, true, false, roleCode, name);
}

public sealed record DeleteInternalRoleResult(bool Found, bool Deleted, string? ErrorCode, string? Message, int AssignedUsers)
{
    public static DeleteInternalRoleResult NotFound() =>
        new(false, false, "role_not_found", "Role was not found.", 0);

    public static DeleteInternalRoleResult SystemRole(string roleCode) =>
        new(true, false, "role_is_system", $"System role '{roleCode}' cannot be deleted.", 0);

    public static DeleteInternalRoleResult InUse(string name, int assignedUsers) =>
        new(true, false, "role_in_use", $"Role '{name}' is assigned to {assignedUsers} user(s) and cannot be deleted.", assignedUsers);

    public static DeleteInternalRoleResult Success() => new(true, true, null, null, 0);
}
