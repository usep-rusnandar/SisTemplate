namespace IntegratedProcurement.Platform.Administration.Application;

public interface IAdminConsoleIdentityReadService
{
    Task<IReadOnlyCollection<AdminUserItem>> GetUsersAsync(CancellationToken cancellationToken);

    Task<AdminUserItem?> GetUserAsync(string personnelNo, CancellationToken cancellationToken);

    Task<IReadOnlyCollection<AdminRoleItem>> GetRolesAsync(CancellationToken cancellationToken);

    Task<AdminRoleItem?> GetRoleAsync(string roleCode, CancellationToken cancellationToken);

    Task<IReadOnlyCollection<PermissionGroup>> GetPermissionGroupsAsync(CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<string, IReadOnlyCollection<string>>> GetRolePermissionAssignmentsAsync(CancellationToken cancellationToken);
}
