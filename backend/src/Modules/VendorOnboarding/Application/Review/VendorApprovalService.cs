using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>
/// Approval driven by the status chain in Master Data ▸ Vendor Status: the vendor's status says who
/// must act, and approving moves it to that status's <c>nextId</c>. There is no workflow definition —
/// re-routing the approval means editing master data.
/// </summary>
public sealed class VendorApprovalService
{
    private readonly VendorApprovalChainProvider _chains;
    private readonly IInternalRoleReadPort _roles;
    private readonly IVendorActorNameReadPort _actorNames;
    private readonly IVendorRepository _repository;
    private readonly IWorkingDayCalendarProvider _calendars;

    public VendorApprovalService(
        VendorApprovalChainProvider chains,
        IInternalRoleReadPort roles,
        IVendorActorNameReadPort actorNames,
        IVendorRepository repository,
        IWorkingDayCalendarProvider calendars)
    {
        _chains = chains;
        _roles = roles;
        _actorNames = actorNames;
        _repository = repository;
        _calendars = calendars;
    }

    public Task<IReadOnlyList<string>> GetActorRoleCodesAsync(string actorId, CancellationToken cancellationToken) =>
        _roles.GetActorRoleCodesAsync(actorId, cancellationToken);

    public Task<VendorApprovalChain> GetChainAsync(CancellationToken cancellationToken) =>
        _chains.GetAsync(cancellationToken);

    /// <summary>Submission (or resubmission after a revision) enters the first approval station.</summary>
    public async Task<string?> StartOrRestartAsync(Vendor vendor, string? actorId, CancellationToken cancellationToken)
    {
        var chain = await _chains.GetAsync(cancellationToken);
        var stations = chain.ApprovalStations();
        if (stations.Count == 0)
        {
            throw new VendorApprovalException(
                "No approval station is configured. Give a Vendor Status an approver role in Master Data.");
        }

        var first = stations[0];

        vendor.SetStatus(
            first.Code,
            actorId,
            vendor.Status == VendorStatuses.Repair
                ? "Vendor resubmitted registration for review."
                : "Vendor submitted registration for review.");

        return first.ApproverRoleCode;
    }

    public async Task<VendorApprovalContextDto> GetContextAsync(
        string vendorId,
        CurrentActor? actor,
        CancellationToken cancellationToken)
    {
        var vendor = await _repository.GetAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Empty(string.Empty);
        }

        var chain = await _chains.GetAsync(cancellationToken);
        var current = chain.Find(vendor.Status);
        var stations = chain.ApprovalStations();
        var history = await _repository.GetStatusHistoryAsync(vendorId, cancellationToken);
        var calendar = await _calendars.GetCalendarAsync(cancellationToken);
        var roleNames = await _roles.GetRoleNamesAsync(cancellationToken);
        var actorNames = await _actorNames.ResolveAsync(
            history.Select(entry => entry.CreatedBy).ToArray(),
            cancellationToken);

        var awaiting = current?.ApproverRoleCode is not null;
        var enteredAt = EnteredAt(history, vendor.Status);
        var sla = awaiting ? VendorStatusSla.Evaluate(calendar, current, enteredAt) : ApprovalSlaSnapshot.None;

        var canReview = actor is not null
            && awaiting
            && actor.Permissions.Contains(PermissionKeys.VendorOnboardingApprove, StringComparer.OrdinalIgnoreCase)
            && (await _roles.GetActorRoleCodesAsync(actor.ActorId, cancellationToken))
                .Contains(current!.ApproverRoleCode!, StringComparer.OrdinalIgnoreCase);

        return new VendorApprovalContextDto(
            awaiting,
            vendor.Status,
            current?.Name,
            current?.Description,
            current?.ApproverRoleCode,
            current?.ApproverRoleCode is string role ? roleNames.GetValueOrDefault(role) : null,
            awaiting ? stations.ToList().FindIndex(s => s.Code == current!.Code) + 1 : null,
            stations.Count,
            canReview,
            canReview ? ["approve", "request-revision", "reject"] : [],
            sla,
            BuildTrail(stations, history, vendor.Status, calendar, roleNames, actorNames, sla));
    }

    public async Task<ApprovalActionOutcome> ActAsync(
        Vendor vendor,
        VendorReviewAction action,
        CurrentActor actor,
        string? reason,
        CancellationToken cancellationToken)
    {
        if (!actor.Permissions.Contains(PermissionKeys.VendorOnboardingApprove, StringComparer.OrdinalIgnoreCase))
        {
            return ApprovalActionOutcome.Denied("The vendor approval permission is required.");
        }

        var chain = await _chains.GetAsync(cancellationToken);
        var current = chain.Find(vendor.Status);
        if (current?.ApproverRoleCode is not string requiredRole)
        {
            return ApprovalActionOutcome.Invalid("This vendor is not waiting for an approval.");
        }

        var actorRoles = await _roles.GetActorRoleCodesAsync(actor.ActorId, cancellationToken);
        if (!actorRoles.Contains(requiredRole, StringComparer.OrdinalIgnoreCase))
        {
            return ApprovalActionOutcome.Denied($"This step is assigned to role '{requiredRole}'.");
        }

        if (action is VendorReviewAction.Reject or VendorReviewAction.RequestRevision
            && string.IsNullOrWhiteSpace(reason))
        {
            return ApprovalActionOutcome.Invalid("A reason is required for rejection or revision.");
        }

        switch (action)
        {
            case VendorReviewAction.Approve:
            {
                var next = chain.NextAfter(current.Code);
                if (next is null)
                {
                    return ApprovalActionOutcome.Invalid(
                        $"Status '{current.Code}' has no next status configured in Master Data.");
                }

                vendor.SetStatus(
                    next,
                    actor.ActorId,
                    string.IsNullOrWhiteSpace(reason) ? $"Approved: {current.Name}." : reason);
                var nextStation = chain.Find(next);
                var approvalStations = chain.ApprovalStations();
                var finalStation = approvalStations.Count == 0 ? null : approvalStations[^1];
                return ApprovalActionOutcome.Success(
                    nextStation?.ApproverRoleCode,
                    nextStation?.ApproverRoleCode is not null
                    && string.Equals(nextStation.Code, finalStation?.Code, StringComparison.OrdinalIgnoreCase));
            }

            case VendorReviewAction.RequestRevision:
                vendor.SetStatus(VendorStatuses.Repair, actor.ActorId, reason);
                return ApprovalActionOutcome.Success(null);

            case VendorReviewAction.Reject:
                vendor.SetStatus(VendorStatuses.Rejected, actor.ActorId, reason);
                return ApprovalActionOutcome.Success(null);

            default:
                return ApprovalActionOutcome.Invalid("This action is not an approval decision.");
        }
    }

    /// <summary>
    /// When the vendor entered its current status — the newest history row carrying that code. The
    /// history is the only clock: there is no separate instance record to stamp.
    /// </summary>
    private static DateTimeOffset? EnteredAt(IReadOnlyList<VendorStatusHistory> history, string statusCode) =>
        history
            .Where(entry => string.Equals(entry.StatusCode, statusCode, StringComparison.OrdinalIgnoreCase))
            .Select(entry => (DateTimeOffset?)entry.CreatedAt)
            .Max();

    /// <summary>
    /// The vendor's progress through the configured stations. A station is Done once the vendor has been
    /// there and moved on; the time it took is the gap to the next history entry.
    /// </summary>
    private static List<ApprovalStationProgressDto> BuildTrail(
        IReadOnlyList<VendorStatusDto> stations,
        IReadOnlyList<VendorStatusHistory> history,
        string currentStatus,
        WorkingDayCalendar calendar,
        IReadOnlyDictionary<string, string> roleNames,
        IReadOnlyDictionary<string, string> actorNames,
        ApprovalSlaSnapshot currentSla)
    {
        // Oldest first, so "what came after" is simply the next element.
        var ordered = history.OrderBy(entry => entry.CreatedAt).ToArray();
        var rows = new List<ApprovalStationProgressDto>(stations.Count);

        for (var position = 0; position < stations.Count; position++)
        {
            var station = stations[position];
            var index = Array.FindLastIndex(
                ordered,
                entry => string.Equals(entry.StatusCode, station.Code, StringComparison.OrdinalIgnoreCase));
            var isCurrent = string.Equals(station.Code, currentStatus, StringComparison.OrdinalIgnoreCase);
            var entered = index >= 0 ? ordered[index].CreatedAt : (DateTimeOffset?)null;
            var left = index >= 0 && index + 1 < ordered.Length ? ordered[index + 1].CreatedAt : (DateTimeOffset?)null;

            var state = isCurrent
                ? ApprovalStationStates.Current
                : left is not null ? ApprovalStationStates.Done : ApprovalStationStates.Pending;
            var taken = entered is DateTimeOffset from && left is DateTimeOffset to
                ? VendorApprovalSla.WorkingDaysTaken(calendar, from, to)
                : (int?)null;
            var dueDate = entered is DateTimeOffset since && station.SlaDays is int days
                ? calendar.AddWorkingDays(JakartaTime.DateOf(since), days)
                : (DateOnly?)null;
            var actorId = index >= 0 && index + 1 < ordered.Length ? ordered[index + 1].CreatedBy : null;

            rows.Add(new ApprovalStationProgressDto(
                station.Code,
                position + 1,
                station.Order,
                station.Name,
                station.ApproverRoleCode,
                station.ApproverRoleCode is string role ? roleNames.GetValueOrDefault(role) : null,
                station.SlaDays,
                state,
                entered,
                left,
                actorId,
                actorId is not null ? actorNames.GetValueOrDefault(actorId) : null,
                taken,
                isCurrent ? currentSla.DueDate ?? dueDate : dueDate,
                isCurrent
                    ? currentSla.Status
                    : SettledStatus(calendar, entered, left, station.SlaDays)));
        }

        return rows;
    }

    private static string SettledStatus(
        WorkingDayCalendar calendar,
        DateTimeOffset? enteredAt,
        DateTimeOffset? leftAt,
        int? slaDays)
    {
        if (slaDays is not int days || days < 1 || enteredAt is not DateTimeOffset from || leftAt is not DateTimeOffset to)
        {
            return ApprovalSlaStatuses.NotTracked;
        }

        var dueDate = calendar.AddWorkingDays(JakartaTime.DateOf(from), days);
        return JakartaTime.DateOf(to) > dueDate ? ApprovalSlaStatuses.Overdue : ApprovalSlaStatuses.OnTrack;
    }

    private static VendorApprovalContextDto Empty(string statusCode) =>
        new(false, statusCode, null, null, null, null, null, 0, false, [], ApprovalSlaSnapshot.None, []);
}
