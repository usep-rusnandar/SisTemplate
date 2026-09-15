namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed record CreateInvitationCommand(
    string Email,
    string VendorName,
    string PicName,
    string? Category,
    string? VendorId,
    DateTimeOffset? ExpiredAt,
    string? Note);
