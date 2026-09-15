namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed record RegisterVendorResult(
    string VendorId,
    Guid VendorUserId,
    string IdentityUserId,
    Guid InvitationId,
    string Email,
    string VendorName,
    string Role);
