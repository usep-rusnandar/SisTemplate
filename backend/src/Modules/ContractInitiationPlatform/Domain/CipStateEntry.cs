using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;

public sealed class CipStateEntry : AuditableEntity
{
    private CipStateEntry()
    {
        StorageKey = string.Empty;
        PayloadJson = string.Empty;
    }

    public CipStateEntry(Guid id, string storageKey, string payloadJson)
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
