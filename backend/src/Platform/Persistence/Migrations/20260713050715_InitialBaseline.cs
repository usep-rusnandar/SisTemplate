using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialBaseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "core");

            migrationBuilder.EnsureSchema(
                name: "cip");

            migrationBuilder.EnsureSchema(
                name: "cm");

            migrationBuilder.EnsureSchema(
                name: "vdr");

            migrationBuilder.EnsureSchema(
                name: "trk");

            migrationBuilder.EnsureSchema(
                name: "iam");

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
                    table.PrimaryKey("PK_AUDIT_LOG_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CASE_ACTIVITY_T",
                schema: "cip",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CaseKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ActivityKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ActivityType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StageKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ActorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CASE_ACTIVITY_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CASE_DOCUMENT_T",
                schema: "cip",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CaseKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    DocumentKey = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    DocumentType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    GeneratedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    DataUri = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Container = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    BlobKey = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CASE_DOCUMENT_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CASE_T",
                schema: "cip",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CaseKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    LoaKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    LoaNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    VendorName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Jobsite = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Department = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ProposalTotalValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AwardPercent = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: false),
                    Stage = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Template = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Requestor = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Procurement = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Legal = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAtDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Source = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProposalKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ProposalNumber = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    TermsheetNumber = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    ContractNumber = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CASE_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CONTRACT_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SupplierName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Classification = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SubClass = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Jobsite = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Template = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Frequency = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Owner = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UserDepartment = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PicNames = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    PicEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    ContractValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentExpiryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ContractDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ReceivedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Ownership = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SystemNumbersJson = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    DocumentLink = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PriceAdjustment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    DaysToExpiry = table.Column<int>(type: "int", nullable: false),
                    VersionCount = table.Column<int>(type: "int", nullable: false),
                    LatestVersionType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CONTRACT_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CONTRACT_VERSION_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    VersionKey = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    RowIndex = table.Column<int>(type: "int", nullable: false),
                    VersionType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ContractValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ReceivedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ContractDate = table.Column<DateOnly>(type: "date", nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpiredDate = table.Column<DateOnly>(type: "date", nullable: true),
                    SupplierName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Jobsite = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Classification = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SubClass = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Template = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Frequency = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Owner = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UserDepartment = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PicNames = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    PicEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    Ownership = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SystemNumbersJson = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    DocumentLink = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PriceAdjustment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CONTRACT_VERSION_T", x => x.Id);
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
                    table.PrimaryKey("PK_EMAIL_SENT_T", x => x.Id);
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
                    table.PrimaryKey("PK_EMAIL_TEMPLATE_T", x => x.Id);
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
                    table.PrimaryKey("PK_FRONTEND_STATE_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IMPORT_JOB_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BatchCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    StartedByPersonnelNo = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    StartedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    TotalRows = table.Column<int>(type: "int", nullable: false),
                    StoredCount = table.Column<int>(type: "int", nullable: false),
                    FailedCount = table.Column<int>(type: "int", nullable: false),
                    SkippedCount = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IMPORT_JOB_T", x => x.Id);
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
                    table.PrimaryKey("PK_LANGUAGE_T", x => x.Id);
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
                    table.PrimaryKey("PK_LANGUAGE_TEXT_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LOA_DOCUMENT_T",
                schema: "trk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProposalKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ActivityKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LoaNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    VendorName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    AwardValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AwardPercent = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: false),
                    GeneratedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    FileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LOA_DOCUMENT_T", x => x.Id);
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
                    table.PrimaryKey("PK_MASTER_DATA_RECORD_T", x => x.Id);
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
                    table.PrimaryKey("PK_MASTER_DATA_SET_T", x => x.Id);
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
                    table.PrimaryKey("PK_MENU_T", x => x.Id);
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
                    table.PrimaryKey("PK_NOTIFICATION_RECIPIENT_STATE_T", x => x.Id);
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
                    table.PrimaryKey("PK_NOTIFICATION_T", x => x.Id);
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
                    table.PrimaryKey("PK_PERMISSION_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PROPOSAL_ACTIVITY_T",
                schema: "trk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProposalKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ActivityKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StageId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Owner = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    MasterLeadDays = table.Column<int>(type: "int", nullable: false),
                    TargetLeadDays = table.Column<int>(type: "int", nullable: false),
                    TargetDate = table.Column<DateOnly>(type: "date", nullable: true),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    EvidenceCount = table.Column<int>(type: "int", nullable: false),
                    LockedReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PROPOSAL_ACTIVITY_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PROPOSAL_T",
                schema: "trk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProposalKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ProposalNumber = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AribaId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Commodity = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Jobsite = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Department = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ProposalType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TrackerMethod = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LifecycleStatus = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CurrentStage = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OwnerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AssignedOfficerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RequirementDate = table.Column<DateOnly>(type: "date", nullable: true),
                    AgingDays = table.Column<int>(type: "int", nullable: false),
                    SlaDays = table.Column<int>(type: "int", nullable: false),
                    OverdueDays = table.Column<int>(type: "int", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PROPOSAL_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "REMINDER_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ReminderKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Tier = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Trigger = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    DaysToExpiry = table.Column<int>(type: "int", nullable: false),
                    Escalated = table.Column<bool>(type: "bit", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_REMINDER_T", x => x.Id);
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
                    table.PrimaryKey("PK_ROLE_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ROLES_T",
                schema: "vdr",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ROLES_T", x => x.Id);
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
                    table.PrimaryKey("PK_SETTING_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SHAREPOINT_DOC_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LinkHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SharingLink = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Container = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    BlobKey = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    MigratedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SHAREPOINT_DOC_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "STATE_T",
                schema: "cip",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StorageKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_STATE_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "STATE_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StorageKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_STATE_T", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "STATE_T",
                schema: "trk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StorageKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_STATE_T", x => x.Id);
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
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DeletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_T", x => x.Id);
                    table.CheckConstraint("CK_USER_T_STATUS", "[Status] IN ('Active','Inactive','Suspended')");
                });

            migrationBuilder.CreateTable(
                name: "USERS_T",
                schema: "vdr",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CompleteName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false, defaultValue: "Active"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    HasLogin = table.Column<bool>(type: "bit", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SecurityStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "bit", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "bit", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USERS_T", x => x.Id);
                    table.CheckConstraint("CK_USERS_T_STATUS", "[Status] IN ('Active','Inactive','Suspended')");
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_BRAND_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorBrandId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    BrandName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DistributorTypeCode = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    ExpireDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_BRAND_T", x => x.VendorBrandId);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_CERTIFICATE_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorCertificateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CertificateNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ExpireDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_CERTIFICATE_T", x => x.VendorCertificateId);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_DOCUMENT_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorDocumentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    DocumentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OwnerKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: true),
                    BlobContainer = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    BlobKey = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    UploadedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_DOCUMENT_T", x => x.VendorDocumentId);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_KBLI_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorKbliId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    KbliTypeCode = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    KbliCode = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    KbliStatusCode = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_KBLI_T", x => x.VendorKbliId);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_PORTFOLIO_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorPortfolioId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Client = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ScopeOfWork = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    TotalValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ContractStartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ContractEndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_PORTFOLIO_T", x => x.VendorPortfolioId);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_SPECIAL_REQUIREMENT_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorSpecialRequirementId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    SpecialReqCode = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Number = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ExpireDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_SPECIAL_REQUIREMENT_T", x => x.VendorSpecialRequirementId);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_SUBCLASSIFICATION_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorSubClassificationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    SubClassificationCode = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_SUBCLASSIFICATION_T", x => x.VendorSubClassificationId);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    VendorName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Position = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OfficePhoneCountry = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    OfficePhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    HandphoneCountry = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    HandphoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    WebAddress = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    OfficeAddress = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    OfficeAddressCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OfficeProvinceCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OfficeCityCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OfficeDistrictCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OfficeVillageCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OfficePostCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    OfficeCountry = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OfficeLatitude = table.Column<decimal>(type: "decimal(11,7)", nullable: true),
                    OfficeLongitude = table.Column<decimal>(type: "decimal(11,7)", nullable: true),
                    WarehouseAddress = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    WarehouseAddressCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WarehouseProvinceCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WarehouseCityCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WarehouseDistrictCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WarehouseVillageCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WarehousePostCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    WarehouseCountry = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WarehouseLatitude = table.Column<decimal>(type: "decimal(11,7)", nullable: true),
                    WarehouseLongitude = table.Column<decimal>(type: "decimal(11,7)", nullable: true),
                    WorkshopAddress = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    WorkshopAddressCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WorkshopProvinceCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WorkshopCityCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WorkshopDistrictCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WorkshopVillageCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WorkshopPostCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    WorkshopCountry = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WorkshopLatitude = table.Column<decimal>(type: "decimal(11,7)", nullable: true),
                    WorkshopLongitude = table.Column<decimal>(type: "decimal(11,7)", nullable: true),
                    NpwpNo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    NibNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    AktaPendirianNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    AktaPendirianDate = table.Column<DateOnly>(type: "date", nullable: true),
                    AktaPerubahanNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    AktaPerubahanDate = table.Column<DateOnly>(type: "date", nullable: true),
                    AktaPenyesuaianNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    AktaPenyesuaianDate = table.Column<DateOnly>(type: "date", nullable: true),
                    SppkpNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsBiodataTrue = table.Column<bool>(type: "bit", nullable: false),
                    IsAgreeSubmit = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DeletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_T", x => x.VendorId);
                    table.CheckConstraint("CK_VENDOR_T_STATUS", "[Status] IN ('INVTD','RSPND','DRFT','SBMIT','REPIR','RJCTD','APPR1','APPR2','APPR3','APPRV','RGSTD','BLCK')");
                });

            migrationBuilder.CreateTable(
                name: "IMPORT_JOB_ROW_T",
                schema: "cm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    JobId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RowIndex = table.Column<int>(type: "int", nullable: false),
                    ContractId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Supplier = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SharingLink = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    State = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    BlobContainer = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    BlobKey = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    FailReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IMPORT_JOB_ROW_T", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IMPORT_JOB_ROW_T_IMPORT_JOB_T_JOB_ID",
                        column: x => x.JobId,
                        principalSchema: "cm",
                        principalTable: "IMPORT_JOB_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
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
                    table.PrimaryKey("PK_ROLE_PERMISSION_T", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ROLE_PERMISSION_T_PERMISSION_T_PERMISSION_ID",
                        column: x => x.PermissionId,
                        principalSchema: "iam",
                        principalTable: "PERMISSION_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ROLE_PERMISSION_T_ROLE_T_ROLE_ID",
                        column: x => x.RoleId,
                        principalSchema: "iam",
                        principalTable: "ROLE_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ROLE_CLAIMS_T",
                schema: "vdr",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<string>(type: "nvarchar(5)", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ROLE_CLAIMS_T", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ROLE_CLAIMS_T_ROLES_T_ROLE_ID",
                        column: x => x.RoleId,
                        principalSchema: "vdr",
                        principalTable: "ROLES_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
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
                    table.PrimaryKey("PK_USER_ROLE_T", x => x.Id);
                    table.ForeignKey(
                        name: "FK_USER_ROLE_T_ROLE_T_ROLE_ID",
                        column: x => x.RoleId,
                        principalSchema: "iam",
                        principalTable: "ROLE_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_USER_ROLE_T_USER_T_USER_ID",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "USER_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "USER_CLAIMS_T",
                schema: "vdr",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(10)", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_CLAIMS_T", x => x.Id);
                    table.ForeignKey(
                        name: "FK_USER_CLAIMS_T_USERS_T_USER_ID",
                        column: x => x.UserId,
                        principalSchema: "vdr",
                        principalTable: "USERS_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_LOGINS_T",
                schema: "vdr",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(10)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_LOGINS_T", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_USER_LOGINS_T_USERS_T_USER_ID",
                        column: x => x.UserId,
                        principalSchema: "vdr",
                        principalTable: "USERS_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_ROLES_T",
                schema: "vdr",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(10)", nullable: false),
                    RoleId = table.Column<string>(type: "nvarchar(5)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_ROLES_T", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_USER_ROLES_T_ROLES_T_ROLE_ID",
                        column: x => x.RoleId,
                        principalSchema: "vdr",
                        principalTable: "ROLES_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_USER_ROLES_T_USERS_T_USER_ID",
                        column: x => x.UserId,
                        principalSchema: "vdr",
                        principalTable: "USERS_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_TOKENS_T",
                schema: "vdr",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(10)", nullable: false),
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_TOKENS_T", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_USER_TOKENS_T_USERS_T_USER_ID",
                        column: x => x.UserId,
                        principalSchema: "vdr",
                        principalTable: "USERS_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_STATUS_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorStatusId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    StatusCode = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_STATUS_T", x => x.VendorStatusId);
                    table.ForeignKey(
                        name: "FK_VENDOR_STATUS_T_VENDOR_T_VENDOR_ID",
                        column: x => x.VendorId,
                        principalSchema: "vdr",
                        principalTable: "VENDOR_T",
                        principalColumn: "VendorId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VENDOR_USER_T",
                schema: "vdr",
                columns: table => new
                {
                    VendorUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdentityUserId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VENDOR_USER_T", x => x.VendorUserId);
                    table.ForeignKey(
                        name: "FK_VENDOR_USER_T_USERS_T_IDENTITY_USER_ID",
                        column: x => x.IdentityUserId,
                        principalSchema: "vdr",
                        principalTable: "USERS_T",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VENDOR_USER_T_VENDOR_T_VENDOR_ID",
                        column: x => x.VendorId,
                        principalSchema: "vdr",
                        principalTable: "VENDOR_T",
                        principalColumn: "VendorId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "INVITATION_T",
                schema: "vdr",
                columns: table => new
                {
                    InvitationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeHash = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    CodeMasked = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    VendorName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    PicName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    VendorId = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ExpiredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UsedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UsedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_INVITATION_T", x => x.InvitationId);
                    table.CheckConstraint("CK_INVITATION_T_STATUS", "[Status] IN ('Draft','Sent','Opened','Registered','Expired','Revoked')");
                    table.ForeignKey(
                        name: "FK_INVITATION_T_VENDOR_T_VENDOR_ID",
                        column: x => x.VendorId,
                        principalSchema: "vdr",
                        principalTable: "VENDOR_T",
                        principalColumn: "VendorId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_INVITATION_T_VENDOR_USER_T_USED_BY",
                        column: x => x.UsedBy,
                        principalSchema: "vdr",
                        principalTable: "VENDOR_USER_T",
                        principalColumn: "VendorUserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "INVITATION_ATTEMPT_T",
                schema: "vdr",
                columns: table => new
                {
                    InvitationAttemptId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InvitationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    CodeMasked = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Result = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AttemptedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_INVITATION_ATTEMPT_T", x => x.InvitationAttemptId);
                    table.CheckConstraint("CK_INVITATION_ATTEMPT_T_RESULT", "[Result] IN ('Success','Failure')");
                    table.ForeignKey(
                        name: "FK_INVITATION_ATTEMPT_T_INVITATION_T_INVITATION_ID",
                        column: x => x.InvitationId,
                        principalSchema: "vdr",
                        principalTable: "INVITATION_T",
                        principalColumn: "InvitationId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                schema: "vdr",
                table: "ROLES_T",
                columns: new[] { "Id", "ConcurrencyStamp", "Description", "Name", "NormalizedName" },
                values: new object[] { "VNDOR", "legacy-vndor", "Role Vendor", "Vendor", "VENDOR" });

            migrationBuilder.CreateIndex(
                name: "IX_AUDIT_LOG_T_ACTOR_NAME",
                schema: "core",
                table: "AUDIT_LOG_T",
                column: "ActorName");

            migrationBuilder.CreateIndex(
                name: "IX_AUDIT_LOG_T_MODULE",
                schema: "core",
                table: "AUDIT_LOG_T",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_AUDIT_LOG_T_OCCURRED_AT",
                schema: "core",
                table: "AUDIT_LOG_T",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_CASE_ACTIVITY_T_CASE_KEY",
                schema: "cip",
                table: "CASE_ACTIVITY_T",
                column: "CaseKey");

            migrationBuilder.CreateIndex(
                name: "IX_CASE_ACTIVITY_T_CASE_KEY_ACTIVITY_KEY",
                schema: "cip",
                table: "CASE_ACTIVITY_T",
                columns: new[] { "CaseKey", "ActivityKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CASE_ACTIVITY_T_STAGE_KEY",
                schema: "cip",
                table: "CASE_ACTIVITY_T",
                column: "StageKey");

            migrationBuilder.CreateIndex(
                name: "IX_CASE_DOCUMENT_T_CASE_KEY",
                schema: "cip",
                table: "CASE_DOCUMENT_T",
                column: "CaseKey");

            migrationBuilder.CreateIndex(
                name: "IX_CASE_DOCUMENT_T_CASE_KEY_DOCUMENT_KEY",
                schema: "cip",
                table: "CASE_DOCUMENT_T",
                columns: new[] { "CaseKey", "DocumentKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CASE_DOCUMENT_T_DOCUMENT_TYPE",
                schema: "cip",
                table: "CASE_DOCUMENT_T",
                column: "DocumentType");

            migrationBuilder.CreateIndex(
                name: "IX_CASE_T_CASE_KEY",
                schema: "cip",
                table: "CASE_T",
                column: "CaseKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CASE_T_PROPOSAL_KEY",
                schema: "cip",
                table: "CASE_T",
                column: "ProposalKey");

            migrationBuilder.CreateIndex(
                name: "IX_CASE_T_STAGE",
                schema: "cip",
                table: "CASE_T",
                column: "Stage");

            migrationBuilder.CreateIndex(
                name: "IX_CASE_T_STATUS",
                schema: "cip",
                table: "CASE_T",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_T_CONTRACT_KEY",
                schema: "cm",
                table: "CONTRACT_T",
                column: "ContractKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_T_CURRENT_EXPIRY_DATE",
                schema: "cm",
                table: "CONTRACT_T",
                column: "CurrentExpiryDate");

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_T_PIC_EMAIL",
                schema: "cm",
                table: "CONTRACT_T",
                column: "PicEmail");

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_T_STATUS",
                schema: "cm",
                table: "CONTRACT_T",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_VERSION_T_CONTRACT_KEY",
                schema: "cm",
                table: "CONTRACT_VERSION_T",
                column: "ContractKey");

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_VERSION_T_CONTRACT_KEY_VERSION_KEY",
                schema: "cm",
                table: "CONTRACT_VERSION_T",
                columns: new[] { "ContractKey", "VersionKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CONTRACT_VERSION_T_EXPIRED_DATE",
                schema: "cm",
                table: "CONTRACT_VERSION_T",
                column: "ExpiredDate");

            migrationBuilder.CreateIndex(
                name: "IX_EMAIL_SENT_T_CATEGORY",
                schema: "core",
                table: "EMAIL_SENT_T",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_EMAIL_SENT_T_MESSAGE_ID",
                schema: "core",
                table: "EMAIL_SENT_T",
                column: "MessageId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EMAIL_SENT_T_SENT_AT",
                schema: "core",
                table: "EMAIL_SENT_T",
                column: "SentAt");

            migrationBuilder.CreateIndex(
                name: "IX_EMAIL_SENT_T_STATUS",
                schema: "core",
                table: "EMAIL_SENT_T",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_EMAIL_TEMPLATE_T_CATEGORY",
                schema: "core",
                table: "EMAIL_TEMPLATE_T",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_EMAIL_TEMPLATE_T_TEMPLATE_ID",
                schema: "core",
                table: "EMAIL_TEMPLATE_T",
                column: "TemplateId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FRONTEND_STATE_T_SCOPE_KEY",
                schema: "core",
                table: "FRONTEND_STATE_T",
                columns: new[] { "Scope", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IMPORT_JOB_ROW_T_JOB_ID_ROW_INDEX",
                schema: "cm",
                table: "IMPORT_JOB_ROW_T",
                columns: new[] { "JobId", "RowIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_IMPORT_JOB_ROW_T_JOB_ID_STATE",
                schema: "cm",
                table: "IMPORT_JOB_ROW_T",
                columns: new[] { "JobId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_IMPORT_JOB_T_CREATED_AT",
                schema: "cm",
                table: "IMPORT_JOB_T",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_IMPORT_JOB_T_STATUS",
                schema: "cm",
                table: "IMPORT_JOB_T",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_INVITATION_ATTEMPT_T_ATTEMPTED_AT",
                schema: "vdr",
                table: "INVITATION_ATTEMPT_T",
                column: "AttemptedAt");

            migrationBuilder.CreateIndex(
                name: "IX_INVITATION_ATTEMPT_T_EMAIL",
                schema: "vdr",
                table: "INVITATION_ATTEMPT_T",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_INVITATION_ATTEMPT_T_INVITATION_ID",
                schema: "vdr",
                table: "INVITATION_ATTEMPT_T",
                column: "InvitationId");

            migrationBuilder.CreateIndex(
                name: "IX_INVITATION_T_CODE_HASH",
                schema: "vdr",
                table: "INVITATION_T",
                column: "CodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_INVITATION_T_EMAIL",
                schema: "vdr",
                table: "INVITATION_T",
                column: "Email",
                unique: true,
                filter: "[UsedAt] IS NULL AND [Status] IN ('Draft','Sent','Opened')");

            migrationBuilder.CreateIndex(
                name: "IX_INVITATION_T_USED_BY",
                schema: "vdr",
                table: "INVITATION_T",
                column: "UsedBy");

            migrationBuilder.CreateIndex(
                name: "IX_INVITATION_T_VENDOR_ID",
                schema: "vdr",
                table: "INVITATION_T",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_LANGUAGE_T_CODE",
                schema: "core",
                table: "LANGUAGE_T",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LANGUAGE_TEXT_T_TEXT_KEY",
                schema: "core",
                table: "LANGUAGE_TEXT_T",
                column: "TextKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LOA_DOCUMENT_T_LOA_NUMBER",
                schema: "trk",
                table: "LOA_DOCUMENT_T",
                column: "LoaNumber");

            migrationBuilder.CreateIndex(
                name: "IX_LOA_DOCUMENT_T_PROPOSAL_KEY",
                schema: "trk",
                table: "LOA_DOCUMENT_T",
                column: "ProposalKey");

            migrationBuilder.CreateIndex(
                name: "IX_LOA_DOCUMENT_T_PROPOSAL_KEY_ACTIVITY_KEY_VENDOR_ID",
                schema: "trk",
                table: "LOA_DOCUMENT_T",
                columns: new[] { "ProposalKey", "ActivityKey", "VendorId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MASTER_DATA_RECORD_T_SET_KEY",
                schema: "core",
                table: "MASTER_DATA_RECORD_T",
                column: "SetKey");

            migrationBuilder.CreateIndex(
                name: "IX_MASTER_DATA_RECORD_T_SET_KEY_CODE",
                schema: "core",
                table: "MASTER_DATA_RECORD_T",
                columns: new[] { "SetKey", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MASTER_DATA_RECORD_T_SET_KEY_PARENT_CODE",
                schema: "core",
                table: "MASTER_DATA_RECORD_T",
                columns: new[] { "SetKey", "ParentCode" });

            migrationBuilder.CreateIndex(
                name: "IX_MASTER_DATA_RECORD_T_STATUS",
                schema: "core",
                table: "MASTER_DATA_RECORD_T",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MASTER_DATA_SET_T_KEY",
                schema: "core",
                table: "MASTER_DATA_SET_T",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MENU_T_MENU_KEY",
                schema: "core",
                table: "MENU_T",
                column: "MenuKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NOTIFICATION_RECIPIENT_STATE_T_NOTIFICATION_ID_PERSONNEL_NO",
                schema: "core",
                table: "NOTIFICATION_RECIPIENT_STATE_T",
                columns: new[] { "NotificationId", "PersonnelNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NOTIFICATION_RECIPIENT_STATE_T_PERSONNEL_NO",
                schema: "core",
                table: "NOTIFICATION_RECIPIENT_STATE_T",
                column: "PersonnelNo");

            migrationBuilder.CreateIndex(
                name: "IX_NOTIFICATION_T_AUDIENCE_SCOPE",
                schema: "core",
                table: "NOTIFICATION_T",
                column: "AudienceScope");

            migrationBuilder.CreateIndex(
                name: "IX_NOTIFICATION_T_AUDIENCE_USER",
                schema: "core",
                table: "NOTIFICATION_T",
                column: "AudienceUser");

            migrationBuilder.CreateIndex(
                name: "IX_NOTIFICATION_T_CREATED_AT",
                schema: "core",
                table: "NOTIFICATION_T",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_PERMISSION_T_KEY",
                schema: "iam",
                table: "PERMISSION_T",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PROPOSAL_ACTIVITY_T_PROPOSAL_KEY",
                schema: "trk",
                table: "PROPOSAL_ACTIVITY_T",
                column: "ProposalKey");

            migrationBuilder.CreateIndex(
                name: "IX_PROPOSAL_ACTIVITY_T_PROPOSAL_KEY_ACTIVITY_KEY",
                schema: "trk",
                table: "PROPOSAL_ACTIVITY_T",
                columns: new[] { "ProposalKey", "ActivityKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PROPOSAL_ACTIVITY_T_STATUS",
                schema: "trk",
                table: "PROPOSAL_ACTIVITY_T",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PROPOSAL_T_LIFECYCLE_STATUS",
                schema: "trk",
                table: "PROPOSAL_T",
                column: "LifecycleStatus");

            migrationBuilder.CreateIndex(
                name: "IX_PROPOSAL_T_PROPOSAL_KEY",
                schema: "trk",
                table: "PROPOSAL_T",
                column: "ProposalKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PROPOSAL_T_PROPOSAL_NUMBER",
                schema: "trk",
                table: "PROPOSAL_T",
                column: "ProposalNumber");

            migrationBuilder.CreateIndex(
                name: "IX_REMINDER_T_CONTRACT_KEY_TIER",
                schema: "cm",
                table: "REMINDER_T",
                columns: new[] { "ContractKey", "Tier" });

            migrationBuilder.CreateIndex(
                name: "IX_REMINDER_T_REMINDER_KEY",
                schema: "cm",
                table: "REMINDER_T",
                column: "ReminderKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_REMINDER_T_SENT_AT",
                schema: "cm",
                table: "REMINDER_T",
                column: "SentAt");

            migrationBuilder.CreateIndex(
                name: "IX_ROLE_CLAIMS_T_ROLE_ID",
                schema: "vdr",
                table: "ROLE_CLAIMS_T",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_ROLE_PERMISSION_T_PERMISSION_ID",
                schema: "iam",
                table: "ROLE_PERMISSION_T",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_ROLE_PERMISSION_T_ROLE_ID_PERMISSION_ID",
                schema: "iam",
                table: "ROLE_PERMISSION_T",
                columns: new[] { "RoleId", "PermissionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ROLE_T_CODE",
                schema: "iam",
                table: "ROLE_T",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ROLES_T_NORMALIZED_NAME",
                schema: "vdr",
                table: "ROLES_T",
                column: "NormalizedName",
                unique: true,
                filter: "[NormalizedName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SETTING_T_KEY",
                schema: "core",
                table: "SETTING_T",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SHAREPOINT_DOC_T_LINK_HASH",
                schema: "cm",
                table: "SHAREPOINT_DOC_T",
                column: "LinkHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_STATE_T_STORAGE_KEY",
                schema: "cip",
                table: "STATE_T",
                column: "StorageKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_STATE_T_STORAGE_KEY",
                schema: "cm",
                table: "STATE_T",
                column: "StorageKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_STATE_T_STORAGE_KEY",
                schema: "trk",
                table: "STATE_T",
                column: "StorageKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_CLAIMS_T_USER_ID",
                schema: "vdr",
                table: "USER_CLAIMS_T",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_USER_LOGINS_T_USER_ID",
                schema: "vdr",
                table: "USER_LOGINS_T",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_USER_ROLE_T_ROLE_ID",
                schema: "iam",
                table: "USER_ROLE_T",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_USER_ROLE_T_USER_ID_ROLE_ID",
                schema: "iam",
                table: "USER_ROLE_T",
                columns: new[] { "UserId", "RoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_ROLES_T_ROLE_ID",
                schema: "vdr",
                table: "USER_ROLES_T",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_USER_T_PERSONNEL_NO",
                schema: "iam",
                table: "USER_T",
                column: "PersonnelNo",
                unique: true,
                filter: "[DeletedAt] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_USERS_T_NORMALIZED_EMAIL",
                schema: "vdr",
                table: "USERS_T",
                column: "NormalizedEmail",
                filter: "[NormalizedEmail] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_USERS_T_NORMALIZED_USER_NAME",
                schema: "vdr",
                table: "USERS_T",
                column: "NormalizedUserName",
                unique: true,
                filter: "[NormalizedUserName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_BRAND_T_VENDOR_ID_BRAND_NAME",
                schema: "vdr",
                table: "VENDOR_BRAND_T",
                columns: new[] { "VendorId", "BrandName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_CERTIFICATE_T_VENDOR_ID",
                schema: "vdr",
                table: "VENDOR_CERTIFICATE_T",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_CERTIFICATE_T_VENDOR_ID_CERTIFICATE_NUMBER",
                schema: "vdr",
                table: "VENDOR_CERTIFICATE_T",
                columns: new[] { "VendorId", "CertificateNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_DOCUMENT_T_VENDOR_ID",
                schema: "vdr",
                table: "VENDOR_DOCUMENT_T",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_DOCUMENT_T_VENDOR_ID_DOCUMENT_TYPE_OWNER_KEY",
                schema: "vdr",
                table: "VENDOR_DOCUMENT_T",
                columns: new[] { "VendorId", "DocumentType", "OwnerKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_KBLI_T_VENDOR_ID_KBLI_TYPE_CODE_KBLI_CODE",
                schema: "vdr",
                table: "VENDOR_KBLI_T",
                columns: new[] { "VendorId", "KbliTypeCode", "KbliCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_PORTFOLIO_T_VENDOR_ID",
                schema: "vdr",
                table: "VENDOR_PORTFOLIO_T",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_SPECIAL_REQUIREMENT_T_VENDOR_ID_SPECIAL_REQ_CODE",
                schema: "vdr",
                table: "VENDOR_SPECIAL_REQUIREMENT_T",
                columns: new[] { "VendorId", "SpecialReqCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_STATUS_T_VENDOR_ID",
                schema: "vdr",
                table: "VENDOR_STATUS_T",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_SUBCLASSIFICATION_T_VENDOR_ID_SUB_CLASSIFICATION_CODE",
                schema: "vdr",
                table: "VENDOR_SUBCLASSIFICATION_T",
                columns: new[] { "VendorId", "SubClassificationCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_USER_T_IDENTITY_USER_ID",
                schema: "vdr",
                table: "VENDOR_USER_T",
                column: "IdentityUserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VENDOR_USER_T_VENDOR_ID",
                schema: "vdr",
                table: "VENDOR_USER_T",
                column: "VendorId");

            // SISWarrior SSO gate. NRP and PersonnelNo are the SAME value ("NRP" is the former name
            // of PersonnelNo), so the function checks iam.USER_T directly by PersonnelNo — the same
            // gate as InternalUserAccessService.MapNrpAsync.
            migrationBuilder.Sql("""
                CREATE OR ALTER FUNCTION [dbo].[CEK_USER_ACCESS_FN] ( @NRP nvarchar(20) )
                RETURNS nvarchar(20)
                AS
                BEGIN
                    DECLARE @retValue nvarchar(20) = N'false';

                    SELECT @retValue =
                        CASE
                            WHEN COUNT(*) > 0 THEN N'true'
                            ELSE N'false'
                        END
                    FROM [iam].[USER_T]
                    WHERE [DeletedAt] IS NULL
                        AND [Status] = N'Active'
                        AND [PersonnelNo] = @NRP;

                    RETURN @retValue;
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS [dbo].[CEK_USER_ACCESS_FN];");

            migrationBuilder.DropTable(
                name: "AUDIT_LOG_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "CASE_ACTIVITY_T",
                schema: "cip");

            migrationBuilder.DropTable(
                name: "CASE_DOCUMENT_T",
                schema: "cip");

            migrationBuilder.DropTable(
                name: "CASE_T",
                schema: "cip");

            migrationBuilder.DropTable(
                name: "CONTRACT_T",
                schema: "cm");

            migrationBuilder.DropTable(
                name: "CONTRACT_VERSION_T",
                schema: "cm");

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
                name: "IMPORT_JOB_ROW_T",
                schema: "cm");

            migrationBuilder.DropTable(
                name: "INVITATION_ATTEMPT_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "LANGUAGE_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "LANGUAGE_TEXT_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "LOA_DOCUMENT_T",
                schema: "trk");

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
                name: "NOTIFICATION_RECIPIENT_STATE_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "NOTIFICATION_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "PROPOSAL_ACTIVITY_T",
                schema: "trk");

            migrationBuilder.DropTable(
                name: "PROPOSAL_T",
                schema: "trk");

            migrationBuilder.DropTable(
                name: "REMINDER_T",
                schema: "cm");

            migrationBuilder.DropTable(
                name: "ROLE_CLAIMS_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "ROLE_PERMISSION_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "SETTING_T",
                schema: "core");

            migrationBuilder.DropTable(
                name: "SHAREPOINT_DOC_T",
                schema: "cm");

            migrationBuilder.DropTable(
                name: "STATE_T",
                schema: "cip");

            migrationBuilder.DropTable(
                name: "STATE_T",
                schema: "cm");

            migrationBuilder.DropTable(
                name: "STATE_T",
                schema: "trk");

            migrationBuilder.DropTable(
                name: "USER_CLAIMS_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "USER_LOGINS_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "USER_ROLE_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "USER_ROLES_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "USER_TOKENS_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_BRAND_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_CERTIFICATE_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_DOCUMENT_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_KBLI_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_PORTFOLIO_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_SPECIAL_REQUIREMENT_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_STATUS_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_SUBCLASSIFICATION_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "IMPORT_JOB_T",
                schema: "cm");

            migrationBuilder.DropTable(
                name: "INVITATION_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "PERMISSION_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "ROLE_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "USER_T",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "ROLES_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_USER_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "USERS_T",
                schema: "vdr");

            migrationBuilder.DropTable(
                name: "VENDOR_T",
                schema: "vdr");
        }
    }
}
