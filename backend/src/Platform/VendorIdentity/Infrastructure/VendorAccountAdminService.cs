using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Identity;
using IntegratedProcurement.Platform.VendorIdentity.Application;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Platform.VendorIdentity.Infrastructure;

public sealed class VendorAccountAdminService : IVendorAccountAdminService
{
    private readonly ProcurementDbContext _db;
    private readonly UserManager<VendorIdentityUser> _userManager;
    private readonly IVendorAuthService _vendorAuth;

    public VendorAccountAdminService(
        ProcurementDbContext db,
        UserManager<VendorIdentityUser> userManager,
        IVendorAuthService vendorAuth)
    {
        _db = db;
        _userManager = userManager;
        _vendorAuth = vendorAuth;
    }

    public Task<IReadOnlyList<VendorAccountView>> ListAccountsAsync(
        string vendorId,
        CancellationToken cancellationToken) =>
        LoadAccountsAsync(vendorId, cancellationToken);

    public async Task<VendorUnlockAccountsResult> UnlockAccountsAsync(
        string vendorId,
        CancellationToken cancellationToken)
    {
        var identityUserIds = await _db.VendorUsers
            .AsNoTracking()
            .Where(link => link.VendorId == vendorId)
            .OrderByDescending(link => link.IsWorkspacePic)
            .Select(link => link.IdentityUserId)
            .ToListAsync(cancellationToken);
        if (identityUserIds.Count == 0)
        {
            return new VendorUnlockAccountsResult(false, 0, []);
        }

        var unlocked = 0;
        foreach (var id in identityUserIds)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user is null)
            {
                continue;
            }

            await _userManager.SetLockoutEndDateAsync(user, null);
            await _userManager.ResetAccessFailedCountAsync(user);
            unlocked++;
        }

        var accounts = await LoadAccountsAsync(vendorId, cancellationToken);
        return new VendorUnlockAccountsResult(true, unlocked, accounts);
    }

    public async Task<VendorActivationLinkResult> SendActivationLinkAsync(
        string vendorId,
        CancellationToken cancellationToken)
    {
        var email = await (
                from link in _db.VendorUsers.AsNoTracking()
                join account in _db.Users.AsNoTracking() on link.IdentityUserId equals account.Id
                where link.VendorId == vendorId
                orderby link.IsWorkspacePic descending, account.Id
                select account.Email)
            .FirstOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(email))
        {
            return new VendorActivationLinkResult(false, null, null, null);
        }

        var result = await _vendorAuth.RequestPasswordResetAsync(email);
        return new VendorActivationLinkResult(true, email, result.Status, result.ResetToken);
    }

    private async Task<IReadOnlyList<VendorAccountView>> LoadAccountsAsync(
        string vendorId,
        CancellationToken cancellationToken)
    {
        var links = await _db.VendorUsers
            .AsNoTracking()
            .Where(link => link.VendorId == vendorId)
            .OrderByDescending(link => link.IsWorkspacePic)
            .ThenBy(link => link.IdentityUserId)
            .Select(link => new { link.IdentityUserId, link.IsWorkspacePic })
            .ToListAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var accounts = new List<VendorAccountView>(links.Count);
        foreach (var link in links)
        {
            var user = await _userManager.FindByIdAsync(link.IdentityUserId);
            if (user is null)
            {
                continue;
            }

            var lockoutEnd = await _userManager.GetLockoutEndDateAsync(user);
            var isLockedOut = lockoutEnd.HasValue && lockoutEnd.Value > now;
            accounts.Add(new VendorAccountView(
                user.Id,
                user.Email,
                user.CompleteName,
                user.Status,
                user.IsActive,
                user.HasLogin,
                link.IsWorkspacePic,
                isLockedOut,
                isLockedOut ? lockoutEnd : null,
                await _userManager.GetAccessFailedCountAsync(user)));
        }

        return accounts;
    }
}
