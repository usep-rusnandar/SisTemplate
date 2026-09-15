using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Platform.Persistence.FrontendState;

public sealed class FrontendStateStore
{
    public const string DefaultScope = "integrated-procurement";

    private readonly ProcurementDbContext _dbContext;

    public FrontendStateStore(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyCollection<FrontendStateItem>> ListAsync(
        string scope,
        CancellationToken cancellationToken) =>
        await _dbContext.FrontendStates
            .AsNoTracking()
            .Where(item => item.Scope == scope)
            .OrderBy(item => item.Key)
            .Select(item => new FrontendStateItem(item.Scope, item.Key, item.Value, item.UpdatedAt))
            .ToArrayAsync(cancellationToken);

    public async Task<FrontendStateItem> SetAsync(
        string scope,
        string key,
        string? value,
        CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim();
        var normalizedValue = value ?? string.Empty;
        var now = DateTimeOffset.UtcNow;

        var entry = await _dbContext.FrontendStates
            .SingleOrDefaultAsync(
                item => item.Scope == scope && item.Key == normalizedKey,
                cancellationToken);

        if (entry is null)
        {
            entry = new FrontendStateEntry(Guid.NewGuid(), scope, normalizedKey, normalizedValue, now);
            _dbContext.FrontendStates.Add(entry);
        }
        else
        {
            entry.UpdateValue(normalizedValue, now);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new FrontendStateItem(entry.Scope, entry.Key, entry.Value, entry.UpdatedAt);
    }

    public async Task RemoveAsync(
        string scope,
        string key,
        CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim();
        await _dbContext.FrontendStates
            .Where(item => item.Scope == scope && item.Key == normalizedKey)
            .ExecuteDeleteAsync(cancellationToken);
    }

    public async Task ClearAsync(
        string scope,
        CancellationToken cancellationToken)
    {
        await _dbContext.FrontendStates
            .Where(item => item.Scope == scope)
            .ExecuteDeleteAsync(cancellationToken);
    }
}

public sealed record FrontendStateItem(
    string Scope,
    string Key,
    string Value,
    DateTimeOffset UpdatedAt);
