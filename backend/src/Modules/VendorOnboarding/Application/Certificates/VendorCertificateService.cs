using IntegratedProcurement.Modules.VendorOnboarding.Application.Documents;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Documents.Application;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Certificates;

/// <summary>
/// Issues and verifies vendor e-certificates. Issuing generates a QR-coded PDF (via
/// <see cref="ICertificateGenerator"/>), stores it on Blob, records it as a VendorDocument, and moves
/// the vendor from Approved to Registered. The e-certificate VendorDocument (DocumentType
/// "e-certificate", OwnerKey = certificate number) IS the verification record — there is no separate
/// certificate table. Verification is public.
/// </summary>
public sealed class VendorCertificateService
{
    private const string ModuleKey = "vendorOnboarding";
    private const string CertificateDocType = "e-certificate";

    private readonly IVendorRepository _vendors;
    private readonly ICertificateGenerator _generator;
    private readonly IDocumentStorage _storage;
    private readonly VendorDocumentService _documents;
    private readonly IVendorDocumentRepository _documentRepository;

    public VendorCertificateService(
        IVendorRepository vendors,
        ICertificateGenerator generator,
        IDocumentStorage storage,
        VendorDocumentService documents,
        IVendorDocumentRepository documentRepository)
    {
        _vendors = vendors;
        _generator = generator;
        _storage = storage;
        _documents = documents;
        _documentRepository = documentRepository;
    }

    public async Task<IssueCertificateResult> IssueAsync(string vendorId, string? issuedBy, string verifyBaseUrl, DateTimeOffset issuedAt, CancellationToken cancellationToken)
    {
        var vendor = await _vendors.GetAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return new IssueCertificateResult(false, false, null, null, string.Empty);
        }

        if (vendor.Status != VendorStatuses.Approved)
        {
            return new IssueCertificateResult(true, false, $"Certificate can only be issued for an approved vendor (status '{vendor.Status}').", null, vendor.Status);
        }

        if (!_storage.IsConfigured)
        {
            return new IssueCertificateResult(true, false, "Document storage is not configured.", null, vendor.Status);
        }

        var certificateNumber = $"VC/{issuedAt:yyyy}/{Guid.NewGuid():N}"[..15].ToUpperInvariant();
        var verifyUrl = $"{verifyBaseUrl}?no={Uri.EscapeDataString(certificateNumber)}";

        var content = new CertificateContent(
            Title: "Vendor Registration Certificate",
            Subtitle: "Certificate of Registration — Alamtri Geo Procurement",
            RecipientName: vendor.Name,
            CertificateNumber: certificateNumber,
            IssuedOn: issuedAt.ToString("dd MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture),
            Fields: BuildFields(vendor),
            QrPayload: verifyUrl,
            VerificationHint: "Scan to verify authenticity",
            Footer: "This certificate confirms the vendor is registered in the Alamtri Geo procurement system. Verify authenticity by scanning the QR code or entering the certificate number on the verification page.");

        var pdf = _generator.Generate(content);

        var container = _storage.ContainerForModule(ModuleKey);
        var blobKey = $"certificates/{vendorId}/{certificateNumber.Replace('/', '-')}.pdf";
        using (var stream = new MemoryStream(pdf))
        {
            await _storage.UploadAsync(container, blobKey, stream, "application/pdf", cancellationToken);
        }

        // Record the PDF as the vendor's e-certificate document — this IS the verification record
        // (OwnerKey = certificate number). Re-issuing replaces the previous slot.
        var document = await _documents.RecordAsync(
            new RecordVendorDocumentCommand(vendorId, CertificateDocType, certificateNumber, $"{certificateNumber.Replace('/', '-')}.pdf",
                "application/pdf", pdf.LongLength, container, blobKey, issuedBy),
            cancellationToken);

        vendor.MarkRegistered(issuedBy);
        await _vendors.SaveChangesAsync(cancellationToken);

        return new IssueCertificateResult(true, true, null, ToDto(document.Id, certificateNumber, document.VendorId, document.UploadedAt, document.UploadedBy, isRevoked: false, container, blobKey), vendor.Status);
    }

    public async Task<VendorCertificateDto?> GetForVendorAsync(string vendorId, CancellationToken cancellationToken)
    {
        var document = await _documentRepository.FindLatestByVendorAndTypeAsync(vendorId, CertificateDocType, cancellationToken);
        return document is null
            ? null
            : ToDto(document.Id, document.OwnerKey, document.VendorId, document.CreatedAt, document.UploadedBy, !document.IsActive, document.BlobContainer, document.BlobKey);
    }

    public async Task<CertificateVerificationDto> VerifyAsync(string certificateNumber, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(certificateNumber))
        {
            return new CertificateVerificationDto(false, null, null, null, null, "No certificate number provided.");
        }

        var document = await _documentRepository.FindByTypeAndOwnerAsync(CertificateDocType, certificateNumber.Trim(), cancellationToken);
        if (document is null)
        {
            return new CertificateVerificationDto(false, certificateNumber, null, null, null, "Certificate not found.");
        }

        var vendor = await _vendors.GetAsync(document.VendorId, cancellationToken);
        var status = vendor?.Status ?? string.Empty;
        var revoked = !document.IsActive;
        var valid = !revoked && status == VendorStatuses.Registered;
        var message = revoked ? "This certificate has been revoked."
            : status == VendorStatuses.Blacklisted ? "The vendor is blacklisted; this certificate is not valid."
            : valid ? "Valid — this vendor is registered with Alamtri Geo."
            : "This certificate is not currently valid.";

        return new CertificateVerificationDto(valid, document.OwnerKey, vendor?.Name, status, document.CreatedAt, message);
    }

    private static IReadOnlyList<CertificateField> BuildFields(Vendor v) =>
    [
        new("VENDOR NAME", v.Name),
        new("NPWP", v.NpwpNo),
        new("NIB (OSS)", v.NibNo),
        new("REGISTRATION STATUS", "Registered"),
    ];

    private static VendorCertificateDto ToDto(
        Guid documentId, string certificateNumber, string vendorId, DateTimeOffset issuedAt, string? issuedBy, bool isRevoked, string container, string blobKey) =>
        new(documentId, vendorId, certificateNumber, issuedAt, issuedBy, isRevoked, container, blobKey);
}
