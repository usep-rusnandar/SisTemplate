using System.IO.Compression;
using System.Security;
using System.Text;
using System.Text.RegularExpressions;
using SisTemplate.Platform.Documents.Application;
using Microsoft.Extensions.Options;

namespace SisTemplate.Platform.Documents.Infrastructure;

/// <summary>
/// Dependency-free .docx template merge. A .docx is a ZIP of OOXML parts; this copies the package and,
/// for the text-bearing parts (document/headers/footers), replaces <c>{{TOKEN}}</c> with the (XML-escaped)
/// value. Because the tokens are authored as single unsplit runs, a literal string replace is safe.
/// </summary>
public sealed partial class DocxTemplateMerger : IContractTemplateMerger
{
    private readonly ContractTemplateOptions _options;

    public DocxTemplateMerger(IOptions<ContractTemplateOptions> options)
    {
        _options = options.Value;
    }

    public bool TemplateExists(string templateKey) => File.Exists(ResolvePath(templateKey));

    public IReadOnlyList<string> ListTemplateKeys()
    {
        if (string.IsNullOrWhiteSpace(_options.RootPath) || !Directory.Exists(_options.RootPath))
        {
            return Array.Empty<string>();
        }

        return Directory.GetFiles(_options.RootPath, "*.docx")
            .Select(Path.GetFileNameWithoutExtension)
            .Where(name => !string.IsNullOrEmpty(name))
            .Select(name => name!)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();
    }

    public async Task<IReadOnlyList<string>> TokensInTemplateAsync(string templateKey, CancellationToken cancellationToken)
    {
        var found = new HashSet<string>(StringComparer.Ordinal);
        await using var stream = File.OpenRead(ResolvePath(templateKey));
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        foreach (var entry in archive.Entries.Where(e => IsTextPart(e.FullName)))
        {
            using var reader = new StreamReader(entry.Open());
            var content = await reader.ReadToEndAsync(cancellationToken);
            foreach (Match m in TokenRegex().Matches(content))
            {
                found.Add(m.Groups[1].Value);
            }
        }

        return found.OrderBy(x => x, StringComparer.Ordinal).ToArray();
    }

    public async Task<byte[]> MergeAsync(string templateKey, IReadOnlyDictionary<string, string> tokens, CancellationToken cancellationToken)
    {
        var path = ResolvePath(templateKey);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Contract template '{templateKey}' not found.", path);
        }

        var sourceBytes = await File.ReadAllBytesAsync(path, cancellationToken);
        using var output = new MemoryStream();
        using (var source = new ZipArchive(new MemoryStream(sourceBytes), ZipArchiveMode.Read))
        using (var dest = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var entry in source.Entries)
            {
                var destEntry = dest.CreateEntry(entry.FullName, CompressionLevel.Optimal);
                await using var entryStream = entry.Open();
                await using var destStream = destEntry.Open();
                if (IsTextPart(entry.FullName))
                {
                    using var reader = new StreamReader(entryStream);
                    var content = ReplaceTokens(await reader.ReadToEndAsync(cancellationToken), tokens);
                    var bytes = new UTF8Encoding(false).GetBytes(content);
                    await destStream.WriteAsync(bytes, cancellationToken);
                }
                else
                {
                    await entryStream.CopyToAsync(destStream, cancellationToken);
                }
            }
        }

        return output.ToArray();
    }

    private static string ReplaceTokens(string content, IReadOnlyDictionary<string, string> tokens)
    {
        foreach (var (key, value) in tokens)
        {
            content = content.Replace("{{" + key + "}}", SecurityElement.Escape(value ?? string.Empty), StringComparison.Ordinal);
        }

        return content;
    }

    private string ResolvePath(string templateKey) =>
        Path.Combine(_options.RootPath, templateKey + ".docx");

    // Only the parts that carry visible text — body plus any headers/footers.
    private static bool IsTextPart(string name) =>
        name.Equals("word/document.xml", StringComparison.OrdinalIgnoreCase)
        || (name.StartsWith("word/header", StringComparison.OrdinalIgnoreCase) && name.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
        || (name.StartsWith("word/footer", StringComparison.OrdinalIgnoreCase) && name.EndsWith(".xml", StringComparison.OrdinalIgnoreCase));

    [GeneratedRegex(@"\{\{([A-Z0-9_]+)\}\}")]
    private static partial Regex TokenRegex();
}
