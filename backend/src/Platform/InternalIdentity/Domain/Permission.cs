using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Platform.InternalIdentity.Domain;

public sealed class PermissionDefinition : Entity
{
    private PermissionDefinition()
    {
    }

    private PermissionDefinition(Guid id, string key, string moduleKey, string name, string? description)
        : base(id)
    {
        Key = key;
        ModuleKey = moduleKey;
        Name = name;
        Description = description;
    }

    public string Key { get; private set; } = string.Empty;

    public string ModuleKey { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public static PermissionDefinition Create(string key, string moduleKey, string name, string? description = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        ArgumentException.ThrowIfNullOrWhiteSpace(moduleKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        return new PermissionDefinition(Guid.NewGuid(), key.Trim(), moduleKey.Trim(), name.Trim(), description?.Trim());
    }
}
