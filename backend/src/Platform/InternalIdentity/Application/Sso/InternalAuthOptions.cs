namespace SisTemplate.Platform.InternalIdentity.Application.Sso;

/// <summary>
/// Local (non-SSO) internal authentication switches. Passwordless <c>dev-login</c> is never
/// a Production fallback — it requires both Development and this flag.
/// </summary>
public sealed class InternalAuthOptions
{
    public const string SectionName = "Auth";

    public bool AllowPasswordlessDevLogin { get; init; }
}
