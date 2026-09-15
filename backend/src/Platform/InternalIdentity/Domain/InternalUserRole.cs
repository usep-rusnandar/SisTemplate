using SisTemplate.BuildingBlocks.Domain.Entities;

namespace SisTemplate.Platform.InternalIdentity.Domain;

public sealed class InternalUserRole : Entity
{
    private InternalUserRole()
    {
    }

    private InternalUserRole(Guid id, Guid userId, Guid roleId)
        : base(id)
    {
        UserId = userId;
        RoleId = roleId;
    }

    public Guid UserId { get; private set; }

    public Guid RoleId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static InternalUserRole Create(Guid userId, Guid roleId)
    {
        return new InternalUserRole(Guid.NewGuid(), userId, roleId);
    }
}
