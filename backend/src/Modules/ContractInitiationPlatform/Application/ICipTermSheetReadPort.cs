using System.Text.Json;

namespace IntegratedProcurement.Modules.ContractInitiationPlatform.Application;

/// <summary>
/// Published read-port so Tracker can gate LOA generation on a completed CIP Term Sheet
/// without taking <c>ICipRepository</c>.
/// </summary>
public interface ICipTermSheetReadPort
{
    Task<CipTermSheetSupport?> GetForTrackerLoaAsync(
        string proposalId,
        string? vendorId,
        CancellationToken cancellationToken);
}

public sealed record CipTermSheetSupportDocument(
    string FileName,
    DateTimeOffset? GeneratedAt,
    string? Container,
    string? BlobKey);

public sealed record CipTermSheetSupport(
    bool Available,
    string? Reason,
    string CaseKey,
    string? TermsheetNumber,
    DateTimeOffset? CompletedAt,
    string VendorId,
    string VendorName,
    decimal AwardValue,
    decimal AwardPercent,
    JsonElement? SourceTerms,
    JsonElement? TermsheetPayload,
    CipTermSheetSupportDocument? Document);
