using IntegratedProcurement.Platform.Audit.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(EntityTypeBuilder<AuditLogEntry> builder)
    {
        builder.ToTable("AUDIT_LOG_T", DatabaseSchemas.Core);

        builder.HasKey(item => item.Id);
        builder.Property(item => item.Action).HasMaxLength(80).IsRequired();
        builder.Property(item => item.ActorName).HasMaxLength(200).IsRequired();
        builder.Property(item => item.Module).HasMaxLength(120).IsRequired();
        builder.Property(item => item.Description).HasMaxLength(1000).IsRequired();
        builder.Property(item => item.IpAddress).HasMaxLength(64).IsRequired();
        builder.Property(item => item.UserAgent).HasMaxLength(1000);
        builder.Property(item => item.MetadataJson);

        builder.HasIndex(item => item.OccurredAt);
        builder.HasIndex(item => item.Module);
        builder.HasIndex(item => item.ActorName);
    }
}
