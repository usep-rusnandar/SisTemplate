using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

/// <summary>
/// Minimal .xlsx reader (first worksheet only) — enough for the List-of-Material template.
/// Avoids a new NuGet dependency; Shared Strings + inline strings + numbers are supported.
/// </summary>
internal static class XlsxFirstSheetReader
{
    public static IReadOnlyList<IReadOnlyList<string>> ReadRows(Stream xlsxStream)
    {
        using var archive = new ZipArchive(xlsxStream, ZipArchiveMode.Read, leaveOpen: true);
        var shared = ReadSharedStrings(archive);
        var sheetEntry = archive.GetEntry("xl/worksheets/sheet1.xml")
            ?? archive.Entries.FirstOrDefault(e =>
                e.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase)
                && e.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("The workbook has no worksheets.");

        using var sheetStream = sheetEntry.Open();
        return ReadSheet(sheetStream, shared);
    }

    private static IReadOnlyList<string> ReadSharedStrings(ZipArchive archive)
    {
        var entry = archive.GetEntry("xl/sharedStrings.xml");
        if (entry is null)
        {
            return Array.Empty<string>();
        }

        using var stream = entry.Open();
        using var reader = XmlReader.Create(stream, new XmlReaderSettings { IgnoreComments = true, IgnoreWhitespace = true });
        var list = new List<string>();
        while (reader.Read())
        {
            if (reader.NodeType == XmlNodeType.Element && reader.LocalName == "si")
            {
                list.Add(ReadSharedStringItem(reader));
            }
        }

        return list;
    }

    private static string ReadSharedStringItem(XmlReader reader)
    {
        var builder = new StringBuilder();
        // ReadSubtree keeps the outer reader on this <si> so the next sibling is not skipped
        // after ReadElementContentAsString advances past </t>.
        using var subtree = reader.ReadSubtree();
        while (subtree.Read())
        {
            if (subtree.NodeType == XmlNodeType.Element && subtree.LocalName == "t")
            {
                builder.Append(subtree.ReadElementContentAsString());
            }
        }

        return builder.ToString();
    }

    private static List<IReadOnlyList<string>> ReadSheet(Stream sheetStream, IReadOnlyList<string> shared)
    {
        using var reader = XmlReader.Create(sheetStream, new XmlReaderSettings { IgnoreComments = true, IgnoreWhitespace = true });
        var rows = new List<IReadOnlyList<string>>();
        while (reader.Read())
        {
            if (reader.NodeType != XmlNodeType.Element || reader.LocalName != "row")
            {
                continue;
            }

            var cells = new Dictionary<int, string>();
            var maxCol = -1;
            var rowDepth = reader.Depth;
            if (reader.IsEmptyElement)
            {
                rows.Add(Array.Empty<string>());
                continue;
            }

            while (reader.Read())
            {
                if (reader.NodeType == XmlNodeType.EndElement && reader.LocalName == "row" && reader.Depth == rowDepth)
                {
                    break;
                }

                if (reader.NodeType != XmlNodeType.Element || reader.LocalName != "c")
                {
                    continue;
                }

                var refAttr = reader.GetAttribute("r") ?? string.Empty;
                var type = reader.GetAttribute("t");
                var col = ColumnIndexFromRef(refAttr);
                var value = ReadCellValue(reader, type, shared);
                cells[col] = value;
                if (col > maxCol)
                {
                    maxCol = col;
                }
            }

            if (maxCol < 0)
            {
                rows.Add(Array.Empty<string>());
                continue;
            }

            var row = new string[maxCol + 1];
            for (var i = 0; i <= maxCol; i++)
            {
                row[i] = cells.TryGetValue(i, out var cell) ? cell : string.Empty;
            }

            rows.Add(row);
        }

        return rows;
    }

    private static string ReadCellValue(XmlReader reader, string? type, IReadOnlyList<string> shared)
    {
        string? raw = null;
        if (reader.IsEmptyElement)
        {
            return string.Empty;
        }

        using var subtree = reader.ReadSubtree();
        while (subtree.Read())
        {
            if (subtree.NodeType == XmlNodeType.Element && subtree.LocalName is "v" or "t")
            {
                raw = subtree.ReadElementContentAsString();
            }
        }

        if (string.IsNullOrEmpty(raw))
        {
            return string.Empty;
        }

        if (string.Equals(type, "s", StringComparison.Ordinal)
            && int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var index)
            && index >= 0
            && index < shared.Count)
        {
            return shared[index];
        }

        if (string.Equals(type, "inlineStr", StringComparison.Ordinal))
        {
            return raw;
        }

        return raw;
    }

    private static int ColumnIndexFromRef(string cellRef)
    {
        var col = 0;
        foreach (var ch in cellRef)
        {
            if (ch is >= 'A' and <= 'Z')
            {
                col = (col * 26) + (ch - 'A' + 1);
                continue;
            }

            if (ch is >= 'a' and <= 'z')
            {
                col = (col * 26) + (ch - 'a' + 1);
                continue;
            }

            break;
        }

        return Math.Max(0, col - 1);
    }
}
