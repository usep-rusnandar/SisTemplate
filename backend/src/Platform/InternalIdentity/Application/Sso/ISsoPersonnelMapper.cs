namespace SisTemplate.Platform.InternalIdentity.Application.Sso;

public interface ISsoPersonnelMapper
{
    Task<SsoPersonnelMappingResult?> MapNrpAsync(string nrp, CancellationToken cancellationToken = default);
}
