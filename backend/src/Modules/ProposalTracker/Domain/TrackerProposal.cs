using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ProposalTracker.Domain;

public sealed class TrackerProposal : AuditableEntity
{
    private TrackerProposal()
    {
        ProposalKey = string.Empty;
        ProposalNumber = string.Empty;
        Title = string.Empty;
        LifecycleStatus = string.Empty;
        CurrentStage = string.Empty;
        PayloadJson = string.Empty;
    }

    public TrackerProposal(
        Guid id,
        string proposalKey,
        string proposalNumber,
        string title,
        string? aribaId,
        string? commodity,
        string? jobsite,
        string? department,
        string? contractType,
        string? contractualType,
        decimal amount,
        string? trackerMethod,
        string lifecycleStatus,
        string currentStage,
        string? priority,
        string? ownerName,
        string? assignedOfficerName,
        DateOnly? requirementDate,
        int agingDays,
        int slaDays,
        int overdueDays,
        string payloadJson)
        : base(id)
    {
        ProposalKey = proposalKey;
        ProposalNumber = proposalNumber;
        Title = title;
        AribaId = aribaId;
        Commodity = commodity;
        Jobsite = jobsite;
        Department = department;
        ContractType = contractType;
        ContractualType = contractualType;
        Amount = amount;
        TrackerMethod = trackerMethod;
        LifecycleStatus = lifecycleStatus;
        CurrentStage = currentStage;
        Priority = priority;
        OwnerName = ownerName;
        AssignedOfficerName = assignedOfficerName;
        RequirementDate = requirementDate;
        AgingDays = agingDays;
        SlaDays = slaDays;
        OverdueDays = overdueDays;
        PayloadJson = payloadJson;
    }

    public string ProposalKey { get; private set; }

    public string ProposalNumber { get; private set; }

    public string Title { get; private set; }

    public string? AribaId { get; private set; }

    public string? Commodity { get; private set; }

    public string? Jobsite { get; private set; }

    public string? Department { get; private set; }

    public string? ContractType { get; private set; }

    public string? ContractualType { get; private set; }

    public decimal Amount { get; private set; }

    public string? TrackerMethod { get; private set; }

    public string LifecycleStatus { get; private set; }

    public string CurrentStage { get; private set; }

    public string? Priority { get; private set; }

    public string? OwnerName { get; private set; }

    public string? AssignedOfficerName { get; private set; }

    public DateOnly? RequirementDate { get; private set; }

    public int AgingDays { get; private set; }

    public int SlaDays { get; private set; }

    public int OverdueDays { get; private set; }

    public string PayloadJson { get; private set; }

    public void SetTrackerMethod(string? trackerMethod)
    {
        if (string.IsNullOrWhiteSpace(trackerMethod))
        {
            return;
        }

        TrackerMethod = trackerMethod.Trim();
    }

    public void Distribute(string assignedOfficerName, string currentStage)
    {
        AssignedOfficerName = assignedOfficerName;
        LifecycleStatus = "OnProgress";
        CurrentStage = currentStage;
    }

    public void ReassignOfficer(string assignedOfficerName)
    {
        AssignedOfficerName = assignedOfficerName;
    }

    public void SetAribaId(string? aribaId)
    {
        AribaId = string.IsNullOrWhiteSpace(aribaId) ? null : aribaId.Trim();
    }

    public void SetWorkflowState(string lifecycleStatus, string currentStage)
    {
        LifecycleStatus = lifecycleStatus;
        CurrentStage = currentStage;
    }

    public void UpdateFrom(
        string proposalNumber,
        string title,
        string? aribaId,
        string? commodity,
        string? jobsite,
        string? department,
        string? contractType,
        string? contractualType,
        decimal amount,
        string? trackerMethod,
        string lifecycleStatus,
        string currentStage,
        string? priority,
        string? ownerName,
        string? assignedOfficerName,
        DateOnly? requirementDate,
        int agingDays,
        int slaDays,
        int overdueDays,
        string payloadJson)
    {
        ProposalNumber = proposalNumber;
        Title = title;
        AribaId = aribaId;
        Commodity = commodity;
        Jobsite = jobsite;
        Department = department;
        ContractType = contractType;
        ContractualType = contractualType;
        Amount = amount;
        TrackerMethod = trackerMethod;
        LifecycleStatus = lifecycleStatus;
        CurrentStage = currentStage;
        Priority = priority;
        OwnerName = ownerName;
        AssignedOfficerName = assignedOfficerName;
        RequirementDate = requirementDate;
        AgingDays = agingDays;
        SlaDays = slaDays;
        OverdueDays = overdueDays;
        PayloadJson = payloadJson;
    }
}
