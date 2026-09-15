namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed record CreateInvitationResult(
    InvitationDto Invitation,
    string InvitationCode,
    string RegistrationUrl);
