namespace IntegratedProcurement.Platform.Persistence.FrontendState;

public sealed class FrontendStateEntry
{
    private FrontendStateEntry()
    {
        Scope = string.Empty;
        Key = string.Empty;
        Value = string.Empty;
    }

    public FrontendStateEntry(
        Guid id,
        string scope,
        string key,
        string value,
        DateTimeOffset createdAt)
    {
        Id = id;
        Scope = scope;
        Key = key;
        Value = value;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public string Scope { get; private set; }

    public string Key { get; private set; }

    public string Value { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void UpdateValue(string value, DateTimeOffset updatedAt)
    {
        Value = value;
        UpdatedAt = updatedAt;
    }
}
