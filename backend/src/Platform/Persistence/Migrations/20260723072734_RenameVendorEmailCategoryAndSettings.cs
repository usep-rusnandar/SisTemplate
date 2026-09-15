using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameVendorEmailCategoryAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Follow-up to the module rename: seeded email-template category + per-module email sender
            // settings still used the old module key. Value "SIS – Vendor Management" (the team mailbox
            // display name) is intentionally left as-is — a business label, not the module identifier.
            migrationBuilder.Sql("""
                UPDATE [core].[SETTING_T]
                SET [Key] = REPLACE([Key], 'vendorManagement', 'vendorOnboarding')
                WHERE [Key] IN ('from_vendorManagement', 'mailbox_vendorManagement');
                """);
            migrationBuilder.Sql("""
                UPDATE [core].[EMAIL_TEMPLATE_T]
                SET [Category] = 'Vendor Onboarding'
                WHERE [Category] = 'Vendor Management';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [core].[EMAIL_TEMPLATE_T]
                SET [Category] = 'Vendor Management'
                WHERE [Category] = 'Vendor Onboarding';
                """);
            migrationBuilder.Sql("""
                UPDATE [core].[SETTING_T]
                SET [Key] = REPLACE([Key], 'vendorOnboarding', 'vendorManagement')
                WHERE [Key] IN ('from_vendorOnboarding', 'mailbox_vendorOnboarding');
                """);
        }
    }
}
