using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Persistence.Identity;
using IntegratedProcurement.Platform.VendorIdentity.Application;
using Microsoft.AspNetCore.Identity;

namespace IntegratedProcurement.Platform.VendorIdentity.Infrastructure;

public sealed class SettingsVendorPasswordValidator : IPasswordValidator<VendorIdentityUser>
{
    private readonly IAdminConsoleConfigurationService _configurationService;

    public SettingsVendorPasswordValidator(IAdminConsoleConfigurationService configurationService)
    {
        _configurationService = configurationService;
    }

    public async Task<IdentityResult> ValidateAsync(
        UserManager<VendorIdentityUser> manager,
        VendorIdentityUser user,
        string? password)
    {
        var policy = await VendorPasswordPolicy.ResolveAsync(_configurationService, CancellationToken.None);
        var value = password ?? string.Empty;
        var errors = new List<IdentityError>();

        if (value.Length < policy.MinLength)
        {
            errors.Add(new IdentityError { Code = "PasswordTooShort", Description = $"Passwords must be at least {policy.MinLength} characters." });
        }

        if (policy.RequireDigit && !value.Any(char.IsDigit))
        {
            errors.Add(new IdentityError { Code = "PasswordRequiresDigit", Description = "Passwords must contain at least one digit ('0'-'9')." });
        }

        if (policy.RequireLowercase && !value.Any(char.IsLower))
        {
            errors.Add(new IdentityError { Code = "PasswordRequiresLower", Description = "Passwords must contain at least one lowercase letter ('a'-'z')." });
        }

        if (policy.RequireUppercase && !value.Any(char.IsUpper))
        {
            errors.Add(new IdentityError { Code = "PasswordRequiresUpper", Description = "Passwords must contain at least one uppercase letter ('A'-'Z')." });
        }

        if (policy.RequireNonAlphanumeric && value.All(char.IsLetterOrDigit))
        {
            errors.Add(new IdentityError { Code = "PasswordRequiresNonAlphanumeric", Description = "Passwords must contain at least one non-alphanumeric character." });
        }

        return errors.Count == 0 ? IdentityResult.Success : IdentityResult.Failed(errors.ToArray());
    }
}
