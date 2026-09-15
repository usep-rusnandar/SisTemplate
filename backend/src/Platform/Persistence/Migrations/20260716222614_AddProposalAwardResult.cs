using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalAwardResult : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AWARD_RESULT_T",
                schema: "trk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProposalKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Method = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    EvaluatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    EvaluatedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AWARD_RESULT_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AWARD_RESULT_VENDOR_T",
                schema: "trk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProposalKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    VendorName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    BidPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    TechnicalScore = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: true),
                    CommercialScore = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: true),
                    TotalScore = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: true),
                    Rank = table.Column<int>(type: "int", nullable: true),
                    NegotiatedValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    AwardValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AwardPercent = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: false),
                    IsWinner = table.Column<bool>(type: "bit", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AWARD_RESULT_VENDOR_T", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AWARD_RESULT_T_PROPOSAL_KEY",
                schema: "trk",
                table: "AWARD_RESULT_T",
                column: "ProposalKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AWARD_RESULT_VENDOR_T_PROPOSAL_KEY",
                schema: "trk",
                table: "AWARD_RESULT_VENDOR_T",
                column: "ProposalKey");

            migrationBuilder.CreateIndex(
                name: "IX_AWARD_RESULT_VENDOR_T_PROPOSAL_KEY_VENDOR_ID",
                schema: "trk",
                table: "AWARD_RESULT_VENDOR_T",
                columns: new[] { "ProposalKey", "VendorId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AWARD_RESULT_T",
                schema: "trk");

            migrationBuilder.DropTable(
                name: "AWARD_RESULT_VENDOR_T",
                schema: "trk");
        }
    }
}
