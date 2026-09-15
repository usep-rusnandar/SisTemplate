namespace IntegratedProcurement.Platform.Administration.Application;

public static class BrandMasterImport
{
    public const string SetKey = "brand";
    public const string SetName = "Brand";
    public const string TableName = "MSTR_BRAND_T";
    public const string Owner = "Vendor";
    public const int NameMaxLength = 50;
    public const int MaxDataRows = 20_000;
    public const int MaxFileBytes = 5 * 1024 * 1024;

    public static readonly MasterDataSetDefinition SetDefinition = new(SetName, TableName, Owner, false);

    private static readonly string[] HeaderAliases =
    [
        "brandname",
        "brand",
        "name",
        "namamerek",
        "merek",
        "nama",
    ];

    public static IReadOnlyList<BrandMasterImportSourceRow> ReadSourceRows(IReadOnlyList<IReadOnlyList<string>> matrix)
    {
        if (matrix.Count == 0)
        {
            return [];
        }

        var header = matrix[0];
        var column = FindBrandColumn(header);
        var startIndex = column >= 0 ? 1 : 0;
        if (column < 0)
        {
            column = 0;
        }

        var rows = new List<BrandMasterImportSourceRow>();
        for (var i = startIndex; i < matrix.Count; i++)
        {
            var line = matrix[i];
            var raw = column < line.Count ? line[column] : string.Empty;
            if (string.IsNullOrWhiteSpace(raw)
                && line.All(string.IsNullOrWhiteSpace))
            {
                continue;
            }

            rows.Add(new BrandMasterImportSourceRow(i + 1, raw ?? string.Empty));
        }

        return rows;
    }

    public static IReadOnlyList<BrandMasterImportSourceRow> ReadCsv(Stream stream)
    {
        using var reader = new StreamReader(stream, System.Text.Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);
        var lines = new List<string>();
        while (reader.ReadLine() is { } line)
        {
            lines.Add(line);
        }

        if (lines.Count == 0)
        {
            return [];
        }

        var delimiter = DetectDelimiter(lines[0]);
        var matrix = lines
            .Select(line => (IReadOnlyList<string>)SplitCsvLine(line, delimiter))
            .ToArray();
        return ReadSourceRows(matrix);
    }

    public static BrandMasterImportPlan Plan(
        IReadOnlyList<BrandMasterImportSourceRow> sourceRows,
        IReadOnlyCollection<string> existingNames)
    {
        var existing = new HashSet<string>(
            existingNames.Where(name => !string.IsNullOrWhiteSpace(name)),
            StringComparer.OrdinalIgnoreCase);
        var seenInFile = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var rows = new List<BrandMasterImportRow>(sourceRows.Count);

        foreach (var source in sourceRows)
        {
            var trimmed = (source.Raw ?? string.Empty).Trim();
            if (trimmed.Length == 0)
            {
                rows.Add(new BrandMasterImportRow(
                    source.RowNumber,
                    string.Empty,
                    BrandMasterImportOutcome.Invalid,
                    "Brand name is required."));
                continue;
            }

            if (trimmed.Length > NameMaxLength)
            {
                rows.Add(new BrandMasterImportRow(
                    source.RowNumber,
                    trimmed,
                    BrandMasterImportOutcome.Invalid,
                    $"Brand name exceeds {NameMaxLength} characters."));
                continue;
            }

            if (existing.Contains(trimmed))
            {
                rows.Add(new BrandMasterImportRow(
                    source.RowNumber,
                    trimmed,
                    BrandMasterImportOutcome.SkippedExisting,
                    "Brand already exists."));
                continue;
            }

            if (!seenInFile.Add(trimmed))
            {
                rows.Add(new BrandMasterImportRow(
                    source.RowNumber,
                    trimmed,
                    BrandMasterImportOutcome.SkippedDuplicate,
                    "Duplicate name in the file."));
                continue;
            }

            rows.Add(new BrandMasterImportRow(
                source.RowNumber,
                trimmed,
                BrandMasterImportOutcome.Created,
                null));
        }

        return new BrandMasterImportPlan(rows);
    }

    private static int FindBrandColumn(IReadOnlyList<string> header)
    {
        for (var i = 0; i < header.Count; i++)
        {
            var token = NormalizeHeader(header[i]);
            if (HeaderAliases.Contains(token, StringComparer.Ordinal))
            {
                return i;
            }
        }

        return -1;
    }

    private static string NormalizeHeader(string? value) =>
        string.Concat((value ?? string.Empty).Where(char.IsLetterOrDigit)).ToLowerInvariant();

    private static char DetectDelimiter(string headerLine)
    {
        var commas = headerLine.Count(ch => ch == ',');
        var semicolons = headerLine.Count(ch => ch == ';');
        return semicolons > commas ? ';' : ',';
    }

    private static List<string> SplitCsvLine(string line, char delimiter)
    {
        var fields = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }

                continue;
            }

            if (ch == delimiter && !inQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.Append(ch);
        }

        fields.Add(current.ToString());
        return fields;
    }
}

public sealed record BrandMasterImportSourceRow(int RowNumber, string Raw);

public enum BrandMasterImportOutcome
{
    Created,
    SkippedExisting,
    SkippedDuplicate,
    Invalid
}

public sealed record BrandMasterImportRow(
    int RowNumber,
    string Name,
    BrandMasterImportOutcome Outcome,
    string? Reason);

public sealed record BrandMasterImportPlan(IReadOnlyList<BrandMasterImportRow> Rows)
{
    public int Created => Rows.Count(row => row.Outcome == BrandMasterImportOutcome.Created);

    public int SkippedExisting => Rows.Count(row => row.Outcome == BrandMasterImportOutcome.SkippedExisting);

    public int SkippedDuplicate => Rows.Count(row => row.Outcome == BrandMasterImportOutcome.SkippedDuplicate);

    public int Invalid => Rows.Count(row => row.Outcome == BrandMasterImportOutcome.Invalid);

    public BrandMasterImportResult ToResult(bool committed) => new(
        committed,
        Rows.Count,
        Created,
        SkippedExisting,
        SkippedDuplicate,
        Invalid,
        Rows.Select(row => new BrandMasterImportRowResult(
            row.RowNumber,
            row.Name,
            ToApiOutcome(row.Outcome),
            row.Reason)).ToArray());

    public IReadOnlyList<MasterDataRecordInput> RecordsToCreate() =>
        Rows.Where(row => row.Outcome == BrandMasterImportOutcome.Created)
            .Select(row => new MasterDataRecordInput(row.Name, row.Name, "Active", string.Empty, null))
            .ToArray();

    private static string ToApiOutcome(BrandMasterImportOutcome outcome) => outcome switch
    {
        BrandMasterImportOutcome.Created => "created",
        BrandMasterImportOutcome.SkippedExisting => "skippedExisting",
        BrandMasterImportOutcome.SkippedDuplicate => "skippedDuplicate",
        _ => "invalid",
    };
}

public sealed record BrandMasterImportResult(
    bool Committed,
    int TotalRows,
    int Created,
    int SkippedExisting,
    int SkippedDuplicate,
    int Invalid,
    IReadOnlyList<BrandMasterImportRowResult> Rows);

public sealed record BrandMasterImportRowResult(
    int RowNumber,
    string Name,
    string Outcome,
    string? Reason);

public interface IBrandMasterImportService
{
    byte[] CreateTemplate();

    Task<BrandMasterImportResult> ImportAsync(
        Stream stream,
        string fileName,
        bool commit,
        CancellationToken cancellationToken);
}
