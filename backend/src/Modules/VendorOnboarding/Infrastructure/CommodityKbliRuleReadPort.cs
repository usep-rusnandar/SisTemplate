using System.Text.Json;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>
/// Loads KBLI DNF rules from the <c>commodity-subclassification-kbli</c> master-data set.
/// Tolerant of both the new one-record-per-sub shape (payload.groups) and legacy pair rows.
/// </summary>
internal sealed class CommodityKbliRuleReadPort : ICommodityKbliRuleReadPort
{
    private const string SetKey = "commodity-subclassification-kbli";

    private readonly ProcurementDbContext _db;

    public CommodityKbliRuleReadPort(ProcurementDbContext db) => _db = db;

    public async Task<IReadOnlyDictionary<string, IReadOnlyList<IReadOnlyList<string>>>> GetRulesBySubClassificationAsync(
        CancellationToken cancellationToken)
    {
        var rows = await _db.MasterDataRecords
            .AsNoTracking()
            .Where(r => r.SetKey == SetKey)
            .Select(r => new { r.Code, r.Name, r.PayloadJson })
            .ToListAsync(cancellationToken);

        var map = new Dictionary<string, List<List<string>>>(StringComparer.OrdinalIgnoreCase);
        var ruleDefined = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            if (TryParseGroups(row.PayloadJson, out var subIdFromPayload, out var groups) && groups is not null)
            {
                var subId = string.IsNullOrWhiteSpace(subIdFromPayload)
                    ? row.Code
                    : subIdFromPayload;
                if (string.IsNullOrWhiteSpace(subId))
                {
                    continue;
                }

                map[subId] = groups;
                ruleDefined.Add(subId);
                continue;
            }

            // Legacy pair: code = "Sub|Kbli"
            var parts = (row.Code ?? string.Empty).Split('|');
            if (parts.Length != 2)
            {
                continue;
            }

            var legacySub = parts[0];
            var kbli = parts[1];
            if (string.IsNullOrWhiteSpace(legacySub) || string.IsNullOrWhiteSpace(kbli))
            {
                continue;
            }

            if (ruleDefined.Contains(legacySub))
            {
                continue;
            }

            if (!map.TryGetValue(legacySub, out var list))
            {
                list = [];
                map[legacySub] = list;
            }

            if (!list.Any(g => g.Count == 1 && string.Equals(g[0], kbli, StringComparison.OrdinalIgnoreCase)))
            {
                list.Add([kbli]);
            }
        }

        return map.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyList<IReadOnlyList<string>>)kv.Value
                .Select(g => (IReadOnlyList<string>)g)
                .ToArray(),
            StringComparer.OrdinalIgnoreCase);
    }

    private static bool TryParseGroups(
        string? payloadJson,
        out string? subClassificationId,
        out List<List<string>>? groups)
    {
        subClassificationId = null;
        groups = null;
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return false;
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            if (root.TryGetProperty("subClassificationId", out var subEl) ||
                root.TryGetProperty("SubClassificationId", out subEl))
            {
                subClassificationId = subEl.GetString();
            }

            if (!root.TryGetProperty("groups", out var groupsEl) &&
                !root.TryGetProperty("Groups", out groupsEl))
            {
                return false;
            }

            if (groupsEl.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            var parsed = new List<List<string>>();
            foreach (var groupEl in groupsEl.EnumerateArray())
            {
                var codes = new List<string>();
                if (groupEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var codeEl in groupEl.EnumerateArray())
                    {
                        var code = codeEl.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(code))
                        {
                            codes.Add(code);
                        }
                    }
                }
                else
                {
                    var code = groupEl.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(code))
                    {
                        codes.Add(code);
                    }
                }

                if (codes.Count > 0)
                {
                    parsed.Add(codes);
                }
            }

            groups = parsed;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
