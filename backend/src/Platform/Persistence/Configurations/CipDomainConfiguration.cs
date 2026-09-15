using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class CipCaseConfiguration : IEntityTypeConfiguration<CipCase>
{
    public void Configure(EntityTypeBuilder<CipCase> builder)
    {
        builder.ToTable("CASE_T", DatabaseSchemas.ContractInitiationPlatform);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.CaseKey).HasMaxLength(64).IsRequired();
        builder.Property(item => item.LoaKey).HasMaxLength(200);
        builder.Property(item => item.LoaNumber).HasMaxLength(100);
        builder.Property(item => item.Title).HasMaxLength(500).IsRequired();
        builder.Property(item => item.VendorId).HasMaxLength(100);
        builder.Property(item => item.VendorName).HasMaxLength(300);
        builder.Property(item => item.Jobsite).HasMaxLength(100);
        builder.Property(item => item.Department).HasMaxLength(200);
        builder.Property(item => item.Value).HasPrecision(18, 2);
        builder.Property(item => item.ProposalTotalValue).HasPrecision(18, 2);
        builder.Property(item => item.AwardPercent).HasPrecision(9, 4);
        builder.Property(item => item.Stage).HasMaxLength(64).IsRequired();
        builder.Property(item => item.Status).HasMaxLength(64).IsRequired();
        builder.Property(item => item.Template).HasMaxLength(100);
        builder.Property(item => item.Requestor).HasMaxLength(200);
        builder.Property(item => item.Procurement).HasMaxLength(200);
        builder.Property(item => item.Legal).HasMaxLength(200);
        builder.Property(item => item.Source).HasMaxLength(100);
        builder.Property(item => item.ProposalKey).HasMaxLength(64);
        builder.Property(item => item.ProposalNumber).HasMaxLength(64);
        builder.Property(item => item.TermsheetNumber).HasMaxLength(150);
        builder.Property(item => item.ContractNumber).HasMaxLength(150);
        builder.Property(item => item.PayloadJson).IsRequired();

        builder.HasIndex(item => item.CaseKey).IsUnique();
        builder.HasIndex(item => item.ProposalKey);
        builder.HasIndex(item => item.Stage);
        builder.HasIndex(item => item.Status);
    }
}

public sealed class CipCaseDocumentConfiguration : IEntityTypeConfiguration<CipCaseDocument>
{
    public void Configure(EntityTypeBuilder<CipCaseDocument> builder)
    {
        builder.ToTable("CASE_DOCUMENT_T", DatabaseSchemas.ContractInitiationPlatform);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.CaseKey).HasMaxLength(64).IsRequired();
        builder.Property(item => item.DocumentKey).HasMaxLength(160).IsRequired();
        builder.Property(item => item.DocumentType).HasMaxLength(64).IsRequired();
        builder.Property(item => item.FileName).HasMaxLength(500).IsRequired();
        builder.Property(item => item.Container).HasMaxLength(200);
        builder.Property(item => item.BlobKey).HasMaxLength(1024);
        builder.Property(item => item.PayloadJson).IsRequired();

        builder.HasIndex(item => new { item.CaseKey, item.DocumentKey }).IsUnique();
        builder.HasIndex(item => item.CaseKey);
        builder.HasIndex(item => item.DocumentType);
    }
}

public sealed class CipCaseActivityConfiguration : IEntityTypeConfiguration<CipCaseActivity>
{
    public void Configure(EntityTypeBuilder<CipCaseActivity> builder)
    {
        builder.ToTable("CASE_ACTIVITY_T", DatabaseSchemas.ContractInitiationPlatform);
        builder.HasKey(item => item.Id);

        builder.Property(item => item.CaseKey).HasMaxLength(64).IsRequired();
        builder.Property(item => item.ActivityKey).HasMaxLength(200).IsRequired();
        builder.Property(item => item.ActivityType).HasMaxLength(100).IsRequired();
        builder.Property(item => item.StageKey).HasMaxLength(64).IsRequired();
        builder.Property(item => item.ActorName).HasMaxLength(200);
        builder.Property(item => item.Message).HasMaxLength(1000);
        builder.Property(item => item.PayloadJson).IsRequired();

        builder.HasIndex(item => new { item.CaseKey, item.ActivityKey }).IsUnique();
        builder.HasIndex(item => item.CaseKey);
        builder.HasIndex(item => item.StageKey);
    }
}
