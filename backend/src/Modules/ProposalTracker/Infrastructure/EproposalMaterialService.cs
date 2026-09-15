using System.Globalization;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace IntegratedProcurement.Modules.ProposalTracker.Infrastructure;

internal sealed class EproposalMaterialService : IEproposalMaterialService
{
    private static readonly Action<ILogger, Exception?> LogReadFailed =
        LoggerMessage.Define(
            LogLevel.Warning,
            new EventId(1, "EproposalMaterialReadFailed"),
            "Live E-Proposal material read failed; Tracker proposals will remain available without source currency/material rows.");

    // TEMPORARY VIDEO-DEMO OVERRIDE (2026-08-10).
    // After recording, restore [dbo].[vw_ProposalMaterial_sim] to [dbo].[vw_ProposalMaterial].
    private const string MaterialSelect = """
        SELECT [ID], [MaterialCode], [MaterialDescription], [MaterialSubclass], [Brand], [Qty],
               [EstimatedPrice], [TotalPrice], [Satuan], [RequiredDate], [Jobsite], [Plant],
               [ContractNo], [ContractName]
        FROM [dbo].[vw_ProposalMaterial_sim]
        """;

    private readonly EproposalIngestionOptions _options;
    private readonly ILogger<EproposalMaterialService> _logger;

    public EproposalMaterialService(
        EproposalIngestionOptions options,
        ILogger<EproposalMaterialService> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task<EproposalMaterialCurrencyReadResult> ListCurrenciesAsync(CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            return EproposalMaterialCurrencyReadResult.Disabled;
        }

        try
        {
            await using var connection = new SqlConnection(_options.ConnectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT [ID], [Satuan]
                FROM [dbo].[vw_ProposalMaterial_sim]
                WHERE NULLIF(LTRIM(RTRIM([ID])), '') IS NOT NULL
                  AND NULLIF(LTRIM(RTRIM([Satuan])), '') IS NOT NULL
                GROUP BY [ID], [Satuan]
                """;

            var rows = new List<EproposalMaterialCurrencyRow>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var id = ReadString(reader, "ID");
                var currency = ReadString(reader, "Satuan");
                if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(currency))
                {
                    rows.Add(new EproposalMaterialCurrencyRow(id, currency));
                }
            }

            return new EproposalMaterialCurrencyReadResult(true, rows);
        }
        catch (SqlException exception)
        {
            LogReadFailed(_logger, exception);
            return EproposalMaterialCurrencyReadResult.Disabled;
        }
    }

    public async Task<EproposalMaterialPageReadResult> GetPageBySourceProposalIdAsync(
        string sourceProposalId,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            return EproposalMaterialPageReadResult.Disabled(page, pageSize);
        }

        try
        {
            await using var connection = new SqlConnection(_options.ConnectionString);
            await connection.OpenAsync(cancellationToken);

            var totalRows = await CountAsync(connection, sourceProposalId, cancellationToken);
            var totalPages = Math.Max(1, (int)Math.Ceiling(totalRows / (double)pageSize));
            var actualPage = Math.Min(page, totalPages);
            var totals = await ReadTotalsAsync(connection, sourceProposalId, cancellationToken);
            var rows = await ReadPageAsync(connection, sourceProposalId, actualPage, pageSize, cancellationToken);

            return new EproposalMaterialPageReadResult(true, actualPage, pageSize, totalRows, totals, rows);
        }
        catch (SqlException exception)
        {
            LogReadFailed(_logger, exception);
            return EproposalMaterialPageReadResult.Disabled(page, pageSize);
        }
    }

    public Task<EproposalMaterialReadResult> GetBySourceProposalIdAsync(
        string sourceProposalId,
        CancellationToken cancellationToken) =>
        ReadAsync(sourceProposalId, cancellationToken);

    private static async Task<int> CountAsync(
        SqlConnection connection,
        string sourceProposalId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT COUNT_BIG(1)
            FROM [dbo].[vw_ProposalMaterial_sim]
            WHERE [ID] = @sourceProposalId
            """;
        command.Parameters.AddWithValue("@sourceProposalId", sourceProposalId);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return checked((int)Convert.ToInt64(value, CultureInfo.InvariantCulture));
    }

    private static async Task<IReadOnlyList<EproposalMaterialCurrencyTotal>> ReadTotalsAsync(
        SqlConnection connection,
        string sourceProposalId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT COALESCE(NULLIF(LTRIM(RTRIM([Satuan])), ''), 'IDR') AS [Satuan],
                   SUM(COALESCE([TotalPrice], 0)) AS [TotalPrice]
            FROM [dbo].[vw_ProposalMaterial_sim]
            WHERE [ID] = @sourceProposalId
            GROUP BY COALESCE(NULLIF(LTRIM(RTRIM([Satuan])), ''), 'IDR')
            ORDER BY [Satuan]
            """;
        command.Parameters.AddWithValue("@sourceProposalId", sourceProposalId);

        var totals = new List<EproposalMaterialCurrencyTotal>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            totals.Add(new EproposalMaterialCurrencyTotal(
                ReadString(reader, "Satuan") ?? "IDR",
                ReadDecimal(reader, "TotalPrice")));
        }

        return totals;
    }

    private static async Task<IReadOnlyList<EproposalMaterialRow>> ReadPageAsync(
        SqlConnection connection,
        string sourceProposalId,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            {MaterialSelect}
            WHERE [ID] = @sourceProposalId
            ORDER BY [MaterialCode], [ID]
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            """;
        command.Parameters.AddWithValue("@sourceProposalId", sourceProposalId);
        command.Parameters.AddWithValue("@offset", (page - 1) * pageSize);
        command.Parameters.AddWithValue("@pageSize", pageSize);

        var rows = new List<EproposalMaterialRow>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var row = ReadRow(reader);
            if (row is not null)
            {
                rows.Add(row);
            }
        }

        return rows;
    }

    private async Task<EproposalMaterialReadResult> ReadAsync(
        string? sourceProposalId,
        CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            return EproposalMaterialReadResult.Disabled;
        }

        try
        {
            await using var connection = new SqlConnection(_options.ConnectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = sourceProposalId is null
                ? MaterialSelect
                : $"{MaterialSelect}\nWHERE [ID] = @sourceProposalId";
            if (sourceProposalId is not null)
            {
                command.Parameters.AddWithValue("@sourceProposalId", sourceProposalId);
            }

            var rows = new List<EproposalMaterialRow>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var row = ReadRow(reader);
                if (row is not null)
                {
                    rows.Add(row);
                }
            }

            return new EproposalMaterialReadResult(true, rows);
        }
        catch (SqlException exception)
        {
            LogReadFailed(_logger, exception);
            return EproposalMaterialReadResult.Disabled;
        }
    }

    private static EproposalMaterialRow? ReadRow(SqlDataReader reader)
    {
        var id = ReadString(reader, "ID");
        if (string.IsNullOrWhiteSpace(id))
        {
            return null;
        }

        return new EproposalMaterialRow(
            id,
            ReadString(reader, "MaterialCode"),
            ReadString(reader, "MaterialDescription"),
            ReadString(reader, "MaterialSubclass"),
            ReadString(reader, "Brand"),
            ReadDecimal(reader, "Qty"),
            ReadDecimal(reader, "EstimatedPrice"),
            ReadDecimal(reader, "TotalPrice"),
            ReadString(reader, "Satuan"),
            ReadDate(reader, "RequiredDate"),
            ReadString(reader, "Jobsite"),
            ReadString(reader, "Plant"),
            ReadString(reader, "ContractNo"),
            ReadString(reader, "ContractName"));
    }

    private static string? ReadString(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal)
            ? null
            : Convert.ToString(reader.GetValue(ordinal), CultureInfo.InvariantCulture)?.Trim();
    }

    private static decimal ReadDecimal(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal)
            ? 0m
            : Convert.ToDecimal(reader.GetValue(ordinal), CultureInfo.InvariantCulture);
    }

    private static DateOnly? ReadDate(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return reader.GetValue(ordinal) switch
        {
            DateTime dateTime => DateOnly.FromDateTime(dateTime),
            DateTimeOffset offset => DateOnly.FromDateTime(offset.DateTime),
            DateOnly dateOnly => dateOnly,
            _ => DateOnly.TryParse(
                Convert.ToString(reader.GetValue(ordinal), CultureInfo.InvariantCulture),
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsed)
                ? parsed
                : null
        };
    }
}
