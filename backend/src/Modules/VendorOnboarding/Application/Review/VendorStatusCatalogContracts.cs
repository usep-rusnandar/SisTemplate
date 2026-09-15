namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>
/// One vendor lifecycle status as configured in Master Data ▸ Vendor Status. This set is the approval
/// route: <paramref name="ApproverRoleCode"/> says who must act while a vendor sits here, and
/// <paramref name="NextId"/> says where an approval sends it. Labels come from here too, so an
/// administrator can reword or re-route without a release.
/// </summary>
/// <param name="NameId">Indonesian label, when the record carries one — otherwise null.</param>
/// <param name="ApproverRoleCode">Role that approves at this status; null = not an approval station.</param>
/// <param name="SlaDays">Target turnaround in WORKING days while waiting here; null = untracked.</param>
public sealed record VendorStatusDto(
    string Code,
    string Name,
    string? NameId,
    string? Description,
    string? DescriptionId,
    int Order,
    bool InUse,
    string? NextId,
    string? ApproverRoleCode,
    int? SlaDays);

/// <summary>Module-owned read of the platform's <c>vendor-status</c> master-data set.</summary>
public interface IVendorStatusCatalogReadPort
{
    Task<IReadOnlyList<VendorStatusDto>> ReadAsync(CancellationToken cancellationToken);
}
