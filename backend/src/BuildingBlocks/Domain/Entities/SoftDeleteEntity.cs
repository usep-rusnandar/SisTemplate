namespace IntegratedProcurement.BuildingBlocks.Domain.Entities;

public abstract class SoftDeleteEntity : AuditableEntity
{
    protected SoftDeleteEntity()
    {
    }

    protected SoftDeleteEntity(Guid id)
        : base(id)
    {
    }

    public DateTimeOffset? DeletedAt { get; protected set; }

    public string? DeletedBy { get; protected set; }

    public bool IsDeleted => DeletedAt.HasValue;
}
