namespace SisTemplate.Platform.InternalIdentity.Application.Directory;

/// <summary>
/// Producer-published directory of internal users and roles. Other modules read IAM through this
/// port instead of querying <c>iam.*</c> tables.
/// </summary>
public interface IInternalDirectoryReadPort
{
    Task<InternalDirectoryPerson?> FindByPersonnelNoAsync(
        string personnelNo,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InternalDirectoryPerson>> ListActiveWithAnyRoleNameAsync(
        IReadOnlyCollection<string> roleNames,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InternalDirectoryRecipient>> ListActiveRecipientsByRoleCodeAsync(
        string roleCode,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> GetRoleCodesForActorAsync(
        string actorId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, string>> GetRoleNamesByCodeAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesAsync(
        IReadOnlyCollection<string?> keys,
        CancellationToken cancellationToken = default);
}

public sealed record InternalDirectoryPerson(
    Guid UserId,
    string PersonnelNo,
    string CompleteName,
    string? Email,
    Guid? ManagerUserId,
    IReadOnlyCollection<string> RoleNames,
    IReadOnlyCollection<string> RoleCodes);

public sealed record InternalDirectoryRecipient(string CompleteName, string Email);
