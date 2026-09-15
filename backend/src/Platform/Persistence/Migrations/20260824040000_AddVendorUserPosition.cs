using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations;

[DbContext(typeof(ProcurementDbContext))]
[Migration("20260824040000_AddVendorUserPosition")]
public class AddVendorUserPosition : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Position",
            schema: "vdr",
            table: "USERS_T",
            type: "nvarchar(100)",
            maxLength: 100,
            nullable: true);

        // Existing PIC Vendor rows inherit the company Position / mobile so Vendor Contacts
        // and Vendor Database start from the same values.
        migrationBuilder.Sql("""
            UPDATE u
            SET Position = v.Position
            FROM vdr.USERS_T AS u
            INNER JOIN vdr.VENDOR_USER_T AS vu
                ON vu.IdentityUserId = u.Id AND vu.IsWorkspacePic = 1
            INNER JOIN vdr.VENDOR_T AS v
                ON v.VendorId = vu.VendorId
            WHERE u.Position IS NULL
              AND v.Position IS NOT NULL
              AND LTRIM(RTRIM(v.Position)) <> '';

            UPDATE u
            SET PhoneNumber = LTRIM(RTRIM(CONCAT(
                    ISNULL(v.HandphoneCountry, ''),
                    CASE WHEN v.HandphoneCountry IS NULL OR LTRIM(RTRIM(v.HandphoneCountry)) = '' THEN '' ELSE ' ' END,
                    ISNULL(v.HandphoneNumber, ''))))
            FROM vdr.USERS_T AS u
            INNER JOIN vdr.VENDOR_USER_T AS vu
                ON vu.IdentityUserId = u.Id AND vu.IsWorkspacePic = 1
            INNER JOIN vdr.VENDOR_T AS v
                ON v.VendorId = vu.VendorId
            WHERE (u.PhoneNumber IS NULL OR LTRIM(RTRIM(u.PhoneNumber)) = '')
              AND v.HandphoneNumber IS NOT NULL
              AND LTRIM(RTRIM(v.HandphoneNumber)) <> '';
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Position",
            schema: "vdr",
            table: "USERS_T");
    }
}
