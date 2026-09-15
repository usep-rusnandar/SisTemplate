using SisTemplate.BuildingBlocks.Application.Abstractions;
using SisTemplate.BuildingBlocks.Domain.Entities;
using SisTemplate.BuildingBlocks.Domain.Events;
using SisTemplate.Platform.Administration.Domain;
using SisTemplate.Platform.Audit.Domain;
using SisTemplate.Platform.InternalIdentity.Domain;
using SisTemplate.Platform.Notifications.Domain;
using SisTemplate.Platform.Persistence.FrontendState;
using SisTemplate.Platform.Persistence.ModuleState;
using SisTemplate.Platform.Settings.Domain;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.Persistence;

public sealed class ProcurementDbContext : DbContext
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
    public DbSet<FrontendStateEntry> FrontendStates => Set<FrontendStateEntry>();
    public DbSet<ModuleStateEntry> ModuleStates => Set<ModuleStateEntry>();
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

    private void ApplyAuditFields()
    {
        var now = _clock?.UtcNow ?? DateTimeOffset.UtcNow;
        var actor = _currentActor?.Actor ?? FallbackActor;
        var actorId = actor.ActorId;

        foreach (var entry in ChangeTracker.Entries<IAuditable>())
        {
            if (entry.State == EntityState.Added)
            {
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
            if (index > 0 && char.IsUpper(current) && value[index - 1] != '_')
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

        return value.Length == 1
            ? value.ToUpperInvariant()
            : char.ToUpperInvariant(value[0]) + value[1..];
    }
}
