using IntegratedProcurement.Modules.VendorOnboarding.Application.Contacts;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using IntegratedProcurement.Platform.Persistence.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Contacts;

public sealed class VendorContactService : IVendorContactService
{
    private readonly ProcurementDbContext _db;
    private readonly UserManager<VendorIdentityUser> _userManager;

    public VendorContactService(ProcurementDbContext db, UserManager<VendorIdentityUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<IReadOnlyList<VendorContactDto>> ListAsync(string? search, string? role, CancellationToken cancellationToken)
    {
        var query =
            from link in _db.VendorUsers.AsNoTracking()
            join vendor in _db.Vendors.AsNoTracking() on link.VendorId equals vendor.Id
            join identity in _db.Users.AsNoTracking() on link.IdentityUserId equals identity.Id
            where vendor.DeletedAt == null
            select new { link, vendor, identity };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(row =>
                row.vendor.Name.Contains(term)
                || row.vendor.Id.Contains(term)
                || row.identity.CompleteName.Contains(term)
                || (row.identity.Email != null && row.identity.Email.Contains(term))
                || (row.identity.PhoneNumber != null && row.identity.PhoneNumber.Contains(term))
                || (row.identity.Position != null && row.identity.Position.Contains(term)));
        }

        if (string.Equals(role, "pic", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(row => row.link.IsWorkspacePic);
        }
        else if (string.Equals(role, "backup", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(row => !row.link.IsWorkspacePic);
        }

        var rows = await query
            .OrderBy(row => row.vendor.Name)
            .ThenByDescending(row => row.link.IsWorkspacePic)
            .ThenBy(row => row.identity.CompleteName)
            .ToListAsync(cancellationToken);

        return rows.Select(row => ToDto(row.link, row.vendor.Name, row.identity)).ToArray();
    }

    public async Task<IReadOnlyList<VendorContactVendorOptionDto>> ListVendorsAsync(CancellationToken cancellationToken)
    {
        return await _db.Vendors.AsNoTracking()
            .Where(vendor => vendor.DeletedAt == null)
            .OrderBy(vendor => vendor.Name)
            .Select(vendor => new VendorContactVendorOptionDto(vendor.Id, vendor.Name, vendor.Status))
            .ToListAsync(cancellationToken);
    }

    public async Task<VendorContactMutationResult> CreateAsync(VendorContactWriteRequest request, CancellationToken cancellationToken)
    {
        var vendorId = (request.VendorId ?? "").Trim();
        var name = (request.Name ?? "").Trim().ToUpperInvariant();
        var email = NormalizeEmail(request.Email);
        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        var position = string.IsNullOrWhiteSpace(request.Position) ? null : request.Position.Trim();
        var status = NormalizeStatus(request.Status);

        if (string.IsNullOrWhiteSpace(vendorId) || string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email))
        {
            return VendorContactMutationResult.Fail("validation", "Vendor, name, and email are required.");
        }

        var vendorExists = await _db.Vendors.AsNoTracking()
            .AnyAsync(vendor => vendor.Id == vendorId && vendor.DeletedAt == null, cancellationToken);
        if (!vendorExists)
        {
            return VendorContactMutationResult.Fail("vendor_not_found", "That vendor was not found.");
        }

        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            return VendorContactMutationResult.Fail("email_taken", "That email is already used by another vendor contact.");
        }

        var identityId = await NewIdentityIdAsync(cancellationToken);
        var identity = new VendorIdentityUser
        {
            Id = identityId,
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            CompleteName = name,
            PhoneNumber = phone,
            Position = position,
            Status = status,
            IsActive = status == VendorUserStatuses.Active,
            HasLogin = false,
        };

        var createResult = await _userManager.CreateAsync(identity);
        if (!createResult.Succeeded)
        {
            return VendorContactMutationResult.Fail(
                "identity_create_failed",
                string.Join("; ", createResult.Errors.Select(error => error.Description)));
        }

        var roleResult = await _userManager.AddToRoleAsync(identity, VendorIdentityRoleNames.Vendor);
        if (!roleResult.Succeeded)
        {
            return VendorContactMutationResult.Fail(
                "role_assign_failed",
                string.Join("; ", roleResult.Errors.Select(error => error.Description)));
        }

        var vendorHasPic = await _db.VendorUsers
            .AnyAsync(link => link.VendorId == vendorId && link.IsWorkspacePic, cancellationToken);
        var makePic = request.IsWorkspacePic || !vendorHasPic;

        try
        {
            if (makePic)
            {
                await ClearWorkspacePicAsync(vendorId, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
            }

            var link = VendorUser.Create(identity.Id, vendorId, isWorkspacePic: makePic);
            _db.VendorUsers.Add(link);
            await _db.SaveChangesAsync(cancellationToken);
            if (makePic)
            {
                await SyncWorkspacePicToVendorAsync(vendorId, identity, cancellationToken);
            }
            return VendorContactMutationResult.Ok(await LoadDtoAsync(link.Id, cancellationToken));
        }
        catch
        {
            await _userManager.DeleteAsync(identity);
            throw;
        }
    }

    public async Task<VendorContactMutationResult> UpdateAsync(Guid contactId, VendorContactWriteRequest request, CancellationToken cancellationToken)
    {
        var link = await _db.VendorUsers.FirstOrDefaultAsync(item => item.Id == contactId, cancellationToken);
        if (link is null)
        {
            return VendorContactMutationResult.Fail("not_found", "That contact was not found.");
        }

        var identity = await _userManager.FindByIdAsync(link.IdentityUserId);
        if (identity is null)
        {
            return VendorContactMutationResult.Fail("not_found", "That contact was not found.");
        }

        var name = (request.Name ?? "").Trim().ToUpperInvariant();
        var email = NormalizeEmail(request.Email);
        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        var position = string.IsNullOrWhiteSpace(request.Position) ? null : request.Position.Trim();
        var status = NormalizeStatus(request.Status);

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email))
        {
            return VendorContactMutationResult.Fail("validation", "Name and email are required.");
        }

        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null && !string.Equals(existing.Id, identity.Id, StringComparison.OrdinalIgnoreCase))
        {
            return VendorContactMutationResult.Fail("email_taken", "That email is already used by another vendor contact.");
        }

        identity.CompleteName = name;
        identity.Email = email;
        identity.UserName = email;
        identity.NormalizedEmail = _userManager.NormalizeEmail(email);
        identity.NormalizedUserName = _userManager.NormalizeName(email);
        identity.PhoneNumber = phone;
        identity.Position = position;
        identity.Status = status;
        identity.IsActive = status == VendorUserStatuses.Active;

        var update = await _userManager.UpdateAsync(identity);
        if (!update.Succeeded)
        {
            return VendorContactMutationResult.Fail(
                "update_failed",
                string.Join("; ", update.Errors.Select(error => error.Description)));
        }

        if (request.IsWorkspacePic && !link.IsWorkspacePic)
        {
            await AssignWorkspacePicAsync(link, cancellationToken);
        }

        if (link.IsWorkspacePic)
        {
            await SyncWorkspacePicToVendorAsync(link.VendorId, identity, cancellationToken);
        }

        return VendorContactMutationResult.Ok(await LoadDtoAsync(link.Id, cancellationToken));
    }

    public async Task<VendorContactMutationResult> SetWorkspacePicAsync(Guid contactId, CancellationToken cancellationToken)
    {
        var link = await _db.VendorUsers.FirstOrDefaultAsync(item => item.Id == contactId, cancellationToken);
        if (link is null)
        {
            return VendorContactMutationResult.Fail("not_found", "That contact was not found.");
        }

        if (link.IsWorkspacePic)
        {
            return VendorContactMutationResult.Ok(await LoadDtoAsync(link.Id, cancellationToken));
        }

        await AssignWorkspacePicAsync(link, cancellationToken);
        var identity = await _userManager.FindByIdAsync(link.IdentityUserId);
        if (identity is not null)
        {
            await SyncWorkspacePicToVendorAsync(link.VendorId, identity, cancellationToken);
        }
        return VendorContactMutationResult.Ok(await LoadDtoAsync(link.Id, cancellationToken));
    }

    public async Task<VendorContactMutationResult> SetPasswordAsync(
        Guid contactId,
        string? newPassword,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(newPassword))
        {
            return VendorContactMutationResult.Fail("validation", "A new password is required.");
        }

        var link = await _db.VendorUsers.FirstOrDefaultAsync(item => item.Id == contactId, cancellationToken);
        if (link is null)
        {
            return VendorContactMutationResult.Fail("not_found", "That contact was not found.");
        }

        var identity = await _userManager.FindByIdAsync(link.IdentityUserId);
        if (identity is null)
        {
            return VendorContactMutationResult.Fail("not_found", "That contact was not found.");
        }

        IdentityResult result;
        if (await _userManager.HasPasswordAsync(identity))
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(identity);
            result = await _userManager.ResetPasswordAsync(identity, token, newPassword);
        }
        else
        {
            result = await _userManager.AddPasswordAsync(identity, newPassword);
        }

        if (!result.Succeeded)
        {
            return VendorContactMutationResult.Fail(
                "password_rejected",
                string.Join("; ", result.Errors.Select(error => error.Description)));
        }

        identity.HasLogin = true;
        await _userManager.UpdateAsync(identity);
        await _userManager.SetLockoutEndDateAsync(identity, null);
        await _userManager.ResetAccessFailedCountAsync(identity);

        return VendorContactMutationResult.Ok(await LoadDtoAsync(link.Id, cancellationToken));
    }

    public async Task<VendorContactMutationResult> DeleteAsync(Guid contactId, CancellationToken cancellationToken)
    {
        var link = await _db.VendorUsers.FirstOrDefaultAsync(item => item.Id == contactId, cancellationToken);
        if (link is null)
        {
            return VendorContactMutationResult.Fail("not_found", "That contact was not found.");
        }

        if (link.IsWorkspacePic)
        {
            return VendorContactMutationResult.Fail(
                "cannot_delete_pic",
                "Set another contact as PIC Vendor before deleting this person.");
        }

        var identity = await _userManager.FindByIdAsync(link.IdentityUserId);
        _db.VendorUsers.Remove(link);
        await _db.SaveChangesAsync(cancellationToken);

        if (identity is not null)
        {
            await _userManager.DeleteAsync(identity);
        }

        return VendorContactMutationResult.Ok(null);
    }

    private async Task AssignWorkspacePicAsync(VendorUser target, CancellationToken cancellationToken)
    {
        await ClearWorkspacePicAsync(target.VendorId, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        target.SetWorkspacePic(true);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task SyncWorkspacePicToVendorAsync(
        string vendorId,
        VendorIdentityUser identity,
        CancellationToken cancellationToken)
    {
        var vendor = await _db.Vendors.FirstOrDefaultAsync(
            item => item.Id == vendorId && item.DeletedAt == null,
            cancellationToken);
        if (vendor is null)
        {
            return;
        }

        vendor.ApplyWorkspacePicContact(identity.Position, identity.PhoneNumber);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task ClearWorkspacePicAsync(string vendorId, CancellationToken cancellationToken)
    {
        var current = await _db.VendorUsers
            .Where(link => link.VendorId == vendorId && link.IsWorkspacePic)
            .ToListAsync(cancellationToken);
        foreach (var link in current)
        {
            link.SetWorkspacePic(false);
        }
    }

    private async Task<VendorContactDto?> LoadDtoAsync(Guid contactId, CancellationToken cancellationToken)
    {
        var row = await (
            from link in _db.VendorUsers.AsNoTracking()
            join vendor in _db.Vendors.AsNoTracking() on link.VendorId equals vendor.Id
            join identity in _db.Users.AsNoTracking() on link.IdentityUserId equals identity.Id
            where link.Id == contactId
            select new { link, vendor.Name, identity }).FirstOrDefaultAsync(cancellationToken);

        return row is null ? null : ToDto(row.link, row.Name, row.identity);
    }

    private async Task<string> NewIdentityIdAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var id = Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();
            var taken = await _db.Users.AsNoTracking().AnyAsync(user => user.Id == id, cancellationToken);
            if (!taken)
            {
                return id;
            }
        }

        throw new InvalidOperationException("Could not allocate a unique vendor contact id.");
    }

    private static VendorContactDto ToDto(VendorUser link, string vendorName, VendorIdentityUser identity) =>
        new(
            link.Id,
            link.VendorId,
            vendorName,
            link.IdentityUserId,
            (identity.CompleteName ?? "").ToUpperInvariant(),
            identity.Email,
            identity.PhoneNumber,
            identity.Position,
            NormalizeStatus(identity.Status),
            identity.IsActive && string.Equals(identity.Status, VendorUserStatuses.Active, StringComparison.OrdinalIgnoreCase),
            identity.HasLogin,
            link.IsWorkspacePic);

    private static string NormalizeEmail(string? email) => (email ?? "").Trim().ToLowerInvariant();

    private static string NormalizeStatus(string? status) =>
        string.Equals(status, VendorUserStatuses.Active, StringComparison.OrdinalIgnoreCase)
            ? VendorUserStatuses.Active
            : VendorUserStatuses.Inactive;
}
