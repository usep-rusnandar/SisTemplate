using System.Globalization;
using SisTemplate.Platform.Administration.Application;
using SisTemplate.Platform.InternalIdentity.Domain;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.Administration.Infrastructure;

internal sealed class AdminConsoleIdentityReadService : IAdminConsoleIdentityReadService
{
    private readonly ProcurementDbContext _dbContext;
    private readonly IAdminConsoleAccessScope _accessScope;

    public AdminConsoleIdentityReadService(
        ProcurementDbContext dbContext,
        IAdminConsoleAccessScope accessScope)
    {
        _dbContext = dbContext;
        _accessScope = accessScope;
    }

    public async Task<IReadOnlyCollection<AdminUserItem>> GetUsersAsync(CancellationToken cancellationToken)
    {
        var scope = await _accessScope.GetCurrentAsync(cancellationToken);
        var accessibleRoles = await ApplyRoleScope(_dbContext.InternalRoles.AsNoTracking(), scope)
            .Select(role => new { role.Id, role.Name })
            .ToArrayAsync(cancellationToken);
        if (accessibleRoles.Length == 0 && !scope.IsUnrestricted)
        {
            return [];
        }

        var accessibleRoleIds = accessibleRoles.Select(role => role.Id).ToArray();
        var accessibleRoleNames = accessibleRoles.ToDictionary(role => role.Id, role => role.Name);
        var userRoles = await _dbContext.InternalUserRoles
            .AsNoTracking()
            .Where(userRole => accessibleRoleIds.Contains(userRole.RoleId))
            .Select(userRole => new { userRole.UserId, userRole.RoleId })
            .ToArrayAsync(cancellationToken);
        var accessibleUserIds = userRoles.Select(userRole => userRole.UserId).Distinct().ToArray();
        var usersQuery = _dbContext.InternalUsers
            .AsNoTracking()
            .Where(user => user.DeletedAt == null);
        if (!scope.IsUnrestricted)
        {
            usersQuery = usersQuery.Where(user => accessibleUserIds.Contains(user.Id));
        }

        var users = await usersQuery
            .OrderBy(user => user.CompleteName)
            .ToArrayAsync(cancellationToken);
        if (users.Length == 0)
        {
            return [];
        }

        var rolesByUser = userRoles
            .GroupBy(item => item.UserId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyCollection<string>)group
                    .Select(item => accessibleRoleNames[item.RoleId])
                    .OrderBy(name => name)
                    .ToArray());

        var managersById = await LoadManagersByIdAsync(users.Select(user => user.ManagerUserId), cancellationToken);

        return users
            .Select((user, index) => BuildAdminUserItem(
                user,
                index + 1,
                rolesByUser.GetValueOrDefault(user.Id) ?? [],
                ResolveManager(user.ManagerUserId, managersById)))
            .ToArray();
    }

    public async Task<AdminUserItem?> GetUserAsync(string personnelNo, CancellationToken cancellationToken)
    {
        var scope = await _accessScope.GetCurrentAsync(cancellationToken);
        var accessibleRoles = ApplyRoleScope(_dbContext.InternalRoles.AsNoTracking(), scope);
        var user = await _dbContext.InternalUsers
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.PersonnelNo == personnelNo && item.DeletedAt == null, cancellationToken);
        if (user is null)
        {
            return null;
        }

        var roles = await (
                from userRole in _dbContext.InternalUserRoles.AsNoTracking()
                join role in accessibleRoles
                    on userRole.RoleId equals role.Id
                where userRole.UserId == user.Id
                orderby role.Name
                select role.Name)
            .ToArrayAsync(cancellationToken);

        if (roles.Length == 0 && !scope.IsUnrestricted)
        {
            return null;
        }

        var managersById = await LoadManagersByIdAsync([user.ManagerUserId], cancellationToken);
        return BuildAdminUserItem(user, 1, roles, ResolveManager(user.ManagerUserId, managersById));
    }

    public async Task<IReadOnlyCollection<AdminRoleItem>> GetRolesAsync(CancellationToken cancellationToken)
    {
        var scope = await _accessScope.GetCurrentAsync(cancellationToken);
        var roles = await ApplyRoleScope(_dbContext.InternalRoles.AsNoTracking(), scope)
            .OrderBy(role => role.Name)
            .ToArrayAsync(cancellationToken);
        if (roles.Length == 0)
        {
            return [];
        }

        var roleIds = roles.Select(role => role.Id).ToArray();
        var usersByRole = await _dbContext.InternalUserRoles
            .AsNoTracking()
            .Where(userRole => roleIds.Contains(userRole.RoleId))
            .GroupBy(userRole => userRole.RoleId)
            .Select(group => new { RoleId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.RoleId, item => item.Count, cancellationToken);
        var permissionsByRole = await _dbContext.InternalRolePermissions
            .AsNoTracking()
            .Where(rolePermission => roleIds.Contains(rolePermission.RoleId))
            .GroupBy(rolePermission => rolePermission.RoleId)
            .Select(group => new { RoleId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.RoleId, item => item.Count, cancellationToken);

        return roles
            .Select(role => new AdminRoleItem(
                role.Code,
                role.Name,
                BuildRoleDescription(role.Name, role.ModuleKey),
                usersByRole.GetValueOrDefault(role.Id),
                permissionsByRole.GetValueOrDefault(role.Id),
                role.IsSystem,
                BuildRoleModules(role.Name, role.ModuleKey, role.IsSystem)))
            .ToArray();
    }

    public async Task<AdminRoleItem?> GetRoleAsync(string roleCode, CancellationToken cancellationToken)
    {
        var roles = await GetRolesAsync(cancellationToken);
        return roles.FirstOrDefault(item => item.RoleId == roleCode);
    }

    public async Task<IReadOnlyCollection<PermissionGroup>> GetPermissionGroupsAsync(CancellationToken cancellationToken)
    {
        var permissions = await _dbContext.Permissions
            .AsNoTracking()
            .OrderBy(permission => permission.ModuleKey)
            .ThenBy(permission => permission.Key)
            .ToArrayAsync(cancellationToken);
        if (permissions.Length == 0)
        {
            return [];
        }

        return permissions
            .GroupBy(permission => permission.ModuleKey)
            .Select(group => new PermissionGroup(
                FormatModuleLabel(group.Key),
                IconForPermissionGroup(group.Key),
                group.Select(permission => new PermissionItem(
                        permission.Key,
                        permission.Name,
                        permission.Description ?? string.Empty))
                    .ToArray()))
            .OrderBy(group => group.Module)
            .ToArray();
    }

    public async Task<IReadOnlyDictionary<string, IReadOnlyCollection<string>>> GetRolePermissionAssignmentsAsync(CancellationToken cancellationToken)
    {
        var scope = await _accessScope.GetCurrentAsync(cancellationToken);
        var accessibleRoles = ApplyRoleScope(_dbContext.InternalRoles.AsNoTracking(), scope);
        var rows = await (
                from rolePermission in _dbContext.InternalRolePermissions.AsNoTracking()
                join role in accessibleRoles
                    on rolePermission.RoleId equals role.Id
                join permission in _dbContext.Permissions.AsNoTracking()
                    on rolePermission.PermissionId equals permission.Id
                select new { role.Code, permission.Key })
            .ToArrayAsync(cancellationToken);

        return rows
            .GroupBy(item => item.Code)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyCollection<string>)group
                    .Select(item => item.Key)
                    .OrderBy(key => key)
                    .ToArray());
    }

    private static IQueryable<InternalRole> ApplyRoleScope(
        IQueryable<InternalRole> roles,
        AdminConsoleAccessScope scope)
    {
        if (scope.IsUnrestricted)
        {
            return roles;
        }

        var moduleKeys = scope.ModuleKeys.ToArray();
        return roles.Where(role => role.ModuleKey != null && moduleKeys.Contains(role.ModuleKey));
    }

    private async Task<Dictionary<Guid, InternalUser>> LoadManagersByIdAsync(
        IEnumerable<Guid?> managerIds,
        CancellationToken cancellationToken)
    {
        var ids = managerIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToArray();
        if (ids.Length == 0)
        {
            return [];
        }

        return await _dbContext.InternalUsers
            .AsNoTracking()
            .Where(user => ids.Contains(user.Id) && user.DeletedAt == null)
            .ToDictionaryAsync(user => user.Id, cancellationToken);
    }

    private static (string Name, string? PersonnelNo) ResolveManager(
        Guid? managerUserId,
        Dictionary<Guid, InternalUser> managersById)
    {
        if (managerUserId is null || !managersById.TryGetValue(managerUserId.Value, out var manager))
        {
            return (string.Empty, null);
        }

        return (manager.CompleteName, manager.PersonnelNo);
    }

    private static AdminUserItem BuildAdminUserItem(
        InternalUser user,
        int sequence,
        IReadOnlyCollection<string> roles,
        (string Name, string? PersonnelNo) manager) =>
        new(
            sequence,
            user.PersonnelNo,
            ToUsername(user.Email, user.PersonnelNo),
            user.CompleteName,
            user.Email ?? string.Empty,
            user.Status,
            roles,
            FormatRelativeLastActive(user.UpdatedAt ?? user.CreatedAt),
            manager.Name,
            manager.PersonnelNo,
            AvatarUrl: null,
            HasLocalPassword: user.HasLocalPassword,
            MustChangePassword: user.MustChangePassword);

    private static string ToUsername(string? email, string personnelNo)
    {
        if (!string.IsNullOrWhiteSpace(email))
        {
            var atIndex = email.IndexOf('@', StringComparison.Ordinal);
            return atIndex > 0 ? email[..atIndex] : email;
        }

        return personnelNo;
    }

    private static string FormatRelativeLastActive(DateTimeOffset? timestamp) =>
        timestamp is null ? "Never" : timestamp.Value.UtcDateTime.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);

    private static string BuildRoleDescription(string name, string? moduleKey) =>
        string.IsNullOrWhiteSpace(moduleKey)
            ? $"{name} access profile."
            : $"{name} access profile for {FormatModuleLabel(moduleKey)}.";

    private static readonly string[] AllFunctionalModules =
        ["vendorWorkspace", "vendorOnboarding", "proposalTracker", "contractInitiationPlatform", "contractMonitoring"];

    private static string[] BuildRoleModules(string roleName, string? moduleKey, bool isSystem)
    {
        // A role's own ModuleKey is authoritative: a per-module role scopes to exactly that module,
        // whatever its display name says. Only genuinely cross-module roles (system roles, and roles
        // seeded with no ModuleKey at all such as Division Head) span every module. Department Heads
        // ARE per-module and used to be reported as cross-module here purely by name match, which
        // made the Roles list claim access the role does not actually grant.
        if (isSystem)
        {
            return AllFunctionalModules;
        }

        if (!string.IsNullOrWhiteSpace(moduleKey))
        {
            return [moduleKey];
        }

        if (roleName.Contains("Division Head", StringComparison.OrdinalIgnoreCase))
        {
            return AllFunctionalModules;
        }

        if (roleName.Contains("Vendor", StringComparison.OrdinalIgnoreCase))
        {
            return ["vendorOnboarding"];
        }

        if (roleName.Contains("Tracker", StringComparison.OrdinalIgnoreCase)
            || roleName.Contains("Contract Initiation Platform", StringComparison.OrdinalIgnoreCase))
        {
            return ["proposalTracker"];
        }

        if (roleName.Contains("Contract Monitoring", StringComparison.OrdinalIgnoreCase))
        {
            return ["contractMonitoring"];
        }

        return ["administration"];
    }

    // Display labels for the module keys that carry a fixed product name; anything else is
    // de-camelCased generically below.
    private static readonly Dictionary<string, string> ModuleLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["vendorWorkspace"] = "Vendor Workspace",
        ["vendorOnboarding"] = "Vendor Onboarding",
        ["proposalTracker"] = "Proposal Tracker",
        ["contractInitiationPlatform"] = "Contract Initiation Platform",
        ["contractMonitoring"] = "Contract Monitoring",
        ["masterData"] = "Master Data",
        ["superAdmin"] = "Super Admin",
    };

    private static string FormatModuleLabel(string moduleKey)
    {
        if (ModuleLabels.TryGetValue(moduleKey, out var label))
        {
            return label;
        }

        // Split on separators AND camelCase humps, so "masterData" reads "Master Data" rather than
        // "MasterData" (module keys are camelCase by convention — see ModuleKeys).
        var spaced = string.Concat(moduleKey
            .Replace('-', ' ')
            .Replace('_', ' ')
            .Select((character, index) => index > 0 && char.IsUpper(character) ? $" {character}" : character.ToString()));

        return spaced
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(word => word.Length == 1
                ? word.ToUpperInvariant()
                : char.ToUpperInvariant(word[0]) + word[1..])
            .Aggregate(string.Empty, (current, word) => string.IsNullOrEmpty(current) ? word : $"{current} {word}");
    }

    // Icons for the functional modules + master data, matching the frontend module registry
    // (APP_MODULES in Data.jsx) so a permission group looks the same wherever it is rendered.
    private static readonly Dictionary<string, string> ModuleIcons = new(StringComparer.OrdinalIgnoreCase)
    {
        ["vendorWorkspace"] = "handshake",
        ["vendorOnboarding"] = "building-2",
        ["proposalTracker"] = "route",
        ["contractInitiationPlatform"] = "sparkles",
        ["contractMonitoring"] = "file-text",
        ["masterData"] = "database",
        ["dashboard"] = "layout-grid",
        ["languages"] = "languages",
    };

    private static string IconForPermissionGroup(string moduleKey)
    {
        if (ModuleIcons.TryGetValue(moduleKey, out var icon))
        {
            return icon;
        }

        var key = moduleKey.ToLowerInvariant();
        if (key.Contains("user", StringComparison.Ordinal))
        {
            return "users-round";
        }

        if (key.Contains("role", StringComparison.Ordinal) || key.Contains("permission", StringComparison.Ordinal))
        {
            return "shield-check";
        }

        if (key.Contains("email", StringComparison.Ordinal))
        {
            return "mail";
        }

        if (key.Contains("audit", StringComparison.Ordinal))
        {
            return "scroll-text";
        }

        if (key.Contains("setting", StringComparison.Ordinal))
        {
            return "sliders-horizontal";
        }

        return "key-round";
    }
}
