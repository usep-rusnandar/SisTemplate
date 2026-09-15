namespace IntegratedProcurement.Platform.InternalIdentity.Application.Auth;

public interface IInternalLocalAuthService
{
    Task<InternalLocalLoginResult> LoginAsync(string identifier, string password, CancellationToken cancellationToken);

    Task<bool> VerifyPasswordAsync(string personnelNo, string password, CancellationToken cancellationToken);

    Task<InternalPasswordMutationResult> ChangePasswordAsync(
        string personnelNo,
        string currentPassword,
        string newPassword,
        CancellationToken cancellationToken);

    Task<InternalPasswordMutationResult> SetPasswordAsync(
        string personnelNo,
        string newPassword,
        CancellationToken cancellationToken);

    Task<InternalPasswordResetRequestResult> RequestPasswordResetAsync(
        string identifier,
        CancellationToken cancellationToken);

    Task<InternalPasswordResetConfirmResult> ConfirmPasswordResetAsync(
        string identifier,
        string resetToken,
        string newPassword,
        CancellationToken cancellationToken);
}

public enum InternalLocalLoginStatus
{
    Succeeded,
    InvalidCredentials,
    Inactive,
    LockedOut,
}

public sealed record InternalLocalLoginResult(
    InternalLocalLoginStatus Status,
    string? PersonnelNo,
    string? DisplayName,
    string? Email,
    bool MustChangePassword)
{
    public static InternalLocalLoginResult Failed(InternalLocalLoginStatus status) =>
        new(status, null, null, null, false);

    public static InternalLocalLoginResult Success(
        string personnelNo,
        string displayName,
        string? email,
        bool mustChangePassword) =>
        new(InternalLocalLoginStatus.Succeeded, personnelNo, displayName, email, mustChangePassword);
}

public sealed record InternalPasswordMutationResult(
    bool Succeeded,
    string? ErrorCode,
    IReadOnlyList<string> Errors)
{
    public static InternalPasswordMutationResult Ok() => new(true, null, []);

    public static InternalPasswordMutationResult Fail(string errorCode, params string[] errors) =>
        new(false, errorCode, errors);
}

public sealed record InternalPasswordResetRequestResult(string Status, string? ResetToken);

public sealed record InternalPasswordResetConfirmResult(
    bool Succeeded,
    bool InvalidRequest,
    bool InvalidToken,
    IReadOnlyList<string> Errors)
{
    public static InternalPasswordResetConfirmResult Success() => new(true, false, false, []);

    public static InternalPasswordResetConfirmResult InvalidRequestResult() => new(false, true, false, []);

    public static InternalPasswordResetConfirmResult TokenInvalid() => new(false, false, true, []);

    public static InternalPasswordResetConfirmResult Failed(IReadOnlyList<string> errors) =>
        new(false, false, false, errors);
}
