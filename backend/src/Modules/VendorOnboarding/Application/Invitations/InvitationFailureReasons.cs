namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public static class InvitationFailureReasons
{
    public const string Invalid = "invalid";
    public const string Expired = "expired";
    public const string Revoked = "revoked";
    public const string Used = "used";
    public const string EmailMismatch = "email_mismatch";
    public const string EmailRegistered = "email_registered";
    public const string TooManyAttempts = "too_many_attempts";
}
