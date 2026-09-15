namespace IntegratedProcurement.Platform.Documents.Application;

/// <summary>
/// Renders a one-page A4 certificate PDF (title, issuer, labelled fields, and a QR code that encodes
/// a verification URL). Generic so any module can issue certificates; content is supplied by the caller.
/// </summary>
public interface ICertificateGenerator
{
    byte[] Generate(CertificateContent content);
}

public sealed record CertificateField(string Label, string? Value);

public sealed record CertificateContent(
    string Title,
    string Subtitle,
    string RecipientName,
    string CertificateNumber,
    string IssuedOn,
    IReadOnlyList<CertificateField> Fields,
    string QrPayload,
    string VerificationHint,
    string Footer);
