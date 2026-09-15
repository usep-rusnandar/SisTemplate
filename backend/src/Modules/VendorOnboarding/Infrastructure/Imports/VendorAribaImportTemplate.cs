using ClosedXML.Excel;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Migration;

/// <summary>
/// Operational Ariba workbook: headers plus two filled sample vendors so officers
/// can copy format, codes, and date patterns instead of guessing.
/// </summary>
public static class VendorAribaImportTemplate
{
    public const string SampleVendorId1 = "SAMPLE-001";
    public const string SampleVendorId2 = "SAMPLE-002";

    public static byte[] Create()
    {
        using var workbook = new XLWorkbook();
        AddInstructions(workbook);
        AddSheet(workbook, "Vendors",
        [
            "AribaVendorId*", "VendorName*", "PICName*", "PICEmail*", "Position",
            "OfficePhoneCountry", "OfficePhoneArea", "OfficePhoneNumber", "HandphoneCountry", "HandphoneNumber", "WebAddress",
            "NPWPNo", "NIBNo", "AktaPendirianNo", "AktaPendirianDate", "AktaPerubahanNo", "AktaPerubahanDate",
            "AktaPenyesuaianNo", "AktaPenyesuaianDate", "SPPKPNo", "AribaStatus", "SourceUpdatedAt", "IsActive"
        ],
        [
            SampleVendorId1, "PT Contoh Sparepart Nusantara", "Siti Rahayu", "siti.rahayu@example.com", "Operational Manager",
            "+62", "21", "5551234", "+62", "81234567890", "https://contoh-sparepart.example.com",
            "1234567890123456", "1234567890123", "AHU-001.AH.01.01-2020", "2020-01-15", "AHU-088.AH.01.03-2022", "2022-06-01",
            "", "", "SPPKP-001", "Registered", "2026-08-01T09:00:00+07:00", "TRUE"
        ],
        [
            SampleVendorId2, "CV Mitra Kalibrasi Mandiri", "Agus Pratama", "agus.pratama@example.com", "Director",
            "+62", "22", "3987654", "+62", "81398765432", "https://mitra-kalibrasi.example.com",
            "9876543210987654", "9876543210987", "AHU-002.AH.01.01-2018", "2018-03-20", "", "",
            "", "", "SPPKP-002", "Registered", "2026-07-15T14:30:00+07:00", "TRUE"
        ]);
        AddSheet(workbook, "Addresses",
            ["AribaVendorId*", "AddressType*", "Address", "AddressCode", "ProvinceCode", "CityCode", "DistrictCode", "VillageCode", "PostCode", "Country", "Latitude", "Longitude"],
            [SampleVendorId1, "OFFICE", "Jl. Jenderal Sudirman Kav. 52-53", "", "31", "31.71", "", "", "12190", "Indonesia", "-6.224572", "106.809776"],
            [SampleVendorId1, "WAREHOUSE", "Kawasan Industri MM2100 Blok G-12", "", "32", "32.75", "", "", "17520", "Indonesia", "-6.270100", "107.082400"],
            [SampleVendorId2, "OFFICE", "Jl. Asia Afrika No. 8", "", "32", "32.73", "", "", "40111", "Indonesia", "-6.921012", "107.607142"],
            [SampleVendorId2, "WORKSHOP", "Jl. Soekarno-Hatta No. 590", "", "32", "32.73", "", "", "40286", "Indonesia", "-6.943210", "107.638900"]);
        AddSheet(workbook, "Commodities",
            ["AribaVendorId*", "SubClassificationCode*"],
            [SampleVendorId1, "M.01.01"],
            [SampleVendorId1, "M.01.04"],
            [SampleVendorId2, "S.01.01"]);
        AddSheet(workbook, "KBLIs",
            ["AribaVendorId*", "KbliTypeCode", "KbliCode*", "KbliStatusCode"],
            [SampleVendorId1, "0OL", "27201", "T"],
            [SampleVendorId2, "0OL", "33131", "T"]);
        AddSheet(workbook, "Brands",
            ["AribaVendorId*", "BrandName*", "DistributorTypeCode", "ExpireDate"],
            [SampleVendorId1, "Exide", "DIST", "2028-12-31"],
            [SampleVendorId2, "Fluke", "RSL", "2027-06-30"]);
        AddSheet(workbook, "Certificates",
            ["AribaVendorId*", "CertificateNumber*", "Description", "ExpireDate"],
            [SampleVendorId1, "ISO-9001-2024", "ISO 9001:2015", "2028-12-31"],
            [SampleVendorId2, "ISO-17025-2023", "ISO/IEC 17025", "2027-12-31"]);
        AddSheet(workbook, "Portfolios",
            ["AribaVendorId*", "Client*", "ScopeOfWork", "TotalValue", "ContractStartDate*", "ContractEndDate*"],
            [SampleVendorId1, "PT Tambang Contoh", "Supply of batteries and electrical parts", "1500000000", "2024-01-01", "2025-12-31"],
            [SampleVendorId2, "PT PLTU Contoh", "Calibration of measuring instruments", "450000000", "2025-03-01", "2026-02-28"]);
        AddSheet(workbook, "SpecialRequirements",
            ["AribaVendorId*", "SpecialReqCode*", "Number", "Description", "ExpireDate"],
            [SampleVendorId1, "IUJP", "IUJP-2024-001", "Izin Usaha Jasa Pertambangan", "2028-12-31"],
            [SampleVendorId2, "SMK3", "SMK3-2023-014", "Sistem Manajemen Keselamatan dan Kesehatan Kerja", "2027-12-31"]);

        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return output.ToArray();
    }

    private static void AddInstructions(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.Add("Instructions");
        sheet.Cell(1, 1).Value = "Ariba vendor import — sample rows";
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 14;
        sheet.Cell(1, 1).Style.Font.FontColor = XLColor.FromHtml("#013B52");

        var lines = new[]
        {
            "",
            "English",
            "Sheets Vendors, Addresses, Commodities, KBLIs, Brands, Certificates, Portfolios, and SpecialRequirements already contain two example vendors (SAMPLE-001 and SAMPLE-002).",
            "Copy the pattern: required columns are marked with *. Dates use YYYY-MM-DD. Date-times use ISO-8601 (WIB offset +07:00). NPWP is 16 digits when supplied (15-digit values warn, they do not block). IsActive is TRUE or FALSE.",
            "Child sheets must reuse the same AribaVendorId. Preferred AddressType is OFFICE, WAREHOUSE, or WORKSHOP; phone country is a dial code such as +62; address Country is Indonesia; wilayah and commodity columns prefer Master Data codes.",
            "Officer Ariba inject workbooks are also accepted. The importer normalizes Office Address, province/city names, packed KBLI cells (semicolon-separated), commodity values such as 'S.17.01 Air Freight', dial digits 62, Excel date serials, and a missing OfficePhoneArea column. Extra columns such as Ariba UNSPSC are ignored. PIC emails already used by an INITL vendor overwrite that vendor; any other status, and already-imported Ariba ids, are skipped and do not block Commit.",
            "Replace or delete the SAMPLE-* rows before you import real vendors. Uploading the examples as-is will create two dummy INITL vendors.",
            "",
            "Bahasa Indonesia",
            "Sheet Vendors, Addresses, Commodities, KBLIs, Brands, Certificates, Portfolios, dan SpecialRequirements sudah berisi dua contoh vendor (SAMPLE-001 dan SAMPLE-002).",
            "Ikuti pola isian: kolom wajib ditandai *. Tanggal memakai YYYY-MM-DD. Date-time memakai ISO-8601 (offset WIB +07:00). NPWP 16 digit jika diisi (15 digit hanya peringatan, tidak memblokir). IsActive bernilai TRUE atau FALSE.",
            "Sheet turunan harus memakai AribaVendorId yang sama. AddressType yang disarankan: OFFICE, WAREHOUSE, atau WORKSHOP. Kode telepon: +62. Country alamat: Indonesia. Kolom wilayah dan komoditas lebih baik memakai kode Master Data.",
            "Workbook inject Ariba dari officer juga diterima. Importer menormalisasi Office Address, nama provinsi/kota, sel KBLI yang digabung (pisah titik koma), komoditas 'S.17.01 Air Freight', digit dial 62, serial tanggal Excel, dan kolom OfficePhoneArea yang tidak ada. Kolom tambahan seperti Ariba UNSPSC diabaikan. PIC email yang sudah dipakai vendor INITL menimpa data vendor itu; status lain dan Ariba id yang sudah diimpor dilewati dan tidak memblokir Commit.",
            "Ganti atau hapus baris SAMPLE-* sebelum mengimpor vendor asli. Jika contoh diunggah apa adanya, sistem akan membuat dua vendor dummy berstatus INITL.",
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
        sheet.Row(4).Height = 48;
        sheet.Row(5).Height = 48;
        sheet.Row(6).Height = 60;
        sheet.Row(7).Height = 72;
        sheet.Row(8).Height = 36;
        sheet.Row(11).Height = 48;
        sheet.Row(12).Height = 48;
        sheet.Row(13).Height = 60;
        sheet.Row(14).Height = 72;
        sheet.Row(15).Height = 36;
        sheet.SheetView.FreezeRows(1);
    }

    private static void AddSheet(XLWorkbook workbook, string name, string[] headers, params string[][] samples)
    {
        var sheet = workbook.Worksheets.Add(name);
        for (var i = 0; i < headers.Length; i++)
        {
            sheet.Cell(1, i + 1).Value = headers[i];
        }

        var header = sheet.Range(1, 1, 1, headers.Length);
        header.Style.Font.Bold = true;
        header.Style.Font.FontColor = XLColor.White;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#0F828A");
        sheet.SheetView.FreezeRows(1);

        for (var row = 0; row < samples.Length; row++)
        {
            var sample = samples[row];
            if (sample.Length != headers.Length)
            {
                throw new InvalidOperationException($"Template sheet '{name}' sample row {row + 1} has {sample.Length} cells; expected {headers.Length}.");
            }

            for (var i = 0; i < sample.Length; i++)
            {
                sheet.Cell(row + 2, i + 1).Value = sample[i];
            }
        }

        for (var i = 0; i < headers.Length; i++)
        {
            var sampleWidth = samples.Length == 0 ? 0 : samples.Max(sample => sample[i].Length);
            sheet.Column(i + 1).Width = Math.Clamp(Math.Max(headers[i].Length, sampleWidth) + 2, 12, 42);
        }
    }
}
