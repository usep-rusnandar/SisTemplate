namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Certificates;

/// <summary>
/// A vendor's issued e-certificate. Backed by the vendor's e-certificate VendorDocument row
/// (DocumentType "e-certificate", OwnerKey = <see cref="CertificateNumber"/>); there is no separate
/// verification table. <see cref="IsRevoked"/> reflects the document being deactivated.
/// </summary>
public sealed record VendorCertificateDto(
    Guid DocumentId,
    string VendorId,
    string CertificateNumber,
    DateTimeOffset IssuedAt,
    string? IssuedBy,
    bool IsRevoked,
    string Container,
    string BlobKey);

/// <summary>Result of issuing a certificate; Ok=false with Error when the vendor isn't eligible.</summary>
public sealed record IssueCertificateResult(bool Found, bool Ok, string? Error, VendorCertificateDto? Certificate, string Status);

/// <summary>Public verification response — safe to expose anonymously (no sensitive data).</summary>
public sealed record CertificateVerificationDto(
    bool Valid,
    string? CertificateNumber,
    string? VendorName,
    string? Status,
    DateTimeOffset? IssuedAt,
    string Message);
