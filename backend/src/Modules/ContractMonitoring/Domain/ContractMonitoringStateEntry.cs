using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

public sealed class ContractMonitoringStateEntry : AuditableEntity
{
    private ContractMonitoringStateEntry()
    {
        StorageKey = string.Empty;
        PayloadJson = string.Empty;
    }

    public ContractMonitoringStateEntry(Guid id, string storageKey, string payloadJson)
        : base(id)
    {
        StorageKey = storageKey;
        PayloadJson = payloadJson;
    }

    public string StorageKey { get; private set; }

    public string PayloadJson { get; private set; }

    public void UpdatePayload(string payloadJson)
    {
        PayloadJson = payloadJson;
    }
}
