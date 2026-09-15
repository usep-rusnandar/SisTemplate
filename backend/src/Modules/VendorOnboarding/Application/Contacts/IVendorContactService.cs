namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Contacts;

public interface IVendorContactService
{
    Task<IReadOnlyList<VendorContactDto>> ListAsync(string? search, string? role, CancellationToken cancellationToken);

    Task<IReadOnlyList<VendorContactVendorOptionDto>> ListVendorsAsync(CancellationToken cancellationToken);

    Task<VendorContactMutationResult> CreateAsync(VendorContactWriteRequest request, CancellationToken cancellationToken);

    Task<VendorContactMutationResult> UpdateAsync(Guid contactId, VendorContactWriteRequest request, CancellationToken cancellationToken);

    Task<VendorContactMutationResult> SetWorkspacePicAsync(Guid contactId, CancellationToken cancellationToken);

    Task<VendorContactMutationResult> SetPasswordAsync(Guid contactId, string? newPassword, CancellationToken cancellationToken);

    Task<VendorContactMutationResult> DeleteAsync(Guid contactId, CancellationToken cancellationToken);
}

public sealed record VendorContactDto(
    Guid Id,
    string VendorId,
    string VendorName,
    string IdentityUserId,
    string Name,
    string? Email,
    string? Phone,
    string? Position,
    string Status,
    bool IsActive,
    bool HasLogin,
    bool IsWorkspacePic);

public sealed record VendorContactVendorOptionDto(string Id, string Name, string Status);

public sealed record VendorContactWriteRequest(
    string? VendorId,
    string? Name,
    string? Email,
    string? Phone,
    string? Status,
    bool IsWorkspacePic,
    string? Position = null);

public sealed record VendorContactSetPasswordRequest(string? NewPassword);

public sealed record VendorContactMutationResult(bool Succeeded, string? Code, string? Message, VendorContactDto? Contact)
{
    public static VendorContactMutationResult Ok(VendorContactDto? contact) => new(true, null, null, contact);

    public static VendorContactMutationResult Fail(string code, string message) => new(false, code, message, null);
}
