using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameCipIntelligentToInitiation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Module rename contractIntelligentPlatform → contractInitiationPlatform (display "Contract
            // Intelligent Platform" → "Contract Initiation Platform"). Data-only, in-place: permission rows
            // keep their Guids so ROLE_PERMISSION_T grants (FK-by-id) stay valid — no role loses access.
            // Acronym-based names (schema 'cip', ag_cip_* keys) are unchanged and untouched here.
            migrationBuilder.Sql("""
                UPDATE [iam].[PERMISSION_T]
                SET [Key] = REPLACE([Key], 'contractIntelligentPlatform.', 'contractInitiationPlatform.'),
                    [ModuleKey] = 'contractInitiationPlatform'
                WHERE [ModuleKey] = 'contractIntelligentPlatform';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[ROLE_T]
                SET [ModuleKey] = 'contractInitiationPlatform',
                    [Name] = REPLACE([Name], 'Contract Intelligent Platform', 'Contract Initiation Platform')
                WHERE [ModuleKey] = 'contractIntelligentPlatform';
                """);
            // Saved frontend state (e.g. a customized menu blob) that embedded the old key / slug / label.
            migrationBuilder.Sql("""
                UPDATE [core].[FRONTEND_STATE_T]
                SET [Value] = REPLACE(REPLACE(REPLACE([Value],
                        'contract-intelligent-platform', 'contract-initiation-platform'),
                        'contractIntelligentPlatform', 'contractInitiationPlatform'),
                        'Contract Intelligent Platform', 'Contract Initiation Platform')
                WHERE [Value] LIKE '%ntelligent%';
                """);
            // Settings + email templates that reference the module by key or display name.
            migrationBuilder.Sql("""
                UPDATE [core].[SETTING_T]
                SET [ValueJson] = REPLACE(REPLACE(REPLACE([ValueJson],
                        'contract-intelligent-platform', 'contract-initiation-platform'),
                        'contractIntelligentPlatform', 'contractInitiationPlatform'),
                        'Contract Intelligent Platform', 'Contract Initiation Platform')
                WHERE [ValueJson] LIKE '%ntelligent%';
                """);
            migrationBuilder.Sql("""
                UPDATE [core].[EMAIL_TEMPLATE_T]
                SET [Category] = REPLACE([Category], 'Contract Intelligent Platform', 'Contract Initiation Platform'),
                    [PayloadJson] = REPLACE([PayloadJson], 'Contract Intelligent Platform', 'Contract Initiation Platform')
                WHERE [Category] LIKE '%ntelligent%' OR [PayloadJson] LIKE '%Contract Intelligent Platform%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [core].[EMAIL_TEMPLATE_T]
                SET [Category] = REPLACE([Category], 'Contract Initiation Platform', 'Contract Intelligent Platform'),
                    [PayloadJson] = REPLACE([PayloadJson], 'Contract Initiation Platform', 'Contract Intelligent Platform')
                WHERE [Category] LIKE '%nitiation%' OR [PayloadJson] LIKE '%Contract Initiation Platform%';
                """);
            migrationBuilder.Sql("""
                UPDATE [core].[SETTING_T]
                SET [ValueJson] = REPLACE(REPLACE(REPLACE([ValueJson],
                        'contract-initiation-platform', 'contract-intelligent-platform'),
                        'contractInitiationPlatform', 'contractIntelligentPlatform'),
                        'Contract Initiation Platform', 'Contract Intelligent Platform')
                WHERE [ValueJson] LIKE '%nitiation%';
                """);
            migrationBuilder.Sql("""
                UPDATE [core].[FRONTEND_STATE_T]
                SET [Value] = REPLACE(REPLACE(REPLACE([Value],
                        'contract-initiation-platform', 'contract-intelligent-platform'),
                        'contractInitiationPlatform', 'contractIntelligentPlatform'),
                        'Contract Initiation Platform', 'Contract Intelligent Platform')
                WHERE [Value] LIKE '%nitiation%';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[ROLE_T]
                SET [ModuleKey] = 'contractIntelligentPlatform',
                    [Name] = REPLACE([Name], 'Contract Initiation Platform', 'Contract Intelligent Platform')
                WHERE [ModuleKey] = 'contractInitiationPlatform';
                """);
            migrationBuilder.Sql("""
                UPDATE [iam].[PERMISSION_T]
                SET [Key] = REPLACE([Key], 'contractInitiationPlatform.', 'contractIntelligentPlatform.'),
                    [ModuleKey] = 'contractIntelligentPlatform'
                WHERE [ModuleKey] = 'contractInitiationPlatform';
                """);
        }
    }
}
