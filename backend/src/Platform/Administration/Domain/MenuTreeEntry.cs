namespace IntegratedProcurement.Platform.Administration.Domain;

public sealed class MenuTreeEntry
{
    private MenuTreeEntry()
    {
        MenuKey = string.Empty;
        PayloadJson = string.Empty;
    }

    public MenuTreeEntry(Guid id, string menuKey, string payloadJson, DateTimeOffset timestamp)
    {
        Id = id;
        MenuKey = menuKey;
        PayloadJson = payloadJson;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public string MenuKey { get; private set; }

    public string PayloadJson { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void UpdatePayload(string payloadJson, DateTimeOffset timestamp)
    {
        PayloadJson = payloadJson;
        UpdatedAt = timestamp;
    }
}
