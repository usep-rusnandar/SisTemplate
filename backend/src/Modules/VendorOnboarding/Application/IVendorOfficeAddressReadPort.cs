namespace IntegratedProcurement.Modules.VendorOnboarding.Application;

/// <summary>
/// Cross-module read of office address from vendor master (<c>vdr.VENDOR_T.OfficeAddress</c>).
/// Consumers such as CIP must not query vendor tables directly.
/// </summary>
public interface IVendorOfficeAddressReadPort
{
    /// <summary>
    /// Resolve office addresses for Tracker/CIP vendor ids and/or legal names.
    /// Dictionary keys are the requested <see cref="VendorOfficeAddressLookup.VendorId"/> when present,
    /// otherwise the vendor name. Only entries with a non-empty <c>OfficeAddress</c> are returned.
    /// </summary>
    Task<IReadOnlyDictionary<string, string>> ResolveAsync(
        IReadOnlyCollection<VendorOfficeAddressLookup> lookups,
        CancellationToken cancellationToken);
}

public sealed record VendorOfficeAddressLookup(string? VendorId, string? VendorName);
