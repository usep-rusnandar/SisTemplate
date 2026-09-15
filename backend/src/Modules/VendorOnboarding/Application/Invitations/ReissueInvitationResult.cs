namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed record ReissueInvitationResult(
    InvitationDto Invitation,
    string InvitationCode,
    string RegistrationUrl);
