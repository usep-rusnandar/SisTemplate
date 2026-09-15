using System.Globalization;
using ClosedXML.Excel;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Migration;

public static class VendorAribaImportWorkbookParser
{
    public static List<(int RowNumber, VendorImportPayload Payload, List<ImportIssue> Notes)> Parse(
        byte[] bytes,
        VendorAribaImportCatalog catalog)
    {
        using var workbook = new XLWorkbook(new MemoryStream(bytes));
        if (!workbook.TryGetWorksheet("Vendors", out var vendorSheet))
        {
            throw new InvalidDataException("Worksheet 'Vendors' is required.");
        }

        var headers = Headers(vendorSheet);
        string Cell(IXLRow row, string name) =>
            headers.TryGetValue(NormalizeHeader(name), out var column) ? CellText(row.Cell(column)) : string.Empty;

        var children = ReadChildren(workbook, catalog);
        var result = new List<(int, VendorImportPayload, List<ImportIssue>)>();
        var lastRow = vendorSheet.LastRowUsed()?.RowNumber() ?? 1;
        for (var number = 2; number <= lastRow; number++)
        {
            var row = vendorSheet.Row(number);
            if (row.CellsUsed().All(cell => string.IsNullOrWhiteSpace(CellText(cell))))
            {
                continue;
            }

            var notes = new List<ImportIssue>();
            var externalId = Cell(row, "AribaVendorId");
            children.TryGetValue(externalId, out var child);
            var office = VendorAribaImportNormalizer.OfficePhone(
                Cell(row, "OfficePhoneCountry"), Cell(row, "OfficePhoneArea"), Cell(row, "OfficePhoneNumber"));
            var handphoneCountry = catalog.CanonicalDialCode(VendorAribaImportNormalizer.PhoneCountry(Cell(row, "HandphoneCountry")));
            if (handphoneCountry.Length == 0 && VendorAribaImportNormalizer.Digits(Cell(row, "HandphoneNumber")).Length > 0)
            {
                handphoneCountry = catalog.CanonicalDialCode("+62");
            }
            var npwp = VendorAribaImportNormalizer.Digits(Cell(row, "NPWPNo"));
            var commodities = child?.SubClassifications ?? [];
            var addresses = child?.Addresses ?? [];
            var unknownCommodities = commodities
                .Where(code => !catalog.IsKnownCommodity(code))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (unknownCommodities.Length > 0)
            {
                var preview = string.Join(", ", unknownCommodities.Take(8));
                if (unknownCommodities.Length > 8) preview += ", …";
                notes.Add(new ImportIssue("warning", "Commodities",
                    $"{unknownCommodities.Length} sub-classification(s) are not in Master Data: {preview}."));
            }

            var unresolved = addresses.Where(address =>
                address.Type == "OFFICE"
                && (address.ProvinceCode.Length == 0 || address.CityCode.Length == 0)
                && (address.Address.Length > 0 || address.PostCode.Length > 0)).ToArray();
            if (unresolved.Length > 0)
            {
                notes.Add(new ImportIssue("warning", "Addresses", "Province/city names could not be fully resolved to Master Data codes."));
            }

            result.Add((number, new VendorImportPayload(
                externalId,
                Cell(row, "VendorName").Trim(),
                Cell(row, "PICName").Trim(),
                Cell(row, "PICEmail").Trim().ToLowerInvariant(),
                Cell(row, "Position").Trim(),
                catalog.CanonicalDialCode(office.Country),
                office.Area,
                office.Number,
                handphoneCountry,
                VendorAribaImportNormalizer.Digits(Cell(row, "HandphoneNumber")),
                VendorAribaImportNormalizer.WebAddress(Cell(row, "WebAddress")),
                npwp,
                Cell(row, "NIBNo").Trim(),
                Cell(row, "AktaPendirianNo").Trim(),
                VendorAribaImportNormalizer.Date(Cell(row, "AktaPendirianDate")),
                Cell(row, "AktaPerubahanNo").Trim(),
                VendorAribaImportNormalizer.Date(Cell(row, "AktaPerubahanDate")),
                Cell(row, "AktaPenyesuaianNo").Trim(),
                VendorAribaImportNormalizer.Date(Cell(row, "AktaPenyesuaianDate")),
                Cell(row, "SPPKPNo").Trim(),
                Cell(row, "AribaStatus").Trim(),
                DateTimeOffsetValue(Cell(row, "SourceUpdatedAt")),
                Bool(Cell(row, "IsActive"), true),
                addresses,
                commodities,
                child?.Kblis ?? [],
                child?.Brands ?? [],
                child?.Certificates ?? [],
                child?.Portfolios ?? [],
                child?.SpecialRequirements ?? []), notes));
        }

        return result;
    }

    private static Dictionary<string, ImportChildren> ReadChildren(XLWorkbook workbook, VendorAribaImportCatalog catalog)
    {
        var result = new Dictionary<string, ImportChildren>(StringComparer.OrdinalIgnoreCase);
        ImportChildren Get(string id) => result.TryGetValue(id, out var value) ? value : result[id] = new ImportChildren();

        Read("Addresses", (row, cell) =>
        {
            var resolved = catalog.ResolveAddress(cell(row, "ProvinceCode"), cell(row, "CityCode"), cell(row, "DistrictCode"), cell(row, "VillageCode"));
            Get(cell(row, "AribaVendorId")).Addresses.Add(new ImportAddress(
                VendorAribaImportNormalizer.AddressType(cell(row, "AddressType")),
                cell(row, "Address"),
                cell(row, "AddressCode"),
                resolved.ProvinceCode,
                resolved.CityCode,
                resolved.DistrictCode,
                resolved.VillageCode,
                cell(row, "PostCode"),
                VendorAribaImportNormalizer.AddressCountry(cell(row, "Country")),
                Decimal(cell(row, "Latitude")),
                Decimal(cell(row, "Longitude"))));
        });
        Read("Commodities", (row, cell) =>
            AddUnique(Get(cell(row, "AribaVendorId")).SubClassifications, VendorAribaImportNormalizer.CommodityCode(cell(row, "SubClassificationCode"))));
        Read("KBLIs", (row, cell) =>
        {
            var type = cell(row, "KbliTypeCode");
            var status = cell(row, "KbliStatusCode");
            var codes = VendorAribaImportNormalizer.KbliCodes(cell(row, "KbliCode"));
            if (codes.Count == 0)
            {
                var single = cell(row, "KbliCode");
                if (single.Length > 0) codes = [single];
            }

            foreach (var code in codes)
            {
                Get(cell(row, "AribaVendorId")).Kblis.Add(new ImportKbli(type, code, status));
            }
        });
        Read("Brands", (row, cell) =>
        {
            var name = cell(row, "BrandName").Trim();
            if (name.Length == 0) return;
            Get(cell(row, "AribaVendorId")).Brands.Add(
                new ImportBrand(name, cell(row, "DistributorTypeCode"), VendorAribaImportNormalizer.Date(cell(row, "ExpireDate"))));
        });
        Read("Certificates", (row, cell) => Get(cell(row, "AribaVendorId")).Certificates.Add(
            new ImportCertificate(cell(row, "CertificateNumber"), cell(row, "Description"), VendorAribaImportNormalizer.Date(cell(row, "ExpireDate")))));
        Read("Portfolios", (row, cell) => Get(cell(row, "AribaVendorId")).Portfolios.Add(
            new ImportPortfolio(cell(row, "Client"), cell(row, "ScopeOfWork"), Decimal(cell(row, "TotalValue")) ?? 0,
                VendorAribaImportNormalizer.Date(cell(row, "ContractStartDate")) ?? DateOnly.MinValue,
                VendorAribaImportNormalizer.Date(cell(row, "ContractEndDate")) ?? DateOnly.MinValue)));
        Read("SpecialRequirements", (row, cell) => Get(cell(row, "AribaVendorId")).SpecialRequirements.Add(
            new ImportSpecialRequirement(cell(row, "SpecialReqCode"), cell(row, "Number"), cell(row, "Description"),
                VendorAribaImportNormalizer.Date(cell(row, "ExpireDate")))));
        return result;

        void Read(string sheetName, Action<IXLRow, Func<IXLRow, string, string>> consume)
        {
            if (!workbook.TryGetWorksheet(sheetName, out var sheet)) return;
            var headers = Headers(sheet);
            string Cell(IXLRow row, string name) =>
                headers.TryGetValue(NormalizeHeader(name), out var column) ? CellText(row.Cell(column)) : string.Empty;
            var last = sheet.LastRowUsed()?.RowNumber() ?? 1;
            for (var rowNumber = 2; rowNumber <= last; rowNumber++)
            {
                var row = sheet.Row(rowNumber);
                if (!string.IsNullOrWhiteSpace(Cell(row, "AribaVendorId"))) consume(row, Cell);
            }
        }
    }

    private static Dictionary<string, int> Headers(IXLWorksheet sheet) =>
        sheet.Row(1).CellsUsed().ToDictionary(cell => NormalizeHeader(cell.GetString()), cell => cell.Address.ColumnNumber, StringComparer.OrdinalIgnoreCase);

    private static string NormalizeHeader(string value) => value.Replace("*", string.Empty, StringComparison.Ordinal).Trim();

    private static string CellText(IXLCell cell)
    {
        if (cell.IsEmpty())
        {
            return string.Empty;
        }

        if (cell.DataType == XLDataType.DateTime)
        {
            var date = cell.GetDateTime();
            return date.TimeOfDay == TimeSpan.Zero
                ? date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                : date.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        }

        if (cell.DataType == XLDataType.Number && cell.TryGetValue(out double number))
        {
            if (number is >= 20000 and < 80000 && Math.Abs(number - Math.Truncate(number)) < 0.0000001)
            {
                return DateTime.FromOADate(number).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            }

            if (number is >= 0 and < 1e16 && Math.Abs(number - Math.Truncate(number)) < 0.0000001)
            {
                return Math.Truncate(number).ToString("0", CultureInfo.InvariantCulture);
            }
        }

        return cell.GetFormattedString().Trim();
    }

    private static DateTimeOffset? DateTimeOffsetValue(string value) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date) ? date : null;

    private static decimal? Decimal(string value) =>
        decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var number) ? number : null;

    private static bool Bool(string value, bool fallback) => bool.TryParse(value, out var parsed) ? parsed : fallback;

    private static void AddUnique(List<string> target, string value)
    {
        if (value.Length > 0 && !target.Contains(value, StringComparer.OrdinalIgnoreCase))
        {
            target.Add(value);
        }
    }
}

internal sealed class ImportChildren
{
    public List<ImportAddress> Addresses { get; } = [];
    public List<string> SubClassifications { get; } = [];
    public List<ImportKbli> Kblis { get; } = [];
    public List<ImportBrand> Brands { get; } = [];
    public List<ImportCertificate> Certificates { get; } = [];
    public List<ImportPortfolio> Portfolios { get; } = [];
    public List<ImportSpecialRequirement> SpecialRequirements { get; } = [];
}

public sealed record VendorImportPayload(string AribaVendorId, string VendorName, string PicName, string PicEmail,
    string Position, string OfficePhoneCountry, string OfficePhoneArea, string OfficePhoneNumber, string HandphoneCountry, string HandphoneNumber, string WebAddress,
    string NpwpNo, string NibNo, string AktaPendirianNo, DateOnly? AktaPendirianDate, string AktaPerubahanNo, DateOnly? AktaPerubahanDate,
    string AktaPenyesuaianNo, DateOnly? AktaPenyesuaianDate, string SppkpNo, string AribaStatus, DateTimeOffset? SourceUpdatedAt, bool IsActive,
    List<ImportAddress> Addresses, List<string> SubClassifications, List<ImportKbli> Kblis, List<ImportBrand> Brands,
    List<ImportCertificate> Certificates, List<ImportPortfolio> Portfolios, List<ImportSpecialRequirement> SpecialRequirements);

public sealed record ImportAddress(string Type, string Address, string AddressCode, string ProvinceCode, string CityCode, string DistrictCode, string VillageCode, string PostCode, string Country, decimal? Latitude, decimal? Longitude);
public sealed record ImportKbli(string TypeCode, string Code, string StatusCode);
public sealed record ImportBrand(string Name, string DistributorTypeCode, DateOnly? ExpireDate);
public sealed record ImportCertificate(string Number, string Description, DateOnly? ExpireDate);
public sealed record ImportPortfolio(string Client, string ScopeOfWork, decimal TotalValue, DateOnly StartDate, DateOnly EndDate);
public sealed record ImportSpecialRequirement(string Code, string Number, string Description, DateOnly? ExpireDate);
