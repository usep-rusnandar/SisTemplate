using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// A certification a vendor holds (formerly VENDOR_SERTIFIKAT_T; the table is now VENDOR_CERTIFICATE_T).
/// A vendor-level child record referencing the certificate by number; the scanned document lives in
/// VendorDocument on Blob, linked via OwnerKey = <see cref="CertificateNumber"/>. Unique per
/// (VendorId, CertificateNumber).
/// </summary>
public sealed class VendorCertificate : AuditableEntity
{
    private VendorCertificate() { }

    private VendorCertificate(string vendorId, string certificateNumber, string description, DateOnly? expireDate)
        : base(Guid.NewGuid())
    {
        VendorId = vendorId;
        CertificateNumber = certificateNumber;
        Description = description;
        ExpireDate = expireDate;
    }

    public string VendorId { get; private set; } = string.Empty;
    public string CertificateNumber { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DateOnly? ExpireDate { get; private set; }

    public static VendorCertificate Create(string vendorId, string certificateNumber, string? description, DateOnly? expireDate)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(certificateNumber);
        return new VendorCertificate(vendorId, certificateNumber.Trim(), description?.Trim() ?? string.Empty, expireDate);
    }
}
