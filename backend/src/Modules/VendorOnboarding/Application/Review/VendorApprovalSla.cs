using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.BuildingBlocks.Application.Abstractions;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

public static class ApprovalSlaStatuses
{
    /// <summary>The step carries no SLA — reported as untracked rather than silently on time.</summary>
    public const string NotTracked = "NotTracked";
    public const string OnTrack = "OnTrack";
    public const string DueToday = "DueToday";
    public const string Overdue = "Overdue";
}

/// <summary>
/// SLA reading for one approval step, in WORKING days and WIB calendar dates.
/// <paramref name="DaysRemaining"/> counts down to the due date and is 0 once it has passed;
/// <paramref name="DaysOverdue"/> is the mirror value after it.
/// </summary>
public sealed record ApprovalSlaSnapshot(
    int? SlaDays,
    DateTimeOffset? StepEnteredAt,
    DateOnly? DueDate,
    int WorkingDaysElapsed,
    int DaysRemaining,
    int DaysOverdue,
    string Status)
{
    public static ApprovalSlaSnapshot None { get; } =
        new(null, null, null, 0, 0, 0, ApprovalSlaStatuses.NotTracked);
}

public static class VendorApprovalSla
{
    /// <summary>
    /// When the current step's clock started: the later of the instance start (first submission or a
    /// resubmission after revision) and the most recent decision on that instance. Derived rather than
    /// stored, so vendors already in flight get an SLA reading without a backfill.
    /// </summary>
    public static DateTimeOffset StepEnteredAt(DateTimeOffset instanceStartedAt, DateTimeOffset? lastDecisionAt) =>
        lastDecisionAt is DateTimeOffset decided && decided > instanceStartedAt ? decided : instanceStartedAt;

    /// <summary>
    /// Evaluates a step that is currently waiting. The clock only runs while the instance is Active —
    /// once revision is requested the ball is in the vendor's court and the caller passes no step at all.
    /// </summary>
    public static ApprovalSlaSnapshot Evaluate(
        WorkingDayCalendar calendar,
        DateTimeOffset stepEnteredAt,
        int? slaDays,
        DateOnly? today = null)
    {
        var enteredOn = JakartaTime.DateOf(stepEnteredAt);
        if (slaDays is not int sla || sla < 1)
        {
            return ApprovalSlaSnapshot.None with { StepEnteredAt = stepEnteredAt };
        }

        var asOf = today ?? JakartaTime.Today();
        var dueDate = calendar.AddWorkingDays(enteredOn, sla);
        var elapsed = calendar.CountWorkingDays(enteredOn, asOf);
        var status = asOf > dueDate
            ? ApprovalSlaStatuses.Overdue
            : asOf == dueDate ? ApprovalSlaStatuses.DueToday : ApprovalSlaStatuses.OnTrack;

        return new ApprovalSlaSnapshot(
            sla,
            stepEnteredAt,
            dueDate,
            elapsed,
            asOf < dueDate ? calendar.CountWorkingDays(asOf, dueDate) : 0,
            asOf > dueDate ? calendar.CountWorkingDays(dueDate, asOf) : 0,
            status);
    }

    /// <summary>
    /// Working days a finished step actually took, for the variance report. Same day counting as
    /// <see cref="Evaluate"/>: the entry day itself is not counted.
    /// </summary>
    public static int WorkingDaysTaken(
        WorkingDayCalendar calendar,
        DateTimeOffset stepEnteredAt,
        DateTimeOffset decidedAt) =>
        calendar.CountWorkingDays(JakartaTime.DateOf(stepEnteredAt), JakartaTime.DateOf(decidedAt));
}
