using SisTemplate.BuildingBlocks.Application;

namespace SisTemplate.Platform.Administration.Application;

/// <summary>Jakarta-facing schedule copy and next-run math for the Super Admin catalog. Never persist these.</summary>
public static class BackgroundProcessSchedule
{
    public const string ArchitectureNote =
        "All of these processes run in-process on this AppHost. Two replicas would each run the same schedule.";

    public static string MonthlyWib(int dayOfMonth, int hourUtc)
    {
        var day = Math.Clamp(dayOfMonth, 1, 28);
        var hour = Math.Clamp(hourUtc, 0, 23);
        var sample = new DateTimeOffset(2026, 1, 1, hour, 0, 0, TimeSpan.Zero);
        var wib = JakartaTime.ToJakarta(sample);
        return $"Day {day} of each month at {wib:HH:mm} WIB";
    }

    /// <summary>Next occurrence of day-of-month at the UTC hour, strictly after <paramref name="fromUtc"/>.</summary>
    public static DateTimeOffset NextMonthlyUtc(DateTimeOffset fromUtc, int dayOfMonth, int hourUtc)
    {
        var day = Math.Clamp(dayOfMonth, 1, 28);
        var hour = Math.Clamp(hourUtc, 0, 23);
        var utc = fromUtc.ToUniversalTime();
        var candidate = new DateTimeOffset(utc.Year, utc.Month, day, hour, 0, 0, TimeSpan.Zero);
        if (candidate <= utc)
        {
            var nextMonth = new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(1);
            candidate = new DateTimeOffset(nextMonth.Year, nextMonth.Month, day, hour, 0, 0, TimeSpan.Zero);
        }

        return candidate;
    }

    public static string EveryHoursAfterStartup(TimeSpan startupDelay, TimeSpan interval)
    {
        var hours = Math.Max(1, (int)Math.Round(interval.TotalHours));
        var delayMinutes = Math.Max(0, (int)Math.Round(startupDelay.TotalMinutes));
        return $"Every {hours} hours (first run {delayMinutes} minutes after host start)";
    }

    public static string EveryMinutes(int minutes)
    {
        var clamped = Math.Max(1, minutes);
        return clamped == 1 ? "Every minute" : $"Every {clamped} minutes";
    }

    public static string EventDriven => "Event-driven — parks until a job is queued";

    public static string NotHostScheduled => "Not scheduled on this host — run from the module screen";
}
