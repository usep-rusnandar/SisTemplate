using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

public sealed class InvitationAttempt : Entity
{
    private InvitationAttempt()
    {
    }

    private InvitationAttempt(
        Guid? invitationId,
        string? email,
        string? codeMasked,
        string? ipAddress,
        string? userAgent,
        string result,
        string? reason,
        DateTimeOffset attemptedAt)
        : base(Guid.NewGuid())
    {
        InvitationId = invitationId;
        Email = email;
        CodeMasked = codeMasked;
        IpAddress = ipAddress;
        UserAgent = userAgent;
        Result = result;
        Reason = reason;
        AttemptedAt = attemptedAt;
    }

    public Guid? InvitationId { get; private set; }

    public string? Email { get; private set; }

    public string? CodeMasked { get; private set; }

    public string? IpAddress { get; private set; }

    public string? UserAgent { get; private set; }

    public string Result { get; private set; } = InvitationAttemptResults.Failure;

    public string? Reason { get; private set; }

    public DateTimeOffset AttemptedAt { get; private set; }

    public static InvitationAttempt Success(
        Guid invitationId,
        string email,
        string codeMasked,
        string? ipAddress,
        string? userAgent,
        DateTimeOffset attemptedAt)
    {
        return new InvitationAttempt(
            invitationId,
            email.Trim(),
            codeMasked.Trim(),
            ipAddress?.Trim(),
            userAgent?.Trim(),
            InvitationAttemptResults.Success,
            null,
            attemptedAt);
    }

    public static InvitationAttempt Failure(
        Guid? invitationId,
        string? email,
        string? codeMasked,
        string? ipAddress,
        string? userAgent,
        string reason,
        DateTimeOffset attemptedAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(reason);

        return new InvitationAttempt(
            invitationId,
            email?.Trim(),
            codeMasked?.Trim(),
            ipAddress?.Trim(),
            userAgent?.Trim(),
            InvitationAttemptResults.Failure,
            reason.Trim(),
            attemptedAt);
    }
}
