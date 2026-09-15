using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

public sealed class ContractReminder : AuditableEntity
{
    private ContractReminder()
    {
        ContractKey = string.Empty;
        ReminderKey = string.Empty;
        Tier = string.Empty;
        Trigger = string.Empty;
        PayloadJson = string.Empty;
    }

    public ContractReminder(
        Guid id,
        string contractKey,
        string reminderKey,
        string tier,
        DateTimeOffset? sentAt,
        string trigger,
        int daysToExpiry,
        bool escalated,
        string payloadJson)
        : base(id)
    {
        ContractKey = contractKey;
        ReminderKey = reminderKey;
        Tier = tier;
        SentAt = sentAt;
        Trigger = trigger;
        DaysToExpiry = daysToExpiry;
        Escalated = escalated;
        PayloadJson = payloadJson;
    }

    public string ContractKey { get; private set; }

    public string ReminderKey { get; private set; }

    public string Tier { get; private set; }

    public DateTimeOffset? SentAt { get; private set; }

    public string Trigger { get; private set; }

    public int DaysToExpiry { get; private set; }

    public bool Escalated { get; private set; }

    public string PayloadJson { get; private set; }
}
