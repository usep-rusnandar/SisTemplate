namespace IntegratedProcurement.Modules.VendorOnboarding.Application;

/// <summary>
/// Cross-module read of Vendor Database companies whose lifecycle status is Registered
/// (<c>RGSTD</c>). Consumers such as Tracker sample-data generation must not query <c>vdr</c> directly.
/// </summary>
public interface IRegisteredVendorReadPort
{
    /// <summary>
    /// Every non-deleted Registered vendor, ordered by name then id so callers can slice a stable pool.
    /// PIC name is the workspace PIC when one exists, otherwise any linked contact name.
    /// </summary>
    Task<IReadOnlyList<RegisteredVendorReadRow>> ListRegisteredAsync(CancellationToken cancellationToken);
}

/// <param name="VendorId">Stable Vendor Database id (max 10 characters).</param>
/// <param name="VendorName">Legal company name.</param>
/// <param name="PicName">Workspace PIC / primary contact; Tracker maps this to the sample <c>director</c> field.</param>
/// <param name="OfficeAddress">Office address from <c>vdr.VENDOR_T</c>.</param>
public sealed record RegisteredVendorReadRow(
    string VendorId,
    string VendorName,
    string? PicName,
    string? OfficeAddress);
