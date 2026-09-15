using SisTemplate.Platform.InternalIdentity.Application.Access;
using SisTemplate.Platform.InternalIdentity.Application.Sso;
using SisTemplate.Platform.InternalIdentity.Domain;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.InternalIdentity.Infrastructure.Access;

public sealed class InternalUserAccessService : IInternalUserAccessService, ISsoPersonnelMapper
{
    private readonly ProcurementDbContext _dbContext;

    public InternalUserAccessService(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<InternalUserAccess?> FindActiveByPersonnelNoAsync(
        string personnelNo,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(personnelNo))
        {
            return null;
        }

        return await _dbContext.InternalUsers
            .AsNoTracking()
            .Where(user =>
                user.DeletedAt == null
                && user.Status == InternalIdentityStatuses.Active
                && user.PersonnelNo == personnelNo.Trim())
            .Select(user => new InternalUserAccess(
                user.Id,
                user.PersonnelNo,
                user.CompleteName,
                user.Status))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<bool> HasAccessAsync(string personnelNo, CancellationToken cancellationToken = default)
    {
        return await FindActiveByPersonnelNoAsync(personnelNo, cancellationToken) is not null;
    }

    // Same union used by the SSO principal builder — the effective permission set for a personnel number.
    public async Task<IReadOnlyList<string>> GetEffectivePermissionsAsync(string personnelNo, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(personnelNo))
        {
            return [];
        }

        var trimmed = personnelNo.Trim();
        return await (
                from user in _dbContext.InternalUsers.AsNoTracking()
                join userRole in _dbContext.InternalUserRoles.AsNoTracking() on user.Id equals userRole.UserId
                join rolePermission in _dbContext.InternalRolePermissions.AsNoTracking() on userRole.RoleId equals rolePermission.RoleId
                join permission in _dbContext.Permissions.AsNoTracking() on rolePermission.PermissionId equals permission.Id
                where user.PersonnelNo == trimmed && user.DeletedAt == null
                orderby permission.Key
                select permission.Key)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task<SsoPersonnelMappingResult?> MapNrpAsync(
        string nrp,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(nrp))
        {
            return null;
        }

        var normalizedNrp = nrp.Trim();

        // NRP (SISWarrior) and PersonnelNo are the SAME value — "NRP" is simply the former name of
        // PersonnelNo. No mapping table is needed: resolve the internal user directly. (The 8-digit
        // numeric PersonnelNo may carry leading zeros, so it is matched as an exact string.)
        return await _dbContext.InternalUsers
            .AsNoTracking()
            .Where(user =>
                user.PersonnelNo == normalizedNrp
                && user.Status == InternalIdentityStatuses.Active
                && user.DeletedAt == null)
            .Select(user => new SsoPersonnelMappingResult(
                user.PersonnelNo,
                user.PersonnelNo,
                user.CompleteName))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
