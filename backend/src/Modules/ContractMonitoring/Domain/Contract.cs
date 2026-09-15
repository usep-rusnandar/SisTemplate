using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

public sealed class Contract : AuditableEntity
{
    private Contract()
    {
        ContractKey = string.Empty;
        SupplierName = string.Empty;
        Title = string.Empty;
        Status = string.Empty;
        PayloadJson = string.Empty;
    }

    public Contract(
        Guid id,
        string contractKey,
        string supplierName,
        string title,
        string? classification,
        string? subClass,
        string? jobsite,
        string? template,
        string? frequency,
        string? owner,
        string? userDepartment,
        string? picNames,
        string? picEmail,
        decimal contractValue,
        DateOnly? currentExpiryDate,
        DateOnly? effectiveDate,
        DateOnly? contractDate,
        DateOnly? receivedDate,
        string? ownership,
        string? systemNumbersJson,
        string? documentLink,
        string? priceAdjustment,
        string status,
        int daysToExpiry,
        int versionCount,
        string? latestVersionType,
        string payloadJson)
        : base(id)
    {
        ContractKey = contractKey;
        SupplierName = supplierName;
        Title = title;
        Classification = classification;
        SubClass = subClass;
        Jobsite = jobsite;
        Template = template;
        Frequency = frequency;
        Owner = owner;
        UserDepartment = userDepartment;
        PicNames = picNames;
        PicEmail = picEmail;
        ContractValue = contractValue;
        CurrentExpiryDate = currentExpiryDate;
        EffectiveDate = effectiveDate;
        ContractDate = contractDate;
        ReceivedDate = receivedDate;
        Ownership = ownership;
        SystemNumbersJson = systemNumbersJson;
        DocumentLink = documentLink;
        PriceAdjustment = priceAdjustment;
        Status = status;
        DaysToExpiry = daysToExpiry;
        VersionCount = versionCount;
        LatestVersionType = latestVersionType;
        PayloadJson = payloadJson;
    }

    public string ContractKey { get; private set; }

    public string SupplierName { get; private set; }

    public string Title { get; private set; }

    public string? Classification { get; private set; }

    public string? SubClass { get; private set; }

    public string? Jobsite { get; private set; }

    public string? Template { get; private set; }

    public string? Frequency { get; private set; }

    public string? Owner { get; private set; }

    public string? UserDepartment { get; private set; }

    public string? PicNames { get; private set; }

    public string? PicEmail { get; private set; }

    public decimal ContractValue { get; private set; }

    public DateOnly? CurrentExpiryDate { get; private set; }

    public DateOnly? EffectiveDate { get; private set; }

    public DateOnly? ContractDate { get; private set; }

    public DateOnly? ReceivedDate { get; private set; }

    public string? Ownership { get; private set; }

    public string? SystemNumbersJson { get; private set; }

    public string? DocumentLink { get; private set; }

    public string? PriceAdjustment { get; private set; }

    public string Status { get; private set; }

    public int DaysToExpiry { get; private set; }

    public int VersionCount { get; private set; }

    public string? LatestVersionType { get; private set; }

    public string PayloadJson { get; private set; }
}
