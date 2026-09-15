using IntegratedProcurement.Platform.InternalIdentity.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class InternalUserConfiguration : IEntityTypeConfiguration<InternalUser>
{
    public void Configure(EntityTypeBuilder<InternalUser> builder)
    {
        builder.ToTable("USER_T", DatabaseSchemas.InternalIdentity, table =>
        {
            table.HasCheckConstraint("CK_USER_T_STATUS", "[Status] IN ('Active','Inactive','Suspended')");
        });

        builder.HasKey(user => user.Id);
        builder.Property(user => user.PersonnelNo).HasMaxLength(20).IsRequired();
        builder.Property(user => user.CompleteName).HasMaxLength(200).IsRequired();
        builder.Property(user => user.Email).HasMaxLength(256);
        builder.Property(user => user.Department).HasMaxLength(100);
        builder.Property(user => user.Position).HasMaxLength(100);
        builder.Property(user => user.Status).HasMaxLength(32).IsRequired();
        builder.Property(user => user.PasswordHash);
        builder.Property(user => user.SecurityStamp).HasMaxLength(64);
        builder.Property(user => user.LockoutEnd);
        builder.Property(user => user.AccessFailedCount).IsRequired();
        builder.Property(user => user.MustChangePassword).IsRequired();
        builder.Property(user => user.PasswordSetAt);
        builder.Property(user => user.CreatedBy).HasMaxLength(100);
        builder.Property(user => user.UpdatedBy).HasMaxLength(100);
        builder.Property(user => user.DeletedBy).HasMaxLength(100);

        // SQL Server rejects ON DELETE SET NULL on self-referencing FKs (multiple cascade paths).
        builder.HasOne<InternalUser>()
            .WithMany()
            .HasForeignKey(user => user.ManagerUserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(user => user.PersonnelNo)
            .IsUnique()
            .HasFilter("[DeletedAt] IS NULL");
        builder.HasIndex(user => user.ManagerUserId)
            .HasDatabaseName("IX_USER_T_MANAGER");
    }
}

public sealed class InternalRoleConfiguration : IEntityTypeConfiguration<InternalRole>
{
    public void Configure(EntityTypeBuilder<InternalRole> builder)
    {
        builder.ToTable("ROLE_T", DatabaseSchemas.InternalIdentity);

        builder.HasKey(role => role.Id);
        builder.Property(role => role.Code).HasMaxLength(100).IsRequired();
        builder.Property(role => role.Name).HasMaxLength(200).IsRequired();
        builder.Property(role => role.ModuleKey).HasMaxLength(100);
        builder.Property(role => role.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasIndex(role => role.Code).IsUnique();
    }
}

public sealed class InternalUserRoleConfiguration : IEntityTypeConfiguration<InternalUserRole>
{
    public void Configure(EntityTypeBuilder<InternalUserRole> builder)
    {
        builder.ToTable("USER_ROLE_T", DatabaseSchemas.InternalIdentity);

        builder.HasKey(userRole => userRole.Id);
        builder.Property(userRole => userRole.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasOne<InternalUser>()
            .WithMany()
            .HasForeignKey(userRole => userRole.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<InternalRole>()
            .WithMany()
            .HasForeignKey(userRole => userRole.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(userRole => new { userRole.UserId, userRole.RoleId }).IsUnique();
    }
}

public sealed class PermissionConfiguration : IEntityTypeConfiguration<PermissionDefinition>
{
    public void Configure(EntityTypeBuilder<PermissionDefinition> builder)
    {
        builder.ToTable("PERMISSION_T", DatabaseSchemas.InternalIdentity);

        builder.HasKey(permission => permission.Id);
        builder.Property(permission => permission.Key).HasMaxLength(200).IsRequired();
        builder.Property(permission => permission.ModuleKey).HasMaxLength(100).IsRequired();
        builder.Property(permission => permission.Name).HasMaxLength(200).IsRequired();
        builder.Property(permission => permission.Description).HasMaxLength(500);

        builder.HasIndex(permission => permission.Key).IsUnique();
    }
}

public sealed class InternalRolePermissionConfiguration : IEntityTypeConfiguration<InternalRolePermissionAssignment>
{
    public void Configure(EntityTypeBuilder<InternalRolePermissionAssignment> builder)
    {
        builder.ToTable("ROLE_PERMISSION_T", DatabaseSchemas.InternalIdentity);

        builder.HasKey(rolePermission => rolePermission.Id);

        builder.HasOne<InternalRole>()
            .WithMany()
            .HasForeignKey(rolePermission => rolePermission.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<PermissionDefinition>()
            .WithMany()
            .HasForeignKey(rolePermission => rolePermission.PermissionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(rolePermission => new { rolePermission.RoleId, rolePermission.PermissionId })
            .IsUnique();
    }
}
