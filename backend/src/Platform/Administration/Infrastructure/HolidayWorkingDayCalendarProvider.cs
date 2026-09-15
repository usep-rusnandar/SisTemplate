using System.Globalization;
using System.Text.Json;
using SisTemplate.BuildingBlocks.Application.Abstractions;
using SisTemplate.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SisTemplate.Platform.Administration.Infrastructure;

/// <summary>
/// Builds the working-day calendar from the <c>holiday</c> master-data set (the same records the
/// Master Data ▸ Holiday screen edits). A record flagged <c>recurring</c> repeats every year on its
/// month/day; the rest apply to their exact date. The snapshot is cached for the scope's lifetime,
/// so one request pays a single query no matter how many rows it evaluates.
/// </summary>
internal sealed class HolidayWorkingDayCalendarProvider : IWorkingDayCalendarProvider
{
    private const string SetKey = "holiday";

    private readonly ProcurementDbContext _dbContext;
    private WorkingDayCalendar? _cached;

    public HolidayWorkingDayCalendarProvider(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<WorkingDayCalendar> GetCalendarAsync(CancellationToken cancellationToken)
    {
        if (_cached is not null)
        {
            return _cached;
        }

        var payloads = await _dbContext.MasterDataRecords
            .AsNoTracking()
            .Where(record => record.SetKey == SetKey && record.Status == "Active")
            .Select(record => record.PayloadJson)
            .ToListAsync(cancellationToken);

        var fixedDates = new List<DateOnly>();
        var recurring = new List<(int Month, int Day)>();
        foreach (var payload in payloads)
        {
            if (!TryReadHoliday(payload, out var date, out var repeats))
            {
                continue;
            }

            if (repeats)
            {
                recurring.Add((date.Month, date.Day));
            }
            else
            {
                fixedDates.Add(date);
            }
        }

        _cached = new WorkingDayCalendar(fixedDates, recurring);
        return _cached;
    }

    private static bool TryReadHoliday(string? payloadJson, out DateOnly date, out bool recurring)
    {
        date = default;
        recurring = false;
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            // Master-data payloads are written camelCase by the seeder but edited records may carry
            // either casing, so both are accepted (same rule as the other master-data readers).
            if (!root.TryGetProperty("date", out var dateElement)
                && !root.TryGetProperty("Date", out dateElement))
            {
                return false;
            }

            var raw = dateElement.GetString();
            if (string.IsNullOrWhiteSpace(raw)
                || !DateOnly.TryParse(raw.Length > 10 ? raw[..10] : raw, CultureInfo.InvariantCulture, out date))
            {
                return false;
            }

            if (root.TryGetProperty("recurring", out var recurringElement)
                || root.TryGetProperty("Recurring", out recurringElement))
            {
                recurring = recurringElement.ValueKind switch
                {
                    JsonValueKind.True => true,
                    JsonValueKind.String => bool.TryParse(recurringElement.GetString(), out var parsed) && parsed,
                    _ => false,
                };
            }

            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
