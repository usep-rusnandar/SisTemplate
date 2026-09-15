using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveVendorApprovalWorkflowTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "APPROVAL_DECISION_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "APPROVAL_INSTANCE_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "APPROVAL_WORKFLOW_STEP_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "APPROVAL_WORKFLOW_T",
                schema: "vdr");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "APPROVAL_WORKFLOW_T",
                schema: "vdr",
                columns: table => new
                {
                    ApprovalWorkflowId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActivatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    EffectiveFrom = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    RetiredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    State = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_APPROVAL_WORKFLOW_T", x => x.ApprovalWorkflowId);
                    table.CheckConstraint("CK_APPROVAL_WORKFLOW_T_STATE", "[State] IN ('Draft','Active','Retired')");
                });

            migrationBuilder.CreateTable(
                name: "APPROVAL_WORKFLOW_STEP_T",
                schema: "vdr",
                columns: table => new
                {
                    ApprovalWorkflowStepId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApproverRoleCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    SlaDays = table.Column<int>(type: "int", nullable: true),
                    StatusCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    StepOrder = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    WorkflowId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_APPROVAL_WORKFLOW_STEP_T", x => x.ApprovalWorkflowStepId);
                    table.ForeignKey(
                        name: "FK_APPROVAL_WORKFLOW_STEP_T_APPROVAL_WORKFLOW_T_WORKFLOW_ID",
                        column: x => x.WorkflowId,
                        principalSchema: "vdr",
                        principalTable: "APPROVAL_WORKFLOW_T",
                        principalColumn: "ApprovalWorkflowId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "APPROVAL_INSTANCE_T",
                schema: "vdr",
                columns: table => new
                {
                    ApprovalInstanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CurrentStepId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RevisionRequestedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    State = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    WorkflowId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_APPROVAL_INSTANCE_T", x => x.ApprovalInstanceId);
                    table.CheckConstraint("CK_APPROVAL_INSTANCE_T_STATE", "[State] IN ('Active','Revision','Completed','Rejected')");
                    table.ForeignKey(
                        name: "FK_APPROVAL_INSTANCE_T_APPROVAL_WORKFLOW_STEP_T_CURRENT_STEP_ID",
                        column: x => x.CurrentStepId,
                        principalSchema: "vdr",
                        principalTable: "APPROVAL_WORKFLOW_STEP_T",
                        principalColumn: "ApprovalWorkflowStepId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_APPROVAL_INSTANCE_T_APPROVAL_WORKFLOW_T_WORKFLOW_ID",
                        column: x => x.WorkflowId,
                        principalSchema: "vdr",
                        principalTable: "APPROVAL_WORKFLOW_T",
                        principalColumn: "ApprovalWorkflowId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_APPROVAL_INSTANCE_T_VENDOR_T_VENDOR_ID",
                        column: x => x.VendorId,
                        principalSchema: "vdr",
                        principalTable: "VENDOR_T",
                        principalColumn: "VendorId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "APPROVAL_DECISION_T",
                schema: "vdr",
                columns: table => new
                {
                    ApprovalDecisionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ActorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DecidedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Decision = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    InstanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsInferred = table.Column<bool>(type: "bit", nullable: false),
                    LegacyStatusCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Source = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    StepId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_APPROVAL_DECISION_T", x => x.ApprovalDecisionId);
                    table.CheckConstraint("CK_APPROVAL_DECISION_T_DECISION", "[Decision] IN ('Approved','RevisionRequested','Rejected')");
                    table.CheckConstraint("CK_APPROVAL_DECISION_T_SOURCE", "[Source] IN ('Runtime','Legacy')");
                    table.ForeignKey(
                        name: "FK_APPROVAL_DECISION_T_APPROVAL_INSTANCE_T_INSTANCE_ID",
                        column: x => x.InstanceId,
                        principalSchema: "vdr",
                        principalTable: "APPROVAL_INSTANCE_T",
                        principalColumn: "ApprovalInstanceId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_APPROVAL_DECISION_T_APPROVAL_WORKFLOW_STEP_T_STEP_ID",
                        column: x => x.StepId,
                        principalSchema: "vdr",
                        principalTable: "APPROVAL_WORKFLOW_STEP_T",
                        principalColumn: "ApprovalWorkflowStepId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_DECISION_T_INSTANCE_ID_DECIDED_AT",
                schema: "vdr",
                table: "APPROVAL_DECISION_T",
                columns: new[] { "InstanceId", "DecidedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_DECISION_T_STEP_ID",
                schema: "vdr",
                table: "APPROVAL_DECISION_T",
                column: "StepId");

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_INSTANCE_T_CURRENT_STEP_ID",
                schema: "vdr",
                table: "APPROVAL_INSTANCE_T",
                column: "CurrentStepId");

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_INSTANCE_T_STATE_CURRENT_STEP_ID",
                schema: "vdr",
                table: "APPROVAL_INSTANCE_T",
                columns: new[] { "State", "CurrentStepId" });

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_INSTANCE_T_VENDOR_ID",
                schema: "vdr",
                table: "APPROVAL_INSTANCE_T",
                column: "VendorId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_INSTANCE_T_WORKFLOW_ID",
                schema: "vdr",
                table: "APPROVAL_INSTANCE_T",
                column: "WorkflowId");

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_WORKFLOW_STEP_T_WORKFLOW_ID_STEP_ORDER",
                schema: "vdr",
                table: "APPROVAL_WORKFLOW_STEP_T",
                columns: new[] { "WorkflowId", "StepOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_WORKFLOW_T_STATE",
                schema: "vdr",
                table: "APPROVAL_WORKFLOW_T",
                column: "State");

            migrationBuilder.CreateIndex(
                name: "IX_APPROVAL_WORKFLOW_T_VERSION",
                schema: "vdr",
                table: "APPROVAL_WORKFLOW_T",
                column: "Version",
                unique: true);
        }
    }
}
