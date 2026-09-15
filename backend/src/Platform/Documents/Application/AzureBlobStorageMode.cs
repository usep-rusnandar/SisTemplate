namespace IntegratedProcurement.Platform.Documents.Application;

/// <summary>
/// Resolves whether Development should skip Azure Blob and store documents on disk.
/// Staging and Production are hard-locked to Azure regardless of configuration.
/// </summary>
public static class AzureBlobStorageMode
{
    public static readonly IReadOnlyDictionary<string, string> DefaultContainers =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["proposalTracker"] = "app-proposaltracker",
            ["contractInitiationPlatform"] = "app-contractmanagement",
            ["contractMonitoring"] = "app-contractmanagement",
            ["vendorOnboarding"] = "app-vendormanagement",
            ["platformUser"] = "app-platform-users",
        };

    /// <summary>
    /// Development defaults to local disk. An explicit <c>false</c> keeps Azure in Development.
    /// Any other environment (Staging, Production, tests that rename the host) always uses Azure.
    /// </summary>
    public static bool ShouldUseLocal(bool? configured, string? environmentName)
    {
        if (!string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return configured ?? true;
    }
}
