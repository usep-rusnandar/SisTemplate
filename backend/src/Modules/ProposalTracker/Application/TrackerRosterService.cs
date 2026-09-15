using IntegratedProcurement.Platform.InternalIdentity.Application.Directory;

namespace IntegratedProcurement.Modules.ProposalTracker.Application;

public sealed class TrackerRosterService : ITrackerRosterService
{
    private const string SectionHeadRole = "Section Head Proposal Tracker";
    private const string OfficerRole = "Officer Proposal Tracker";
    private const string SuperAdminRole = "Super Admin";
    private const string TrackerAdminRole = "Administrator Proposal Tracker";
    private const string DivisionHeadRole = "Division Head";
    private const string DepartmentHeadRole = "Department Head Proposal Tracker";

    /// <summary>
    /// Roster must include the management chain so officer filtering can walk
    /// Division Head → Department Head → Section Head → Officer.
    /// </summary>
    private static readonly string[] TrackerRosterRoleNames =
    [
        DivisionHeadRole,
        DepartmentHeadRole,
        SectionHeadRole,
        OfficerRole
    ];

    private readonly IInternalDirectoryReadPort _directory;

    public TrackerRosterService(IInternalDirectoryReadPort directory)
    {
        _directory = directory;
    }

    public async Task<TrackerAssignableUsersResult> GetAssignableUsersAsync(
        string? actorPersonnelNo,
        string? scopedPersonnelNo,
        CancellationToken cancellationToken)
    {
        var roster = await _directory.ListActiveWithAnyRoleNameAsync(TrackerRosterRoleNames, cancellationToken);
        var sectionHeads = roster
            .Where(user => HasRole(user.RoleNames, SectionHeadRole))
            .Select(user => user.CompleteName)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(name => name)
            .ToArray();

        var actor = await ResolveActorAsync(actorPersonnelNo, scopedPersonnelNo, cancellationToken);
        var officerNames = FilterAssignableOfficers(actor, roster)
            .Select(user => user.CompleteName)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(name => name)
            .ToArray();

        var visibility = BuildVisibility(actor, roster);
        return new TrackerAssignableUsersResult(
            sectionHeads,
            officerNames,
            visibility.Mode,
            visibility.OwnerNamesUnder);
    }

    public async Task<TrackerOfficerAssignmentGate> EnsureAssignableOfficerAsync(
        string? actorPersonnelNo,
        string? scopedPersonnelNo,
        string? assignedOfficerName,
        CancellationToken cancellationToken)
    {
        var officerName = Clean(assignedOfficerName);
        if (officerName is null)
        {
            return TrackerOfficerAssignmentGate.MissingOfficer();
        }

        var roster = await _directory.ListActiveWithAnyRoleNameAsync(TrackerRosterRoleNames, cancellationToken);
        var officer = roster.FirstOrDefault(user =>
            HasRole(user.RoleNames, OfficerRole)
            && string.Equals(user.CompleteName, officerName, StringComparison.OrdinalIgnoreCase));
        if (officer is null)
        {
            return TrackerOfficerAssignmentGate.Unknown(officerName);
        }

        var actor = await ResolveActorAsync(actorPersonnelNo, scopedPersonnelNo, cancellationToken);
        if (actor is null)
        {
            return TrackerOfficerAssignmentGate.Deny();
        }

        // A tracker ops role (Section / Department / Division Head) always uses the org tree,
        // even when the same person also holds Super Admin or Tracker Admin. Otherwise a
        // leftover admin grant on staging (or an impersonated head who is also an admin)
        // leaks every officer into Distribute / Generate Sample Data.
        if (HasOpsOfficerScope(actor.RoleNames))
        {
            return FilterAssignableOfficers(actor, roster)
                .Any(user => user.UserId == officer.UserId)
                ? TrackerOfficerAssignmentGate.Allowed()
                : TrackerOfficerAssignmentGate.Deny();
        }

        if (ActorMayAssignAnyOfficer(actor.RoleNames))
        {
            return TrackerOfficerAssignmentGate.Allowed();
        }

        return TrackerOfficerAssignmentGate.Deny();
    }

    public async Task<TrackerSampleOwnerGate> ResolveSampleOwnerAsync(
        string? actorPersonnelNo,
        string? scopedPersonnelNo,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(actorPersonnelNo, scopedPersonnelNo, cancellationToken);
        if (actor is null || !HasRole(actor.RoleNames, SectionHeadRole))
        {
            return TrackerSampleOwnerGate.Forbid();
        }

        return string.IsNullOrWhiteSpace(actor.CompleteName)
            ? TrackerSampleOwnerGate.OwnerNotFound()
            : TrackerSampleOwnerGate.Ready(actor.CompleteName);
    }

    private async Task<InternalDirectoryPerson?> ResolveActorAsync(
        string? actorPersonnelNo,
        string? scopedPersonnelNo,
        CancellationToken cancellationToken)
    {
        var realActor = await _directory.FindByPersonnelNoAsync(actorPersonnelNo ?? string.Empty, cancellationToken);
        var scoped = Clean(scopedPersonnelNo);
        if (scoped is not null && realActor is not null && ActorMayAssignAnyOfficer(realActor.RoleNames))
        {
            // Impersonation is frontend-only: Super Admin / Tracker Admin may scope the roster to
            // another user. An unknown target must not fall back to the unscoped admin list.
            return await _directory.FindByPersonnelNoAsync(scoped, cancellationToken);
        }

        return realActor;
    }

    private static IEnumerable<InternalDirectoryPerson> FilterAssignableOfficers(
        InternalDirectoryPerson? actor,
        IReadOnlyList<InternalDirectoryPerson> roster)
    {
        var officers = roster.Where(user => HasRole(user.RoleNames, OfficerRole));
        if (actor is null)
        {
            return [];
        }

        if (HasOpsOfficerScope(actor.RoleNames))
        {
            var descendantIds = CollectDescendantUserIds(actor.UserId, roster);
            return officers.Where(user => descendantIds.Contains(user.UserId));
        }

        if (ActorMayAssignAnyOfficer(actor.RoleNames))
        {
            return officers;
        }

        return [];
    }

    private static (string Mode, IReadOnlyCollection<string> OwnerNamesUnder) BuildVisibility(
        InternalDirectoryPerson? actor,
        IReadOnlyList<InternalDirectoryPerson> roster)
    {
        if (actor is null)
        {
            return ("none", Array.Empty<string>());
        }

        if (HasRole(actor.RoleNames, DivisionHeadRole))
        {
            return ("all", Array.Empty<string>());
        }

        if (HasRole(actor.RoleNames, DepartmentHeadRole))
        {
            var descendantIds = CollectDescendantUserIds(actor.UserId, roster);
            var ownerNames = roster
                .Where(user => descendantIds.Contains(user.UserId) && HasRole(user.RoleNames, SectionHeadRole))
                .Select(user => user.CompleteName)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToArray();
            return ("ownersUnder", ownerNames);
        }

        if (HasRole(actor.RoleNames, SectionHeadRole))
        {
            return ("owned", Array.Empty<string>());
        }

        if (HasRole(actor.RoleNames, OfficerRole))
        {
            return ("assigned", Array.Empty<string>());
        }

        return ("none", Array.Empty<string>());
    }

    private static HashSet<Guid> CollectDescendantUserIds(
        Guid rootUserId,
        IReadOnlyList<InternalDirectoryPerson> roster)
    {
        var childrenByManager = roster
            .Where(user => user.ManagerUserId is not null)
            .GroupBy(user => user.ManagerUserId!.Value)
            .ToDictionary(group => group.Key, group => group.Select(user => user.UserId).ToArray());

        var result = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(rootUserId);
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!childrenByManager.TryGetValue(current, out var children))
            {
                continue;
            }

            foreach (var childId in children)
            {
                if (result.Add(childId))
                {
                    queue.Enqueue(childId);
                }
            }
        }

        return result;
    }

    private static bool HasOpsOfficerScope(IReadOnlyCollection<string> roles) =>
        HasRole(roles, DivisionHeadRole)
        || HasRole(roles, DepartmentHeadRole)
        || HasRole(roles, SectionHeadRole);

    private static bool ActorMayAssignAnyOfficer(IReadOnlyCollection<string> roles) =>
        HasRole(roles, SuperAdminRole) || HasRole(roles, TrackerAdminRole);

    private static bool HasRole(IReadOnlyCollection<string> roles, string roleName) =>
        roles.Any(role => string.Equals(role, roleName, StringComparison.OrdinalIgnoreCase));

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
