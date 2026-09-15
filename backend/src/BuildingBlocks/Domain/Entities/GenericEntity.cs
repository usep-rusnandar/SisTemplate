using IntegratedProcurement.BuildingBlocks.Domain.Events;

namespace IntegratedProcurement.BuildingBlocks.Domain.Entities;

/// <summary>Audit-stamped marker; ProcurementDbContext stamps Created*/Updated* for any entity implementing this.</summary>
public interface IAuditable
{
    DateTimeOffset CreatedAt { get; }

    string? CreatedBy { get; }

    DateTimeOffset? UpdatedAt { get; }

    string? UpdatedBy { get; }
}

/// <summary>
/// Generic-key variant of <see cref="Entity"/> for aggregates whose primary key follows a legacy
/// schema (string codes, int identity columns) instead of the default Guid.
/// </summary>
public abstract class Entity<TId>
{
    private readonly List<DomainEvent> _domainEvents = [];

    protected Entity()
    {
    }

    protected Entity(TId id)
    {
        Id = id;
    }

    public TId Id { get; protected set; } = default!;

    public IReadOnlyCollection<DomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void Raise(DomainEvent domainEvent) => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}

public abstract class AuditableEntity<TId> : Entity<TId>, IAuditable
{
    protected AuditableEntity()
    {
    }

    protected AuditableEntity(TId id)
        : base(id)
    {
    }

    public DateTimeOffset CreatedAt { get; protected set; }

    public string? CreatedBy { get; protected set; }

    public DateTimeOffset? UpdatedAt { get; protected set; }

    public string? UpdatedBy { get; protected set; }
}

public abstract class SoftDeleteEntity<TId> : AuditableEntity<TId>
{
    protected SoftDeleteEntity()
    {
    }

    protected SoftDeleteEntity(TId id)
        : base(id)
    {
    }

    public DateTimeOffset? DeletedAt { get; protected set; }

    public string? DeletedBy { get; protected set; }

    public bool IsDeleted => DeletedAt.HasValue;
}
