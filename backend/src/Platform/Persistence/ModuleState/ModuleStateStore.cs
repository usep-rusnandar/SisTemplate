using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;
using IntegratedProcurement.Modules.ContractMonitoring.Domain;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace IntegratedProcurement.Platform.Persistence.ModuleState;

public sealed class ModuleStateStore
{
    private const string TrackerWorkflowStoreKey = "ag_tracker_rebuild_v14";
    private const string CipWorkflowStoreKey = "ag_cip_store_v7";
    private const string ContractMonitoringContractsStoreKey = "ag_cm_contracts_v1";
    private const string ContractMonitoringRemindersStoreKey = "ag_cm_reminders_v1";

    private readonly ProcurementDbContext _dbContext;

    public ModuleStateStore(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyCollection<ModuleStateItem>> ListAsync(
        ModuleStateArea area,
        CancellationToken cancellationToken) =>
        area switch
        {
            ModuleStateArea.ProposalTracker => await _dbContext.TrackerStates
                .AsNoTracking()
                .OrderBy(entry => entry.StorageKey)
                .Select(entry => new ModuleStateItem(
                    entry.StorageKey,
                    entry.PayloadJson,
                    entry.UpdatedAt ?? entry.CreatedAt))
                .ToArrayAsync(cancellationToken),
            ModuleStateArea.ContractInitiationPlatform => await _dbContext.CipStates
                .AsNoTracking()
                .OrderBy(entry => entry.StorageKey)
                .Select(entry => new ModuleStateItem(
                    entry.StorageKey,
                    entry.PayloadJson,
                    entry.UpdatedAt ?? entry.CreatedAt))
                .ToArrayAsync(cancellationToken),
            ModuleStateArea.ContractMonitoring => await _dbContext.ContractMonitoringStates
                .AsNoTracking()
                .OrderBy(entry => entry.StorageKey)
                .Select(entry => new ModuleStateItem(
                    entry.StorageKey,
                    entry.PayloadJson,
                    entry.UpdatedAt ?? entry.CreatedAt))
                .ToArrayAsync(cancellationToken),
            _ => []
        };

    public async Task<ModuleStateItem?> GetAsync(
        ModuleStateArea area,
        string key,
        CancellationToken cancellationToken)
    {
        var normalizedKey = NormalizeKey(key);

        return area switch
        {
            ModuleStateArea.ProposalTracker => await _dbContext.TrackerStates
                .AsNoTracking()
                .Where(entry => entry.StorageKey == normalizedKey)
                .Select(entry => new ModuleStateItem(
                    entry.StorageKey,
                    entry.PayloadJson,
                    entry.UpdatedAt ?? entry.CreatedAt))
                .SingleOrDefaultAsync(cancellationToken),
            ModuleStateArea.ContractInitiationPlatform => await _dbContext.CipStates
                .AsNoTracking()
                .Where(entry => entry.StorageKey == normalizedKey)
                .Select(entry => new ModuleStateItem(
                    entry.StorageKey,
                    entry.PayloadJson,
                    entry.UpdatedAt ?? entry.CreatedAt))
                .SingleOrDefaultAsync(cancellationToken),
            ModuleStateArea.ContractMonitoring => await _dbContext.ContractMonitoringStates
                .AsNoTracking()
                .Where(entry => entry.StorageKey == normalizedKey)
                .Select(entry => new ModuleStateItem(
                    entry.StorageKey,
                    entry.PayloadJson,
                    entry.UpdatedAt ?? entry.CreatedAt))
                .SingleOrDefaultAsync(cancellationToken),
            _ => null
        };
    }

    public async Task<ModuleStateItem> SetAsync(
        ModuleStateArea area,
        string key,
        string? payloadJson,
        CancellationToken cancellationToken)
    {
        var normalizedKey = NormalizeKey(key);
        var normalizedPayload = payloadJson ?? string.Empty;

        return area switch
        {
            ModuleStateArea.ProposalTracker => await SetTrackerAsync(normalizedKey, normalizedPayload, cancellationToken),
            ModuleStateArea.ContractInitiationPlatform => await SetCipAsync(normalizedKey, normalizedPayload, cancellationToken),
            ModuleStateArea.ContractMonitoring => await SetContractMonitoringAsync(normalizedKey, normalizedPayload, cancellationToken),
            _ => throw new ArgumentOutOfRangeException(nameof(area), area, "Unsupported module state area.")
        };
    }

    public async Task RemoveAsync(
        ModuleStateArea area,
        string key,
        CancellationToken cancellationToken)
    {
        var normalizedKey = NormalizeKey(key);

        switch (area)
        {
            case ModuleStateArea.ProposalTracker:
                await _dbContext.TrackerStates
                    .Where(entry => entry.StorageKey == normalizedKey)
                    .ExecuteDeleteAsync(cancellationToken);
                if (normalizedKey == TrackerWorkflowStoreKey)
                {
                    await ClearTrackerProjectionAsync(cancellationToken);
                }

                break;
            case ModuleStateArea.ContractInitiationPlatform:
                await _dbContext.CipStates
                    .Where(entry => entry.StorageKey == normalizedKey)
                    .ExecuteDeleteAsync(cancellationToken);
                if (normalizedKey == CipWorkflowStoreKey)
                {
                    await ClearCipProjectionAsync(cancellationToken);
                }

                break;
            case ModuleStateArea.ContractMonitoring:
                await _dbContext.ContractMonitoringStates
                    .Where(entry => entry.StorageKey == normalizedKey)
                    .ExecuteDeleteAsync(cancellationToken);
                if (normalizedKey == ContractMonitoringContractsStoreKey)
                {
                    await ClearContractProjectionAsync(cancellationToken);
                }

                if (normalizedKey == ContractMonitoringRemindersStoreKey)
                {
                    await ClearContractReminderProjectionAsync(cancellationToken);
                }

                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(area), area, "Unsupported module state area.");
        }
    }

    public async Task ClearAsync(ModuleStateArea area, CancellationToken cancellationToken)
    {
        switch (area)
        {
            case ModuleStateArea.ProposalTracker:
                await _dbContext.TrackerStates.ExecuteDeleteAsync(cancellationToken);
                await ClearTrackerProjectionAsync(cancellationToken);
                break;
            case ModuleStateArea.ContractInitiationPlatform:
                await _dbContext.CipStates.ExecuteDeleteAsync(cancellationToken);
                await ClearCipProjectionAsync(cancellationToken);
                break;
            case ModuleStateArea.ContractMonitoring:
                await _dbContext.ContractMonitoringStates.ExecuteDeleteAsync(cancellationToken);
                await ClearContractReminderProjectionAsync(cancellationToken);
                await ClearContractProjectionAsync(cancellationToken);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(area), area, "Unsupported module state area.");
        }
    }

    private async Task<ModuleStateItem> SetTrackerAsync(
        string key,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var entry = await _dbContext.TrackerStates
            .SingleOrDefaultAsync(item => item.StorageKey == key, cancellationToken);

        if (entry is null)
        {
            entry = new TrackerStateEntry(Guid.NewGuid(), key, payloadJson);
            _dbContext.TrackerStates.Add(entry);
        }
        else
        {
            entry.UpdatePayload(payloadJson);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        if (key == TrackerWorkflowStoreKey)
        {
            await ProjectTrackerWorkflowStateAsync(payloadJson, cancellationToken);
        }

        return new ModuleStateItem(entry.StorageKey, entry.PayloadJson, entry.UpdatedAt ?? entry.CreatedAt);
    }

    private async Task<ModuleStateItem> SetCipAsync(
        string key,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var entry = await _dbContext.CipStates
            .SingleOrDefaultAsync(item => item.StorageKey == key, cancellationToken);

        if (entry is null)
        {
            entry = new CipStateEntry(Guid.NewGuid(), key, payloadJson);
            _dbContext.CipStates.Add(entry);
        }
        else
        {
            entry.UpdatePayload(payloadJson);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        if (key == CipWorkflowStoreKey)
        {
            await ProjectCipWorkflowStateAsync(payloadJson, cancellationToken);
        }

        return new ModuleStateItem(entry.StorageKey, entry.PayloadJson, entry.UpdatedAt ?? entry.CreatedAt);
    }

    private async Task<ModuleStateItem> SetContractMonitoringAsync(
        string key,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        // Empty [] from stale frontend-state migrate must not replace a populated register.
        // Explicit DELETE of the key still clears the projection via RemoveAsync.
        if (key == ContractMonitoringContractsStoreKey
            && ModuleStateJson.IsEmptyArray(payloadJson)
            && await _dbContext.Contracts.AnyAsync(cancellationToken))
        {
            var kept = await _dbContext.ContractMonitoringStates
                .AsNoTracking()
                .SingleOrDefaultAsync(item => item.StorageKey == key, cancellationToken);
            if (kept is not null)
            {
                return new ModuleStateItem(
                    kept.StorageKey,
                    kept.PayloadJson,
                    kept.UpdatedAt ?? kept.CreatedAt);
            }

            return new ModuleStateItem(key, "[]", DateTimeOffset.UtcNow);
        }

        var entry = await _dbContext.ContractMonitoringStates
            .SingleOrDefaultAsync(item => item.StorageKey == key, cancellationToken);

        if (entry is null)
        {
            entry = new ContractMonitoringStateEntry(Guid.NewGuid(), key, payloadJson);
            _dbContext.ContractMonitoringStates.Add(entry);
        }
        else
        {
            entry.UpdatePayload(payloadJson);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        if (key == ContractMonitoringContractsStoreKey)
        {
            await ProjectContractMonitoringContractsStateAsync(payloadJson, cancellationToken);
        }

        if (key == ContractMonitoringRemindersStoreKey)
        {
            await ProjectContractMonitoringRemindersStateAsync(payloadJson, cancellationToken);
        }

        return new ModuleStateItem(entry.StorageKey, entry.PayloadJson, entry.UpdatedAt ?? entry.CreatedAt);
    }

    private static string NormalizeKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Module state key is required.", nameof(key));
        }

        return key.Trim();
    }

    private async Task ProjectTrackerWorkflowStateAsync(
        string payloadJson,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            await ClearTrackerProjectionAsync(cancellationToken);
            return;
        }

        using var document = JsonDocument.Parse(payloadJson);
        var root = document.RootElement;
        JsonElement[] proposals = root.TryGetProperty("proposals", out var proposalsElement)
            && proposalsElement.ValueKind == JsonValueKind.Array
            ? proposalsElement.EnumerateArray().ToArray()
            : Array.Empty<JsonElement>();

        await ClearTrackerProjectionAsync(cancellationToken);

        foreach (var proposal in proposals)
        {
            var proposalKey = GetString(proposal, "id");
            if (string.IsNullOrWhiteSpace(proposalKey))
            {
                continue;
            }

            _dbContext.TrackerProposals.Add(new TrackerProposal(
                Guid.NewGuid(),
                proposalKey,
                GetString(proposal, "proposalNumber") ?? proposalKey,
                GetString(proposal, "title") ?? proposalKey,
                GetString(proposal, "aribaId"),
                GetString(proposal, "commodity"),
                GetString(proposal, "jobsite"),
                GetString(proposal, "department"),
                GetString(proposal, "contractType") ?? GetString(proposal, "trackerContractType") ?? GetString(proposal, "proposalType"),
                GetString(proposal, "contractualType") ?? GetString(proposal, "cipContractType"),
                GetDecimal(proposal, "amount"),
                GetString(proposal, "trackerMethod"),
                GetString(proposal, "lifecycleStatus") ?? "Unknown",
                GetString(proposal, "currentStage") ?? string.Empty,
                GetString(proposal, "priority"),
                GetString(proposal, "ownerName"),
                GetString(proposal, "assignedOfficerName"),
                GetDateOnly(proposal, "requirementDate"),
                GetInt32(proposal, "agingDays"),
                GetInt32(proposal, "slaDays"),
                GetInt32(proposal, "overdueDays"),
                proposal.GetRawText()));

            if (proposal.TryGetProperty("activities", out var activitiesElement)
                && activitiesElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var activity in activitiesElement.EnumerateArray())
                {
                    var activityKey = GetString(activity, "id");
                    if (string.IsNullOrWhiteSpace(activityKey))
                    {
                        continue;
                    }

                    _dbContext.TrackerProposalActivities.Add(new TrackerProposalActivity(
                        Guid.NewGuid(),
                        proposalKey,
                        activityKey,
                        GetString(activity, "stageId"),
                        GetString(activity, "title") ?? activityKey,
                        GetString(activity, "owner"),
                        GetString(activity, "status") ?? "Unknown",
                        GetInt32(activity, "masterLeadDays"),
                        GetInt32(activity, "targetLeadDays"),
                        GetDateOnly(activity, "targetDate"),
                        GetDateTimeOffset(activity, "startedAt"),
                        GetDateTimeOffset(activity, "completedAt"),
                        GetInt32(activity, "evidenceCount"),
                        GetString(activity, "lockedReason"),
                        activity.GetRawText()));
                }
            }
        }

        if (root.TryGetProperty("loaDocuments", out var loaDocumentsElement)
            && loaDocumentsElement.ValueKind == JsonValueKind.Object)
        {
            ProjectTrackerLoaDocuments(loaDocumentsElement);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private void ProjectTrackerLoaDocuments(JsonElement loaDocumentsElement)
    {
        foreach (var proposalProperty in loaDocumentsElement.EnumerateObject())
        {
            if (proposalProperty.Value.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            foreach (var activityProperty in proposalProperty.Value.EnumerateObject())
            {
                if (activityProperty.Value.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                foreach (var vendorProperty in activityProperty.Value.EnumerateObject())
                {
                    if (vendorProperty.Value.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    var document = vendorProperty.Value;
                    var awardValue = GetDecimal(document, "awardValue");
                    if (awardValue == 0m)
                    {
                        awardValue = GetDecimal(document, "payload", "awardValue");
                    }

                    var awardPercent = GetDecimal(document, "awardPercent");
                    if (awardPercent == 0m)
                    {
                        awardPercent = GetDecimal(document, "payload", "awardPercent");
                    }

                    _dbContext.TrackerLoaDocuments.Add(new TrackerLoaDocument(
                        Guid.NewGuid(),
                        proposalProperty.Name,
                        activityProperty.Name,
                        vendorProperty.Name,
                        GetString(document, "loaNumber")
                            ?? GetNestedString(document, "payload", "loaNumber"),
                        GetString(document, "vendorName")
                            ?? GetNestedString(document, "payload", "vendorName")
                            ?? vendorProperty.Name,
                        awardValue,
                        awardPercent,
                        GetDateTimeOffset(document, "generatedAt"),
                        GetString(document, "fileName"),
                        document.GetRawText()));
                }
            }
        }
    }

    private async Task ProjectCipWorkflowStateAsync(
        string payloadJson,
        CancellationToken cancellationToken)
    {
        // Term Sheet cases are created by CipCaseService from a Tracker award. Wiping cip.CASE_T
        // from the legacy KV blob (login migrate, empty store PUT) dropped those cases.
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return;
        }

        using var document = JsonDocument.Parse(payloadJson);
        var root = document.RootElement;
        JsonElement[] cases = root.TryGetProperty("cases", out var casesElement)
            && casesElement.ValueKind == JsonValueKind.Array
            ? casesElement.EnumerateArray().ToArray()
            : Array.Empty<JsonElement>();

        foreach (var cipCase in cases)
        {
            var caseKey = GetString(cipCase, "id");
            if (string.IsNullOrWhiteSpace(caseKey)
                || await _dbContext.CipCases.AnyAsync(item => item.CaseKey == caseKey, cancellationToken))
            {
                continue;
            }

            _dbContext.CipCases.Add(new CipCase(
                Guid.NewGuid(),
                caseKey,
                GetString(cipCase, "loaKey"),
                GetString(cipCase, "loaNo"),
                GetString(cipCase, "title") ?? caseKey,
                GetString(cipCase, "vendorId"),
                GetString(cipCase, "vendor"),
                GetString(cipCase, "jobsite"),
                GetString(cipCase, "department"),
                GetDecimal(cipCase, "value"),
                GetDecimal(cipCase, "proposalTotalValue"),
                GetDecimal(cipCase, "awardPercent"),
                GetString(cipCase, "stage") ?? "loa",
                GetString(cipCase, "status") ?? string.Empty,
                GetString(cipCase, "template"),
                GetString(cipCase, "requestor"),
                GetString(cipCase, "procurement"),
                GetString(cipCase, "legal"),
                GetDateOnly(cipCase, "createdAt"),
                GetString(cipCase, "source"),
                GetString(cipCase, "proposalId"),
                GetString(cipCase, "proposalNumber"),
                GetString(cipCase, "termsheetNo"),
                GetString(cipCase, "contractNo"),
                cipCase.GetRawText()));

            ProjectCipCaseDocuments(caseKey, cipCase);
            ProjectCipCaseActivities(caseKey, cipCase);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private void ProjectCipCaseDocuments(string caseKey, JsonElement cipCase)
    {
        AddCipDocument(
            caseKey,
            "loa",
            GetString(cipCase, "loaFileName"),
            GetDateTimeOffset(cipCase, "createdAt"),
            0,
            GetString(cipCase, "loaDataUri"),
            GetString(cipCase, "loaContainer"),
            GetString(cipCase, "loaBlobKey"),
            cipCase);

        if (HasAnyProperty(cipCase, "termsheetFileName", "termsheetDataUri", "termsheetGeneratedAt", "termsheetBlobKey"))
        {
            AddCipDocument(
                caseKey,
                "termsheet",
                GetString(cipCase, "termsheetFileName"),
                GetDateTimeOffset(cipCase, "termsheetGeneratedAt"),
                0,
                GetString(cipCase, "termsheetDataUri"),
                GetString(cipCase, "termsheetContainer"),
                GetString(cipCase, "termsheetBlobKey"),
                cipCase);
        }

        if (HasAnyProperty(cipCase, "draftFileName", "draftDataUri", "draftGeneratedAt", "draftBlobKey"))
        {
            AddCipDocument(
                caseKey,
                "draft-pdf",
                GetString(cipCase, "draftFileName"),
                GetDateTimeOffset(cipCase, "draftGeneratedAt"),
                0,
                GetString(cipCase, "draftDataUri"),
                GetString(cipCase, "draftContainer"),
                GetString(cipCase, "draftBlobKey"),
                cipCase);
        }

        if (HasAnyProperty(cipCase, "draftDocxFileName", "draftGeneratedAt", "draftDocxBlobKey"))
        {
            AddCipDocument(
                caseKey,
                "draft-docx",
                GetString(cipCase, "draftDocxFileName"),
                GetDateTimeOffset(cipCase, "draftGeneratedAt"),
                0,
                null,
                GetString(cipCase, "draftDocxContainer"),
                GetString(cipCase, "draftDocxBlobKey"),
                cipCase);
        }

        if (HasAnyProperty(cipCase, "finalContractFileName", "finalContractDataUri", "finalContractUploadedAt", "finalContractBlobKey"))
        {
            AddCipDocument(
                caseKey,
                "final",
                GetString(cipCase, "finalContractFileName"),
                GetDateTimeOffset(cipCase, "finalContractUploadedAt"),
                GetInt64(cipCase, "finalContractSize"),
                GetString(cipCase, "finalContractDataUri"),
                GetString(cipCase, "finalContractContainer"),
                GetString(cipCase, "finalContractBlobKey"),
                cipCase);
        }
    }

    private void AddCipDocument(
        string caseKey,
        string documentType,
        string? fileName,
        DateTimeOffset? generatedAt,
        long size,
        string? dataUri,
        string? container,
        string? blobKey,
        JsonElement source)
    {
        _dbContext.CipCaseDocuments.Add(new CipCaseDocument(
            Guid.NewGuid(),
            caseKey,
            $"{caseKey}:{documentType}",
            documentType,
            string.IsNullOrWhiteSpace(fileName) ? $"{caseKey}-{documentType}" : fileName,
            generatedAt,
            size,
            dataUri,
            source.GetRawText(),
            container,
            blobKey));
    }

    private void ProjectCipCaseActivities(string caseKey, JsonElement cipCase)
    {
        if (!cipCase.TryGetProperty("activityHistory", out var history)
            || history.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        var ordinal = 0;
        foreach (var activity in history.EnumerateArray())
        {
            ordinal++;
            var activityKey = GetString(activity, "id") ?? $"{caseKey}:activity:{ordinal}";
            _dbContext.CipCaseActivities.Add(new CipCaseActivity(
                Guid.NewGuid(),
                caseKey,
                activityKey,
                GetString(activity, "type"),
                GetString(activity, "stageKey"),
                GetDateTimeOffset(activity, "at"),
                GetString(activity, "actorName"),
                GetString(activity, "message"),
                activity.GetRawText()));
        }
    }

    private async Task ProjectContractMonitoringContractsStateAsync(
        string payloadJson,
        CancellationToken cancellationToken)
    {
        // Match CIP: a blank / empty KV PUT (login migrate, stale bridge) must not wipe
        // cm.CONTRACT_T. Rebuild only when the payload actually contains contract rows.
        if (ModuleStateJson.IsEmptyArray(payloadJson))
        {
            return;
        }

        using var document = JsonDocument.Parse(payloadJson);
        var root = document.RootElement;
        JsonElement[] rows = root.ValueKind == JsonValueKind.Array
            ? root.EnumerateArray().Where(row => row.ValueKind == JsonValueKind.Object).ToArray()
            : Array.Empty<JsonElement>();

        if (rows.Length == 0)
        {
            return;
        }

        await ClearContractProjectionAsync(cancellationToken);

        // Expiry status / days-to-expiry are computed against the current WIB day (never a frozen date).
        var today = JakartaTime.Today();
        var rowsByContract = rows
            .Select((row, index) => new ContractMonitoringRow(
                row,
                index + 1,
                GetString(row, "contractId") ?? $"CM-ROW-{index + 1}",
                GetDateOnly(row, "expiredDate"),
                GetContractVersionTypeOrder(GetString(row, "type"))))
            .GroupBy(row => row.ContractKey, StringComparer.OrdinalIgnoreCase);

        foreach (var group in rowsByContract)
        {
            var versions = group
                .OrderBy(row => row.ExpiredDate ?? DateOnly.MaxValue)
                .ThenBy(row => row.TypeOrder)
                .ThenBy(row => row.Ordinal)
                .ToArray();

            if (versions.Length == 0)
            {
                continue;
            }

            var first = versions[0].Row;
            var latest = versions[^1].Row;
            var expiryDate = GetDateOnly(latest, "expiredDate");
            var daysToExpiry = expiryDate.HasValue
                ? expiryDate.Value.DayNumber - today.DayNumber
                : 0;
            var status = GetString(latest, "status");
            status = string.Equals(status, "Expired", StringComparison.OrdinalIgnoreCase) || daysToExpiry < 0
                ? "Expired"
                : daysToExpiry <= 180
                    ? "Expiring"
                    : "Active";

            _dbContext.Contracts.Add(new Contract(
                Guid.NewGuid(),
                group.Key,
                GetString(latest, "supplier") ?? group.Key,
                GetContractBaseTitle(GetString(first, "title") ?? group.Key),
                GetString(latest, "classification"),
                GetString(latest, "subClass"),
                GetString(latest, "jobsite"),
                GetString(latest, "template"),
                GetString(latest, "frequency"),
                GetString(latest, "owner"),
                GetString(latest, "userDept"),
                GetString(latest, "picNames"),
                GetString(latest, "picEmail"),
                GetDecimal(latest, "value"),
                expiryDate,
                GetDateOnly(first, "effectiveDate") ?? GetDateOnly(latest, "effectiveDate"),
                GetDateOnly(first, "contractDate"),
                GetDateOnly(latest, "receivedDate"),
                GetString(latest, "ownership") ?? GetString(first, "ownership"),
                GetRawJson(latest, "systemNos"),
                GetString(latest, "link"),
                GetString(latest, "priceAdj"),
                status,
                daysToExpiry,
                versions.Length,
                GetString(latest, "type"),
                latest.GetRawText()));

            foreach (var version in versions)
            {
                var row = version.Row;
                _dbContext.ContractVersions.Add(new ContractVersion(
                    Guid.NewGuid(),
                    group.Key,
                    $"{group.Key}:{GetInt32(row, "idx")}:{version.Ordinal}",
                    GetInt32(row, "idx"),
                    GetString(row, "type") ?? "MAIN CONTRACT",
                    GetString(row, "title") ?? group.Key,
                    GetString(row, "status") ?? "Active",
                    GetDecimal(row, "value"),
                    GetDateOnly(row, "receivedDate"),
                    GetDateOnly(row, "contractDate"),
                    GetDateOnly(row, "effectiveDate"),
                    GetDateOnly(row, "expiredDate"),
                    GetString(row, "supplier"),
                    GetString(row, "jobsite"),
                    GetString(row, "classification"),
                    GetString(row, "subClass"),
                    GetString(row, "template"),
                    GetString(row, "frequency"),
                    GetString(row, "owner"),
                    GetString(row, "userDept"),
                    GetString(row, "picNames"),
                    GetString(row, "picEmail"),
                    GetString(row, "ownership"),
                    GetRawJson(row, "systemNos"),
                    GetString(row, "link"),
                    GetString(row, "priceAdj"),
                    row.GetRawText()));
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task ProjectContractMonitoringRemindersStateAsync(
        string payloadJson,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            await ClearContractReminderProjectionAsync(cancellationToken);
            return;
        }

        using var document = JsonDocument.Parse(payloadJson);
        var root = document.RootElement;
        JsonElement[] reminders = root.ValueKind == JsonValueKind.Array
            ? root.EnumerateArray().Where(row => row.ValueKind == JsonValueKind.Object).ToArray()
            : Array.Empty<JsonElement>();

        await ClearContractReminderProjectionAsync(cancellationToken);

        var ordinal = 0;
        foreach (var reminder in reminders)
        {
            ordinal++;
            var contractKey = GetString(reminder, "contractId");
            var tier = GetString(reminder, "tier");
            if (string.IsNullOrWhiteSpace(contractKey) || string.IsNullOrWhiteSpace(tier))
            {
                continue;
            }

            _dbContext.ContractReminders.Add(new ContractReminder(
                Guid.NewGuid(),
                contractKey,
                $"{contractKey}:{tier}:{ordinal}",
                tier,
                GetDateTimeOffset(reminder, "sentAt"),
                GetString(reminder, "trigger") ?? "Unknown",
                GetInt32(reminder, "days"),
                GetBool(reminder, "escalated"),
                reminder.GetRawText()));
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task ClearTrackerProjectionAsync(CancellationToken cancellationToken)
    {
        await _dbContext.TrackerLoaDocuments.ExecuteDeleteAsync(cancellationToken);
        await _dbContext.TrackerProposalActivities.ExecuteDeleteAsync(cancellationToken);
        await _dbContext.TrackerProposals.ExecuteDeleteAsync(cancellationToken);
    }

    private async Task ClearCipProjectionAsync(CancellationToken cancellationToken)
    {
        await _dbContext.CipCaseActivities.ExecuteDeleteAsync(cancellationToken);
        await _dbContext.CipCaseDocuments.ExecuteDeleteAsync(cancellationToken);
        await _dbContext.CipCases.ExecuteDeleteAsync(cancellationToken);
    }

    private async Task ClearContractProjectionAsync(CancellationToken cancellationToken)
    {
        await _dbContext.ContractVersions.ExecuteDeleteAsync(cancellationToken);
        await _dbContext.Contracts.ExecuteDeleteAsync(cancellationToken);
    }

    private async Task ClearContractReminderProjectionAsync(CancellationToken cancellationToken)
    {
        await _dbContext.ContractReminders.ExecuteDeleteAsync(cancellationToken);
    }

    private static string? GetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property)
            || property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : property.ToString();
    }

    private static string? GetNestedString(JsonElement element, string parentName, string propertyName)
    {
        return element.TryGetProperty(parentName, out var parent)
            && parent.ValueKind == JsonValueKind.Object
            ? GetString(parent, propertyName)
            : null;
    }

    private static int GetInt32(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return 0;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetInt32(out var value) => value,
            JsonValueKind.String when int.TryParse(property.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) => value,
            _ => 0
        };
    }

    private static bool GetBool(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return false;
        }

        return property.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(property.GetString(), out var value) => value,
            _ => false
        };
    }

    private static long GetInt64(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return 0;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetInt64(out var value) => value,
            JsonValueKind.String when long.TryParse(property.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) => value,
            _ => 0
        };
    }

    private static decimal GetDecimal(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return 0m;
        }

        return GetDecimal(property);
    }

    private static decimal GetDecimal(JsonElement element, string parentName, string propertyName)
    {
        return element.TryGetProperty(parentName, out var parent)
            && parent.ValueKind == JsonValueKind.Object
            ? GetDecimal(parent, propertyName)
            : 0m;
    }

    private static decimal GetDecimal(JsonElement property)
    {
        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetDecimal(out var value) => value,
            JsonValueKind.String when decimal.TryParse(property.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var value) => value,
            _ => 0m
        };
    }

    private static DateOnly? GetDateOnly(JsonElement element, string propertyName)
    {
        var value = GetString(element, propertyName);
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateOnly.TryParse(value.Split(' ')[0], CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
            ? parsed
            : null;
    }

    private static DateTimeOffset? GetDateTimeOffset(JsonElement element, string propertyName)
    {
        var value = GetString(element, propertyName);
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var offset))
        {
            return offset;
        }

        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dateTime)
            ? new DateTimeOffset(dateTime)
            : null;
    }

    private static bool HasAnyProperty(JsonElement element, params string[] propertyNames)
    {
        return propertyNames.Any(propertyName =>
            element.TryGetProperty(propertyName, out var property)
            && property.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined
            && !string.IsNullOrWhiteSpace(property.ToString()));
    }

    private static string? GetRawJson(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var property)
            && property.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined
            ? property.GetRawText()
            : null;
    }

    private static int GetContractVersionTypeOrder(string? type)
    {
        return type?.ToUpperInvariant() switch
        {
            "MAIN CONTRACT" => 0,
            "AMENDMENT I" => 1,
            "AMENDMENT II" => 2,
            "AMENDMENT III" => 3,
            "AMENDMENT IV" => 4,
            _ => 9
        };
    }

    private static string GetContractBaseTitle(string title)
    {
        return Regex.Replace(
            title,
            @"^(AMANDEMEN|AMENDMENT)\s+[IVX]+\s+",
            string.Empty,
            RegexOptions.IgnoreCase).Trim();
    }

    private sealed record ContractMonitoringRow(
        JsonElement Row,
        int Ordinal,
        string ContractKey,
        DateOnly? ExpiredDate,
        int TypeOrder);
}

public sealed record ModuleStateItem(
    string Key,
    string Value,
    DateTimeOffset UpdatedAt);
