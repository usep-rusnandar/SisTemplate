namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;

/// <summary>Application boundary for the controlled Ariba migration use case (create, or overwrite INITL on email collision).</summary>
public interface IVendorAribaImportService
{
    byte[] CreateTemplate();
    Task<VendorImportBatchDto> ValidateAsync(Stream input, string fileName, CancellationToken cancellationToken);
    Task<VendorImportBatchDto?> CommitAsync(Guid batchId, CancellationToken cancellationToken);
    Task<VendorImportBatchDto?> GetAsync(Guid batchId, CancellationToken cancellationToken);
    Task<IReadOnlyList<VendorImportBatchSummaryDto>> ListAsync(CancellationToken cancellationToken);
}

public sealed class VendorImportCommitException(string message) : InvalidOperationException(message);

public sealed record ImportIssue(string Level, string Field, string Message);

public sealed record VendorImportRowDto(Guid Id, int RowNumber, string ExternalVendorId, string VendorName,
    string PicEmail, string Status, IReadOnlyList<ImportIssue> Issues, string? VendorId, string? SourceStatus = null);

public sealed record VendorImportBatchDto(Guid Id, string FileName, string Status, int TotalRows,
    int ReadyRows, int WarningRows, int ErrorRows, int ImportedRows, int SkippedRows, string StartedBy,
    DateTimeOffset CreatedAt, DateTimeOffset? CommittedAt, IReadOnlyList<VendorImportRowDto> Rows);

public sealed record VendorImportBatchSummaryDto(Guid Id, string FileName, string Status, int TotalRows,
    int ReadyRows, int WarningRows, int ErrorRows, int ImportedRows, int SkippedRows, string StartedBy,
    DateTimeOffset CreatedAt, DateTimeOffset? CommittedAt);
