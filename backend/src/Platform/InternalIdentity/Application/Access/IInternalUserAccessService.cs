namespace IntegratedProcurement.Platform.InternalIdentity.Application.Access;

public interface IInternalUserAccessService
{
    Task<InternalUserAccess?> FindActiveByPersonnelNoAsync(
        string personnelNo,
        CancellationToken cancellationToken = default);

    Task<bool> HasAccessAsync(string personnelNo, CancellationToken cancellationToken = default);

    /// <summary>Effective permission keys for a personnel number (union of all its roles' permissions).</summary>
    Task<IReadOnlyList<string>> GetEffectivePermissionsAsync(string personnelNo, CancellationToken cancellationToken = default);
}
