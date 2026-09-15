using System.IO.Compression;
using System.Text;
using IntegratedProcurement.Platform.Documents.Application;
using IntegratedProcurement.Platform.Documents.Infrastructure;
using Microsoft.Extensions.Options;
using Xunit;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class ContractTemplateMergeTests
{
    private static string TemplatesRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "AppHost", "ContractTemplates");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate src/AppHost/ContractTemplates from the test output.");
    }

    private static string ReadDocumentXml(byte[] docx)
    {
        using var archive = new ZipArchive(new MemoryStream(docx), ZipArchiveMode.Read);
        var entry = archive.GetEntry("word/document.xml")!;
        using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
        return reader.ReadToEnd();
    }

    private static DocxTemplateMerger Merger() =>
        new(Options.Create(new ContractTemplateOptions { RootPath = TemplatesRoot() }));

    [Fact]
    public async Task JasaTemplateExistsAndExposesTokens()
    {
        var merger = Merger();
        Assert.True(merger.TemplateExists("03-perjanjian-jasa-nonkonsultan"));

        var tokens = await merger.TokensInTemplateAsync("03-perjanjian-jasa-nonkonsultan", CancellationToken.None);
        Assert.Contains("NAMA_VENDOR", tokens);
        Assert.Contains("TGL_MULAI", tokens);
        Assert.Contains("ENTITAS_SIS", tokens);
    }

    [Fact]
    public async Task MergingFillsAllTokensAndEscapesXml()
    {
        var tokens = new Dictionary<string, string>
        {
            ["OBJEK_JASA"] = "Program Leadership Assessment",
            ["NOMOR_KONTRAK"] = "CTR/147-SHL-TBS-X-2020",
            ["TGL_TTD"] = "1 Juli 2026",
            ["ENTITAS_SIS"] = "Saptaindra Sejati",
            ["DOMISILI_PIHAK1"] = "Jakarta Selatan",
            ["NAMA_TTD_PIHAK1"] = "Budi Santoso",
            ["NAMA_TTD_PIHAK1_2"] = "Andi Wijaya",
            ["JABATAN_TTD_PIHAK1"] = "Direktur Utama",
            ["JABATAN_TTD_PIHAK1_2"] = "Direktur",
            ["NAMA_VENDOR"] = "PT ESHAEL INDONESIA & Mitra",
            ["DOMISILI_VENDOR"] = "Jakarta Pusat",
            ["NAMA_TTD_VENDOR"] = "Ratih Pertiwi",
            ["JABATAN_TTD_VENDOR"] = "Direktur",
            ["LOKASI_JASA"] = "JAHO",
            ["TGL_MULAI"] = "1 Januari 2026",
            ["TGL_SELESAI"] = "31 Desember 2026",
        };

        var docx = await Merger().MergeAsync("03-perjanjian-jasa-nonkonsultan", tokens, CancellationToken.None);
        var xml = ReadDocumentXml(docx);

        Assert.DoesNotContain("{{", xml);                                   // every token replaced
        Assert.Contains("Program Leadership Assessment", xml);
        Assert.Contains("PT ESHAEL INDONESIA &amp; Mitra", xml);            // value with & is XML-escaped
        Assert.Contains("1 Januari 2026", xml);
    }

    // The full set of tokens the CIP frontend builder supplies for every template.
    private static readonly Dictionary<string, string> AllBuilderTokens = new()
    {
        ["NOMOR_KONTRAK"] = "CTR/SAMPLE-001", ["OBJEK_JASA"] = "Jasa Contoh", ["TGL_TTD"] = "1 Juli 2026",
        ["TGL_MULAI"] = "1 Januari 2026", ["TGL_SELESAI"] = "31 Desember 2026", ["LOKASI_JASA"] = "JAHO",
        ["ENTITAS_SIS"] = "Saptaindra Sejati", ["DOMISILI_PIHAK1"] = "Jakarta Selatan",
        ["NAMA_TTD_PIHAK1"] = "Budi Santoso", ["JABATAN_TTD_PIHAK1"] = "Direktur Utama",
        ["NAMA_TTD_PIHAK1_2"] = "Andi Wijaya", ["JABATAN_TTD_PIHAK1_2"] = "Direktur",
        ["NAMA_VENDOR"] = "PT Vendor Contoh", ["DOMISILI_VENDOR"] = "Jakarta Pusat",
        ["NAMA_TTD_VENDOR"] = "Ratih Pertiwi", ["JABATAN_TTD_VENDOR"] = "Direktur",
    };

    public static IEnumerable<object[]> AllTemplateKeys() =>
        Directory.GetFiles(TemplatesRoot(), "*.docx")
            .Select(p => new object[] { Path.GetFileNameWithoutExtension(p) });

    [Theory]
    [MemberData(nameof(AllTemplateKeys))]
    public async Task EveryTemplateMergesWithNoLeftoverTokens(string templateKey)
    {
        var merger = Merger();

        // Every token the template carries must be supplied by the builder set.
        var templateTokens = await merger.TokensInTemplateAsync(templateKey, CancellationToken.None);
        var uncovered = templateTokens.Where(t => !AllBuilderTokens.ContainsKey(t)).ToArray();
        Assert.Empty(uncovered);

        // Merging with the full builder set leaves no raw {{TOKEN}} anywhere in the body.
        var docx = await merger.MergeAsync(templateKey, AllBuilderTokens, CancellationToken.None);
        Assert.DoesNotContain("{{", ReadDocumentXml(docx));
    }
}
