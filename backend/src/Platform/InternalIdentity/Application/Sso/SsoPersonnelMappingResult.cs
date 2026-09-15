namespace SisTemplate.Platform.InternalIdentity.Application.Sso;

public sealed record SsoPersonnelMappingResult(
    string Nrp,
    string PersonnelNo,
    string DisplayName);
