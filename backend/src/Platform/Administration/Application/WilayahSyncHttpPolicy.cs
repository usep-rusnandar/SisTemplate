using System.Net;

namespace SisTemplate.Platform.Administration.Application;

/// <summary>
/// Retry rules for wilayah.id HTTP fan-out. 404 is a complete empty child list (not retried).
/// 429/5xx and transport timeouts are retried with exponential backoff; Retry-After is honoured
/// but capped so one throttled parent cannot stall the whole village run.
/// </summary>
public static class WilayahSyncHttpPolicy
{
    public const int MaxAttempts = 5;
    public static readonly TimeSpan MaxRetryAfter = TimeSpan.FromSeconds(15);

    public static bool ShouldRetry(HttpStatusCode status)
    {
        var code = (int)status;
        return status is HttpStatusCode.TooManyRequests
            or HttpStatusCode.BadGateway
            or HttpStatusCode.ServiceUnavailable
            or HttpStatusCode.GatewayTimeout
            || code == 408;
    }

    /// <param name="failedAttemptIndex">0-based index of the failure that just happened (0 after the first try).</param>
    public static TimeSpan DelayBeforeRetry(int failedAttemptIndex, TimeSpan? retryAfter = null, int jitterMs = 0)
    {
        if (retryAfter is { } header && header > TimeSpan.Zero)
        {
            var capped = header > MaxRetryAfter ? MaxRetryAfter : header;
            return capped + TimeSpan.FromMilliseconds(Math.Max(0, jitterMs));
        }

        var ms = 500d * Math.Pow(2, Math.Max(0, failedAttemptIndex));
        ms = Math.Min(ms, 8_000d);
        return TimeSpan.FromMilliseconds(ms + Math.Max(0, jitterMs));
    }
}
