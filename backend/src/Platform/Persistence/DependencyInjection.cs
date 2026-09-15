using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace SisTemplate.Platform.Persistence;

public static class DependencyInjection
{
    public static IServiceCollection AddProcurementPersistence(
        this IServiceCollection services,
        string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        services.AddDbContext<ProcurementDbContext>(options =>
        {
            options.UseSqlServer(connectionString, sqlServer =>
            {
                sqlServer.MigrationsAssembly(typeof(ProcurementDbContext).Assembly.FullName);
                // Azure SQL drops idle/logging connections occasionally; retry transient faults so a
                // brief blip doesn't surface as a 500 (observed during Bid Evaluation persist).
                sqlServer.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null);
            });
        });

        return services;
    }
}
