namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Domain;

/// <summary>
/// Maps a CIP workflow stage to its canonical in-flight status. Reaching Final Contract does not
/// mean the Contract activity is complete; the completion command explicitly sets approved.
/// </summary>
public static class CipStagePolicy
{
    public static string StatusForStage(string stage) =>
        stage == "loa" ? "intake" : "inprogress";
}
