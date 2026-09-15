using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>One line of a contract's List of Material (LoM) register.</summary>
public sealed class ContractMaterial : AuditableEntity
{
    private ContractMaterial()
    {
        ContractKey = string.Empty;
        MaterialNumber = string.Empty;
        Description = string.Empty;
        Site = string.Empty;
        Currency = string.Empty;
    }

    public ContractMaterial(
        Guid id,
        string contractKey,
        int sortOrder,
        string materialNumber,
        string description,
        string site,
        string currency,
        decimal unitPrice)
        : base(id)
    {
        ContractKey = contractKey;
        SortOrder = sortOrder;
        MaterialNumber = materialNumber;
        Description = description;
        Site = site;
        Currency = currency;
        UnitPrice = unitPrice;
    }

    public string ContractKey { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>Material/Service Number — stored as text to preserve leading zeros.</summary>
    public string MaterialNumber { get; private set; }

    public string Description { get; private set; }

    public string Site { get; private set; }

    public string Currency { get; private set; }

    public decimal UnitPrice { get; private set; }
}
