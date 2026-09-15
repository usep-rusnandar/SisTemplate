using System.Security.Claims;
using System.Text.Json;
using IntegratedProcurement.BuildingBlocks.Infrastructure.Http;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Identity;
using IntegratedProcurement.Platform.VendorIdentity.Application;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace IntegratedProcurement.Platform.VendorIdentity.Infrastructure;

public sealed class VendorAuthService : IVendorAuthService
{
    private readonly ProcurementDbContext _dbContext;
    private readonly UserManager<VendorIdentityUser> _userManager;
    private readonly SignInManager<VendorIdentityUser> _signInManager;
    private readonly IWebHostEnvironment _environment;
    private readonly IAdminConsoleConfigurationService _configurationService;
    private readonly IAdminConsoleCommunicationService _communicationService;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _configuration;
    private readonly IHttpContextAccessor _httpContextAccessor;

    private static readonly string[] CurrentAndNewPasswordRequiredErrors = ["Current and new password are required."];

    public VendorAuthService(
        ProcurementDbContext dbContext,
        UserManager<VendorIdentityUser> userManager,
        SignInManager<VendorIdentityUser> signInManager,
        IWebHostEnvironment environment,
        IAdminConsoleConfigurationService configurationService,
        IAdminConsoleCommunicationService communicationService,
        IEmailSender emailSender,
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _signInManager = signInManager;
        _environment = environment;
        _configurationService = configurationService;
        _communicationService = communicationService;
        _emailSender = emailSender;
        _configuration = configuration;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<VendorMeResult?> GetCurrentVendorAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        if (principal.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var identityUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(identityUserId))
        {
            return null;
        }

        var identityUser = await _userManager.FindByIdAsync(identityUserId);
        if (identityUser is null)
        {
            return null;
        }

        var vendorUser = await _dbContext.VendorUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.IdentityUserId == identityUserId, cancellationToken);

        if (vendorUser is null || !vendorUser.IsWorkspacePic)
        {
            return VendorMeResult.NotFound();
        }

        var vendor = await _dbContext.Vendors
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == vendorUser.VendorId, cancellationToken);

        var roles = await _userManager.GetRolesAsync(identityUser);

        return VendorMeResult.Success(new VendorMePayload(
            identityUser.Id,
            vendorUser.Id,
            vendorUser.VendorId,
            vendor?.Name ?? string.Empty,
            identityUser.CompleteName,
            identityUser.Email ?? string.Empty,
            roles.ToArray()));
    }

    public async Task<string?> GetCurrentVendorIdAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        if (principal.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var identityUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(identityUserId))
        {
            return null;
        }

        var vendorId = await _dbContext.VendorUsers
            .AsNoTracking()
            .Where(item => item.IdentityUserId == identityUserId && item.IsWorkspacePic)
            .Select(item => item.VendorId)
            .FirstOrDefaultAsync(cancellationToken);

        return vendorId;
    }

    public async Task<bool> VerifyCurrentPasswordAsync(ClaimsPrincipal principal, string password, CancellationToken cancellationToken)
    {
        if (principal.Identity?.IsAuthenticated != true || string.IsNullOrEmpty(password))
        {
            return false;
        }

        var identityUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(identityUserId))
        {
            return false;
        }

        var identityUser = await _userManager.FindByIdAsync(identityUserId);
        if (identityUser is null)
        {
            return false;
        }

        return await _userManager.CheckPasswordAsync(identityUser, password);
    }

    public async Task<VendorSignInResult> SignInAsync(string email, string password)
    {
        await ApplyLockoutOptionsAsync(CancellationToken.None);

        var normalizedEmail = NormalizeEmail(email);
        var identityUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (identityUser is null)
        {
            return VendorSignInResult.Failed;
        }

        if (!await IsWorkspacePicAsync(identityUser.Id))
        {
            return VendorSignInResult.NotWorkspacePic;
        }

        var lockout = await AccountLockoutPolicy.ResolveAsync(_configurationService, CancellationToken.None);
        var lockoutOnFailure = lockout.Enabled;

        if (await IsOtpRequiredAsync(CancellationToken.None))
        {
            var check = await _signInManager.CheckPasswordSignInAsync(identityUser, password, lockoutOnFailure);
            if (!check.Succeeded)
            {
                if (check.IsLockedOut)
                {
                    return VendorSignInResult.LockedOut;
                }

                if (check.IsNotAllowed)
                {
                    return VendorSignInResult.NotAllowed;
                }

                return VendorSignInResult.Failed;
            }

            var code = await _userManager.GenerateTwoFactorTokenAsync(identityUser, TokenOptions.DefaultEmailProvider);
            await EmailTemplateNotifier.TrySendAsync(
                "ET-02",
                identityUser.Email,
                new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["name"] = identityUser.CompleteName,
                    ["code"] = code,
                    ["expiryMinutes"] = "5",
                },
                _communicationService,
                _emailSender,
                "Vendor Workspace",
                CancellationToken.None,
                VendorIdentityEmailDefaults.For);
            return VendorSignInResult.OtpRequired;
        }

        var result = await _signInManager.PasswordSignInAsync(
            identityUser,
            password,
            isPersistent: false,
            lockoutOnFailure: lockoutOnFailure);

        if (result.Succeeded)
        {
            return VendorSignInResult.SignedIn;
        }

        if (result.IsLockedOut)
        {
            return VendorSignInResult.LockedOut;
        }

        if (result.IsNotAllowed)
        {
            return VendorSignInResult.NotAllowed;
        }

        return VendorSignInResult.Failed;
    }

    public async Task<bool> VerifyOtpAsync(string email, string code)
    {
        var identityUser = await _userManager.FindByEmailAsync(NormalizeEmail(email));
        if (identityUser is null || string.IsNullOrWhiteSpace(code) || !await IsWorkspacePicAsync(identityUser.Id))
        {
            return false;
        }

        var valid = await _userManager.VerifyTwoFactorTokenAsync(identityUser, TokenOptions.DefaultEmailProvider, code.Trim());
        if (!valid)
        {
            await ApplyLockoutOptionsAsync(CancellationToken.None);
            var lockout = await AccountLockoutPolicy.ResolveAsync(_configurationService, CancellationToken.None);
            if (lockout.Enabled)
            {
                await _userManager.AccessFailedAsync(identityUser);
            }
            return false;
        }

        await _userManager.ResetAccessFailedCountAsync(identityUser);
        await _signInManager.SignInAsync(identityUser, isPersistent: false);
        return true;
    }

    public async Task<VendorChangePasswordResult> ChangePasswordAsync(ClaimsPrincipal principal, string currentPassword, string newPassword, CancellationToken cancellationToken)
    {
        if (principal.Identity?.IsAuthenticated != true)
        {
            return VendorChangePasswordResult.Unauthorized();
        }

        var identityUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(identityUserId))
        {
            return VendorChangePasswordResult.Unauthorized();
        }

        var identityUser = await _userManager.FindByIdAsync(identityUserId);
        if (identityUser is null)
        {
            return VendorChangePasswordResult.Unauthorized();
        }

        if (string.IsNullOrEmpty(currentPassword) || string.IsNullOrEmpty(newPassword))
        {
            return VendorChangePasswordResult.Failed(CurrentAndNewPasswordRequiredErrors);
        }

        var result = await _userManager.ChangePasswordAsync(identityUser, currentPassword, newPassword);
        if (!result.Succeeded)
        {
            var invalidCurrent = result.Errors.Any(error => error.Code == "PasswordMismatch");
            return VendorChangePasswordResult.Failed(
                result.Errors.Select(error => error.Description).ToArray(),
                invalidCurrent);
        }

        await _signInManager.RefreshSignInAsync(identityUser);
        return VendorChangePasswordResult.Success();
    }

    private async Task ApplyLockoutOptionsAsync(CancellationToken cancellationToken)
    {
        var policy = await AccountLockoutPolicy.ResolveAsync(_configurationService, cancellationToken);
        var lockout = _userManager.Options.Lockout;
        lockout.AllowedForNewUsers = policy.Enabled;
        lockout.MaxFailedAccessAttempts = Math.Max(1, policy.MaxAttempts);
        lockout.DefaultLockoutTimeSpan = policy.Duration;
    }

    private async Task<bool> IsOtpRequiredAsync(CancellationToken cancellationToken)
    {
        try
        {
            var settings = (await _configurationService.GetSettingsAsync(cancellationToken)).Values;
            if (settings is not null && settings.TryGetValue("emailConfirm", out var element))
            {
                return element.ValueKind switch
                {
                    JsonValueKind.True => true,
                    JsonValueKind.String => bool.TryParse(element.GetString(), out var parsed) && parsed,
                    _ => false,
                };
            }
        }
        catch
        {
        }

        return false;
    }

    public Task SignOutAsync() => _signInManager.SignOutAsync();

    public async Task<VendorPasswordResetRequestResult> RequestPasswordResetAsync(string email)
    {
        var normalizedEmail = NormalizeEmail(email);
        var identityUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (identityUser is null || !await IsWorkspacePicAsync(identityUser.Id))
        {
            return new VendorPasswordResetRequestResult("accepted", null);
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(identityUser);
        var resetUrl = FrontendPortalUrls.BuildQueryUrl(
            ResolveVendorPortalUrl(),
            identityUser.Email ?? normalizedEmail,
            token);
        await EmailTemplateNotifier.TrySendAsync(
            "ET-20",
            identityUser.Email,
            new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                ["name"] = identityUser.CompleteName,
                ["resetUrl"] = resetUrl,
                ["expiryHours"] = "24",
                ["contact"] = FrontendPortalUrls.SupportContact(_configuration["VendorRegistration:SupportEmail"]),
            },
            _communicationService,
            _emailSender,
            "Vendor Workspace",
            CancellationToken.None,
            VendorIdentityEmailDefaults.For);

        return new VendorPasswordResetRequestResult(
            "accepted",
            _environment.IsDevelopment() ? token : null);
    }

    public async Task<VendorPasswordResetConfirmResult> ConfirmPasswordResetAsync(string email, string resetToken, string newPassword)
    {
        var normalizedEmail = NormalizeEmail(email);
        var identityUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (identityUser is null || !await IsWorkspacePicAsync(identityUser.Id))
        {
            return VendorPasswordResetConfirmResult.InvalidRequestResult();
        }

        var result = await _userManager.ResetPasswordAsync(identityUser, resetToken, newPassword);
        if (!result.Succeeded)
        {
            var invalidToken = result.Errors.Any(error => error.Code == "InvalidToken");
            return VendorPasswordResetConfirmResult.Failed(
                result.Errors.Select(error => error.Description).ToArray(),
                invalidToken);
        }

        if (!identityUser.HasLogin)
        {
            identityUser.HasLogin = true;
            await _userManager.UpdateAsync(identityUser);
        }

        return VendorPasswordResetConfirmResult.Success();
    }

    private string ResolveVendorPortalUrl() =>
        FrontendPortalUrls.FirstAbsolute(
            _configuration["Frontend:VendorUrl"],
            _configuration["VendorRegistration:RegistrationUrl"],
            RequestOrigin.Read(_httpContextAccessor.HttpContext?.Request));

    private Task<bool> IsWorkspacePicAsync(string identityUserId) =>
        _dbContext.VendorUsers.AsNoTracking()
            .AnyAsync(link => link.IdentityUserId == identityUserId && link.IsWorkspacePic);

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}

internal static class VendorIdentityEmailDefaults
{
    public static (string Subject, string Body)? For(string templateId) => templateId switch
    {
        "ET-02" => ("Your Alamtri Geo Vendor Workspace OTP code",
            "Dear {name},\n\nYour One-Time Password (OTP) for signing in to the Alamtri Geo Vendor Workspace is below. It expires in {expiryMinutes} minutes.\n\nOTP code: {code}\n\nPlease do not share this code with anyone for security reasons. If you did not request this OTP, please ignore this email or contact our Administrator immediately.\n\nThank you,\nAlamtri Geo Vendor Workspace — Notification System\n\n—\n\nYth. {name},\n\nBerikut adalah One-Time Password (OTP) untuk masuk ke Alamtri Geo Vendor Workspace. Kode ini berlaku selama {expiryMinutes} menit.\n\nKode OTP: {code}\n\nMohon tidak membagikan kode ini kepada siapa pun demi keamanan akun Anda. Apabila Anda tidak meminta OTP ini, mohon abaikan email ini atau hubungi Admin kami segera.\n\nTerima kasih,\nAlamtri Geo Vendor Workspace — Sistem Notifikasi"),
        "ET-20" => ("Reset Password – Alamtri Geo Vendor Workspace",
            "Dear Sir/Madam, {name},\n\nWe have received a request to reset the password for your Alamtri Geo Vendor Workspace account. Please use the secure link below. This link is valid for {expiryHours} hours:\n\n{resetUrl}\n\nIf you did not request this password reset, please ignore this email — your account remains secure. Please do not share this link. If you need assistance, contact {contact}.\n\nThank you,\nAlamtri Geo Vendor Workspace — Notification System\n\n—\n\nYth. Bapak/Ibu, {name},\n\nKami menerima permintaan untuk mereset password akun Anda di Alamtri Geo Vendor Workspace. Silakan gunakan tautan aman berikut. Tautan ini berlaku selama {expiryHours} jam:\n\n{resetUrl}\n\nJika Anda tidak merasa meminta reset password, mohon abaikan email ini — akun Anda tetap aman. Mohon tidak membagikan tautan ini. Apabila membutuhkan bantuan, hubungi {contact}.\n\nTerima kasih,\nAlamtri Geo Vendor Workspace — Sistem Notifikasi"),
        _ => null,
    };
}
