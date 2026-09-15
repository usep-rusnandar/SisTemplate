using SisTemplate.BuildingBlocks.Application.Abstractions;

namespace SisTemplate.BuildingBlocks.Infrastructure.Time;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
