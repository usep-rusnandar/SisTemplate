using System.Globalization;
using System.Text;
using System.Text.Json;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace IntegratedProcurement.Modules.ProposalTracker.Infrastructure;

/// <summary>
/// Reads the configured E-Proposal header + vendor views (join on ID) and upserts Tracker proposals.
/// </summary>
internal sealed class EproposalIngestionService : IEproposalIngestionService
{
    // TEMPORARY VIDEO-DEMO OVERRIDE (2026-08-10).
    // Revert these FROM targets after the application-recording session:
    //   [dbo].[vw_ProposalHeader_sim] -> [dbo].[vw_ProposalHeader]
    //   [dbo].[vw_ProposalVendor_sim] -> [dbo].[vw_ProposalVendor]
    private const string HeaderQuery = """
        SELECT [ID], [ProposalKey], [ProposalTitle], [Value], [Jobsite], [Department], [WorkLocation],
               [ContractType], [ContractualType], [SourcingMethod], [Status], [SectionHeadVM], [NRPSHVM],
               [RequirementDate]
        FROM [dbo].[vw_ProposalHeader_sim]
        """;

    private const string VendorQuery = """
        SELECT [ID], [VendorCode], [VendorName]
        FROM [dbo].[vw_ProposalVendor_sim]
        """;

    private static readonly JsonSerializerOptions PayloadOptions = new(JsonSerializerDefaults.Web);

    private static readonly Action<ILogger, Exception?> LogNotConfigured =
        LoggerMessage.Define(LogLevel.Information, new EventId(1, "EproposalIngestSkip"),
            "E-Proposal ingestion skipped: no EproposalConnection configured.");

    private static readonly Action<ILogger, int, int, int, int, Exception?> LogSummary =
        LoggerMessage.Define<int, int, int, int>(LogLevel.Information, new EventId(2, "EproposalIngestDone"),
            "E-Proposal ingestion: fetched {Fetched}, inserted {Inserted}, updated {Updated}, skipped {Skipped}.");

    private readonly EproposalIngestionOptions _options;
    private readonly IProposalTrackerRepository _repository;
    private readonly ILogger<EproposalIngestionService> _logger;

    public EproposalIngestionService(
        EproposalIngestionOptions options,
        IProposalTrackerRepository repository,
        ILogger<EproposalIngestionService> logger)
    {
        _options = options;
        _repository = repository;
        _logger = logger;
    }

    public async Task<EproposalIngestionResult> IngestAsync(CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            LogNotConfigured(_logger, null);
            return EproposalIngestionResult.Disabled;
        }

        var headers = await FetchHeadersAsync(cancellationToken);
        var vendorsById = await FetchVendorsByIdAsync(cancellationToken);
        var existing = await _repository.GetProposalsByKeyAsync(tracking: true, cancellationToken);

        var inserted = 0;
        var updated = 0;
        var skipped = 0;

        foreach (var header in headers)
        {
            if (string.IsNullOrWhiteSpace(header.ProposalKey))
            {
                skipped++;
                continue;
            }

            var vendors = DedupVendors(vendorsById.GetValueOrDefault(header.Id) ?? []);
            if (!existing.TryGetValue(header.ProposalKey, out var proposal))
            {
                _repository.AddProposal(MapToProposal(header, vendors));
                inserted++;
                continue;
            }

            if (!string.Equals(proposal.LifecycleStatus, "ReadyToDistribute", StringComparison.OrdinalIgnoreCase))
            {
                skipped++;
                continue;
            }

            ApplySourceRefresh(proposal, header, vendors);
            updated++;
        }

        if (inserted + updated > 0)
        {
            await _repository.SaveChangesAsync(cancellationToken);
        }

        LogSummary(_logger, headers.Count, inserted, updated, skipped, null);
        return new EproposalIngestionResult(true, headers.Count, inserted, updated, skipped);
    }

    private async Task<IReadOnlyList<EproposalHeaderRow>> FetchHeadersAsync(CancellationToken cancellationToken)
    {
        var rows = new List<EproposalHeaderRow>();
        await using var connection = new SqlConnection(_options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(HeaderQuery, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(new EproposalHeaderRow(
                Id: ReadInt64(reader, "ID") ?? 0,
                ProposalKey: ReadString(reader, "ProposalKey")?.Trim() ?? string.Empty,
                ProposalTitle: ReadString(reader, "ProposalTitle"),
                Value: ReadDecimal(reader, "Value"),
                Jobsite: ReadString(reader, "Jobsite"),
                Department: ReadString(reader, "Department"),
                WorkLocation: ReadString(reader, "WorkLocation"),
                ContractType: ReadString(reader, "ContractType"),
                ContractualType: ReadString(reader, "ContractualType"),
                SourcingMethod: ReadString(reader, "SourcingMethod"),
                Status: ReadString(reader, "Status"),
                SectionHeadVm: ReadString(reader, "SectionHeadVM"),
                NrpShVm: ReadString(reader, "NRPSHVM"),
                RequirementDate: ReadDateTime(reader, "RequirementDate")));
        }

        return rows;
    }

    private async Task<Dictionary<long, List<EproposalVendorRow>>> FetchVendorsByIdAsync(CancellationToken cancellationToken)
    {
        var map = new Dictionary<long, List<EproposalVendorRow>>();
        await using var connection = new SqlConnection(_options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(VendorQuery, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var id = ReadInt64(reader, "ID") ?? 0;
            if (id == 0)
            {
                continue;
            }

            if (!map.TryGetValue(id, out var list))
            {
                list = [];
                map[id] = list;
            }

            list.Add(new EproposalVendorRow(
                VendorCode: ReadString(reader, "VendorCode"),
                VendorName: ReadString(reader, "VendorName")));
        }

        return map;
    }

    private static TrackerProposal MapToProposal(EproposalHeaderRow header, IReadOnlyList<EproposalVendorRow> vendors)
    {
        var proposalNumber = header.ProposalKey;
        var title = string.IsNullOrWhiteSpace(header.ProposalTitle) ? proposalNumber : header.ProposalTitle!;
        var requirementDate = header.RequirementDate is { } dt ? DateOnly.FromDateTime(dt) : (DateOnly?)null;

        return new TrackerProposal(
            Guid.NewGuid(),
            header.ProposalKey,
            proposalNumber,
            title,
            null,
            null,
            header.Jobsite,
            header.Department,
            header.ContractType,
            header.ContractualType,
            header.Value ?? 0m,
            MapTrackerMethod(header.SourcingMethod),
            "ReadyToDistribute",
            string.Empty,
            "Normal",
            header.SectionHeadVm,
            null,
            requirementDate,
            0,
            0,
            0,
            BuildPayloadJson(header, vendors));
    }

    private static void ApplySourceRefresh(
        TrackerProposal proposal,
        EproposalHeaderRow header,
        IReadOnlyList<EproposalVendorRow> vendors)
    {
        var title = string.IsNullOrWhiteSpace(header.ProposalTitle) ? header.ProposalKey : header.ProposalTitle!;
        var requirementDate = header.RequirementDate is { } dt ? DateOnly.FromDateTime(dt) : (DateOnly?)null;
        proposal.UpdateFrom(
            header.ProposalKey,
            title,
            proposal.AribaId,
            proposal.Commodity,
            header.Jobsite,
            header.Department,
            header.ContractType,
            header.ContractualType,
            header.Value ?? 0m,
            MapTrackerMethod(header.SourcingMethod),
            proposal.LifecycleStatus,
            proposal.CurrentStage,
            proposal.Priority,
            header.SectionHeadVm ?? proposal.OwnerName,
            proposal.AssignedOfficerName,
            requirementDate,
            proposal.AgingDays,
            proposal.SlaDays,
            proposal.OverdueDays,
            BuildPayloadJson(header, vendors));
    }

    private static string BuildPayloadJson(EproposalHeaderRow header, IReadOnlyList<EproposalVendorRow> vendors) =>
        JsonSerializer.Serialize(new
        {
            source = "eproposal",
            eproposalId = header.Id,
            workLocation = header.WorkLocation,
            contractualType = header.ContractualType,
            sourcingMethod = header.SourcingMethod,
            sourceStatus = header.Status,
            sectionHeadVmPersonnelNo = header.NrpShVm,
            recommendedVendors = vendors.Select(v => new
            {
                vendorId = string.IsNullOrWhiteSpace(v.VendorCode) ? null : v.VendorCode,
                vendorName = v.VendorName
            }).ToArray()
        }, PayloadOptions);

    private static List<EproposalVendorRow> DedupVendors(IEnumerable<EproposalVendorRow> rows)
    {
        var result = new List<EproposalVendorRow>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.VendorName) && string.IsNullOrWhiteSpace(row.VendorCode))
            {
                continue;
            }

            var key = !string.IsNullOrWhiteSpace(row.VendorCode)
                ? $"code:{row.VendorCode.Trim()}"
                : $"name:{NormalizeName(row.VendorName)}";
            if (!seen.Add(key))
            {
                continue;
            }

            result.Add(row);
        }

        return result;
    }

    private static string MapTrackerMethod(string? sourcingMethod)
    {
        var key = NormalizeName(sourcingMethod);
        // Covers "Penunjukan Langsung" and the common misspelling "Penunjukkan Langsung".
        if (key.Contains("penunjuk", StringComparison.Ordinal))
        {
            return "TM-3";
        }

        if (key.Contains("pemilihan", StringComparison.Ordinal))
        {
            return "TM-2";
        }

        if (key.Contains("tender", StringComparison.Ordinal))
        {
            return "TM-1";
        }

        // Unknown sourcing method — default Tender until master mapping expands.
        return "TM-1";
    }

    private static string NormalizeName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var sb = new StringBuilder(value.Length);
        foreach (var ch in value.Trim().ToLowerInvariant())
        {
            if (!char.IsWhiteSpace(ch) && ch != '-' && ch != '_')
            {
                sb.Append(ch);
            }
        }

        return sb.ToString();
    }

    private static string? ReadString(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return reader.GetValue(ordinal)?.ToString();
    }

    private static decimal? ReadDecimal(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToDecimal(reader.GetValue(ordinal), CultureInfo.InvariantCulture);
    }

    private static long? ReadInt64(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToInt64(reader.GetValue(ordinal), CultureInfo.InvariantCulture);
    }

    private static DateTime? ReadDateTime(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        var value = reader.GetValue(ordinal);
        return value switch
        {
            DateTime dt => dt,
            DateTimeOffset dto => dto.DateTime,
            _ => Convert.ToDateTime(value, CultureInfo.InvariantCulture)
        };
    }

    private sealed record EproposalHeaderRow(
        long Id,
        string ProposalKey,
        string? ProposalTitle,
        decimal? Value,
        string? Jobsite,
        string? Department,
        string? WorkLocation,
        string? ContractType,
        string? ContractualType,
        string? SourcingMethod,
        string? Status,
        string? SectionHeadVm,
        string? NrpShVm,
        DateTime? RequirementDate);

    private sealed record EproposalVendorRow(string? VendorCode, string? VendorName);
}
