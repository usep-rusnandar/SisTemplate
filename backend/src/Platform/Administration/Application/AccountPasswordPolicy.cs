namespace IntegratedProcurement.Platform.Administration.Application;

/// <summary>
/// Password-complexity policy from Super Admin ▸ Settings ▸ Security.
/// Applies to Vendor Workspace accounts and internal local passwords.
/// When "Use default settings" (<c>pwdDefault</c>) is on, <see cref="Default"/> applies.
/// </summary>
public sealed record AccountPasswordPolicy(
    int MinLength,
    bool RequireDigit,
    bool RequireLowercase,
    bool RequireUppercase,
    bool RequireNonAlphanumeric)
{
    public static readonly AccountPasswordPolicy Default = new(12, true, true, true, true);

    public static async Task<AccountPasswordPolicy> ResolveAsync(
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

            if (SettingsValueReader.GetBool(values, "pwdDefault", true))
            {
                return Default;
            }

            var minLength = Math.Max(1, SettingsValueReader.GetInt(values, "pwdLen", Default.MinLength));
            return new AccountPasswordPolicy(
                minLength,
                SettingsValueReader.GetBool(values, "reqDigit", true),
                SettingsValueReader.GetBool(values, "reqLower", true),
                SettingsValueReader.GetBool(values, "reqUpper", true),
                SettingsValueReader.GetBool(values, "reqNonAlpha", true));
        }
        catch
        {
            return Default;
        }
    }

    public IReadOnlyList<string> Validate(string? password)
    {
        var value = password ?? string.Empty;
        var errors = new List<string>();

        if (value.Length < MinLength)
        {
            errors.Add($"Passwords must be at least {MinLength} characters.");
        }

        if (RequireDigit && !value.Any(char.IsDigit))
        {
            errors.Add("Passwords must contain at least one digit ('0'-'9').");
        }

        if (RequireLowercase && !value.Any(char.IsLower))
        {
            errors.Add("Passwords must contain at least one lowercase letter ('a'-'z').");
        }

        if (RequireUppercase && !value.Any(char.IsUpper))
        {
            errors.Add("Passwords must contain at least one uppercase letter ('A'-'Z').");
        }

        if (RequireNonAlphanumeric && value.All(char.IsLetterOrDigit))
        {
            errors.Add("Passwords must contain at least one non-alphanumeric character.");
        }

        return errors;
    }
}
