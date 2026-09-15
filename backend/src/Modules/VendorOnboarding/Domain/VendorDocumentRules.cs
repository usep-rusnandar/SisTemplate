namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>What may be uploaded into one document slot.</summary>
/// <param name="Extensions">Allowed file extensions, lowercase, leading dot.</param>
public sealed record VendorDocumentRule(
    string DocumentType,
    IReadOnlyList<string> Extensions,
    long MaxBytes);

/// <summary>
/// Server-side source of truth for vendor document uploads. The vendor portal renders its hints and
/// pre-checks from these same rules (served by <c>GET /vendor-portal/documents/rules</c>), so the two
/// cannot drift — but the check here is the one that actually protects the store, since a client can
/// always be bypassed.
/// </summary>
public static class VendorDocumentRules
{
    private const long Kb = 1024;
    private const long Mb = 1024 * Kb;

    private static readonly string[] Images = [".jpg", ".jpeg", ".png"];
    private static readonly string[] ImagesAndPdf = [".jpg", ".jpeg", ".png", ".pdf"];
    private static readonly string[] PdfOnly = [".pdf"];

    public static IReadOnlyList<VendorDocumentRule> All { get; } =
    [
        new("pakta-integritas", PdfOnly, 5 * Mb),
        new("company-profile", PdfOnly, 5 * Mb),
        // Rendered inline next to the vendor's name — cap at 500KB.
        new("logo", [".jpg", ".jpeg", ".png", ".gif"], 500 * Kb),
        new("org-structure", ImagesAndPdf, 5 * Mb),
        new("npwp", ImagesAndPdf, 5 * Mb),
        new("nib", ImagesAndPdf, 5 * Mb),
        // Deeds run to many pages.
        new("akta-pendirian", ImagesAndPdf, 10 * Mb),
        new("akta-perubahan", ImagesAndPdf, 10 * Mb),
        new("akta-penyesuaian", ImagesAndPdf, 10 * Mb),
        new("sppkp", ImagesAndPdf, 5 * Mb),
        new("brand", ImagesAndPdf, 5 * Mb),
        new("kbli", ImagesAndPdf, 5 * Mb),
        new("sertifikat", ImagesAndPdf, 5 * Mb),
        new("portfolio", ImagesAndPdf, 5 * Mb),
        new("special-requirement", ImagesAndPdf, 5 * Mb),
    ];

    private static readonly Dictionary<string, VendorDocumentRule> ByType =
        All.ToDictionary(rule => rule.DocumentType, StringComparer.OrdinalIgnoreCase);

    public static VendorDocumentRule? For(string? documentType) =>
        documentType is not null && ByType.TryGetValue(documentType.Trim(), out var rule) ? rule : null;

    /// <summary>
    /// Null when the upload is acceptable, otherwise a rejection reason and its code. An unknown
    /// document type is refused: every slot the product has is listed above, so anything else is a
    /// caller that has gone off the map.
    /// </summary>
    public static (string Code, string Message)? Validate(string? documentType, string? fileName, long sizeInBytes)
    {
        var rule = For(documentType);
        if (rule is null)
        {
            return ("doc_type_unknown", $"'{documentType}' is not a vendor document type.");
        }

        var name = (fileName ?? string.Empty).Trim();
        if (name.Length == 0)
        {
            return ("file_name_required", "The file has no name.");
        }

        if (!rule.Extensions.Any(extension => name.EndsWith(extension, StringComparison.OrdinalIgnoreCase)))
        {
            return ("file_extension_not_allowed",
                $"{rule.DocumentType} accepts {string.Join(", ", rule.Extensions)}.");
        }

        if (sizeInBytes > rule.MaxBytes)
        {
            return ("file_too_large",
                $"{rule.DocumentType} accepts at most {Describe(rule.MaxBytes)}.");
        }

        return null;
    }

    public static string Describe(long bytes) =>
        bytes < Mb ? $"{bytes / Kb}KB" : $"{bytes / Mb}MB";
}
