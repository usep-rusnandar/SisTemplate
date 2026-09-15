namespace SisTemplate.BuildingBlocks.Domain.Events;

public abstract record DomainEvent(DateTimeOffset OccurredAt);
