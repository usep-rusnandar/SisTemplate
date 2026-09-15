using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class ContractConfiguration : IEntityTypeConfiguration<Contract>
{
    public void Configure(EntityTypeBuilder<Contract> builder)
    {
        builder.ToTable("CONTRACT_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.ContractKey).HasMaxLength(100).IsRequired();
        builder.Property(item => item.SupplierName).HasMaxLength(300).IsRequired();
        builder.Property(item => item.Title).HasMaxLength(500).IsRequired();
        builder.Property(item => item.Classification).HasMaxLength(200);
        builder.Property(item => item.SubClass).HasMaxLength(200);
        builder.Property(item => item.Jobsite).HasMaxLength(100);
        builder.Property(item => item.Template).HasMaxLength(120);
        builder.Property(item => item.Frequency).HasMaxLength(100);
        builder.Property(item => item.Owner).HasMaxLength(200);
        builder.Property(item => item.UserDepartment).HasMaxLength(200);
        builder.Property(item => item.PicNames).HasMaxLength(300);
        builder.Property(item => item.PicEmail).HasMaxLength(320);
        builder.Property(item => item.ContractValue).HasPrecision(18, 2);
        builder.Property(item => item.Ownership).HasMaxLength(100);
        builder.Property(item => item.SystemNumbersJson).HasMaxLength(1000);
        builder.Property(item => item.DocumentLink).HasMaxLength(1000);
        builder.Property(item => item.PriceAdjustment).HasMaxLength(1000);
        builder.Property(item => item.Status).HasMaxLength(64).IsRequired();
        builder.Property(item => item.LatestVersionType).HasMaxLength(100);
        builder.Property(item => item.PayloadJson).IsRequired();

        builder.HasIndex(item => item.ContractKey).IsUnique();
        builder.HasIndex(item => item.Status);
        builder.HasIndex(item => item.CurrentExpiryDate);
        builder.HasIndex(item => item.PicEmail);
    }
}

public sealed class ContractVersionConfiguration : IEntityTypeConfiguration<ContractVersion>
{
    public void Configure(EntityTypeBuilder<ContractVersion> builder)
    {
        builder.ToTable("CONTRACT_VERSION_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.ContractKey).HasMaxLength(100).IsRequired();
        builder.Property(item => item.VersionKey).HasMaxLength(160).IsRequired();
        builder.Property(item => item.VersionType).HasMaxLength(100).IsRequired();
        builder.Property(item => item.Title).HasMaxLength(500).IsRequired();
        builder.Property(item => item.Status).HasMaxLength(64).IsRequired();
        builder.Property(item => item.ContractValue).HasPrecision(18, 2);
        builder.Property(item => item.SupplierName).HasMaxLength(300);
        builder.Property(item => item.Jobsite).HasMaxLength(100);
        builder.Property(item => item.Classification).HasMaxLength(200);
        builder.Property(item => item.SubClass).HasMaxLength(200);
        builder.Property(item => item.Template).HasMaxLength(120);
        builder.Property(item => item.Frequency).HasMaxLength(100);
        builder.Property(item => item.Owner).HasMaxLength(200);
        builder.Property(item => item.UserDepartment).HasMaxLength(200);
        builder.Property(item => item.PicNames).HasMaxLength(300);
        builder.Property(item => item.PicEmail).HasMaxLength(320);
        builder.Property(item => item.Ownership).HasMaxLength(100);
        builder.Property(item => item.SystemNumbersJson).HasMaxLength(1000);
        builder.Property(item => item.DocumentLink).HasMaxLength(1000);
        builder.Property(item => item.PriceAdjustment).HasMaxLength(1000);
        builder.Property(item => item.PayloadJson).IsRequired();

        builder.HasIndex(item => new { item.ContractKey, item.VersionKey }).IsUnique();
        builder.HasIndex(item => item.ContractKey);
        builder.HasIndex(item => item.ExpiredDate);
    }
}

public sealed class ImportJobConfiguration : IEntityTypeConfiguration<ImportJob>
{
    public void Configure(EntityTypeBuilder<ImportJob> builder)
    {
        builder.ToTable("IMPORT_JOB_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.BatchCode).HasMaxLength(32).IsRequired();
        builder.Property(item => item.FileName).HasMaxLength(400).IsRequired();
        builder.Property(item => item.StartedByPersonnelNo).HasMaxLength(40);
        builder.Property(item => item.StartedByName).HasMaxLength(200);
        builder.Property(item => item.Status).HasMaxLength(40).IsRequired();

        builder.HasIndex(item => item.Status);
        builder.HasIndex(item => item.CreatedAt);
    }
}

public sealed class ImportJobRowConfiguration : IEntityTypeConfiguration<ImportJobRow>
{
    public void Configure(EntityTypeBuilder<ImportJobRow> builder)
    {
        builder.ToTable("IMPORT_JOB_ROW_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.ContractId).HasMaxLength(100).IsRequired();
        builder.Property(item => item.Title).HasMaxLength(500).IsRequired();
        builder.Property(item => item.Supplier).HasMaxLength(300).IsRequired();
        builder.Property(item => item.SharingLink).HasMaxLength(1000);
        builder.Property(item => item.State).HasMaxLength(40).IsRequired();
        builder.Property(item => item.BlobContainer).HasMaxLength(120);
        builder.Property(item => item.BlobKey).HasMaxLength(400);
        builder.Property(item => item.FailReason).HasMaxLength(500);

        builder.HasOne<ImportJob>().WithMany().HasForeignKey(item => item.JobId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(item => new { item.JobId, item.State });
        builder.HasIndex(item => new { item.JobId, item.RowIndex });
    }
}

public sealed class SharePointDocumentConfiguration : IEntityTypeConfiguration<SharePointDocument>
{
    public void Configure(EntityTypeBuilder<SharePointDocument> builder)
    {
        builder.ToTable("SHAREPOINT_DOC_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.LinkHash).HasMaxLength(64).IsRequired();
        builder.Property(item => item.SharingLink).HasMaxLength(1000).IsRequired();
        builder.Property(item => item.Container).HasMaxLength(120).IsRequired();
        builder.Property(item => item.BlobKey).HasMaxLength(400).IsRequired();
        builder.Property(item => item.FileName).HasMaxLength(400);
        builder.Property(item => item.ContentType).HasMaxLength(160);

        builder.HasIndex(item => item.LinkHash).IsUnique();
    }
}

public sealed class ContractReminderConfiguration : IEntityTypeConfiguration<ContractReminder>
{
    public void Configure(EntityTypeBuilder<ContractReminder> builder)
    {
        builder.ToTable("REMINDER_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.ContractKey).HasMaxLength(100).IsRequired();
        builder.Property(item => item.ReminderKey).HasMaxLength(200).IsRequired();
        builder.Property(item => item.Tier).HasMaxLength(32).IsRequired();
        builder.Property(item => item.Trigger).HasMaxLength(64).IsRequired();
        builder.Property(item => item.PayloadJson).IsRequired();

        builder.HasIndex(item => item.ReminderKey).IsUnique();
        builder.HasIndex(item => new { item.ContractKey, item.Tier });
        builder.HasIndex(item => item.SentAt);
    }
}

public sealed class ContractMaterialConfiguration : IEntityTypeConfiguration<ContractMaterial>
{
    public void Configure(EntityTypeBuilder<ContractMaterial> builder)
    {
        builder.ToTable("CONTRACT_MATERIAL_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.ContractKey).HasMaxLength(100).IsRequired();
        builder.Property(item => item.MaterialNumber).HasMaxLength(80).IsRequired();
        builder.Property(item => item.Description).HasMaxLength(500).IsRequired();
        builder.Property(item => item.Site).HasMaxLength(100).IsRequired();
        builder.Property(item => item.Currency).HasMaxLength(16).IsRequired();
        builder.Property(item => item.UnitPrice).HasPrecision(18, 4);

        builder.HasIndex(item => item.ContractKey);
        builder.HasIndex(item => new { item.ContractKey, item.SortOrder });
        builder.HasIndex(item => new { item.ContractKey, item.MaterialNumber });
    }
}

public sealed class MaterialSyncFileConfiguration : IEntityTypeConfiguration<MaterialSyncFile>
{
    public void Configure(EntityTypeBuilder<MaterialSyncFile> builder)
    {
        builder.ToTable("MATERIAL_SYNC_FILE_T", DatabaseSchemas.ContractMonitoring);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.ContractKey).HasMaxLength(100).IsRequired();
        builder.Property(item => item.FileName).HasMaxLength(400).IsRequired();
        builder.Property(item => item.SourceType).HasMaxLength(40).IsRequired();

        builder.HasIndex(item => item.ContractKey).IsUnique();
        builder.HasIndex(item => item.FileName);
    }
}
