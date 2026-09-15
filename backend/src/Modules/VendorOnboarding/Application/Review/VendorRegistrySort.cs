namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>
/// Allowed Vendor Database grid sort keys. Unknown keys fall back to the default
/// (UpdatedAt descending, then Name) so the list API never orders on an arbitrary column.
/// </summary>
public static class VendorRegistrySort
{
    public const string Id = "id";
    public const string Name = "name";
    public const string Status = "status";
    public const string StatusDescription = "statusDescription";
    public const string PicName = "picName";
    public const string Position = "position";
    public const string Email = "email";
    public const string OfficePhone = "officePhone";
    public const string MobilePhone = "mobilePhone";
    public const string WebAddress = "webAddress";
    public const string OfficeAddress = "officeAddress";
    public const string WarehouseAddress = "warehouseAddress";
    public const string WorkshopAddress = "workshopAddress";
    public const string NpwpNo = "npwpNo";
    public const string NibNo = "nibNo";
    public const string AktaPendirianNo = "aktaPendirianNo";
    public const string AktaPerubahanNo = "aktaPerubahanNo";
    public const string AktaPenyesuaianNo = "aktaPenyesuaianNo";
    public const string SppkpNo = "sppkpNo";
    public const string CommodityCodes = "commodityCodes";
    public const string KbliCodes = "kbliCodes";
    public const string KbliDescriptions = "kbliDescriptions";
    public const string PortfolioClients = "portfolioClients";
    public const string PortfolioScopes = "portfolioScopes";
    public const string CertificateNumbers = "certificateNumbers";
    public const string CertificateDescriptions = "certificateDescriptions";

    public static readonly IReadOnlyList<string> Keys =
    [
        Id,
        Name,
        Status,
        StatusDescription,
        PicName,
        Position,
        Email,
        OfficePhone,
        MobilePhone,
        WebAddress,
        OfficeAddress,
        WarehouseAddress,
        WorkshopAddress,
        NpwpNo,
        NibNo,
        AktaPendirianNo,
        AktaPerubahanNo,
        AktaPenyesuaianNo,
        SppkpNo,
        CommodityCodes,
        KbliCodes,
        KbliDescriptions,
        PortfolioClients,
        PortfolioScopes,
        CertificateNumbers,
        CertificateDescriptions,
    ];

    /// <summary>
    /// Returns <c>true</c> when <paramref name="sortBy"/> is a known grid column.
    /// Direction is descending only when the caller sends <c>desc</c>; anything else is ascending.
    /// </summary>
    public static bool TryNormalize(string? sortBy, string? sortDir, out string key, out bool descending)
    {
        var raw = (sortBy ?? string.Empty).Trim();
        var match = Keys.FirstOrDefault(candidate =>
            candidate.Equals(raw, StringComparison.OrdinalIgnoreCase));
        if (match is null)
        {
            key = string.Empty;
            descending = true;
            return false;
        }

        key = match;
        descending = string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase);
        return true;
    }
}
