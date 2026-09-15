using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAribaVendorImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPlaceholder",
                schema: "vdr",
                table: "VENDOR_DOCUMENT_T",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SourceSystem",
                schema: "vdr",
                table: "VENDOR_DOCUMENT_T",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "VENDOR_IMPORT_BATCH_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorImportBatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    FileHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    StartedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TotalRows = table.Column<int>(type: "int", nullable: false),
                    ReadyRows = table.Column<int>(type: "int", nullable: false),
                    WarningRows = table.Column<int>(type: "int", nullable: false),
                    ErrorRows = table.Column<int>(type: "int", nullable: false),
                    ImportedRows = table.Column<int>(type: "int", nullable: false),
                    SkippedRows = table.Column<int>(type: "int", nullable: false),
                    CommittedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_IMPORT_BATCH_T", x => x.VendorImportBatchId);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_EXTERNAL_REFERENCE_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorExternalReferenceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    SourceSystem = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ExternalVendorId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ImportBatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PayloadHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SourceUpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ImportedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_EXTERNAL_REFERENCE_T", x => x.VendorExternalReferenceId);
                    table.ForeignKey(
                        name: "FK_VENDOR_EXTERNAL_REFERENCE_T_VENDOR_IMPORT_BATCH_T_IMPORT_BATCH_ID",
                        column: x => x.ImportBatchId,
                        principalSchema: "vdr",
                        principalTable: "VENDOR_IMPORT_BATCH_T",
                        principalColumn: "VendorImportBatchId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VENDOR_EXTERNAL_REFERENCE_T_VENDOR_T_VENDOR_ID",
                        column: x => x.VendorId,
                        principalSchema: "vdr",
                        principalTable: "VENDOR_T",
                        principalColumn: "VendorId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_IMPORT_ROW_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorImportRowId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RowNumber = table.Column<int>(type: "int", nullable: false),
                    ExternalVendorId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    VendorName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    PicEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    IssuesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_IMPORT_ROW_T", x => x.VendorImportRowId);
                    table.ForeignKey(
                        name: "FK_VENDOR_IMPORT_ROW_T_VENDOR_IMPORT_BATCH_T_BATCH_ID",
                        column: x => x.BatchId,
                        principalSchema: "vdr",
                        principalTable: "VENDOR_IMPORT_BATCH_T",
                        principalColumn: "VendorImportBatchId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_EXTERNAL_REFERENCE_T_IMPORT_BATCH_ID",
                schema: "vdr",
                table: "VENDOR_EXTERNAL_REFERENCE_T",
                column: "ImportBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_EXTERNAL_REFERENCE_T_SOURCE_SYSTEM_EXTERNAL_VENDOR_ID",
                schema: "vdr",
                table: "VENDOR_EXTERNAL_REFERENCE_T",
                columns: new[] { "SourceSystem", "ExternalVendorId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_EXTERNAL_REFERENCE_T_VENDOR_ID",
                schema: "vdr",
                table: "VENDOR_EXTERNAL_REFERENCE_T",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_IMPORT_BATCH_T_CREATED_AT",
                schema: "vdr",
                table: "VENDOR_IMPORT_BATCH_T",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_IMPORT_ROW_T_BATCH_ID_ROW_NUMBER",
                schema: "vdr",
                table: "VENDOR_IMPORT_ROW_T",
                columns: new[] { "BatchId", "RowNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VENDOR_EXTERNAL_REFERENCE_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_IMPORT_ROW_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_IMPORT_BATCH_T",
                schema: "vdr");

            migrationBuilder.DropColumn(
                name: "IsPlaceholder",
                schema: "vdr",
                table: "VENDOR_DOCUMENT_T");

            migrationBuilder.DropColumn(
                name: "SourceSystem",
                schema: "vdr",
                table: "VENDOR_DOCUMENT_T");
        }
    }
}
