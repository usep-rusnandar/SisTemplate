using IntegratedProcurement.Platform.Persistence;

namespace IntegratedProcurement.AppHost.Api.Services;

public interface IAppReadinessService
{
    Task<AppReadinessResult> CheckAsync(CancellationToken cancellationToken);
}

public sealed class AppReadinessService : IAppReadinessService
{
    private readonly ProcurementDbContext _dbContext;

    public AppReadinessService(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<AppReadinessResult> CheckAsync(CancellationToken cancellationToken)
    {
        try
        {
            var databaseReady = await _dbContext.Database.CanConnectAsync(cancellationToken);
            if (!databaseReady)
            {
                return AppReadinessResult.NotReady("Database connection check returned false.");
            }

            return AppReadinessResult.Ready();
        }
        catch
        {
            return AppReadinessResult.NotReady("Database connectivity check failed.");
        }
    }
}

public sealed record AppReadinessResult(bool IsReady, IReadOnlyCollection<AppReadinessCheck> Checks)
{
    public static AppReadinessResult Ready() => new(true, [new AppReadinessCheck("database", "Ready", null)]);

    public static AppReadinessResult NotReady(string detail) =>
        new(false, [new AppReadinessCheck("database", "Unavailable", detail)]);
}

public sealed record AppReadinessCheck(string Name, string Status, string? Detail);