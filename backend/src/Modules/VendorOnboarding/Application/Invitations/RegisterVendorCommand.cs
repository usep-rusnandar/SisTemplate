namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

/// <summary>
/// Redeems an invitation: the vendor only sets a password — email, vendor name, and PIC name
/// come from the invitation itself (optional overrides kept for API compatibility).
/// </summary>
public sealed record RegisterVendorCommand(
    string InvitationCode,
    string Password,
    string? Email = null,
    string? VendorName = null,
    string? PicName = null,
    string? Phone = null,
    string? Position = null,
    string? Category = null,
    string? Npwp = null,
    string? Nib = null,
    string? Address = null,
    string? IpAddress = null,
    string? UserAgent = null);
