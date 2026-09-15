using IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>
/// Vendor Onboarding emails (invitation, submission, review). Templates are admin-editable;
/// sending is best-effort so a mail failure never blocks the originating action.
/// </summary>
public interface IVendorOnboardingMailer
{
    Task NotifyInvitationAsync(
        InvitationDto invitation,
        string invitationCode,
        string registrationUrl,
        CancellationToken cancellationToken);

    Task NotifySubmissionAsync(SaveVendorProfileResult result, CancellationToken cancellationToken);

    Task NotifyReviewActionAsync(
        string vendorId,
        string verb,
        VendorReviewResult result,
        string? reason,
        CancellationToken cancellationToken);
}
