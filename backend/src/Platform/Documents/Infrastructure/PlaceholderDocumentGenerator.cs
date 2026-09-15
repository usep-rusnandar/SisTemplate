using SisTemplate.Platform.Documents.Application;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace SisTemplate.Platform.Documents.Infrastructure;

public sealed class PlaceholderDocumentGenerator : IPlaceholderDocumentGenerator
{
    public byte[] Generate(string vendorName, string documentLabel, string sourceSystem, string externalVendorId)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(44);
                page.DefaultTextStyle(style => style.FontSize(11).FontColor("#013B52"));
                page.Header().Text("ALAMTRI PROCUREMENT · MIGRATION PLACEHOLDER")
                    .Bold().FontSize(11).FontColor("#0F828A");
                page.Content().AlignMiddle().Column(column =>
                {
                    column.Item().Text("Temporary document").Bold().FontSize(24);
                    column.Item().PaddingTop(12).Text(documentLabel).Bold().FontSize(16).FontColor("#0F828A");
                    column.Item().PaddingTop(24).Background("#F1F7F7").Padding(18).Column(card =>
                    {
                        card.Item().Text($"Vendor: {vendorName}");
                        card.Item().PaddingTop(6).Text($"Source: {sourceSystem}");
                        card.Item().PaddingTop(6).Text($"External Vendor ID: {externalVendorId}");
                    });
                    column.Item().PaddingTop(24).Text(
                        "This file was generated during data migration. It is not a legal document and must be replaced by the vendor before profile submission.")
                        .FontColor(Colors.Red.Darken2);
                });
                page.Footer().AlignCenter().Text($"Generated {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC")
                    .FontSize(9).FontColor(Colors.Grey.Darken1);
            });
        }).GeneratePdf();
    }
}
