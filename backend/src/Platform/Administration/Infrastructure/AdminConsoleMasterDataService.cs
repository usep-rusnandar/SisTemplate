using System.Globalization;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Administration.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

internal sealed class AdminConsoleMasterDataService : IAdminConsoleMasterDataService
{
    private readonly ProcurementDbContext _dbContext;

    public AdminConsoleMasterDataService(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyCollection<MasterDataSet>> GetSetsAsync(CancellationToken cancellationToken)
    {
        var sets = await _dbContext.MasterDataSets
            .AsNoTracking()
            .OrderBy(set => set.Name)
            .ToArrayAsync(cancellationToken);
        if (sets.Length == 0)
        {
            return [];
        }

        var setKeys = sets.Select(set => set.Key).ToArray();
        var counts = await _dbContext.MasterDataRecords
            .AsNoTracking()
            .Where(record => setKeys.Contains(record.SetKey))
            .GroupBy(record => record.SetKey)
            .Select(group => new { SetKey = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.SetKey, item => item.Count, cancellationToken);

        return sets
            .Select(set => new MasterDataSet(
                set.Key,
                set.Name,
                set.TableName,
                set.Owner,
                [
                    new MasterDataRecord(
                        "COUNT",
                        counts.GetValueOrDefault(set.Key).ToString(CultureInfo.InvariantCulture),
                        set.IsReadOnly ? "ReadOnly" : "Active",
                        set.IsReadOnly ? "Read-only dataset" : "Database-backed dataset",
                        null)
                ]))
            .ToArray();
    }

    public async Task<MasterDataSetReadResult?> GetSetAsync(
        string key,
        string? parentCode,
        string? search,
        int? take,
        CancellationToken cancellationToken)
    {
        var set = await _dbContext.MasterDataSets
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Key == key, cancellationToken);
        if (set is null)
        {
            return null;
        }

        var query = _dbContext.MasterDataRecords
            .AsNoTracking()
            .Where(record => record.SetKey == set.Key);

        // Cascade filter (hierarchical masters) — indexed on (SetKey, ParentCode).
        if (parentCode is not null)
        {
            query = query.Where(record => record.ParentCode == parentCode);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(record => record.Name.Contains(term) || record.Code.Contains(term));
        }

        query = query.OrderBy(record => record.Code);

        // Bound the payload for very large sets (e.g. village ~82k); 0/absent = no cap.
        if (take is > 0)
        {
            query = query.Take(take.Value);
        }

        var records = await query
            .Select(record => new MasterDataRecord(
                record.Code,
                record.Name,
                record.Status,
                record.Description,
                record.PayloadJson,
                record.ParentCode))
            .ToArrayAsync(cancellationToken);

        return new MasterDataSetReadResult(set.Key, set.Name, set.TableName, set.Owner, true, records);
    }

    public async Task<MasterDataSetMutationResult> UpsertRecordsAsync(
        string key,
        MasterDataSetDefinition definition,
        IReadOnlyCollection<MasterDataRecordInput> records,
        CancellationToken cancellationToken)
    {
        var set = await EnsureMasterDataSetAsync(key, definition, cancellationToken);
        if (set.IsReadOnly)
        {
            return new MasterDataSetMutationResult(MasterDataMutationOutcome.ReadOnly, key, 0);
        }

        var now = DateTimeOffset.UtcNow;
        var recordCodes = records
            .Select(record => record.Code)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var existingRecords = await _dbContext.MasterDataRecords
            .Where(item => item.SetKey == key && recordCodes.Contains(item.Code))
            .ToDictionaryAsync(item => item.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var record in records)
        {
            if (!existingRecords.TryGetValue(record.Code, out var existing))
            {
                _dbContext.MasterDataRecords.Add(new MasterDataRecordEntry(
                    Guid.NewGuid(),
                    key,
                    record.Code,
                    record.Name,
                    record.Status,
                    record.Description,
                    record.PayloadJson,
                    now,
                    record.ParentCode));
                continue;
            }

            existing.Update(record.Name, record.Status, record.Description, record.PayloadJson, now, record.ParentCode);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new MasterDataSetMutationResult(MasterDataMutationOutcome.Success, key, records.Count);
    }

    public async Task<MasterDataSetMutationResult> ReplaceRecordsAsync(
        string key,
        MasterDataSetDefinition definition,
        IReadOnlyCollection<MasterDataRecordInput> records,
        CancellationToken cancellationToken)
    {
        var set = await EnsureMasterDataSetAsync(key, definition, cancellationToken);
        if (set.IsReadOnly)
        {
            return new MasterDataSetMutationResult(MasterDataMutationOutcome.ReadOnly, key, 0);
        }

        await _dbContext.MasterDataRecords
            .Where(item => item.SetKey == key)
            .ExecuteDeleteAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        foreach (var record in records)
        {
            _dbContext.MasterDataRecords.Add(new MasterDataRecordEntry(
                Guid.NewGuid(),
                key,
                record.Code,
                record.Name,
                record.Status,
                record.Description,
                record.PayloadJson,
                now,
                record.ParentCode));
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new MasterDataSetMutationResult(MasterDataMutationOutcome.Success, key, records.Count);
    }

    public async Task<MasterDataSetMutationResult> InsertMissingRecordsAsync(
        string key,
        MasterDataSetDefinition definition,
        IReadOnlyCollection<MasterDataRecordInput> records,
        CancellationToken cancellationToken)
    {
        var set = await EnsureMasterDataSetAsync(key, definition, cancellationToken);
        if (set.IsReadOnly)
        {
            return new MasterDataSetMutationResult(MasterDataMutationOutcome.ReadOnly, key, 0);
        }

        var existingRows = await _dbContext.MasterDataRecords
            .AsNoTracking()
            .Where(item => item.SetKey == key)
            .Select(item => new { item.Code, item.Name })
            .ToArrayAsync(cancellationToken);
        var existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in existingRows)
        {
            if (!string.IsNullOrWhiteSpace(row.Code))
            {
                existing.Add(row.Code);
            }

            if (!string.IsNullOrWhiteSpace(row.Name))
            {
                existing.Add(row.Name);
            }
        }

        var now = DateTimeOffset.UtcNow;
        var added = 0;
        foreach (var record in records)
        {
            if (existing.Contains(record.Code) || existing.Contains(record.Name))
            {
                continue;
            }

            _dbContext.MasterDataRecords.Add(new MasterDataRecordEntry(
                Guid.NewGuid(),
                key,
                record.Code,
                record.Name,
                record.Status,
                record.Description,
                record.PayloadJson,
                now,
                record.ParentCode));
            existing.Add(record.Code);
            existing.Add(record.Name);
            added++;
        }

        if (added > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return new MasterDataSetMutationResult(MasterDataMutationOutcome.Success, key, added);
    }

    public async Task<MasterDataRecordMutationResult> UpsertRecordAsync(
        string key,
        string code,
        MasterDataSetDefinition definition,
        MasterDataRecordInput record,
        CancellationToken cancellationToken)
    {
        var set = await EnsureMasterDataSetAsync(key, definition, cancellationToken);
        if (set.IsReadOnly)
        {
            return new MasterDataRecordMutationResult(
                MasterDataMutationOutcome.ReadOnly,
                key,
                code,
                record.Name,
                record.Status,
                record.Description);
        }

        var now = DateTimeOffset.UtcNow;
        var existing = await _dbContext.MasterDataRecords
            .SingleOrDefaultAsync(item => item.SetKey == key && item.Code == code, cancellationToken);
        if (existing is null)
        {
            existing = new MasterDataRecordEntry(
                Guid.NewGuid(),
                key,
                code,
                record.Name,
                record.Status,
                record.Description,
                record.PayloadJson,
                now,
                record.ParentCode);
            _dbContext.MasterDataRecords.Add(existing);
        }
        else
        {
            existing.Update(record.Name, record.Status, record.Description, record.PayloadJson, now, record.ParentCode);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new MasterDataRecordMutationResult(
            MasterDataMutationOutcome.Success,
            key,
            existing.Code,
            existing.Name,
            existing.Status,
            existing.Description);
    }

    public async Task<DeleteMasterDataRecordResult> DeleteRecordAsync(
        string key,
        string code,
        CancellationToken cancellationToken)
    {
        var set = await _dbContext.MasterDataSets
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Key == key, cancellationToken);
        if (set is null)
        {
            return new DeleteMasterDataRecordResult(DeleteMasterDataRecordOutcome.SetNotFound, key, code);
        }

        if (set.IsReadOnly)
        {
            return new DeleteMasterDataRecordResult(DeleteMasterDataRecordOutcome.ReadOnly, key, code);
        }

        var deleted = await _dbContext.MasterDataRecords
            .Where(item => item.SetKey == key && item.Code == code)
            .ExecuteDeleteAsync(cancellationToken);
        if (deleted == 0)
        {
            return new DeleteMasterDataRecordResult(DeleteMasterDataRecordOutcome.RecordNotFound, key, code);
        }

        return new DeleteMasterDataRecordResult(DeleteMasterDataRecordOutcome.Deleted, key, code);
    }

    private async Task<MasterDataSetEntry> EnsureMasterDataSetAsync(
        string key,
        MasterDataSetDefinition definition,
        CancellationToken cancellationToken)
    {
        var existing = await _dbContext.MasterDataSets.SingleOrDefaultAsync(item => item.Key == key, cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var created = new MasterDataSetEntry(
            Guid.NewGuid(),
            key,
            definition.SetName ?? FormatModuleLabel(key),
            definition.TableName ?? $"MSTR_{key.Replace('-', '_').ToUpperInvariant()}_T",
            definition.Owner ?? "Platform",
            definition.IsReadOnly ?? false,
            now);
        _dbContext.MasterDataSets.Add(created);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return created;
    }

    private static string FormatModuleLabel(string moduleKey) =>
        moduleKey
            .Replace('-', ' ')
            .Replace('_', ' ')
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(word => word.Length == 1
                ? word.ToUpperInvariant()
                : char.ToUpperInvariant(word[0]) + word[1..])
            .Aggregate(string.Empty, (current, word) => string.IsNullOrEmpty(current) ? word : $"{current} {word}");
}
