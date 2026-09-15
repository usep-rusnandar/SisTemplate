namespace SisTemplate.Platform.InternalIdentity.Infrastructure.Sso;

public interface ISsoJwtHelper
{
    bool TryDecode(string rawToken, out DecodedSsoJwt? jwt, out string? failureReason);

    bool IsExpired(DecodedSsoJwt jwt);
}
