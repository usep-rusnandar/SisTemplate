using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> builder)
    {
        // No CHECK constraint on Status: the vocabulary belongs to the `vendor-status` master-data set,
        // which administrators can extend, and an approval step can be configured with any code from it.
        // A frozen list here would reject a status the moment master data grew one.
        builder.ToTable("VENDOR_T", DatabaseSchemas.Vendor);

        builder.HasKey(vendor => vendor.Id);
        builder.Property(vendor => vendor.Id).HasColumnName("VendorId").HasMaxLength(10).ValueGeneratedNever();
        builder.Property(vendor => vendor.Name).HasColumnName("VendorName").HasMaxLength(250).IsRequired();
        builder.Property(vendor => vendor.Status).HasMaxLength(VendorStatuses.MaxCodeLength).IsRequired();
        builder.Property(vendor => vendor.Position).HasMaxLength(100);
        builder.Property(vendor => vendor.OfficePhoneCountry).HasMaxLength(8);
        builder.Property(vendor => vendor.OfficePhoneArea).HasMaxLength(8);
        builder.Property(vendor => vendor.OfficePhoneNumber).HasMaxLength(20);
        builder.Property(vendor => vendor.HandphoneCountry).HasMaxLength(8);
        builder.Property(vendor => vendor.HandphoneNumber).HasMaxLength(20);
        builder.Property(vendor => vendor.WebAddress).HasMaxLength(150);
        builder.Property(vendor => vendor.NpwpNo).HasMaxLength(30);
        builder.Property(vendor => vendor.NibNo).HasMaxLength(50);
        builder.Property(vendor => vendor.AktaPendirianNo).HasMaxLength(50);
        builder.Property(vendor => vendor.AktaPerubahanNo).HasMaxLength(50);
        builder.Property(vendor => vendor.AktaPenyesuaianNo).HasMaxLength(50);
        builder.Property(vendor => vendor.SppkpNo).HasMaxLength(50);
        builder.Property(vendor => vendor.CreatedBy).HasMaxLength(100);
        builder.Property(vendor => vendor.UpdatedBy).HasMaxLength(100);
        builder.Property(vendor => vendor.DeletedBy).HasMaxLength(100);

        foreach (var prefix in new[] { "Office", "Warehouse", "Workshop" })
        {
            builder.Property<string>(prefix + "Address").HasMaxLength(250);
            builder.Property<string>(prefix + "AddressCode").HasMaxLength(50);
            builder.Property<string>(prefix + "ProvinceCode").HasMaxLength(50);
            builder.Property<string>(prefix + "CityCode").HasMaxLength(50);
            builder.Property<string>(prefix + "DistrictCode").HasMaxLength(50);
            builder.Property<string>(prefix + "VillageCode").HasMaxLength(50);
            builder.Property<string>(prefix + "PostCode").HasMaxLength(10);
            builder.Property<string>(prefix + "Country").HasMaxLength(50);
            builder.Property<decimal?>(prefix + "Latitude").HasColumnType("decimal(11,7)");
            builder.Property<decimal?>(prefix + "Longitude").HasColumnType("decimal(11,7)");
        }

        builder.HasMany(vendor => vendor.StatusHistory)
            .WithOne()
            .HasForeignKey(entry => entry.VendorId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(Vendor.StatusHistory))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class VendorStatusHistoryConfiguration : IEntityTypeConfiguration<VendorStatusHistory>
{
    public void Configure(EntityTypeBuilder<VendorStatusHistory> builder)
    {
        builder.ToTable("VENDOR_STATUS_T", DatabaseSchemas.Vendor);
        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Id).HasColumnName("VendorStatusId").ValueGeneratedNever();
        builder.Property(entry => entry.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(entry => entry.StatusCode).HasMaxLength(VendorStatuses.MaxCodeLength).IsRequired();
        builder.Property(entry => entry.Reason).HasMaxLength(500);
        builder.Property(entry => entry.CreatedBy).HasMaxLength(100);
        builder.Property(entry => entry.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(entry => entry.VendorId);
    }
}

public sealed class VendorDocumentConfiguration : IEntityTypeConfiguration<VendorDocument>
{
    public void Configure(EntityTypeBuilder<VendorDocument> builder)
    {
        builder.ToTable("VENDOR_DOCUMENT_T", DatabaseSchemas.Vendor);
        builder.HasKey(document => document.Id);
        builder.Property(document => document.Id).HasColumnName("VendorDocumentId").ValueGeneratedNever();
        builder.Property(document => document.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(document => document.DocumentType).HasMaxLength(50).IsRequired();
        builder.Property(document => document.OwnerKey).HasMaxLength(100).IsRequired();
        builder.Property(document => document.FileName).HasMaxLength(255).IsRequired();
        builder.Property(document => document.ContentType).HasMaxLength(150);
        builder.Property(document => document.BlobContainer).HasMaxLength(150).IsRequired();
        builder.Property(document => document.BlobKey).HasMaxLength(400).IsRequired();
        builder.Property(document => document.UploadedBy).HasMaxLength(100);
        builder.Property(document => document.SourceSystem).HasMaxLength(32);
        builder.Property(document => document.CreatedBy).HasMaxLength(100);
        builder.Property(document => document.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(document => new { document.VendorId, document.DocumentType, document.OwnerKey }).IsUnique();
        builder.HasIndex(document => document.VendorId);
    }
}

public sealed class VendorCertificateConfiguration : IEntityTypeConfiguration<VendorCertificate>
{
    public void Configure(EntityTypeBuilder<VendorCertificate> builder)
    {
        builder.ToTable("VENDOR_CERTIFICATE_T", DatabaseSchemas.Vendor);
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("VendorCertificateId").ValueGeneratedNever();
        builder.Property(c => c.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(c => c.CertificateNumber).HasMaxLength(100).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(255).IsRequired();
        builder.Property(c => c.CreatedBy).HasMaxLength(100);
        builder.Property(c => c.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(c => new { c.VendorId, c.CertificateNumber }).IsUnique();
        builder.HasIndex(c => c.VendorId);
    }
}

public sealed class VendorKbliConfiguration : IEntityTypeConfiguration<VendorKbli>
{
    public void Configure(EntityTypeBuilder<VendorKbli> builder)
    {
        builder.ToTable("VENDOR_KBLI_T", DatabaseSchemas.Vendor);
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("VendorKbliId").ValueGeneratedNever();
        builder.Property(item => item.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(item => item.KbliTypeCode).HasMaxLength(8);
        builder.Property(item => item.KbliCode).HasMaxLength(16).IsRequired();
        builder.Property(item => item.KbliStatusCode).HasMaxLength(8);
        builder.Property(item => item.CreatedBy).HasMaxLength(100);
        builder.Property(item => item.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(item => new { item.VendorId, item.KbliTypeCode, item.KbliCode }).IsUnique();
    }
}

public sealed class VendorBrandConfiguration : IEntityTypeConfiguration<VendorBrand>
{
    public void Configure(EntityTypeBuilder<VendorBrand> builder)
    {
        builder.ToTable("VENDOR_BRAND_T", DatabaseSchemas.Vendor);
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("VendorBrandId").ValueGeneratedNever();
        builder.Property(item => item.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(item => item.BrandName).HasMaxLength(100).IsRequired();
        builder.Property(item => item.DistributorTypeCode).HasMaxLength(8);
        builder.Property(item => item.CreatedBy).HasMaxLength(100);
        builder.Property(item => item.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(item => new { item.VendorId, item.BrandName }).IsUnique();
    }
}

public sealed class VendorPortfolioConfiguration : IEntityTypeConfiguration<VendorPortfolio>
{
    public void Configure(EntityTypeBuilder<VendorPortfolio> builder)
    {
        builder.ToTable("VENDOR_PORTFOLIO_T", DatabaseSchemas.Vendor);
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("VendorPortfolioId").ValueGeneratedNever();
        builder.Property(item => item.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(item => item.Client).HasMaxLength(150).IsRequired();
        builder.Property(item => item.ScopeOfWork).HasMaxLength(255).IsRequired();
        builder.Property(item => item.TotalValue).HasColumnType("decimal(18,2)");
        builder.Property(item => item.EnteredByParty).HasMaxLength(16).IsRequired().HasDefaultValue(VendorPortfolioParties.Vendor);
        builder.Property(item => item.CreatedBy).HasMaxLength(100);
        builder.Property(item => item.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(item => item.VendorId);
    }
}

public sealed class VendorSpecialRequirementConfiguration : IEntityTypeConfiguration<VendorSpecialRequirement>
{
    public void Configure(EntityTypeBuilder<VendorSpecialRequirement> builder)
    {
        builder.ToTable("VENDOR_SPECIAL_REQUIREMENT_T", DatabaseSchemas.Vendor);
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("VendorSpecialRequirementId").ValueGeneratedNever();
        builder.Property(item => item.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(item => item.SpecialReqCode).HasMaxLength(16).IsRequired();
        builder.Property(item => item.Number).HasMaxLength(100);
        builder.Property(item => item.Description).HasMaxLength(255);
        builder.Property(item => item.CreatedBy).HasMaxLength(100);
        builder.Property(item => item.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(item => new { item.VendorId, item.SpecialReqCode }).IsUnique();
    }
}

public sealed class VendorSubClassificationConfiguration : IEntityTypeConfiguration<VendorSubClassification>
{
    public void Configure(EntityTypeBuilder<VendorSubClassification> builder)
    {
        builder.ToTable("VENDOR_SUBCLASSIFICATION_T", DatabaseSchemas.Vendor);
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("VendorSubClassificationId").ValueGeneratedNever();
        builder.Property(item => item.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(item => item.SubClassificationCode).HasMaxLength(16).IsRequired();
        builder.Property(item => item.CreatedBy).HasMaxLength(100);
        builder.Property(item => item.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(item => new { item.VendorId, item.SubClassificationCode }).IsUnique();
    }
}

public sealed class VendorUserConfiguration : IEntityTypeConfiguration<VendorUser>
{
    public void Configure(EntityTypeBuilder<VendorUser> builder)
    {
        builder.ToTable("VENDOR_USER_T", DatabaseSchemas.Vendor);

        builder.HasKey(vendorUser => vendorUser.Id);
        builder.Property(vendorUser => vendorUser.Id).HasColumnName("VendorUserId").ValueGeneratedNever();
        builder.Property(vendorUser => vendorUser.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(vendorUser => vendorUser.IdentityUserId).HasMaxLength(10).IsRequired();
        builder.Property(vendorUser => vendorUser.IsWorkspacePic).HasColumnName("IsWorkspacePic").IsRequired();

        builder.HasOne<Vendor>()
            .WithMany()
            .HasForeignKey(vendorUser => vendorUser.VendorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<VendorIdentityUser>()
            .WithMany()
            .HasForeignKey(vendorUser => vendorUser.IdentityUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(vendorUser => vendorUser.IdentityUserId)
            .IsUnique()
            .HasDatabaseName("IX_VENDOR_USER_T_IDENTITY_USER_ID");
        builder.HasIndex(vendorUser => vendorUser.VendorId, "IX_VENDOR_USER_T_VENDOR_ID");
        builder.HasIndex(vendorUser => new { vendorUser.VendorId, vendorUser.IsWorkspacePic },
                "IX_VENDOR_USER_T_VENDOR_ID_WORKSPACE_PIC")
            .IsUnique()
            .HasFilter("[IsWorkspacePic] = 1");
    }
}

public sealed class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.ToTable("INVITATION_T", DatabaseSchemas.Vendor, table =>
        {
            table.HasCheckConstraint(
                "CK_INVITATION_T_STATUS",
                "[Status] IN ('Draft','Sent','Opened','Registered','Expired','Revoked')");
        });

        builder.HasKey(invitation => invitation.Id);
        builder.Property(invitation => invitation.Id).HasColumnName("InvitationId").ValueGeneratedNever();
        builder.Property(invitation => invitation.VendorId).HasMaxLength(10);
        builder.Property(invitation => invitation.CodeHash).HasMaxLength(512).IsRequired();
        builder.Property(invitation => invitation.CodeMasked).HasMaxLength(50).IsRequired();
        builder.Property(invitation => invitation.Email).HasMaxLength(256).IsRequired();
        builder.Property(invitation => invitation.VendorName).HasMaxLength(250).IsRequired();
        builder.Property(invitation => invitation.PicName).HasMaxLength(200).IsRequired();
        builder.Property(invitation => invitation.Category).HasMaxLength(100);
        builder.Property(invitation => invitation.Status).HasMaxLength(32).IsRequired();
        builder.Property(invitation => invitation.Note).HasMaxLength(1000);
        builder.Property(invitation => invitation.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(invitation => invitation.UpdatedBy).HasMaxLength(100);

        builder.HasOne<Vendor>()
            .WithMany()
            .HasForeignKey(invitation => invitation.VendorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<VendorUser>()
            .WithMany()
            .HasForeignKey(invitation => invitation.UsedBy)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(invitation => invitation.CodeHash).IsUnique();
        builder.HasIndex(invitation => invitation.Email)
            .IsUnique()
            .HasFilter("[UsedAt] IS NULL AND [Status] IN ('Draft','Sent','Opened')");
    }
}

public sealed class InvitationAttemptConfiguration : IEntityTypeConfiguration<InvitationAttempt>
{
    public void Configure(EntityTypeBuilder<InvitationAttempt> builder)
    {
        builder.ToTable("INVITATION_ATTEMPT_T", DatabaseSchemas.Vendor, table =>
        {
            table.HasCheckConstraint(
                "CK_INVITATION_ATTEMPT_T_RESULT",
                "[Result] IN ('Success','Failure')");
        });

        builder.HasKey(attempt => attempt.Id);
        builder.Property(attempt => attempt.Id).HasColumnName("InvitationAttemptId").ValueGeneratedNever();
        builder.Property(attempt => attempt.Email).HasMaxLength(256);
        builder.Property(attempt => attempt.CodeMasked).HasMaxLength(50);
        builder.Property(attempt => attempt.IpAddress).HasMaxLength(64);
        builder.Property(attempt => attempt.UserAgent).HasMaxLength(1000);
        builder.Property(attempt => attempt.Result).HasMaxLength(32).IsRequired();
        builder.Property(attempt => attempt.Reason).HasMaxLength(200);

        builder.HasOne<Invitation>()
            .WithMany()
            .HasForeignKey(attempt => attempt.InvitationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(attempt => attempt.AttemptedAt);
        builder.HasIndex(attempt => attempt.Email);
    }
}

public sealed class VendorImportBatchConfiguration : IEntityTypeConfiguration<VendorImportBatch>
{
    public void Configure(EntityTypeBuilder<VendorImportBatch> builder)
    {
        builder.ToTable("VENDOR_IMPORT_BATCH_T", DatabaseSchemas.Vendor);
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("VendorImportBatchId").ValueGeneratedNever();
        builder.Property(item => item.FileName).HasMaxLength(255).IsRequired();
        builder.Property(item => item.FileHash).HasMaxLength(64).IsRequired();
        builder.Property(item => item.Status).HasMaxLength(32).IsRequired();
        builder.Property(item => item.StartedBy).HasMaxLength(100).IsRequired();
        builder.Property(item => item.CreatedBy).HasMaxLength(100);
        builder.Property(item => item.UpdatedBy).HasMaxLength(100);
        builder.HasIndex(item => item.CreatedAt);
    }
}

public sealed class VendorImportRowConfiguration : IEntityTypeConfiguration<VendorImportRow>
{
    public void Configure(EntityTypeBuilder<VendorImportRow> builder)
    {
        builder.ToTable("VENDOR_IMPORT_ROW_T", DatabaseSchemas.Vendor);
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("VendorImportRowId").ValueGeneratedNever();
        builder.Property(item => item.ExternalVendorId).HasMaxLength(100).IsRequired();
        builder.Property(item => item.VendorName).HasMaxLength(250).IsRequired();
        builder.Property(item => item.PicEmail).HasMaxLength(256).IsRequired();
        builder.Property(item => item.Status).HasMaxLength(32).IsRequired();
        builder.Property(item => item.IssuesJson).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(item => item.PayloadJson).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(item => item.VendorId).HasMaxLength(10);
        builder.Property(item => item.CreatedBy).HasMaxLength(100);
        builder.Property(item => item.UpdatedBy).HasMaxLength(100);
        builder.HasOne<VendorImportBatch>().WithMany().HasForeignKey(item => item.BatchId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(item => new { item.BatchId, item.RowNumber }).IsUnique();
    }
}

public sealed class VendorExternalReferenceConfiguration : IEntityTypeConfiguration<VendorExternalReference>
{
    public void Configure(EntityTypeBuilder<VendorExternalReference> builder)
    {
        builder.ToTable("VENDOR_EXTERNAL_REFERENCE_T", DatabaseSchemas.Vendor);
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("VendorExternalReferenceId").ValueGeneratedNever();
        builder.Property(item => item.VendorId).HasMaxLength(10).IsRequired();
        builder.Property(item => item.SourceSystem).HasMaxLength(32).IsRequired();
        builder.Property(item => item.ExternalVendorId).HasMaxLength(100).IsRequired();
        builder.Property(item => item.PayloadHash).HasMaxLength(64).IsRequired();
        builder.Property(item => item.CreatedBy).HasMaxLength(100);
        builder.Property(item => item.UpdatedBy).HasMaxLength(100);
        builder.HasOne<Vendor>().WithMany().HasForeignKey(item => item.VendorId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<VendorImportBatch>().WithMany().HasForeignKey(item => item.ImportBatchId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(item => new { item.SourceSystem, item.ExternalVendorId }).IsUnique();
        builder.HasIndex(item => item.VendorId);
    }
}
