namespace IntegratedProcurement.Platform.Settings.Domain;

public sealed class SettingEntry
{
    private SettingEntry()
    {
        Key = string.Empty;
        ValueJson = string.Empty;
    }

    public SettingEntry(Guid id, string key, string valueJson, DateTimeOffset timestamp)
    {
        Id = id;
        Key = key;
        ValueJson = valueJson;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public string Key { get; private set; }

    public string ValueJson { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void UpdateValue(string valueJson, DateTimeOffset timestamp)
    {
        ValueJson = valueJson;
        UpdatedAt = timestamp;
    }
}
