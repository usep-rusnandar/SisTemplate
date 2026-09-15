namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>
/// Live material row from E-Proposal. Rows are never persisted in the Tracker database during
/// proposal sync; consumers explicitly request the current source data when needed.
/// </summary>
public sealed record EproposalMaterialRow(
    string SourceProposalId,
    string? MaterialCode,
    string? MaterialDescription,
    string? MaterialSubclass,
    string? Brand,
    decimal Quantity,
    decimal EstimatedPrice,
    decimal TotalPrice,
    string? Currency,
    DateOnly? RequiredDate,
    string? Jobsite,
    string? Plant,
    string? ContractNo,
    string? ContractName);

public sealed record EproposalMaterialReadResult(
    bool Enabled,
    IReadOnlyList<EproposalMaterialRow> Rows)
{
    public static EproposalMaterialReadResult Disabled { get; } = new(false, Array.Empty<EproposalMaterialRow>());
}

public sealed record EproposalMaterialCurrencyRow(
    string SourceProposalId,
    string Currency);

public sealed record EproposalMaterialCurrencyReadResult(
    bool Enabled,
    IReadOnlyList<EproposalMaterialCurrencyRow> Rows)
{
    public static EproposalMaterialCurrencyReadResult Disabled { get; } =
        new(false, Array.Empty<EproposalMaterialCurrencyRow>());
}

public sealed record EproposalMaterialCurrencyTotal(
    string Currency,
    decimal TotalPrice);

public sealed record EproposalMaterialPageReadResult(
    bool Enabled,
    int Page,
    int PageSize,
    int TotalRows,
    IReadOnlyList<EproposalMaterialCurrencyTotal> Totals,
    IReadOnlyList<EproposalMaterialRow> Rows)
{
    public static EproposalMaterialPageReadResult Disabled(int page, int pageSize) =>
        new(false, page, pageSize, 0, Array.Empty<EproposalMaterialCurrencyTotal>(), Array.Empty<EproposalMaterialRow>());
}

/// <summary>Reads proposal materials live from the configured E-Proposal material view.</summary>
public interface IEproposalMaterialService
{
    Task<EproposalMaterialCurrencyReadResult> ListCurrenciesAsync(CancellationToken cancellationToken);

    Task<EproposalMaterialPageReadResult> GetPageBySourceProposalIdAsync(
        string sourceProposalId,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    Task<EproposalMaterialReadResult> GetBySourceProposalIdAsync(
        string sourceProposalId,
        CancellationToken cancellationToken);
}
