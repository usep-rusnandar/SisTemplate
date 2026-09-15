namespace IntegratedProcurement.Platform.Administration.Domain;

/// <summary>
/// Single-document store for the About Application payload (bilingual JSON).
/// Mirrors <see cref="MenuTreeEntry"/>: one row, edited via admin later if needed.
/// </summary>
public sealed class ApplicationAboutEntry
{
    private ApplicationAboutEntry()
    {
        PayloadJson = string.Empty;
    }

    public ApplicationAboutEntry(Guid id, string payloadJson, DateTimeOffset timestamp)
    {
        Id = id;
        PayloadJson = payloadJson;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public string PayloadJson { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void UpdatePayload(string payloadJson, DateTimeOffset timestamp)
    {
        PayloadJson = payloadJson;
        UpdatedAt = timestamp;
    }
}
