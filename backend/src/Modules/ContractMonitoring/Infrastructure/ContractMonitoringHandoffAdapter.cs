using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Application;
using IntegratedProcurement.Platform.Persistence.ModuleState;

namespace IntegratedProcurement.Modules.ContractMonitoring.Infrastructure;

/// <summary>
/// Registers a CIP final contract into the Contract Monitoring register by merging a row into
/// <c>ag_cm_contracts_v1</c>. Module-state projection then rebuilds the domain tables, so both the
/// CM UI (KV) and domain APIs see the handoff.
/// </summary>
internal sealed class ContractMonitoringHandoffAdapter : IContractMonitoringHandoffPort
{
    private const string ContractsStoreKey = "ag_cm_contracts_v1";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ModuleStateStore _moduleState;

    public ContractMonitoringHandoffAdapter(ModuleStateStore moduleState)
    {
        _moduleState = moduleState;
    }

    public async Task<CipContractHandoffResult> UpsertFromCipAsync(
        CipContractHandoffCommand command,
        CancellationToken cancellationToken)
    {
        var contractKey = (command.ContractKey ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(contractKey))
        {
            return new CipContractHandoffResult(false, false, string.Empty);
        }

        var existing = await _moduleState.GetAsync(ModuleStateArea.ContractMonitoring, ContractsStoreKey, cancellationToken);
        var rows = ParseRows(existing?.Value);
        var today = JakartaTime.Today();
        var effective = command.EffectiveDate ?? command.ContractDate ?? today;
        var expired = command.ExpiredDate ?? today.AddYears(1);
        var received = command.ReceivedDate ?? today;
        var link = BuildBlobLink(command.DocumentContainer, command.DocumentBlobKey);

        var matchIndex = rows.FindIndex(row =>
            string.Equals(ReadString(row, "contractId"), contractKey, StringComparison.OrdinalIgnoreCase));

        var created = matchIndex < 0;
        var idx = created
            ? (rows.Count == 0 ? 1 : rows.Max(row => ReadInt(row, "idx")) + 1)
            : ReadInt(rows[matchIndex], "idx");

        var row = new JsonObject
        {
            ["idx"] = idx,
            ["contractId"] = contractKey,
            ["title"] = string.IsNullOrWhiteSpace(command.Title) ? contractKey : command.Title.Trim(),
            ["supplier"] = string.IsNullOrWhiteSpace(command.SupplierName) ? contractKey : command.SupplierName.Trim(),
            ["jobsite"] = command.Jobsite,
            ["classification"] = "Service Agreement",
            ["subClass"] = null,
            ["template"] = command.Template,
            ["frequency"] = null,
            ["owner"] = command.Owner,
            ["userDept"] = command.Department,
            ["picNames"] = command.PicNames,
            ["picEmail"] = null,
            ["value"] = command.ContractValue,
            ["receivedDate"] = received.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["contractDate"] = (command.ContractDate ?? received).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["effectiveDate"] = effective.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["expiredDate"] = expired.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["ownership"] = "Internal",
            ["systemNos"] = new JsonArray(),
            ["link"] = link,
            ["priceAdj"] = null,
            ["type"] = "MAIN CONTRACT",
            ["status"] = expired < today ? "Expired" : "Active",
            ["source"] = "cip",
            ["cipCaseKey"] = command.CaseKey,
            ["proposalKey"] = command.ProposalKey,
            ["proposalNumber"] = command.ProposalNumber,
            ["termsheetNumber"] = command.TermsheetNumber,
            ["documentFileName"] = command.DocumentFileName,
            ["documentContainer"] = command.DocumentContainer,
            ["documentBlobKey"] = command.DocumentBlobKey,
            ["cipSource"] = command.Source,
        };

        if (created)
        {
            rows.Insert(0, row);
        }
        else
        {
            rows[matchIndex] = row;
        }

        var payload = JsonSerializer.Serialize(rows, JsonOptions);
        await _moduleState.SetAsync(ModuleStateArea.ContractMonitoring, ContractsStoreKey, payload, cancellationToken);
        return new CipContractHandoffResult(true, created, contractKey);
    }

    private static List<JsonObject> ParseRows(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return [];
        }

        try
        {
            var node = JsonNode.Parse(payloadJson);
            if (node is not JsonArray array)
            {
                return [];
            }

            return array.OfType<JsonObject>().Select(item => (JsonObject)item.DeepClone()).ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static string? BuildBlobLink(string? container, string? blobKey)
    {
        if (string.IsNullOrWhiteSpace(container) || string.IsNullOrWhiteSpace(blobKey))
        {
            return null;
        }

        return $"blob://{container.Trim()}/{blobKey.Trim()}";
    }

    private static string? ReadString(JsonObject row, string name) =>
        row[name]?.GetValue<string>();

    private static int ReadInt(JsonObject row, string name)
    {
        var node = row[name];
        if (node is null)
        {
            return 0;
        }

        try
        {
            return node.GetValue<int>();
        }
        catch
        {
            return int.TryParse(node.ToString(), out var value) ? value : 0;
        }
    }
}
