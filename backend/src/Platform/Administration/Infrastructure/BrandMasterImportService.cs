using ClosedXML.Excel;
using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

internal sealed class BrandMasterImportService : IBrandMasterImportService
{
    private readonly IAdminConsoleMasterDataService _masterData;

    public BrandMasterImportService(IAdminConsoleMasterDataService masterData)
    {
        _masterData = masterData;
    }

    public byte[] CreateTemplate()
    {
        using var workbook = new XLWorkbook();
        var brands = workbook.AddWorksheet("Brands");
        brands.Cell(1, 1).Value = "BrandName";
        var header = brands.Range(1, 1, 1, 1);
        header.Style.Font.Bold = true;
        header.Style.Font.FontColor = XLColor.White;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#0F828A");
        brands.SheetView.FreezeRows(1);
        brands.Column(1).Width = 40;

        var instructions = workbook.AddWorksheet("Instructions");
        instructions.Cell(1, 1).Value = "Brand bulk upload";
        instructions.Cell(1, 1).Style.Font.Bold = true;
        instructions.Cell(2, 1).Value = "Put one brand name per row in column BrandName. Existing brands are skipped (case-insensitive). Names are unique, max 50 characters. Empty rows are ignored. CSV is also accepted.";
        instructions.Cell(4, 1).Value = "Unggah massal merek";
        instructions.Cell(4, 1).Style.Font.Bold = true;
        instructions.Cell(5, 1).Value = "Isi satu nama merek per baris di kolom BrandName. Merek yang sudah ada dilewati (tanpa membedakan huruf besar/kecil). Nama unik, maksimal 50 karakter. Baris kosong diabaikan. CSV juga diterima.";
        instructions.Column(1).Width = 110;

        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return output.ToArray();
    }

    public async Task<BrandMasterImportResult> ImportAsync(
        Stream stream,
        string fileName,
        bool commit,
        CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(fileName);
        IReadOnlyList<BrandMasterImportSourceRow> sourceRows;
        if (extension.Equals(".csv", StringComparison.OrdinalIgnoreCase))
        {
            sourceRows = BrandMasterImport.ReadCsv(stream);
        }
        else if (extension.Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            sourceRows = ReadXlsx(stream);
        }
        else
        {
            throw new InvalidDataException("Upload an .xlsx or .csv file.");
        }

        if (sourceRows.Count > BrandMasterImport.MaxDataRows)
        {
            throw new InvalidDataException($"The file has more than {BrandMasterImport.MaxDataRows} brand rows.");
        }

        var existing = await LoadExistingNamesAsync(cancellationToken);
        var plan = BrandMasterImport.Plan(sourceRows, existing);
        if (!commit)
        {
            return plan.ToResult(committed: false);
        }

        if (plan.Created > 0)
        {
            var result = await _masterData.InsertMissingRecordsAsync(
                BrandMasterImport.SetKey,
                BrandMasterImport.SetDefinition,
                plan.RecordsToCreate(),
                cancellationToken);
            if (result.Outcome == MasterDataMutationOutcome.ReadOnly)
            {
                throw new InvalidOperationException("The brand master set is read-only.");
            }
        }

        return plan.ToResult(committed: true);
    }

    private async Task<IReadOnlyCollection<string>> LoadExistingNamesAsync(CancellationToken cancellationToken)
    {
        var set = await _masterData.GetSetAsync(BrandMasterImport.SetKey, null, null, null, cancellationToken);
        if (set is null || set.Records.Count == 0)
        {
            return [];
        }

        return set.Records
            .SelectMany(record => new[] { record.Code, record.Name })
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static IReadOnlyList<BrandMasterImportSourceRow> ReadXlsx(Stream stream)
    {
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        memory.Position = 0;
        using var workbook = new XLWorkbook(memory);
        var sheet = workbook.Worksheets.FirstOrDefault()
            ?? throw new InvalidDataException("The workbook has no worksheets.");

        var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 0;
        var lastCol = Math.Max(sheet.LastColumnUsed()?.ColumnNumber() ?? 1, 1);
        var matrix = new List<IReadOnlyList<string>>(lastRow);
        for (var row = 1; row <= lastRow; row++)
        {
            var cells = new string[lastCol];
            for (var col = 1; col <= lastCol; col++)
            {
                cells[col - 1] = sheet.Cell(row, col).GetString().Trim();
            }

            matrix.Add(cells);
        }

        return BrandMasterImport.ReadSourceRows(matrix);
    }
}
