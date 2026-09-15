namespace IntegratedProcurement.Platform.InternalIdentity.Infrastructure.Sso;

public sealed record DecodedSsoJwt(
    string RawToken,
    string Nrp,
    string DisplayName,
    DateTimeOffset ExpiresAt);
