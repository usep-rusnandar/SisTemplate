using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace IntegratedProcurement.Platform.Administration.Application;

/// <summary>
/// Prepares a category-scoped email-template replace so a module admin cannot wipe other
/// modules' rows. Incoming ids that collide with a reserved (other-category) template id are
/// rewritten; payload <c>id</c> and <c>category</c> are forced to the scoped values.
/// </summary>
public static class EmailTemplateCategoryMerge
{
    public const string ContractMonitoringCategory = "Contract Monitoring";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static bool MatchesCategory(string? value, string category) =>
        string.Equals((value ?? string.Empty).Trim(), (category ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase);

    public static IReadOnlyList<KeyedJsonItem> Prepare(
        IReadOnlyCollection<KeyedJsonItem>? incoming,
        IReadOnlyCollection<string>? reservedTemplateIds,
        string category)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(category);
        var canonical = category.Trim();
        var reserved = new HashSet<string>(
            (reservedTemplateIds ?? []).Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()),
            StringComparer.OrdinalIgnoreCase);
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<KeyedJsonItem>();
        var seq = 1;

        foreach (var item in incoming ?? [])
        {
            var id = (item.Key ?? string.Empty).Trim();
            if (id.Length == 0 || reserved.Contains(id) || !used.Add(id))
            {
                do
                {
                    id = string.Create(CultureInfo.InvariantCulture, $"ET-CM-{seq:D4}");
                    seq++;
                }
                while (reserved.Contains(id) || !used.Add(id));
            }

            result.Add(new KeyedJsonItem(id, ForceIdAndCategory(item.PayloadJson, id, canonical)));
        }

        return result;
    }

    private static string ForceIdAndCategory(string? payloadJson, string templateId, string category)
    {
        JsonObject node;
        try
        {
            node = JsonNode.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson) as JsonObject
                ?? [];
        }
        catch (JsonException)
        {
            node = [];
        }

        node["id"] = templateId;
        node["category"] = category;
        return node.ToJsonString(JsonOptions);
    }
}
