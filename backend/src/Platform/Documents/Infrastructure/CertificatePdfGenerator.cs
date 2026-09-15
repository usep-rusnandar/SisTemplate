using SisTemplate.Platform.Documents.Application;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace SisTemplate.Platform.Documents.Infrastructure;

/// <summary>
/// QuestPDF + QRCoder implementation of <see cref="ICertificateGenerator"/>. Produces a single-page
/// A4 certificate with an ocean-tinted header, labelled detail fields, and a QR code encoding the
/// verification URL. Pure managed — no LibreOffice/OpenXML dependency.
/// </summary>
public sealed class CertificatePdfGenerator : ICertificateGenerator
{
    private static readonly string Ocean = "#0F828A";
    private static readonly string Ink = "#013B52";

    public byte[] Generate(CertificateContent content)
    {
        var qrPng = BuildQrPng(content.QrPayload);

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(t => t.FontSize(11).FontColor(Ink));

                page.Header().Column(header =>
                {
                    header.Item().Text("ALAMTRI GEO — PROCUREMENT").FontSize(11).Bold().FontColor(Ocean).LetterSpacing(0.15f);
                    header.Item().PaddingTop(2).Text(content.Title).FontSize(24).Bold().FontColor(Ink);
                    header.Item().PaddingTop(2).Text(content.Subtitle).FontSize(11).FontColor(Colors.Grey.Darken1);
                    header.Item().PaddingTop(10).LineHorizontal(2).LineColor(Ocean);
                });

                page.Content().PaddingVertical(24).Column(col =>
                {
                    col.Item().Text("This is to certify that").FontSize(12).FontColor(Colors.Grey.Darken1);
                    col.Item().PaddingTop(4).Text(content.RecipientName).FontSize(20).Bold().FontColor(Ocean);

                    col.Item().PaddingTop(20).Row(row =>
                    {
                        row.RelativeItem().Column(fields =>
                        {
                            foreach (var f in content.Fields)
                            {
                                fields.Item().PaddingBottom(10).Column(fc =>
                                {
                                    fc.Item().Text(f.Label).FontSize(9).FontColor(Colors.Grey.Darken1).LetterSpacing(0.06f);
                                    fc.Item().Text(string.IsNullOrWhiteSpace(f.Value) ? "—" : f.Value).FontSize(12).SemiBold();
                                });
                            }
                        });

                        row.ConstantItem(150).Column(qr =>
                        {
                            qr.Item().AlignRight().Width(130).Height(130).Image(qrPng);
                            qr.Item().PaddingTop(6).AlignRight().Text(content.VerificationHint).FontSize(8).FontColor(Colors.Grey.Darken1);
                        });
                    });

                    col.Item().PaddingTop(20).Background("#F2F8F8").Padding(12).Column(meta =>
                    {
                        meta.Item().Text(t =>
                        {
                            t.Span("Certificate No: ").FontSize(10).FontColor(Colors.Grey.Darken1);
                            t.Span(content.CertificateNumber).FontSize(10).Bold();
                        });
                        meta.Item().PaddingTop(2).Text(t =>
                        {
                            t.Span("Issued on: ").FontSize(10).FontColor(Colors.Grey.Darken1);
                            t.Span(content.IssuedOn).FontSize(10).Bold();
                        });
                    });
                });

                page.Footer().Column(footer =>
                {
                    footer.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                    footer.Item().PaddingTop(6).Text(content.Footer).FontSize(8).FontColor(Colors.Grey.Darken1);
                });
            });
        });

        return document.GeneratePdf();
    }

    private static byte[] BuildQrPng(string payload)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload ?? string.Empty, QRCodeGenerator.ECCLevel.Q);
        var png = new PngByteQRCode(data);
        return png.GetGraphic(20);
    }
}
