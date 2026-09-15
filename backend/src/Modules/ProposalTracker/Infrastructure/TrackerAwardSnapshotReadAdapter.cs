using System.Text.Json;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Modules.ProposalTracker.Infrastructure;

/// <summary>
/// Reads Bid Evaluation / Negotiation step documents from Tracker module state (KV) and activity rows.
/// CIP consumes this port so it never opens <c>trk.STATE_T</c> itself.
/// </summary>
internal sealed class TrackerAwardSnapshotReadAdapter : ITrackerAwardSnapshotReadPort
{
    private const string StepVendorDocsPrefix = "ag_tracker_step_vendor_docs_v1:";
    private const string BidEvalPrefix = "ag_tracker_bid_eval_v1:";

    private readonly ProcurementDbContext _dbContext;

    public TrackerAwardSnapshotReadAdapter(ProcurementDbContext dbContext) => _dbContext = dbContext;

    public async Task<IReadOnlyDictionary<string, TrackerAwardSnapshotView>> GetAsync(
        IReadOnlyCollection<TrackerAwardSnapshotQuery> queries,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, TrackerAwardSnapshotView>(StringComparer.OrdinalIgnoreCase);
        var requested = (queries ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item.ProposalKey) && !string.IsNullOrWhiteSpace(item.VendorId))
            .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToArray();
        if (requested.Length == 0)
        {
            return result;
        }

        var proposalKeys = requested
            .Select(item => item.ProposalKey.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var activities = await _dbContext.TrackerProposalActivities.AsNoTracking()
            .Where(item => proposalKeys.Contains(item.ProposalKey))
            .Select(item => new ActivityRow(item.ProposalKey, item.ActivityKey, item.StageId, item.Title))
            .ToListAsync(cancellationToken);

        var storageKeys = proposalKeys
            .SelectMany(CandidateStorageKeys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var states = storageKeys.Length == 0
            ? []
            : await _dbContext.TrackerStates.AsNoTracking()
                .Where(item => storageKeys.Contains(item.StorageKey))
                .Select(item => new { item.StorageKey, item.PayloadJson })
                .ToListAsync(cancellationToken);

        var stepDocsByProposal = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        var bidEvalByProposal = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        var ownedDocuments = new List<JsonDocument>();
        try
        {
            foreach (var state in states)
            {
                if (!TryParseObject(state.PayloadJson, out var parsed, out var owned))
                {
                    continue;
                }

                ownedDocuments.Add(owned);
                var proposalKey = ProposalKeyFromStorageKey(state.StorageKey);
                if (string.IsNullOrWhiteSpace(proposalKey))
                {
                    continue;
                }

                if (state.StorageKey.StartsWith(StepVendorDocsPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    stepDocsByProposal[proposalKey] = parsed;
                }
                else if (state.StorageKey.StartsWith(BidEvalPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    bidEvalByProposal[proposalKey] = parsed;
                }
            }

            foreach (var query in requested)
            {
                var proposalActivities = activities
                    .Where(item => string.Equals(item.ProposalKey, query.ProposalKey, StringComparison.OrdinalIgnoreCase))
                    .ToArray();
                stepDocsByProposal.TryGetValue(query.ProposalKey, out var stepDocs);
                bidEvalByProposal.TryGetValue(query.ProposalKey, out var bidEval);
                var evalActivity = proposalActivities.FirstOrDefault(IsBidEvaluation);
                var negoActivity = proposalActivities.FirstOrDefault(IsNegotiation);
                var useNegotiation = IsNegotiationSource(query.AwardSource);

                var awardSource = useNegotiation
                    ? FirstStepDocument(stepDocs, negoActivity?.ActivityKey, query.VendorId)
                        ?? FirstStepDocument(stepDocs, evalActivity?.ActivityKey, query.VendorId)
                    : FirstStepDocument(stepDocs, evalActivity?.ActivityKey, query.VendorId)
                        ?? FirstStepDocument(stepDocs, negoActivity?.ActivityKey, query.VendorId);

                // Winner evidence is one Bid Evaluation PDF for the proposal, not per vendor.
                var winnerBid = FirstProofDocument(bidEval, evalActivity?.ActivityKey);

                result[query.Key] = new TrackerAwardSnapshotView(
                    query.ProposalKey,
                    query.VendorId,
                    awardSource,
                    winnerBid);
            }
        }
        finally
        {
            foreach (var document in ownedDocuments)
            {
                document.Dispose();
            }
        }

        return result;
    }

    private static IEnumerable<string> CandidateStorageKeys(string proposalKey)
    {
        var trimmed = proposalKey.Trim();
        var encoded = Uri.EscapeDataString(trimmed);
        yield return StepVendorDocsPrefix + encoded;
        yield return BidEvalPrefix + encoded;
        if (!string.Equals(encoded, trimmed, StringComparison.Ordinal))
        {
            yield return StepVendorDocsPrefix + trimmed;
            yield return BidEvalPrefix + trimmed;
        }
    }

    private static string? ProposalKeyFromStorageKey(string storageKey)
    {
        var prefix = storageKey.StartsWith(StepVendorDocsPrefix, StringComparison.OrdinalIgnoreCase)
            ? StepVendorDocsPrefix
            : storageKey.StartsWith(BidEvalPrefix, StringComparison.OrdinalIgnoreCase)
                ? BidEvalPrefix
                : null;
        if (prefix is null)
        {
            return null;
        }

        var suffix = storageKey[prefix.Length..];
        try
        {
            return Uri.UnescapeDataString(suffix);
        }
        catch (UriFormatException)
        {
            return suffix;
        }
    }

    private static bool IsNegotiationSource(string? source) =>
        !string.IsNullOrWhiteSpace(source)
        && source.Contains("nego", StringComparison.OrdinalIgnoreCase);

    private static bool IsBidEvaluation(ActivityRow activity)
    {
        var title = activity.Title.Trim();
        var stageId = activity.StageId.Trim();
        return title.Contains("Bid Evaluation", StringComparison.OrdinalIgnoreCase)
            || stageId.Equals("EVAL", StringComparison.OrdinalIgnoreCase)
            || stageId.Equals("TS-5", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsNegotiation(ActivityRow activity)
    {
        var title = activity.Title.Trim();
        var stageId = activity.StageId.Trim();
        return title.Equals("Negotiation", StringComparison.OrdinalIgnoreCase)
            || title.Contains("Negotiation", StringComparison.OrdinalIgnoreCase)
            || stageId.Equals("NEGO", StringComparison.OrdinalIgnoreCase)
            || stageId.Equals("TS-4", StringComparison.OrdinalIgnoreCase);
    }

    private static TrackerAwardSnapshotDocument? FirstProofDocument(JsonElement bidEval, string? activityKey)
    {
        if (bidEval.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(activityKey) && TryGetProperty(bidEval, activityKey, out var named))
        {
            var fromNamed = FirstProofInActivity(named);
            if (fromNamed is not null)
            {
                return fromNamed;
            }
        }

        foreach (var property in bidEval.EnumerateObject())
        {
            var document = FirstProofInActivity(property.Value);
            if (document is not null)
            {
                return document;
            }
        }

        return null;
    }

    private static TrackerAwardSnapshotDocument? FirstProofInActivity(JsonElement activityState)
    {
        if (activityState.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!TryGetProperty(activityState, "proofDocuments", out var proofs)
            && !TryGetProperty(activityState, "ProofDocuments", out proofs))
        {
            return null;
        }

        return SharedProofInArray(proofs);
    }

    private static TrackerAwardSnapshotDocument? FirstStepDocument(
        JsonElement stepDocs,
        string? activityKey,
        string vendorId)
    {
        if (stepDocs.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(activityKey) && TryGetProperty(stepDocs, activityKey, out var named))
        {
            var fromNamed = FirstVendorDocument(named, vendorId);
            if (fromNamed is not null)
            {
                return fromNamed;
            }
        }

        foreach (var property in stepDocs.EnumerateObject())
        {
            var document = FirstVendorDocument(property.Value, vendorId);
            if (document is not null)
            {
                return document;
            }
        }

        return null;
    }

    private static TrackerAwardSnapshotDocument? FirstVendorDocument(JsonElement byVendor, string vendorId)
    {
        if (byVendor.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (TryGetProperty(byVendor, vendorId, out var preferred))
        {
            var document = FirstInArray(preferred);
            if (document is not null)
            {
                return document;
            }
        }

        foreach (var property in byVendor.EnumerateObject())
        {
            var document = FirstInArray(property.Value);
            if (document is not null)
            {
                return document;
            }
        }

        return null;
    }

    private static TrackerAwardSnapshotDocument? FirstInArray(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Array)
        {
            return ReadDocument(value);
        }

        foreach (var item in value.EnumerateArray())
        {
            var document = ReadDocument(item);
            if (document is not null)
            {
                return document;
            }
        }

        return null;
    }

    private static TrackerAwardSnapshotDocument? SharedProofInArray(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Array)
        {
            return ReadDocument(value);
        }

        TrackerAwardSnapshotDocument? first = null;
        TrackerAwardSnapshotDocument? unscoped = null;
        TrackerAwardSnapshotDocument? namedShared = null;
        var vendorIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in value.EnumerateArray())
        {
            var document = ReadDocument(item);
            if (document is null)
            {
                continue;
            }

            first ??= document;
            var vendorId = ReadString(item, "vendorId", "VendorId");
            if (string.IsNullOrWhiteSpace(vendorId))
            {
                unscoped ??= document;
                continue;
            }

            vendorIds.Add(vendorId);
            if (namedShared is null && IsProposalLevelWinnerFile(document.FileName))
            {
                namedShared = document;
            }
        }

        if (unscoped is not null)
        {
            return unscoped;
        }

        if (vendorIds.Count > 1 && namedShared is not null)
        {
            return namedShared;
        }

        return first;
    }

    private static bool IsProposalLevelWinnerFile(string? fileName)
    {
        var name = (fileName ?? string.Empty).ToLowerInvariant();
        return name.StartsWith("evaluasi_bid", StringComparison.Ordinal)
            || name.Contains("bid-evaluation-winner", StringComparison.Ordinal)
            || (name.StartsWith("bukti_pemenang_", StringComparison.Ordinal)
                && !name.Contains("_pt-", StringComparison.Ordinal)
                && !name.Contains("_pt_", StringComparison.Ordinal));
    }

    private static TrackerAwardSnapshotDocument? ReadDocument(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var blobKey = ReadString(element, "blobKey", "BlobKey");
        var container = ReadString(element, "container", "Container");
        if (string.IsNullOrWhiteSpace(blobKey) || string.IsNullOrWhiteSpace(container))
        {
            return null;
        }

        var fileName = ReadString(element, "fileName", "FileName", "name", "Name") ?? "document.pdf";
        var title = ReadString(element, "title", "Title") ?? fileName;
        return new TrackerAwardSnapshotDocument(title, fileName, blobKey, container);
    }

    private static bool TryParseObject(string? json, out JsonElement element, out JsonDocument document)
    {
        element = default;
        document = null!;
        if (string.IsNullOrWhiteSpace(json))
        {
            return false;
        }

        try
        {
            document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                document.Dispose();
                document = null!;
                return false;
            }

            element = document.RootElement;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryGetProperty(JsonElement element, string name, out JsonElement value)
    {
        if (element.TryGetProperty(name, out value))
        {
            return true;
        }

        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
    }

    private static string? ReadString(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (TryGetProperty(element, name, out var property)
                && property.ValueKind == JsonValueKind.String)
            {
                var value = property.GetString();
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }
        }

        return null;
    }

    private sealed record ActivityRow(string ProposalKey, string ActivityKey, string StageId, string Title);
}
