namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// A vendor location (office / warehouse / workshop). Region fields hold master-data <b>codes</b>
/// (province/city/district/village) referenced by code — not hard FKs — consistent with the generic
/// master-data store. Mirrors the VENDOR_T address block from the legacy VendorConnect schema.
/// </summary>
public sealed class VendorAddress
{
    public string? Address { get; private set; }

    public string? AddressCode { get; private set; }

    public string? ProvinceCode { get; private set; }

    public string? CityCode { get; private set; }

    public string? DistrictCode { get; private set; }

    public string? VillageCode { get; private set; }

    public string? PostCode { get; private set; }

    public string? Country { get; private set; }

    public decimal? Latitude { get; private set; }

    public decimal? Longitude { get; private set; }

    public static VendorAddress Empty() => new();

    public static VendorAddress Create(
        string? address, string? addressCode, string? provinceCode, string? cityCode,
        string? districtCode, string? villageCode, string? postCode, string? country,
        decimal? latitude, decimal? longitude)
    {
        static string? T(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        return new VendorAddress
        {
            Address = T(address),
            AddressCode = T(addressCode),
            ProvinceCode = T(provinceCode),
            CityCode = T(cityCode),
            DistrictCode = T(districtCode),
            VillageCode = T(villageCode),
            PostCode = T(postCode),
            Country = T(country),
            Latitude = latitude,
            Longitude = longitude,
        };
    }
}
