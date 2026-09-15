namespace IntegratedProcurement.Platform.Administration.Application;

public interface IAdminConsoleMasterDataService
{
    Task<IReadOnlyCollection<MasterDataSet>> GetSetsAsync(CancellationToken cancellationToken);

    /// <summary>Returns the DB-backed set, or null when no such set exists (the host supplies any canned fallback).</summary>
    Task<MasterDataSetReadResult?> GetSetAsync(
        string key,
        string? parentCode,
        string? search,
        int? take,
        CancellationToken cancellationToken);

    Task<MasterDataSetMutationResult> UpsertRecordsAsync(
        string key,
        MasterDataSetDefinition definition,
        IReadOnlyCollection<MasterDataRecordInput> records,
        CancellationToken cancellationToken);

    Task<MasterDataSetMutationResult> ReplaceRecordsAsync(
        string key,
        MasterDataSetDefinition definition,
        IReadOnlyCollection<MasterDataRecordInput> records,
        CancellationToken cancellationToken);

    /// <summary>Inserts records whose code/name is not already in the set. Existing rows are left unchanged.</summary>
    Task<MasterDataSetMutationResult> InsertMissingRecordsAsync(
        string key,
        MasterDataSetDefinition definition,
        IReadOnlyCollection<MasterDataRecordInput> records,
        CancellationToken cancellationToken);

    Task<MasterDataRecordMutationResult> UpsertRecordAsync(
        string key,
        string code,
        MasterDataSetDefinition definition,
        MasterDataRecordInput record,
        CancellationToken cancellationToken);

    Task<DeleteMasterDataRecordResult> DeleteRecordAsync(
        string key,
        string code,
        CancellationToken cancellationToken);
}

public sealed record MasterDataSetDefinition(
    string? SetName,
    string? TableName,
    string? Owner,
    bool? IsReadOnly);

public sealed record MasterDataSetReadResult(
    string Key,
    string Name,
    string TableName,
    string Owner,
    bool HasData,
    IReadOnlyCollection<MasterDataRecord> Records);

public sealed record MasterDataRecordInput(
    string Code,
    string Name,
    string Status,
    string Description,
    string? PayloadJson,
    string? ParentCode = null);

public enum MasterDataMutationOutcome
{
    Success,
    ReadOnly
}

public sealed record MasterDataSetMutationResult(
    MasterDataMutationOutcome Outcome,
    string Key,
    int RecordsAffected);

public sealed record MasterDataRecordMutationResult(
    MasterDataMutationOutcome Outcome,
    string Key,
    string Code,
    string Name,
    string Status,
    string Description);

public enum DeleteMasterDataRecordOutcome
{
    Deleted,
    SetNotFound,
    ReadOnly,
    RecordNotFound
}

public sealed record DeleteMasterDataRecordResult(
    DeleteMasterDataRecordOutcome Outcome,
    string Key,
    string Code);
