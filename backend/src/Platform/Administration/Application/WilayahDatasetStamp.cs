using System.Globalization;

namespace SisTemplate.Platform.Administration.Application;

/// <summary>
/// wilayah.id publishes a file-level <c>meta.updated_at</c> (date, not per-row). Used as an
/// audit stamp and as a cheap skip when the dataset date and province count are unchanged.
/// </summary>
public static class WilayahDatasetStamp
{
    public static DateOnly? Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (DateOnly.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            return date;
        }

        if (DateTimeOffset.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dto))
        {
            return DateOnly.FromDateTime(dto.UtcDateTime);
        }

        return null;
    }

    public static string? Format(DateOnly? stamp) =>
        stamp?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>
    /// Skip the city/district/village fan-out when the source dataset date matches the last
    /// successful stamp and the province count is unchanged. Missing stamps never skip
    /// (we cannot prove the dataset is the same). A village-depth last run with 0 villages
    /// also never skips — that usually means villages were never loaded.
    /// </summary>
    public static bool ShouldSkipRefresh(
        DateOnly? incomingStamp,
        DateOnly? lastSuccessStamp,
        int incomingProvinceCount,
        int lastProvinceCount,
        bool requireVillages,
        int lastVillageCount)
    {
        if (incomingStamp is null || lastSuccessStamp is null)
        {
            return false;
        }

        if (incomingStamp != lastSuccessStamp)
        {
            return false;
        }

        if (incomingProvinceCount <= 0 || incomingProvinceCount != lastProvinceCount)
        {
            return false;
        }

        if (requireVillages && lastVillageCount <= 0)
        {
            return false;
        }

        return true;
    }
}
