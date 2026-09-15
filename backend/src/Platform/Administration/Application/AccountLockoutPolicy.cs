namespace IntegratedProcurement.Platform.Administration.Application;

/// <summary>
/// Failed-sign-in lockout policy from Super Admin ▸ Settings ▸ Security.
/// <c>lockDuration</c> is stored in seconds (UI label).
/// </summary>
public sealed record AccountLockoutPolicy(bool Enabled, int MaxAttempts, int DurationSeconds)
{
    public static readonly AccountLockoutPolicy Default = new(true, 5, 2000);

    public TimeSpan Duration => TimeSpan.FromSeconds(Math.Max(1, DurationSeconds));

    public static async Task<AccountLockoutPolicy> ResolveAsync(
        IAdminConsoleConfigurationService configurationService,
        CancellationToken cancellationToken)
    {
        try
        {
            var values = (await configurationService.GetSettingsAsync(cancellationToken)).Values;
            if (values is null)
            {
                return Default;
            }

            return new AccountLockoutPolicy(
                SettingsValueReader.GetBool(values, "lockEnabled", Default.Enabled),
                Math.Max(1, SettingsValueReader.GetInt(values, "maxAttempts", Default.MaxAttempts)),
                Math.Max(1, SettingsValueReader.GetInt(values, "lockDuration", Default.DurationSeconds)));
        }
        catch
        {
            return Default;
        }
    }
}
