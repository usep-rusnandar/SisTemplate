using System.Text.Json;

namespace IntegratedProcurement.Platform.Administration.Application;

public interface IAdminConsoleCommunicationService
{
    Task<JsonCollectionSnapshot> GetLanguagesAsync(CancellationToken cancellationToken);

    Task ReplaceLanguagesAsync(IReadOnlyCollection<KeyedJsonItem> items, DateTimeOffset updatedAt, CancellationToken cancellationToken);

    Task<JsonCollectionSnapshot> GetLanguageTextAsync(CancellationToken cancellationToken);

    Task ReplaceLanguageTextAsync(IReadOnlyCollection<KeyedJsonItem> items, DateTimeOffset updatedAt, CancellationToken cancellationToken);

    Task<JsonCollectionSnapshot> GetEmailTemplatesAsync(CancellationToken cancellationToken);

    Task<JsonCollectionSnapshot> GetEmailTemplatesByCategoryAsync(string category, CancellationToken cancellationToken);

    Task ReplaceEmailTemplatesAsync(IReadOnlyCollection<KeyedJsonItem> items, DateTimeOffset updatedAt, CancellationToken cancellationToken);

    Task ReplaceEmailTemplatesForCategoryAsync(string category, IReadOnlyCollection<KeyedJsonItem> items, DateTimeOffset updatedAt, CancellationToken cancellationToken);

    Task<JsonCollectionSnapshot> GetEmailSentAsync(CancellationToken cancellationToken);

    Task ReplaceEmailSentAsync(IReadOnlyCollection<KeyedJsonItem> items, CancellationToken cancellationToken);

    Task<bool> TryAddEmailSentAsync(string messageId, string category, string status, DateTimeOffset sentAt, string payloadJson, CancellationToken cancellationToken);
}

public sealed record KeyedJsonItem(string Key, string PayloadJson);

public sealed record JsonCollectionSnapshot(IReadOnlyCollection<JsonElement>? Items, bool HasData, DateTimeOffset? UpdatedAt);
