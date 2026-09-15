namespace SisTemplate.BuildingBlocks.Application.Abstractions;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
