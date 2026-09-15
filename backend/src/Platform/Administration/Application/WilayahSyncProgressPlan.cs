namespace IntegratedProcurement.Platform.Administration.Application;

/// <summary>
/// Weighted overall percent for a wilayah.id sync run. Village HTTP fan-out is the bulk of the work,
/// so its fetch stage carries most of the weight. Depth smaller than Village redistributes the same
/// relative weights across the stages that will actually run.
/// </summary>
public sealed class WilayahSyncProgressPlan
{
    public const string FetchProvince = "fetch-province";
    public const string WriteProvince = "write-province";
    public const string FetchCity = "fetch-city";
    public const string WriteCity = "write-city";
    public const string FetchDistrict = "fetch-district";
    public const string WriteDistrict = "write-district";
    public const string FetchVillage = "fetch-village";
    public const string WriteVillage = "write-village";

    private readonly (string Key, int Weight)[] _stages;
    private readonly int _totalWeight;
    private readonly Dictionary<string, int> _index;

    private WilayahSyncProgressPlan((string Key, int Weight)[] stages)
    {
        _stages = stages;
        _totalWeight = stages.Sum(stage => stage.Weight);
        _index = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var i = 0; i < stages.Length; i++)
        {
            _index[stages[i].Key] = i;
        }
    }

    public static WilayahSyncProgressPlan ForDepth(WilayahSyncDepth depth)
    {
        var stages = new List<(string, int)>(8)
        {
            (FetchProvince, 2),
            (WriteProvince, 1),
        };
        if (depth >= WilayahSyncDepth.Regency)
        {
            stages.Add((FetchCity, 6));
            stages.Add((WriteCity, 1));
        }

        if (depth >= WilayahSyncDepth.District)
        {
            stages.Add((FetchDistrict, 16));
            stages.Add((WriteDistrict, 2));
        }

        if (depth >= WilayahSyncDepth.Village)
        {
            stages.Add((FetchVillage, 64));
            stages.Add((WriteVillage, 8));
        }

        return new WilayahSyncProgressPlan(stages.ToArray());
    }

    /// <summary>
    /// Overall 0–100 for <paramref name="done"/>/<paramref name="total"/> inside <paramref name="stageKey"/>.
    /// A stage with <paramref name="total"/> ≤ 0 is treated as complete.
    /// </summary>
    public int Percent(string stageKey, int done, int total)
    {
        if (!_index.TryGetValue(stageKey, out var index))
        {
            throw new ArgumentOutOfRangeException(nameof(stageKey), stageKey, "Unknown sync stage.");
        }

        var before = 0;
        for (var i = 0; i < index; i++)
        {
            before += _stages[i].Weight;
        }

        var fraction = total <= 0 ? 1d : Math.Clamp(done / (double)total, 0d, 1d);
        var overall = 100d * (before + (_stages[index].Weight * fraction)) / _totalWeight;
        return Math.Clamp((int)Math.Round(overall, MidpointRounding.AwayFromZero), 0, 100);
    }

    /// <summary>
    /// Throttle in-flight reports: first, last, and about once per percent of the current stage.
    /// </summary>
    public static bool ShouldPublish(int done, int total)
    {
        if (done <= 1 || done == total)
        {
            return true;
        }

        if (total <= 0)
        {
            return true;
        }

        var stride = Math.Max(1, total / 100);
        return done % stride == 0;
    }
}
