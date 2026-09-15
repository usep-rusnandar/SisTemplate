using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class TrackerStateConfiguration : IEntityTypeConfiguration<TrackerStateEntry>
{
    public void Configure(EntityTypeBuilder<TrackerStateEntry> builder)
    {
        builder.ToTable("STATE_T", DatabaseSchemas.ProposalTracker);
        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.StorageKey).HasMaxLength(256).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt);
        builder.HasIndex(entry => entry.StorageKey).IsUnique();
    }
}

public sealed class CipStateConfiguration : IEntityTypeConfiguration<CipStateEntry>
{
    public void Configure(EntityTypeBuilder<CipStateEntry> builder)
    {
        builder.ToTable("STATE_T", DatabaseSchemas.ContractInitiationPlatform);
        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.StorageKey).HasMaxLength(256).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt);
        builder.HasIndex(entry => entry.StorageKey).IsUnique();
    }
}

public sealed class ContractMonitoringStateConfiguration : IEntityTypeConfiguration<ContractMonitoringStateEntry>
{
    public void Configure(EntityTypeBuilder<ContractMonitoringStateEntry> builder)
    {
        builder.ToTable("STATE_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.StorageKey).HasMaxLength(256).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt);
        builder.HasIndex(entry => entry.StorageKey).IsUnique();
    }
}
