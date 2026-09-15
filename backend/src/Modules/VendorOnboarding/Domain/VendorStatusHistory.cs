using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// One entry in a vendor's status audit trail. Mirrors the legacy VENDOR_STATUS_T structure —
/// Guid PK (VendorStatusId), varchar(10) VendorId, actor recorded in CreatedBy
/// (the VendorId for vendor self-service actions, the internal UserId/NRP otherwise) —
/// with the current status denormalised onto <see cref="Vendor.Status"/>.
/// </summary>
public sealed class VendorStatusHistory : AuditableEntity
{
    private VendorStatusHistory()
    {
    }

    private VendorStatusHistory(string vendorId, string statusCode, string? createdBy, string? reason, DateTimeOffset? occurredAt)
        : base(Guid.NewGuid())
    {
        VendorId = vendorId;
        StatusCode = statusCode;
        Reason = reason;
        if (!string.IsNullOrWhiteSpace(createdBy))
        {
            CreatedBy = createdBy;
        }

        if (occurredAt.HasValue)
        {
            CreatedAt = occurredAt.Value;
        }
    }

    public string VendorId { get; private set; } = string.Empty;

    public string StatusCode { get; private set; } = string.Empty;

    public string? Reason { get; private set; }

    public static VendorStatusHistory Record(string vendorId, string statusCode, string? createdBy, string? reason, DateTimeOffset? occurredAt = null) =>
        new(
            vendorId,
            statusCode,
            string.IsNullOrWhiteSpace(createdBy) ? null : createdBy.Trim(),
            string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            occurredAt);
}
