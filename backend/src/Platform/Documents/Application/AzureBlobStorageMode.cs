namespace SisTemplate.Platform.Documents.Application;

public static class AzureBlobStorageMode
{
    public static readonly IReadOnlyDictionary<string, string> DefaultContainers =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["platformUser"] = "app-platform-users",
        };

    public static bool ShouldUseLocal(bool? configured, string? environmentName)
    {
        if (!string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return configured ?? true;
    }
}
