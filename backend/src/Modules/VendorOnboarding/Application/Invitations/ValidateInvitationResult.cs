namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed record ValidateInvitationResult(
    bool IsValid,
    string? FailureReason,
    InvitationDto? Invitation);
