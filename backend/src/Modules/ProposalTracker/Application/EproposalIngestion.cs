namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>
/// Pulls proposals from E-Proposal views into the Tracker domain as ReadyToDistribute rows.
/// Idempotent by ProposalKey: new rows insert; existing ReadyToDistribute rows refresh header + vendors;
/// in-progress / completed rows are left untouched.
/// </summary>
public interface IEproposalIngestionService
{
    Task<EproposalIngestionResult> IngestAsync(CancellationToken cancellationToken);
}

/// <param name="Enabled">False when EproposalConnection is not configured.</param>
/// <param name="Fetched">Header rows returned by the E-Proposal view.</param>
/// <param name="Inserted">New proposals created.</param>
/// <param name="Updated">ReadyToDistribute proposals refreshed from source.</param>
/// <param name="Skipped">Rows skipped (missing key, or non-refreshable lifecycle).</param>
public sealed record EproposalIngestionResult(
    bool Enabled,
    int Fetched,
    int Inserted,
    int Updated,
    int Skipped)
{
    public static EproposalIngestionResult Disabled { get; } = new(false, 0, 0, 0, 0);
}

public sealed class EproposalIngestionOptions
{
    public EproposalIngestionOptions(string? connectionString)
    {
        ConnectionString = connectionString;
    }

    public string? ConnectionString { get; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}
