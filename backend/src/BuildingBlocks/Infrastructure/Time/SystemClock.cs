using IntegratedProcurement.BuildingBlocks.Application.Abstractions;

namespace IntegratedProcurement.BuildingBlocks.Infrastructure.Time;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
