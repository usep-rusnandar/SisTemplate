using System.Threading.Channels;

namespace IntegratedProcurement.AppHost.Api.Services;

/// <summary>
/// In-process wake-up signal for the import-job runner. Lets the runner park (no DB polling) while idle
/// and resume the instant a job is created/retried/resumed. Coalescing: many notifies collapse into one
/// pending wake-up, so the runner does exactly one drain pass per burst.
/// </summary>
public sealed class ImportJobSignal
{
    private readonly Channel<byte> _channel = Channel.CreateBounded<byte>(
        new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite });

    /// <summary>Wake the runner (no-op if a wake-up is already pending).</summary>
    public void Notify() => _channel.Writer.TryWrite(0);

    /// <summary>Block until the next <see cref="Notify"/> (or cancellation).</summary>
    public async Task WaitAsync(CancellationToken cancellationToken) =>
        await _channel.Reader.ReadAsync(cancellationToken);
}
