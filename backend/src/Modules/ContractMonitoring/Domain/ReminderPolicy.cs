namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>
/// Business rule for contract-expiry reminder tiers. A contract becomes eligible for a reminder
/// when it falls inside the 180-day window; the tier escalates as expiry approaches. Returns
/// <c>null</c> when no reminder is due (already expired, or further than 180 days out).
/// </summary>
public static class ReminderPolicy
{
    public static string? TierForDays(int daysToExpiry) =>
        daysToExpiry switch
        {
            < 0 => null,
            <= 30 => "d30",
            <= 60 => "m2",
            <= 120 => "m4",
            <= 180 => "m6",
            _ => null
        };
}
