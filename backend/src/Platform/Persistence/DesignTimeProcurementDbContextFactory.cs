using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SisTemplate.Platform.Persistence;

public sealed class DesignTimeProcurementDbContextFactory
    : IDesignTimeDbContextFactory<ProcurementDbContext>
{
    public ProcurementDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("SISTEMPLATE_CONNECTION")
            ?? Environment.GetEnvironmentVariable("INTEGRATED_PROCUREMENT_CONNECTION")
            ?? "Server=(localdb)\\MSSQLLocalDB;Database=PROCUREMENT_LOCAL;Trusted_Connection=True;TrustServerCertificate=True";

        var options = new DbContextOptionsBuilder<ProcurementDbContext>()
            .UseSqlServer(connectionString, sqlServer =>
            {
                sqlServer.MigrationsAssembly(typeof(ProcurementDbContext).Assembly.FullName);
            })
            .Options;

        return new ProcurementDbContext(options);
    }
}
