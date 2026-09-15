using SisTemplate.Platform.Administration.Application;
using SisTemplate.Platform.InternalIdentity.Domain;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.Administration.Infrastructure;

internal sealed class AdminConsoleUserManagementService : IAdminConsoleUserManagementService
{
    private readonly ProcurementDbContext _dbContext;
    private readonly IAdminConsoleAccessScope _accessScope;

    public AdminConsoleUserManagementService(
        ProcurementDbContext dbContext,
        IAdminConsoleAccessScope accessScope)
    {
        _dbContext = dbContext;
        _accessScope = accessScope;
    }

    public async Task<CreateInternalUserResult> CreateUserAsync(CreateInternalUserCommand command, CancellationToken cancellationToken)
    {
        if (await _dbContext.InternalUsers.AnyAsync(user => user.PersonnelNo == command.PersonnelNo && user.DeletedAt == null, cancellationToken))
        {
            return CreateInternalUserResult.Duplicate(command.PersonnelNo);
        }

        var scope = await _accessScope.GetCurrentAsync(cancellationToken);
        var roles = await ResolveAssignableRolesAsync(command.RoleNames, scope, cancellationToken);
        var user = InternalUser.Create(
            command.PersonnelNo,
            command.FullName,
            command.Email,
            command.Department,
            command.Position);
        user.SetStatus(command.Status ?? InternalIdentityStatuses.Active);
        await ApplyManagerAsync(user, command.ReportTo, cancellationToken);
        _dbContext.InternalUsers.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await ReplaceScopedUserRolesAsync(user.Id, roles, scope, cancellationToken);

        return CreateInternalUserResult.Success(user.PersonnelNo, user.CompleteName);
    }

    public async Task<UpdateInternalUserResult?> UpdateUserAsync(string personnelNo, UpdateInternalUserCommand command, CancellationToken cancellationToken)
    {
        var scope = await _accessScope.GetCurrentAsync(cancellationToken);
        var user = await _dbContext.InternalUsers
            .SingleOrDefaultAsync(item => item.PersonnelNo == personnelNo && item.DeletedAt == null, cancellationToken);
        if (user is null || !await CanAccessUserAsync(user.Id, scope, cancellationToken))
        {
            return null;
        }

        user.UpdateProfile(
            command.FullName,
            command.Email,
            command.Department,
            command.Position);
        if (!string.IsNullOrWhiteSpace(command.Status))
        {
            user.SetStatus(command.Status);
        }

        await ApplyManagerAsync(user, command.ReportTo, cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new UpdateInternalUserResult(user.PersonnelNo, user.CompleteName);
    }

    private async Task ApplyManagerAsync(InternalUser user, string? reportTo, CancellationToken cancellationToken)
    {
        // null = leave unchanged (optional on create/update); blank string clears the manager.
        if (reportTo is null)
        {
            return;
        }

        var key = reportTo.Trim();
        if (key.Length == 0)
        {
            user.SetManager(null);
            return;
        }

        var manager = await _dbContext.InternalUsers
            .AsNoTracking()
            .Where(item => item.DeletedAt == null)
            .Where(item =>
                item.PersonnelNo == key
                || item.CompleteName == key
                || (item.Email != null && item.Email == key))
            .Select(item => new { item.Id })
            .FirstOrDefaultAsync(cancellationToken);
        if (manager is null)
        {
            throw new InvalidOperationException($"Unknown report-to user: {key}");
        }

        user.SetManager(manager.Id);
    }

    public async Task<SetInternalUserStatusResult?> SetUserStatusAsync(string personnelNo, string status, CancellationToken cancellationToken)
    {
        var scope = await _accessScope.GetCurrentAsync(cancellationToken);
        var user = await _dbContext.InternalUsers
            .SingleOrDefaultAsync(item => item.PersonnelNo == personnelNo && item.DeletedAt == null, cancellationToken);
        if (user is null || !await CanAccessUserAsync(user.Id, scope, cancellationToken))
        {
            return null;
        }

        user.SetStatus(status);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new SetInternalUserStatusResult(user.PersonnelNo, user.CompleteName, status);
    }

    public async Task<SetInternalUserRolesResult?> SetUserRolesAsync(string personnelNo, IReadOnlyCollection<string> roleNames, CancellationToken cancellationToken)
    {
        var scope = await _accessScope.GetCurrentAsync(cancellationToken);
        var user = await _dbContext.InternalUsers
            .SingleOrDefaultAsync(item => item.PersonnelNo == personnelNo && item.DeletedAt == null, cancellationToken);
        if (user is null || !await CanAccessUserAsync(user.Id, scope, cancellationToken))
        {
            return null;
        }

        var roles = await ResolveAssignableRolesAsync(roleNames, scope, cancellationToken);
        await ReplaceScopedUserRolesAsync(user.Id, roles, scope, cancellationToken);
        return new SetInternalUserRolesResult(user.PersonnelNo, user.CompleteName);
    }

    private async Task<InternalRole[]> ResolveAssignableRolesAsync(
        IReadOnlyCollection<string> roleNames,
        AdminConsoleAccessScope scope,
        CancellationToken cancellationToken)
    {
        var requested = roleNames
            .Select(Clean)
            .Where(role => role is not null)
            .Select(role => role!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (requested.Length == 0)
        {
            throw new InvalidOperationException("At least one role is required.");
        }

        var roles = await ApplyRoleScope(_dbContext.InternalRoles, scope)
            .Where(role => requested.Contains(role.Name))
            .ToArrayAsync(cancellationToken);
        var missing = requested
            .Except(roles.Select(role => role.Name), StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (missing.Length > 0)
        {
            throw new InvalidOperationException($"Unknown roles: {string.Join(", ", missing)}");
        }

        return roles;
    }

    private async Task ReplaceScopedUserRolesAsync(
        Guid userId,
        IReadOnlyCollection<InternalRole> roles,
        AdminConsoleAccessScope scope,
        CancellationToken cancellationToken)
    {
        var replaceableRoleIds = await ApplyRoleScope(_dbContext.InternalRoles.AsNoTracking(), scope)
            .Select(role => role.Id)
            .ToArrayAsync(cancellationToken);

        await _dbContext.InternalUserRoles
            .Where(userRole => userRole.UserId == userId && replaceableRoleIds.Contains(userRole.RoleId))
            .ExecuteDeleteAsync(cancellationToken);
        foreach (var role in roles)
        {
            _dbContext.InternalUserRoles.Add(InternalUserRole.Create(userId, role.Id));
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<bool> CanAccessUserAsync(
        Guid userId,
        AdminConsoleAccessScope scope,
        CancellationToken cancellationToken)
    {
        if (scope.IsUnrestricted)
        {
            return true;
        }

        var accessibleRoles = ApplyRoleScope(_dbContext.InternalRoles.AsNoTracking(), scope);
        return await (
                from userRole in _dbContext.InternalUserRoles.AsNoTracking()
                join role in accessibleRoles on userRole.RoleId equals role.Id
                where userRole.UserId == userId
                select userRole.Id)
            .AnyAsync(cancellationToken);
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

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
