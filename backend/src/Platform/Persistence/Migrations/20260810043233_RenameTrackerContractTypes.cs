using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameTrackerContractTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ProposalType",
                schema: "trk",
                table: "PROPOSAL_T",
                newName: "TrackerContractType");

            migrationBuilder.AddColumn<string>(
                name: "CipContractType",
                schema: "trk",
                table: "PROPOSAL_T",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE [trk].[PROPOSAL_T]
                SET [CipContractType] = COALESCE(
                    NULLIF(JSON_VALUE([PayloadJson], '$.cipContractType'), ''),
                    NULLIF(JSON_VALUE([PayloadJson], '$.contractualType'), ''))
                WHERE ISJSON([PayloadJson]) = 1;

                UPDATE [trk].[PROPOSAL_T]
                SET [TrackerContractType] = CASE
                        WHEN [Commodity] LIKE '%Works%' OR [Commodity] LIKE '%Services%' THEN 'Contractual'
                        ELSE 'Non Contractual'
                    END,
                    [CipContractType] = CASE
                        WHEN [Commodity] LIKE '%Works%' OR [Commodity] LIKE '%Services%' THEN 'Service Agreement'
                        ELSE NULL
                    END
                WHERE [ProposalKey] LIKE 'SMP-%'
                  AND ([TrackerContractType] IS NULL
                    OR [TrackerContractType] IN ('Tender', 'Pemilihan Langsung', 'Penunjukan Langsung'));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CipContractType",
                schema: "trk",
                table: "PROPOSAL_T");

            migrationBuilder.RenameColumn(
                name: "TrackerContractType",
                schema: "trk",
                table: "PROPOSAL_T",
                newName: "ProposalType");
        }
    }
}
