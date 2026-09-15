using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddContractMaterials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CONTRACT_MATERIAL_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    MaterialNumber = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Site = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CONTRACT_MATERIAL_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MATERIAL_SYNC_FILE_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    SourceType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    SourceLastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowCount = table.Column<int>(type: "int", nullable: false),
                    ImportedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MATERIAL_SYNC_FILE_T", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_MATERIAL_T_CONTRACT_KEY",
                schema: "cm",
                table: "CONTRACT_MATERIAL_T",
                column: "ContractKey");

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_MATERIAL_T_CONTRACT_KEY_MATERIAL_NUMBER",
                schema: "cm",
                table: "CONTRACT_MATERIAL_T",
                columns: new[] { "ContractKey", "MaterialNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_MATERIAL_T_CONTRACT_KEY_SORT_ORDER",
                schema: "cm",
                table: "CONTRACT_MATERIAL_T",
                columns: new[] { "ContractKey", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_MATERIAL_SYNC_FILE_T_CONTRACT_KEY",
                schema: "cm",
                table: "MATERIAL_SYNC_FILE_T",
                column: "ContractKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MATERIAL_SYNC_FILE_T_FILE_NAME",
                schema: "cm",
                table: "MATERIAL_SYNC_FILE_T",
                column: "FileName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CONTRACT_MATERIAL_T",
                schema: "cm");

            migrationBuilder.DropTable(
                name: "MATERIAL_SYNC_FILE_T",
                schema: "cm");
        }
    }
}
