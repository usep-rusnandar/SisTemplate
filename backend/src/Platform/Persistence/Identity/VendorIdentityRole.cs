using Microsoft.AspNetCore.Identity;

namespace IntegratedProcurement.Platform.Persistence.Identity;

/// <summary>
/// Vendor portal role. Mirrors the legacy VendorConnect APP_ROLES_T structure
/// (string(5) key + Description) — e.g. Id "VNDOR", Name "Vendor".
/// </summary>
public sealed class VendorIdentityRole : IdentityRole<string>
{
    public VendorIdentityRole()
    {
        Id = string.Empty;
    }

    public VendorIdentityRole(string roleId, string roleName)
    {
        Id = roleId;
        Name = roleName;
        NormalizedName = roleName.ToUpperInvariant();
    }

    public string? Description { get; set; }
}
