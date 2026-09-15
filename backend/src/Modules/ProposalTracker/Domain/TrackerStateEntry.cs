using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ProposalTracker.Domain;

public sealed class TrackerStateEntry : AuditableEntity
{
    private TrackerStateEntry()
    {
        StorageKey = string.Empty;
        PayloadJson = string.Empty;
    }

    public TrackerStateEntry(Guid id, string storageKey, string payloadJson)
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
