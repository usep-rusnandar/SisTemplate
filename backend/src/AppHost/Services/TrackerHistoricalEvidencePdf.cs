using System.Globalization;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace IntegratedProcurement.AppHost.Api.Services;

public sealed record TrackerEvidencePart(
    string StageTitle,
    string VendorName,
    string FileName,
    byte[]? Content,
    string? ContentType,
    string? Note);

/// <summary>
/// Builds a single historical-evidence PDF: cover (proposal + step trail + TOC) then each
/// Tracker document as subsequent pages. Existing PDFs are merged; images become a page;
/// other types get a placeholder page so the bundle still lists every file.
/// </summary>
public static class TrackerHistoricalEvidencePdf
{
    private static readonly string Ocean = "#0F828A";
    private static readonly string Ink = "#013B52";

    static TrackerHistoricalEvidencePdf()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public static byte[] Build(
        TrackerProposal proposal,
        IReadOnlyList<TrackerProposalActivity> activities,
        IReadOnlyList<TrackerEvidencePart> parts)
    {
        var cover = BuildCover(proposal, activities, parts);
        return Merge(cover, parts);
    }

    public static byte[] BuildCover(
        TrackerProposal proposal,
        IReadOnlyList<TrackerProposalActivity> activities,
        IReadOnlyList<TrackerEvidencePart> parts)
    {
        var generated = JakartaTime.Now().ToString("dd MMM yyyy HH:mm 'WIB'", System.Globalization.CultureInfo.InvariantCulture);
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.DefaultTextStyle(t => t.FontSize(10).FontColor(Ink));
                page.Header().Column(header =>
                {
                    header.Item().Text("ALAMTRI GEO — PROPOSAL TRACKER").FontSize(10).Bold().FontColor(Ocean).LetterSpacing(0.12f);
                    header.Item().PaddingTop(4).Text("Historical Evidence").FontSize(20).Bold();
                    header.Item().PaddingTop(2).Text($"Compiled {generated}").FontSize(9).FontColor(Colors.Grey.Darken1);
                    header.Item().PaddingTop(8).LineHorizontal(2).LineColor(Ocean);
                });
                page.Content().PaddingTop(14).Column(col =>
                {
                    col.Item().Text("Proposal").FontSize(12).Bold().FontColor(Ocean);
                    col.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(140);
                            c.RelativeColumn();
                        });
                        Row(table, "Proposal No", proposal.ProposalNumber);
                        Row(table, "Title", proposal.Title);
                        Row(table, "Method", proposal.TrackerMethod ?? "—");
                        Row(table, "Jobsite", proposal.Jobsite ?? "—");
                        Row(table, "Owner", proposal.OwnerName ?? "—");
                        Row(table, "Officer", proposal.AssignedOfficerName ?? "—");
                        Row(table, "Status", proposal.LifecycleStatus);
                        Row(table, "Requirement date", proposal.RequirementDate?.ToString("dd MMM yyyy", CultureInfo.InvariantCulture) ?? "—");
                    });

                    if (activities.Count > 0)
                    {
                        col.Item().PaddingTop(16).Text("Tracker steps").FontSize(12).Bold().FontColor(Ocean);
                        col.Item().PaddingTop(6).Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.ConstantColumn(28);
                                c.RelativeColumn(2.4f);
                                c.RelativeColumn(1.1f);
                                c.RelativeColumn(1.1f);
                                c.RelativeColumn(1.1f);
                            });
                            Header(table, "#", "Step", "Status", "Plan", "Actual");
                            var i = 1;
                            foreach (var activity in activities)
                            {
                                table.Cell().Element(Cell).Text(i.ToString("00", CultureInfo.InvariantCulture));
                                table.Cell().Element(Cell).Text(activity.Title);
                                table.Cell().Element(Cell).Text(activity.Status);
                                table.Cell().Element(Cell).Text(activity.TargetDate?.ToString("dd MMM yyyy", CultureInfo.InvariantCulture) ?? "—");
                                table.Cell().Element(Cell).Text(activity.CompletedAt is { } done
                                    ? JakartaTime.DateOf(done).ToString("dd MMM yyyy", CultureInfo.InvariantCulture)
                                    : "—");
                                i++;
                            }
                        });
                    }

                    col.Item().PaddingTop(16).Text("Documents in this bundle").FontSize(12).Bold().FontColor(Ocean);
                    if (parts.Count == 0)
                    {
                        col.Item().PaddingTop(6).Text("No uploaded Tracker documents were attached. This cover records the proposal and step trail.").FontColor(Colors.Grey.Darken1);
                    }
                    else
                    {
                        col.Item().PaddingTop(6).Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.ConstantColumn(28);
                                c.RelativeColumn(1.6f);
                                c.RelativeColumn(1.4f);
                                c.RelativeColumn(2.2f);
                            });
                            Header(table, "#", "Step", "Vendor", "File");
                            var i = 1;
                            foreach (var part in parts)
                            {
                                table.Cell().Element(Cell).Text(i.ToString("00", CultureInfo.InvariantCulture));
                                table.Cell().Element(Cell).Text(string.IsNullOrWhiteSpace(part.StageTitle) ? "—" : part.StageTitle);
                                table.Cell().Element(Cell).Text(string.IsNullOrWhiteSpace(part.VendorName) ? "—" : part.VendorName);
                                table.Cell().Element(Cell).Text(part.FileName);
                                i++;
                            }
                        });
                    }
                });
                page.Footer().AlignCenter().Text("Internal use — compiled from Proposal Tracker documents (step 1 through last).")
                    .FontSize(8).FontColor(Colors.Grey.Darken1);
            });
        }).GeneratePdf();
    }

    private static byte[] Merge(byte[] coverPdf, IReadOnlyList<TrackerEvidencePart> parts)
    {
        var work = Path.Combine(Path.GetTempPath(), "ip-trk-evidence", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(work);
        try
        {
            var files = new List<string>();
            var coverPath = Path.Combine(work, "00-cover.pdf");
            File.WriteAllBytes(coverPath, coverPdf);
            files.Add(coverPath);

            var index = 1;
            foreach (var part in parts)
            {
                var pdf = ToPdfPage(part);
                var path = Path.Combine(work, $"{index.ToString("00", CultureInfo.InvariantCulture)}-{SafeFileName(part.FileName)}.pdf");
                File.WriteAllBytes(path, pdf);
                files.Add(path);
                index++;
            }

            if (files.Count == 1)
            {
                return coverPdf;
            }

            var output = Path.Combine(work, "bundle.pdf");
            var operation = DocumentOperation.LoadFile(files[0]);
            foreach (var file in files.Skip(1))
            {
                operation = operation.MergeFile(file);
            }

            operation.Save(output);
            return File.ReadAllBytes(output);
        }
        finally
        {
            try { Directory.Delete(work, recursive: true); } catch { /* temp cleanup */ }
        }
    }

    private static byte[] ToPdfPage(TrackerEvidencePart part)
    {
        var content = part.Content;
        if (content is { Length: > 5 } && IsPdf(content))
        {
            return content;
        }

        if (content is { Length: > 0 } && IsImage(part.ContentType, content))
        {
            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(28);
                    page.Header().Text($"{part.StageTitle}  ·  {part.FileName}").FontSize(10).Bold().FontColor(Ocean);
                    page.Content().PaddingTop(10).Image(content).FitArea();
                });
            }).GeneratePdf();
        }

        var reason = string.IsNullOrWhiteSpace(part.Note)
            ? (content is null || content.Length == 0
                ? "File was listed but the bytes were not available to embed."
                : "This file type cannot be embedded; open the original from Proposal Tracker.")
            : part.Note;
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(t => t.FontSize(11).FontColor(Ink));
                page.Content().AlignMiddle().Column(col =>
                {
                    col.Item().Text(part.StageTitle).FontSize(12).FontColor(Ocean).Bold();
                    col.Item().PaddingTop(6).Text(part.FileName).FontSize(16).Bold();
                    if (!string.IsNullOrWhiteSpace(part.VendorName))
                    {
                        col.Item().PaddingTop(4).Text(part.VendorName).FontSize(11);
                    }

                    col.Item().PaddingTop(16).Background("#F2F8F8").Padding(12).Text(reason).FontSize(10);
                });
            });
        }).GeneratePdf();
    }

    private static bool IsPdf(byte[] bytes) =>
        bytes.Length >= 4 && bytes[0] == (byte)'%' && bytes[1] == (byte)'P' && bytes[2] == (byte)'D' && bytes[3] == (byte)'F';

    private static bool IsImage(string? contentType, byte[] bytes)
    {
        if (!string.IsNullOrWhiteSpace(contentType) && contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return true;
        if (bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;
        return false;
    }

    private static string SafeFileName(string? fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName ?? "document");
        var cleaned = new string((name.Length == 0 ? "document" : name)
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
            .Take(40)
            .ToArray());
        return string.IsNullOrWhiteSpace(cleaned) ? "document" : cleaned;
    }

    private static void Row(TableDescriptor table, string label, string value)
    {
        table.Cell().Element(Cell).Text(label).FontColor(Colors.Grey.Darken1);
        table.Cell().Element(Cell).Text(string.IsNullOrWhiteSpace(value) ? "—" : value).SemiBold();
    }

    private static void Header(TableDescriptor table, params string[] labels)
    {
        foreach (var label in labels)
        {
            table.Cell().Element(HeaderCell).Text(label).FontSize(8).Bold();
        }
    }

    private static IContainer Cell(IContainer container) =>
        container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(4).PaddingRight(6);

    private static IContainer HeaderCell(IContainer container) =>
        container.Background("#F2F8F8").PaddingVertical(5).PaddingRight(6);
}
