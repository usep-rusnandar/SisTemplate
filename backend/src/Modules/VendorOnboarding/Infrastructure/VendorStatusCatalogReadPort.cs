using System.Globalization;
using System.Text.Json;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>
/// Reads the <c>vendor-status</c> master-data set so the UI can label a status from configuration
/// instead of a hardcoded map. Payload keys are read case-insensitively (the seeder writes camelCase,
/// edited records may differ) and the optional <c>nameId</c> / <c>descriptionId</c> fields carry the
/// Indonesian wording when an administrator has filled them in.
/// </summary>
internal sealed class VendorStatusCatalogReadPort : IVendorStatusCatalogReadPort
{
    private const string SetKey = "vendor-status";

    private readonly ProcurementDbContext _dbContext;

    public VendorStatusCatalogReadPort(ProcurementDbContext dbContext) => _dbContext = dbContext;

    public async Task<IReadOnlyList<VendorStatusDto>> ReadAsync(CancellationToken cancellationToken)
    {
        var rows = await _dbContext.MasterDataRecords
            .AsNoTracking()
            .Where(record => record.SetKey == SetKey && record.Status == "Active")
            .Select(record => new { record.Code, record.Name, record.PayloadJson })
            .ToListAsync(cancellationToken);

        return rows
            .Select(row =>
            {
                var payload = Parse(row.PayloadJson);
                return new VendorStatusDto(
                    row.Code,
                    row.Name,
                    payload.NameId,
                    payload.Description,
                    payload.DescriptionId,
                    payload.Order,
                    // Codes the running application can actually reach; the rest are inherited from the
                    // VendorConnect import and are shown for reference only.
                    VendorStatuses.All.Contains(row.Code, StringComparer.OrdinalIgnoreCase),
                    payload.NextId,
                    payload.ApproverRoleCode,
                    payload.SlaDays);
            })
            .OrderBy(status => status.Order)
            .ThenBy(status => status.Code, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private readonly record struct StatusPayload(
        string? NameId,
        string? Description,
        string? DescriptionId,
        int Order,
        string? NextId,
        string? ApproverRoleCode,
        int? SlaDays);

    private static StatusPayload Parse(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return default;
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return default;
            }

            var sla = Number(root, "slaDays");
            return new StatusPayload(
                Text(root, "nameId"),
                Text(root, "description"),
                Text(root, "descriptionId"),
                Number(root, "order"),
                Text(root, "nextId"),
                Text(root, "approverRoleCode"),
                sla > 0 ? sla : null);
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private static string? Text(JsonElement root, string name)
    {
        if (!TryGet(root, name, out var element) || element.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var value = element.GetString();
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static int Number(JsonElement root, string name)
    {
        if (!TryGet(root, name, out var element))
        {
            return 0;
        }

        return element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var value) => value,
            JsonValueKind.String when int.TryParse(element.GetString(), CultureInfo.InvariantCulture, out var value) => value,
            _ => 0,
        };
    }

    private static bool TryGet(JsonElement root, string name, out JsonElement element)
    {
        foreach (var property in root.EnumerateObject())
        {
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                element = property.Value;
                return true;
            }
        }

        element = default;
        return false;
    }
}
