using Microsoft.AspNetCore.Identity;

namespace IntegratedProcurement.Platform.Persistence.Identity;

/// <summary>
/// External vendor login account. Mirrors the legacy VendorConnect APP_USERS_T structure
/// (string(10) key + CompleteName/IsActive/HasLogin) so accounts migrate 1:1 —
/// by convention the primary account's Id equals its vendor's VendorId.
/// </summary>
public sealed class VendorIdentityUser : IdentityUser<string>
{
    public VendorIdentityUser()
    {
        Id = string.Empty;
    }

    public string CompleteName { get; set; } = string.Empty;

    /// <summary>Job title shown on Vendor Contacts and copied onto the vendor when this person is PIC.</summary>
    public string? Position { get; set; }

    /// <summary>Login-account status (Active/Inactive/Suspended). Moved here from VENDOR_USER_T.</summary>
    public string Status { get; set; } = "Active";

    public bool IsActive { get; set; } = true;

    public bool HasLogin { get; set; }
}
