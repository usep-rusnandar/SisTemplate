using SisTemplate.Platform.InternalIdentity.Application.Profiles;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.InternalIdentity.Infrastructure.Profiles;

public sealed class InternalUserProfileReader : IInternalUserProfileReader
{
    private readonly ProcurementDbContext _dbContext;

    public InternalUserProfileReader(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<InternalUserProfile?> FindByPersonnelNoAsync(
        string personnelNo,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(personnelNo))
        {
            return null;
        }

        var normalizedPersonnelNo = personnelNo.Trim();
        var user = await _dbContext.InternalUsers
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.PersonnelNo == normalizedPersonnelNo && item.DeletedAt == null,
                cancellationToken);

        if (user is null)
        {
            return null;
        }

        var roles = await (
                from userRole in _dbContext.InternalUserRoles.AsNoTracking()
                join role in _dbContext.InternalRoles.AsNoTracking()
                    on userRole.RoleId equals role.Id
                where userRole.UserId == user.Id
                select role.Name)
            .Distinct()
            .OrderBy(roleName => roleName)
            .ToArrayAsync(cancellationToken);

        return new InternalUserProfile(
            user.PersonnelNo,
            ToUsername(user.Email, user.PersonnelNo),
            user.CompleteName,
            user.Email ?? string.Empty,
            user.Status,
            roles,
            user.HasLocalPassword,
            user.MustChangePassword);
    }

    public async Task<InternalUserProfile?> FindByPersonnelNoOrEmailAsync(
        string identifier,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(identifier))
        {
            return null;
        }

        var trimmed = identifier.Trim();
        var user = await _dbContext.InternalUsers
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.DeletedAt == null
                        && (item.PersonnelNo == trimmed || item.Email == trimmed),
                cancellationToken);

        if (user is null)
        {
            return null;
        }

        return await FindByPersonnelNoAsync(user.PersonnelNo, cancellationToken);
    }

    private static string ToUsername(string? email, string personnelNo)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return personnelNo;
        }

        var atIndex = email.IndexOf('@', StringComparison.Ordinal);
        return atIndex > 0 ? email[..atIndex] : email;
    }
}
