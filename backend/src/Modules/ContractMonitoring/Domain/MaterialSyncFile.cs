using IntegratedProcurement.BuildingBlocks.Domain.Entities;

namespace IntegratedProcurement.Modules.ContractMonitoring.Domain;

/// <summary>
/// Last successful List-of-Material import for a contract. SharePoint folder sync skips a file when
/// <see cref="FileName"/> and <see cref="SourceLastModified"/> both match the drive item.
/// </summary>
public sealed class MaterialSyncFile : AuditableEntity
{
    public static class Sources
    {
        public const string SharePoint = "SharePoint";
        public const string Manual = "Manual";
        public const string EproposalAward = "EProposalAward";
    }

    private MaterialSyncFile()
    {
        ContractKey = string.Empty;
        FileName = string.Empty;
        SourceType = string.Empty;
    }

    public MaterialSyncFile(
        Guid id,
        string contractKey,
        string fileName,
        string sourceType,
        DateTimeOffset? sourceLastModified,
        int rowCount,
        DateTimeOffset importedAt)
        : base(id)
    {
        ContractKey = contractKey;
        FileName = fileName;
        SourceType = sourceType;
        SourceLastModified = sourceLastModified;
        RowCount = rowCount;
        ImportedAt = importedAt;
    }

    public string ContractKey { get; private set; }

    public string FileName { get; private set; }

    public string SourceType { get; private set; }

    public DateTimeOffset? SourceLastModified { get; private set; }

    public int RowCount { get; private set; }

    public DateTimeOffset ImportedAt { get; private set; }

    public void RecordImport(
        string fileName,
        string sourceType,
        DateTimeOffset? sourceLastModified,
        int rowCount,
        DateTimeOffset importedAt)
    {
        FileName = fileName;
        SourceType = sourceType;
        SourceLastModified = sourceLastModified;
        RowCount = rowCount;
        ImportedAt = importedAt;
    }
}
