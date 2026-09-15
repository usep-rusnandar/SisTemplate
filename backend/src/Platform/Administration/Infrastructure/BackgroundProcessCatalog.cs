using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

public sealed class BackgroundProcessCatalog : IBackgroundProcessCatalog
{
    private static readonly string[] DisplayOrder =
    [
        BackgroundProcessKeys.WilayahSync,
        BackgroundProcessKeys.Retention,
    ];

    private readonly IBackgroundProcessSource[] _sources;
    private readonly Dictionary<string, IBackgroundProcessRunner> _runners;

    public BackgroundProcessCatalog(
        IEnumerable<IBackgroundProcessSource> sources,
        IEnumerable<IBackgroundProcessRunner> runners)
    {
        _sources = sources.ToArray();
        _runners = runners.ToDictionary(runner => runner.Key, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<BackgroundProcessCatalogResponse> ListAsync(CancellationToken cancellationToken)
    {
        var items = new List<BackgroundProcessDto>(_sources.Length);
        foreach (var source in OrderedSources())
        {
            items.Add(await source.GetStatusAsync(cancellationToken));
        }

        return new BackgroundProcessCatalogResponse(items, BackgroundProcessSchedule.ArchitectureNote);
    }

    public async Task<BackgroundProcessRunResponse> RunNowAsync(string key, CancellationToken cancellationToken)
    {
        var normalized = (key ?? string.Empty).Trim();
        if (normalized.Length == 0 || !_runners.TryGetValue(normalized, out var runner))
        {
            return new BackgroundProcessRunResponse(
                normalized,
                BackgroundProcessOutcomes.Rejected,
                "not_runnable",
                await TryStatusAsync(normalized, cancellationToken));
        }

        var result = await runner.RunNowAsync(cancellationToken);
        return new BackgroundProcessRunResponse(
            runner.Key,
            result.Outcome,
            result.Message,
            await TryStatusAsync(runner.Key, cancellationToken));
    }

    private IEnumerable<IBackgroundProcessSource> OrderedSources()
    {
        var remaining = _sources.ToList();
        foreach (var key in DisplayOrder)
        {
            var index = remaining.FindIndex(source =>
                string.Equals(source.Key, key, StringComparison.OrdinalIgnoreCase));
            if (index < 0)
            {
                continue;
            }

            yield return remaining[index];
            remaining.RemoveAt(index);
        }

        foreach (var source in remaining.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase))
        {
            yield return source;
        }
    }

    private async Task<BackgroundProcessDto?> TryStatusAsync(string key, CancellationToken cancellationToken)
    {
        var source = _sources.FirstOrDefault(item =>
            string.Equals(item.Key, key, StringComparison.OrdinalIgnoreCase));
        return source is null ? null : await source.GetStatusAsync(cancellationToken);
    }
}
