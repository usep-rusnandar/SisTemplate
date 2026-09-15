using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Working-day SLA math for the vendor approval route. Dates are WIB calendar dates; the timestamps
/// are given at 03:00Z (= 10:00 WIB) so the UTC instant and the Jakarta date agree in these cases.
/// </summary>
public sealed class VendorApprovalSlaTests
{
    // 2026-08-17 is a Monday and a fixed holiday (Independence Day); 2026-01-01 recurs yearly.
    private static readonly WorkingDayCalendar Calendar = new(
        [new DateOnly(2026, 8, 17)],
        [(1, 1)]);

    private static DateTimeOffset At(int year, int month, int day) =>
        new(year, month, day, 3, 0, 0, TimeSpan.Zero);

    [Fact]
    public void AddWorkingDaysSkipsTheWeekend()
    {
        // Thursday + 2 working days = Monday (Fri, Mon), not Saturday.
        Assert.Equal(new DateOnly(2026, 8, 10), Calendar.AddWorkingDays(new DateOnly(2026, 8, 6), 2));
    }

    [Fact]
    public void AddWorkingDaysSkipsAHoliday()
    {
        // Fri 14 Aug + 1 working day: Mon 17 Aug is a holiday, so it lands on Tue 18 Aug.
        Assert.Equal(new DateOnly(2026, 8, 18), Calendar.AddWorkingDays(new DateOnly(2026, 8, 14), 1));
    }

    [Fact]
    public void RecurringHolidayAppliesToEveryYear()
    {
        Assert.False(Calendar.IsWorkingDay(new DateOnly(2027, 1, 1)));
        Assert.True(Calendar.IsWorkingDay(new DateOnly(2027, 1, 4)));
    }

    [Fact]
    public void CountWorkingDaysExcludesTheStartDay()
    {
        // Mon → Fri is four working days elapsed; the entry day itself does not count.
        Assert.Equal(4, Calendar.CountWorkingDays(new DateOnly(2026, 8, 3), new DateOnly(2026, 8, 7)));
        Assert.Equal(0, Calendar.CountWorkingDays(new DateOnly(2026, 8, 3), new DateOnly(2026, 8, 3)));
    }

    [Fact]
    public void StepIsOnTrackBeforeItsDueDate()
    {
        var sla = VendorApprovalSla.Evaluate(Calendar, At(2026, 8, 3), 3, new DateOnly(2026, 8, 4));

        Assert.Equal(ApprovalSlaStatuses.OnTrack, sla.Status);
        Assert.Equal(new DateOnly(2026, 8, 6), sla.DueDate);
        Assert.Equal(2, sla.DaysRemaining);
        Assert.Equal(0, sla.DaysOverdue);
    }

    [Fact]
    public void StepIsDueOnItsDueDateAndOverdueAfterIt()
    {
        var due = VendorApprovalSla.Evaluate(Calendar, At(2026, 8, 3), 3, new DateOnly(2026, 8, 6));
        var late = VendorApprovalSla.Evaluate(Calendar, At(2026, 8, 3), 3, new DateOnly(2026, 8, 11));

        Assert.Equal(ApprovalSlaStatuses.DueToday, due.Status);
        Assert.Equal(ApprovalSlaStatuses.Overdue, late.Status);
        Assert.Equal(3, late.DaysOverdue);
        Assert.Equal(0, late.DaysRemaining);
    }

    [Fact]
    public void StepWithoutAnSlaIsReportedAsUntracked()
    {
        var sla = VendorApprovalSla.Evaluate(Calendar, At(2026, 8, 3), null, new DateOnly(2026, 12, 31));

        Assert.Equal(ApprovalSlaStatuses.NotTracked, sla.Status);
        Assert.Null(sla.DueDate);
        Assert.Equal(At(2026, 8, 3), sla.StepEnteredAt);
    }

    [Fact]
    public void ClockStartsAtTheLastDecisionOnceTheRouteHasAdvanced()
    {
        var started = At(2026, 8, 3);
        var decided = At(2026, 8, 5);

        Assert.Equal(decided, VendorApprovalSla.StepEnteredAt(started, decided));
        Assert.Equal(started, VendorApprovalSla.StepEnteredAt(started, null));
        // A resubmission moves the instance start past the earlier decisions.
        Assert.Equal(started, VendorApprovalSla.StepEnteredAt(started, At(2026, 7, 30)));
    }
}
