using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Administration.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

/// <summary>
/// Pulls the Indonesian administrative-region hierarchy from the wilayah.id static API and refreshes the
/// province / city / district / village master-data sets. Codes are stored verbatim (dotted form, e.g.
/// <c>11.01.01.2001</c>) — matching the seed and the vendor-address references — with the parent chain
/// captured both in <see cref="MasterDataRecordEntry.ParentCode"/> (used by the cascade queries) and in
/// PayloadJson (read by the legacy master-data screens).
/// Transient HTTP failures are retried; a level is only replaced when every parent request completed.
/// </summary>
internal sealed class WilayahSyncService : IWilayahSyncService
{
    internal const string StateSettingsKey = "wilayahSyncState";
    private const int InsertBatchSize = 2000;

    // Frontend reads PascalCase parent keys (payload.ProvinceId, .CityId, .DistrictId), so payloads
    // must NOT be camel-cased. wilayah.id responses ARE camelCase, hence a separate read option set.
    private static readonly JsonSerializerOptions PayloadOptions = new();
    private static readonly JsonSerializerOptions ReadOptions =
        new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };

    private static readonly Dictionary<string, (string Name, string Table)> SetDefinitions =
        new()
        {
            ["province"] = ("Province", "MSTR_PROVINCE_T"),
            ["city"] = ("City", "MSTR_CITY_T"),
            ["district"] = ("District", "MSTR_DISTRICT_T"),
            ["village"] = ("Village", "MSTR_VILLAGE_T"),
        };

    private static readonly Action<ILogger, string, string, Exception?> LogFetchRetry =
        LoggerMessage.Define<string, string>(LogLevel.Information, new EventId(4, "WilayahFetchRetry"),
            "Wilayah fetch {Path} failed ({Reason}); retrying.");
    private static readonly Action<ILogger, string, string, Exception?> LogFetchFailed =
        LoggerMessage.Define<string, string>(LogLevel.Warning, new EventId(1, "WilayahFetchFailed"),
            "Wilayah fetch {Path} failed ({Reason}); parent marked incomplete.");
    private static readonly Action<ILogger, string, int, int, int, int, Exception?> LogSyncDone =
        LoggerMessage.Define<string, int, int, int, int>(LogLevel.Information, new EventId(2, "WilayahSyncDone"),
            "Wilayah sync ({Trigger}) done: provinces={Provinces}, regencies={Regencies}, districts={Districts}, villages={Villages}.");
    private static readonly Action<ILogger, string, string, Exception?> LogSyncSkipped =
        LoggerMessage.Define<string, string>(LogLevel.Information, new EventId(5, "WilayahSyncSkipped"),
            "Wilayah sync ({Trigger}) skipped: source dataset unchanged ({Stamp}).");
    private static readonly Action<ILogger, string, Exception?> LogSyncFailed =
        LoggerMessage.Define<string>(LogLevel.Error, new EventId(3, "WilayahSyncFailed"),
            "Wilayah sync ({Trigger}) failed.");

    private readonly ProcurementDbContext _dbContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IAdminConsoleConfigurationService _configurationService;
    private readonly WilayahSyncSignal _signal;
    private readonly WilayahSyncOptions _options;
    private readonly ILogger<WilayahSyncService> _logger;

    public WilayahSyncService(
        ProcurementDbContext dbContext,
        IHttpClientFactory httpClientFactory,
        IAdminConsoleConfigurationService configurationService,
        WilayahSyncSignal signal,
        IOptions<WilayahSyncOptions> options,
        ILogger<WilayahSyncService> logger)
    {
        _dbContext = dbContext;
        _httpClientFactory = httpClientFactory;
        _configurationService = configurationService;
        _signal = signal;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<WilayahSyncResult> RunAsync(string trigger, CancellationToken cancellationToken)
    {
        var startedAt = DateTimeOffset.UtcNow;
        var previous = _signal.Current;
        _signal.BeginRun(trigger, startedAt);

        try
        {
            var client = CreateClient();
            var plan = WilayahSyncProgressPlan.ForDepth(_options.Depth);

            PublishProgress(plan, WilayahSyncProgressPlan.FetchProvince, 0, 1, "Fetching provinces…");
            var provinceFetch = await FetchAsync(client, "provinces.json", cancellationToken);
            if (!provinceFetch.Succeeded)
            {
                throw new InvalidOperationException(
                    "wilayah.id province fetch failed after retries; aborting region sync to preserve existing data.");
            }

            var provinces = provinceFetch.Items;
            if (provinces.Count == 0)
            {
                throw new InvalidOperationException(
                    "wilayah.id returned no provinces; aborting region sync to preserve existing data.");
            }

            var sourceStamp = WilayahDatasetStamp.Parse(provinceFetch.MetaUpdatedAt);
            PublishProgress(plan, WilayahSyncProgressPlan.FetchProvince, 1, 1, "Fetching provinces…");
            _signal.ReportCounts(provinces: provinces.Count);

            var requireVillages = _options.Depth >= WilayahSyncDepth.Village;
            if (previous.LastSuccessAt is not null
                && WilayahDatasetStamp.ShouldSkipRefresh(
                    sourceStamp,
                    previous.SourceUpdatedAt,
                    provinces.Count,
                    previous.Provinces,
                    requireVillages,
                    previous.Villages))
            {
                _signal.ReportCounts(previous.Provinces, previous.Regencies, previous.Districts, previous.Villages);
                var skipped = new WilayahSyncResult(
                    true, previous.Provinces, previous.Regencies, previous.Districts, previous.Villages,
                    null, startedAt, DateTimeOffset.UtcNow, sourceStamp, DatasetUnchanged: true);
                _signal.CompleteSuccess(skipped);
                await PersistStateAsync(cancellationToken);
                LogSyncSkipped(_logger, trigger, WilayahDatasetStamp.Format(sourceStamp) ?? "", null);
                return skipped;
            }

            await ReplaceSetAsync("province",
                provinces.Select(p => new RegionRow(p.Code!, p.Name!, null, null)),
                plan, WilayahSyncProgressPlan.WriteProvince, "Saving provinces…", cancellationToken);

            var regencyCount = 0;
            var districtCount = 0;
            var villageCount = 0;

            if (_options.Depth >= WilayahSyncDepth.Regency)
            {
                var regencies = await FanOutAsync(client,
                    provinces.Select(p => p.Code!).ToArray(),
                    code => $"regencies/{code}.json",
                    plan, WilayahSyncProgressPlan.FetchCity, "Fetching cities / regencies…",
                    cancellationToken);
                EnsureComplete("city", regencies);
                regencyCount = regencies.Items.Count;
                _signal.ReportCounts(regencies: regencyCount);
                await ReplaceSetAsync("city",
                    regencies.Items.Select(r => new RegionRow(r.Item.Code!, r.Item.Name!, r.Parent, Payload("ProvinceId", r.Parent))),
                    plan, WilayahSyncProgressPlan.WriteCity, "Saving cities / regencies…", cancellationToken);

                if (_options.Depth >= WilayahSyncDepth.District)
                {
                    var districts = await FanOutAsync(client,
                        regencies.Items.Select(r => r.Item.Code!).ToArray(),
                        code => $"districts/{code}.json",
                        plan, WilayahSyncProgressPlan.FetchDistrict, "Fetching districts…",
                        cancellationToken);
                    EnsureComplete("district", districts);
                    districtCount = districts.Items.Count;
                    _signal.ReportCounts(districts: districtCount);
                    await ReplaceSetAsync("district",
                        districts.Items.Select(d => new RegionRow(d.Item.Code!, d.Item.Name!, d.Parent, Payload("CityId", d.Parent))),
                        plan, WilayahSyncProgressPlan.WriteDistrict, "Saving districts…", cancellationToken);

                    if (_options.Depth >= WilayahSyncDepth.Village)
                    {
                        var villages = await FanOutAsync(client,
                            districts.Items.Select(d => d.Item.Code!).ToArray(),
                            code => $"villages/{code}.json",
                            plan, WilayahSyncProgressPlan.FetchVillage, "Fetching villages…",
                            cancellationToken);
                        EnsureComplete("village", villages);
                        villageCount = villages.Items.Count;
                        _signal.ReportCounts(villages: villageCount);
                        await ReplaceSetAsync("village",
                            villages.Items.Select(v => new RegionRow(v.Item.Code!, v.Item.Name!, v.Parent, Payload("DistrictId", v.Parent))),
                            plan, WilayahSyncProgressPlan.WriteVillage, "Saving villages…", cancellationToken);
                    }
                }
            }

            var result = new WilayahSyncResult(true, provinces.Count, regencyCount, districtCount, villageCount,
                null, startedAt, DateTimeOffset.UtcNow, sourceStamp);
            _signal.CompleteSuccess(result);
            await PersistStateAsync(cancellationToken);
            LogSyncDone(_logger, trigger, result.Provinces, result.Regencies, result.Districts, result.Villages, null);
            return result;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogSyncFailed(_logger, trigger, ex);
            _signal.CompleteFailure(ex.Message, DateTimeOffset.UtcNow);
            await PersistStateSafeAsync(cancellationToken);
            return new WilayahSyncResult(false, 0, 0, 0, 0, ex.Message, startedAt, DateTimeOffset.UtcNow, previous.SourceUpdatedAt);
        }
    }

    private static void EnsureComplete(string level, FanOutResult fanOut)
    {
        if (WilayahSyncCompleteness.CanReplace(fanOut.FailedParents))
        {
            return;
        }

        throw new InvalidOperationException(
            WilayahSyncCompleteness.IncompleteMessage(level, fanOut.FailedParents, fanOut.ParentCount));
    }

    private HttpClient CreateClient()
    {
        var client = _httpClientFactory.CreateClient("wilayah");
        var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl) ? "https://wilayah.id/api" : _options.BaseUrl.TrimEnd('/');
        client.BaseAddress = new Uri(baseUrl + "/");
        client.Timeout = TimeSpan.FromSeconds(_options.RequestTimeoutSeconds <= 0 ? 30 : _options.RequestTimeoutSeconds);
        return client;
    }

    private async Task<WilayahFetchResult> FetchAsync(HttpClient client, string path, CancellationToken cancellationToken)
    {
        string? lastReason = null;
        for (var attempt = 0; attempt < WilayahSyncHttpPolicy.MaxAttempts; attempt++)
        {
            try
            {
                using var response = await client.GetAsync(path, cancellationToken);
                if (response.StatusCode == HttpStatusCode.NotFound)
                {
                    return WilayahFetchResult.CompleteEmpty();
                }

                if (response.IsSuccessStatusCode)
                {
                    var payload = await response.Content.ReadFromJsonAsync<WilayahListResponse>(ReadOptions, cancellationToken);
                    var items = payload?.Data?
                        .Where(item => !string.IsNullOrWhiteSpace(item.Code) && !string.IsNullOrWhiteSpace(item.Name))
                        .ToArray() ?? [];
                    return new WilayahFetchResult(true, items, payload?.Meta?.UpdatedAt);
                }

                lastReason = ((int)response.StatusCode).ToString(CultureInfo.InvariantCulture);
                if (!WilayahSyncHttpPolicy.ShouldRetry(response.StatusCode) || attempt == WilayahSyncHttpPolicy.MaxAttempts - 1)
                {
                    LogFetchFailed(_logger, path, lastReason, null);
                    return WilayahFetchResult.Failed(lastReason);
                }

                LogFetchRetry(_logger, path, lastReason, null);
                await Task.Delay(WilayahSyncHttpPolicy.DelayBeforeRetry(attempt, RetryAfterDelay(response.Headers), JitterMs()), cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                lastReason = ex.GetType().Name;
                if (attempt == WilayahSyncHttpPolicy.MaxAttempts - 1)
                {
                    LogFetchFailed(_logger, path, lastReason, ex);
                    return WilayahFetchResult.Failed(lastReason);
                }

                LogFetchRetry(_logger, path, lastReason, ex);
                await Task.Delay(WilayahSyncHttpPolicy.DelayBeforeRetry(attempt, jitterMs: JitterMs()), cancellationToken);
            }
        }

        return WilayahFetchResult.Failed(lastReason ?? "unknown");
    }

    private async Task<FanOutResult> FanOutAsync(
        HttpClient client,
        string[] parentCodes,
        Func<string, string> pathFor,
        WilayahSyncProgressPlan plan,
        string stageKey,
        string step,
        CancellationToken cancellationToken)
    {
        var results = new ConcurrentBag<(string, WilayahItem)>();
        using var throttle = new SemaphoreSlim(_options.NormalizedConcurrency);
        var total = parentCodes.Length;
        var completed = 0;
        var failed = 0;
        PublishProgress(plan, stageKey, 0, total, step);

        var tasks = parentCodes.Select(async parent =>
        {
            await throttle.WaitAsync(cancellationToken);
            try
            {
                var fetch = await FetchAsync(client, pathFor(parent), cancellationToken);
                if (!fetch.Succeeded)
                {
                    Interlocked.Increment(ref failed);
                    return;
                }

                foreach (var item in fetch.Items)
                {
                    results.Add((parent, item));
                }
            }
            finally
            {
                throttle.Release();
                var done = Interlocked.Increment(ref completed);
                if (WilayahSyncProgressPlan.ShouldPublish(done, total))
                {
                    PublishProgress(plan, stageKey, done, total, step);
                }
            }
        });

        await Task.WhenAll(tasks);
        PublishProgress(plan, stageKey, total, total, step);
        return new FanOutResult(results.ToList(), total, failed);
    }

    private async Task ReplaceSetAsync(
        string setKey,
        IEnumerable<RegionRow> rows,
        WilayahSyncProgressPlan plan,
        string stageKey,
        string step,
        CancellationToken cancellationToken)
    {
        var materialized = rows
            .Where(row => !string.IsNullOrWhiteSpace(row.Code) && !string.IsNullOrWhiteSpace(row.Name))
            .ToList();

        // Never replace a set with an empty result: a failed/empty upstream fetch must keep the prior
        // data intact rather than wiping it. (The province level aborts the whole run when empty.)
        if (materialized.Count == 0)
        {
            PublishProgress(plan, stageKey, 1, 1, step);
            return;
        }

        var total = materialized.Count;
        PublishProgress(plan, stageKey, 0, total, step);
        await EnsureSetAsync(setKey, cancellationToken);
        await _dbContext.MasterDataRecords.Where(record => record.SetKey == setKey).ExecuteDeleteAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var inserted = 0;
        var buffer = new List<MasterDataRecordEntry>(InsertBatchSize);
        foreach (var row in materialized)
        {
            buffer.Add(new MasterDataRecordEntry(
                Guid.NewGuid(), setKey, row.Code, row.Name, "Active", string.Empty, row.PayloadJson, now, row.ParentCode));

            if (buffer.Count >= InsertBatchSize)
            {
                await FlushAsync(buffer, cancellationToken);
                inserted += InsertBatchSize;
                PublishProgress(plan, stageKey, inserted, total, step);
            }
        }

        if (buffer.Count > 0)
        {
            var leftover = buffer.Count;
            await FlushAsync(buffer, cancellationToken);
            inserted += leftover;
            PublishProgress(plan, stageKey, inserted, total, step);
        }
    }

    private void PublishProgress(WilayahSyncProgressPlan plan, string stageKey, int done, int total, string step) =>
        _signal.ReportProgress(plan.Percent(stageKey, done, total), done, total, step, stageKey);

    private async Task FlushAsync(List<MasterDataRecordEntry> buffer, CancellationToken cancellationToken)
    {
        _dbContext.MasterDataRecords.AddRange(buffer);
        await _dbContext.SaveChangesAsync(cancellationToken);
        _dbContext.ChangeTracker.Clear();
        buffer.Clear();
    }

    private async Task EnsureSetAsync(string setKey, CancellationToken cancellationToken)
    {
        if (await _dbContext.MasterDataSets.AnyAsync(set => set.Key == setKey, cancellationToken))
        {
            return;
        }

        var (name, table) = SetDefinitions.TryGetValue(setKey, out var def)
            ? def
            : (setKey, $"MSTR_{setKey.ToUpperInvariant()}_T");
        _dbContext.MasterDataSets.Add(new MasterDataSetEntry(
            Guid.NewGuid(), setKey, name, table, "VendorOnboarding", false, DateTimeOffset.UtcNow));
        await _dbContext.SaveChangesAsync(cancellationToken);
        _dbContext.ChangeTracker.Clear();
    }

    private async Task PersistStateAsync(CancellationToken cancellationToken)
    {
        var snapshot = _signal.Current;
        var state = new
        {
            phase = snapshot.Phase.ToString(),
            trigger = snapshot.Trigger,
            startedAt = snapshot.StartedAt,
            finishedAt = snapshot.FinishedAt,
            lastSuccessAt = snapshot.LastSuccessAt,
            provinces = snapshot.Provinces,
            regencies = snapshot.Regencies,
            districts = snapshot.Districts,
            villages = snapshot.Villages,
            error = snapshot.Error,
            sourceUpdatedAt = WilayahDatasetStamp.Format(snapshot.SourceUpdatedAt),
        };
        var element = JsonSerializer.SerializeToElement(state, PayloadOptions);
        await _configurationService.SaveSettingsAsync(
            new Dictionary<string, JsonElement> { [StateSettingsKey] = element }, cancellationToken);
    }

    private async Task PersistStateSafeAsync(CancellationToken cancellationToken)
    {
        try
        {
            await PersistStateAsync(cancellationToken);
        }
        catch (Exception)
        {
            // Best-effort: a failure to persist the failure state must not mask the original error.
        }
    }

    private static string Payload(string parentKey, string parentValue) =>
        parentKey switch
        {
            "ProvinceId" => JsonSerializer.Serialize(new { ProvinceId = parentValue }, PayloadOptions),
            "CityId" => JsonSerializer.Serialize(new { CityId = parentValue }, PayloadOptions),
            "DistrictId" => JsonSerializer.Serialize(new { DistrictId = parentValue }, PayloadOptions),
            _ => JsonSerializer.Serialize(new Dictionary<string, string> { [parentKey] = parentValue }, PayloadOptions),
        };

    private static TimeSpan? RetryAfterDelay(HttpResponseHeaders headers) =>
        headers.RetryAfter?.Delta ?? (headers.RetryAfter?.Date is { } date
            ? date - DateTimeOffset.UtcNow
            : null);

    private static int JitterMs() => Random.Shared.Next(0, 250);

    private sealed record RegionRow(string Code, string Name, string? ParentCode, string? PayloadJson);

    private sealed record FanOutResult(List<(string Parent, WilayahItem Item)> Items, int ParentCount, int FailedParents);

    private sealed record WilayahFetchResult(bool Succeeded, IReadOnlyList<WilayahItem> Items, string? MetaUpdatedAt)
    {
        public static WilayahFetchResult CompleteEmpty() => new(true, [], null);

        public static WilayahFetchResult Failed(string reason)
        {
            _ = reason;
            return new(false, [], null);
        }
    }

    private sealed record WilayahListResponse(List<WilayahItem>? Data, WilayahMeta? Meta);

    private sealed record WilayahMeta(
        [property: JsonPropertyName("administrative_area_level")] int? AdministrativeAreaLevel,
        [property: JsonPropertyName("updated_at")] string? UpdatedAt);

    private sealed record WilayahItem(string? Code, string? Name);
}
