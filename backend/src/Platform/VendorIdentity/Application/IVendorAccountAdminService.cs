namespace IntegratedProcurement.Platform.VendorIdentity.Application;

public interface IVendorAccountAdminService
{
    Task<IReadOnlyList<VendorAccountView>> ListAccountsAsync(string vendorId, CancellationToken cancellationToken);

    Task<VendorUnlockAccountsResult> UnlockAccountsAsync(string vendorId, CancellationToken cancellationToken);

    Task<VendorActivationLinkResult> SendActivationLinkAsync(string vendorId, CancellationToken cancellationToken);
}

public sealed record VendorAccountView(
    string IdentityUserId,
    string? Email,
    string CompleteName,
    string Status,
    bool IsActive,
    bool HasLogin,
    bool IsWorkspacePic,
    bool IsLockedOut,
    DateTimeOffset? LockoutEnd,
    int AccessFailedCount);

public sealed record VendorUnlockAccountsResult(bool Found, int Unlocked, IReadOnlyList<VendorAccountView> Accounts);

public sealed record VendorActivationLinkResult(bool Found, string? Email, string? Status, string? ResetToken);
