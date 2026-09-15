using System.Globalization;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.InternalIdentity.Application.Directory;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Notifications;

public sealed class VendorOnboardingMailer : IVendorOnboardingMailer
{
    public const string ApprovalRequestTemplateId = "ET-21";
    public const string FinalApprovalRequestTemplateId = "ET-22";
    public const string RevisionResubmittedAdminTemplateId = "ET-23";
    public const string ApprovedAdminTemplateId = "ET-24";
    public const string VendorAdministratorRoleCode = "ADM-VDR";

    private readonly ProcurementDbContext _db;
    private readonly IInternalDirectoryReadPort _directory;
    private readonly IAdminConsoleCommunicationService _communication;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _configuration;

    public VendorOnboardingMailer(
        ProcurementDbContext db,
        IInternalDirectoryReadPort directory,
        IAdminConsoleCommunicationService communication,
        IEmailSender emailSender,
        IConfiguration configuration)
    {
        _db = db;
        _directory = directory;
        _communication = communication;
        _emailSender = emailSender;
        _configuration = configuration;
    }

    public Task NotifyInvitationAsync(
        InvitationDto invitation,
        string invitationCode,
        string registrationUrl,
        CancellationToken cancellationToken) =>
        TrySendAsync(
            "ET-12",
            invitation.Email,
            new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                ["vendorName"] = invitation.VendorName,
                ["registerUrl"] = registrationUrl,
                ["code"] = invitationCode,
                ["expiryDate"] = invitation.ExpiredAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["contact"] = SupportEmail(),
            },
            cancellationToken);

    public async Task NotifySubmissionAsync(SaveVendorProfileResult result, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(result.ApproverRoleCode))
        {
            return;
        }

        var contact = await GetVendorContactAsync(result.VendorId, cancellationToken);
        var submissionDate = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var common = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["vendorId"] = result.VendorId,
            ["vendorName"] = result.VendorName,
            ["submittedBy"] = contact.Name ?? result.VendorName,
            ["submissionDate"] = submissionDate,
            ["status"] = result.Status,
            ["portalUrl"] = VendorPortalUrl(),
            ["approvalUrl"] = InternalPortalUrl(),
            ["contact"] = SupportEmail(),
        };

        await TrySendAsync("ET-13", contact.Email, common, cancellationToken);
        await NotifyRoleAsync(
            ApprovalRequestTemplateId,
            result.ApproverRoleCode,
            common,
            "approverName",
            cancellationToken);

        if (string.Equals(result.PreviousStatus, VendorStatuses.Repair, StringComparison.OrdinalIgnoreCase))
        {
            await NotifyRoleAsync(
                RevisionResubmittedAdminTemplateId,
                VendorAdministratorRoleCode,
                common,
                "adminName",
                cancellationToken);
        }
    }

    public async Task NotifyReviewActionAsync(
        string vendorId,
        string verb,
        VendorReviewResult result,
        string? reason,
        CancellationToken cancellationToken)
    {
        var tokens = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["vendorId"] = vendorId,
            ["vendorName"] = result.VendorName,
            ["reason"] = reason,
            ["portalUrl"] = VendorPortalUrl(),
            ["contact"] = SupportEmail(),
            ["date"] = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        };

        // Intermediate approval advances to the next internal queue. Only final approval (APPRV)
        // tells the vendor that registration has been approved.
        if (verb == "approve" && result.Status != VendorStatuses.Approved)
        {
            var nextApproverTokens = tokens.ToDictionary(
                pair => pair.Key,
                pair => pair.Value,
                StringComparer.OrdinalIgnoreCase);
            nextApproverTokens["submissionDate"] = DateTimeOffset.UtcNow.ToString(
                "yyyy-MM-dd", CultureInfo.InvariantCulture);
            nextApproverTokens["approvalUrl"] = InternalPortalUrl();
            if (!string.IsNullOrWhiteSpace(result.NextApproverRoleCode))
            {
                await NotifyRoleAsync(
                    result.NextApprovalIsFinal
                        ? FinalApprovalRequestTemplateId
                        : ApprovalRequestTemplateId,
                    result.NextApproverRoleCode,
                    nextApproverTokens,
                    "approverName",
                    cancellationToken);
            }

            return;
        }

        await TrySendAsync(TemplateIdForVerb(verb), result.ContactEmail, tokens, cancellationToken);

        if (verb == "approve" && result.Status == VendorStatuses.Approved)
        {
            var administratorTokens = tokens.ToDictionary(
                pair => pair.Key,
                pair => pair.Value,
                StringComparer.OrdinalIgnoreCase);
            administratorTokens["approvalDate"] = DateTimeOffset.UtcNow.ToString(
                "yyyy-MM-dd", CultureInfo.InvariantCulture);
            await NotifyRoleAsync(
                ApprovedAdminTemplateId,
                VendorAdministratorRoleCode,
                administratorTokens,
                "adminName",
                cancellationToken);
        }
    }

    private static string? TemplateIdForVerb(string verb) => verb switch
    {
        "approve" => "ET-17",
        "reject" => "ET-18",
        "request-revision" => "ET-19",
        _ => null,
    };

    private async Task NotifyRoleAsync(
        string templateId,
        string roleCode,
        IReadOnlyDictionary<string, string?> tokens,
        string recipientNameToken,
        CancellationToken cancellationToken)
    {
        var sharedTokens = tokens.ToDictionary(
            pair => pair.Key,
            pair => pair.Value,
            StringComparer.OrdinalIgnoreCase);
        if (!sharedTokens.ContainsKey("submittedBy")
            && sharedTokens.TryGetValue("vendorId", out var vendorId)
            && !string.IsNullOrWhiteSpace(vendorId))
        {
            var contact = await GetVendorContactAsync(vendorId, cancellationToken);
            sharedTokens["submittedBy"] = contact.Name;
        }

        var recipients = await _directory.ListActiveRecipientsByRoleCodeAsync(roleCode, cancellationToken);
        foreach (var recipient in recipients)
        {
            var recipientTokens = sharedTokens.ToDictionary(
                pair => pair.Key,
                pair => pair.Value,
                StringComparer.OrdinalIgnoreCase);
            recipientTokens[recipientNameToken] = recipient.CompleteName;
            await TrySendAsync(templateId, recipient.Email, recipientTokens, cancellationToken);
        }
    }

    private Task<bool> TrySendAsync(
        string? templateId,
        string? toEmail,
        IReadOnlyDictionary<string, string?> tokens,
        CancellationToken cancellationToken) =>
        EmailTemplateNotifier.TrySendAsync(
            templateId,
            toEmail,
            tokens,
            _communication,
            _emailSender,
            "Vendor Onboarding",
            cancellationToken,
            Defaults);

    private async Task<(string? Email, string? Name)> GetVendorContactAsync(
        string vendorId,
        CancellationToken cancellationToken)
    {
        var contact = await (
            from link in _db.VendorUsers.AsNoTracking()
            join user in _db.Users.AsNoTracking() on link.IdentityUserId equals user.Id
            where link.VendorId == vendorId
            orderby user.Id
            select new { user.Email, user.CompleteName })
            .FirstOrDefaultAsync(cancellationToken);

        return (contact?.Email, contact?.CompleteName);
    }

    private string VendorPortalUrl() =>
        FrontendPortalUrls.FirstAbsolute(
            _configuration["Frontend:VendorUrl"],
            _configuration["VendorRegistration:RegistrationUrl"]);

    private string InternalPortalUrl() =>
        FrontendPortalUrls.FirstAbsolute(
            _configuration["Frontend:InternalUrl"],
            _configuration["SSO:ApplicationUrl"]);

    private string SupportEmail() =>
        FrontendPortalUrls.SupportContact(_configuration["VendorRegistration:SupportEmail"]);

    private static (string Subject, string Body)? Defaults(string templateId) => templateId switch
    {
        "ET-12" => ("You're invited to register as an Alamtri vendor",
            "Hello {vendorName},\n\nYou have been invited to register as a vendor for Alamtri Geo. Use the secure link below to create your company profile. This invitation is valid until {expiryDate}.\n\n{registerUrl}\n\nInvitation code: {code}\n\nRegistration is by invitation only — please do not share this link. If you did not expect this invitation, contact {contact}."),
        "ET-13" => ("We received your vendor registration",
            "Hello {vendorName},\n\nThank you — your vendor registration has been submitted to Alamtri Procurement for review. We will email you once your account is approved.\n\nReference: {code}\n\nNo further action is needed right now."),
        "ET-17" => ("Your vendor registration is approved",
            "Hello {vendorName},\n\nGood news — your vendor registration has been approved by Alamtri Procurement as of {date}. You can sign in to your Vendor Workspace to keep your profile and documents up to date."),
        "ET-18" => ("Your vendor registration was not approved",
            "Hello {vendorName},\n\nAfter review, your registration has not been approved at this time.\n\nReason: {reason}\n\nIf you have questions, please contact {contact}."),
        "ET-19" => ("Action needed: please revise your vendor registration",
            "Hello {vendorName},\n\nAlamtri Procurement needs some changes before your registration can be approved.\n\nWhat to revise: {reason}\n\nPlease sign in to your Vendor Workspace, update the requested items, and submit again."),
        "ET-21" => ("Vendor registration awaiting your approval",
            "Hello {approverName},\n\n{vendorName} has reached {status} and is waiting for your approval.\n\nOpen Vendor Approval to review the complete vendor dossier and status history:\n{approvalUrl}"),
        "ET-22" => ("Final vendor approval required",
            "Hello {approverName},\n\n{vendorName} has passed the previous review stages and now requires your final approval.\n\nOpen Vendor Approval:\n{approvalUrl}"),
        "ET-23" => ("Vendor revised data is ready for review",
            "Hello {adminName},\n\n{vendorName} ({vendorId}) has resubmitted the requested data and documents on {submissionDate}. Please continue the verification process in Vendor Approval.\n\n{approvalUrl}"),
        "ET-24" => ("Vendor status updated to Approved",
            "Hello {adminName},\n\n{vendorName} ({vendorId}) was approved on {approvalDate}. This notification is provided for monitoring, documentation, and any required follow-up action."),
        _ => ("Vendor registration update", "Hello {vendorName},\n\nThere is an update to your vendor registration."),
    };
}
