namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>Filter and localization requested by the internal Vendor Database export.</summary>
public sealed record VendorDatabaseExportQuery(
    string? Search,
    string? Status,
    string Language = "en");

/// <summary>Transport-neutral workbook payload returned by the module application boundary.</summary>
public sealed record VendorDatabaseExportFile(
    byte[] Content,
    string FileName,
    string ContentType);

public interface IVendorDatabaseExportService
{
    Task<VendorDatabaseExportFile> ExportAsync(
        VendorDatabaseExportQuery query,
        CancellationToken cancellationToken);
}
