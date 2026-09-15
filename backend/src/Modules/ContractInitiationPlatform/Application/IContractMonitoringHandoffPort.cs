namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Application;

/// <summary>
/// Cross-module write contract used by CIP when a Contract activity is completed: register the
/// executed contract into Contract Monitoring so CM officers can see and open it. Implemented by
/// Contract Monitoring Infrastructure; returns DTO outcome only.
/// </summary>
public interface IContractMonitoringHandoffPort
{
    /// <summary>
    /// Idempotent upsert of a CM contract row keyed by <see cref="CipContractHandoffCommand.ContractKey"/>.
    /// </summary>
    Task<CipContractHandoffResult> UpsertFromCipAsync(CipContractHandoffCommand command, CancellationToken cancellationToken);
}

public sealed record CipContractHandoffCommand(
    string ContractKey,
    string CaseKey,
    string Title,
    string SupplierName,
    string? Jobsite,
    string? Department,
    decimal ContractValue,
    string? PicNames,
    string? Owner,
    string? Template,
    DateOnly? EffectiveDate,
    DateOnly? ExpiredDate,
    DateOnly? ContractDate,
    DateOnly? ReceivedDate,
    string? DocumentContainer,
    string? DocumentBlobKey,
    string? DocumentFileName,
    string? ProposalKey,
    string? ProposalNumber,
    string? TermsheetNumber,
    string? Source);

public sealed record CipContractHandoffResult(bool Applied, bool Created, string ContractKey);
