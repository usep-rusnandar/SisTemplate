using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Who may mutate Officer-owned portfolio rows: role <c>OFFCR-VDR</c> or <c>SPR-ADM</c> (Super Admin
/// follows the Officer party — they must not edit Vendor-owned rows). Status gate: awaiting approval
/// (master-data <c>approverRoleCode</c> is set) or already <c>APPRV</c>/<c>RGSTD</c>.
/// </summary>
public static class VendorPortfolioOfficerAccess
{
    public const string OfficerVendorOnboardingRoleCode = "OFFCR-VDR";
    public const string SuperAdminRoleCode = "SPR-ADM";

    public static bool HasOfficerPartyRole(IEnumerable<string>? roleCodes)
    {
        if (roleCodes is null)
        {
            return false;
        }

        foreach (var code in roleCodes)
        {
            if (string.Equals(code, OfficerVendorOnboardingRoleCode, StringComparison.OrdinalIgnoreCase)
                || string.Equals(code, SuperAdminRoleCode, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    public static bool CanMutateForStatus(string? status, VendorApprovalChain? chain)
    {
        if (string.Equals(status, VendorStatuses.Approved, StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, VendorStatuses.Registered, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return chain is not null && chain.IsAwaitingApproval(status);
    }
}
