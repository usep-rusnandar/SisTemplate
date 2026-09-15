namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;

public sealed record VendorAribaRegionRow(string Code, string Name, string? ParentCode);

/// <summary>
/// Name/code lookup for Ariba inject addresses. Master Data is the source of truth;
/// a small BPS city fallback covers inject files when wilayah sync is incomplete.
/// </summary>
public sealed class VendorAribaImportCatalog
{
    private readonly Dictionary<string, string> _provinceByCode;
    private readonly Dictionary<string, string> _provinceByName;
    private readonly List<VendorAribaRegionRow> _cities;
    private readonly List<VendorAribaRegionRow> _districts;
    private readonly List<VendorAribaRegionRow> _villages;
    private readonly HashSet<string> _commodityCodes;
    private readonly HashSet<string> _dialCodes;

    // BPS city codes used by Ariba inject files but missing from the stub city seed.
    private static readonly VendorAribaRegionRow[] CityFallback =
    [
        new("14.71", "KOTA PEKANBARU", "14"),
        new("16.71", "KOTA PALEMBANG", "16"),
        new("21.71", "KOTA BATAM", "21"),
        new("32.15", "KAB. KARAWANG", "32"),
        new("32.16", "KAB. BEKASI", "32"),
        new("32.71", "KOTA BOGOR", "32"),
        new("32.73", "KOTA BANDUNG", "32"),
        new("32.75", "KOTA BEKASI", "32"),
        new("33.74", "KOTA SEMARANG", "33"),
        new("34.71", "KOTA YOGYAKARTA", "34"),
        new("35.15", "KAB. SIDOARJO", "35"),
        new("35.25", "KAB. GRESIK", "35"),
        new("35.78", "KOTA SURABAYA", "35"),
        new("36.03", "KAB. TANGERANG", "36"),
        new("36.71", "KOTA TANGERANG", "36"),
        new("36.74", "KOTA TANGERANG SELATAN", "36"),
        new("62.02", "KAB. KOTAWARINGIN TIMUR", "62"),
        new("62.05", "KAB. BARITO UTARA", "62"),
        new("63.03", "KAB. BANJAR", "63"),
        new("63.04", "KAB. BARITO KUALA", "63"),
        new("63.09", "KAB. TABALONG", "63"),
        new("63.10", "KAB. TANAH BUMBU", "63"),
        new("63.11", "KAB. BALANGAN", "63"),
        new("63.71", "KOTA BANJARMASIN", "63"),
        new("63.72", "KOTA BANJARBARU", "63"),
        new("64.71", "KOTA BALIKPAPAN", "64"),
        new("64.72", "KOTA SAMARINDA", "64"),
    ];

    public VendorAribaImportCatalog(
        IEnumerable<VendorAribaRegionRow> provinces,
        IEnumerable<VendorAribaRegionRow> cities,
        IEnumerable<VendorAribaRegionRow> districts,
        IEnumerable<VendorAribaRegionRow> villages,
        IEnumerable<string> commodityCodes,
        IEnumerable<string> dialCodes)
    {
        var provinceList = provinces.ToArray();
        _provinceByCode = provinceList.ToDictionary(row => row.Code, row => row.Name, StringComparer.OrdinalIgnoreCase);
        _provinceByName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in provinceList)
        {
            _provinceByName[VendorAribaImportNormalizer.Fold(row.Name)] = row.Code;
            _provinceByName[row.Code] = row.Code;
        }

        _provinceByName[VendorAribaImportNormalizer.Fold("DI YOGYAKARTA")] = "34";
        _cities = MergeFallback(cities, CityFallback);
        _districts = districts.ToList();
        _villages = villages.ToList();
        _commodityCodes = commodityCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        _dialCodes = dialCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public static VendorAribaImportCatalog Empty { get; } = new([], [], [], [], [], ["+62", "+65"]);

    public bool HasCommodities => _commodityCodes.Count > 0;

    public bool IsKnownCommodity(string code) =>
        !HasCommodities || code.Length == 0 || _commodityCodes.Contains(code);

    public string CanonicalDialCode(string phoneCountry)
    {
        if (phoneCountry.Length == 0)
        {
            return phoneCountry;
        }

        if (_dialCodes.Contains(phoneCountry))
        {
            return phoneCountry;
        }

        var plus = phoneCountry.StartsWith('+') ? phoneCountry : "+" + VendorAribaImportNormalizer.Digits(phoneCountry);
        return _dialCodes.Contains(plus) ? plus : phoneCountry;
    }

    public (string ProvinceCode, string CityCode, string DistrictCode, string VillageCode) ResolveAddress(
        string provinceRaw,
        string cityRaw,
        string districtRaw,
        string villageRaw)
    {
        var provinceCode = ResolveProvince(provinceRaw);
        var cityCode = ResolveChild(_cities, provinceCode, cityRaw);
        var districtCode = ResolveChild(_districts, cityCode, districtRaw);
        var villageCode = ResolveChild(_villages, districtCode, villageRaw);
        return (provinceCode, cityCode, districtCode, villageCode);
    }

    private string ResolveProvince(string raw)
    {
        var value = (raw ?? string.Empty).Trim();
        if (value.Length == 0)
        {
            return string.Empty;
        }

        if (_provinceByCode.ContainsKey(value) || _provinceByCode.Keys.Any(code => BpsEquals(code, value)))
        {
            return _provinceByCode.ContainsKey(value)
                ? value
                : _provinceByCode.Keys.First(code => BpsEquals(code, value));
        }

        var folded = VendorAribaImportNormalizer.Fold(value);
        return _provinceByName.TryGetValue(folded, out var code) ? code : string.Empty;
    }

    private static string ResolveChild(List<VendorAribaRegionRow> rows, string parentCode, string raw)
    {
        var value = (raw ?? string.Empty).Trim();
        if (value.Length == 0 || parentCode.Length == 0)
        {
            return string.Empty;
        }

        var scoped = rows.Where(row => string.Equals(row.ParentCode, parentCode, StringComparison.OrdinalIgnoreCase)).ToArray();
        if (scoped.Length == 0)
        {
            return string.Empty;
        }

        var byCode = scoped.FirstOrDefault(row => BpsEquals(row.Code, value));
        if (byCode is not null)
        {
            return byCode.Code;
        }

        var folded = VendorAribaImportNormalizer.Fold(value);
        var preferKab = value.Contains("KABUPATEN", StringComparison.OrdinalIgnoreCase)
                        || value.StartsWith("KAB", StringComparison.OrdinalIgnoreCase);
        var preferKota = value.Contains("KOTA", StringComparison.OrdinalIgnoreCase)
                         && !preferKab;

        var exact = scoped.Where(row => VendorAribaImportNormalizer.Fold(row.Name) == folded).ToArray();
        if (exact.Length == 1)
        {
            return exact[0].Code;
        }

        if (exact.Length > 1)
        {
            return Pick(exact, preferKab, preferKota).Code;
        }

        var contained = scoped.Where(row =>
        {
            var name = VendorAribaImportNormalizer.Fold(row.Name);
            return name.EndsWith(folded, StringComparison.Ordinal) || folded.EndsWith(name, StringComparison.Ordinal);
        }).ToArray();
        if (contained.Length == 1)
        {
            return contained[0].Code;
        }

        if (contained.Length > 1)
        {
            return Pick(contained, preferKab, preferKota).Code;
        }

        return string.Empty;
    }

    private static VendorAribaRegionRow Pick(VendorAribaRegionRow[] rows, bool preferKab, bool preferKota)
    {
        if (preferKab)
        {
            var kab = rows.FirstOrDefault(row => row.Name.Contains("KAB", StringComparison.OrdinalIgnoreCase));
            if (kab is not null) return kab;
        }

        if (preferKota || !preferKab)
        {
            var kota = rows.FirstOrDefault(row => row.Name.Contains("KOTA", StringComparison.OrdinalIgnoreCase));
            if (kota is not null) return kota;
        }

        return rows[0];
    }

    internal static bool BpsEquals(string stored, string raw)
    {
        if (string.Equals(stored, raw, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var left = stored.Replace(".", string.Empty, StringComparison.Ordinal);
        var right = raw.Replace(".", string.Empty, StringComparison.Ordinal);
        return left.Length > 0 && string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
    }

    private static List<VendorAribaRegionRow> MergeFallback(
        IEnumerable<VendorAribaRegionRow> source,
        IReadOnlyList<VendorAribaRegionRow> fallback)
    {
        var list = source.ToList();
        var existing = list.Select(row => row.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var row in fallback)
        {
            if (existing.Add(row.Code))
            {
                list.Add(row);
            }
        }

        return list;
    }
}
