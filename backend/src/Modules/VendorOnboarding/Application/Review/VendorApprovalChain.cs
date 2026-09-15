using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>
/// The approval route, read from Master Data ▸ Vendor Status: a status says who must act
/// (<c>approverRoleCode</c>), how long they have (<c>slaDays</c>, working days) and where an approval
/// sends the vendor (<c>nextId</c>). Configuration is the whole engine — there is no workflow table.
/// </summary>
public sealed class VendorApprovalChain
{
    private readonly Dictionary<string, VendorStatusDto> _byCode;

    public VendorApprovalChain(IEnumerable<VendorStatusDto> statuses)
    {
        _byCode = statuses.ToDictionary(status => status.Code, StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyCollection<VendorStatusDto> Statuses => _byCode.Values;

    public VendorStatusDto? Find(string? code) =>
        code is not null && _byCode.TryGetValue(code.Trim(), out var status) ? status : null;

    /// <summary>Statuses that wait on one of <paramref name="roleCodes"/> — the approval queue filter.</summary>
    public IReadOnlyList<string> StatusesAwaiting(IEnumerable<string> roleCodes)
    {
        var roles = roleCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return _byCode.Values
            .Where(status => status.ApproverRoleCode is not null && roles.Contains(status.ApproverRoleCode))
            .Select(status => status.Code)
            .ToArray();
    }

    /// <summary>Ordered approval stations, for showing a vendor where it is in the route.</summary>
    public IReadOnlyList<VendorStatusDto> ApprovalStations() =>
        _byCode.Values
            .Where(status => status.ApproverRoleCode is not null)
            .OrderBy(status => status.Order)
            .ToArray();

    /// <summary>Where an approval at <paramref name="code"/> sends the vendor, or null at the end.</summary>
    public string? NextAfter(string? code)
    {
        var status = Find(code);
        return string.IsNullOrWhiteSpace(status?.NextId) ? null : status!.NextId;
    }

    public bool IsAwaitingApproval(string? code) => Find(code)?.ApproverRoleCode is not null;
}

/// <summary>Loads the chain from master data. Scoped: one query per request, reused across rows.</summary>
public sealed class VendorApprovalChainProvider
{
    private readonly IVendorStatusCatalogReadPort _statuses;
    private VendorApprovalChain? _cached;

    public VendorApprovalChainProvider(IVendorStatusCatalogReadPort statuses) => _statuses = statuses;

    public async Task<VendorApprovalChain> GetAsync(CancellationToken cancellationToken) =>
        _cached ??= new VendorApprovalChain(await _statuses.ReadAsync(cancellationToken));
}

/// <summary>SLA reading for the status a vendor is currently waiting on.</summary>
public static class VendorStatusSla
{
    public static ApprovalSlaSnapshot Evaluate(
        WorkingDayCalendar calendar,
        VendorStatusDto? status,
        DateTimeOffset? enteredAt,
        DateOnly? today = null) =>
        status is null || enteredAt is not DateTimeOffset since
            ? ApprovalSlaSnapshot.None
            : VendorApprovalSla.Evaluate(calendar, since, status.SlaDays, today);
}
