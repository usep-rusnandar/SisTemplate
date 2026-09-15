using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ProposalTracker.Domain;

/// <summary>
/// The structured commercial outcome of a proposal that feeds the Term Sheet (and the LOA). One per
/// proposal. Captured at the step that precedes Term Sheet: <b>Bid Evaluation</b> for Tender /
/// Pemilihan Langsung, or <b>Negotiation</b> for Penunjukan Langsung (which has no Bid Evaluation
/// step) — recorded via <see cref="Source"/>. Replaces the browser-only bid-eval state.
/// Per-vendor detail lives in <see cref="ProposalAwardResultVendor"/>.
/// </summary>
public sealed class ProposalAwardResult : AuditableEntity
{
    private ProposalAwardResult()
    {
        ProposalKey = string.Empty;
        Source = string.Empty;
        PayloadJson = string.Empty;
    }

    public ProposalAwardResult(
        Guid id,
        string proposalKey,
        string source,
        string? method,
        DateTimeOffset? evaluatedAt,
        string? evaluatedBy,
        string? notes,
        string payloadJson)
        : base(id)
    {
        ProposalKey = proposalKey;
        Source = source;
        Method = method;
        EvaluatedAt = evaluatedAt;
        EvaluatedBy = evaluatedBy;
        Notes = notes;
        PayloadJson = payloadJson;
    }

    public string ProposalKey { get; private set; }

    /// <summary>"BidEvaluation" (Tender / Pemilihan Langsung) or "Negotiation" (Penunjukan Langsung).</summary>
    public string Source { get; private set; }

    public string? Method { get; private set; }

    public DateTimeOffset? EvaluatedAt { get; private set; }

    public string? EvaluatedBy { get; private set; }

    public string? Notes { get; private set; }

    public string PayloadJson { get; private set; }

    public void UpdateFrom(string source, string? method, DateTimeOffset? evaluatedAt, string? evaluatedBy, string? notes, string payloadJson)
    {
        Source = source;
        Method = method;
        EvaluatedAt = evaluatedAt;
        EvaluatedBy = evaluatedBy;
        Notes = notes;
        PayloadJson = payloadJson;
    }
}
