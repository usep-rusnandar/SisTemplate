using IntegratedProcurement.Platform.Persistence.ModuleState;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class ModuleStateConfiguration : IEntityTypeConfiguration<ModuleStateEntry>
{
    public void Configure(EntityTypeBuilder<ModuleStateEntry> builder)
    {
        builder.ToTable("MODULE_STATE_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.ModuleKey).HasMaxLength(100).IsRequired();
        builder.Property(entry => entry.StorageKey).HasMaxLength(256).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();
        builder.HasIndex(entry => new { entry.ModuleKey, entry.StorageKey }).IsUnique();
    }
}
