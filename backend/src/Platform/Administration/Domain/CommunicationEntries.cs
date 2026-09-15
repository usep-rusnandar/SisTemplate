namespace SisTemplate.Platform.Administration.Domain;

public sealed class LanguageEntry
{
    private LanguageEntry()
    {
        Code = string.Empty;
        PayloadJson = string.Empty;
    }

    public LanguageEntry(Guid id, string code, string payloadJson, DateTimeOffset timestamp)
    {
        Id = id;
        Code = code;
        PayloadJson = payloadJson;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public string Code { get; private set; }

    public string PayloadJson { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void UpdatePayload(string payloadJson, DateTimeOffset timestamp)
    {
        PayloadJson = payloadJson;
        UpdatedAt = timestamp;
    }
}

public sealed class LanguageTextEntry
{
    private LanguageTextEntry()
    {
        TextKey = string.Empty;
        PayloadJson = string.Empty;
    }

    public LanguageTextEntry(Guid id, string textKey, string payloadJson, DateTimeOffset timestamp)
    {
        Id = id;
        TextKey = textKey;
        PayloadJson = payloadJson;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public string TextKey { get; private set; }

    public string PayloadJson { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void UpdatePayload(string payloadJson, DateTimeOffset timestamp)
    {
        PayloadJson = payloadJson;
        UpdatedAt = timestamp;
    }
}

public sealed class EmailTemplateEntry
{
    private EmailTemplateEntry()
    {
        TemplateId = string.Empty;
        Category = string.Empty;
        Status = string.Empty;
        PayloadJson = string.Empty;
    }

    public EmailTemplateEntry(Guid id, string templateId, string category, string status, string payloadJson, DateTimeOffset timestamp)
    {
        Id = id;
        TemplateId = templateId;
        Category = category;
        Status = status;
        PayloadJson = payloadJson;
        CreatedAt = timestamp;
        UpdatedAt = timestamp;
    }

    public Guid Id { get; private set; }

    public string TemplateId { get; private set; }

    public string Category { get; private set; }

    public string Status { get; private set; }

    public string PayloadJson { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(string category, string status, string payloadJson, DateTimeOffset timestamp)
    {
        Category = category;
        Status = status;
        PayloadJson = payloadJson;
        UpdatedAt = timestamp;
    }
}

public sealed class EmailSentEntry
{
    private EmailSentEntry()
    {
        MessageId = string.Empty;
        Category = string.Empty;
        Status = string.Empty;
        PayloadJson = string.Empty;
    }

    public EmailSentEntry(Guid id, string messageId, string category, string status, DateTimeOffset sentAt, string payloadJson)
    {
        Id = id;
        MessageId = messageId;
        Category = category;
        Status = status;
        SentAt = sentAt;
        PayloadJson = payloadJson;
    }

    public Guid Id { get; private set; }

    public string MessageId { get; private set; }

    public string Category { get; private set; }

    public string Status { get; private set; }

    public DateTimeOffset SentAt { get; private set; }

    public string PayloadJson { get; private set; }
}
