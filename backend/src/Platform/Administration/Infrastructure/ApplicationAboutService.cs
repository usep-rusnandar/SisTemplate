using System.Text.Json;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

public sealed class ApplicationAboutService : IApplicationAboutService
{
    private readonly ProcurementDbContext _dbContext;

    public ApplicationAboutService(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<JsonElement?> GetDocumentAsync(CancellationToken cancellationToken)
    {
        var entry = await _dbContext.ApplicationAbout
            .AsNoTracking()
            .OrderBy(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (entry is null || string.IsNullOrWhiteSpace(entry.PayloadJson))
        {
            return null;
        }

        using var document = JsonDocument.Parse(entry.PayloadJson);
        return document.RootElement.Clone();
    }
}
