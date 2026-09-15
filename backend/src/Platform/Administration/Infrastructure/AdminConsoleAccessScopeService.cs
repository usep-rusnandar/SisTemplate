using SisTemplate.BuildingBlocks.Application;
using SisTemplate.BuildingBlocks.Application.Abstractions;
using SisTemplate.Platform.Administration.Application;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.Administration.Infrastructure;

internal sealed class AdminConsoleAccessScopeService : IAdminConsoleAccessScope
{
    private const string SuperAdminRole = "Super Admin";
    private static readonly string[] AdministrationPermissionKeys =
    [
        PermissionKeys.UsersView,
        PermissionKeys.UsersCreate,
        PermissionKeys.UsersUpdate,
        PermissionKeys.UsersPermissions,
        PermissionKeys.RolesView,
    ];

    private readonly ICurrentActor _currentActor;
    private readonly ProcurementDbContext _dbContext;
    private AdminConsoleAccessScope? _cachedScope;

    public AdminConsoleAccessScopeService(
        ICurrentActor currentActor,
        ProcurementDbContext dbContext)
    {
        _currentActor = currentActor;
        _dbContext = dbContext;
    }

    public async Task<AdminConsoleAccessScope> GetCurrentAsync(CancellationToken cancellationToken)
    {
        if (_cachedScope is not null)
        {
            return _cachedScope;
        }

        var roleNames = _currentActor.Actor.Roles
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (roleNames.Contains(SuperAdminRole, StringComparer.OrdinalIgnoreCase))
        {
            return _cachedScope = AdminConsoleAccessScope.Unrestricted;
        }

        // Permission claims are a union, so a user may also hold operational roles in other modules.
        // Only modules from roles that themselves carry an Administration permission contribute to
        // this scope; otherwise "Administrator Vendor + Officer Tracker" could administer Tracker.
        var moduleKeys = await (
                from role in _dbContext.InternalRoles.AsNoTracking()
                join rolePermission in _dbContext.InternalRolePermissions.AsNoTracking()
                    on role.Id equals rolePermission.RoleId
                join permission in _dbContext.Permissions.AsNoTracking()
                    on rolePermission.PermissionId equals permission.Id
                where roleNames.Contains(role.Name)
                    && role.ModuleKey != null
                    && AdministrationPermissionKeys.Contains(permission.Key)
                select role.ModuleKey!)
            .Distinct()
            .OrderBy(moduleKey => moduleKey)
            .ToArrayAsync(cancellationToken);

        return _cachedScope = AdminConsoleAccessScope.Restricted(moduleKeys);
    }
}
