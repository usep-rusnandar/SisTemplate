using IntegratedProcurement.Platform.Administration.Application;
using IntegratedProcurement.Platform.Administration.Infrastructure;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class BackgroundProcessScheduleTests
{
    [Fact]
    public void MonthlyWibConvertsUtcHourToJakarta()
    {
        Assert.Equal("Day 1 of each month at 07:00 WIB", BackgroundProcessSchedule.MonthlyWib(1, 0));
        Assert.Equal("Day 1 of each month at 00:00 WIB", BackgroundProcessSchedule.MonthlyWib(1, 17));
    }

    [Fact]
    public void NextMonthlyUtcIsStrictlyAfterFrom()
    {
        var from = new DateTimeOffset(2026, 8, 1, 17, 0, 0, TimeSpan.Zero);
        var next = BackgroundProcessSchedule.NextMonthlyUtc(from, dayOfMonth: 1, hourUtc: 17);
        Assert.Equal(new DateTimeOffset(2026, 9, 1, 17, 0, 0, TimeSpan.Zero), next);
    }

    [Fact]
    public void NextMonthlyUtcKeepsThisMonthWhenStillUpcoming()
    {
        var from = new DateTimeOffset(2026, 8, 1, 16, 59, 0, TimeSpan.Zero);
        var next = BackgroundProcessSchedule.NextMonthlyUtc(from, dayOfMonth: 1, hourUtc: 17);
        Assert.Equal(new DateTimeOffset(2026, 8, 1, 17, 0, 0, TimeSpan.Zero), next);
    }

    [Fact]
    public void IntervalCopyIsJakartaFacing()
    {
        Assert.Equal("Every 30 minutes", BackgroundProcessSchedule.EveryMinutes(30));
        Assert.Equal(
            "Every 24 hours (first run 2 minutes after host start)",
            BackgroundProcessSchedule.EveryHoursAfterStartup(TimeSpan.FromMinutes(2), TimeSpan.FromHours(24)));
    }
}

public sealed class BackgroundProcessCatalogTests
{
    [Fact]
    public async Task ListFollowsCanonicalOrderAndDropsUnknownRunners()
    {
        var catalog = new BackgroundProcessCatalog(
            [
                new StubSource(BackgroundProcessKeys.ContractReminderScan),
                new StubSource(BackgroundProcessKeys.WilayahSync),
                new StubSource("customExtra"),
                new StubSource(BackgroundProcessKeys.Retention),
            ],
            [new StubRunner(BackgroundProcessKeys.Retention, BackgroundProcessOutcomes.Completed, "ok")]);

        var listed = await catalog.ListAsync(CancellationToken.None);
        Assert.Equal(BackgroundProcessSchedule.ArchitectureNote, listed.ArchitectureNote);
        Assert.Equal(
            new[]
            {
                BackgroundProcessKeys.WilayahSync,
                BackgroundProcessKeys.Retention,
                BackgroundProcessKeys.ContractReminderScan,
                "customExtra",
            },
            listed.Items.Select(item => item.Key).ToArray());

        var rejected = await catalog.RunNowAsync("customExtra", CancellationToken.None);
        Assert.Equal(BackgroundProcessOutcomes.Rejected, rejected.Outcome);
        Assert.Equal("not_runnable", rejected.Message);

        var ran = await catalog.RunNowAsync(BackgroundProcessKeys.Retention, CancellationToken.None);
        Assert.Equal(BackgroundProcessOutcomes.Completed, ran.Outcome);
        Assert.Equal("ok", ran.Message);
        Assert.NotNull(ran.Process);
    }

    [Fact]
    public async Task UnknownKeyIsRejectedWithoutAProcessRow()
    {
        var catalog = new BackgroundProcessCatalog([], []);
        var result = await catalog.RunNowAsync("missing", CancellationToken.None);
        Assert.Equal(BackgroundProcessOutcomes.Rejected, result.Outcome);
        Assert.Null(result.Process);
    }

    private sealed class StubSource(string key) : IBackgroundProcessSource
    {
        public string Key { get; } = key;

        public Task<BackgroundProcessDto> GetStatusAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new BackgroundProcessDto(
                Key,
                Key,
                "superAdmin",
                BackgroundProcessKinds.Scheduled,
                true,
                true,
                null,
                "test",
                null,
                null,
                null,
                null,
                false,
                false,
                null,
                null,
                null));
    }

    private sealed class StubRunner(string key, string outcome, string message) : IBackgroundProcessRunner
    {
        public string Key { get; } = key;

        public Task<BackgroundProcessRunResult> RunNowAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new BackgroundProcessRunResult(outcome, message));
    }
}

public sealed class BackgroundProcessRuntimeStoreTests
{
    [Fact]
    public void MarkSucceededKeepsExistingNextRunWhenOmitted()
    {
        var store = new BackgroundProcessRuntimeStore();
        var next = DateTimeOffset.UtcNow.AddHours(4);
        store.SetNextRun("retention", next);
        store.MarkRunning("retention", DateTimeOffset.UtcNow);
        store.MarkSucceeded("retention", DateTimeOffset.UtcNow, "audit=0", nextRunAt: null);

        var snapshot = store.SnapshotFor("retention");
        Assert.NotNull(snapshot);
        Assert.False(snapshot.Running);
        Assert.Equal("audit=0", snapshot.LastResult);
        Assert.Equal(next, snapshot.NextRunAt);
    }
}
