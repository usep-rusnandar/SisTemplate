using IntegratedProcurement.Modules.ContractMonitoring.Domain;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

/// <summary>
/// Outcome of a single reminder command. <see cref="ContractFound"/> distinguishes a missing
/// contract (404) from a contract that simply was not due / already reminded. On a successful send
/// the originating <see cref="Contract"/> is returned so the caller can fan out side effects
/// (notification, email) without re-querying.
/// </summary>
public sealed record SendContractReminderResult(
    bool ContractFound,
    bool Sent,
    string? Tier,
    bool Escalated,
    string? Reason,
    Contract? Contract);

public sealed record ContractReminderScanSummary(
    int Scanned,
    int Sent,
    int Escalated,
    int Skipped,
    IReadOnlyList<ContractReminderScanItem> Items);

/// <summary>One reminder the scan actually recorded, carried back so the caller can send its email.</summary>
public sealed record ContractReminderScanItem(Contract Contract, string? Tier, bool Escalated);

public sealed record ContractImportSummary(
    int VersionRows,
    int DistinctContracts,
    int DuplicateRowsMerged,
    int DocumentsWithLinks);
