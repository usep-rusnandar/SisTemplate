using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

public sealed class Invitation : AuditableEntity
{
    private Invitation()
    {
    }

    private Invitation(
        string codeHash,
        string codeMasked,
        string email,
        string vendorName,
        string picName,
        string? category,
        string? vendorId,
        DateTimeOffset expiredAt,
        string status,
        string? note)
        : base(Guid.NewGuid())
    {
        CodeHash = codeHash;
        CodeMasked = codeMasked;
        Email = email;
        VendorName = vendorName;
        PicName = picName;
        Category = category;
        VendorId = vendorId;
        ExpiredAt = expiredAt;
        Status = status;
        Note = note;
    }

    public string CodeHash { get; private set; } = string.Empty;

    public string CodeMasked { get; private set; } = string.Empty;

    public string Email { get; private set; } = string.Empty;

    public string VendorName { get; private set; } = string.Empty;

    public string PicName { get; private set; } = string.Empty;

    public string? Category { get; private set; }

    public string? VendorId { get; private set; }

    public DateTimeOffset ExpiredAt { get; private set; }

    public DateTimeOffset? UsedAt { get; private set; }

    public Guid? UsedBy { get; private set; }

    public string Status { get; private set; } = InvitationStatuses.Draft;

    public string? Note { get; private set; }

    public static Invitation Create(
        string codeHash,
        string codeMasked,
        string email,
        string vendorName,
        string picName,
        DateTimeOffset expiredAt,
        string? category = null,
        string? vendorId = null,
        string? note = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codeHash);
        ArgumentException.ThrowIfNullOrWhiteSpace(codeMasked);
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(vendorName);
        ArgumentException.ThrowIfNullOrWhiteSpace(picName);

        return new Invitation(
            codeHash.Trim(),
            codeMasked.Trim(),
            email.Trim(),
            vendorName.Trim(),
            picName.Trim(),
            category?.Trim(),
            vendorId,
            expiredAt,
            InvitationStatuses.Draft,
            note?.Trim());
    }

    public void MarkSent()
    {
        Status = InvitationStatuses.Sent;
    }

    public void MarkOpened()
    {
        if (Status == InvitationStatuses.Sent)
        {
            Status = InvitationStatuses.Opened;
        }
    }

    public void Reissue(string codeHash, string codeMasked, DateTimeOffset expiredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codeHash);
        ArgumentException.ThrowIfNullOrWhiteSpace(codeMasked);

        CodeHash = codeHash.Trim();
        CodeMasked = codeMasked.Trim();
        ExpiredAt = expiredAt;
        UsedAt = null;
        UsedBy = null;
        Status = InvitationStatuses.Sent;
    }

    public void Revoke()
    {
        Status = InvitationStatuses.Revoked;
    }

    public void MarkUsed(Guid vendorUserId, DateTimeOffset usedAt)
    {
        UsedBy = vendorUserId;
        UsedAt = usedAt;
        Status = InvitationStatuses.Registered;
    }
}
