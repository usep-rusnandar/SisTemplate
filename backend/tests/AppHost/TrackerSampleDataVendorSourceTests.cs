using System.Text.Json;
using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Modules.VendorOnboarding.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Generate Sample Data recommended vendors come from Vendor Database (Registered / RGSTD),
/// not a hardcoded Tracker catalog. These tests do not need LocalDB.
/// </summary>
public sealed class TrackerSampleDataVendorSourceTests
{
    private static readonly string[] RegisteredNames =
    [
        "PT Alpha Terdaftar",
        "PT Beta Terdaftar",
        "PT Gamma Terdaftar",
        "PT Delta Terdaftar",
    ];

    [Fact]
    public async Task EmptyRegisteredPoolFailsWithInsufficientCode()
    {
        var service = CreateService();
        var result = await service.GenerateSampleDataAsync(
            "ELFIKRIE ANDROSS",
            [TenderRow(3)],
            CancellationToken.None);

        Assert.False(result.Ok);
        Assert.Equal("registered_vendors_insufficient", result.ErrorCode);
        Assert.Empty(result.Created);
    }

    [Fact]
    public async Task RequestingMoreVendorsThanRegisteredPoolFails()
    {
        var service = CreateService(
            new RegisteredVendorReadRow("RGST000001", "PT Alpha", "Pic A", "Addr A"),
            new RegisteredVendorReadRow("RGST000002", "PT Beta", "Pic B", "Addr B"),
            new RegisteredVendorReadRow("RGST000003", "PT Gamma", "Pic C", "Addr C"));

        var result = await service.GenerateSampleDataAsync(
            "ELFIKRIE ANDROSS",
            [TenderRow(4)],
            CancellationToken.None);

        Assert.False(result.Ok);
        Assert.Equal("registered_vendors_insufficient", result.ErrorCode);
    }

    [Fact]
    public async Task PicksRegisteredVendorsIntoPayloadWithoutHardcodedCatalog()
    {
        var service = CreateService(
            new RegisteredVendorReadRow("RGST000001", "PT Alpha Terdaftar", "Dewi PIC", "Jl. Alpha 1"),
            new RegisteredVendorReadRow("RGST000002", "PT Beta Terdaftar", "Budi PIC", "Jl. Beta 2"),
            new RegisteredVendorReadRow("RGST000003", "PT Gamma Terdaftar", "Citra PIC", "Jl. Gamma 3"),
            new RegisteredVendorReadRow("RGST000004", "PT Delta Terdaftar", "Dina PIC", "Jl. Delta 4"));

        var result = await service.GenerateSampleDataAsync(
            "ELFIKRIE ANDROSS",
            [TenderRow(4)],
            CancellationToken.None);

        Assert.True(result.Ok);
        Assert.Single(result.Created);
        using var doc = JsonDocument.Parse(result.Created[0].PayloadJson);
        var vendors = doc.RootElement.GetProperty("recommendedVendors");
        Assert.Equal(4, vendors.GetArrayLength());

        var names = vendors.EnumerateArray()
            .Select(item => item.GetProperty("vendorName").GetString() ?? string.Empty)
            .ToArray();
        Assert.Equal(4, names.Distinct(StringComparer.Ordinal).Count());
        Assert.All(names, name => Assert.Contains(name, RegisteredNames));
        Assert.DoesNotContain("PT Tambang Sarana Mandiri", names);

        var first = vendors.EnumerateArray().First();
        Assert.False(string.IsNullOrWhiteSpace(first.GetProperty("vendorId").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(first.GetProperty("director").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(first.GetProperty("address").GetString()));
    }

    [Fact]
    public async Task MethodMinMaxStillRejectedAsTotalVendorInvalid()
    {
        var service = CreateService(
            new RegisteredVendorReadRow("RGST000001", "PT Alpha", null, null));

        var result = await service.GenerateSampleDataAsync(
            "ELFIKRIE ANDROSS",
            [new SampleProposalItemInput("TM-3", new DateOnly(2026, 10, 12), 2, 50_000_000m)],
            CancellationToken.None);

        Assert.False(result.Ok);
        Assert.Equal("total_vendor_invalid", result.ErrorCode);
    }

    private static SampleProposalItemInput TenderRow(int totalVendor) =>
        new("TM-1", new DateOnly(2026, 10, 12), totalVendor, 100_000_000m, "ALDJI ISMAIL KAHAR", "READY");

    private static ProposalTrackerService CreateService(params RegisteredVendorReadRow[] vendors) =>
        new(new RecordingTrackerRepository(), new StubRegisteredVendors(vendors));

    private sealed class StubRegisteredVendors : IRegisteredVendorReadPort
    {
        private readonly IReadOnlyList<RegisteredVendorReadRow> _rows;

        public StubRegisteredVendors(IReadOnlyList<RegisteredVendorReadRow> rows) => _rows = rows;

        public Task<IReadOnlyList<RegisteredVendorReadRow>> ListRegisteredAsync(CancellationToken cancellationToken) =>
            Task.FromResult(_rows);
    }

    private sealed class RecordingTrackerRepository : IProposalTrackerRepository
    {
        public void AddProposal(TrackerProposal proposal)
        {
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<IReadOnlyList<TrackerProposal>> ListProposalsAsync(CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyDictionary<string, TrackerProposal>> GetProposalsByKeyAsync(bool tracking, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<TrackerProposal?> GetProposalAsync(string proposalIdOrNumber, bool tracking, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<TrackerProposalActivity>> GetActivitiesAsync(string proposalKey, bool tracking, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<TrackerProposalActivity>> ListActivitiesAsync(CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<TrackerLoaDocument>> ListLoaDocumentsAsync(CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<TrackerLoaDocument>> GetLoaDocumentsAsync(string proposalKey, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<TrackerLoaDocument?> FindLoaDocumentAsync(string proposalKey, string activityKey, string vendorId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public void AddLoaDocument(TrackerLoaDocument document) => throw new NotSupportedException();

        public Task<ProposalAwardResult?> GetAwardResultAsync(string proposalKey, bool tracking, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<ProposalAwardResultVendor>> GetAwardResultVendorsAsync(string proposalKey, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public void AddAwardResult(ProposalAwardResult result) => throw new NotSupportedException();

        public Task ReplaceAwardResultVendorsAsync(string proposalKey, IReadOnlyCollection<ProposalAwardResultVendor> vendors, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
