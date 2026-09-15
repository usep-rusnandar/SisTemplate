namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

public static class InvitationStatuses
{
    public const string Draft = "Draft";
    public const string Sent = "Sent";
    public const string Opened = "Opened";
    public const string Registered = "Registered";
    public const string Expired = "Expired";
    public const string Revoked = "Revoked";

    public static readonly string[] ActiveStatuses = [Draft, Sent, Opened];
}
