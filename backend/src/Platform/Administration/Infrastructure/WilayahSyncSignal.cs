using System.Threading.Channels;
using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

/// <summary>
/// Process-wide coordination point for the region sync. Holds the current status snapshot (shared
/// between the scoped <see cref="WilayahSyncService"/> that mutates it and the API endpoint that reads
/// it) and a one-slot signal the background runner waits on for ad-hoc (manual) triggers.
/// </summary>
public sealed class WilayahSyncSignal : IWilayahSyncCoordinator
{
    private readonly object _gate = new();

    // Bounded, coalescing wake-up channel (same pattern as ImportJobSignal): repeated RequestRun calls
    // collapse into a single pending trigger, so the runner does exactly one run per burst.
    private readonly Channel<byte> _trigger = Channel.CreateBounded<byte>(
        new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite });

    private WilayahSyncSnapshot _snapshot;

    public WilayahSyncSignal()
    {
        _snapshot = WilayahSyncSnapshot.Initial(enabled: true);
    }

    public WilayahSyncSnapshot Current
    {
        get { lock (_gate) { return _snapshot; } }
    }

    /// <summary>Wakes the background runner to start a sync now. Coalesces repeated calls into one pending run.</summary>
    public void RequestRun() => _trigger.Writer.TryWrite(0);

    /// <summary>Waits up to <paramref name="timeout"/> for a manual trigger. Returns true if triggered,
    /// false if the timeout elapsed first. Propagates cancellation of <paramref name="cancellationToken"/>.</summary>
    public async Task<bool> WaitForTriggerAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);
        try
        {
            await _trigger.Reader.ReadAsync(timeoutCts.Token);
            return true;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Only the timeout linked-token fired — a genuine "no trigger within the wait window".
            return false;
        }
    }

    public void SetEnabled(bool enabled) =>
        Mutate(current => current with { Enabled = enabled });

    /// <summary>Overwrites the snapshot on startup from persisted state (last success time / counts).</summary>
    public void Hydrate(WilayahSyncSnapshot snapshot)
    {
        lock (_gate)
        {
            _snapshot = snapshot;
        }
    }

    public void BeginRun(string trigger, DateTimeOffset startedAt) =>
        Mutate(current => current with
        {
            Phase = WilayahSyncPhase.Running,
            Trigger = trigger,
            StartedAt = startedAt,
            FinishedAt = null,
            Provinces = 0,
            Regencies = 0,
            Districts = 0,
            Villages = 0,
            CurrentStep = "Starting…",
            StepKey = null,
            ProgressPercent = 0,
            ProgressDone = 0,
            ProgressTotal = 0,
            Error = null,
        });

    public void ReportStep(string step) =>
        Mutate(current => current with { CurrentStep = step });

    public void ReportProgress(int percent, int done, int total, string step, string? stepKey = null) =>
        Mutate(current => current with
        {
            CurrentStep = step,
            StepKey = stepKey ?? current.StepKey,
            ProgressPercent = Math.Clamp(percent, 0, 100),
            ProgressDone = Math.Max(0, done),
            ProgressTotal = Math.Max(0, total),
        });

    public void ReportCounts(int? provinces = null, int? regencies = null, int? districts = null, int? villages = null) =>
        Mutate(current => current with
        {
            Provinces = provinces ?? current.Provinces,
            Regencies = regencies ?? current.Regencies,
            Districts = districts ?? current.Districts,
            Villages = villages ?? current.Villages,
        });

    public void CompleteSuccess(WilayahSyncResult result) =>
        Mutate(current => current with
        {
            Phase = WilayahSyncPhase.Succeeded,
            FinishedAt = result.FinishedAt,
            LastSuccessAt = result.FinishedAt,
            Provinces = result.Provinces,
            Regencies = result.Regencies,
            Districts = result.Districts,
            Villages = result.Villages,
            CurrentStep = result.DatasetUnchanged ? "Source dataset unchanged" : "Completed",
            StepKey = result.DatasetUnchanged ? "skip-unchanged" : current.StepKey,
            ProgressPercent = 100,
            Error = null,
            SourceUpdatedAt = result.SourceUpdatedAt ?? current.SourceUpdatedAt,
        });

    public void CompleteFailure(string error, DateTimeOffset finishedAt) =>
        Mutate(current => current with
        {
            Phase = WilayahSyncPhase.Failed,
            FinishedAt = finishedAt,
            CurrentStep = "Failed",
            Error = error,
        });

    private void Mutate(Func<WilayahSyncSnapshot, WilayahSyncSnapshot> transform)
    {
        lock (_gate)
        {
            _snapshot = transform(_snapshot);
        }
    }
}
