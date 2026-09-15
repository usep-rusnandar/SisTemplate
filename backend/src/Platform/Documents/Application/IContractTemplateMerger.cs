namespace SisTemplate.Platform.Documents.Application;

public sealed class ContractTemplateOptions
{
    public const string SectionName = "ContractTemplates";

    /// <summary>Folder holding the token-annotated contract template .docx files (one per template key).</summary>
    public string RootPath { get; set; } = string.Empty;
}

/// <summary>
/// Fills a token-annotated contract template (.docx) with case data. The templates carry
/// <c>{{TOKEN}}</c> placeholders (authored unsplit, one per run) so a literal text replace over the
/// OOXML parts is reliable; lampiran/attachment sections are already stripped from the template.
/// </summary>
public interface IContractTemplateMerger
{
    /// <summary>True when a template file exists for the given key.</summary>
    bool TemplateExists(string templateKey);

    /// <summary>All template keys available in the root folder (file basenames without extension), sorted.</summary>
    IReadOnlyList<string> ListTemplateKeys();

    /// <summary>Distinct <c>{{TOKEN}}</c> names present in the template (for diagnostics / form building).</summary>
    Task<IReadOnlyList<string>> TokensInTemplateAsync(string templateKey, CancellationToken cancellationToken);

    /// <summary>Produce the merged .docx bytes: every <c>{{KEY}}</c> replaced with its value (XML-escaped).</summary>
    Task<byte[]> MergeAsync(string templateKey, IReadOnlyDictionary<string, string> tokens, CancellationToken cancellationToken);
}
