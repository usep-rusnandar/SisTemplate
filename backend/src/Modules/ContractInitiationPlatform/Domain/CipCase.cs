using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;

public sealed class CipCase : AuditableEntity
{
    private CipCase()
    {
        CaseKey = string.Empty;
        Title = string.Empty;
        Stage = string.Empty;
        Status = string.Empty;
        PayloadJson = string.Empty;
    }

    public CipCase(
        Guid id,
        string caseKey,
        string? loaKey,
        string? loaNumber,
        string title,
        string? vendorId,
        string? vendorName,
        string? jobsite,
        string? department,
        decimal value,
        decimal proposalTotalValue,
        decimal awardPercent,
        string stage,
        string status,
        string? template,
        string? requestor,
        string? procurement,
        string? legal,
        DateOnly? createdAtDate,
        string? source,
        string? proposalKey,
        string? proposalNumber,
        string? termsheetNumber,
        string? contractNumber,
        string payloadJson)
        : base(id)
    {
        CaseKey = caseKey;
        LoaKey = loaKey;
        LoaNumber = loaNumber;
        Title = title;
        VendorId = vendorId;
        VendorName = vendorName;
        Jobsite = jobsite;
        Department = department;
        Value = value;
        ProposalTotalValue = proposalTotalValue;
        AwardPercent = awardPercent;
        Stage = stage;
        Status = status;
        Template = template;
        Requestor = requestor;
        Procurement = procurement;
        Legal = legal;
        CreatedAtDate = createdAtDate;
        Source = source;
        ProposalKey = proposalKey;
        ProposalNumber = proposalNumber;
        TermsheetNumber = termsheetNumber;
        ContractNumber = contractNumber;
        PayloadJson = payloadJson;
    }

    public string CaseKey { get; private set; }

    public string? LoaKey { get; private set; }

    public string? LoaNumber { get; private set; }

    public string Title { get; private set; }

    public string? VendorId { get; private set; }

    public string? VendorName { get; private set; }

    public string? Jobsite { get; private set; }

    public string? Department { get; private set; }

    public decimal Value { get; private set; }

    public decimal ProposalTotalValue { get; private set; }

    public decimal AwardPercent { get; private set; }

    public string Stage { get; private set; }

    public string Status { get; private set; }

    public string? Template { get; private set; }

    public string? Requestor { get; private set; }

    public string? Procurement { get; private set; }

    public string? Legal { get; private set; }

    public DateOnly? CreatedAtDate { get; private set; }

    public string? Source { get; private set; }

    public string? ProposalKey { get; private set; }

    public string? ProposalNumber { get; private set; }

    public string? TermsheetNumber { get; private set; }

    public string? ContractNumber { get; private set; }

    public string PayloadJson { get; private set; }

    public void SetWorkflowStage(string stage, string status)
    {
        Stage = stage;
        Status = status;
    }

    public void SelectTemplate(string? template)
    {
        Template = template;
    }

    public void RegisterTermsheet(string? termsheetNumber)
    {
        TermsheetNumber = termsheetNumber;
    }

    public void RegisterContractNumber(string? contractNumber)
    {
        ContractNumber = contractNumber;
    }
}
