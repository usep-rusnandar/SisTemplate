using System.Globalization;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;

namespace IntegratedProcurement.Modules.ContractMonitoring.Application;

public sealed record MaterialRowInput(
    string ContractNo,
    string MaterialNumber,
    string Description,
    string Site,
    string Currency,
    decimal UnitPrice);

public sealed record MaterialSummaryDto(
    string ContractKey,
    int TotalCount,
    string? FileName,
    string? SourceType,
    DateTimeOffset? SourceLastModified,
    DateTimeOffset? ImportedAt);

public sealed record MaterialPageDto(
    string ContractKey,
    int Total,
    int Page,
    int PageSize,
    IReadOnlyList<MaterialItemDto> Items,
    MaterialSummaryDto Summary);

public sealed record MaterialItemDto(
    int SortOrder,
    string MaterialNumber,
    string Description,
    string Site,
    string Currency,
    decimal UnitPrice);

public sealed record MaterialUploadResult(string ContractKey, int RowCount, string FileName, DateTimeOffset ImportedAt);

public sealed record MaterialFolderSyncResult(
    int FilesSeen,
    int Imported,
    int Skipped,
    int ContractNotFound,
    int Failed,
    IReadOnlyList<MaterialFolderSyncFileResult> Files);

public sealed record MaterialFolderSyncFileResult(
    string FileName,
    string Status,
    string? ContractKey,
    int? RowCount,
    string? Message);

/// <summary>Parse / replace List-of-Material rows for a contract (manual upload + SharePoint folder sync).</summary>
public sealed class ContractMaterialService
{
    private readonly IContractRepository _contracts;
    private readonly IContractMaterialRepository _materials;

    public ContractMaterialService(IContractRepository contracts, IContractMaterialRepository materials)
    {
        _contracts = contracts;
        _materials = materials;
    }

    public async Task<MaterialSummaryDto?> GetSummaryAsync(string contractKey, CancellationToken cancellationToken)
    {
        var contract = await _contracts.GetByKeyAsync(contractKey, cancellationToken);
        if (contract is null)
        {
            return null;
        }

        var total = await _materials.CountAsync(contractKey, null, null, cancellationToken);
        var sync = await _materials.GetSyncFileByContractKeyAsync(contractKey, cancellationToken);
        return new MaterialSummaryDto(
            contractKey,
            total,
            sync?.FileName,
            sync?.SourceType,
            sync?.SourceLastModified,
            sync?.ImportedAt);
    }

    public async Task<MaterialPageDto?> GetPageAsync(
        string contractKey,
        string? search,
        string? site,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var contract = await _contracts.GetByKeyAsync(contractKey, cancellationToken);
        if (contract is null)
        {
            return null;
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var total = await _materials.CountAsync(contractKey, search, site, cancellationToken);
        var rows = await _materials.ListPageAsync(contractKey, search, site, page, pageSize, cancellationToken);
        var summary = await GetSummaryAsync(contractKey, cancellationToken)
            ?? new MaterialSummaryDto(contractKey, total, null, null, null, null);

        return new MaterialPageDto(
            contractKey,
            total,
            page,
            pageSize,
            rows.Select(item => new MaterialItemDto(
                item.SortOrder,
                item.MaterialNumber,
                item.Description,
                item.Site,
                item.Currency,
                item.UnitPrice)).ToArray(),
            summary);
    }

    public async Task<MaterialUploadResult> UploadManualAsync(
        string contractKey,
        string fileName,
        IReadOnlyList<MaterialRowInput> rows,
        CancellationToken cancellationToken)
    {
        var contract = await _contracts.GetByKeyAsync(contractKey, cancellationToken)
            ?? throw new InvalidOperationException($"Contract '{contractKey}' was not found.");

        if (rows.Count == 0)
        {
            throw new InvalidOperationException("The Excel file has no material rows.");
        }

        ValidateRowsForContract(contract.ContractKey, rows);

        var entities = ToEntities(contract.ContractKey, rows);
        var now = DateTimeOffset.UtcNow;
        var safeName = string.IsNullOrWhiteSpace(fileName) ? "manual-upload.xlsx" : Path.GetFileName(fileName);
        var sync = new MaterialSyncFile(
            Guid.NewGuid(),
            contract.ContractKey,
            safeName,
            MaterialSyncFile.Sources.Manual,
            sourceLastModified: null,
            entities.Count,
            now);

        await _materials.ReplaceMaterialsAsync(contract.ContractKey, entities, sync, cancellationToken);
        return new MaterialUploadResult(contract.ContractKey, entities.Count, safeName, now);
    }

    /// <summary>
    /// Snapshot the live E-Proposal material rows once an award has produced a CIP contract number.
    /// The CM contract header may be registered later, so this path intentionally does not require
    /// an existing CONTRACT_T row. Repeating award finalization replaces the same contract snapshot.
    /// </summary>
    public async Task<MaterialUploadResult> ReplaceFromEproposalAwardAsync(
        string contractKey,
        string proposalKey,
        IReadOnlyList<MaterialRowInput> rows,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(contractKey))
        {
            throw new InvalidOperationException("CIP contract number is required for the E-Proposal material snapshot.");
        }

        var normalizedContractKey = contractKey.Trim();
        var normalizedRows = NormalizeClientRows(rows.Select(row => row with { ContractNo = normalizedContractKey }));
        ValidateRowsForContract(normalizedContractKey, normalizedRows);

        var entities = ToEntities(normalizedContractKey, normalizedRows);
        var now = DateTimeOffset.UtcNow;
        var sourceName = $"eproposal-{FileSafe(proposalKey)}.view";
        var sync = new MaterialSyncFile(
            Guid.NewGuid(),
            normalizedContractKey,
            sourceName,
            MaterialSyncFile.Sources.EproposalAward,
            sourceLastModified: null,
            entities.Count,
            now);

        await _materials.ReplaceMaterialsAsync(normalizedContractKey, entities, sync, cancellationToken);
        return new MaterialUploadResult(normalizedContractKey, entities.Count, sourceName, now);
    }

    public async Task<MaterialUploadResult> ReplaceFromXlsxAsync(
        string contractKey,
        string fileName,
        Stream xlsxStream,
        string sourceType,
        DateTimeOffset? sourceLastModified,
        CancellationToken cancellationToken)
    {
        var rows = ParseMaterialSheet(xlsxStream);
        ValidateRowsForContract(contractKey, rows);
        var entities = ToEntities(contractKey, rows);
        var now = DateTimeOffset.UtcNow;
        var sync = new MaterialSyncFile(
            Guid.NewGuid(),
            contractKey,
            fileName,
            sourceType,
            sourceLastModified,
            entities.Count,
            now);
        await _materials.ReplaceMaterialsAsync(contractKey, entities, sync, cancellationToken);
        return new MaterialUploadResult(contractKey, entities.Count, fileName, now);
    }

    public static bool ShouldSkipSharePointFile(MaterialSyncFile? existing, string fileName, DateTimeOffset lastModified) =>
        existing is not null
        && string.Equals(existing.FileName, fileName, StringComparison.OrdinalIgnoreCase)
        && existing.SourceLastModified is DateTimeOffset prior
        && Math.Abs((prior - lastModified.ToUniversalTime()).TotalSeconds) < 1;

    public static string ExpectedFileName(string contractKey) =>
        contractKey.Replace('/', '-') + ".xlsx";

    private static string FileSafe(string value) =>
        string.Concat((value ?? string.Empty).Select(character =>
            char.IsLetterOrDigit(character) || character is '-' or '_' ? character : '-'));

    public static IReadOnlyList<MaterialRowInput> ParseMaterialSheet(Stream xlsxStream)
    {
        var matrix = XlsxFirstSheetReader.ReadRows(xlsxStream);
        if (matrix.Count == 0)
        {
            throw new InvalidOperationException("The workbook is empty.");
        }

        var headerIndex = FindHeaderRow(matrix);
        if (headerIndex < 0)
        {
            throw new InvalidOperationException(MissingColumnsMessage(matrix));
        }

        var header = matrix[headerIndex];
        var map = MapHeaders(header);
        var rows = new List<MaterialRowInput>();
        for (var i = headerIndex + 1; i < matrix.Count; i++)
        {
            var line = matrix[i];
            if (IsBlankRow(line))
            {
                continue;
            }

            var contractNo = Cell(line, map["contractNo"]).Trim();
            var materialNumber = Cell(line, map["materialNumber"]).Trim();
            var description = Cell(line, map["description"]).Trim();
            // SharePoint LoM files often leave Material/Service Number blank and put the
            // code (e.g. SIS-159) in Description. Use Description so the row still imports.
            if (string.IsNullOrWhiteSpace(materialNumber) && !string.IsNullOrWhiteSpace(description))
            {
                materialNumber = description;
            }

            if (string.IsNullOrWhiteSpace(contractNo) && string.IsNullOrWhiteSpace(materialNumber))
            {
                continue;
            }

            rows.Add(new MaterialRowInput(
                contractNo,
                materialNumber,
                description,
                Cell(line, map["site"]).Trim(),
                Cell(line, map["currency"]).Trim(),
                ParseUnitPrice(Cell(line, map["unitPrice"]))));
        }

        return rows;
    }

    public static IReadOnlyList<MaterialRowInput> NormalizeClientRows(IEnumerable<MaterialRowInput> rows) =>
        rows.Select(row => new MaterialRowInput(
            (row.ContractNo ?? string.Empty).Trim(),
            (row.MaterialNumber ?? string.Empty).Trim(),
            (row.Description ?? string.Empty).Trim(),
            (row.Site ?? string.Empty).Trim(),
            (row.Currency ?? string.Empty).Trim(),
            row.UnitPrice)).ToArray();

    private static void ValidateRowsForContract(string contractKey, IReadOnlyList<MaterialRowInput> rows)
    {
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (!string.Equals(row.ContractNo.Trim(), contractKey, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"Row {i + 1}: Contract No. '{row.ContractNo}' does not match selected contract '{contractKey}'.");
            }

            if (string.IsNullOrWhiteSpace(row.MaterialNumber))
            {
                throw new InvalidOperationException($"Row {i + 1}: Material/Service Number is required.");
            }
        }
    }

    private static List<ContractMaterial> ToEntities(string contractKey, IReadOnlyList<MaterialRowInput> rows)
    {
        var list = new List<ContractMaterial>(rows.Count);
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            list.Add(new ContractMaterial(
                Guid.NewGuid(),
                contractKey,
                i + 1,
                row.MaterialNumber,
                row.Description,
                row.Site,
                row.Currency,
                row.UnitPrice));
        }

        return list;
    }

    private static int FindHeaderRow(IReadOnlyList<IReadOnlyList<string>> matrix)
    {
        for (var i = 0; i < Math.Min(10, matrix.Count); i++)
        {
            var map = TryMapHeaders(matrix[i]);
            if (map is not null)
            {
                return i;
            }
        }

        return -1;
    }

    private static string MissingColumnsMessage(IReadOnlyList<IReadOnlyList<string>> matrix)
    {
        const string expected =
            "Required columns not found. Expected: Contract No., Material/Service Number, Description, Site, Currency, Unit Price.";
        var found = matrix
            .Take(3)
            .Select((row, index) =>
            {
                var cells = row.Where(cell => !string.IsNullOrWhiteSpace(cell)).ToArray();
                return cells.Length == 0 ? null : $"row {index + 1}: {string.Join(", ", cells)}";
            })
            .Where(part => part is not null)
            .ToArray();
        return found.Length == 0 ? expected : $"{expected} Found {string.Join("; ", found)}.";
    }

    private static Dictionary<string, int> MapHeaders(IReadOnlyList<string> header) =>
        TryMapHeaders(header) ?? throw new InvalidOperationException("Header row is incomplete.");

    private static Dictionary<string, int>? TryMapHeaders(IReadOnlyList<string> header)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < header.Count; i++)
        {
            var key = NormHeader(header[i]);
            if (key is "contract no" or "contract no." or "contract number" or "contract id")
            {
                map["contractNo"] = i;
            }
            else if (key is "material/service number" or "material number" or "service number" or "material/service no" or "material/service no.")
            {
                map["materialNumber"] = i;
            }
            else if (key == "description")
            {
                map["description"] = i;
            }
            else if (key == "site")
            {
                map["site"] = i;
            }
            else if (key == "currency")
            {
                map["currency"] = i;
            }
            else if (key is "unit price" or "unitprice" or "price")
            {
                map["unitPrice"] = i;
            }
        }

        return map.ContainsKey("contractNo")
            && map.ContainsKey("materialNumber")
            && map.ContainsKey("description")
            && map.ContainsKey("site")
            && map.ContainsKey("currency")
            && map.ContainsKey("unitPrice")
            ? map
            : null;
    }

    private static string NormHeader(string? value) =>
        string.Join(' ', (value ?? string.Empty).Replace('.', ' ').Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Trim()
            .ToLowerInvariant();

    private static string Cell(IReadOnlyList<string> row, int index) =>
        index >= 0 && index < row.Count ? row[index] ?? string.Empty : string.Empty;

    private static bool IsBlankRow(IReadOnlyList<string> row) =>
        row.All(cell => string.IsNullOrWhiteSpace(cell));

    private static decimal ParseUnitPrice(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return 0m;
        }

        var cleaned = raw.Trim().Replace(",", string.Empty, StringComparison.Ordinal);
        if (decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.InvariantCulture, out var value))
        {
            return value;
        }

        throw new InvalidOperationException($"Invalid Unit Price '{raw}'.");
    }
}
