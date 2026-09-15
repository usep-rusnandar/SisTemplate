namespace IntegratedProcurement.Platform.Administration.Domain;

public sealed class MasterDataSetEntry
{
    private MasterDataSetEntry()
    {
        Key = string.Empty;
        Name = string.Empty;
        TableName = string.Empty;
        Owner = string.Empty;
    }

    public MasterDataSetEntry(Guid id, string key, string name, string tableName, string owner, bool isReadOnly, DateTimeOffset timestamp)
    {
        Id = id;
        Key = key;
        Name = name;
        TableName = tableName;
        Owner = owner;
        IsReadOnly = isReadOnly;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public string Key { get; private set; }

    public string Name { get; private set; }

    public string TableName { get; private set; }

    public string Owner { get; private set; }

    public bool IsReadOnly { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void UpdateMetadata(string name, string owner, DateTimeOffset timestamp)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(owner);
        Name = name.Trim();
        Owner = owner.Trim();
        UpdatedAt = timestamp;
    }
}
