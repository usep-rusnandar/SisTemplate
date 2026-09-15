using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;

/// <summary>
/// Anti-corruption maps for officer Ariba inject workbooks. The downloaded template uses
/// canonical codes; production inject files use labels, packed cells, and dial digits.
/// </summary>
public static class VendorAribaImportNormalizer
{
    private static readonly Regex CommodityCodePattern = new(
        @"\b([MS]\.\d{2}\.\d{2})\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string AddressType(string? raw)
    {
        var value = Fold(raw);
        if (value.Length == 0)
        {
            return string.Empty;
        }

        if (value.Contains("WAREHOUSE", StringComparison.Ordinal) || value.Contains("GUDANG", StringComparison.Ordinal))
        {
            return "WAREHOUSE";
        }

        if (value.Contains("WORKSHOP", StringComparison.Ordinal) || value.Contains("DAPUR", StringComparison.Ordinal))
        {
            return "WORKSHOP";
        }

        if (value.Contains("OFFICE", StringComparison.Ordinal) || value.Contains("KANTOR", StringComparison.Ordinal))
        {
            return "OFFICE";
        }

        return value switch
        {
            "OFFICE" or "WAREHOUSE" or "WORKSHOP" => value,
            _ => value,
        };
    }

    public static string AddressCountry(string? raw)
    {
        var value = (raw ?? string.Empty).Trim();
        if (value.Length == 0)
        {
            return "Indonesia";
        }

        var folded = Fold(value);
        if (folded is "ID" or "IDN" or "INDONESIA" or "62" or "+62")
        {
            return "Indonesia";
        }

        return value;
    }

    public static string PhoneCountry(string? raw)
    {
        var digits = Digits(raw);
        if (digits.Length == 0)
        {
            var folded = Fold(raw);
            if (folded is "ID" or "IDN" or "INDONESIA")
            {
                return "+62";
            }

            if (folded is "SG" or "SINGAPORE")
            {
                return "+65";
            }

            return (raw ?? string.Empty).Trim();
        }

        if (digits.Length is >= 2 and <= 3)
        {
            return "+" + digits.TrimStart('0');
        }

        return "+" + digits;
    }

    public static (string Country, string Area, string Number) OfficePhone(string? country, string? area, string? number)
    {
        var rawCountry = (country ?? string.Empty).Trim();
        var rawArea = Digits(area);
        var rawNumber = Digits(number);
        var countryDigits = Digits(rawCountry);

        if (rawCountry.StartsWith('+')
            || Fold(rawCountry) is "ID" or "IDN" or "INDONESIA" or "SG" or "SINGAPORE")
        {
            return (DefaultDial(PhoneCountry(rawCountry), rawNumber), rawArea, rawNumber);
        }

        // 62 / 65 are calling codes; other 2–4 digit values in this column are city area codes
        // (021, 0542, or 21 when Excel stripped the leading zero).
        if (countryDigits is "62" or "65" or "60" or "61" or "63" or "66")
        {
            return (PhoneCountry(rawCountry), rawArea, rawNumber);
        }

        if (countryDigits.Length is >= 2 and <= 4 && !rawCountry.StartsWith('+') && rawArea.Length == 0)
        {
            return ("+62", countryDigits.TrimStart('0'), rawNumber);
        }

        var mapped = PhoneCountry(rawCountry);
        return (DefaultDial(mapped, rawNumber), rawArea, rawNumber);
    }

    private static string DefaultDial(string mapped, string number) =>
        mapped.Length == 0 && number.Length > 0 ? "+62" : mapped;

    public static string CommodityCode(string? raw)
    {
        var value = (raw ?? string.Empty).Trim();
        if (value.Length == 0)
        {
            return string.Empty;
        }

        var match = CommodityCodePattern.Match(value);
        return match.Success ? match.Groups[1].Value.ToUpperInvariant() : value;
    }

    public static IReadOnlyList<string> KbliCodes(string? raw)
    {
        var value = (raw ?? string.Empty).Trim();
        if (value.Length == 0)
        {
            return [];
        }

        return value
            .Split([';', ',', '|', '/', '\n'], StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(token => Digits(token))
            .Where(token => token.Length >= 4)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }

    public static string WebAddress(string? raw)
    {
        var value = (raw ?? string.Empty).Trim();
        if (value.Length == 0)
        {
            return string.Empty;
        }

        if (value.Contains("://", StringComparison.Ordinal))
        {
            return value;
        }

        if (value.Contains('.', StringComparison.Ordinal) && !value.Contains(' '))
        {
            return "https://" + value.TrimStart('/');
        }

        return value;
    }

    public static DateOnly? Date(string? raw)
    {
        var value = (raw ?? string.Empty).Trim();
        if (value.Length == 0)
        {
            return null;
        }

        if (double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var serial)
            && serial is >= 20000 and < 80000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        if (DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var invariant))
        {
            return invariant;
        }

        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var dt))
        {
            return DateOnly.FromDateTime(dt);
        }

        if (DateTime.TryParse(value, new CultureInfo("id-ID"), DateTimeStyles.AllowWhiteSpaces, out dt)
            || DateTime.TryParse(value, new CultureInfo("en-US"), DateTimeStyles.AllowWhiteSpaces, out dt))
        {
            return DateOnly.FromDateTime(dt);
        }

        return null;
    }

    public static string Fold(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(raw.Length);
        var previousSpace = false;
        foreach (var ch in raw.Trim().ToUpperInvariant())
        {
            if (char.IsWhiteSpace(ch))
            {
                if (!previousSpace)
                {
                    builder.Append(' ');
                }

                previousSpace = true;
                continue;
            }

            previousSpace = false;
            builder.Append(ch);
        }

        var value = builder.ToString();
        if (value is "DI YOGYAKARTA" or "DIY" or "YOGYAKARTA SPECIAL REGION")
        {
            value = "DAERAH ISTIMEWA YOGYAKARTA";
        }

        return StripAdminPrefix(value);
    }

    public static string Digits(string? raw) =>
        string.IsNullOrEmpty(raw) ? string.Empty : new string(raw.Where(char.IsDigit).ToArray());

    public static string StripAdminPrefix(string value)
    {
        foreach (var prefix in new[] { "KOTA ADM. ", "KAB. ADM. ", "KOTA ADM ", "KAB. ADM ", "KABUPATEN ", "KOTA ", "KAB. " })
        {
            if (value.StartsWith(prefix, StringComparison.Ordinal))
            {
                return value[prefix.Length..].Trim();
            }
        }

        return value;
    }
}
