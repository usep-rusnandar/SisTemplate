using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.ArchitectureTests;

public sealed class BrandMasterImportTests
{
    [Fact]
    public void Plan_SkipsExistingCaseInsensitively_AndDedupesFile()
    {
        var source = new BrandMasterImportSourceRow[]
        {
            new(2, "  NEW-BRAND  "),
            new(3, "3M"),
            new(4, "new-brand"),
            new(5, "Another"),
            new(6, ""),
            new(7, new string('X', 51)),
        };

        var plan = BrandMasterImport.Plan(source, ["3m", "ABB"]);

        Assert.Equal(2, plan.Created);
        Assert.Equal(1, plan.SkippedExisting);
        Assert.Equal(1, plan.SkippedDuplicate);
        Assert.Equal(2, plan.Invalid);
        Assert.Equal("NEW-BRAND", plan.Rows[0].Name);
        Assert.Equal(BrandMasterImportOutcome.Created, plan.Rows[0].Outcome);
        Assert.Equal(BrandMasterImportOutcome.SkippedExisting, plan.Rows[1].Outcome);
        Assert.Equal(BrandMasterImportOutcome.SkippedDuplicate, plan.Rows[2].Outcome);
        Assert.Equal(["NEW-BRAND", "Another"], plan.RecordsToCreate().Select(record => record.Code).ToArray());
    }

    [Fact]
    public void ReadSourceRows_UsesBrandNameHeader()
    {
        var rows = BrandMasterImport.ReadSourceRows(
        [
            ["Ignore", "BrandName"],
            ["x", "CAT"],
            ["", ""],
            ["x", "HITACHI"],
        ]);

        Assert.Equal(2, rows.Count);
        Assert.Equal(2, rows[0].RowNumber);
        Assert.Equal("CAT", rows[0].Raw);
        Assert.Equal(4, rows[1].RowNumber);
        Assert.Equal("HITACHI", rows[1].Raw);
    }

    [Fact]
    public void ReadSourceRows_WithoutHeader_UsesFirstColumn()
    {
        var rows = BrandMasterImport.ReadSourceRows(
        [
            ["SHELL"],
            ["PERTAMINA"],
        ]);

        Assert.Equal(2, rows.Count);
        Assert.Equal(1, rows[0].RowNumber);
        Assert.Equal("SHELL", rows[0].Raw);
    }

    [Fact]
    public void ReadCsv_AcceptsBomAndSemicolon()
    {
        var csv = "\uFEFFNama Merek;Extra\nKOMATSU;note\n";
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(csv));
        var rows = BrandMasterImport.ReadCsv(stream);
        var row = Assert.Single(rows);
        Assert.Equal(2, row.RowNumber);
        Assert.Equal("KOMATSU", row.Raw);
    }
}
