using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// Vendor company profile. Mirrors the legacy VendorConnect VENDOR_T (minus the binary *File columns,
/// which now live in <see cref="VendorDocument"/> on Blob). Region fields are master-data codes.
/// Lifecycle is driven by status codes (see <see cref="VendorStatuses"/>) with a
/// <see cref="VendorStatusHistory"/> audit trail.
/// </summary>
public sealed class Vendor : SoftDeleteEntity<string>
{
    private readonly List<VendorStatusHistory> _statusHistory = new();

    private Vendor()
    {
    }

    private Vendor(string id, string name, string status)
        : base(id)
    {
        Name = name;
        Status = status;
    }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Current lifecycle status code (master-data set "vendor-status").</summary>
    public string Status { get; private set; } = VendorStatuses.Draft;

    // Contact
    public string? Position { get; private set; }
    public string? OfficePhoneCountry { get; private set; }
    public string? OfficePhoneArea { get; private set; }
    public string? OfficePhoneNumber { get; private set; }
    public string? HandphoneCountry { get; private set; }
    public string? HandphoneNumber { get; private set; }
    public string? WebAddress { get; private set; }

    // Office location (region fields hold master-data codes)
    public string? OfficeAddress { get; private set; }
    public string? OfficeAddressCode { get; private set; }
    public string? OfficeProvinceCode { get; private set; }
    public string? OfficeCityCode { get; private set; }
    public string? OfficeDistrictCode { get; private set; }
    public string? OfficeVillageCode { get; private set; }
    public string? OfficePostCode { get; private set; }
    public string? OfficeCountry { get; private set; }
    public decimal? OfficeLatitude { get; private set; }
    public decimal? OfficeLongitude { get; private set; }

    // Warehouse location
    public string? WarehouseAddress { get; private set; }
    public string? WarehouseAddressCode { get; private set; }
    public string? WarehouseProvinceCode { get; private set; }
    public string? WarehouseCityCode { get; private set; }
    public string? WarehouseDistrictCode { get; private set; }
    public string? WarehouseVillageCode { get; private set; }
    public string? WarehousePostCode { get; private set; }
    public string? WarehouseCountry { get; private set; }
    public decimal? WarehouseLatitude { get; private set; }
    public decimal? WarehouseLongitude { get; private set; }

    // Workshop location
    public string? WorkshopAddress { get; private set; }
    public string? WorkshopAddressCode { get; private set; }
    public string? WorkshopProvinceCode { get; private set; }
    public string? WorkshopCityCode { get; private set; }
    public string? WorkshopDistrictCode { get; private set; }
    public string? WorkshopVillageCode { get; private set; }
    public string? WorkshopPostCode { get; private set; }
    public string? WorkshopCountry { get; private set; }
    public decimal? WorkshopLatitude { get; private set; }
    public decimal? WorkshopLongitude { get; private set; }

    // Legal & tax
    public string? NpwpNo { get; private set; }
    public string? NibNo { get; private set; }
    public string? AktaPendirianNo { get; private set; }
    public DateOnly? AktaPendirianDate { get; private set; }
    public string? AktaPerubahanNo { get; private set; }
    public DateOnly? AktaPerubahanDate { get; private set; }
    public string? AktaPenyesuaianNo { get; private set; }
    public DateOnly? AktaPenyesuaianDate { get; private set; }
    public string? SppkpNo { get; private set; }

    // Declarations
    public bool IsBiodataTrue { get; private set; }
    public bool IsAgreeSubmit { get; private set; }

    public IReadOnlyCollection<VendorStatusHistory> StatusHistory => _statusHistory.AsReadOnly();

    public static Vendor Register(string name, string? initialStatus = null, string? actor = null, string? statusReason = null, DateTimeOffset? statusOccurredAt = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        var status = string.IsNullOrWhiteSpace(initialStatus) ? VendorStatuses.Draft : initialStatus;
        var vendor = new Vendor(NewVendorId(), name.Trim(), status);
        vendor._statusHistory.Add(VendorStatusHistory.Record(vendor.Id, status, actor, statusReason ?? "Vendor registered.", statusOccurredAt));
        return vendor;
    }

    /// <summary>Officer-created vendor at invitation send time. First status is Invited (INVTD).</summary>
    public static Vendor Invite(string name, string? actor = null, string? reason = null)
    {
        return Register(
            name,
            VendorStatuses.Invited,
            actor,
            reason ?? "Officer invited vendor to register.");
    }

    /// <summary>Rehydrates a vendor that already owns a stable 10-character id.</summary>
    public static Vendor ImportLegacy(string id, string name, string status)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(status);
        var vendorId = id.Trim().ToUpperInvariant();
        if (vendorId.Length > 10)
        {
            throw new ArgumentOutOfRangeException(nameof(id), "Vendor ids are at most 10 characters.");
        }

        return new Vendor(vendorId, name.Trim(), status.Trim());
    }

    public void AddImportedStatus(string statusCode, string? actor, string? reason, DateTimeOffset occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(statusCode);
        _statusHistory.Add(VendorStatusHistory.Record(Id, statusCode.Trim(), actor, reason, occurredAt));
    }

    /// <summary>Stable 10-character uppercase hex id (e.g. "00E6CD3686").</summary>
    public static string NewVendorId() => Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();

    /// <summary>Vendor legal name is editable while registering (legacy Bio Data step).</summary>
    public void Rename(string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name.Trim();
    }

    /// <summary>Transition to a new status code and append an audit entry.</summary>
    public void SetStatus(string statusCode, string? changedBy, string? reason)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(statusCode);
        Status = statusCode.Trim();
        _statusHistory.Add(VendorStatusHistory.Record(Id, Status, changedBy, reason));
    }

    /// <summary>Final step: an approved vendor is registered (RGSTD) once its e-certificate is issued.</summary>
    public void MarkRegistered(string? actor)
    {
        if (Status != VendorStatuses.Approved)
        {
            throw new VendorWorkflowException($"Vendor must be approved before registration (status '{Status}').");
        }

        SetStatus(VendorStatuses.Registered, actor, "Registered — e-certificate issued.");
    }

    /// <summary>Blacklist an approved/registered vendor.</summary>
    public void Blacklist(string? reviewer, string? reason)
    {
        if (!VendorStatuses.IsBlacklistableFrom(Status))
        {
            throw new VendorWorkflowException($"Vendor cannot be blacklisted from status '{Status}'.");
        }

        SetStatus(VendorStatuses.Blacklisted, reviewer, string.IsNullOrWhiteSpace(reason) ? "Blacklisted." : reason);
    }

    /// <summary>Lift a blacklist; the vendor returns to an editable draft state.</summary>
    public void Unblacklist(string? reviewer, string? reason)
    {
        if (Status != VendorStatuses.Blacklisted)
        {
            throw new VendorWorkflowException($"Vendor is not blacklisted (status '{Status}').");
        }

        SetStatus(VendorStatuses.Draft, reviewer, string.IsNullOrWhiteSpace(reason) ? "Unblacklisted." : reason);
    }

    public void UpdateContact(string? position, string? officePhoneCountry, string? officePhoneArea, string? officePhoneNumber,
        string? handphoneCountry, string? handphoneNumber, string? webAddress)
    {
        Position = Clean(position);
        OfficePhoneCountry = Clean(officePhoneCountry);
        OfficePhoneArea = Clean(officePhoneArea);
        OfficePhoneNumber = Clean(officePhoneNumber);
        HandphoneCountry = Clean(handphoneCountry);
        HandphoneNumber = Clean(handphoneNumber);
        WebAddress = Clean(webAddress);
    }

    /// <summary>
    /// Copies the workspace PIC's job title and mobile onto the vendor company row so Vendor Database
    /// Person in Charge / Position / Mobile Phone stay aligned with Vendor Contacts.
    /// Office phone and web address are left untouched.
    /// </summary>
    public void ApplyWorkspacePicContact(string? position, string? mobilePhone)
    {
        Position = Clean(position);
        var mobile = Clean(mobilePhone);
        HandphoneNumber = mobile is { Length: > 20 } ? mobile[..20] : mobile;
        HandphoneCountry = null;
    }

    public void SetOfficeAddress(VendorAddress a)
    {
        OfficeAddress = a.Address; OfficeAddressCode = a.AddressCode; OfficeProvinceCode = a.ProvinceCode;
        OfficeCityCode = a.CityCode; OfficeDistrictCode = a.DistrictCode; OfficeVillageCode = a.VillageCode;
        OfficePostCode = a.PostCode; OfficeCountry = a.Country; OfficeLatitude = a.Latitude; OfficeLongitude = a.Longitude;
    }

    public void SetWarehouseAddress(VendorAddress a)
    {
        WarehouseAddress = a.Address; WarehouseAddressCode = a.AddressCode; WarehouseProvinceCode = a.ProvinceCode;
        WarehouseCityCode = a.CityCode; WarehouseDistrictCode = a.DistrictCode; WarehouseVillageCode = a.VillageCode;
        WarehousePostCode = a.PostCode; WarehouseCountry = a.Country; WarehouseLatitude = a.Latitude; WarehouseLongitude = a.Longitude;
    }

    public void SetWorkshopAddress(VendorAddress a)
    {
        WorkshopAddress = a.Address; WorkshopAddressCode = a.AddressCode; WorkshopProvinceCode = a.ProvinceCode;
        WorkshopCityCode = a.CityCode; WorkshopDistrictCode = a.DistrictCode; WorkshopVillageCode = a.VillageCode;
        WorkshopPostCode = a.PostCode; WorkshopCountry = a.Country; WorkshopLatitude = a.Latitude; WorkshopLongitude = a.Longitude;
    }

    public void UpdateLegal(string? npwpNo, string? nibNo,
        string? aktaPendirianNo, DateOnly? aktaPendirianDate,
        string? aktaPerubahanNo, DateOnly? aktaPerubahanDate,
        string? aktaPenyesuaianNo, DateOnly? aktaPenyesuaianDate,
        string? sppkpNo)
    {
        NpwpNo = Clean(npwpNo);
        NibNo = Clean(nibNo);
        AktaPendirianNo = Clean(aktaPendirianNo);
        AktaPendirianDate = aktaPendirianDate;
        AktaPerubahanNo = Clean(aktaPerubahanNo);
        AktaPerubahanDate = aktaPerubahanDate;
        AktaPenyesuaianNo = Clean(aktaPenyesuaianNo);
        AktaPenyesuaianDate = aktaPenyesuaianDate;
        SppkpNo = Clean(sppkpNo);
    }

    public void SetConsent(bool isBiodataTrue, bool isAgreeSubmit)
    {
        IsBiodataTrue = isBiodataTrue;
        IsAgreeSubmit = isAgreeSubmit;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
