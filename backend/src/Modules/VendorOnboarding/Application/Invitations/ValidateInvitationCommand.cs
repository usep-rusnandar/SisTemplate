namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed record ValidateInvitationCommand(
    string InvitationCode,
    string? Email,
    string? IpAddress,
    string? UserAgent);
