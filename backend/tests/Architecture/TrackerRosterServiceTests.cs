using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Platform.InternalIdentity.Application.Directory;

namespace IntegratedProcurement.ArchitectureTests;

public sealed class TrackerRosterServiceTests
{
    private const string SuperAdmin = "Super Admin";
    private const string TrackerAdmin = "Administrator Proposal Tracker";
    private const string DivisionHead = "Division Head";
    private const string DepartmentHead = "Department Head Proposal Tracker";
    private const string SectionHead = "Section Head Proposal Tracker";
    private const string Officer = "Officer Proposal Tracker";

    [Fact]
    public async Task SuperAdminUnscoped_ReturnsEveryOfficer()
    {
        var result = await Roster().GetAssignableUsersAsync("00109610", null, CancellationToken.None);

        Assert.Equal(["AHMAD ZAKKI IDHAM", "DINDA SEKAR KINANTI", "FIANI NUR AMALIA", "MAI RISNAWATI"], result.Officers);
    }

    [Fact]
    public async Task SuperAdminImpersonatingSectionHead_ReturnsOnlyOfficersUnderThatHead()
    {
        var result = await Roster().GetAssignableUsersAsync("00109610", "80006600", CancellationToken.None);

        Assert.Equal(["DINDA SEKAR KINANTI", "FIANI NUR AMALIA"], result.Officers);
    }

    [Fact]
    public async Task SectionHeadActor_ReturnsOnlyDirectReportOfficers()
    {
        var result = await Roster().GetAssignableUsersAsync("80006600", null, CancellationToken.None);

        Assert.Equal(["DINDA SEKAR KINANTI", "FIANI NUR AMALIA"], result.Officers);
    }

    [Fact]
    public async Task DepartmentHeadActor_ReturnsOfficersUnderSectionHeads()
    {
        var result = await Roster().GetAssignableUsersAsync("80005516", null, CancellationToken.None);

        Assert.Equal(["DINDA SEKAR KINANTI", "FIANI NUR AMALIA", "MAI RISNAWATI"], result.Officers);
    }

    [Fact]
    public async Task DivisionHeadActor_ReturnsOfficersInTheTree()
    {
        var result = await Roster().GetAssignableUsersAsync("12080430", null, CancellationToken.None);

        Assert.Equal(["DINDA SEKAR KINANTI", "FIANI NUR AMALIA", "MAI RISNAWATI"], result.Officers);
    }

    [Fact]
    public async Task UnknownActor_ReturnsNoOfficers()
    {
        var result = await Roster().GetAssignableUsersAsync("missing", null, CancellationToken.None);

        Assert.Empty(result.Officers);
        Assert.Equal("none", result.VisibilityMode);
    }

    [Fact]
    public async Task SuperAdminUnknownImpersonationTarget_ReturnsNoOfficers()
    {
        var result = await Roster().GetAssignableUsersAsync("00109610", "99999999", CancellationToken.None);

        Assert.Empty(result.Officers);
    }

    [Fact]
    public async Task SuperAdminImpersonatingSectionHead_CannotAssignOfficerOutsideTree()
    {
        var gate = await Roster().EnsureAssignableOfficerAsync(
            "00109610", "80006600", "MAI RISNAWATI", CancellationToken.None);

        Assert.False(gate.Ok);
        Assert.True(gate.Forbidden);
    }

    [Fact]
    public async Task SuperAdminImpersonatingSectionHead_CanAssignOfficerUnderThatHead()
    {
        var gate = await Roster().EnsureAssignableOfficerAsync(
            "00109610", "80006600", "DINDA SEKAR KINANTI", CancellationToken.None);

        Assert.True(gate.Ok);
    }

    [Fact]
    public async Task SectionHead_CannotAssignUnknownOfficer()
    {
        var gate = await Roster().EnsureAssignableOfficerAsync(
            "80006600", null, "NOT AN OFFICER", CancellationToken.None);

        Assert.False(gate.Ok);
        Assert.Equal("assigned_officer_unknown", gate.ErrorCode);
    }

    [Fact]
    public async Task TrackerAdminUnscoped_MayAssignAnyOfficer()
    {
        var gate = await Roster().EnsureAssignableOfficerAsync(
            "admin-trk", null, "MAI RISNAWATI", CancellationToken.None);

        Assert.True(gate.Ok);
    }

    [Fact]
    public async Task SectionHeadWhoAlsoHasSuperAdmin_ReturnsOnlyOfficersUnderThatHead()
    {
        var result = await Roster(SeedOrg(ariAlsoSuperAdmin: true))
            .GetAssignableUsersAsync("80006600", null, CancellationToken.None);

        Assert.Equal(["DINDA SEKAR KINANTI", "FIANI NUR AMALIA"], result.Officers);
    }

    [Fact]
    public async Task SuperAdminImpersonatingSectionHeadWhoIsAlsoAdmin_ReturnsOnlyOfficersUnderThatHead()
    {
        var result = await Roster(SeedOrg(ariAlsoSuperAdmin: true))
            .GetAssignableUsersAsync("00109610", "80006600", CancellationToken.None);

        Assert.Equal(["DINDA SEKAR KINANTI", "FIANI NUR AMALIA"], result.Officers);
    }

    [Fact]
    public async Task SectionHeadWhoAlsoHasSuperAdmin_CannotAssignOfficerOutsideTree()
    {
        var gate = await Roster(SeedOrg(ariAlsoSuperAdmin: true)).EnsureAssignableOfficerAsync(
            "80006600", null, "MAI RISNAWATI", CancellationToken.None);

        Assert.False(gate.Ok);
        Assert.True(gate.Forbidden);
    }

    private static TrackerRosterService Roster(IReadOnlyList<InternalDirectoryPerson>? people = null) =>
        new(new FakeDirectory(people ?? SeedOrg()));

    private static IReadOnlyList<InternalDirectoryPerson> SeedOrg(bool ariAlsoSuperAdmin = false)
    {
        var usepId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var benjaminId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var andyId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var ariId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var elfikrieId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var dindaId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        var fianiId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var maiId = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var zakkiId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        var adminId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

        return
        [
            Person(usepId, "00109610", "USEP RUSNANDAR", SuperAdmin, null),
            Person(adminId, "admin-trk", "TRACKER ADMIN", TrackerAdmin, null),
            Person(benjaminId, "12080430", "BENJAMIN L. RUMBI", DivisionHead, null),
            Person(andyId, "80005516", "ANDY PRASETIO WIBOWO", DepartmentHead, benjaminId),
            Person(ariId, "80006600", "ARI PAMUNGKAS", SectionHead, andyId,
                ariAlsoSuperAdmin ? SuperAdmin : null),
            Person(elfikrieId, "00109501", "ELFIKRIE ANDROSS", SectionHead, andyId),
            Person(dindaId, "80005716", "DINDA SEKAR KINANTI", Officer, ariId),
            Person(fianiId, "80009423", "FIANI NUR AMALIA", Officer, ariId),
            Person(maiId, "80002388", "MAI RISNAWATI", Officer, elfikrieId),
            Person(zakkiId, "80010029", "AHMAD ZAKKI IDHAM", Officer, null),
        ];
    }

    private static InternalDirectoryPerson Person(
        Guid id,
        string personnelNo,
        string name,
        string role,
        Guid? managerId,
        string? extraRole = null)
    {
        string[] roles = string.IsNullOrWhiteSpace(extraRole) ? [role] : [role, extraRole];
        return new(id, personnelNo, name, $"{personnelNo}@example.com", managerId, roles, roles);
    }

    private sealed class FakeDirectory(IReadOnlyList<InternalDirectoryPerson> people) : IInternalDirectoryReadPort
    {
        public Task<InternalDirectoryPerson?> FindByPersonnelNoAsync(
            string personnelNo,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(personnelNo))
            {
                return Task.FromResult<InternalDirectoryPerson?>(null);
            }

            return Task.FromResult(people.FirstOrDefault(person =>
                string.Equals(person.PersonnelNo, personnelNo.Trim(), StringComparison.OrdinalIgnoreCase)));
        }

        public Task<IReadOnlyList<InternalDirectoryPerson>> ListActiveWithAnyRoleNameAsync(
            IReadOnlyCollection<string> roleNames,
            CancellationToken cancellationToken = default)
        {
            var names = roleNames.ToHashSet(StringComparer.OrdinalIgnoreCase);
            IReadOnlyList<InternalDirectoryPerson> matches = people
                .Where(person => person.RoleNames.Any(role => names.Contains(role)))
                .ToArray();
            return Task.FromResult(matches);
        }

        public Task<IReadOnlyList<InternalDirectoryRecipient>> ListActiveRecipientsByRoleCodeAsync(
            string roleCode,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<InternalDirectoryRecipient>>([]);

        public Task<IReadOnlyList<string>> GetRoleCodesForActorAsync(
            string actorId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<string>>([]);

        public Task<IReadOnlyDictionary<string, string>> GetRoleNamesByCodeAsync(
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>());

        public Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesAsync(
            IReadOnlyCollection<string?> keys,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>());
    }
}
