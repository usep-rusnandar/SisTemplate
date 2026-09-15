using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

public sealed class ContractVersion : AuditableEntity
{
    private ContractVersion()
    {
        ContractKey = string.Empty;
        VersionKey = string.Empty;
        VersionType = string.Empty;
        Title = string.Empty;
        Status = string.Empty;
        PayloadJson = string.Empty;
    }

    public ContractVersion(
        Guid id,
        string contractKey,
        string versionKey,
        int rowIndex,
        string versionType,
        string title,
        string status,
        decimal contractValue,
        DateOnly? receivedDate,
        DateOnly? contractDate,
        DateOnly? effectiveDate,
        DateOnly? expiredDate,
        string? supplierName,
        string? jobsite,
        string? classification,
        string? subClass,
        string? template,
        string? frequency,
        string? owner,
        string? userDepartment,
        string? picNames,
        string? picEmail,
        string? ownership,
        string? systemNumbersJson,
        string? documentLink,
        string? priceAdjustment,
        string payloadJson)
        : base(id)
    {
        ContractKey = contractKey;
        VersionKey = versionKey;
        RowIndex = rowIndex;
        VersionType = versionType;
        Title = title;
        Status = status;
        ContractValue = contractValue;
        ReceivedDate = receivedDate;
        ContractDate = contractDate;
        EffectiveDate = effectiveDate;
        ExpiredDate = expiredDate;
        SupplierName = supplierName;
        Jobsite = jobsite;
        Classification = classification;
        SubClass = subClass;
        Template = template;
        Frequency = frequency;
        Owner = owner;
        UserDepartment = userDepartment;
        PicNames = picNames;
        PicEmail = picEmail;
        Ownership = ownership;
        SystemNumbersJson = systemNumbersJson;
        DocumentLink = documentLink;
        PriceAdjustment = priceAdjustment;
        PayloadJson = payloadJson;
    }

    public string ContractKey { get; private set; }

    public string VersionKey { get; private set; }

    public int RowIndex { get; private set; }

    public string VersionType { get; private set; }

    public string Title { get; private set; }

    public string Status { get; private set; }

    public decimal ContractValue { get; private set; }

    public DateOnly? ReceivedDate { get; private set; }

    public DateOnly? ContractDate { get; private set; }

    public DateOnly? EffectiveDate { get; private set; }

    public DateOnly? ExpiredDate { get; private set; }

    public string? SupplierName { get; private set; }

    public string? Jobsite { get; private set; }

    public string? Classification { get; private set; }

    public string? SubClass { get; private set; }

    public string? Template { get; private set; }

    public string? Frequency { get; private set; }

    public string? Owner { get; private set; }

    public string? UserDepartment { get; private set; }

    public string? PicNames { get; private set; }

    public string? PicEmail { get; private set; }

    public string? Ownership { get; private set; }

    public string? SystemNumbersJson { get; private set; }

    public string? DocumentLink { get; private set; }

    public string? PriceAdjustment { get; private set; }

    public string PayloadJson { get; private set; }
}
