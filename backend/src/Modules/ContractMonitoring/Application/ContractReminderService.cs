using System.Text.Json;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

/// <summary>
/// Command logic for contract-expiry reminders. Owns the tiering rule (via <see cref="ReminderPolicy"/>),
/// builds the reminder record, and persists it through the <see cref="IContractRepository"/> port.
/// Cross-cutting side effects (audit trail, in-app notification, email) are the caller's responsibility:
/// this service returns enough context (the contract, the outcome) for the caller to fan them out.
/// </summary>
public sealed class ContractReminderService
{
    private static readonly JsonSerializerOptions PayloadOptions = new(JsonSerializerDefaults.Web);

    private readonly IContractRepository _repository;

    public ContractReminderService(IContractRepository repository)
    {
        _repository = repository;
    }

    /// <summary>Send a reminder for one contract. <paramref name="force"/> bypasses the "already sent this tier" guard.</summary>
    public async Task<SendContractReminderResult> SendAsync(
        string contractKey,
        string? trigger,
        bool force,
        CancellationToken cancellationToken)
    {
        var contract = await _repository.GetByKeyAsync(contractKey, cancellationToken);
        if (contract is null)
        {
            return new SendContractReminderResult(false, false, null, false, null, null);
        }

        var outcome = await TryAddReminderAsync(contract, Clean(trigger) ?? "Manual", force, cancellationToken);
        if (!outcome.Sent)
        {
            return new SendContractReminderResult(true, false, outcome.Tier, outcome.Escalated, outcome.Reason, contract);
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return new SendContractReminderResult(true, true, outcome.Tier, outcome.Escalated, null, contract);
    }

    /// <summary>Scan all due contracts and send any reminder not already recorded for the current tier.</summary>
    public async Task<ContractReminderScanSummary> RunScanAsync(CancellationToken cancellationToken)
    {
        var contracts = await _repository.GetDueForScanAsync(cancellationToken);

        var sent = 0;
        var escalated = 0;
        var skipped = 0;
        var items = new List<ContractReminderScanItem>();
        foreach (var contract in contracts)
        {
            var outcome = await TryAddReminderAsync(contract, "Scheduled", false, cancellationToken);
            if (outcome.Sent)
            {
                sent++;
                if (outcome.Escalated)
                {
                    escalated++;
                }

                items.Add(new ContractReminderScanItem(contract, outcome.Tier, outcome.Escalated));
            }
            else if (outcome.Reason == "already_sent")
            {
                skipped++;
            }
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return new ContractReminderScanSummary(contracts.Count, sent, escalated, skipped, items);
    }

    private async Task<ReminderOutcome> TryAddReminderAsync(
        Contract contract,
        string trigger,
        bool force,
        CancellationToken cancellationToken)
    {
        var tier = ReminderPolicy.TierForDays(contract.DaysToExpiry);
        if (tier is null)
        {
            return new ReminderOutcome(false, null, false, "not_due");
        }

        if (!force && await _repository.ReminderExistsAsync(contract.ContractKey, tier, cancellationToken))
        {
            return new ReminderOutcome(false, tier, contract.DaysToExpiry <= 30, "already_sent");
        }

        var sentAt = DateTimeOffset.UtcNow;
        var escalated = contract.DaysToExpiry <= 30;
        var reminderKey = $"{contract.ContractKey}:{tier}:{trigger}:{sentAt:yyyyMMddHHmmssffff}";
        var payloadJson = JsonSerializer.Serialize(new
        {
            contract.ContractKey,
            contract.SupplierName,
            contract.Title,
            contract.PicNames,
            contract.PicEmail,
            contract.CurrentExpiryDate,
            contract.DaysToExpiry,
            tier,
            trigger,
            sentAt,
            escalated
        }, PayloadOptions);

        _repository.AddReminder(new ContractReminder(
            Guid.NewGuid(),
            contract.ContractKey,
            reminderKey,
            tier,
            sentAt,
            trigger,
            contract.DaysToExpiry,
            escalated,
            payloadJson));

        return new ReminderOutcome(true, tier, escalated, null);
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private readonly record struct ReminderOutcome(bool Sent, string? Tier, bool Escalated, string? Reason);
}
