namespace IntegratedProcurement.BuildingBlocks.Domain.Entities;

public abstract class AuditableEntity : Entity, IAuditable
{
    protected AuditableEntity()
    {
    }

    protected AuditableEntity(Guid id)
        : base(id)
    {
    }

    public DateTimeOffset CreatedAt { get; protected set; }

    public string? CreatedBy { get; protected set; }

    public DateTimeOffset? UpdatedAt { get; protected set; }

    public string? UpdatedBy { get; protected set; }
}
