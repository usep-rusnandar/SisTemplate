using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ProposalTracker.Domain;

public sealed class TrackerLoaDocument : AuditableEntity
{
    private TrackerLoaDocument()
    {
        ProposalKey = string.Empty;
        ActivityKey = string.Empty;
        VendorId = string.Empty;
        VendorName = string.Empty;
        FileName = string.Empty;
        PayloadJson = string.Empty;
    }

    public TrackerLoaDocument(
        Guid id,
        string proposalKey,
        string activityKey,
        string vendorId,
        string? loaNumber,
        string vendorName,
        decimal awardValue,
        decimal awardPercent,
        DateTimeOffset? generatedAt,
        string? fileName,
        string payloadJson)
        : base(id)
    {
        ProposalKey = proposalKey;
        ActivityKey = activityKey;
        VendorId = vendorId;
        LoaNumber = loaNumber;
        VendorName = vendorName;
        AwardValue = awardValue;
        AwardPercent = awardPercent;
        GeneratedAt = generatedAt;
        FileName = fileName ?? string.Empty;
        PayloadJson = payloadJson;
    }

    public string ProposalKey { get; private set; }

    public string ActivityKey { get; private set; }

    public string VendorId { get; private set; }

    public string? LoaNumber { get; private set; }

    public string VendorName { get; private set; }

    public decimal AwardValue { get; private set; }

    public decimal AwardPercent { get; private set; }

    public DateTimeOffset? GeneratedAt { get; private set; }

    public string FileName { get; private set; }

    public string PayloadJson { get; private set; }

    public void UpdateFrom(
        string? loaNumber,
        string vendorName,
        decimal awardValue,
        decimal awardPercent,
        DateTimeOffset? generatedAt,
        string? fileName,
        string payloadJson)
    {
        LoaNumber = loaNumber;
        VendorName = vendorName;
        AwardValue = awardValue;
        AwardPercent = awardPercent;
        GeneratedAt = generatedAt;
        FileName = fileName ?? string.Empty;
        PayloadJson = payloadJson;
    }
}
