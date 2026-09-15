using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVersionedVendorApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "APPROVAL_WORKFLOW_T",
                schema: "vdr",
                columns: table => new
                {
                    ApprovalWorkflowId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    State = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    EffectiveFrom = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ActivatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RetiredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
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
                    WorkflowId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StepOrder = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ApproverRoleCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
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
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    WorkflowId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CurrentStepId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    State = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RevisionRequestedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
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
                    InstanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StepId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Decision = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    ActorId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ActorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    DecidedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    LegacyStatusCode = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    IsInferred = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
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

            // Existing vendors remain pinned to the legacy three-step route. The vendor status
            // column is preserved as a compatibility projection; workflow instances become the
            // source of truth for approval routing after this migration.
            migrationBuilder.Sql(
                """
                DECLARE @WorkflowId uniqueidentifier = '10000000-0000-0000-0000-000000000001';
                DECLARE @Step1Id uniqueidentifier = '10000000-0000-0000-0000-000000000101';
                DECLARE @Step2Id uniqueidentifier = '10000000-0000-0000-0000-000000000102';
                DECLARE @Step3Id uniqueidentifier = '10000000-0000-0000-0000-000000000103';
                DECLARE @Now datetimeoffset = SYSUTCDATETIME();

                INSERT INTO [vdr].[APPROVAL_WORKFLOW_T]
                    ([ApprovalWorkflowId], [Version], [Name], [State], [EffectiveFrom], [ActivatedAt],
                     [RetiredAt], [CreatedAt], [CreatedBy], [UpdatedAt], [UpdatedBy])
                VALUES
                    (@WorkflowId, 1, N'Legacy 3-Step Approval', N'Active', @Now, @Now,
                     NULL, @Now, N'MIGRATION', NULL, NULL);

                INSERT INTO [vdr].[APPROVAL_WORKFLOW_STEP_T]
                    ([ApprovalWorkflowStepId], [WorkflowId], [StepOrder], [Name], [ApproverRoleCode],
                     [CreatedAt], [CreatedBy], [UpdatedAt], [UpdatedBy])
                VALUES
                    (@Step1Id, @WorkflowId, 1, N'Officer Review', N'OFFCR-VDR', @Now, N'MIGRATION', NULL, NULL),
                    (@Step2Id, @WorkflowId, 2, N'Department Head Approval', N'DEPHD-VDR', @Now, N'MIGRATION', NULL, NULL),
                    (@Step3Id, @WorkflowId, 3, N'Division Head Approval', N'DIV-HD', @Now, N'MIGRATION', NULL, NULL);

                INSERT INTO [vdr].[APPROVAL_INSTANCE_T]
                    ([ApprovalInstanceId], [VendorId], [WorkflowId], [CurrentStepId], [State],
                     [StartedAt], [CompletedAt], [RevisionRequestedAt],
                     [CreatedAt], [CreatedBy], [UpdatedAt], [UpdatedBy])
                SELECT
                    NEWID(),
                    vendor.[VendorId],
                    @WorkflowId,
                    CASE vendor.[Status]
                        WHEN N'SBMIT' THEN @Step1Id
                        WHEN N'APPR1' THEN @Step2Id
                        WHEN N'APPR2' THEN @Step3Id
                        WHEN N'APPR3' THEN @Step3Id
                        ELSE NULL
                    END,
                    CASE
                        WHEN vendor.[Status] IN (N'SBMIT', N'APPR1', N'APPR2', N'APPR3') THEN N'Active'
                        WHEN vendor.[Status] = N'REPIR' THEN N'Revision'
                        WHEN vendor.[Status] IN (N'APPRV', N'RGSTD') THEN N'Completed'
                        ELSE N'Rejected'
                    END,
                    COALESCE(
                        (SELECT MIN(history.[CreatedAt])
                         FROM [vdr].[VENDOR_STATUS_T] history
                         WHERE history.[VendorId] = vendor.[VendorId]
                           AND history.[StatusCode] IN (N'SBMIT', N'APPR1', N'APPR2', N'APPR3', N'APPRV')),
                        vendor.[CreatedAt]),
                    CASE WHEN vendor.[Status] IN (N'APPRV', N'RGSTD', N'RJCTD')
                         THEN COALESCE(vendor.[UpdatedAt], vendor.[CreatedAt]) ELSE NULL END,
                    CASE WHEN vendor.[Status] = N'REPIR'
                         THEN COALESCE(vendor.[UpdatedAt], vendor.[CreatedAt]) ELSE NULL END,
                    @Now,
                    N'MIGRATION',
                    NULL,
                    NULL
                FROM [vdr].[VENDOR_T] vendor
                WHERE vendor.[Status] IN
                    (N'SBMIT', N'APPR1', N'APPR2', N'APPR3', N'APPRV', N'RGSTD', N'RJCTD', N'REPIR');

                ;WITH OrderedHistory AS
                (
                    SELECT
                        history.[VendorStatusId],
                        history.[VendorId],
                        history.[StatusCode],
                        history.[CreatedBy],
                        history.[Reason],
                        history.[CreatedAt],
                        LAG(history.[StatusCode]) OVER
                            (PARTITION BY history.[VendorId]
                             ORDER BY history.[CreatedAt], history.[VendorStatusId]) AS PreviousStatus
                    FROM [vdr].[VENDOR_STATUS_T] history
                ),
                MappedDecisions AS
                (
                    SELECT
                        history.*,
                        CASE
                            WHEN history.[StatusCode] = N'APPR1' THEN @Step1Id
                            WHEN history.[StatusCode] = N'APPR2' THEN @Step2Id
                            WHEN history.[StatusCode] = N'APPRV' THEN @Step3Id
                            WHEN history.[StatusCode] IN (N'REPIR', N'RJCTD')
                                 AND history.[PreviousStatus] = N'SBMIT' THEN @Step1Id
                            WHEN history.[StatusCode] IN (N'REPIR', N'RJCTD')
                                 AND history.[PreviousStatus] = N'APPR1' THEN @Step2Id
                            WHEN history.[StatusCode] IN (N'REPIR', N'RJCTD')
                                 AND history.[PreviousStatus] IN (N'APPR2', N'APPR3') THEN @Step3Id
                            ELSE NULL
                        END AS StepId,
                        CASE
                            WHEN history.[StatusCode] IN (N'APPR1', N'APPR2', N'APPRV') THEN N'Approved'
                            WHEN history.[StatusCode] = N'REPIR' THEN N'RevisionRequested'
                            WHEN history.[StatusCode] = N'RJCTD' THEN N'Rejected'
                            ELSE NULL
                        END AS Decision
                    FROM OrderedHistory history
                )
                INSERT INTO [vdr].[APPROVAL_DECISION_T]
                    ([ApprovalDecisionId], [InstanceId], [StepId], [Decision], [ActorId], [ActorName],
                     [Reason], [DecidedAt], [Source], [LegacyStatusCode], [IsInferred],
                     [CreatedAt], [CreatedBy], [UpdatedAt], [UpdatedBy])
                SELECT
                    NEWID(),
                    instance.[ApprovalInstanceId],
                    history.[StepId],
                    history.[Decision],
                    NULLIF(history.[CreatedBy], N''),
                    actor.[CompleteName],
                    history.[Reason],
                    history.[CreatedAt],
                    N'Legacy',
                    history.[StatusCode],
                    CAST(1 AS bit),
                    history.[CreatedAt],
                    COALESCE(NULLIF(history.[CreatedBy], N''), N'MIGRATION'),
                    NULL,
                    NULL
                FROM MappedDecisions history
                INNER JOIN [vdr].[APPROVAL_INSTANCE_T] instance
                    ON instance.[VendorId] = history.[VendorId]
                OUTER APPLY
                (
                    SELECT TOP (1) internalUser.[CompleteName]
                    FROM [iam].[USER_T] internalUser
                    WHERE internalUser.[PersonnelNo] = history.[CreatedBy]
                       OR CONVERT(nvarchar(36), internalUser.[Id]) = history.[CreatedBy]
                ) actor
                WHERE history.[StepId] IS NOT NULL
                  AND history.[Decision] IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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
    }
}
