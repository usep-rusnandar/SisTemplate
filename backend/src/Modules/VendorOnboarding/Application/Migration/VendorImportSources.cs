namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;

/// <summary>Integration identifiers for vendor import batches. Domain stores these as opaque strings.</summary>
public static class VendorImportSources
{
    public const string Ariba = "ARIBA";
    public const string VendorConnect = "VENDOR_CONNECT";
    public const string VendorConnectBatchName = "VENDOR_CONNECT_DB";
    public const string VendorConnectDocsBatchName = "VENDOR_CONNECT_DOCS";

    public static bool IsVendorConnectFile(string? fileName) =>
        fileName is VendorConnectBatchName or VendorConnectDocsBatchName;
}
