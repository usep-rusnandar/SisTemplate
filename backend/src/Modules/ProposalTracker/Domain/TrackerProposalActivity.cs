using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ProposalTracker.Domain;

public sealed class TrackerProposalActivity : AuditableEntity
{
    private TrackerProposalActivity()
    {
        ProposalKey = string.Empty;
        ActivityKey = string.Empty;
        StageId = string.Empty;
        Title = string.Empty;
        Owner = string.Empty;
        Status = string.Empty;
        PayloadJson = string.Empty;
    }

    public TrackerProposalActivity(
        Guid id,
        string proposalKey,
        string activityKey,
        string? stageId,
        string title,
        string? owner,
        string status,
        int masterLeadDays,
        int targetLeadDays,
        DateOnly? targetDate,
        DateTimeOffset? startedAt,
        DateTimeOffset? completedAt,
        int evidenceCount,
        string? lockedReason,
        string payloadJson)
        : base(id)
    {
        ProposalKey = proposalKey;
        ActivityKey = activityKey;
        StageId = stageId ?? string.Empty;
        Title = title;
        Owner = owner ?? string.Empty;
        Status = status;
        MasterLeadDays = masterLeadDays;
        TargetLeadDays = targetLeadDays;
        TargetDate = targetDate;
        StartedAt = startedAt;
        CompletedAt = completedAt;
        EvidenceCount = evidenceCount;
        LockedReason = lockedReason;
        PayloadJson = payloadJson;
    }

    public string ProposalKey { get; private set; }

    public string ActivityKey { get; private set; }

    public string StageId { get; private set; }

    public string Title { get; private set; }

    public string Owner { get; private set; }

    public string Status { get; private set; }

    public int MasterLeadDays { get; private set; }

    public int TargetLeadDays { get; private set; }

    public DateOnly? TargetDate { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public int EvidenceCount { get; private set; }

    public string? LockedReason { get; private set; }

    public string PayloadJson { get; private set; }

    public void ClockIn(DateTimeOffset timestamp)
    {
        StartedAt ??= timestamp;
        LockedReason = null;
    }

    public void Complete(DateTimeOffset timestamp, int evidenceCount)
    {
        StartedAt ??= timestamp;
        CompletedAt = timestamp;
        Status = "Completed";
        EvidenceCount = evidenceCount;
        LockedReason = null;
    }

    public void Unlock(DateTimeOffset timestamp)
    {
        if (Status != "Locked")
        {
            return;
        }

        Status = "Pending";
        StartedAt ??= timestamp;
        LockedReason = null;
    }

    public void Recycle(DateTimeOffset timestamp)
    {
        StartedAt = timestamp;
        CompletedAt = null;
        Status = "Pending";
        EvidenceCount = 0;
        LockedReason = null;
    }

    public void LockAfterRecycle(string recycledActivityTitle)
    {
        StartedAt = null;
        CompletedAt = null;
        Status = "Locked";
        EvidenceCount = 0;
        LockedReason = $"Recycle executed. Re-complete {recycledActivityTitle} first.";
    }

    public void Cancel(DateTimeOffset timestamp)
    {
        CompletedAt = timestamp;
        Status = "Canceled";
        LockedReason = null;
    }

    public void LockAfterCancel()
    {
        StartedAt = null;
        CompletedAt = null;
        Status = "Locked";
        LockedReason = "Proposal canceled. No further activity is required.";
    }

    public void UpdateFrom(
        string? stageId,
        string title,
        string? owner,
        string status,
        int masterLeadDays,
        int targetLeadDays,
        DateOnly? targetDate,
        DateTimeOffset? startedAt,
        DateTimeOffset? completedAt,
        int evidenceCount,
        string? lockedReason,
        string payloadJson)
    {
        StageId = stageId ?? string.Empty;
        Title = title;
        Owner = owner ?? string.Empty;
        Status = status;
        MasterLeadDays = masterLeadDays;
        TargetLeadDays = targetLeadDays;
        TargetDate = targetDate;
        StartedAt = startedAt;
        CompletedAt = completedAt;
        EvidenceCount = evidenceCount;
        LockedReason = lockedReason;
        PayloadJson = payloadJson;
    }
}
