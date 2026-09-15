using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations;

[DbContext(typeof(ProcurementDbContext))]
[Migration("20260827040000_AddVendorPortfolioEnteredByParty")]
public class AddVendorPortfolioEnteredByParty : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "EnteredByParty",
            schema: "vdr",
            table: "VENDOR_PORTFOLIO_T",
            type: "nvarchar(16)",
            maxLength: 16,
            nullable: false,
            defaultValue: "Vendor");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "EnteredByParty",
            schema: "vdr",
            table: "VENDOR_PORTFOLIO_T");
    }
}
