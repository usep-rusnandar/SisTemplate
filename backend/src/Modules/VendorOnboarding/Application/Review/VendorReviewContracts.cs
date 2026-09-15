namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>Registry row for the internal reviewer list.</summary>
public sealed record VendorSummaryDto(
    string Id,
    string Name,
    string Status,
    string? NpwpNo,
    string? NibNo,
    string? WebAddress,
    string? OfficeProvinceCode,
    string? OfficeCityCode,
    DateTimeOffset? UpdatedAt);

public sealed record VendorStatusHistoryDto(
    string StatusCode,
    string? CreatedBy,
    string? Reason,
    DateTimeOffset ChangedAt);

/// <summary>Result of a reviewer action; Ok=false with Error when the transition is not allowed.
/// On success, VendorName + ContactEmail are populated so the caller can notify the vendor.</summary>
public sealed record VendorReviewResult(
    bool Found,
    bool Ok,
    string Status,
    string? Error,
    string? VendorName = null,
    string? ContactEmail = null,
    bool Forbidden = false,
    string? NextApproverRoleCode = null,
    bool NextApprovalIsFinal = false);

public enum VendorReviewAction
{
    Approve,
    Reject,
    RequestRevision,
    Blacklist,
    Unblacklist,
}
