using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public enum VendorInvitationBindAction
{
    CreateVendor,
    ReuseVendor,
    RejectRegistered,
}

/// <summary>
/// Whether a new officer invitation should create a vendor, reuse an existing
/// INITL/INVTD vendor, or reject because the email already belongs to a vendor
/// that has started or completed registration.
/// </summary>
/// <remarks>
/// Vendor status is the source of truth. <c>HasLogin</c> can be stale on Ariba/VC
/// imports (password set from Vendor Contacts, leftover VC flag) while the vendor
/// is still waiting for an officer invitation.
/// </remarks>
public static class VendorInvitationReuseRules
{
    public static VendorInvitationBindAction Decide(bool identityExists, bool hasLogin, string? vendorStatus)
    {
        if (!identityExists)
        {
            return VendorInvitationBindAction.CreateVendor;
        }

        if (VendorStatuses.AllowsOfficerInviteReuse(vendorStatus))
        {
            return VendorInvitationBindAction.ReuseVendor;
        }

        _ = hasLogin;
        return VendorInvitationBindAction.RejectRegistered;
    }
}
