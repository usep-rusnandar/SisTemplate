namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>Raised when a reviewer action is not allowed from the vendor's current status.</summary>
public sealed class VendorWorkflowException : Exception
{
    public VendorWorkflowException(string message)
        : base(message)
    {
    }
}
