using System.Globalization;
using System.IO.Compression;
using System.Text;
using ClosedXML.Excel;
using IntegratedProcurement.Modules.ContractMonitoring.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class ContractMaterialSheetParserTests
{
    [Fact]
    public void ParseMaterialSheetReadsSharePointSharedStringWorkbook()
    {
        using var stream = ExcelSharedStringWorkbook.Create(
            ["Contract No.", "Material/Service Number", "Description", "Site", "Currency", "Unit Price"],
            [
                ["030/SIS/K/GAF/VIII/2026", "SIS-100", "Genset rental", "MACO", "IDR", "23000000"],
                ["030/SIS/K/GAF/VIII/2026", "SIS-101", "Genset standby", "MACO", "IDR", "26000000"],
            ]);

        var rows = ContractMaterialService.ParseMaterialSheet(stream);

        Assert.Equal(2, rows.Count);
        Assert.Equal("030/SIS/K/GAF/VIII/2026", rows[0].ContractNo);
        Assert.Equal("SIS-100", rows[0].MaterialNumber);
        Assert.Equal("Genset rental", rows[0].Description);
        Assert.Equal("MACO", rows[0].Site);
        Assert.Equal("IDR", rows[0].Currency);
        Assert.Equal(23_000_000m, rows[0].UnitPrice);
        Assert.Equal("SIS-101", rows[1].MaterialNumber);
        Assert.Equal(26_000_000m, rows[1].UnitPrice);
    }

    [Fact]
    public void ParseMaterialSheetUsesDescriptionWhenMaterialNumberIsBlank()
    {
        using var stream = ExcelSharedStringWorkbook.Create(
            ["Contract No.", "Material/Service Number", "Description", "Site", "Currency", "Unit Price"],
            [
                ["030/SIS/K/GAF/VIII/2026", "", "SIS-159", "MACO", "IDR", "23000000"],
                ["030/SIS/K/GAF/VIII/2026", "", "SIS-160", "MACO", "IDR", "26000000"],
            ],
            leaveMaterialNumberEmpty: true);

        var rows = ContractMaterialService.ParseMaterialSheet(stream);

        Assert.Equal(2, rows.Count);
        Assert.Equal("SIS-159", rows[0].MaterialNumber);
        Assert.Equal("SIS-159", rows[0].Description);
        Assert.Equal("SIS-160", rows[1].MaterialNumber);
        Assert.Equal(26_000_000m, rows[1].UnitPrice);
    }

    [Fact]
    public void ParseMaterialSheetReadsClosedXmlWorkbook()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Sheet1");
        sheet.Cell(1, 1).Value = "Contract No.";
        sheet.Cell(1, 2).Value = "Material/Service Number";
        sheet.Cell(1, 3).Value = "Description";
        sheet.Cell(1, 4).Value = "Site";
        sheet.Cell(1, 5).Value = "Currency";
        sheet.Cell(1, 6).Value = "Unit Price";
        sheet.Cell(2, 1).Value = "137/SIS/K/PCU/VIII/2024";
        sheet.Cell(2, 2).Value = "MAT-1";
        sheet.Cell(2, 3).Value = "Cable";
        sheet.Cell(2, 4).Value = "SITE-A";
        sheet.Cell(2, 5).Value = "USD";
        sheet.Cell(2, 6).Value = 12.5;
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        var rows = ContractMaterialService.ParseMaterialSheet(stream);

        Assert.Single(rows);
        Assert.Equal("MAT-1", rows[0].MaterialNumber);
        Assert.Equal(12.5m, rows[0].UnitPrice);
    }

    [Fact]
    public void CreateTemplateParsesAsOfficialListOfMaterial()
    {
        using var stream = new MemoryStream(ContractMaterialTemplate.Create());
        using var workbook = new XLWorkbook(stream);

        Assert.Equal("List of Material", workbook.Worksheets.First().Name);
        Assert.Equal(
            ContractMaterialTemplate.RequiredHeaders,
            Enumerable.Range(1, 6).Select(column => workbook.Worksheet(1).Cell(1, column).GetString()).ToArray());

        stream.Position = 0;
        var rows = ContractMaterialService.ParseMaterialSheet(stream);

        Assert.Single(rows);
        Assert.Equal(ContractMaterialTemplate.SampleContractNo, rows[0].ContractNo);
        Assert.Equal(ContractMaterialTemplate.SampleMaterialNumber, rows[0].MaterialNumber);
        Assert.Equal("Sample genset rental", rows[0].Description);
        Assert.Equal("MACO", rows[0].Site);
        Assert.Equal("IDR", rows[0].Currency);
        Assert.Equal(1_000_000m, rows[0].UnitPrice);
        Assert.Equal(
            "137-SIS-K-PCU-VIII-2024.xlsx",
            ContractMaterialService.ExpectedFileName(ContractMaterialTemplate.SampleContractNo));
    }

    [Fact]
    public void ParseMaterialSheetReportsFoundHeadersWhenRequiredColumnsAreMissing()
    {
        using var stream = ExcelSharedStringWorkbook.Create(
            ["Nama", "Kode", "Harga"],
            [["A", "B", "1"]]);

        var error = Assert.Throws<InvalidOperationException>(() => ContractMaterialService.ParseMaterialSheet(stream));

        Assert.Contains("Required columns not found", error.Message, StringComparison.Ordinal);
        Assert.Contains("Nama", error.Message, StringComparison.Ordinal);
        Assert.Contains("Kode", error.Message, StringComparison.Ordinal);
    }

}

/// <summary>
/// Builds a Shared-String .xlsx like Excel / SharePoint Online (empty typed cells + &lt;si&gt;&lt;t&gt;).
/// The previous XmlReader loop skipped those nodes and reported "Required columns not found".
/// </summary>
internal static class ExcelSharedStringWorkbook
{
    public static MemoryStream Create(
        IReadOnlyList<string> headers,
        IReadOnlyList<IReadOnlyList<string>> rows,
        bool leaveMaterialNumberEmpty = false)
    {
        var shared = new List<string>();
        int Intern(string value)
        {
            var index = shared.IndexOf(value);
            if (index >= 0)
            {
                return index;
            }

            shared.Add(value);
            return shared.Count - 1;
        }

        var sheet = new StringBuilder();
        sheet.Append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");
        sheet.Append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>""");
        WriteRow(sheet, 1, headers.Select(header => (header, Shared: true, Empty: false)).ToArray(), Intern);
        for (var i = 0; i < rows.Count; i++)
        {
            var line = rows[i];
            var cells = new List<(string Value, bool Shared, bool Empty)>(line.Count);
            for (var col = 0; col < line.Count; col++)
            {
                var emptyMaterial = leaveMaterialNumberEmpty && col == 1;
                var numeric = col == line.Count - 1 && decimal.TryParse(line[col], NumberStyles.Number, CultureInfo.InvariantCulture, out _);
                cells.Add((line[col], Shared: !numeric && !emptyMaterial, Empty: emptyMaterial));
            }

            WriteRow(sheet, i + 2, cells, Intern);
        }

        sheet.Append("</sheetData></worksheet>");

        var sst = new StringBuilder();
        sst.Append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");
        sst.Append(CultureInfo.InvariantCulture, $"""<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{shared.Count}" uniqueCount="{shared.Count}">""");
        foreach (var item in shared)
        {
            sst.Append("<si><t>").Append(System.Security.SecurityElement.Escape(item)).Append("</t></si>");
        }

        sst.Append("</sst>");

        var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            WriteEntry(archive, "xl/sharedStrings.xml", sst.ToString());
            WriteEntry(archive, "xl/worksheets/sheet1.xml", sheet.ToString());
        }

        stream.Position = 0;
        return stream;
    }

    private static void WriteRow(
        StringBuilder sheet,
        int rowNumber,
        IReadOnlyList<(string Value, bool Shared, bool Empty)> cells,
        Func<string, int> intern)
    {
        sheet.Append(CultureInfo.InvariantCulture, $"""<row r="{rowNumber}">""");
        for (var i = 0; i < cells.Count; i++)
        {
            var refer = $"{(char)('A' + i)}{rowNumber}";
            var cell = cells[i];
            if (cell.Empty)
            {
                sheet.Append(CultureInfo.InvariantCulture, $"""<c r="{refer}" s="3"/>""");
                continue;
            }

            if (cell.Shared)
            {
                sheet.Append(CultureInfo.InvariantCulture, $"""<c r="{refer}" t="s"><v>{intern(cell.Value)}</v></c>""");
                continue;
            }

            sheet.Append(CultureInfo.InvariantCulture, $"""<c r="{refer}"><v>{cell.Value}</v></c>""");
        }

        sheet.Append("</row>");
    }

    private static void WriteEntry(ZipArchive archive, string name, string xml)
    {
        var entry = archive.CreateEntry(name);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        writer.Write(xml);
    }
}
