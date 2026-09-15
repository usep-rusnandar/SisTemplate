using System.Text.Json;

namespace SisTemplate.Platform.Administration.Application;

public interface IApplicationAboutService
{
    /// <summary>
    /// Returns the bilingual About Application document from the database, or null when unset.
    /// </summary>
    Task<JsonElement?> GetDocumentAsync(CancellationToken cancellationToken);
}
