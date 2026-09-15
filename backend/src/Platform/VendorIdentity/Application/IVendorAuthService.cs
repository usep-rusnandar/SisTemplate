using System.Security.Claims;

namespace IntegratedProcurement.Platform.VendorIdentity.Application;

public interface IVendorAuthService
{
    Task<VendorMeResult?> GetCurrentVendorAsync(ClaimsPrincipal principal, CancellationToken cancellationToken);

    Task<string?> GetCurrentVendorIdAsync(ClaimsPrincipal principal, CancellationToken cancellationToken);

    Task<VendorSignInResult> SignInAsync(string email, string password);

    Task<bool> VerifyCurrentPasswordAsync(ClaimsPrincipal principal, string password, CancellationToken cancellationToken);

    Task<bool> VerifyOtpAsync(string email, string code);

    Task<VendorChangePasswordResult> ChangePasswordAsync(ClaimsPrincipal principal, string currentPassword, string newPassword, CancellationToken cancellationToken);

    Task SignOutAsync();

    Task<VendorPasswordResetRequestResult> RequestPasswordResetAsync(string email);

    Task<VendorPasswordResetConfirmResult> ConfirmPasswordResetAsync(string email, string resetToken, string newPassword);
}

public enum VendorSignInResult
{
    Failed,
    SignedIn,
    OtpRequired,
    LockedOut,
    NotAllowed,
    NotWorkspacePic,
}

public sealed record VendorMePayload(
    string IdentityUserId,
    Guid VendorUserId,
    string VendorId,
    string VendorName,
    string Name,
    string Email,
    IReadOnlyCollection<string> Roles);

public sealed record VendorMeResult(bool IsAuthenticated, bool IsNotFound, VendorMePayload? Payload)
{
    public static VendorMeResult Success(VendorMePayload payload) => new(true, false, payload);

    public static VendorMeResult NotFound() => new(true, true, null);
}

public sealed record VendorChangePasswordResult(bool Succeeded, bool IsUnauthorized, bool InvalidCurrentPassword, IReadOnlyCollection<string>? Errors)
{
    public static VendorChangePasswordResult Success() => new(true, false, false, null);

    public static VendorChangePasswordResult Unauthorized() => new(false, true, false, null);

    public static VendorChangePasswordResult Failed(IReadOnlyCollection<string> errors, bool invalidCurrentPassword = false) =>
        new(false, false, invalidCurrentPassword, errors);
}

public sealed record VendorPasswordResetRequestResult(string Status, string? ResetToken);

public sealed record VendorPasswordResetConfirmResult(bool Succeeded, bool InvalidRequest, bool InvalidToken, IReadOnlyCollection<string>? Errors)
{
    public static VendorPasswordResetConfirmResult Success() => new(true, false, false, null);

    public static VendorPasswordResetConfirmResult InvalidRequestResult() => new(false, true, false, null);

    public static VendorPasswordResetConfirmResult Failed(IReadOnlyCollection<string> errors, bool invalidToken = false) =>
        new(false, false, invalidToken, errors);
}
