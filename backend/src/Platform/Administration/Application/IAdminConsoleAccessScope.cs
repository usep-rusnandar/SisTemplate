namespace SisTemplate.Platform.Administration.Application;

/// <summary>
/// Resolves the Administration boundary for the current actor. Super Admin is unrestricted;
/// module-scoped administrators may only read and mutate users and roles that belong to one of
/// their assigned role modules.
/// </summary>
public interface IAdminConsoleAccessScope
{
    Task<AdminConsoleAccessScope> GetCurrentAsync(CancellationToken cancellationToken);
}

public sealed record AdminConsoleAccessScope(
    bool IsUnrestricted,
    IReadOnlyCollection<string> ModuleKeys)
{
    public static AdminConsoleAccessScope Unrestricted { get; } = new(true, []);

    public static AdminConsoleAccessScope Restricted(IReadOnlyCollection<string> moduleKeys) =>
        new(false, moduleKeys);
}
