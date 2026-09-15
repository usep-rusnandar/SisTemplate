namespace SisTemplate.BuildingBlocks.Application;

/// <summary>
/// Western Indonesia Time (WIB, UTC+7, no DST). Timestamps are always STORED as UTC
/// (<see cref="DateTimeOffset.UtcNow"/>); this helper converts to Jakarta local time only at
/// presentation / business-day boundaries (e.g. "today" counts, display strings). Never use it
/// to persist a value.
/// </summary>
public static class JakartaTime
{
    /// <summary>The Asia/Jakarta zone, resolved robustly across OSes (IANA on Linux/ICU, Windows id
    /// as fallback, and a fixed +7 zone as a last resort so this never throws at startup).</summary>
    public static TimeZoneInfo Zone { get; } = Resolve();

    private static TimeZoneInfo Resolve()
    {
        foreach (var id in new[] { "Asia/Jakarta", "SE Asia Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }

        return TimeZoneInfo.CreateCustomTimeZone("WIB", TimeSpan.FromHours(7), "WIB (UTC+7)", "WIB");
    }

    /// <summary>Current wall-clock time in Jakarta (as an offset of +07:00).</summary>
    public static DateTimeOffset Now() => TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Zone);

    /// <summary>Today's calendar date in Jakarta — use this for "today"/day-boundary logic, not UTC.</summary>
    public static DateOnly Today() => DateOnly.FromDateTime(Now().DateTime);

    /// <summary>Convert any instant to its Jakarta local representation.</summary>
    public static DateTimeOffset ToJakarta(DateTimeOffset value) => TimeZoneInfo.ConvertTime(value, Zone);

    /// <summary>The Jakarta calendar date of an instant — for grouping/comparing by day in WIB.</summary>
    public static DateOnly DateOf(DateTimeOffset value) => DateOnly.FromDateTime(ToJakarta(value).DateTime);
}
