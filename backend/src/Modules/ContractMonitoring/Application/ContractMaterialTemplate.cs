using ClosedXML.Excel;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

/// <summary>
/// Official List-of-Material workbook for Material Sync / manual upload.
/// Column headers must stay in lock-step with <see cref="ContractMaterialService.ParseMaterialSheet"/>.
/// The data sheet is added first so <c>sheet1.xml</c> is the parseable sheet.
/// </summary>
public static class ContractMaterialTemplate
{
    public const string FileName = "List-of-Material-Template.xlsx";
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    public const string SampleContractNo = "137/SIS/K/PCU/VIII/2024";
    public const string SampleMaterialNumber = "SIS-001";

    public static readonly string[] RequiredHeaders =
    [
        "Contract No.",
        "Material/Service Number",
        "Description",
        "Site",
        "Currency",
        "Unit Price",
    ];

    public static byte[] Create()
    {
        using var workbook = new XLWorkbook();
        AddDataSheet(workbook);
        AddInstructions(workbook);
        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return output.ToArray();
    }

    private static void AddDataSheet(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.Add("List of Material");
        for (var i = 0; i < RequiredHeaders.Length; i++)
        {
            sheet.Cell(1, i + 1).Value = RequiredHeaders[i];
        }

        var header = sheet.Range(1, 1, 1, RequiredHeaders.Length);
        header.Style.Font.Bold = true;
        header.Style.Font.FontColor = XLColor.White;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#0F828A");
        sheet.SheetView.FreezeRows(1);

        sheet.Cell(2, 1).Value = SampleContractNo;
        sheet.Cell(2, 2).Value = SampleMaterialNumber;
        sheet.Cell(2, 3).Value = "Sample genset rental";
        sheet.Cell(2, 4).Value = "MACO";
        sheet.Cell(2, 5).Value = "IDR";
        sheet.Cell(2, 6).Value = 1_000_000m;
        sheet.Cell(2, 6).Style.NumberFormat.Format = "#,##0.00";

        sheet.Column(1).Width = 28;
        sheet.Column(2).Width = 26;
        sheet.Column(3).Width = 32;
        sheet.Column(4).Width = 12;
        sheet.Column(5).Width = 12;
        sheet.Column(6).Width = 16;
    }

    private static void AddInstructions(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.Add("Instructions");
        sheet.Cell(1, 1).Value = "List of Material — template";
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 14;
        sheet.Cell(1, 1).Style.Font.FontColor = XLColor.FromHtml("#013B52");

        var lines = new[]
        {
            "",
            "English",
            "One .xlsx per contract. Rename this file to the Contract No. with '/' replaced by '-' (example: 137-SIS-K-PCU-VIII-2024.xlsx) and place it in the SharePoint folder used by Material Sync.",
            "Keep the header names on sheet 'List of Material' exactly: Contract No., Material/Service Number, Description, Site, Currency, Unit Price.",
            "Fill Material/Service Number on every row (column B). Do not leave it blank or put the code only in Description.",
            "Unit Price is a number. Contract No. on every row must match the file name / selected contract.",
            "Replace or delete the sample row before you sync a real contract.",
            "",
            "Bahasa Indonesia",
            "Satu file .xlsx per kontrak. Ganti nama file ini menjadi No. Kontrak dengan '/' diganti '-' (contoh: 137-SIS-K-PCU-VIII-2024.xlsx), lalu letakkan di folder SharePoint yang dipakai Material Sync.",
            "Nama kolom di sheet 'List of Material' harus persis: Contract No., Material/Service Number, Description, Site, Currency, Unit Price.",
            "Isi Material/Service Number di setiap baris (kolom B). Jangan dikosongkan atau hanya menaruh kode di Description.",
            "Unit Price berupa angka. No. Kontrak di setiap baris harus sama dengan nama file / kontrak yang dipilih.",
            "Ganti atau hapus baris contoh sebelum menyinkronkan kontrak asli.",
        };

        for (var i = 0; i < lines.Length; i++)
        {
            var cell = sheet.Cell(i + 2, 1);
            cell.Value = lines[i];
            if (lines[i] is "English" or "Bahasa Indonesia")
            {
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontColor = XLColor.FromHtml("#0F828A");
            }

            cell.Style.Alignment.WrapText = true;
        }

        sheet.Column(1).Width = 118;
        sheet.Row(4).Height = 36;
        sheet.Row(5).Height = 36;
        sheet.Row(6).Height = 36;
        sheet.Row(11).Height = 36;
        sheet.Row(12).Height = 36;
        sheet.Row(13).Height = 36;
        sheet.SheetView.FreezeRows(1);
    }
}
