namespace IntegratedProcurement.BuildingBlocks.Application;

public sealed record MasterDataScreen(
    string Id,
    string Name,
    string DefaultModule,
    IReadOnlyList<string> SetKeys)
{
    public string ViewPermission => $"masterData.{Id}.view";
    public string ManagePermission => $"masterData.{Id}.manage";
    public string ModuleViewPermission => $"masterData.{DefaultModule}.view";
    public string ModuleManagePermission => $"masterData.{DefaultModule}.manage";
}

public static class MasterDataScreens
{
    public static IReadOnlyList<MasterDataScreen> All { get; } =
    [
        new("holiday", "Holiday", ModuleKeys.Administration, ["holiday"]),
        new("country", "Country", ModuleKeys.Administration, ["country"]),
        new("administrativeRegions", "Administrative Regions", ModuleKeys.Administration,
            ["province", "city", "district", "village"]),
    ];

    private static readonly Dictionary<string, MasterDataScreen> BySet =
        All.SelectMany(screen => screen.SetKeys.Select(setKey => (setKey, screen)))
            .ToDictionary(pair => pair.setKey, pair => pair.screen, StringComparer.OrdinalIgnoreCase);

    public static MasterDataScreen? ForSet(string? setKey) =>
        setKey is not null && BySet.TryGetValue(setKey.Trim(), out var screen) ? screen : null;

    public static MasterDataScreen? ById(string? screenId) =>
        screenId is null
            ? null
            : All.FirstOrDefault(screen => string.Equals(screen.Id, screenId.Trim(), StringComparison.OrdinalIgnoreCase));

    public static IEnumerable<string> PermissionKeys =>
        All.SelectMany(screen => new[] { screen.ViewPermission, screen.ManagePermission });
}

