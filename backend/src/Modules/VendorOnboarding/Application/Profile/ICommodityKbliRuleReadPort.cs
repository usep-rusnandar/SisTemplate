namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

/// <summary>
/// Reads the KBLI requirement rule (DNF: OR of AND-groups) for each commodity sub-classification.
/// </summary>
public interface ICommodityKbliRuleReadPort
{
    /// <summary>
    /// Returns a map of SubClassificationId → DNF groups. Empty groups / missing key = no KBLI required.
    /// </summary>
    Task<IReadOnlyDictionary<string, IReadOnlyList<IReadOnlyList<string>>>> GetRulesBySubClassificationAsync(
        CancellationToken cancellationToken);
}
