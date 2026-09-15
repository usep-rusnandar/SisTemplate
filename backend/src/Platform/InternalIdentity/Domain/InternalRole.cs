using SisTemplate.BuildingBlocks.Domain.Entities;

namespace SisTemplate.Platform.InternalIdentity.Domain;

public sealed class InternalRole : Entity
{
    private InternalRole()
    {
    }

    private InternalRole(Guid id, string code, string name, string? moduleKey, bool isSystem)
        : base(id)
    {
        Code = code;
        Name = name;
        ModuleKey = moduleKey;
        IsSystem = isSystem;
    }

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string? ModuleKey { get; private set; }

    public bool IsSystem { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public void Update(string name, string? moduleKey = null, bool? isSystem = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        Name = name.Trim();

        // null = "not supplied, keep what is stored" (same contract as isSystem below); pass an empty
        // string to deliberately clear the module scope. A partial update from an admin screen must
        // never silently un-scope a role just because it did not send the field.
        if (moduleKey is not null)
        {
            ModuleKey = string.IsNullOrWhiteSpace(moduleKey) ? null : moduleKey.Trim();
        }

        if (isSystem.HasValue)
        {
            IsSystem = isSystem.Value;
        }
    }

    public static InternalRole Create(string code, string name, string? moduleKey = null, bool isSystem = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        return new InternalRole(Guid.NewGuid(), code.Trim(), name.Trim(), moduleKey?.Trim(), isSystem);
    }
}
