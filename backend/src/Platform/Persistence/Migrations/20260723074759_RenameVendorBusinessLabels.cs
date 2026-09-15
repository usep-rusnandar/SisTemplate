using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameVendorBusinessLabels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Business-language rename of the Vendor Management function → Vendor Onboarding on already-
            // seeded data. Surgical REPLACE of the "Vendor Management"/"VENDOR MGMT" token only — the
            // unrelated "Contract Management" titles are never touched (different substring).
            migrationBuilder.Sql("""
                UPDATE [iam].[USER_T] SET [Department] = REPLACE([Department], 'VENDOR MANAGEMENT', 'VENDOR ONBOARDING')
                WHERE [Department] LIKE '%VENDOR MANAGEMENT%';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[USER_T]
                SET [Position] = REPLACE(REPLACE([Position], 'VENDOR MANAGEMENT', 'VENDOR ONBOARDING'), 'VENDOR MGMT', 'VENDOR ONBOARDING')
                WHERE [Position] LIKE '%VENDOR MANAGEMENT%' OR [Position] LIKE '%VENDOR MGMT%';
                """);
            migrationBuilder.Sql("""
                UPDATE [core].[EMAIL_TEMPLATE_T] SET [PayloadJson] = REPLACE([PayloadJson], 'Vendor Management', 'Vendor Onboarding')
                WHERE [PayloadJson] LIKE '%Vendor Management%';
                """);
            migrationBuilder.Sql("""
                UPDATE [core].[SETTING_T] SET [ValueJson] = REPLACE([ValueJson], 'Vendor Management', 'Vendor Onboarding')
                WHERE [ValueJson] LIKE '%Vendor Management%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [core].[SETTING_T] SET [ValueJson] = REPLACE([ValueJson], 'Vendor Onboarding', 'Vendor Management')
                WHERE [ValueJson] LIKE '%Vendor Onboarding%';
                """);
            migrationBuilder.Sql("""
                UPDATE [core].[EMAIL_TEMPLATE_T] SET [PayloadJson] = REPLACE([PayloadJson], 'Vendor Onboarding', 'Vendor Management')
                WHERE [PayloadJson] LIKE '%Vendor Onboarding%';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[USER_T] SET [Department] = REPLACE([Department], 'VENDOR ONBOARDING', 'VENDOR MANAGEMENT')
                WHERE [Department] LIKE '%VENDOR ONBOARDING%';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[USER_T] SET [Position] = REPLACE([Position], 'VENDOR ONBOARDING', 'VENDOR MANAGEMENT')
                WHERE [Position] LIKE '%VENDOR ONBOARDING%';
                """);
        }
    }
}
