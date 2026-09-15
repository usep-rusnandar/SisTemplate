using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ProposalTracker.Domain;

/// <summary>
/// One evaluated/negotiated vendor line under a <see cref="ProposalAwardResult"/>: bid price,
/// technical + commercial scores, negotiation result, and the awarded value/percent. Winners
/// (<see cref="IsWinner"/>) drive per-winner LOA + CIP Term Sheet generation (split award supported).
/// Detailed commercial terms (mapped to the Term Sheet template fields) ride in <see cref="PayloadJson"/>.
/// </summary>
public sealed class ProposalAwardResultVendor : AuditableEntity
{
    private ProposalAwardResultVendor()
    {
        ProposalKey = string.Empty;
        VendorId = string.Empty;
        VendorName = string.Empty;
        PayloadJson = string.Empty;
    }

    public ProposalAwardResultVendor(
        Guid id,
        string proposalKey,
        string vendorId,
        string vendorName,
        decimal? bidPrice,
        decimal? technicalScore,
        decimal? commercialScore,
        decimal? totalScore,
        int? rank,
        decimal? negotiatedValue,
        decimal awardValue,
        decimal awardPercent,
        bool isWinner,
        string payloadJson)
        : base(id)
    {
        ProposalKey = proposalKey;
        VendorId = vendorId;
        VendorName = vendorName;
        BidPrice = bidPrice;
        TechnicalScore = technicalScore;
        CommercialScore = commercialScore;
        TotalScore = totalScore;
        Rank = rank;
        NegotiatedValue = negotiatedValue;
        AwardValue = awardValue;
        AwardPercent = awardPercent;
        IsWinner = isWinner;
        PayloadJson = payloadJson;
    }

    public string ProposalKey { get; private set; }

    public string VendorId { get; private set; }

    public string VendorName { get; private set; }

    public decimal? BidPrice { get; private set; }

    public decimal? TechnicalScore { get; private set; }

    public decimal? CommercialScore { get; private set; }

    public decimal? TotalScore { get; private set; }

    public int? Rank { get; private set; }

    public decimal? NegotiatedValue { get; private set; }

    public decimal AwardValue { get; private set; }

    public decimal AwardPercent { get; private set; }

    public bool IsWinner { get; private set; }

    public string PayloadJson { get; private set; }
}
