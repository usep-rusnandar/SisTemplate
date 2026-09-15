using System.Net;
using System.Net.Http.Json;
using ClosedXML.Excel;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class VendorDatabaseExportEndpointTests : IClassFixture<IsolatedApiFixture>
{
    private readonly IsolatedApiFixture _fixture;

    public VendorDatabaseExportEndpointTests(IsolatedApiFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task ExportReturnsFilteredFormattedWorkbook()
    {
        var vendor = Vendor.Register("PT EXCEL EXPORT TEST", VendorStatuses.Draft, "integration-test");
        vendor.UpdateContact("Procurement Manager", "+62", "21", "5550100", "+62", "8125550100", "https://excel-export.test");
        vendor.SetOfficeAddress(VendorAddress.Create(
            "Jl. Export No. 1", null, null, null, null, null, "12950", "Indonesia", null, null));
        vendor.UpdateLegal("001234567890000", "0001234567890", "AKTA-01", null, "AKTA-02", null, null, null, "SPPKP-01");

        using (var scope = _fixture.Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
            dbContext.Vendors.Add(vendor);
            await dbContext.SaveChangesAsync();
        }

        using var client = _fixture.CreateClient();
        await DevLoginAsync(client, "00109610");
        using var response = await client.GetAsync(
            "/api/v1/vendor-onboarding/vendors/database/export?search=EXCEL%20EXPORT%20TEST&status=DRAFT&language=en");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            response.Content.Headers.ContentType?.MediaType);
        Assert.StartsWith("Vendor-Database-", response.Content.Headers.ContentDisposition?.FileNameStar);
        Assert.EndsWith(".xlsx", response.Content.Headers.ContentDisposition?.FileNameStar);

        var content = await response.Content.ReadAsByteArrayAsync();
        Assert.NotEmpty(content);
        using var workbook = new XLWorkbook(new MemoryStream(content));
        var sheet = workbook.Worksheet("Vendor Database");

        Assert.Equal("Vendor Database", sheet.Cell(1, 1).GetString());
        Assert.Equal("Vendor ID", sheet.Cell(5, 1).GetString());
        Assert.Equal("Certificate Description", sheet.Cell(5, 26).GetString());
        Assert.Equal(vendor.Id, sheet.Cell(6, 1).GetString());
        Assert.Equal("PT EXCEL EXPORT TEST", sheet.Cell(6, 2).GetString());
        Assert.Equal("Procurement Manager", sheet.Cell(6, 6).GetString());
        Assert.Equal("Jl. Export No. 1", sheet.Cell(6, 11).GetString());
        Assert.Equal("001234567890000", sheet.Cell(6, 14).GetString());
        Assert.Equal(26, Assert.Single(sheet.Tables).ColumnCount());
        Assert.True(Assert.Single(sheet.Tables).ShowAutoFilter);
        Assert.All(sheet.CellsUsed(), cell => Assert.True(string.IsNullOrEmpty(cell.FormulaA1)));
    }

    private static async Task DevLoginAsync(HttpClient client, string personnelNo)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
