using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "core");

            migrationBuilder.EnsureSchema(
                name: "iam");

            migrationBuilder.CreateTable(
                name: "APPLICATION_ABOUT_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_A_P_P_L_I_C_A_T_I_O_N_A_B_O_U_T_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AUDIT_LOG_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ActorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Module = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UserAgent = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    MetadataJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_A_U_D_I_T_L_O_G_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EMAIL_SENT_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MessageId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_E_M_A_I_L_S_E_N_T_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EMAIL_TEMPLATE_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_E_M_A_I_L_T_E_M_P_L_A_T_E_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FRONTEND_STATE_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Scope = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_F_R_O_N_T_E_N_D_S_T_A_T_E_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LANGUAGE_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_L_A_N_G_U_A_G_E_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LANGUAGE_TEXT_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TextKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_L_A_N_G_U_A_G_E_T_E_X_T_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MASTER_DATA_RECORD_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SetKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ParentCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_M_A_S_T_E_R_D_A_T_A_R_E_C_O_R_D_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MASTER_DATA_SET_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TableName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Owner = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsReadOnly = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_M_A_S_T_E_R_D_A_T_A_S_E_T_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MENU_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MenuKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_M_E_N_U_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MODULE_STATE_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModuleKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StorageKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_M_O_D_U_L_E_S_T_A_T_E_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NOTIFICATION_RECIPIENT_STATE_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NotificationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonnelNo = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ReadAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DismissedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_N_O_T_I_F_I_C_A_T_I_O_N_R_E_C_I_P_I_E_N_T_S_T_A_T_E_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NOTIFICATION_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Severity = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    AudienceScope = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AudienceRoles = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    AudienceUser = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AudienceLabel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Module = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    LinkPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_N_O_T_I_F_I_C_A_T_I_O_N_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PERMISSION_T",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ModuleKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_P_E_R_M_I_S_S_I_O_N_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ROLE_T",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ModuleKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_R_O_L_E_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SETTING_T",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ValueJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_S_E_T_T_I_N_G_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "USER_T",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonnelNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CompleteName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Department = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Position = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ManagerUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SecurityStamp = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    AccessFailedCount = table.Column<int>(type: "int", nullable: false),
                    MustChangePassword = table.Column<bool>(type: "bit", nullable: false),
                    PasswordSetAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DeletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_U_S_E_R_T", x => x.Id);
                    table.CheckConstraint("CK_USER_T_STATUS", "[Status] IN ('Active','Inactive','Suspended')");
                    table.ForeignKey(
                        name: "F_K_U_S_E_R_T_U_S_E_R_T_MANAGER_USER_ID",
                        column: x => x.ManagerUserId,
                        principalSchema: "iam",
                        principalTable: "USER_T",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ROLE_PERMISSION_T",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PermissionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_R_O_L_E_P_E_R_M_I_S_S_I_O_N_T", x => x.Id);
                    table.ForeignKey(
                        name: "F_K_R_O_L_E_P_E_R_M_I_S_S_I_O_N_T_P_E_R_M_I_S_S_I_O_N_T_PERMISSION_ID",
                        column: x => x.PermissionId,
                        principalSchema: "iam",
                        principalTable: "PERMISSION_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "F_K_R_O_L_E_P_E_R_M_I_S_S_I_O_N_T_R_O_L_E_T_ROLE_ID",
                        column: x => x.RoleId,
                        principalSchema: "iam",
                        principalTable: "ROLE_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "USER_ROLE_T",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("P_K_U_S_E_R_R_O_L_E_T", x => x.Id);
                    table.ForeignKey(
                        name: "F_K_U_S_E_R_R_O_L_E_T_R_O_L_E_T_ROLE_ID",
                        column: x => x.RoleId,
                        principalSchema: "iam",
                        principalTable: "ROLE_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "F_K_U_S_E_R_R_O_L_E_T_U_S_E_R_T_USER_ID",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "USER_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "I_X_A_U_D_I_T_L_O_G_T_ACTOR_NAME",
                schema: "core",
                table: "AUDIT_LOG_T",
                column: "ActorName");

            migrationBuilder.CreateIndex(
                name: "I_X_A_U_D_I_T_L_O_G_T_MODULE",
                schema: "core",
                table: "AUDIT_LOG_T",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "I_X_A_U_D_I_T_L_O_G_T_OCCURRED_AT",
                schema: "core",
                table: "AUDIT_LOG_T",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "I_X_E_M_A_I_L_S_E_N_T_T_CATEGORY",
                schema: "core",
                table: "EMAIL_SENT_T",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "I_X_E_M_A_I_L_S_E_N_T_T_MESSAGE_ID",
                schema: "core",
                table: "EMAIL_SENT_T",
                column: "MessageId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_E_M_A_I_L_S_E_N_T_T_SENT_AT",
                schema: "core",
                table: "EMAIL_SENT_T",
                column: "SentAt");

            migrationBuilder.CreateIndex(
                name: "I_X_E_M_A_I_L_S_E_N_T_T_STATUS",
                schema: "core",
                table: "EMAIL_SENT_T",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "I_X_E_M_A_I_L_T_E_M_P_L_A_T_E_T_CATEGORY",
                schema: "core",
                table: "EMAIL_TEMPLATE_T",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "I_X_E_M_A_I_L_T_E_M_P_L_A_T_E_T_TEMPLATE_ID",
                schema: "core",
                table: "EMAIL_TEMPLATE_T",
                column: "TemplateId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_F_R_O_N_T_E_N_D_S_T_A_T_E_T_SCOPE_KEY",
                schema: "core",
                table: "FRONTEND_STATE_T",
                columns: new[] { "Scope", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_L_A_N_G_U_A_G_E_T_CODE",
                schema: "core",
                table: "LANGUAGE_T",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_L_A_N_G_U_A_G_E_T_E_X_T_T_TEXT_KEY",
                schema: "core",
                table: "LANGUAGE_TEXT_T",
                column: "TextKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_M_A_S_T_E_R_D_A_T_A_R_E_C_O_R_D_T_SET_KEY",
                schema: "core",
                table: "MASTER_DATA_RECORD_T",
                column: "SetKey");

            migrationBuilder.CreateIndex(
                name: "I_X_M_A_S_T_E_R_D_A_T_A_R_E_C_O_R_D_T_SET_KEY_CODE",
                schema: "core",
                table: "MASTER_DATA_RECORD_T",
                columns: new[] { "SetKey", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_M_A_S_T_E_R_D_A_T_A_R_E_C_O_R_D_T_SET_KEY_PARENT_CODE",
                schema: "core",
                table: "MASTER_DATA_RECORD_T",
                columns: new[] { "SetKey", "ParentCode" });

            migrationBuilder.CreateIndex(
                name: "I_X_M_A_S_T_E_R_D_A_T_A_R_E_C_O_R_D_T_STATUS",
                schema: "core",
                table: "MASTER_DATA_RECORD_T",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "I_X_M_A_S_T_E_R_D_A_T_A_S_E_T_T_KEY",
                schema: "core",
                table: "MASTER_DATA_SET_T",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_M_E_N_U_T_MENU_KEY",
                schema: "core",
                table: "MENU_T",
                column: "MenuKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_M_O_D_U_L_E_S_T_A_T_E_T_MODULE_KEY_STORAGE_KEY",
                schema: "core",
                table: "MODULE_STATE_T",
                columns: new[] { "ModuleKey", "StorageKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_N_O_T_I_F_I_C_A_T_I_O_N_R_E_C_I_P_I_E_N_T_S_T_A_T_E_T_NOTIFICATION_ID_PERSONNEL_NO",
                schema: "core",
                table: "NOTIFICATION_RECIPIENT_STATE_T",
                columns: new[] { "NotificationId", "PersonnelNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_N_O_T_I_F_I_C_A_T_I_O_N_R_E_C_I_P_I_E_N_T_S_T_A_T_E_T_PERSONNEL_NO",
                schema: "core",
                table: "NOTIFICATION_RECIPIENT_STATE_T",
                column: "PersonnelNo");

            migrationBuilder.CreateIndex(
                name: "I_X_N_O_T_I_F_I_C_A_T_I_O_N_T_AUDIENCE_SCOPE",
                schema: "core",
                table: "NOTIFICATION_T",
                column: "AudienceScope");

            migrationBuilder.CreateIndex(
                name: "I_X_N_O_T_I_F_I_C_A_T_I_O_N_T_AUDIENCE_USER",
                schema: "core",
                table: "NOTIFICATION_T",
                column: "AudienceUser");

            migrationBuilder.CreateIndex(
                name: "I_X_N_O_T_I_F_I_C_A_T_I_O_N_T_CREATED_AT",
                schema: "core",
                table: "NOTIFICATION_T",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "I_X_P_E_R_M_I_S_S_I_O_N_T_KEY",
                schema: "iam",
                table: "PERMISSION_T",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_R_O_L_E_P_E_R_M_I_S_S_I_O_N_T_PERMISSION_ID",
                schema: "iam",
                table: "ROLE_PERMISSION_T",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "I_X_R_O_L_E_P_E_R_M_I_S_S_I_O_N_T_ROLE_ID_PERMISSION_ID",
                schema: "iam",
                table: "ROLE_PERMISSION_T",
                columns: new[] { "RoleId", "PermissionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_R_O_L_E_T_CODE",
                schema: "iam",
                table: "ROLE_T",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_S_E_T_T_I_N_G_T_KEY",
                schema: "core",
                table: "SETTING_T",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_U_S_E_R_R_O_L_E_T_ROLE_ID",
                schema: "iam",
                table: "USER_ROLE_T",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "I_X_U_S_E_R_R_O_L_E_T_USER_ID_ROLE_ID",
                schema: "iam",
                table: "USER_ROLE_T",
                columns: new[] { "UserId", "RoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "I_X_U_S_E_R_T_M_A_N_A_G_E_R",
                schema: "iam",
                table: "USER_T",
                column: "ManagerUserId");

            migrationBuilder.CreateIndex(
                name: "I_X_U_S_E_R_T_PERSONNEL_NO",
                schema: "iam",
                table: "USER_T",
                column: "PersonnelNo",
                unique: true,
                filter: "[DeletedAt] IS NULL");

            // Backing table for AddDistributedSqlServerCache (session storage). Not part of the
            // EF model, so it must be created explicitly here rather than scaffolded.
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
                name: "APPLICATION_ABOUT_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "AUDIT_LOG_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "EMAIL_SENT_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "EMAIL_TEMPLATE_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "FRONTEND_STATE_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "LANGUAGE_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "LANGUAGE_TEXT_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "MASTER_DATA_RECORD_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "MASTER_DATA_SET_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "MENU_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "MODULE_STATE_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "NOTIFICATION_RECIPIENT_STATE_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "NOTIFICATION_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "ROLE_PERMISSION_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "SESSION_CACHE_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "SETTING_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "USER_ROLE_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "PERMISSION_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "ROLE_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "USER_T",
                schema: "iam");
        }
    }
}
