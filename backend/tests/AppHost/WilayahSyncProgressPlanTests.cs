using IntegratedProcurement.Platform.Administration.Application;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

public sealed class WilayahSyncProgressPlanTests
{
    [Fact]
    public void VillageFetchProvinceStartIsZero()
    {
        var plan = WilayahSyncProgressPlan.ForDepth(WilayahSyncDepth.Village);
        Assert.Equal(0, plan.Percent(WilayahSyncProgressPlan.FetchProvince, 0, 1));
    }

    [Fact]
    public void VillageWriteCompleteIsOneHundred()
    {
        var plan = WilayahSyncProgressPlan.ForDepth(WilayahSyncDepth.Village);
        Assert.Equal(100, plan.Percent(WilayahSyncProgressPlan.WriteVillage, 80_000, 80_000));
    }

    [Fact]
    public void MidVillageFetchSitsBetweenDistrictWriteAndVillageFetchEnd()
    {
        var plan = WilayahSyncProgressPlan.ForDepth(WilayahSyncDepth.Village);
        var afterDistricts = plan.Percent(WilayahSyncProgressPlan.WriteDistrict, 1, 1);
        var midVillages = plan.Percent(WilayahSyncProgressPlan.FetchVillage, 3_200, 7_200);
        var afterVillageFetch = plan.Percent(WilayahSyncProgressPlan.FetchVillage, 7_200, 7_200);
        Assert.True(afterDistricts < midVillages);
        Assert.True(midVillages < afterVillageFetch);
        Assert.InRange(midVillages, 40, 80);
    }

    [Fact]
    public void ProvinceOnlyWriteCompleteIsOneHundred()
    {
        var plan = WilayahSyncProgressPlan.ForDepth(WilayahSyncDepth.Province);
        Assert.Equal(0, plan.Percent(WilayahSyncProgressPlan.FetchProvince, 0, 1));
        Assert.Equal(67, plan.Percent(WilayahSyncProgressPlan.FetchProvince, 1, 1));
        Assert.Equal(100, plan.Percent(WilayahSyncProgressPlan.WriteProvince, 38, 38));
    }

    [Fact]
    public void ShouldPublishFirstLastAndPercentTicks()
    {
        Assert.True(WilayahSyncProgressPlan.ShouldPublish(1, 7_200));
        Assert.True(WilayahSyncProgressPlan.ShouldPublish(7_200, 7_200));
        Assert.True(WilayahSyncProgressPlan.ShouldPublish(72, 7_200));
        Assert.False(WilayahSyncProgressPlan.ShouldPublish(73, 7_200));
    }

    [Fact]
    public void UnknownStageThrows()
    {
        var plan = WilayahSyncProgressPlan.ForDepth(WilayahSyncDepth.Province);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            plan.Percent(WilayahSyncProgressPlan.FetchVillage, 1, 1));
    }
}
