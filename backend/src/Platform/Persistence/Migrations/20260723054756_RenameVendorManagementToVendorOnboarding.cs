using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameVendorManagementToVendorOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Module rename vendorManagement → vendorOnboarding. Data-only, in-place: permission rows keep
            // their Guids so ROLE_PERMISSION_T grants (FK-by-id) stay valid — no role loses access.
            migrationBuilder.Sql("""
                UPDATE [iam].[PERMISSION_T]
                SET [Key] = REPLACE([Key], 'vendorManagement.', 'vendorOnboarding.'),
                    [ModuleKey] = 'vendorOnboarding'
                WHERE [ModuleKey] = 'vendorManagement';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[ROLE_T]
                SET [ModuleKey] = 'vendorOnboarding',
                    [Name] = REPLACE([Name], 'Vendor Management', 'Vendor Onboarding')
                WHERE [ModuleKey] = 'vendorManagement';
                """);
            // Defensive sweep: any saved frontend state (e.g. a customized menu blob) that embedded the
            // old module key / slug.
            migrationBuilder.Sql("""
                UPDATE [core].[FRONTEND_STATE_T]
                SET [Value] = REPLACE(REPLACE([Value], 'vendorManagement', 'vendorOnboarding'), 'vendor-management', 'vendor-onboarding')
                WHERE [Value] LIKE '%vendorManagement%' OR [Value] LIKE '%vendor-management%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [core].[FRONTEND_STATE_T]
                SET [Value] = REPLACE(REPLACE([Value], 'vendorOnboarding', 'vendorManagement'), 'vendor-onboarding', 'vendor-management')
                WHERE [Value] LIKE '%vendorOnboarding%' OR [Value] LIKE '%vendor-onboarding%';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[ROLE_T]
                SET [ModuleKey] = 'vendorManagement',
                    [Name] = REPLACE([Name], 'Vendor Onboarding', 'Vendor Management')
                WHERE [ModuleKey] = 'vendorOnboarding';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[PERMISSION_T]
                SET [Key] = REPLACE([Key], 'vendorOnboarding.', 'vendorManagement.'),
                    [ModuleKey] = 'vendorManagement'
                WHERE [ModuleKey] = 'vendorOnboarding';
                """);
        }
    }
}
