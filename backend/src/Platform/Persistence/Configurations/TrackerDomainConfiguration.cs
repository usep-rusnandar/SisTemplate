using IntegratedProcurement.Modules.ProposalTracker.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedProcurement.Platform.Persistence.Configurations;

public sealed class TrackerProposalConfiguration : IEntityTypeConfiguration<TrackerProposal>
{
    public void Configure(EntityTypeBuilder<TrackerProposal> builder)
    {
        builder.ToTable("PROPOSAL_T", DatabaseSchemas.ProposalTracker);
        builder.HasKey(proposal => proposal.Id);

        builder.Property(proposal => proposal.ProposalKey).HasMaxLength(64).IsRequired();
        builder.Property(proposal => proposal.ProposalNumber).HasMaxLength(64).IsRequired();
        builder.Property(proposal => proposal.Title).HasMaxLength(500).IsRequired();
        builder.Property(proposal => proposal.AribaId).HasMaxLength(64);
        builder.Property(proposal => proposal.Commodity).HasMaxLength(200);
        builder.Property(proposal => proposal.Jobsite).HasMaxLength(100);
        builder.Property(proposal => proposal.Department).HasMaxLength(200);
        builder.Property(proposal => proposal.ContractType).HasMaxLength(100);
        builder.Property(proposal => proposal.ContractualType).HasMaxLength(100);
        builder.Property(proposal => proposal.Amount).HasPrecision(18, 2);
        builder.Property(proposal => proposal.TrackerMethod).HasMaxLength(64);
        builder.Property(proposal => proposal.LifecycleStatus).HasMaxLength(64).IsRequired();
        builder.Property(proposal => proposal.CurrentStage).HasMaxLength(200).IsRequired();
        builder.Property(proposal => proposal.Priority).HasMaxLength(100);
        builder.Property(proposal => proposal.OwnerName).HasMaxLength(200);
        builder.Property(proposal => proposal.AssignedOfficerName).HasMaxLength(200);
        builder.Property(proposal => proposal.PayloadJson).IsRequired();

        builder.HasIndex(proposal => proposal.ProposalKey).IsUnique();
        builder.HasIndex(proposal => proposal.ProposalNumber);
        builder.HasIndex(proposal => proposal.LifecycleStatus);
    }
}

public sealed class TrackerProposalActivityConfiguration : IEntityTypeConfiguration<TrackerProposalActivity>
{
    public void Configure(EntityTypeBuilder<TrackerProposalActivity> builder)
    {
        builder.ToTable("PROPOSAL_ACTIVITY_T", DatabaseSchemas.ProposalTracker);
        builder.HasKey(activity => activity.Id);

        builder.Property(activity => activity.ProposalKey).HasMaxLength(64).IsRequired();
        builder.Property(activity => activity.ActivityKey).HasMaxLength(100).IsRequired();
        builder.Property(activity => activity.StageId).HasMaxLength(64).IsRequired();
        builder.Property(activity => activity.Title).HasMaxLength(200).IsRequired();
        builder.Property(activity => activity.Owner).HasMaxLength(64).IsRequired();
        builder.Property(activity => activity.Status).HasMaxLength(64).IsRequired();
        builder.Property(activity => activity.LockedReason).HasMaxLength(500);
        builder.Property(activity => activity.PayloadJson).IsRequired();

        builder.HasIndex(activity => new { activity.ProposalKey, activity.ActivityKey }).IsUnique();
        builder.HasIndex(activity => activity.ProposalKey);
        builder.HasIndex(activity => activity.Status);
    }
}

public sealed class TrackerLoaDocumentConfiguration : IEntityTypeConfiguration<TrackerLoaDocument>
{
    public void Configure(EntityTypeBuilder<TrackerLoaDocument> builder)
    {
        builder.ToTable("LOA_DOCUMENT_T", DatabaseSchemas.ProposalTracker);
        builder.HasKey(document => document.Id);

        builder.Property(document => document.ProposalKey).HasMaxLength(64).IsRequired();
        builder.Property(document => document.ActivityKey).HasMaxLength(100).IsRequired();
        builder.Property(document => document.VendorId).HasMaxLength(100).IsRequired();
        builder.Property(document => document.LoaNumber).HasMaxLength(100);
        builder.Property(document => document.VendorName).HasMaxLength(300).IsRequired();
        builder.Property(document => document.AwardValue).HasPrecision(18, 2);
        builder.Property(document => document.AwardPercent).HasPrecision(9, 4);
        builder.Property(document => document.FileName).HasMaxLength(500).IsRequired();
        builder.Property(document => document.PayloadJson).IsRequired();

        builder.HasIndex(document => new { document.ProposalKey, document.ActivityKey, document.VendorId }).IsUnique();
        builder.HasIndex(document => document.LoaNumber);
        builder.HasIndex(document => document.ProposalKey);
    }
}

public sealed class ProposalAwardResultConfiguration : IEntityTypeConfiguration<ProposalAwardResult>
{
    public void Configure(EntityTypeBuilder<ProposalAwardResult> builder)
    {
        builder.ToTable("AWARD_RESULT_T", DatabaseSchemas.ProposalTracker);
        builder.HasKey(result => result.Id);

        builder.Property(result => result.ProposalKey).HasMaxLength(64).IsRequired();
        builder.Property(result => result.Source).HasMaxLength(40).IsRequired();
        builder.Property(result => result.Method).HasMaxLength(100);
        builder.Property(result => result.EvaluatedBy).HasMaxLength(200);
        builder.Property(result => result.Notes).HasMaxLength(2000);
        builder.Property(result => result.PayloadJson).IsRequired();

        // One commercial result per proposal.
        builder.HasIndex(result => result.ProposalKey).IsUnique();
    }
}

public sealed class ProposalAwardResultVendorConfiguration : IEntityTypeConfiguration<ProposalAwardResultVendor>
{
    public void Configure(EntityTypeBuilder<ProposalAwardResultVendor> builder)
    {
        builder.ToTable("AWARD_RESULT_VENDOR_T", DatabaseSchemas.ProposalTracker);
        builder.HasKey(vendor => vendor.Id);

        builder.Property(vendor => vendor.ProposalKey).HasMaxLength(64).IsRequired();
        builder.Property(vendor => vendor.VendorId).HasMaxLength(100).IsRequired();
        builder.Property(vendor => vendor.VendorName).HasMaxLength(300).IsRequired();
        builder.Property(vendor => vendor.BidPrice).HasPrecision(18, 2);
        builder.Property(vendor => vendor.TechnicalScore).HasPrecision(9, 4);
        builder.Property(vendor => vendor.CommercialScore).HasPrecision(9, 4);
        builder.Property(vendor => vendor.TotalScore).HasPrecision(9, 4);
        builder.Property(vendor => vendor.NegotiatedValue).HasPrecision(18, 2);
        builder.Property(vendor => vendor.AwardValue).HasPrecision(18, 2);
        builder.Property(vendor => vendor.AwardPercent).HasPrecision(9, 4);
        builder.Property(vendor => vendor.PayloadJson).IsRequired();

        builder.HasIndex(vendor => new { vendor.ProposalKey, vendor.VendorId }).IsUnique();
        builder.HasIndex(vendor => vendor.ProposalKey);
    }
}
