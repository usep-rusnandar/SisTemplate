using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Platform.InternalIdentity.Application.Directory;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>
/// Looks actor keys up in three passes — internal personnel, vendor portal account, then a vendor id
/// with no account of its own. A vendor's primary account carries the vendor id AS its user id, so the
/// second pass already names most vendor-side rows and the third is only for imported vendors.
/// </summary>
internal sealed class VendorActorNameReadPort : IVendorActorNameReadPort
{
    private readonly ProcurementDbContext _db;
    private readonly IInternalDirectoryReadPort _directory;

    public VendorActorNameReadPort(ProcurementDbContext db, IInternalDirectoryReadPort directory)
    {
        _db = db;
        _directory = directory;
    }

    public async Task<IReadOnlyDictionary<string, string>> ResolveAsync(
        IReadOnlyCollection<string?> actorKeys,
        CancellationToken cancellationToken)
    {
        var names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var keys = actorKeys
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Select(key => key!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (keys.Length == 0)
        {
            return names;
        }

        foreach (var pair in await _directory.ResolveDisplayNamesAsync(keys, cancellationToken))
        {
            names[pair.Key] = pair.Value;
        }

        var unresolved = keys.Where(key => !names.ContainsKey(key)).ToArray();
        if (unresolved.Length == 0)
        {
            return names;
        }

        // 2. Vendor portal accounts, keyed by the account id the portal signs in with.
        var portalUsers = await _db.Users.AsNoTracking()
            .Where(user => unresolved.Contains(user.Id))
            .Select(user => new { user.Id, user.CompleteName })
            .ToArrayAsync(cancellationToken);
        foreach (var user in portalUsers)
        {
            if (!string.IsNullOrWhiteSpace(user.CompleteName))
            {
                names[user.Id] = user.CompleteName;
            }
        }

        unresolved = unresolved.Where(key => !names.ContainsKey(key)).ToArray();
        if (unresolved.Length == 0)
        {
            return names;
        }

        // 3. A vendor id whose own account is missing (imported vendors): fall back to the account
        // linked to that vendor. Ordered by account id so every screen names the same person —
        // VENDOR_USER_T has no timestamp, so "first" cannot mean "earliest".
        var linked = await (
            from link in _db.VendorUsers.AsNoTracking()
            join user in _db.Users.AsNoTracking() on link.IdentityUserId equals user.Id
            where unresolved.Contains(link.VendorId)
            orderby link.VendorId, user.Id
            select new { link.VendorId, user.CompleteName })
            .ToArrayAsync(cancellationToken);
        foreach (var group in linked.GroupBy(item => item.VendorId, StringComparer.OrdinalIgnoreCase))
        {
            var name = group.Select(item => item.CompleteName).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
            if (name is not null)
            {
                names[group.Key] = name;
            }
        }

        return names;
    }
}
