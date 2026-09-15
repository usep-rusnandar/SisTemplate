namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed class VendorInvitationRuleException : InvalidOperationException
{
    public VendorInvitationRuleException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}
