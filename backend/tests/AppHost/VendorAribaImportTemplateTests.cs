using ClosedXML.Excel;
using IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Migration;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorAribaImportTemplateTests
{
    [Fact]
    public void CreateWritesTwoSampleVendorsAndMatchingChildRows()
    {
        using var workbook = new XLWorkbook(new MemoryStream(VendorAribaImportTemplate.Create()));

        Assert.Equal(
            ["Instructions", "Vendors", "Addresses", "Commodities", "KBLIs", "Brands", "Certificates", "Portfolios", "SpecialRequirements"],
            workbook.Worksheets.Select(sheet => sheet.Name).ToArray());

        var vendors = DataRows(workbook.Worksheet("Vendors"));
        Assert.Equal(2, vendors.Count);
        Assert.Equal(VendorAribaImportTemplate.SampleVendorId1, vendors[0]["AribaVendorId"]);
        Assert.Equal("PT Contoh Sparepart Nusantara", vendors[0]["VendorName"]);
        Assert.Equal("siti.rahayu@example.com", vendors[0]["PICEmail"]);
        Assert.Equal("1234567890123456", vendors[0]["NPWPNo"]);
        Assert.Equal("+62", vendors[0]["OfficePhoneCountry"]);
        Assert.Equal("+62", vendors[0]["HandphoneCountry"]);
        Assert.Equal("Indonesia", ChildValues(workbook, "Addresses", VendorAribaImportTemplate.SampleVendorId1, "Country")[0]);
        Assert.Equal("31.71", ChildValues(workbook, "Addresses", VendorAribaImportTemplate.SampleVendorId1, "CityCode")[0]);
        Assert.Equal(VendorAribaImportTemplate.SampleVendorId2, vendors[1]["AribaVendorId"]);
        Assert.Equal("CV Mitra Kalibrasi Mandiri", vendors[1]["VendorName"]);
        Assert.Equal("agus.pratama@example.com", vendors[1]["PICEmail"]);

        Assert.Equal(["OFFICE", "WAREHOUSE"], ChildValues(workbook, "Addresses", VendorAribaImportTemplate.SampleVendorId1, "AddressType"));
        Assert.Equal(["OFFICE", "WORKSHOP"], ChildValues(workbook, "Addresses", VendorAribaImportTemplate.SampleVendorId2, "AddressType"));
        Assert.Equal(["M.01.01", "M.01.04"], ChildValues(workbook, "Commodities", VendorAribaImportTemplate.SampleVendorId1, "SubClassificationCode"));
        Assert.Equal(["S.01.01"], ChildValues(workbook, "Commodities", VendorAribaImportTemplate.SampleVendorId2, "SubClassificationCode"));
        Assert.Equal(["27201"], ChildValues(workbook, "KBLIs", VendorAribaImportTemplate.SampleVendorId1, "KbliCode"));
        Assert.Equal(["0OL"], ChildValues(workbook, "KBLIs", VendorAribaImportTemplate.SampleVendorId1, "KbliTypeCode"));
        Assert.Equal(["T"], ChildValues(workbook, "KBLIs", VendorAribaImportTemplate.SampleVendorId1, "KbliStatusCode"));
        Assert.Equal(["DIST"], ChildValues(workbook, "Brands", VendorAribaImportTemplate.SampleVendorId1, "DistributorTypeCode"));
        Assert.Equal(["RSL"], ChildValues(workbook, "Brands", VendorAribaImportTemplate.SampleVendorId2, "DistributorTypeCode"));
        Assert.Equal(["IUJP"], ChildValues(workbook, "SpecialRequirements", VendorAribaImportTemplate.SampleVendorId1, "SpecialReqCode"));
        Assert.Equal(["SMK3"], ChildValues(workbook, "SpecialRequirements", VendorAribaImportTemplate.SampleVendorId2, "SpecialReqCode"));

        var instructions = workbook.Worksheet("Instructions").Cell(1, 1).GetString();
        Assert.Contains("sample rows", instructions, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("SAMPLE-001", workbook.Worksheet("Instructions").Cell(4, 1).GetString());
        var instructionText = string.Join('\n', workbook.Worksheet("Instructions").CellsUsed().Select(cell => cell.GetString()));
        Assert.Contains("inject", instructionText, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Office Address", instructionText, StringComparison.Ordinal);
    }

    [Fact]
    public void CreateDoesNotLeaveHeaderOnlySheets()
    {
        using var workbook = new XLWorkbook(new MemoryStream(VendorAribaImportTemplate.Create()));
        foreach (var name in new[] { "Vendors", "Addresses", "Commodities", "KBLIs", "Brands", "Certificates", "Portfolios", "SpecialRequirements" })
        {
            Assert.True(workbook.Worksheet(name).LastRowUsed()!.RowNumber() >= 3, $"{name} should include two sample rows.");
        }
    }

    private static List<Dictionary<string, string>> DataRows(IXLWorksheet sheet)
    {
        var headers = sheet.Row(1).CellsUsed()
            .ToDictionary(cell => cell.GetString().Replace("*", string.Empty, StringComparison.Ordinal), cell => cell.Address.ColumnNumber);
        var last = sheet.LastRowUsed()!.RowNumber();
        var rows = new List<Dictionary<string, string>>();
        for (var number = 2; number <= last; number++)
        {
            var row = sheet.Row(number);
            rows.Add(headers.ToDictionary(header => header.Key, header => row.Cell(header.Value).GetFormattedString().Trim()));
        }

        return rows;
    }

    private static string[] ChildValues(XLWorkbook workbook, string sheetName, string vendorId, string column) =>
        DataRows(workbook.Worksheet(sheetName))
            .Where(row => row["AribaVendorId"] == vendorId)
            .Select(row => row[column])
            .ToArray();
}
