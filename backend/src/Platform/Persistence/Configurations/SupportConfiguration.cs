using IntegratedProcurement.Platform.Administration.Domain;
using IntegratedProcurement.Platform.Notifications.Domain;
using IntegratedProcurement.Platform.Settings.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class MenuTreeEntryConfiguration : IEntityTypeConfiguration<MenuTreeEntry>
{
    public void Configure(EntityTypeBuilder<MenuTreeEntry> builder)
    {
        builder.ToTable("MENU_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.MenuKey).HasMaxLength(100).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => entry.MenuKey).IsUnique();
    }
}

public sealed class ApplicationAboutEntryConfiguration : IEntityTypeConfiguration<ApplicationAboutEntry>
{
    public void Configure(EntityTypeBuilder<ApplicationAboutEntry> builder)
    {
        builder.ToTable("APPLICATION_ABOUT_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();
    }
}

public sealed class SettingEntryConfiguration : IEntityTypeConfiguration<SettingEntry>
{
    public void Configure(EntityTypeBuilder<SettingEntry> builder)
    {
        builder.ToTable("SETTING_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Key).HasMaxLength(200).IsRequired();
        builder.Property(entry => entry.ValueJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => entry.Key).IsUnique();
    }
}

public sealed class MasterDataSetEntryConfiguration : IEntityTypeConfiguration<MasterDataSetEntry>
{
    public void Configure(EntityTypeBuilder<MasterDataSetEntry> builder)
    {
        builder.ToTable("MASTER_DATA_SET_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Key).HasMaxLength(100).IsRequired();
        builder.Property(entry => entry.Name).HasMaxLength(200).IsRequired();
        builder.Property(entry => entry.TableName).HasMaxLength(200).IsRequired();
        builder.Property(entry => entry.Owner).HasMaxLength(100).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => entry.Key).IsUnique();
    }
}

public sealed class MasterDataRecordEntryConfiguration : IEntityTypeConfiguration<MasterDataRecordEntry>
{
    public void Configure(EntityTypeBuilder<MasterDataRecordEntry> builder)
    {
        builder.ToTable("MASTER_DATA_RECORD_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.SetKey).HasMaxLength(100).IsRequired();
        builder.Property(entry => entry.Code).HasMaxLength(100).IsRequired();
        builder.Property(entry => entry.Name).HasMaxLength(500).IsRequired();
        builder.Property(entry => entry.Status).HasMaxLength(80).IsRequired();
        builder.Property(entry => entry.Description).HasMaxLength(1000).IsRequired();
        builder.Property(entry => entry.PayloadJson);
        builder.Property(entry => entry.ParentCode).HasMaxLength(100);
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => new { entry.SetKey, entry.Code }).IsUnique();
        builder.HasIndex(entry => entry.SetKey);
        builder.HasIndex(entry => entry.Status);
        builder.HasIndex(entry => new { entry.SetKey, entry.ParentCode });   // fast cascade (region / classification)
    }
}

public sealed class LanguageEntryConfiguration : IEntityTypeConfiguration<LanguageEntry>
{
    public void Configure(EntityTypeBuilder<LanguageEntry> builder)
    {
        builder.ToTable("LANGUAGE_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Code).HasMaxLength(16).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => entry.Code).IsUnique();
    }
}

public sealed class LanguageTextEntryConfiguration : IEntityTypeConfiguration<LanguageTextEntry>
{
    public void Configure(EntityTypeBuilder<LanguageTextEntry> builder)
    {
        builder.ToTable("LANGUAGE_TEXT_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.TextKey).HasMaxLength(200).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => entry.TextKey).IsUnique();
    }
}

public sealed class EmailTemplateEntryConfiguration : IEntityTypeConfiguration<EmailTemplateEntry>
{
    public void Configure(EntityTypeBuilder<EmailTemplateEntry> builder)
    {
        builder.ToTable("EMAIL_TEMPLATE_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.TemplateId).HasMaxLength(40).IsRequired();
        builder.Property(entry => entry.Category).HasMaxLength(120).IsRequired();
        builder.Property(entry => entry.Status).HasMaxLength(40).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => entry.TemplateId).IsUnique();
        builder.HasIndex(entry => entry.Category);
    }
}

public sealed class EmailSentEntryConfiguration : IEntityTypeConfiguration<EmailSentEntry>
{
    public void Configure(EntityTypeBuilder<EmailSentEntry> builder)
    {
        builder.ToTable("EMAIL_SENT_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.MessageId).HasMaxLength(64).IsRequired();
        builder.Property(entry => entry.Category).HasMaxLength(120).IsRequired();
        builder.Property(entry => entry.Status).HasMaxLength(40).IsRequired();
        builder.Property(entry => entry.PayloadJson).IsRequired();
        builder.Property(entry => entry.SentAt).IsRequired();

        builder.HasIndex(entry => entry.MessageId).IsUnique();
        builder.HasIndex(entry => entry.Category);
        builder.HasIndex(entry => entry.SentAt);
        builder.HasIndex(entry => entry.Status);
    }
}

public sealed class NotificationEntryConfiguration : IEntityTypeConfiguration<NotificationEntry>
{
    public void Configure(EntityTypeBuilder<NotificationEntry> builder)
    {
        builder.ToTable("NOTIFICATION_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Severity).HasMaxLength(20).IsRequired();
        builder.Property(entry => entry.Title).HasMaxLength(300).IsRequired();
        builder.Property(entry => entry.Detail).HasMaxLength(2000);
        builder.Property(entry => entry.AudienceScope).HasMaxLength(20).IsRequired();
        builder.Property(entry => entry.AudienceRoles).HasMaxLength(1000);
        builder.Property(entry => entry.AudienceUser).HasMaxLength(200);
        builder.Property(entry => entry.AudienceLabel).HasMaxLength(200);
        builder.Property(entry => entry.Module).HasMaxLength(120);
        builder.Property(entry => entry.LinkPath).HasMaxLength(500);
        builder.Property(entry => entry.CreatedBy).HasMaxLength(120);
        builder.Property(entry => entry.CreatedAt).IsRequired();

        builder.HasIndex(entry => entry.CreatedAt);
        builder.HasIndex(entry => entry.AudienceScope);
        builder.HasIndex(entry => entry.AudienceUser);
    }
}

public sealed class NotificationRecipientStateConfiguration : IEntityTypeConfiguration<NotificationRecipientState>
{
    public void Configure(EntityTypeBuilder<NotificationRecipientState> builder)
    {
        builder.ToTable("NOTIFICATION_RECIPIENT_STATE_T", DatabaseSchemas.Core);

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.NotificationId).IsRequired();
        builder.Property(entry => entry.PersonnelNo).HasMaxLength(64).IsRequired();
        builder.Property(entry => entry.CreatedAt).IsRequired();
        builder.Property(entry => entry.UpdatedAt).IsRequired();

        builder.HasIndex(entry => new { entry.NotificationId, entry.PersonnelNo }).IsUnique();
        builder.HasIndex(entry => entry.PersonnelNo);
    }
}
