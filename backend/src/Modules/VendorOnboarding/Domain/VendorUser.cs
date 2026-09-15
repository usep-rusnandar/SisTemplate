using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// Link between a vendor company (<see cref="Vendor"/>) and a person on that company
/// (VendorIdentityUser in USERS_T). Contact details and account status live on the identity
/// account; this table wires the two together and marks which person is the Vendor Workspace PIC.
/// A vendor may have many contacts; only the workspace PIC may sign in to Vendor Workspace.
/// </summary>
public sealed class VendorUser : Entity
{
    private VendorUser()
    {
    }

    private VendorUser(string identityUserId, string vendorId, bool isWorkspacePic)
        : base(Guid.NewGuid())
    {
        IdentityUserId = identityUserId;
        VendorId = vendorId;
        IsWorkspacePic = isWorkspacePic;
    }

    public string IdentityUserId { get; private set; } = string.Empty;

    public string VendorId { get; private set; } = string.Empty;

    /// <summary>
    /// When true, this contact may sign in to Vendor Workspace. At most one row per
    /// <see cref="VendorId"/> may be true (enforced by a filtered unique index).
    /// </summary>
    public bool IsWorkspacePic { get; private set; }

    public static VendorUser Create(string identityUserId, string vendorId, bool isWorkspacePic = true)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(identityUserId);
        ArgumentException.ThrowIfNullOrWhiteSpace(vendorId);

        return new VendorUser(identityUserId, vendorId, isWorkspacePic);
    }

    public void SetWorkspacePic(bool isWorkspacePic) => IsWorkspacePic = isWorkspacePic;
}
