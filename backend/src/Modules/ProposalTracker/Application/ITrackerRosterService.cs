namespace IntegratedProcurement.Modules.ProposalTracker.Application;

public interface ITrackerRosterService
{
    Task<TrackerAssignableUsersResult> GetAssignableUsersAsync(
        string? actorPersonnelNo,
        string? scopedPersonnelNo,
        CancellationToken cancellationToken);

    Task<TrackerOfficerAssignmentGate> EnsureAssignableOfficerAsync(
        string? actorPersonnelNo,
        string? scopedPersonnelNo,
        string? assignedOfficerName,
        CancellationToken cancellationToken);

    Task<TrackerSampleOwnerGate> ResolveSampleOwnerAsync(
        string? actorPersonnelNo,
        string? scopedPersonnelNo,
        CancellationToken cancellationToken);
}

public sealed record TrackerAssignableUsersResult(
    IReadOnlyCollection<string> SectionHeads,
    IReadOnlyCollection<string> Officers,
    string VisibilityMode,
    IReadOnlyCollection<string> OwnerNamesUnder);

public sealed record TrackerOfficerAssignmentGate(bool Ok, bool Forbidden, string? ErrorCode, string? AssignedOfficerName)
{
    public static TrackerOfficerAssignmentGate Allowed() => new(true, false, null, null);

    public static TrackerOfficerAssignmentGate MissingOfficer() =>
        new(false, false, "assigned_officer_required", null);

    public static TrackerOfficerAssignmentGate Unknown(string officerName) =>
        new(false, false, "assigned_officer_unknown", officerName);

    public static TrackerOfficerAssignmentGate Deny() => new(false, true, null, null);
}

public sealed record TrackerSampleOwnerGate(bool Ok, bool Forbidden, string? OwnerName, string? ErrorCode)
{
    public static TrackerSampleOwnerGate Forbid() => new(false, true, null, null);

    public static TrackerSampleOwnerGate OwnerNotFound() => new(false, false, null, "owner_not_found");

    public static TrackerSampleOwnerGate Ready(string ownerName) => new(true, false, ownerName, null);
}
