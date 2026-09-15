namespace SisTemplate.Platform.Administration.Application;

/// <summary>
/// Application-facing façade over the region-sync runtime: exposes the current status snapshot and the
/// ability to request an ad-hoc (manual) run. Lets the API layer read status and trigger a sync without
/// depending on the Infrastructure implementation (which additionally owns the run lifecycle internals).
/// </summary>
public interface IWilayahSyncCoordinator
{
    /// <summary>Current immutable status snapshot (phase, last-success time, live counts, …).</summary>
    WilayahSyncSnapshot Current { get; }

    /// <summary>Requests an ad-hoc sync run. Coalesced when a run is already pending or in progress.</summary>
    void RequestRun();
}
