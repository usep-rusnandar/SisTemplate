namespace IntegratedProcurement.Platform.Administration.Application;

/// <summary>
/// Full-replace of a hierarchy level is only safe when every parent request completed
/// (HTTP 200 or 404). Any leftover failure after retries must keep the existing rows.
/// </summary>
public static class WilayahSyncCompleteness
{
    public static bool CanReplace(int failedParents) => failedParents <= 0;

    public static string IncompleteMessage(string level, int failedParents, int parentCount) =>
        $"{level} fetch incomplete: {failedParents}/{parentCount} parent requests failed after retries; existing {level} data kept.";
}
