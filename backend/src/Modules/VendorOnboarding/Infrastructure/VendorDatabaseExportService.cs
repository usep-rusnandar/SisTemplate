using ClosedXML.Excel;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>
/// Builds the operational Vendor Database workbook. Data retrieval stays behind the registry read port;
/// ClosedXML and master-data resolution remain Infrastructure concerns.
/// </summary>
internal sealed class VendorDatabaseExportService : IVendorDatabaseExportService
{
    private const int ExportPageSize = 200;
    private const int HeaderRow = 5;
    private const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private readonly IVendorRegistryReadPort _registry;
    private readonly IVendorStatusCatalogReadPort _statusCatalog;
    private readonly ProcurementDbContext _dbContext;
    private readonly TimeProvider _timeProvider;

    public VendorDatabaseExportService(
        IVendorRegistryReadPort registry,
        IVendorStatusCatalogReadPort statusCatalog,
        ProcurementDbContext dbContext,
        TimeProvider timeProvider)
    {
        _registry = registry;
        _statusCatalog = statusCatalog;
        _dbContext = dbContext;
        _timeProvider = timeProvider;
    }

    public async Task<VendorDatabaseExportFile> ExportAsync(
        VendorDatabaseExportQuery query,
        CancellationToken cancellationToken)
    {
        var statusFilter = string.IsNullOrWhiteSpace(query.Status)
            || query.Status.Equals("all", StringComparison.OrdinalIgnoreCase)
                ? null
                : new[] { query.Status.Trim() };
        var rows = await ReadAllRowsAsync(query.Search, statusFilter, cancellationToken);
        var statuses = await _statusCatalog.ReadAsync(cancellationToken);
        var lookups = await ReadMasterLookupsAsync(cancellationToken);
        var isIndonesian = query.Language.Equals("id", StringComparison.OrdinalIgnoreCase);
        var generatedAt = _timeProvider.GetLocalNow();

        using var workbook = new XLWorkbook();
        workbook.Properties.Title = "Vendor Database";
        workbook.Properties.Subject = "Vendor Onboarding vendor registry export";
        workbook.Properties.Author = "AlamTri Geo Integrated Procurement";

        var sheet = workbook.Worksheets.Add("Vendor Database");
        sheet.ShowGridLines = false;

        var headers = Headers(isIndonesian);
        sheet.Range(1, 1, 1, headers.Length).Merge();
        sheet.Cell(1, 1).Value = isIndonesian ? "Database Vendor" : "Vendor Database";
        sheet.Cell(2, 1).Value = isIndonesian ? "Dibuat pada" : "Generated at";
        sheet.Cell(2, 2).Value = generatedAt.DateTime;
        sheet.Cell(2, 2).Style.DateFormat.Format = "yyyy-mm-dd hh:mm";
        sheet.Cell(3, 1).Value = isIndonesian ? "Filter" : "Filter";
        sheet.Cell(3, 2).Value = DescribeFilter(query, statuses, isIndonesian);

        for (var column = 0; column < headers.Length; column++)
        {
            sheet.Cell(HeaderRow, column + 1).Value = headers[column];
        }

        var statusByCode = statuses.ToDictionary(status => status.Code, StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < rows.Count; index++)
        {
            var rowNumber = HeaderRow + 1 + index;
            var values = Values(rows[index], statusByCode, lookups, isIndonesian);
            for (var column = 0; column < values.Length; column++)
            {
                sheet.Cell(rowNumber, column + 1).Value = values[column];
            }
        }

        FormatWorksheet(sheet, headers.Length, rows.Count);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return new VendorDatabaseExportFile(
            stream.ToArray(),
            $"Vendor-Database-{generatedAt:yyyyMMdd-HHmmss}.xlsx",
            ContentType);
    }

    private async Task<List<VendorRegistryRowDto>> ReadAllRowsAsync(
        string? search,
        IReadOnlyCollection<string>? statuses,
        CancellationToken cancellationToken)
    {
        var result = new List<VendorRegistryRowDto>();
        var page = 1;
        while (true)
        {
            var batch = await _registry.ReadAsync(
                new VendorRegistryQuery(search, statuses, page, ExportPageSize),
                cancellationToken);
            result.AddRange(batch.Items);
            if (result.Count >= batch.Total || batch.Items.Count == 0)
            {
                return result;
            }

            page++;
        }
    }

    private async Task<MasterLookups> ReadMasterLookupsAsync(CancellationToken cancellationToken)
    {
        var records = await _dbContext.MasterDataRecords.AsNoTracking()
            .Where(record => record.Status == "Active"
                && (record.SetKey == "commodity-subclassification" || record.SetKey == "kbli"))
            .Select(record => new { record.SetKey, record.Code, record.Name })
            .ToListAsync(cancellationToken);

        Dictionary<string, string> Index(string setKey) => records
            .Where(record => record.SetKey == setKey)
            .GroupBy(record => record.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Name, StringComparer.OrdinalIgnoreCase);

        return new MasterLookups(Index("commodity-subclassification"), Index("kbli"));
    }

    private static string[] Headers(bool id) => id
        ? [
            "ID Vendor", "Nama Vendor", "Status", "Keterangan", "Nama Penanggung Jawab", "Jabatan", "Email",
            "Telepon Kantor", "Telepon Seluler", "Situs", "Alamat Kantor", "Alamat Gudang", "Alamat Workshop",
            "NPWP", "NIB", "Akta Pendirian", "Akta Perubahan", "Akta Penyesuaian", "SPPKP", "Commodity",
            "ID KBLI", "Deskripsi KBLI", "Klien Portofolio", "Lingkup Kerja", "No. Sertifikat", "Deskripsi Sertifikat"
        ]
        : [
            "Vendor ID", "Vendor Name", "Status", "Description", "Person in Charge", "Position", "Email",
            "Office Phone", "Mobile Phone", "Web Address", "Office Address", "Warehouse Address", "Workshop Address",
            "NPWP", "NIB", "Deed of Establishment", "Deed of Amendment", "Deed of Adjustment", "SPPKP", "Commodity",
            "KBLI ID", "KBLI Description", "Portfolio Client", "Scope of Work", "Certificate No.", "Certificate Description"
        ];

    private static string[] Values(
        VendorRegistryRowDto row,
        Dictionary<string, VendorStatusDto> statuses,
        MasterLookups lookups,
        bool id)
    {
        statuses.TryGetValue(row.Status, out var status);
        return [
            row.Id,
            row.Name,
            status is null ? row.Status : id ? status.NameId ?? status.Name : status.Name,
            status is null ? string.Empty : id ? status.DescriptionId ?? status.Description ?? string.Empty : status.Description ?? string.Empty,
            row.PicName ?? string.Empty,
            row.Position ?? string.Empty,
            row.Email ?? string.Empty,
            row.OfficePhone ?? string.Empty,
            row.MobilePhone ?? string.Empty,
            row.WebAddress ?? string.Empty,
            row.OfficeAddress ?? string.Empty,
            row.WarehouseAddress ?? string.Empty,
            row.WorkshopAddress ?? string.Empty,
            row.NpwpNo ?? string.Empty,
            row.NibNo ?? string.Empty,
            row.AktaPendirianNo ?? string.Empty,
            row.AktaPerubahanNo ?? string.Empty,
            row.AktaPenyesuaianNo ?? string.Empty,
            row.SppkpNo ?? string.Empty,
            Join(row.CommodityCodes, lookups.Commodities),
            Join(row.KbliCodes),
            Join(row.KbliCodes, lookups.Kblis),
            Join(row.PortfolioClients),
            Join(row.PortfolioScopes),
            Join(row.CertificateNumbers),
            Join(row.CertificateDescriptions)
        ];
    }

    private static string DescribeFilter(
        VendorDatabaseExportQuery query,
        IReadOnlyCollection<VendorStatusDto> statuses,
        bool id)
    {
        var search = string.IsNullOrWhiteSpace(query.Search) ? (id ? "Semua vendor" : "All vendors") : query.Search.Trim();
        var status = statuses.FirstOrDefault(item => string.Equals(item.Code, query.Status, StringComparison.OrdinalIgnoreCase));
        var statusLabel = status is null
            ? id ? "Semua status" : "All statuses"
            : id ? status.NameId ?? status.Name : status.Name;
        return $"{search} · {statusLabel}";
    }

    private static string Join(IEnumerable<string> values, IReadOnlyDictionary<string, string>? lookup = null) =>
        string.Join("; ", values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => lookup is not null && lookup.TryGetValue(value, out var name) ? name : value)
            .Distinct(StringComparer.OrdinalIgnoreCase));

    private static void FormatWorksheet(IXLWorksheet sheet, int columnCount, int rowCount)
    {
        var title = sheet.Range(1, 1, 1, columnCount);
        title.Style.Fill.BackgroundColor = XLColor.FromHtml("#013B52");
        title.Style.Font.FontColor = XLColor.White;
        title.Style.Font.Bold = true;
        title.Style.Font.FontSize = 16;
        title.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        title.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
        sheet.Row(1).Height = 30;

        sheet.Range(2, 1, 3, 1).Style.Font.Bold = true;
        sheet.Range(2, 1, 3, 2).Style.Font.FontColor = XLColor.FromHtml("#5C6B73");

        var header = sheet.Range(HeaderRow, 1, HeaderRow, columnCount);
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#0F828A");
        header.Style.Font.FontColor = XLColor.White;
        header.Style.Font.Bold = true;
        header.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        header.Style.Alignment.WrapText = true;
        sheet.Row(HeaderRow).Height = 30;

        var lastRow = HeaderRow + Math.Max(rowCount, 1);
        var data = sheet.Range(HeaderRow + 1, 1, lastRow, columnCount);
        data.Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
        data.Style.Alignment.WrapText = true;
        data.Style.Border.BottomBorder = XLBorderStyleValues.Hair;
        data.Style.Border.BottomBorderColor = XLColor.FromHtml("#DDE4E7");

        if (rowCount > 0)
        {
            var table = sheet.Range(HeaderRow, 1, HeaderRow + rowCount, columnCount).CreateTable("VendorDatabaseTable");
            table.Theme = XLTableTheme.TableStyleMedium2;
            table.ShowAutoFilter = true;
        }
        else
        {
            sheet.Range(HeaderRow, 1, HeaderRow, columnCount).SetAutoFilter();
        }

        sheet.SheetView.FreezeRows(HeaderRow);
        var widths = new double[] { 15, 30, 18, 30, 24, 22, 30, 18, 18, 24, 42, 42, 42, 22, 22, 24, 24, 24, 22, 36, 24, 48, 30, 48, 28, 42 };
        for (var column = 0; column < widths.Length; column++)
        {
            sheet.Column(column + 1).Width = widths[column];
        }

        sheet.PageSetup.PageOrientation = XLPageOrientation.Landscape;
        sheet.PageSetup.FitToPages(1, 0);
        sheet.PageSetup.SetRowsToRepeatAtTop(HeaderRow, HeaderRow);
    }

    private sealed record MasterLookups(
        IReadOnlyDictionary<string, string> Commodities,
        IReadOnlyDictionary<string, string> Kblis);
}
