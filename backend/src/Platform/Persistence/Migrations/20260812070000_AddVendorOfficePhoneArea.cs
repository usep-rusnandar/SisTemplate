using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations;

[DbContext(typeof(ProcurementDbContext))]
[Migration("20260812070000_AddVendorOfficePhoneArea")]
public class AddVendorOfficePhoneArea : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "OfficePhoneArea",
            schema: "vdr",
            table: "VENDOR_T",
            type: "nvarchar(8)",
            maxLength: 8,
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "OfficePhoneArea",
            schema: "vdr",
            table: "VENDOR_T");
    }
}
