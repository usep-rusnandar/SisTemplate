using IntegratedProcurement.BuildingBlocks.Infrastructure.Http;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.InternalIdentity.Application.Auth;
using IntegratedProcurement.Platform.InternalIdentity.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace IntegratedProcurement.Platform.InternalIdentity.Infrastructure.Auth;

public sealed class InternalLocalAuthService : IInternalLocalAuthService
{
    private const string ResetTokenPurpose = "IntegratedProcurement.InternalPasswordReset.v1";
    private static readonly TimeSpan ResetTokenLifetime = TimeSpan.FromHours(24);

    private readonly ProcurementDbContext _dbContext;
    private readonly IPasswordHasher<InternalUser> _passwordHasher;
    private readonly IAdminConsoleConfigurationService _configurationService;
    private readonly IAdminConsoleCommunicationService _communicationService;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IDataProtector _resetProtector;

    public InternalLocalAuthService(
        ProcurementDbContext dbContext,
        IPasswordHasher<InternalUser> passwordHasher,
        IAdminConsoleConfigurationService configurationService,
        IAdminConsoleCommunicationService communicationService,
        IEmailSender emailSender,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        IHttpContextAccessor httpContextAccessor,
        IDataProtectionProvider dataProtection)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _configurationService = configurationService;
        _communicationService = communicationService;
        _emailSender = emailSender;
        _configuration = configuration;
        _environment = environment;
        _httpContextAccessor = httpContextAccessor;
        _resetProtector = dataProtection.CreateProtector(ResetTokenPurpose);
    }

    public async Task<InternalLocalLoginResult> LoginAsync(
        string identifier,
        string password,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrEmpty(password))
        {
            return InternalLocalLoginResult.Failed(InternalLocalLoginStatus.InvalidCredentials);
        }

        var user = await FindUserAsync(identifier, cancellationToken);
        if (user is null)
        {
            return InternalLocalLoginResult.Failed(InternalLocalLoginStatus.InvalidCredentials);
        }

        if (!user.IsActive)
        {
            return InternalLocalLoginResult.Failed(InternalLocalLoginStatus.Inactive);
        }

        var lockout = await AccountLockoutPolicy.ResolveAsync(_configurationService, cancellationToken);
        if (lockout.Enabled && user.IsLockedOut)
        {
            return InternalLocalLoginResult.Failed(InternalLocalLoginStatus.LockedOut);
        }

        if (!user.HasLocalPassword)
        {
            return InternalLocalLoginResult.Failed(InternalLocalLoginStatus.InvalidCredentials);
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash!, password);
        if (verification == PasswordVerificationResult.Failed)
        {
            if (lockout.Enabled)
            {
                user.RegisterFailedAccess(lockout.MaxAttempts, lockout.Duration);
                await _dbContext.SaveChangesAsync(cancellationToken);
                if (user.IsLockedOut)
                {
                    return InternalLocalLoginResult.Failed(InternalLocalLoginStatus.LockedOut);
                }
            }

            return InternalLocalLoginResult.Failed(InternalLocalLoginStatus.InvalidCredentials);
        }

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.ReplacePasswordHash(_passwordHasher.HashPassword(user, password));
        }

        user.RegisterSuccessfulAccess();
        await _dbContext.SaveChangesAsync(cancellationToken);

        return InternalLocalLoginResult.Success(
            user.PersonnelNo,
            user.CompleteName,
            user.Email,
            user.MustChangePassword);
    }

    public async Task<bool> VerifyPasswordAsync(
        string personnelNo,
        string password,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(personnelNo) || string.IsNullOrEmpty(password))
        {
            return false;
        }

        var user = await _dbContext.InternalUsers
            .SingleOrDefaultAsync(
                item => item.PersonnelNo == personnelNo && item.DeletedAt == null,
                cancellationToken);
        if (user is null || !user.IsActive || !user.HasLocalPassword)
        {
            return false;
        }

        var lockout = await AccountLockoutPolicy.ResolveAsync(_configurationService, cancellationToken);
        if (lockout.Enabled && user.IsLockedOut)
        {
            return false;
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash!, password);
        if (verification == PasswordVerificationResult.Failed)
        {
            if (lockout.Enabled)
            {
                user.RegisterFailedAccess(lockout.MaxAttempts, lockout.Duration);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            return false;
        }

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.ReplacePasswordHash(_passwordHasher.HashPassword(user, password));
        }

        user.RegisterSuccessfulAccess();
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<InternalPasswordMutationResult> ChangePasswordAsync(
        string personnelNo,
        string currentPassword,
        string newPassword,
        CancellationToken cancellationToken)
    {
        var user = await _dbContext.InternalUsers
            .SingleOrDefaultAsync(
                item => item.PersonnelNo == personnelNo && item.DeletedAt == null,
                cancellationToken);
        if (user is null)
        {
            return InternalPasswordMutationResult.Fail("user_not_found", "User was not found.");
        }

        if (!user.HasLocalPassword)
        {
            return InternalPasswordMutationResult.Fail("password_not_set", "This account has no local password.");
        }

        if (string.IsNullOrEmpty(currentPassword)
            || _passwordHasher.VerifyHashedPassword(user, user.PasswordHash!, currentPassword)
                == PasswordVerificationResult.Failed)
        {
            return InternalPasswordMutationResult.Fail("invalid_current_password", "Current password is incorrect.");
        }

        var policy = await AccountPasswordPolicy.ResolveAsync(_configurationService, cancellationToken);
        var errors = policy.Validate(newPassword);
        if (errors.Count > 0)
        {
            return InternalPasswordMutationResult.Fail("password_policy", errors.ToArray());
        }

        user.SetLocalPassword(_passwordHasher.HashPassword(user, newPassword), mustChangePassword: false);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return InternalPasswordMutationResult.Ok();
    }

    public async Task<InternalPasswordMutationResult> SetPasswordAsync(
        string personnelNo,
        string newPassword,
        CancellationToken cancellationToken)
    {
        var user = await _dbContext.InternalUsers
            .SingleOrDefaultAsync(
                item => item.PersonnelNo == personnelNo && item.DeletedAt == null,
                cancellationToken);
        if (user is null)
        {
            return InternalPasswordMutationResult.Fail("user_not_found", "User was not found.");
        }

        var policy = await AccountPasswordPolicy.ResolveAsync(_configurationService, cancellationToken);
        var errors = policy.Validate(newPassword);
        if (errors.Count > 0)
        {
            return InternalPasswordMutationResult.Fail("password_policy", errors.ToArray());
        }

        user.SetLocalPassword(_passwordHasher.HashPassword(user, newPassword), mustChangePassword: true);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return InternalPasswordMutationResult.Ok();
    }

    public async Task<InternalPasswordResetRequestResult> RequestPasswordResetAsync(
        string identifier,
        CancellationToken cancellationToken)
    {
        var accepted = new InternalPasswordResetRequestResult("accepted", null);
        if (string.IsNullOrWhiteSpace(identifier))
        {
            return accepted;
        }

        var user = await FindUserAsync(identifier, cancellationToken);
        if (user is null || !user.IsActive || string.IsNullOrWhiteSpace(user.Email))
        {
            return accepted;
        }

        var token = ProtectResetToken(user);
        var resetUrl = FrontendPortalUrls.BuildQueryUrl(ResolveInternalPortalUrl(), user.Email, token);
        await EmailTemplateNotifier.TrySendAsync(
            "ET-25",
            user.Email,
            new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                ["name"] = user.CompleteName,
                ["resetUrl"] = resetUrl,
                ["expiryHours"] = "24",
                ["contact"] = FrontendPortalUrls.SupportContact(_configuration["VendorRegistration:SupportEmail"]),
            },
            _communicationService,
            _emailSender,
            "Users",
            cancellationToken,
            InternalIdentityEmailDefaults.For);

        return new InternalPasswordResetRequestResult(
            "accepted",
            _environment.IsDevelopment() ? token : null);
    }

    public async Task<InternalPasswordResetConfirmResult> ConfirmPasswordResetAsync(
        string identifier,
        string resetToken,
        string newPassword,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(resetToken))
        {
            return InternalPasswordResetConfirmResult.InvalidRequestResult();
        }

        var user = await FindUserAsync(identifier, cancellationToken);
        if (user is null || !user.IsActive)
        {
            return InternalPasswordResetConfirmResult.InvalidRequestResult();
        }

        if (!TryUnprotectResetToken(resetToken, user, out _))
        {
            return InternalPasswordResetConfirmResult.TokenInvalid();
        }

        var policy = await AccountPasswordPolicy.ResolveAsync(_configurationService, cancellationToken);
        var errors = policy.Validate(newPassword);
        if (errors.Count > 0)
        {
            return InternalPasswordResetConfirmResult.Failed(errors);
        }

        user.SetLocalPassword(_passwordHasher.HashPassword(user, newPassword), mustChangePassword: false);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return InternalPasswordResetConfirmResult.Success();
    }

    private string ResolveInternalPortalUrl() =>
        FrontendPortalUrls.FirstAbsolute(
            _configuration["Frontend:InternalUrl"],
            _configuration["SSO:ApplicationUrl"],
            RequestOrigin.Read(_httpContextAccessor.HttpContext?.Request));

    private Task<InternalUser?> FindUserAsync(string identifier, CancellationToken cancellationToken)
    {
        var key = NormalizeIdentifier(identifier);
        return _dbContext.InternalUsers.SingleOrDefaultAsync(
            item => item.DeletedAt == null
                    && (item.PersonnelNo == key || item.Email == key),
            cancellationToken);
    }

    private static string NormalizeIdentifier(string identifier)
    {
        var trimmed = identifier.Trim();
        return trimmed.Contains('@', StringComparison.Ordinal) ? trimmed.ToLowerInvariant() : trimmed;
    }

    private string ProtectResetToken(InternalUser user)
    {
        var issued = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var payload = $"{user.PersonnelNo}|{issued}|{user.SecurityStamp ?? string.Empty}";
        return _resetProtector.Protect(payload);
    }

    private bool TryUnprotectResetToken(string token, InternalUser user, out DateTimeOffset issuedAt)
    {
        issuedAt = default;
        try
        {
            var payload = _resetProtector.Unprotect(token);
            var parts = payload.Split('|', 3);
            if (parts.Length != 3
                || !string.Equals(parts[0], user.PersonnelNo, StringComparison.Ordinal)
                || !long.TryParse(parts[1], out var unix)
                || !string.Equals(parts[2], user.SecurityStamp ?? string.Empty, StringComparison.Ordinal))
            {
                return false;
            }

            issuedAt = DateTimeOffset.FromUnixTimeSeconds(unix);
            return DateTimeOffset.UtcNow - issuedAt <= ResetTokenLifetime;
        }
        catch (System.Security.Cryptography.CryptographicException)
        {
            return false;
        }
    }
}

internal static class InternalIdentityEmailDefaults
{
    public static (string Subject, string Body)? For(string templateId) => templateId switch
    {
        "ET-25" => ("Reset Password – Alamtri Geo Integrated Procurement",
            "Dear Sir/Madam, {name},\n\nWe have received a request to reset the password for your Alamtri Geo Integrated Procurement account. Please use the secure link below. This link is valid for {expiryHours} hours:\n\n{resetUrl}\n\nIf you did not request this password reset, please ignore this email — your account remains secure. Please do not share this link. If you need assistance, contact {contact}.\n\nThank you,\nAlamtri Geo Integrated Procurement — Notification System\n\n—\n\nYth. Bapak/Ibu, {name},\n\nKami menerima permintaan untuk mereset password akun Anda di Alamtri Geo Integrated Procurement. Silakan gunakan tautan aman berikut. Tautan ini berlaku selama {expiryHours} jam:\n\n{resetUrl}\n\nJika Anda tidak merasa meminta reset password, mohon abaikan email ini — akun Anda tetap aman. Mohon tidak membagikan tautan ini. Apabila membutuhkan bantuan, hubungi {contact}.\n\nTerima kasih,\nAlamtri Geo Integrated Procurement — Sistem Notifikasi"),
        _ => null,
    };
}
