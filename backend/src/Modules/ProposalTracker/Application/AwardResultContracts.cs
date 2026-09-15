namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>
/// Save the commercial/award result of a proposal (the Term Sheet + LOA data source). Captured at
/// Bid Evaluation (Tender / Pemilihan Langsung) or Negotiation (Penunjukan Langsung),
/// tagged via <see cref="Source"/>. Vendors use replace-all semantics.
/// </summary>
public sealed record SaveAwardResultCommand(
    string ProposalId,
    string Source,
    string? Method,
    string? EvaluatedBy,
    string? Notes,
    IReadOnlyList<AwardResultVendorInput> Vendors,
    string? PayloadJson);

public sealed record AwardResultVendorInput(
    string VendorId,
    string VendorName,
    decimal? BidPrice,
    decimal? TechnicalScore,
    decimal? CommercialScore,
    decimal? TotalScore,
    int? Rank,
    decimal? NegotiatedValue,
    decimal AwardValue,
    decimal AwardPercent,
    bool IsWinner,
    string? PayloadJson);

public sealed record SaveAwardResultResult(bool ProposalFound, AwardResultView? Result);

public sealed record AwardResultView(
    string ProposalKey,
    string Source,
    string? Method,
    DateTimeOffset? EvaluatedAt,
    string? EvaluatedBy,
    string? Notes,
    IReadOnlyList<AwardResultVendorView> Vendors);

public sealed record AwardResultVendorView(
    string VendorId,
    string VendorName,
    decimal? BidPrice,
    decimal? TechnicalScore,
    decimal? CommercialScore,
    decimal? TotalScore,
    int? Rank,
    decimal? NegotiatedValue,
    decimal AwardValue,
    decimal AwardPercent,
    bool IsWinner);
