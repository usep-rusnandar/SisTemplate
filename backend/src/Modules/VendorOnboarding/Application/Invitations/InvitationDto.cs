namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;

public sealed record InvitationDto(
    Guid Id,
    string CodeMasked,
    string Email,
    string VendorName,
    string PicName,
    string? Category,
    string? VendorId,
    DateTimeOffset ExpiredAt,
    DateTimeOffset? UsedAt,
    Guid? UsedBy,
    string Status,
    string? Note,
    DateTimeOffset CreatedAt,
    string? CreatedBy);
