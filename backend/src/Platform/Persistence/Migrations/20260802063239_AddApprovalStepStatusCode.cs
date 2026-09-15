using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovalStepStatusCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_VENDOR_T_STATUS",
                schema: "vdr",
                table: "VENDOR_T");

            migrationBuilder.AddColumn<string>(
                name: "StatusCode",
                schema: "vdr",
                table: "APPROVAL_WORKFLOW_STEP_T",
                type: "nvarchar(8)",
                maxLength: 8,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StatusCode",
                schema: "vdr",
                table: "APPROVAL_WORKFLOW_STEP_T");

            migrationBuilder.AddCheckConstraint(
                name: "CK_VENDOR_T_STATUS",
                schema: "vdr",
                table: "VENDOR_T",
                sql: "[Status] IN ('INVTD','RSPND','DRFT','SBMIT','REPIR','RJCTD','APPR1','APPR2','APPR3','APPRV','RGSTD','BLCK')");
        }
    }
}
