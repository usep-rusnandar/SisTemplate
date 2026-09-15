namespace SisTemplate.Platform.Documents.Application;

public sealed class DocumentConversionOptions
{
    public const string SectionName = "DocumentConversion";

    /// <summary>"auto" (default), "libreoffice", "word", or "none".</summary>
    public string Engine { get; set; } = "auto";

    /// <summary>Explicit path to soffice(.exe). When empty, common locations and PATH are probed.</summary>
    public string? SofficePath { get; set; }

    /// <summary>Hard cap for a single conversion before the worker process is killed.</summary>
    public int TimeoutSeconds { get; set; } = 90;
}

/// <summary>
/// Converts a .docx package to PDF for in-app preview. Implementations shell out to LibreOffice
/// (headless, cross-platform) or, on Windows with Office installed, Microsoft Word — always
/// out-of-process so a stuck converter cannot hang the request pipeline.
/// </summary>
public interface IDocumentPdfConverter
{
    /// <summary>True when a conversion engine is resolvable on this host.</summary>
    bool IsAvailable { get; }

    /// <summary>Engine that will be used ("libreoffice" / "word" / "none") — for diagnostics.</summary>
    string Engine { get; }

    /// <summary>Convert .docx bytes to PDF bytes, or null when conversion is unavailable / fails.</summary>
    Task<byte[]?> ConvertDocxToPdfAsync(byte[] docx, CancellationToken cancellationToken);
}
