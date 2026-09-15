namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// Login-account status of a vendor identity account (USERS_T.Status) — distinct from the company
/// lifecycle in <see cref="VendorStatuses"/>. An account can stay Active while the company is still
/// under review.
/// </summary>
public static class VendorUserStatuses
{
    public const string Active = "Active";
    public const string Inactive = "Inactive";
    public const string Suspended = "Suspended";
}
