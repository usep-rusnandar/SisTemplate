using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameContractTypeFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "TrackerContractType",
                schema: "trk",
                table: "PROPOSAL_T",
                newName: "ContractType");

            migrationBuilder.RenameColumn(
                name: "CipContractType",
                schema: "trk",
                table: "PROPOSAL_T",
                newName: "ContractualType");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ContractType",
                schema: "trk",
                table: "PROPOSAL_T",
                newName: "TrackerContractType");

            migrationBuilder.RenameColumn(
                name: "ContractualType",
                schema: "trk",
                table: "PROPOSAL_T",
                newName: "CipContractType");
        }
    }
}
