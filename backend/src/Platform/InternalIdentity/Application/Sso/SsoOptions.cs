namespace SisTemplate.Platform.InternalIdentity.Application.Sso;

public sealed class SsoOptions
{
    public const string SectionName = "SSO";

    public bool Enabled { get; init; }

    public string SsoUrl { get; init; } = string.Empty;

    /// <summary>
    /// SISWarrior portal landing page. When SSO is enabled the app hides Logout and offers a
    /// "Back to SIS Warrior" action (top-bar menu + lock screen) that navigates here. Environment
    /// specific (Production vs Staging portal path); empty when SSO is off.
    /// </summary>
    public string HomeUrl { get; init; } = string.Empty;

    public string ApplicationUrl { get; init; } = string.Empty;

    /// <summary>
    /// Extra callback origins PIC Auth registered for this environment (module portals).
    /// <see cref="ApplicationUrl"/> is always allowed as well.
    /// </summary>
    public string[] AllowedApplicationUrls { get; init; } = [];

    public string Application { get; init; } = string.Empty;

    public TimeSpan SessionIdleTimeout { get; init; } = TimeSpan.FromHours(8);
}
