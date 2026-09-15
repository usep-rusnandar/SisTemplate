namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed class VendorRegistrationOptions
{
    public const string SectionName = "VendorRegistration";

    public string RegistrationUrl { get; init; } = "http://localhost:5173/vendor.html";

    public int DefaultExpiryDays { get; init; } = 14;

    public int FailedAttemptLimit { get; init; } = 5;

    public int FailedAttemptWindowMinutes { get; init; } = 15;
}
