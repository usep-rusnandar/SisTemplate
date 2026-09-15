using IntegratedProcurement.BuildingBlocks.Domain.Events;

namespace IntegratedProcurement.BuildingBlocks.Domain.Entities;

public abstract class Entity
{
    private readonly List<DomainEvent> _domainEvents = [];

    protected Entity()
    {
    }

    protected Entity(Guid id)
    {
        Id = id;
    }

    public Guid Id { get; protected set; }

    public IReadOnlyCollection<DomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void Raise(DomainEvent domainEvent) => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}
