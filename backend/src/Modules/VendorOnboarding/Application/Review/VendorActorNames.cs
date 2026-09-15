namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>
/// Resolves the actor keys stored in the vendor status trail to display names. One place for the whole
/// rule, because the trail mixes three kinds of key:
/// <list type="bullet">
/// <item>an internal user's personnel number (or their Guid, for older rows);</item>
/// <item>a vendor portal account id — which for a vendor's primary account IS the vendor id, by the
/// legacy convention in <c>VendorInvitationService</c>;</item>
/// <item>a vendor id with no portal account at all, for vendors created by import.</item>
/// </list>
/// </summary>
public interface IVendorActorNameReadPort
{
    /// <summary>Names for the keys that could be resolved; unknown keys are simply absent.</summary>
    Task<IReadOnlyDictionary<string, string>> ResolveAsync(
        IReadOnlyCollection<string?> actorKeys,
        CancellationToken cancellationToken);
}
