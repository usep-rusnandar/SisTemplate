using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class WilayahSyncHttpPolicyTests
{
    [Fact]
    public void RetriesThrottleAndGatewayStatuses()
    {
        Assert.True(WilayahSyncHttpPolicy.ShouldRetry(System.Net.HttpStatusCode.TooManyRequests));
        Assert.True(WilayahSyncHttpPolicy.ShouldRetry(System.Net.HttpStatusCode.ServiceUnavailable));
        Assert.True(WilayahSyncHttpPolicy.ShouldRetry(System.Net.HttpStatusCode.BadGateway));
        Assert.False(WilayahSyncHttpPolicy.ShouldRetry(System.Net.HttpStatusCode.NotFound));
        Assert.False(WilayahSyncHttpPolicy.ShouldRetry(System.Net.HttpStatusCode.BadRequest));
        Assert.False(WilayahSyncHttpPolicy.ShouldRetry(System.Net.HttpStatusCode.Forbidden));
    }

    [Fact]
    public void DelayDoublesThenCaps()
    {
        Assert.Equal(TimeSpan.FromMilliseconds(500), WilayahSyncHttpPolicy.DelayBeforeRetry(0, jitterMs: 0));
        Assert.Equal(TimeSpan.FromMilliseconds(1000), WilayahSyncHttpPolicy.DelayBeforeRetry(1, jitterMs: 0));
        Assert.Equal(TimeSpan.FromMilliseconds(8000), WilayahSyncHttpPolicy.DelayBeforeRetry(10, jitterMs: 0));
    }

    [Fact]
    public void RetryAfterIsHonouredButCapped()
    {
        Assert.Equal(TimeSpan.FromSeconds(3), WilayahSyncHttpPolicy.DelayBeforeRetry(0, TimeSpan.FromSeconds(3), 0));
        Assert.Equal(WilayahSyncHttpPolicy.MaxRetryAfter, WilayahSyncHttpPolicy.DelayBeforeRetry(0, TimeSpan.FromMinutes(2), 0));
    }
}

public sealed class WilayahSyncCompletenessTests
{
    [Fact]
    public void ReplaceOnlyWhenNoParentFailed()
    {
        Assert.True(WilayahSyncCompleteness.CanReplace(0));
        Assert.False(WilayahSyncCompleteness.CanReplace(1));
        Assert.False(WilayahSyncCompleteness.CanReplace(12));
    }

    [Fact]
    public void IncompleteMessageKeepsExistingData()
    {
        var message = WilayahSyncCompleteness.IncompleteMessage("village", 12, 7285);
        Assert.Contains("12/7285", message);
        Assert.Contains("existing village data kept", message);
    }
}

public sealed class WilayahDatasetStampTests
{
    [Fact]
    public void ParsesIsoDate()
    {
        Assert.Equal(new DateOnly(2025, 7, 4), WilayahDatasetStamp.Parse("2025-07-04"));
        Assert.Equal("2025-07-04", WilayahDatasetStamp.Format(new DateOnly(2025, 7, 4)));
        Assert.Null(WilayahDatasetStamp.Parse(null));
        Assert.Null(WilayahDatasetStamp.Parse("not-a-date"));
    }

    [Fact]
    public void SkipRequiresMatchingStampAndProvinceCount()
    {
        var stamp = new DateOnly(2025, 7, 4);
        Assert.True(WilayahDatasetStamp.ShouldSkipRefresh(stamp, stamp, 38, 38, requireVillages: true, lastVillageCount: 83_762));
        Assert.False(WilayahDatasetStamp.ShouldSkipRefresh(stamp, stamp, 38, 38, requireVillages: true, lastVillageCount: 0));
        Assert.False(WilayahDatasetStamp.ShouldSkipRefresh(stamp, new DateOnly(2024, 1, 1), 38, 38, true, 83_762));
        Assert.False(WilayahDatasetStamp.ShouldSkipRefresh(stamp, stamp, 38, 37, true, 83_762));
        Assert.False(WilayahDatasetStamp.ShouldSkipRefresh(null, stamp, 38, 38, true, 83_762));
        Assert.False(WilayahDatasetStamp.ShouldSkipRefresh(stamp, null, 38, 38, true, 83_762));
    }

    [Fact]
    public void ParsesMetaUpdatedAtFromWilayahEnvelope()
    {
        const string json = """
            {"data":[{"code":"11","name":"Aceh"}],"meta":{"administrative_area_level":1,"updated_at":"2025-07-04"}}
            """;
        var parsed = System.Text.Json.JsonSerializer.Deserialize<Envelope>(json, EnvelopeJson);
        Assert.NotNull(parsed);
        Assert.Equal(new DateOnly(2025, 7, 4), WilayahDatasetStamp.Parse(parsed!.Meta?.UpdatedAt));
    }

    private static readonly System.Text.Json.JsonSerializerOptions EnvelopeJson = new(System.Text.Json.JsonSerializerDefaults.Web);

    private sealed record Envelope(System.Text.Json.JsonElement[]? Data, Meta? Meta);
    private sealed record Meta(
        [property: System.Text.Json.Serialization.JsonPropertyName("administrative_area_level")] int? AdministrativeAreaLevel,
        [property: System.Text.Json.Serialization.JsonPropertyName("updated_at")] string? UpdatedAt);
}
