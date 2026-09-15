using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>
/// Internal reviewer use-cases over the vendor registry: list, status history, and the approval
/// workflow actions (approve / reject / request revision / blacklist / unblacklist). Transition rules
/// live in the <see cref="Vendor"/> aggregate; this service just loads, invokes, and persists.
/// </summary>
public sealed class VendorReviewService
{
    private readonly IVendorRepository _repository;
    private readonly VendorApprovalService _approval;

    public VendorReviewService(
        IVendorRepository repository,
        VendorApprovalService approval)
    {
        _repository = repository;
        _approval = approval;
    }

    public async Task<IReadOnlyList<VendorSummaryDto>> ListAsync(string? status, string? search, CancellationToken cancellationToken)
    {
        var vendors = await _repository.ListAsync(status, search, cancellationToken);
        return vendors.Select(v => new VendorSummaryDto(
            v.Id, v.Name, v.Status, v.NpwpNo, v.NibNo, v.WebAddress,
            v.OfficeProvinceCode, v.OfficeCityCode, v.UpdatedAt)).ToArray();
    }

    /// <summary>Current lifecycle status of a vendor (null when the vendor does not exist).</summary>
    public async Task<string?> GetStatusAsync(string vendorId, CancellationToken cancellationToken)
    {
        var vendor = await _repository.GetAsync(vendorId, cancellationToken);
        return vendor?.Status;
    }

    public async Task<IReadOnlyList<VendorStatusHistoryDto>> GetHistoryAsync(string vendorId, CancellationToken cancellationToken)
    {
        var history = await _repository.GetStatusHistoryAsync(vendorId, cancellationToken);
        return history.Select(h => new VendorStatusHistoryDto(h.StatusCode, h.CreatedBy, h.Reason, h.CreatedAt)).ToArray();
    }

    public Task<VendorReviewResult> ApproveAsync(string vendorId, CurrentActor reviewer, string? note, CancellationToken ct) =>
        ActApprovalAsync(vendorId, VendorReviewAction.Approve, reviewer, note, ct);

    public Task<VendorReviewResult> RejectAsync(string vendorId, CurrentActor reviewer, string? reason, CancellationToken ct) =>
        ActApprovalAsync(vendorId, VendorReviewAction.Reject, reviewer, reason, ct);

    public Task<VendorReviewResult> RequestRevisionAsync(string vendorId, CurrentActor reviewer, string? reason, CancellationToken ct) =>
        ActApprovalAsync(vendorId, VendorReviewAction.RequestRevision, reviewer, reason, ct);

    public Task<VendorReviewResult> BlacklistAsync(string vendorId, string? reviewer, string? reason, CancellationToken ct) =>
        ActAsync(vendorId, VendorReviewAction.Blacklist, reviewer, reason, ct);

    public Task<VendorReviewResult> UnblacklistAsync(string vendorId, string? reviewer, string? reason, CancellationToken ct) =>
        ActAsync(vendorId, VendorReviewAction.Unblacklist, reviewer, reason, ct);

    public Task<VendorApprovalContextDto> GetApprovalContextAsync(
        string vendorId,
        CurrentActor actor,
        CancellationToken cancellationToken) =>
        _approval.GetContextAsync(vendorId, actor, cancellationToken);

    private async Task<VendorReviewResult> ActApprovalAsync(
        string vendorId,
        VendorReviewAction action,
        CurrentActor reviewer,
        string? reason,
        CancellationToken cancellationToken)
    {
        var vendor = await _repository.GetAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return new VendorReviewResult(false, false, string.Empty, null);
        }

        var outcome = await _approval.ActAsync(vendor, action, reviewer, reason, cancellationToken);
        if (!outcome.Ok)
        {
            return new VendorReviewResult(
                true,
                false,
                vendor.Status,
                outcome.Error,
                Forbidden: outcome.Forbidden);
        }

        await _repository.SaveChangesAsync(cancellationToken);

        var email = await _repository.GetPrimaryContactEmailAsync(vendorId, cancellationToken);
        return new VendorReviewResult(
            true,
            true,
            vendor.Status,
            null,
            vendor.Name,
            email,
            NextApproverRoleCode: outcome.NextApproverRoleCode,
            NextApprovalIsFinal: outcome.NextApprovalIsFinal);
    }

    private async Task<VendorReviewResult> ActAsync(string vendorId, VendorReviewAction action, string? reviewer, string? reason, CancellationToken cancellationToken)
    {
        var vendor = await _repository.GetAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return new VendorReviewResult(false, false, string.Empty, null);
        }

        try
        {
            switch (action)
            {
                case VendorReviewAction.Blacklist: vendor.Blacklist(reviewer, reason); break;
                case VendorReviewAction.Unblacklist: vendor.Unblacklist(reviewer, reason); break;
                default: throw new VendorApprovalException("Approval decisions go through the status chain.");
            }
        }
        catch (VendorApprovalException ex)
        {
            return new VendorReviewResult(true, false, vendor.Status, ex.Message);
        }

        await _repository.SaveChangesAsync(cancellationToken);
        var email = await _repository.GetPrimaryContactEmailAsync(vendorId, cancellationToken);
        return new VendorReviewResult(true, true, vendor.Status, null, vendor.Name, email);
    }
}
