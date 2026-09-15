using System.Text.Json;
using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Administration.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedProcurement.Platform.Administration.Infrastructure;

internal sealed class AdminConsoleCommunicationService : IAdminConsoleCommunicationService
{
    private readonly ProcurementDbContext _dbContext;

    public AdminConsoleCommunicationService(ProcurementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<JsonCollectionSnapshot> GetLanguagesAsync(CancellationToken cancellationToken)
    {
        var entries = await _dbContext.Languages
            .AsNoTracking()
            .OrderBy(item => item.Code)
            .ToArrayAsync(cancellationToken);

        return CreateSnapshot(entries.Select(entry => entry.PayloadJson).ToArray(), entries.Select(entry => (DateTimeOffset?)entry.UpdatedAt).ToArray());
    }

    public async Task ReplaceLanguagesAsync(IReadOnlyCollection<KeyedJsonItem> items, DateTimeOffset updatedAt, CancellationToken cancellationToken)
    {
        await _dbContext.Languages.ExecuteDeleteAsync(cancellationToken);
        foreach (var item in items)
        {
            _dbContext.Languages.Add(new LanguageEntry(Guid.NewGuid(), item.Key, item.PayloadJson, updatedAt));
        }
    }

    public async Task<JsonCollectionSnapshot> GetLanguageTextAsync(CancellationToken cancellationToken)
    {
        var entries = await _dbContext.LanguageTextEntries
            .AsNoTracking()
            .OrderBy(item => item.TextKey)
            .ToArrayAsync(cancellationToken);

        return CreateSnapshot(entries.Select(entry => entry.PayloadJson).ToArray(), entries.Select(entry => (DateTimeOffset?)entry.UpdatedAt).ToArray());
    }

    public async Task ReplaceLanguageTextAsync(IReadOnlyCollection<KeyedJsonItem> items, DateTimeOffset updatedAt, CancellationToken cancellationToken)
    {
        await _dbContext.LanguageTextEntries.ExecuteDeleteAsync(cancellationToken);
        foreach (var item in items)
        {
            _dbContext.LanguageTextEntries.Add(new LanguageTextEntry(Guid.NewGuid(), item.Key, item.PayloadJson, updatedAt));
        }
    }

    public async Task<JsonCollectionSnapshot> GetEmailTemplatesAsync(CancellationToken cancellationToken)
    {
        var entries = await _dbContext.EmailTemplates
            .AsNoTracking()
            .OrderBy(item => item.TemplateId)
            .ToArrayAsync(cancellationToken);

        return CreateSnapshot(entries.Select(entry => entry.PayloadJson).ToArray(), entries.Select(entry => (DateTimeOffset?)entry.UpdatedAt).ToArray());
    }

    public async Task<JsonCollectionSnapshot> GetEmailTemplatesByCategoryAsync(string category, CancellationToken cancellationToken)
    {
        var entries = await _dbContext.EmailTemplates
            .AsNoTracking()
            .OrderBy(item => item.TemplateId)
            .ToArrayAsync(cancellationToken);
        var filtered = entries
            .Where(entry => EmailTemplateCategoryMerge.MatchesCategory(entry.Category, category))
            .ToArray();

        return CreateSnapshot(filtered.Select(entry => entry.PayloadJson).ToArray(), filtered.Select(entry => (DateTimeOffset?)entry.UpdatedAt).ToArray());
    }

    public async Task ReplaceEmailTemplatesAsync(IReadOnlyCollection<KeyedJsonItem> items, DateTimeOffset updatedAt, CancellationToken cancellationToken)
    {
        await _dbContext.EmailTemplates.ExecuteDeleteAsync(cancellationToken);
        foreach (var item in items)
        {
            AddEmailTemplate(item, updatedAt);
        }
    }

    public async Task ReplaceEmailTemplatesForCategoryAsync(string category, IReadOnlyCollection<KeyedJsonItem> items, DateTimeOffset updatedAt, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(category);
        var canonical = category.Trim();
        var existing = await _dbContext.EmailTemplates.ToArrayAsync(cancellationToken);
        var reserved = existing
            .Where(entry => !EmailTemplateCategoryMerge.MatchesCategory(entry.Category, canonical))
            .Select(entry => entry.TemplateId)
            .ToArray();
        var prepared = EmailTemplateCategoryMerge.Prepare(items, reserved, canonical);

        _dbContext.EmailTemplates.RemoveRange(
            existing.Where(entry => EmailTemplateCategoryMerge.MatchesCategory(entry.Category, canonical)));

        foreach (var item in prepared)
        {
            AddEmailTemplate(item, updatedAt, canonical);
        }
    }

    private void AddEmailTemplate(KeyedJsonItem item, DateTimeOffset updatedAt, string? forcedCategory = null)
    {
        var payload = JsonSerializer.Deserialize<JsonElement>(item.PayloadJson, AdminConsoleJson.SerializerOptions);
        var category = forcedCategory
            ?? (payload.TryGetProperty("category", out var categoryElement) ? categoryElement.GetString() ?? string.Empty : string.Empty);
        _dbContext.EmailTemplates.Add(new EmailTemplateEntry(
            Guid.NewGuid(),
            item.Key,
            category,
            payload.TryGetProperty("status", out var status) ? status.GetString() ?? string.Empty : string.Empty,
            item.PayloadJson,
            updatedAt));
    }

    public async Task<JsonCollectionSnapshot> GetEmailSentAsync(CancellationToken cancellationToken)
    {
        var entries = await _dbContext.EmailSentEntries
            .AsNoTracking()
            .OrderByDescending(item => item.SentAt)
            .ToArrayAsync(cancellationToken);

        return CreateSnapshot(entries.Select(entry => entry.PayloadJson).ToArray(), entries.Select(entry => (DateTimeOffset?)entry.SentAt).ToArray());
    }

    public async Task ReplaceEmailSentAsync(IReadOnlyCollection<KeyedJsonItem> items, CancellationToken cancellationToken)
    {
        await _dbContext.EmailSentEntries.ExecuteDeleteAsync(cancellationToken);
        foreach (var item in items)
        {
            var payload = JsonSerializer.Deserialize<JsonElement>(item.PayloadJson, AdminConsoleJson.SerializerOptions);
            var category = payload.TryGetProperty("category", out var categoryElement) ? categoryElement.GetString() ?? string.Empty : string.Empty;
            var status = payload.TryGetProperty("status", out var statusElement) ? statusElement.GetString() ?? string.Empty : string.Empty;
            var sentAt = payload.TryGetProperty("sentAt", out var sentAtElement) && DateTimeOffset.TryParse(sentAtElement.GetString(), out var parsedSentAt)
                ? parsedSentAt
                : DateTimeOffset.UtcNow;
            _dbContext.EmailSentEntries.Add(new EmailSentEntry(Guid.NewGuid(), item.Key, category, status, sentAt, item.PayloadJson));
        }
    }

    public async Task<bool> TryAddEmailSentAsync(string messageId, string category, string status, DateTimeOffset sentAt, string payloadJson, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.EmailSentEntries.SingleOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
        if (existing is not null)
        {
            return false;
        }

        _dbContext.EmailSentEntries.Add(new EmailSentEntry(Guid.NewGuid(), messageId, category, status, sentAt, payloadJson));
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static JsonCollectionSnapshot CreateSnapshot(string[] payloads, IReadOnlyCollection<DateTimeOffset?> timestamps)
    {
        if (payloads.Length == 0)
        {
            return new JsonCollectionSnapshot(null, false, null);
        }

        return new JsonCollectionSnapshot(
            payloads.Select(payload => JsonSerializer.Deserialize<JsonElement>(payload, AdminConsoleJson.SerializerOptions)).ToArray(),
            true,
            timestamps.Max());
    }
}
