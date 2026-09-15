using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BreakDownMasterDataPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Master Data broken down per module: the single masterData.view/manage is replaced by
            // masterData.<module>.view|manage (seeded on startup + assigned to each module's Administrator).
            // Here we drop the old grants + definitions; SeedPermissions/SeedRolePermissions add the new ones.
            migrationBuilder.Sql("""
                DELETE rp FROM [iam].[ROLE_PERMISSION_T] rp
                INNER JOIN [iam].[PERMISSION_T] p ON p.[Id] = rp.[PermissionId]
                WHERE p.[Key] IN ('masterData.view', 'masterData.manage');
                """);
            migrationBuilder.Sql("""
                DELETE FROM [iam].[PERMISSION_T] WHERE [Key] IN ('masterData.view', 'masterData.manage');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore the legacy permission definitions (role grants are re-added by the old-code seeder).
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM [iam].[PERMISSION_T] WHERE [Key] = 'masterData.view')
                    INSERT INTO [iam].[PERMISSION_T] ([Id], [Key], [ModuleKey], [Name], [Description])
                    VALUES (NEWID(), 'masterData.view', 'masterData', 'View master data', 'Read master data sets and records');
                IF NOT EXISTS (SELECT 1 FROM [iam].[PERMISSION_T] WHERE [Key] = 'masterData.manage')
                    INSERT INTO [iam].[PERMISSION_T] ([Id], [Key], [ModuleKey], [Name], [Description])
                    VALUES (NEWID(), 'masterData.manage', 'masterData', 'Manage master data', 'Create and edit master data records');
                """);
            // Drop the per-module permissions + their grants.
            migrationBuilder.Sql("""
                DELETE rp FROM [iam].[ROLE_PERMISSION_T] rp
                INNER JOIN [iam].[PERMISSION_T] p ON p.[Id] = rp.[PermissionId]
                WHERE p.[Key] LIKE 'masterData.%.view' OR p.[Key] LIKE 'masterData.%.manage';
                """);
            migrationBuilder.Sql("""
                DELETE FROM [iam].[PERMISSION_T]
                WHERE [Key] LIKE 'masterData.%.view' OR [Key] LIKE 'masterData.%.manage';
                """);
        }
    }
}
