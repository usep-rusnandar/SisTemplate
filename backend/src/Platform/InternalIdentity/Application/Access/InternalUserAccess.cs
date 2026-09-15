namespace SisTemplate.Platform.InternalIdentity.Application.Access;

public sealed record InternalUserAccess(
    Guid UserId,
    string PersonnelNo,
    string DisplayName,
    string Status);
