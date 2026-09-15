using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations;

[DbContext(typeof(ProcurementDbContext))]
[Migration("20260820050000_AddInternalLocalPasswordAndSessionCache")]
public class AddInternalLocalPasswordAndSessionCache : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "PasswordHash",
            schema: "iam",
            table: "USER_T",
            type: "nvarchar(max)",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SecurityStamp",
            schema: "iam",
            table: "USER_T",
            type: "nvarchar(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "LockoutEnd",
            schema: "iam",
            table: "USER_T",
            type: "datetimeoffset",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "AccessFailedCount",
            schema: "iam",
            table: "USER_T",
            type: "int",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<bool>(
            name: "MustChangePassword",
            schema: "iam",
            table: "USER_T",
            type: "bit",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "PasswordSetAt",
            schema: "iam",
            table: "USER_T",
            type: "datetimeoffset",
            nullable: true);

        migrationBuilder.CreateTable(
            name: "SESSION_CACHE_T",
            schema: "core",
            columns: table => new
            {
                Id = table.Column<string>(type: "nvarchar(449)", maxLength: 449, nullable: false, collation: "SQL_Latin1_General_CP1_CS_AS"),
                Value = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                ExpiresAtTime = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                SlidingExpirationInSeconds = table.Column<long>(type: "bigint", nullable: true),
                AbsoluteExpiration = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SESSION_CACHE_T", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_SESSION_CACHE_T_EXPIRES",
            schema: "core",
            table: "SESSION_CACHE_T",
            column: "ExpiresAtTime");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "SESSION_CACHE_T",
            schema: "core");

        migrationBuilder.DropColumn(name: "PasswordHash", schema: "iam", table: "USER_T");
        migrationBuilder.DropColumn(name: "SecurityStamp", schema: "iam", table: "USER_T");
        migrationBuilder.DropColumn(name: "LockoutEnd", schema: "iam", table: "USER_T");
        migrationBuilder.DropColumn(name: "AccessFailedCount", schema: "iam", table: "USER_T");
        migrationBuilder.DropColumn(name: "MustChangePassword", schema: "iam", table: "USER_T");
        migrationBuilder.DropColumn(name: "PasswordSetAt", schema: "iam", table: "USER_T");
    }
}
