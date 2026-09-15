using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations;

[DbContext(typeof(ProcurementDbContext))]
[Migration("20260813080000_AddVendorUserWorkspacePic")]
public class AddVendorUserWorkspacePic : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsWorkspacePic",
            schema: "vdr",
            table: "VENDOR_USER_T",
            type: "bit",
            nullable: false,
            defaultValue: false);

        // Existing sole contact per vendor becomes the Vendor Workspace PIC.
        migrationBuilder.Sql("""
            ;WITH ranked AS (
                SELECT VendorUserId,
                       ROW_NUMBER() OVER (
                           PARTITION BY VendorId
                           ORDER BY CASE WHEN IdentityUserId = VendorId THEN 0 ELSE 1 END, VendorUserId
                       ) AS rn
                FROM vdr.VENDOR_USER_T
            )
            UPDATE u
            SET IsWorkspacePic = 1
            FROM vdr.VENDOR_USER_T AS u
            INNER JOIN ranked AS r ON u.VendorUserId = r.VendorUserId
            WHERE r.rn = 1;
            """);

        migrationBuilder.CreateIndex(
            name: "IX_VENDOR_USER_T_VENDOR_ID_WORKSPACE_PIC",
            schema: "vdr",
            table: "VENDOR_USER_T",
            columns: new[] { "VendorId", "IsWorkspacePic" },
            unique: true,
            filter: "[IsWorkspacePic] = 1");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_VENDOR_USER_T_VENDOR_ID_WORKSPACE_PIC",
            schema: "vdr",
            table: "VENDOR_USER_T");

        migrationBuilder.DropColumn(
            name: "IsWorkspacePic",
            schema: "vdr",
            table: "VENDOR_USER_T");
    }
}
