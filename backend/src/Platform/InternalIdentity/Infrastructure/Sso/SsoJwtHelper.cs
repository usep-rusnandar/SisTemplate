using System.IdentityModel.Tokens.Jwt;
using SisTemplate.BuildingBlocks.Application.Abstractions;

namespace SisTemplate.Platform.InternalIdentity.Infrastructure.Sso;

public sealed class SsoJwtHelper : ISsoJwtHelper
{
    private static readonly string[] NrpClaimNames = ["NRP", "nrp", "Nrp"];
    private static readonly string[] DisplayNameClaimNames =
    [
        "Display Name",
        "DisplayName",
        "display_name",
        "name",
        JwtRegisteredClaimNames.Name
    ];

    private readonly IClock _clock;
    private readonly JwtSecurityTokenHandler _handler = new();

    public SsoJwtHelper(IClock clock)
    {
        _clock = clock;
    }

    public bool TryDecode(string rawToken, out DecodedSsoJwt? jwt, out string? failureReason)
    {
        jwt = null;
        failureReason = null;

        if (string.IsNullOrWhiteSpace(rawToken))
        {
            failureReason = "SSO token is empty.";
            return false;
        }

        if (!_handler.CanReadToken(rawToken))
        {
            failureReason = "SSO token cannot be read as JWT.";
            return false;
        }

        JwtSecurityToken token;
        try
        {
            token = _handler.ReadJwtToken(rawToken);
        }
        catch (ArgumentException ex)
        {
            failureReason = ex.Message;
            return false;
        }

        var nrp = GetFirstClaimValue(token, NrpClaimNames);
        if (string.IsNullOrWhiteSpace(nrp))
        {
            failureReason = "SSO token does not contain NRP claim.";
            return false;
        }

        var expiresAt = ResolveExpiry(token);
        if (!expiresAt.HasValue)
        {
            failureReason = "SSO token does not contain expiry claim.";
            return false;
        }

        var displayName = GetFirstClaimValue(token, DisplayNameClaimNames) ?? nrp;
        jwt = new DecodedSsoJwt(rawToken, nrp, displayName, expiresAt.Value);
        return true;
    }

    public bool IsExpired(DecodedSsoJwt jwt)
    {
        return jwt.ExpiresAt <= _clock.UtcNow;
    }

    private static string? GetFirstClaimValue(JwtSecurityToken token, string[] claimNames)
    {
        return token.Claims
            .FirstOrDefault(claim => claimNames.Contains(claim.Type, StringComparer.OrdinalIgnoreCase))
            ?.Value;
    }

    private static DateTimeOffset? ResolveExpiry(JwtSecurityToken token)
    {
        var expClaim = token.Claims.FirstOrDefault(claim => claim.Type == JwtRegisteredClaimNames.Exp);
        if (expClaim is not null && long.TryParse(expClaim.Value, out var exp))
        {
            return DateTimeOffset.FromUnixTimeSeconds(exp);
        }

        return token.ValidTo == DateTime.MinValue
            ? null
            : new DateTimeOffset(DateTime.SpecifyKind(token.ValidTo, DateTimeKind.Utc));
    }
}
