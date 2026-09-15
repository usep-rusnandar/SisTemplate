using SisTemplate.BuildingBlocks.Domain.Entities;

namespace SisTemplate.Platform.InternalIdentity.Domain;

public sealed class InternalRolePermissionAssignment : Entity
{
    private InternalRolePermissionAssignment()
    {
    }

    private InternalRolePermissionAssignment(Guid id, Guid roleId, Guid permissionId)
        : base(id)
    {
        RoleId = roleId;
        PermissionId = permissionId;
    }

    public Guid RoleId { get; private set; }

    public Guid PermissionId { get; private set; }

    public static InternalRolePermissionAssignment Create(Guid roleId, Guid permissionId)
    {
        return new InternalRolePermissionAssignment(Guid.NewGuid(), roleId, permissionId);
    }
}
