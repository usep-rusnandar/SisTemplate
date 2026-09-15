using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

// Vendor child records. Every row now carries a Guid surrogate PK (VendorKbliId / VendorBrandId / …);
// natural uniqueness (VendorId + code) is enforced by a unique index rather than a composite PK. All
// reference master data by CODE (no hard FK) and hold no binary files — documents live in
// VendorDocument on Blob, linked via OwnerKey.

/// <summary>A KBLI (business classification) a vendor holds. Mirrors VENDOR_KBLI_T (Guid PK VendorKbliId).</summary>
public sealed class VendorKbli : AuditableEntity
{
    private VendorKbli() { }

    private VendorKbli(string vendorId, string kbliTypeCode, string kbliCode, string kbliStatusCode)
        : base(Guid.NewGuid())
    {
        VendorId = vendorId;
        KbliTypeCode = kbliTypeCode;
        KbliCode = kbliCode;
        KbliStatusCode = kbliStatusCode;
    }

    public string VendorId { get; private set; } = string.Empty;
    public string KbliTypeCode { get; private set; } = string.Empty;
    public string KbliCode { get; private set; } = string.Empty;
    public string KbliStatusCode { get; private set; } = string.Empty;

    public static VendorKbli Create(string vendorId, string kbliTypeCode, string kbliCode, string kbliStatusCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(kbliCode);
        return new VendorKbli(vendorId, kbliTypeCode?.Trim() ?? string.Empty, kbliCode.Trim(), kbliStatusCode?.Trim() ?? string.Empty);
    }
}

/// <summary>A brand a vendor represents. Mirrors VENDOR_BRAND_T (Guid PK VendorBrandId); unique per (VendorId, BrandName).</summary>
public sealed class VendorBrand : AuditableEntity
{
    private VendorBrand() { }

    private VendorBrand(string vendorId, string brandName, string? distributorTypeCode, DateOnly? expireDate)
        : base(Guid.NewGuid())
    {
        VendorId = vendorId;
        BrandName = brandName;
        DistributorTypeCode = distributorTypeCode;
        ExpireDate = expireDate;
    }

    public string VendorId { get; private set; } = string.Empty;
    public string BrandName { get; private set; } = string.Empty;
    public string? DistributorTypeCode { get; private set; }
    public DateOnly? ExpireDate { get; private set; }

    public static VendorBrand Create(string vendorId, string brandName, string? distributorTypeCode, DateOnly? expireDate)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(brandName);
        return new VendorBrand(vendorId, brandName.Trim(),
            string.IsNullOrWhiteSpace(distributorTypeCode) ? null : distributorTypeCode.Trim(), expireDate);
    }
}

/// <summary>Who entered a portfolio row. Immutable after insert — vendor replace-all never rewrites Officer rows.</summary>
public static class VendorPortfolioParties
{
    public const string Vendor = "Vendor";
    public const string Officer = "Officer";

    public static bool IsKnown(string? party) =>
        string.Equals(party, Vendor, StringComparison.OrdinalIgnoreCase)
        || string.Equals(party, Officer, StringComparison.OrdinalIgnoreCase);

    public static string Normalize(string? party) =>
        string.Equals(party, Officer, StringComparison.OrdinalIgnoreCase) ? Officer : Vendor;
}

/// <summary>A past project/portfolio entry. Mirrors VENDOR_PORTFOLIO_T (Guid PK VendorPortfolioId).</summary>
public sealed class VendorPortfolio : AuditableEntity
{
    private VendorPortfolio() { }

    private VendorPortfolio(
        string vendorId,
        string client,
        string scopeOfWork,
        decimal totalValue,
        DateOnly contractStartDate,
        DateOnly contractEndDate,
        string enteredByParty)
        : base(Guid.NewGuid())
    {
        VendorId = vendorId;
        Client = client;
        ScopeOfWork = scopeOfWork;
        TotalValue = totalValue;
        ContractStartDate = contractStartDate;
        ContractEndDate = contractEndDate;
        EnteredByParty = enteredByParty;
    }

    public string VendorId { get; private set; } = string.Empty;
    public string Client { get; private set; } = string.Empty;
    public string ScopeOfWork { get; private set; } = string.Empty;
    public decimal TotalValue { get; private set; }
    public DateOnly ContractStartDate { get; private set; }
    public DateOnly ContractEndDate { get; private set; }

    /// <summary><see cref="VendorPortfolioParties.Vendor"/> or <see cref="VendorPortfolioParties.Officer"/>.</summary>
    public string EnteredByParty { get; private set; } = VendorPortfolioParties.Vendor;

    public bool IsOfficerEntered =>
        string.Equals(EnteredByParty, VendorPortfolioParties.Officer, StringComparison.OrdinalIgnoreCase);

    /// <summary>Document slot key — must match the wizard's <c>VwPortfolioOwnerKey</c> (`{client}|{yyyy-MM-dd}`).</summary>
    public string DocumentOwnerKey => DocumentOwnerKeyFor(Client, ContractStartDate);

    public static string DocumentOwnerKeyFor(string? client, DateOnly start)
    {
        var trimmed = (client ?? string.Empty).Trim();
        return trimmed.Length == 0 ? string.Empty : $"{trimmed}|{start:yyyy-MM-dd}";
    }

    public static VendorPortfolio Create(
        string vendorId,
        string client,
        string scopeOfWork,
        decimal totalValue,
        DateOnly contractStartDate,
        DateOnly contractEndDate,
        string enteredByParty = VendorPortfolioParties.Vendor)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(client);
        if (!VendorPortfolioParties.IsKnown(enteredByParty))
        {
            throw new ArgumentOutOfRangeException(nameof(enteredByParty), enteredByParty, "EnteredByParty must be Vendor or Officer.");
        }

        return new VendorPortfolio(
            vendorId,
            client.Trim(),
            scopeOfWork?.Trim() ?? string.Empty,
            totalValue,
            contractStartDate,
            contractEndDate,
            VendorPortfolioParties.Normalize(enteredByParty));
    }

    public void Update(string client, string scopeOfWork, decimal totalValue, DateOnly contractStartDate, DateOnly contractEndDate)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(client);
        Client = client.Trim();
        ScopeOfWork = scopeOfWork?.Trim() ?? string.Empty;
        TotalValue = totalValue;
        ContractStartDate = contractStartDate;
        ContractEndDate = contractEndDate;
    }
}

/// <summary>A special requirement a vendor satisfies. Mirrors VENDOR_SPECIAL_REQUIREMENT_T (Guid PK Id; unique per (VendorId, SpecialReqCode)).</summary>
public sealed class VendorSpecialRequirement : AuditableEntity
{
    private VendorSpecialRequirement() { }

    private VendorSpecialRequirement(string vendorId, string specialReqCode, string? number, string? description, DateOnly? expireDate)
        : base(Guid.NewGuid())
    {
        VendorId = vendorId;
        SpecialReqCode = specialReqCode;
        Number = number;
        Description = description;
        ExpireDate = expireDate;
    }

    public string VendorId { get; private set; } = string.Empty;
    public string SpecialReqCode { get; private set; } = string.Empty;
    public string? Number { get; private set; }
    public string? Description { get; private set; }
    public DateOnly? ExpireDate { get; private set; }

    public static VendorSpecialRequirement Create(string vendorId, string specialReqCode, string? number, string? description, DateOnly? expireDate)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(specialReqCode);
        return new VendorSpecialRequirement(vendorId, specialReqCode.Trim(),
            string.IsNullOrWhiteSpace(number) ? null : number.Trim(),
            string.IsNullOrWhiteSpace(description) ? null : description.Trim(), expireDate);
    }
}

/// <summary>A sub-classification (commodity) a vendor is registered under. Mirrors VENDOR_SUBCLASSIFICATION_T (Guid PK Id; unique per (VendorId, SubClassificationCode)).</summary>
public sealed class VendorSubClassification : AuditableEntity
{
    private VendorSubClassification() { }

    private VendorSubClassification(string vendorId, string subClassificationCode)
        : base(Guid.NewGuid())
    {
        VendorId = vendorId;
        SubClassificationCode = subClassificationCode;
    }

    public string VendorId { get; private set; } = string.Empty;
    public string SubClassificationCode { get; private set; } = string.Empty;

    public static VendorSubClassification Create(string vendorId, string subClassificationCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(subClassificationCode);
        return new VendorSubClassification(vendorId, subClassificationCode.Trim());
    }
}
