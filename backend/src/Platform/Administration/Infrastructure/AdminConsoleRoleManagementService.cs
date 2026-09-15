using SisTemplate.Platform.Administration.Application;
using SisTemplate.Platform.InternalIdentity.Domain;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.Administration.Infrastructure;

internal sealed class AdminConsoleRoleManagementService : IAdminConsoleRoleManagementService
{
    private readonly ProcurementDbContext _dbContext;

    public AdminConsoleRoleManagementService(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<CreateInternalRoleResult> CreateRoleAsync(CreateInternalRoleCommand command, CancellationToken cancellationToken)
    {
        if (await _dbContext.InternalRoles.AnyAsync(role => role.Code == command.Code, cancellationToken))
        {
            return CreateInternalRoleResult.Duplicate(command.Code);
        }

        var role = InternalRole.Create(command.Code, command.Name, command.ModuleKey, command.IsSystem);
        _dbContext.InternalRoles.Add(role);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (command.PermissionKeys is not null)
        {
            await ReplaceRolePermissionsAsync(role.Id, command.PermissionKeys, cancellationToken);
        }

        return CreateInternalRoleResult.Success(role.Code, role.Name);
    }

    public async Task<UpdateInternalRoleResult?> UpdateRoleAsync(string roleCode, UpdateInternalRoleCommand command, CancellationToken cancellationToken)
    {
        var role = await _dbContext.InternalRoles.SingleOrDefaultAsync(item => item.Code == roleCode, cancellationToken);
        if (role is null)
        {
            return null;
        }

        role.Update(command.Name, command.ModuleKey, command.IsSystem);
        await _dbContext.SaveChangesAsync(cancellationToken);
        if (command.PermissionKeys is not null)
        {
            await ReplaceRolePermissionsAsync(role.Id, command.PermissionKeys, cancellationToken);
        }

        return new UpdateInternalRoleResult(role.Code, role.Name);
    }

    public async Task<SetInternalRolePermissionsResult?> SetRolePermissionsAsync(string roleCode, IReadOnlyCollection<string> permissionKeys, CancellationToken cancellationToken)
    {
        var role = await _dbContext.InternalRoles.SingleOrDefaultAsync(item => item.Code == roleCode, cancellationToken);
        if (role is null)
        {
            return null;
        }

        await ReplaceRolePermissionsAsync(role.Id, permissionKeys, cancellationToken);
        return new SetInternalRolePermissionsResult(role.Code, role.Name);
    }

    public async Task<DuplicateInternalRoleResult> DuplicateRoleAsync(
        string sourceRoleCode,
        DuplicateInternalRoleCommand command,
        CancellationToken cancellationToken)
    {
        var source = await _dbContext.InternalRoles
            .SingleOrDefaultAsync(role => role.Code == sourceRoleCode, cancellationToken);
        if (source is null)
        {
            return DuplicateInternalRoleResult.NotFound();
        }

        var requestedCode = Clean(command.Code);
        var code = requestedCode ?? await AllocateCopyCodeAsync(source.Code, cancellationToken);
        if (await _dbContext.InternalRoles.AnyAsync(role => role.Code == code, cancellationToken))
        {
            return DuplicateInternalRoleResult.Duplicate(code);
        }

        var copy = InternalRole.Create(code, CopyName(source.Name, command.Name), source.ModuleKey, isSystem: false);
        _dbContext.InternalRoles.Add(copy);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var permissionKeys = await _dbContext.InternalRolePermissions
            .Where(assignment => assignment.RoleId == source.Id)
            .Join(
                _dbContext.Permissions,
                assignment => assignment.PermissionId,
                permission => permission.Id,
                (_, permission) => permission.Key)
            .ToArrayAsync(cancellationToken);
        if (permissionKeys.Length > 0)
        {
            await ReplaceRolePermissionsAsync(copy.Id, permissionKeys, cancellationToken);
        }

        return DuplicateInternalRoleResult.Success(copy.Code, copy.Name);
    }

    public async Task<DeleteInternalRoleResult> DeleteRoleAsync(string roleCode, CancellationToken cancellationToken)
    {
        var role = await _dbContext.InternalRoles
            .SingleOrDefaultAsync(item => item.Code == roleCode, cancellationToken);
        if (role is null)
        {
            return DeleteInternalRoleResult.NotFound();
        }

        if (IsProtectedRole(role))
        {
            return DeleteInternalRoleResult.SystemRole(role.Code);
        }

        var assignedUsers = await _dbContext.InternalUserRoles.CountAsync(userRole => userRole.RoleId == role.Id, cancellationToken);
        if (assignedUsers > 0)
        {
            return DeleteInternalRoleResult.InUse(role.Name, assignedUsers);
        }

        await _dbContext.InternalRolePermissions
            .Where(assignment => assignment.RoleId == role.Id)
            .ExecuteDeleteAsync(cancellationToken);
        _dbContext.InternalRoles.Remove(role);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return DeleteInternalRoleResult.Success();
    }

    private async Task<string> AllocateCopyCodeAsync(string sourceCode, CancellationToken cancellationToken)
    {
        var taken = await _dbContext.InternalRoles
            .Select(role => role.Code)
            .ToArrayAsync(cancellationToken);
        var existing = taken.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var baseCode = sourceCode.Length > 90 ? sourceCode[..90] : sourceCode;
        var candidate = Truncate($"{baseCode}-COPY", 100);
        var n = 2;
        while (existing.Contains(candidate))
        {
            var suffix = $"-COPY{n}";
            var prefixLength = Math.Min(baseCode.Length, Math.Max(1, 100 - suffix.Length));
            candidate = $"{baseCode[..prefixLength]}{suffix}";
            n++;
            if (n > 999)
            {
                throw new InvalidOperationException("Unable to allocate a unique copy code.");
            }
        }

        return candidate;
    }

    private async Task ReplaceRolePermissionsAsync(Guid roleId, IReadOnlyCollection<string> permissionKeys, CancellationToken cancellationToken)
    {
        var requested = permissionKeys
            .Select(Clean)
            .Where(permission => permission is not null)
            .Select(permission => permission!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var permissions = await _dbContext.Permissions
            .Where(permission => requested.Contains(permission.Key))
            .ToArrayAsync(cancellationToken);
        var missing = requested
            .Except(permissions.Select(permission => permission.Key), StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (missing.Length > 0)
        {
            throw new InvalidOperationException($"Unknown permissions: {string.Join(", ", missing)}");
        }

        await _dbContext.InternalRolePermissions
            .Where(rolePermission => rolePermission.RoleId == roleId)
            .ExecuteDeleteAsync(cancellationToken);
        foreach (var permission in permissions)
        {
            _dbContext.InternalRolePermissions.Add(InternalRolePermissionAssignment.Create(roleId, permission.Id));
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string CopyName(string sourceName, string? requested)
    {
        var name = string.IsNullOrWhiteSpace(requested) ? $"{sourceName.Trim()} (copy)" : requested.Trim();
        return Truncate(name, 200);
    }

    private static bool IsProtectedRole(InternalRole role) =>
        role.IsSystem
        || string.Equals(role.Code, "SPR-ADM", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role.Name, "Super Admin", StringComparison.OrdinalIgnoreCase);

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];
}
