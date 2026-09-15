using IntegratedProcurement.BuildingBlocks.Application.Abstractions;
using IntegratedProcurement.BuildingBlocks.Domain.Entities;
using IntegratedProcurement.BuildingBlocks.Domain.Events;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Administration.Domain;
using IntegratedProcurement.Platform.Audit.Domain;
using IntegratedProcurement.Platform.Notifications.Domain;
using IntegratedProcurement.Platform.Persistence.FrontendState;
using IntegratedProcurement.Platform.Settings.Domain;
using IntegratedProcurement.Platform.InternalIdentity.Domain;
using IntegratedProcurement.Platform.Persistence.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Platform.Persistence;

public sealed class ProcurementDbContext
    : IdentityDbContext<VendorIdentityUser, VendorIdentityRole, string>
{
    private static readonly CurrentActor FallbackActor = new(
        ActorType.System,
        "SYSTEM",
        "System",
        [],
        []);

    private readonly IClock? _clock;
    private readonly ICurrentActor? _currentActor;

    public ProcurementDbContext(
        DbContextOptions<ProcurementDbContext> options,
        IClock? clock = null,
        ICurrentActor? currentActor = null)
        : base(options)
    {
        _clock = clock;
        _currentActor = currentActor;
    }

    public DbSet<InternalUser> InternalUsers => Set<InternalUser>();

    public DbSet<InternalRole> InternalRoles => Set<InternalRole>();

    public DbSet<InternalUserRole> InternalUserRoles => Set<InternalUserRole>();

    public DbSet<PermissionDefinition> Permissions => Set<PermissionDefinition>();

    public DbSet<InternalRolePermissionAssignment> InternalRolePermissions => Set<InternalRolePermissionAssignment>();

    public DbSet<Vendor> Vendors => Set<Vendor>();

    public DbSet<VendorUser> VendorUsers => Set<VendorUser>();

    public DbSet<VendorStatusHistory> VendorStatusHistory => Set<VendorStatusHistory>();

    public DbSet<VendorDocument> VendorDocuments => Set<VendorDocument>();

    public DbSet<VendorImportBatch> VendorImportBatches => Set<VendorImportBatch>();

    public DbSet<VendorImportRow> VendorImportRows => Set<VendorImportRow>();

    public DbSet<VendorExternalReference> VendorExternalReferences => Set<VendorExternalReference>();

    public DbSet<VendorCertificate> VendorCertificates => Set<VendorCertificate>();

    public DbSet<VendorKbli> VendorKblis => Set<VendorKbli>();

    public DbSet<VendorBrand> VendorBrands => Set<VendorBrand>();

    public DbSet<VendorPortfolio> VendorPortfolios => Set<VendorPortfolio>();

    public DbSet<VendorSpecialRequirement> VendorSpecialRequirements => Set<VendorSpecialRequirement>();

    public DbSet<VendorSubClassification> VendorSubClassifications => Set<VendorSubClassification>();

    public DbSet<Invitation> Invitations => Set<Invitation>();

    public DbSet<InvitationAttempt> InvitationAttempts => Set<InvitationAttempt>();

    public DbSet<FrontendStateEntry> FrontendStates => Set<FrontendStateEntry>();

    public DbSet<TrackerStateEntry> TrackerStates => Set<TrackerStateEntry>();

    public DbSet<TrackerProposal> TrackerProposals => Set<TrackerProposal>();

    public DbSet<TrackerProposalActivity> TrackerProposalActivities => Set<TrackerProposalActivity>();

    public DbSet<TrackerLoaDocument> TrackerLoaDocuments => Set<TrackerLoaDocument>();

    public DbSet<ProposalAwardResult> ProposalAwardResults => Set<ProposalAwardResult>();

    public DbSet<ProposalAwardResultVendor> ProposalAwardResultVendors => Set<ProposalAwardResultVendor>();

    public DbSet<CipStateEntry> CipStates => Set<CipStateEntry>();

    public DbSet<CipCase> CipCases => Set<CipCase>();

    public DbSet<CipCaseDocument> CipCaseDocuments => Set<CipCaseDocument>();

    public DbSet<CipCaseActivity> CipCaseActivities => Set<CipCaseActivity>();

    public DbSet<ContractMonitoringStateEntry> ContractMonitoringStates => Set<ContractMonitoringStateEntry>();

    public DbSet<Contract> Contracts => Set<Contract>();

    public DbSet<ContractVersion> ContractVersions => Set<ContractVersion>();

    public DbSet<ContractReminder> ContractReminders => Set<ContractReminder>();

    public DbSet<SharePointDocument> SharePointDocuments => Set<SharePointDocument>();

    public DbSet<ImportJob> ImportJobs => Set<ImportJob>();

    public DbSet<ImportJobRow> ImportJobRows => Set<ImportJobRow>();

    public DbSet<ContractMaterial> ContractMaterials => Set<ContractMaterial>();

    public DbSet<MaterialSyncFile> MaterialSyncFiles => Set<MaterialSyncFile>();

    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();

    public DbSet<MenuTreeEntry> MenuTrees => Set<MenuTreeEntry>();

    public DbSet<ApplicationAboutEntry> ApplicationAbout => Set<ApplicationAboutEntry>();

    public DbSet<SettingEntry> Settings => Set<SettingEntry>();

    public DbSet<MasterDataSetEntry> MasterDataSets => Set<MasterDataSetEntry>();

    public DbSet<MasterDataRecordEntry> MasterDataRecords => Set<MasterDataRecordEntry>();

    public DbSet<LanguageEntry> Languages => Set<LanguageEntry>();

    public DbSet<LanguageTextEntry> LanguageTextEntries => Set<LanguageTextEntry>();

    public DbSet<EmailTemplateEntry> EmailTemplates => Set<EmailTemplateEntry>();

    public DbSet<EmailSentEntry> EmailSentEntries => Set<EmailSentEntry>();

    public DbSet<NotificationEntry> Notifications => Set<NotificationEntry>();

    public DbSet<NotificationRecipientState> NotificationRecipientStates => Set<NotificationRecipientState>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        IgnoreDomainEvents(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ProcurementDbContext).Assembly);
        ConfigureIdentityTables(builder);
        ApplyDatabaseObjectConventions(builder);
    }

    private static void IgnoreDomainEvents(ModelBuilder builder)
    {
        builder.Ignore<DomainEvent>();
        foreach (var entityType in builder.Model.GetEntityTypes()
            .Where(entityType => typeof(Entity).IsAssignableFrom(entityType.ClrType)
                || InheritsGenericEntity(entityType.ClrType)))
        {
            builder.Entity(entityType.ClrType).Ignore(nameof(Entity.DomainEvents));
        }
    }

    private static bool InheritsGenericEntity(Type type)
    {
        for (var t = type.BaseType; t is not null; t = t.BaseType)
        {
            if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(Entity<>))
            {
                return true;
            }
        }

        return false;
    }

    public override int SaveChanges()
    {
        ApplyAuditFields();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    private static void ConfigureIdentityTables(ModelBuilder builder)
    {
        // Vendor identity mirrors the legacy VendorConnect APP_* tables: string(10) user key
        // (== VendorId for a vendor's primary account), string(5) role key, same custom columns —
        // so legacy accounts (incl. password hashes) migrate 1:1.
        builder.Entity<VendorIdentityUser>(entity =>
        {
            entity.ToTable("USERS_T", DatabaseSchemas.Vendor, table =>
            {
                table.HasCheckConstraint(
                    "CK_USERS_T_STATUS",
                    "[Status] IN ('Active','Inactive','Suspended')");
            });
            entity.Property(user => user.Id).HasMaxLength(10);
            entity.Property(user => user.CompleteName).HasMaxLength(100).IsRequired();
            entity.Property(user => user.Position).HasMaxLength(100);
            entity.Property(user => user.Status).HasMaxLength(32).IsRequired().HasDefaultValue("Active");
            entity.HasIndex(user => user.NormalizedEmail)
                .HasDatabaseName("IX_USERS_T_NORMALIZED_EMAIL")
                .HasFilter("[NormalizedEmail] IS NOT NULL");
            entity.HasIndex(user => user.NormalizedUserName)
                .HasDatabaseName("IX_USERS_T_NORMALIZED_USER_NAME")
                .IsUnique()
                .HasFilter("[NormalizedUserName] IS NOT NULL");
        });

        builder.Entity<VendorIdentityRole>(entity =>
        {
            entity.ToTable("ROLES_T", DatabaseSchemas.Vendor);
            entity.Property(role => role.Id).HasMaxLength(5);
            entity.Property(role => role.Description).HasMaxLength(100);
            entity.HasIndex(role => role.NormalizedName)
                .HasDatabaseName("IX_ROLES_T_NORMALIZED_NAME")
                .IsUnique()
                .HasFilter("[NormalizedName] IS NOT NULL");
            entity.HasData(
                new VendorIdentityRole(VendorIdentityRoleNames.VendorRoleId, VendorIdentityRoleNames.Vendor)
                {
                    Description = "Role Vendor",
                    ConcurrencyStamp = "legacy-vndor"
                });
        });

        builder.Entity<IdentityUserRole<string>>().ToTable("USER_ROLES_T", DatabaseSchemas.Vendor);
        builder.Entity<IdentityUserClaim<string>>().ToTable("USER_CLAIMS_T", DatabaseSchemas.Vendor);
        builder.Entity<IdentityUserLogin<string>>().ToTable("USER_LOGINS_T", DatabaseSchemas.Vendor);
        builder.Entity<IdentityUserToken<string>>().ToTable("USER_TOKENS_T", DatabaseSchemas.Vendor);
        builder.Entity<IdentityRoleClaim<string>>().ToTable("ROLE_CLAIMS_T", DatabaseSchemas.Vendor);
    }

    private void ApplyAuditFields()
    {
        var now = _clock?.UtcNow ?? DateTimeOffset.UtcNow;
        var actor = _currentActor?.Actor ?? FallbackActor;
        var actorId = actor.ActorId;

        foreach (var entry in ChangeTracker.Entries<IAuditable>())
        {
            if (entry.State == EntityState.Added)
            {
                // Respect explicitly pre-set CreatedAt/CreatedBy (backdated or explicit-actor
                // history rows, e.g. VENDOR_STATUS_T); stamp otherwise.
                var createdAt = entry.Property(nameof(IAuditable.CreatedAt));
                if (createdAt.CurrentValue is not DateTimeOffset preset || preset == default)
                {
                    createdAt.CurrentValue = now;
                }

                var createdBy = entry.Property(nameof(IAuditable.CreatedBy));
                if (string.IsNullOrWhiteSpace(createdBy.CurrentValue as string))
                {
                    createdBy.CurrentValue = actorId;
                }
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Property(nameof(IAuditable.UpdatedAt)).CurrentValue = now;
                entry.Property(nameof(IAuditable.UpdatedBy)).CurrentValue = actorId;
            }
        }
    }

    private static void ApplyDatabaseObjectConventions(ModelBuilder builder)
    {
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                // Respect explicit HasColumnName (legacy PK columns like VendorId / VendorKbliId).
                if (property.FindAnnotation("Relational:ColumnName") is null)
                {
                    property.SetColumnName(ToPascalCase(property.Name));
                }
            }

            foreach (var key in entityType.GetKeys())
            {
                key.SetName(ToUpperSnakeCase(key.GetName() ?? $"PK_{entityType.GetTableName()}"));
            }

            foreach (var foreignKey in entityType.GetForeignKeys())
            {
                foreignKey.SetConstraintName(ToUpperSnakeCase(
                    foreignKey.GetConstraintName() ?? $"FK_{entityType.GetTableName()}"));
            }

            foreach (var index in entityType.GetIndexes())
            {
                index.SetDatabaseName(ToUpperSnakeCase(
                    index.GetDatabaseName() ?? $"IX_{entityType.GetTableName()}"));
            }
        }
    }

    private static string ToUpperSnakeCase(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        var characters = new List<char>(value.Length + 8);
        for (var index = 0; index < value.Length; index++)
        {
            var current = value[index];
            if (index > 0
                && char.IsUpper(current)
                && value[index - 1] != '_'
                && (char.IsLower(value[index - 1])
                    || (index + 1 < value.Length && char.IsLower(value[index + 1]))))
            {
                characters.Add('_');
            }

            characters.Add(char.ToUpperInvariant(current));
        }

        return new string(characters.ToArray());
    }

    private static string ToPascalCase(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        if (!value.Contains('_', StringComparison.Ordinal))
        {
            return char.ToUpperInvariant(value[0]) + value[1..];
        }

        var parts = value
            .Split('_', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => part.Length == 1
                ? part.ToUpperInvariant()
                : char.ToUpperInvariant(part[0]) + part[1..].ToLowerInvariant());

        return string.Concat(parts);
    }
}
