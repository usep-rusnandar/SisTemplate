using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;

public sealed class CipCaseActivity : AuditableEntity
{
    private CipCaseActivity()
    {
        CaseKey = string.Empty;
        ActivityKey = string.Empty;
        ActivityType = string.Empty;
        StageKey = string.Empty;
        PayloadJson = string.Empty;
    }

    public CipCaseActivity(
        Guid id,
        string caseKey,
        string activityKey,
        string? activityType,
        string? stageKey,
        DateTimeOffset? occurredAt,
        string? actorName,
        string? message,
        string payloadJson)
        : base(id)
    {
        CaseKey = caseKey;
        ActivityKey = activityKey;
        ActivityType = activityType ?? string.Empty;
        StageKey = stageKey ?? string.Empty;
        OccurredAt = occurredAt;
        ActorName = actorName;
        Message = message;
        PayloadJson = payloadJson;
    }

    public string CaseKey { get; private set; }

    public string ActivityKey { get; private set; }

    public string ActivityType { get; private set; }

    public string StageKey { get; private set; }

    public DateTimeOffset? OccurredAt { get; private set; }

    public string? ActorName { get; private set; }

    public string? Message { get; private set; }

    public string PayloadJson { get; private set; }
}
