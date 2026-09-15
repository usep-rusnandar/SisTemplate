using IntegratedProcurement.Modules.VendorOnboarding.Domain;

namespace IntegratedProcurement.Modules.VendorOnboarding.Application.Review;

/// <summary>Where a vendor stands in the status chain, and what the current actor may do about it.</summary>
public sealed record VendorApprovalContextDto(
    bool AwaitingApproval,
    string StatusCode,
    string? StatusName,
    string? StatusDescription,
    string? ApproverRoleCode,
    string? ApproverRoleName,
    int? StationNumber,
    int TotalStations,
    bool CanReview,
    IReadOnlyList<string> AllowedActions,
    ApprovalSlaSnapshot Sla,
    IReadOnlyList<ApprovalStationProgressDto> Stations);

/// <summary>
/// One approval station on the vendor's trail: the configured target next to what actually happened,
/// reconstructed from the status history.
/// </summary>
/// <param name="Position">
/// Step number within the approval route — 1..n. This is what a reviewer is shown; it is NOT
/// <paramref name="Order"/>, which is the master-data sort key across the whole lifecycle (SBMIT is 4
/// there, after Invited/Responded/Draft) and would read as "step 4" for the first approval.
/// </param>
public sealed record ApprovalStationProgressDto(
    string StatusCode,
    int Position,
    int Order,
    string Name,
    string? ApproverRoleCode,
    string? ApproverRoleName,
    int? SlaDays,
    string State,
    DateTimeOffset? EnteredAt,
    DateTimeOffset? LeftAt,
    string? ActorId,
    string? ActorName,
    int? WorkingDaysTaken,
    DateOnly? DueDate,
    string SlaStatus);

public static class ApprovalStationStates
{
    public const string Pending = "Pending";
    public const string Current = "Current";
    public const string Done = "Done";
}

/// <summary>Outcome of an approval decision; mirrors what the endpoints need to answer with.</summary>
public sealed record ApprovalActionOutcome(
    bool Ok,
    bool Forbidden,
    string? Error,
    string? NextApproverRoleCode,
    bool NextApprovalIsFinal)
{
    public static ApprovalActionOutcome Success(string? nextRoleCode, bool nextApprovalIsFinal = false) =>
        new(true, false, null, nextRoleCode, nextApprovalIsFinal);

    public static ApprovalActionOutcome Invalid(string error) =>
        new(false, false, error, null, false);

    public static ApprovalActionOutcome Denied(string error) =>
        new(false, true, error, null, false);
}

/// <summary>Internal role lookups the approval chain needs (roles of an actor, role display names).</summary>
public interface IInternalRoleReadPort
{
    Task<IReadOnlyList<string>> GetActorRoleCodesAsync(string actorId, CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<string, string>> GetRoleNamesAsync(CancellationToken cancellationToken);
}

/// <summary>Raised when a vendor cannot move the way the caller asked.</summary>
public sealed class VendorApprovalException : Exception
{
    public VendorApprovalException(string message) : base(message)
    {
    }
}
