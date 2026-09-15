namespace SisTemplate.Platform.Administration.Application;

// Read-model contracts returned by the Administration query/management services. The host's canned
// fallback factory and endpoints also consume these (one-way: host → this Application layer).

public sealed record PermissionGroup(
    string Module,
    string Icon,
    IReadOnlyCollection<PermissionItem> Permissions);

public sealed record PermissionItem(string Key, string Name, string Description);

public sealed record AdminUserItem(
    int Id,
    string PersonnelNo,
    string Username,
    string FullName,
    string Email,
    string Status,
    IReadOnlyCollection<string> Roles,
    string LastActive,
    string ReportTo = "",
    string? ReportToPersonnelNo = null,
    string? AvatarUrl = null,
    bool HasLocalPassword = false,
    bool MustChangePassword = false);

public sealed record AdminRoleItem(
    string RoleId,
    string Name,
    string Description,
    int Users,
    int Permissions,
    bool IsSystem,
    IReadOnlyCollection<string> Modules);

public sealed record MasterDataSet(
    string Key,
    string Name,
    string TableName,
    string Owner,
    IReadOnlyCollection<MasterDataRecord> Records);

public sealed record MasterDataRecord(
    string Code,
    string Name,
    string Status,
    string Description,
    string? PayloadJson = null,
    string? ParentCode = null);
