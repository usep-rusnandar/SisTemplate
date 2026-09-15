namespace IntegratedProcurement.Platform.Administration.Domain;

public sealed class MasterDataRecordEntry
{
    private MasterDataRecordEntry()
    {
        SetKey = string.Empty;
        Code = string.Empty;
        Name = string.Empty;
        Status = string.Empty;
        Description = string.Empty;
    }

    public MasterDataRecordEntry(
        Guid id,
        string setKey,
        string code,
        string name,
        string status,
        string description,
        string? payloadJson,
        DateTimeOffset timestamp,
        string? parentCode = null)
    {
        Id = id;
        SetKey = setKey;
        Code = code;
        Name = name;
        Status = status;
        Description = description;
        PayloadJson = payloadJson;
        ParentCode = string.IsNullOrWhiteSpace(parentCode) ? null : parentCode;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public string SetKey { get; private set; }

    public string Code { get; private set; }

    public string Name { get; private set; }

    public string Status { get; private set; }

    public string Description { get; private set; }

    public string? PayloadJson { get; private set; }

    /// <summary>Code of the parent record within the same set (for hierarchical masters like region /
    /// classification). Null for flat/top-level records. Indexed with SetKey for fast cascade queries.</summary>
    public string? ParentCode { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(string name, string status, string description, string? payloadJson, DateTimeOffset timestamp, string? parentCode = null)
    {
        Name = name;
        Status = status;
        Description = description;
        PayloadJson = payloadJson;
        ParentCode = string.IsNullOrWhiteSpace(parentCode) ? null : parentCode;
        UpdatedAt = timestamp;
    }
}
