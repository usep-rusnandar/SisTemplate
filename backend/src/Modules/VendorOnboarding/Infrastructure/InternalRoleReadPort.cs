using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Platform.InternalIdentity.Application.Directory;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>
/// Role lookups for the approval chain, backed by Internal Identity's published directory port.
/// </summary>
internal sealed class InternalRoleReadPort : IInternalRoleReadPort
{
    private readonly IInternalDirectoryReadPort _directory;

    public InternalRoleReadPort(IInternalDirectoryReadPort directory) => _directory = directory;

    public Task<IReadOnlyList<string>> GetActorRoleCodesAsync(
        string actorId,
        CancellationToken cancellationToken) =>
        _directory.GetRoleCodesForActorAsync(actorId, cancellationToken);

    public Task<IReadOnlyDictionary<string, string>> GetRoleNamesAsync(CancellationToken cancellationToken) =>
        _directory.GetRoleNamesByCodeAsync(cancellationToken);
}
