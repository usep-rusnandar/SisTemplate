namespace IntegratedProcurement.Platform.Persistence.ModuleState;

public sealed class ModuleStateEntry
{
    private ModuleStateEntry()
    {
        ModuleKey = string.Empty;
        StorageKey = string.Empty;
        PayloadJson = string.Empty;
    }

    public ModuleStateEntry(Guid id, string moduleKey, string storageKey, string payloadJson)
    {
        Id = id;
        ModuleKey = moduleKey;
        StorageKey = storageKey;
        PayloadJson = payloadJson;
        CreatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public Guid Id { get; private set; }
    public string ModuleKey { get; private set; }
    public string StorageKey { get; private set; }
    public string PayloadJson { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void UpdatePayload(string payloadJson)
    {
        PayloadJson = payloadJson;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
