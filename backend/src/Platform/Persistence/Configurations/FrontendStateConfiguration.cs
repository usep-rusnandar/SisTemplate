using SisTemplate.Platform.Persistence.FrontendState;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SisTemplate.Platform.Persistence.Configurations;

public sealed class FrontendStateConfiguration : IEntityTypeConfiguration<FrontendStateEntry>
{
    public void Configure(EntityTypeBuilder<FrontendStateEntry> builder)
    {
        builder.ToTable("FRONTEND_STATE_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Scope).HasMaxLength(100).IsRequired();
        builder.Property(entry => entry.Key).HasMaxLength(256).IsRequired();
        builder.Property(entry => entry.Value).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => new { entry.Scope, entry.Key }).IsUnique();
    }
}
