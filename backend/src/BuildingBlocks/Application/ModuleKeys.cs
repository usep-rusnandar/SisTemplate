namespace IntegratedProcurement.BuildingBlocks.Application;

public static class ModuleKeys
{
    public const string Administration = "administration";
    public const string Audit = "audit";
    public const string Documents = "documents";
    public const string InternalIdentity = "internalIdentity";
    public const string Notifications = "notifications";
    public const string Settings = "settings";
    public const string MasterData = "masterData";
    public const string SuperAdmin = "superAdmin";
    // Example pattern for future feature modules:
    // public const string Example = "example";

    public static class Slugs
    {
        public const string Administration = "administration";
        public const string Audit = "audit";
        public const string Documents = "documents";
        public const string InternalIdentity = "internal-identity";
        public const string Notifications = "notifications";
        public const string Settings = "settings";
        public const string MasterData = "master-data";
        public const string SuperAdmin = "super-admin";
    }

    private static readonly Dictionary<string, string> SlugToKey = new(StringComparer.OrdinalIgnoreCase)
    {
        [Slugs.Administration] = Administration,
        [Slugs.Audit] = Audit,
        [Slugs.Documents] = Documents,
        [Slugs.InternalIdentity] = InternalIdentity,
        [Slugs.Notifications] = Notifications,
        [Slugs.Settings] = Settings,
        [Slugs.MasterData] = MasterData,
        [Slugs.SuperAdmin] = SuperAdmin,
    };

    public static string? KeyForSlug(string? slug) =>
        slug is not null && SlugToKey.TryGetValue(slug, out var key) ? key : null;

    public static IReadOnlyCollection<string> All =>
    [
        Administration,
        Audit,
        Documents,
        InternalIdentity,
        Notifications,
        Settings,
        MasterData,
        SuperAdmin,
    ];
}
