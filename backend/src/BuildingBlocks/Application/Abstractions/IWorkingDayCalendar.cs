namespace SisTemplate.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Working-day arithmetic for SLA math: Saturday/Sunday plus the company holiday calendar are
/// non-working. Loading the holiday set costs a query, so callers take a <see cref="WorkingDayCalendar"/>
/// snapshot once and then compute synchronously for as many rows as they need.
/// </summary>
public interface IWorkingDayCalendarProvider
{
    Task<WorkingDayCalendar> GetCalendarAsync(CancellationToken cancellationToken);
}

/// <summary>
/// An immutable snapshot of the holiday calendar. All dates are Jakarta calendar dates (WIB) —
/// convert with <see cref="JakartaTime.DateOf"/> before calling in.
/// </summary>
public sealed class WorkingDayCalendar
{
    // Guard against a pathological SLA/holiday configuration walking forever.
    private const int MaxScanDays = 5000;

    private readonly HashSet<DateOnly> _fixedHolidays;
    private readonly HashSet<(int Month, int Day)> _recurringHolidays;

    public WorkingDayCalendar(
        IEnumerable<DateOnly> fixedHolidays,
        IEnumerable<(int Month, int Day)> recurringHolidays)
    {
        _fixedHolidays = [.. fixedHolidays];
        _recurringHolidays = [.. recurringHolidays];
    }

    public static WorkingDayCalendar WeekendsOnly { get; } = new([], []);

    public bool IsWorkingDay(DateOnly date) =>
        date.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday)
        && !_fixedHolidays.Contains(date)
        && !_recurringHolidays.Contains((date.Month, date.Day));

    /// <summary>
    /// The date <paramref name="workingDays"/> working days after <paramref name="start"/>. The start
    /// day itself is never counted, so a step entered on Monday with a 2-day SLA is due on Wednesday.
    /// </summary>
    public DateOnly AddWorkingDays(DateOnly start, int workingDays)
    {
        if (workingDays <= 0)
        {
            return start;
        }

        var date = start;
        var remaining = workingDays;
        var scanned = 0;
        while (remaining > 0 && scanned < MaxScanDays)
        {
            date = date.AddDays(1);
            scanned++;
            if (IsWorkingDay(date))
            {
                remaining--;
            }
        }

        return date;
    }

    /// <summary>
    /// Working days elapsed from <paramref name="start"/> (exclusive) to <paramref name="end"/>
    /// (inclusive) — the counterpart of <see cref="AddWorkingDays"/>. Zero when end is on or before start.
    /// </summary>
    public int CountWorkingDays(DateOnly start, DateOnly end)
    {
        if (end <= start)
        {
            return 0;
        }

        var count = 0;
        var date = start;
        var scanned = 0;
        while (date < end && scanned < MaxScanDays)
        {
            date = date.AddDays(1);
            scanned++;
            if (IsWorkingDay(date))
            {
                count++;
            }
        }

        return count;
    }
}
