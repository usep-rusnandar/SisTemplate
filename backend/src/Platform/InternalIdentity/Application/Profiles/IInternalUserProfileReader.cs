namespace IntegratedProcurement.Platform.InternalIdentity.Application.Profiles;

public interface IInternalUserProfileReader
{
    Task<InternalUserProfile?> FindByPersonnelNoAsync(
        string personnelNo,
        CancellationToken cancellationToken = default);

    Task<InternalUserProfile?> FindByPersonnelNoOrEmailAsync(
        string identifier,
        CancellationToken cancellationToken = default);
}

public sealed record InternalUserProfile(
    string PersonnelNo,
    string Username,
    string FullName,
    string Email,
    string Status,
    IReadOnlyCollection<string> Roles,
    bool HasLocalPassword = false,
    bool MustChangePassword = false);
