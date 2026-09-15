using SisTemplate.BuildingBlocks.Domain.Entities;

namespace SisTemplate.Platform.Audit.Domain;

public sealed class AuditLogEntry : Entity
{
    private AuditLogEntry()
    {
        Action = string.Empty;
        ActorName = string.Empty;
        Module = string.Empty;
        Description = string.Empty;
        IpAddress = string.Empty;
    }

    public AuditLogEntry(
        Guid id,
        string action,
        string actorName,
        string module,
        string description,
        string? ipAddress,
        string? userAgent,
        DateTimeOffset occurredAt,
        string? metadataJson = null)
        : base(id)
    {
        Action = action;
        ActorName = actorName;
        Module = module;
        Description = description;
        IpAddress = ipAddress ?? string.Empty;
        UserAgent = userAgent;
        OccurredAt = occurredAt;
        MetadataJson = metadataJson;
    }

    public string Action { get; private set; }

    public string ActorName { get; private set; }

    public string Module { get; private set; }

    public string Description { get; private set; }

    public string IpAddress { get; private set; }

    public string? UserAgent { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public string? MetadataJson { get; private set; }
}
