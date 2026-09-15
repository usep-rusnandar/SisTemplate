using IntegratedProcurement.Platform.InternalIdentity.Application.Directory;
using IntegratedProcurement.Platform.InternalIdentity.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Platform.InternalIdentity.Infrastructure.Directory;

public sealed class InternalDirectoryReadPort : IInternalDirectoryReadPort
{
    private readonly ProcurementDbContext _dbContext;

    public InternalDirectoryReadPort(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<InternalDirectoryPerson?> FindByPersonnelNoAsync(
        string personnelNo,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(personnelNo))
        {
            return null;
        }

        var normalized = personnelNo.Trim();
        var user = await _dbContext.InternalUsers
            .AsNoTracking()
            .Where(item => item.PersonnelNo == normalized && item.DeletedAt == null)
            .Select(item => new { item.Id, item.PersonnelNo, item.CompleteName, item.Email, item.ManagerUserId })
            .FirstOrDefaultAsync(cancellationToken);
        if (user is null)
        {
            return null;
        }

        var roles = await LoadRolesAsync([user.Id], cancellationToken);
        var (names, codes) = roles.GetValueOrDefault(user.Id, EmptyRoles);
        return new InternalDirectoryPerson(
            user.Id,
            user.PersonnelNo,
            user.CompleteName,
            user.Email,
            user.ManagerUserId,
            names,
            codes);
    }

    public async Task<IReadOnlyList<InternalDirectoryPerson>> ListActiveWithAnyRoleNameAsync(
        IReadOnlyCollection<string> roleNames,
        CancellationToken cancellationToken = default)
    {
        var names = roleNames.Where(name => !string.IsNullOrWhiteSpace(name)).Distinct().ToArray();
        if (names.Length == 0)
        {
            return [];
        }

        var matchingIds = await (
                from user in _dbContext.InternalUsers.AsNoTracking()
                join userRole in _dbContext.InternalUserRoles.AsNoTracking() on user.Id equals userRole.UserId
                join role in _dbContext.InternalRoles.AsNoTracking() on userRole.RoleId equals role.Id
                where user.DeletedAt == null
                      && user.Status == InternalIdentityStatuses.Active
                      && names.Contains(role.Name)
                select user.Id)
            .Distinct()
            .ToArrayAsync(cancellationToken);
        if (matchingIds.Length == 0)
        {
            return [];
        }

        var users = await _dbContext.InternalUsers
            .AsNoTracking()
            .Where(user => matchingIds.Contains(user.Id))
            .Select(user => new { user.Id, user.PersonnelNo, user.CompleteName, user.Email, user.ManagerUserId })
            .ToArrayAsync(cancellationToken);
        var roles = await LoadRolesAsync(matchingIds, cancellationToken);

        return users
            .Select(user =>
            {
                var (names, codes) = roles.GetValueOrDefault(user.Id, EmptyRoles);
                return new InternalDirectoryPerson(
                    user.Id,
                    user.PersonnelNo,
                    user.CompleteName,
                    user.Email,
                    user.ManagerUserId,
                    names,
                    codes);
            })
            .ToArray();
    }

    public async Task<IReadOnlyList<InternalDirectoryRecipient>> ListActiveRecipientsByRoleCodeAsync(
        string roleCode,
        CancellationToken cancellationToken = default)
    {
        var rows = await (
                from internalUser in _dbContext.InternalUsers.AsNoTracking()
                join userRole in _dbContext.InternalUserRoles.AsNoTracking() on internalUser.Id equals userRole.UserId
                join role in _dbContext.InternalRoles.AsNoTracking() on userRole.RoleId equals role.Id
                where internalUser.Status == InternalIdentityStatuses.Active
                      && internalUser.DeletedAt == null
                      && internalUser.Email != null
                      && role.Code == roleCode
                select new { internalUser.CompleteName, Email = internalUser.Email! })
            .Distinct()
            .ToArrayAsync(cancellationToken);

        return rows
            .Select(row => new InternalDirectoryRecipient(row.CompleteName, row.Email))
            .ToArray();
    }

    public async Task<IReadOnlyList<string>> GetRoleCodesForActorAsync(
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var actorGuid = Guid.TryParse(actorId, out var parsed) ? parsed : (Guid?)null;
        return await (
                from user in _dbContext.InternalUsers.AsNoTracking()
                join userRole in _dbContext.InternalUserRoles.AsNoTracking() on user.Id equals userRole.UserId
                join role in _dbContext.InternalRoles.AsNoTracking() on userRole.RoleId equals role.Id
                where (user.PersonnelNo == actorId || (actorGuid.HasValue && user.Id == actorGuid.Value))
                      && user.DeletedAt == null
                orderby role.Code
                select role.Code)
            .Distinct()
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<string, string>> GetRoleNamesByCodeAsync(
        CancellationToken cancellationToken = default) =>
        await _dbContext.InternalRoles.AsNoTracking()
            .ToDictionaryAsync(role => role.Code, role => role.Name, StringComparer.OrdinalIgnoreCase, cancellationToken);

    public async Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesAsync(
        IReadOnlyCollection<string?> keys,
        CancellationToken cancellationToken = default)
    {
        var names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var normalized = keys
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Select(key => key!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (normalized.Length == 0)
        {
            return names;
        }

        var guidKeys = normalized
            .Select(key => Guid.TryParse(key, out var parsed) ? parsed : (Guid?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .ToArray();

        var internals = await _dbContext.InternalUsers.AsNoTracking()
            .Where(user => user.DeletedAt == null
                           && (normalized.Contains(user.PersonnelNo) || guidKeys.Contains(user.Id)))
            .Select(user => new { user.Id, user.PersonnelNo, user.CompleteName })
            .ToArrayAsync(cancellationToken);

        foreach (var user in internals)
        {
            names[user.PersonnelNo] = user.CompleteName;
            names[user.Id.ToString()] = user.CompleteName;
        }

        return names;
    }

    private async Task<Dictionary<Guid, (string[] Names, string[] Codes)>> LoadRolesAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken)
    {
        var rows = await (
                from userRole in _dbContext.InternalUserRoles.AsNoTracking()
                join role in _dbContext.InternalRoles.AsNoTracking() on userRole.RoleId equals role.Id
                where userIds.Contains(userRole.UserId)
                select new { userRole.UserId, role.Name, role.Code })
            .ToArrayAsync(cancellationToken);

        return rows
            .GroupBy(row => row.UserId)
            .ToDictionary(
                group => group.Key,
                group => (
                    group.Select(row => row.Name).Distinct(StringComparer.OrdinalIgnoreCase).ToArray(),
                    group.Select(row => row.Code).Distinct(StringComparer.OrdinalIgnoreCase).ToArray()));
    }

    private static readonly (string[] Names, string[] Codes) EmptyRoles = ([], []);
}
