namespace SisTemplate.Platform.Administration.Application;

/// <summary>
/// Configuration for the Administrative Regions sync from <c>wilayah.id</c>. Bound from the "Wilayah"
/// configuration section; every value has a sensible default so the feature works with no config.
/// </summary>
public sealed class WilayahSyncOptions
{
    public const string SectionName = "Wilayah";

    /// <summary>Master switch. When false the scheduler and the manual trigger are both inert.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Base URL of the wilayah.id API (no trailing slash needed).</summary>
    public string BaseUrl { get; set; } = "https://wilayah.id/api";

    /// <summary>How deep to sync. Village is the full hierarchy (~82k rows, thousands of requests).</summary>
    public WilayahSyncDepth Depth { get; set; } = WilayahSyncDepth.Village;

    /// <summary>Maximum concurrent HTTP requests against wilayah.id per hierarchy level.</summary>
    public int MaxConcurrency { get; set; } = 8;

    /// <summary>Day of month the scheduled sync fires (1 = the 1st). Clamped to 1..28.</summary>
    public int DayOfMonth { get; set; } = 1;

    /// <summary>
    /// Hour (UTC) the scheduled sync fires on <see cref="DayOfMonth"/>. Clamped to 0..23.
    /// Default 17 = 00:00 WIB (UTC+7), outside office hours so a long village fan-out is less likely
    /// to collide with a manual click or daytime CDN throttling.
    /// </summary>
    public int HourUtc { get; set; } = 17;

    /// <summary>Per-request HTTP timeout in seconds.</summary>
    public int RequestTimeoutSeconds { get; set; } = 30;

    public int NormalizedDayOfMonth => Math.Clamp(DayOfMonth, 1, 28);

    public int NormalizedHourUtc => Math.Clamp(HourUtc, 0, 23);

    public int NormalizedConcurrency => Math.Clamp(MaxConcurrency, 1, 32);
}
