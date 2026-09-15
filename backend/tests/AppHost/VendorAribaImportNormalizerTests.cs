using ClosedXML.Excel;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Migration;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorAribaImportNormalizerTests
{
    [Theory]
    [InlineData("Office Address", "OFFICE")]
    [InlineData("OFFICE", "OFFICE")]
    [InlineData("Kantor", "OFFICE")]
    [InlineData("Warehouse", "WAREHOUSE")]
    [InlineData("Workshop", "WORKSHOP")]
    public void AddressTypeMapsInjectLabels(string raw, string expected) =>
        Assert.Equal(expected, VendorAribaImportNormalizer.AddressType(raw));

    [Theory]
    [InlineData("ID", "Indonesia")]
    [InlineData("IDN", "Indonesia")]
    [InlineData("Indonesia", "Indonesia")]
    [InlineData("", "Indonesia")]
    public void AddressCountryMapsToUiName(string raw, string expected) =>
        Assert.Equal(expected, VendorAribaImportNormalizer.AddressCountry(raw));

    [Theory]
    [InlineData("62", "+62")]
    [InlineData("+62", "+62")]
    [InlineData("ID", "+62")]
    [InlineData("65", "+65")]
    public void PhoneCountryMapsDialDigits(string raw, string expected) =>
        Assert.Equal(expected, VendorAribaImportNormalizer.PhoneCountry(raw));

    [Fact]
    public void OfficePhoneMovesAreaCodeOutOfCountryColumn()
    {
        var jakarta = VendorAribaImportNormalizer.OfficePhone("021", "", "5551234");
        Assert.Equal("+62", jakarta.Country);
        Assert.Equal("21", jakarta.Area);
        Assert.Equal("5551234", jakarta.Number);

        var balikpapan = VendorAribaImportNormalizer.OfficePhone("0542", null, "123456");
        Assert.Equal("+62", balikpapan.Country);
        Assert.Equal("542", balikpapan.Area);

        var stripped = VendorAribaImportNormalizer.OfficePhone("21", "", "5551234");
        Assert.Equal("+62", stripped.Country);
        Assert.Equal("21", stripped.Area);

        var calling = VendorAribaImportNormalizer.OfficePhone("62", "", "218000111");
        Assert.Equal("+62", calling.Country);
        Assert.Equal("", calling.Area);
        Assert.Equal("218000111", calling.Number);
    }

    [Fact]
    public void CommodityCodeStripsDescription() =>
        Assert.Equal("S.17.01", VendorAribaImportNormalizer.CommodityCode("S.17.01 Air Freight"));

    [Fact]
    public void KbliCodesSplitsPackedCell() =>
        Assert.Equal(["46691", "46591", "46599", "46631"],
            VendorAribaImportNormalizer.KbliCodes("46691;46591;46599;46631;"));

    [Fact]
    public void WebAddressAddsHttps() =>
        Assert.Equal("https://www.ckb.co.id", VendorAribaImportNormalizer.WebAddress("www.ckb.co.id"));

    [Fact]
    public void DateReadsExcelSerial() =>
        Assert.Equal(DateOnly.FromDateTime(DateTime.FromOADate(35559)), VendorAribaImportNormalizer.Date("35559"));

    [Fact]
    public void CatalogResolvesInjectCityNames()
    {
        var catalog = TestCatalog();
        var south = catalog.ResolveAddress("DKI JAKARTA", "JAKARTA SELATAN", "SETIABUDI", "");
        Assert.Equal("31", south.ProvinceCode);
        Assert.Equal("31.74", south.CityCode);
        Assert.Equal("31.74.01", south.DistrictCode);

        var kabTangerang = catalog.ResolveAddress("BANTEN", "KABUPATEN TANGERANG", "", "");
        Assert.Equal("36", kabTangerang.ProvinceCode);
        Assert.Equal("36.03", kabTangerang.CityCode);

        var bekasi = catalog.ResolveAddress("JAWA BARAT", "BEKASI", "", "");
        Assert.Equal("32", bekasi.ProvinceCode);
        Assert.Equal("32.75", bekasi.CityCode);

        var dotted = catalog.ResolveAddress("31", "3174", "", "");
        Assert.Equal("31", dotted.ProvinceCode);
        Assert.Equal("31.74", dotted.CityCode);
    }

    [Fact]
    public void ParserNormalizesOfficerShapedWorkbook()
    {
        var bytes = OfficerWorkbook();
        var parsed = VendorAribaImportWorkbookParser.Parse(bytes, TestCatalog());
        Assert.Single(parsed);

        var payload = parsed[0].Payload;
        Assert.Equal("S27718751", payload.AribaVendorId);
        Assert.Equal("dewi.karmilawati@ckb.co.id", payload.PicEmail);
        Assert.Equal("+62", payload.OfficePhoneCountry);
        Assert.Equal("21", payload.OfficePhoneArea);
        Assert.Equal("5551234", payload.OfficePhoneNumber);
        Assert.Equal("+62", payload.HandphoneCountry);
        Assert.Equal("https://www.ckb.co.id", payload.WebAddress);
        Assert.Equal("123456789012345", payload.NpwpNo);
        Assert.Equal(DateOnly.FromDateTime(DateTime.FromOADate(35559)), payload.AktaPendirianDate);

        var office = Assert.Single(payload.Addresses);
        Assert.Equal("OFFICE", office.Type);
        Assert.Equal("Indonesia", office.Country);
        Assert.Equal("31", office.ProvinceCode);
        Assert.Equal("31.74", office.CityCode);

        Assert.Equal(["S.17.01", "M.99.99"], payload.SubClassifications);
        Assert.Equal(["46691", "46591", "46599"], payload.Kblis.Select(item => item.Code).ToArray());
        Assert.Equal("SEDUS", Assert.Single(payload.Brands).Name);
        Assert.DoesNotContain(parsed[0].Notes, note => note.Level == "error");
        Assert.Contains(parsed[0].Notes, note =>
            note.Level == "warning" && note.Field == "Commodities" && note.Message.Contains("M.99.99", StringComparison.Ordinal));
    }

    [Fact]
    public void ParserAcceptsCanonicalTemplateBytes()
    {
        var parsed = VendorAribaImportWorkbookParser.Parse(VendorAribaImportTemplate.Create(), TestCatalog());
        Assert.Equal(2, parsed.Count);
        var first = parsed[0].Payload;
        Assert.Equal(VendorAribaImportTemplate.SampleVendorId1, first.AribaVendorId);
        Assert.Equal("+62", first.OfficePhoneCountry);
        Assert.Contains(first.Addresses, address => address.Type == "OFFICE" && address.Country == "Indonesia");
        Assert.Contains("M.01.01", first.SubClassifications);
    }

    [Fact]
    public void AlreadyImportedAribaIdIsSkippedWhenEmailIsNew()
    {
        var existing = new VendorAribaExistingVendor("VEND000001", VendorStatuses.Initial);
        var decision = VendorAribaImportIdentityRules.Decide(null, existing, emailTaken: false);
        Assert.Equal(VendorAribaImportDisposition.Skip, decision.Disposition);
        Assert.Contains(decision.Issues, issue => issue.Level == "warning" && issue.Field == "AribaVendorId");
        Assert.DoesNotContain(decision.Issues, issue => issue.Level == "error");
    }

    [Fact]
    public void TakenInitlEmailOverwritesExistingVendor()
    {
        var existing = new VendorAribaExistingVendor("VEND000001", VendorStatuses.Initial);
        var decision = VendorAribaImportIdentityRules.Decide(existing, existing, emailTaken: true);
        Assert.Equal(VendorAribaImportDisposition.Overwrite, decision.Disposition);
        Assert.Equal("VEND000001", decision.TargetVendorId);
        Assert.Contains(decision.Issues, issue =>
            issue.Level == "warning" && issue.Field == "PICEmail" && issue.Message.Contains("overwritten", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(decision.Issues, issue => issue.Level == "error");
    }

    [Theory]
    [InlineData(VendorStatuses.Invited)]
    [InlineData(VendorStatuses.Draft)]
    [InlineData(VendorStatuses.Submitted)]
    [InlineData(VendorStatuses.Registered)]
    public void TakenNonInitlEmailIsSkipped(string status)
    {
        var existing = new VendorAribaExistingVendor("VEND000001", status);
        var decision = VendorAribaImportIdentityRules.Decide(existing, null, emailTaken: true);
        Assert.Equal(VendorAribaImportDisposition.Skip, decision.Disposition);
        Assert.Contains(decision.Issues, issue => issue.Level == "warning" && issue.Field == "PICEmail");
        Assert.DoesNotContain(decision.Issues, issue => issue.Level == "error");
    }

    [Fact]
    public void TakenEmailWithoutVendorLinkIsSkipped()
    {
        var decision = VendorAribaImportIdentityRules.Decide(null, null, emailTaken: true);
        Assert.Equal(VendorAribaImportDisposition.Skip, decision.Disposition);
        Assert.Contains(decision.Issues, issue => issue.Message == VendorAribaImportIdentityRules.TakenEmailSkipMessage);
        Assert.DoesNotContain(decision.Issues, issue => issue.Level == "error");
    }

    [Fact]
    public void InitlEmailAndDifferentAribaVendorIsSkipped()
    {
        var byEmail = new VendorAribaExistingVendor("VEND000001", VendorStatuses.Initial);
        var byAriba = new VendorAribaExistingVendor("VEND000002", VendorStatuses.Initial);
        var decision = VendorAribaImportIdentityRules.Decide(byEmail, byAriba, emailTaken: true);
        Assert.Equal(VendorAribaImportDisposition.Skip, decision.Disposition);
        Assert.Contains(decision.Issues, issue => issue.Message.Contains("VEND000002", StringComparison.Ordinal));
        Assert.DoesNotContain(decision.Issues, issue => issue.Level == "error");
    }

    private static VendorAribaImportCatalog TestCatalog() => new(
        [
            new("31", "DKI JAKARTA", null),
            new("32", "JAWA BARAT", null),
            new("36", "BANTEN", null),
        ],
        [
            new("31.71", "KOTA ADM. JAKARTA PUSAT", "31"),
            new("31.74", "KOTA ADM. JAKARTA SELATAN", "31"),
        ],
        [new("31.74.01", "Setiabudi", "31.74")],
        [],
        ["S.17.01", "M.13.02", "M.01.01", "M.01.04", "S.01.01"],
        ["+62", "+65"]);

    private static byte[] OfficerWorkbook()
    {
        using var workbook = new XLWorkbook();
        var vendors = workbook.Worksheets.Add("Vendors");
        var vendorHeaders = new[]
        {
            "AribaVendorId*", "VendorName*", "PICName*", "PICEmail*", "Position",
            "OfficePhoneCountry", "OfficePhoneNumber", "HandphoneCountry", "HandphoneNumber", "WebAddress",
            "NPWPNo", "NIBNo", "AktaPendirianNo", "AktaPendirianDate", "AktaPerubahanNo", "AktaPerubahanDate",
            "AktaPenyesuaianNo", "AktaPenyesuaianDate", "SPPKPNo", "AribaStatus", "SourceUpdatedAt", "IsActive"
        };
        for (var i = 0; i < vendorHeaders.Length; i++) vendors.Cell(1, i + 1).Value = vendorHeaders[i];
        vendors.Cell(2, 1).Value = "S27718751";
        vendors.Cell(2, 2).Value = "PT CIPTA KRIDA BAHARI";
        vendors.Cell(2, 3).Value = "DEWI KARMILAWATI";
        vendors.Cell(2, 4).Value = "dewi.karmilawati@ckb.co.id";
        vendors.Cell(2, 6).Value = "021";
        vendors.Cell(2, 7).Value = "5551234";
        vendors.Cell(2, 8).Value = "62";
        vendors.Cell(2, 9).Value = "8115113366";
        vendors.Cell(2, 10).Value = "www.ckb.co.id";
        vendors.Cell(2, 11).Value = "123456789012345";
        vendors.Cell(2, 12).Value = "8120004851805";
        vendors.Cell(2, 13).Value = "57";
        vendors.Cell(2, 14).Value = 35559;
        vendors.Cell(2, 20).Value = "Registered";

        var addresses = workbook.Worksheets.Add("Addresses");
        var addressHeaders = new[]
        {
            "AribaVendorId*", "AddressType*", "Address", "AddressCode", "ProvinceCode", "CityCode",
            "DistrictCode", "VillageCode", "PostCode", "Country", "Latitude", "Longitude"
        };
        for (var i = 0; i < addressHeaders.Length; i++) addresses.Cell(1, i + 1).Value = addressHeaders[i];
        addresses.Cell(2, 1).Value = "S27718751";
        addresses.Cell(2, 2).Value = "Office Address";
        addresses.Cell(2, 3).Value = "JL. PULO AYANG KAV R-1";
        addresses.Cell(2, 5).Value = "DKI JAKARTA";
        addresses.Cell(2, 6).Value = "JAKARTA SELATAN";
        addresses.Cell(2, 7).Value = "SETIABUDI";
        addresses.Cell(2, 9).Value = "12190";
        addresses.Cell(2, 10).Value = "Indonesia";

        var commodities = workbook.Worksheets.Add("Commodities");
        commodities.Cell(1, 1).Value = "AribaVendorId*";
        commodities.Cell(1, 2).Value = "Ariba UNSPSC";
        commodities.Cell(1, 3).Value = "SubClassificationCode*";
        commodities.Cell(2, 1).Value = "S27718751";
        commodities.Cell(2, 3).Value = "S.17.01 Air Freight";
        commodities.Cell(3, 1).Value = "S27718751";
        commodities.Cell(3, 3).Value = "M.99.99 Not In Catalog";

        var kblis = workbook.Worksheets.Add("KBLIs");
        kblis.Cell(1, 1).Value = "AribaVendorId*";
        kblis.Cell(1, 2).Value = "KbliTypeCode";
        kblis.Cell(1, 3).Value = "KbliCode*";
        kblis.Cell(1, 4).Value = "KbliStatusCode";
        kblis.Cell(2, 1).Value = "S27718751";
        kblis.Cell(2, 3).Value = "46691;46591;46599";

        var brands = workbook.Worksheets.Add("Brands");
        brands.Cell(1, 1).Value = "AribaVendorId*";
        brands.Cell(1, 2).Value = "BrandName*";
        brands.Cell(1, 3).Value = "DistributorTypeCode";
        brands.Cell(1, 4).Value = "ExpireDate";
        brands.Cell(2, 1).Value = "S27718751";
        brands.Cell(2, 2).Value = "SEDUS";

        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return output.ToArray();
    }
}
