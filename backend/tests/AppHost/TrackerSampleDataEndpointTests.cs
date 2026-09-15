using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using IntegratedProcurement.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Generate Sample Data is the Tracker retest entry point while E-Proposal ingest is off.
/// Anonymous callers must 401 (not hang on an SSO HTML redirect). A Section Head can create
/// Ready-to-Distribute rows; Super Admin needs to impersonate a Section Head via forPersonnelNo.
/// Recommended vendors come from Vendor Database status Registered (RGSTD).
/// </summary>
public sealed class TrackerSampleDataEndpointTests : IClassFixture<IsolatedApiFixture>
{
    private const string SectionHeadPersonnelNo = "00109501";
    private const string SuperAdminPersonnelNo = "00109610";

    private static readonly (string Id, string Name, string Address)[] RegisteredVendors =
    [
        ("RGST000001", "PT Sample Registered Satu", "Jl. Sample 1"),
        ("RGST000002", "PT Sample Registered Dua", "Jl. Sample 2"),
        ("RGST000003", "PT Sample Registered Tiga", "Jl. Sample 3"),
        ("RGST000004", "PT Sample Registered Empat", "Jl. Sample 4"),
    ];

    private readonly IsolatedApiFixture _factory;

    public TrackerSampleDataEndpointTests(IsolatedApiFixture factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AnonymousCallerIsUnauthorized()
    {
        using var client = _factory.CreateClient();
        using var response = await client.PostAsJsonAsync(
            "/api/v1/proposal-tracker/sample-data",
            OneRow());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SectionHeadCanGenerateScreenshotShapedRows()
    {
        await SeedVendorPoolAsync();
        using var client = _factory.CreateClient();
        await DevLoginAsync(client, SectionHeadPersonnelNo);

        using var response = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/sample-data?forPersonnelNo={SectionHeadPersonnelNo}",
            ScreenshotRows());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(5, payload.GetProperty("created").GetInt32());
        Assert.Equal("ELFIKRIE ANDROSS", payload.GetProperty("ownerName").GetString());
        Assert.Equal(5, payload.GetProperty("proposals").GetArrayLength());

        var allowedNames = RegisteredVendors.Select(row => row.Name).ToHashSet(StringComparer.Ordinal);
        foreach (var proposal in payload.GetProperty("proposals").EnumerateArray())
        {
            var vendors = proposal.GetProperty("recommendedVendors");
            Assert.True(vendors.GetArrayLength() >= 1);
            foreach (var vendor in vendors.EnumerateArray())
            {
                var name = vendor.GetProperty("vendorName").GetString() ?? string.Empty;
                Assert.Contains(name, allowedNames);
                Assert.NotEqual("PT Tambang Sarana Mandiri", name);
            }
        }
    }

    [Fact]
    public async Task SuperAdminWithoutSectionHeadScopeIsForbidden()
    {
        using var client = _factory.CreateClient();
        await DevLoginAsync(client, SuperAdminPersonnelNo);

        using var response = await client.PostAsJsonAsync(
            "/api/v1/proposal-tracker/sample-data",
            OneRow());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GenerateFailsWhenRegisteredPoolIsSmallerThanTotalVendor()
    {
        await SeedVendorPoolAsync();
        using var client = _factory.CreateClient();
        await DevLoginAsync(client, SectionHeadPersonnelNo);

        using var response = await client.PostAsJsonAsync(
            $"/api/v1/proposal-tracker/sample-data?forPersonnelNo={SectionHeadPersonnelNo}",
            new
            {
                items = new object[]
                {
                    new { trackerMethod = "TM-1", requirementDate = "2026-10-12", totalVendor = 6, amount = 100_000_000m, assignedOfficerName = "ALDJI ISMAIL KAHAR", lastStepCode = "READY" },
                },
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("registered_vendors_insufficient", payload.GetProperty("code").GetString());
    }

    private async Task SeedVendorPoolAsync()
    {
        using var scope = _factory.Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        foreach (var row in RegisteredVendors)
        {
            if (await dbContext.Vendors.AnyAsync(vendor => vendor.Id == row.Id))
            {
                continue;
            }

            var vendor = Vendor.ImportLegacy(row.Id, row.Name, VendorStatuses.Registered);
            vendor.SetOfficeAddress(VendorAddress.Create(row.Address, null, null, null, null, null, null, "Indonesia", null, null));
            dbContext.Vendors.Add(vendor);
        }

        if (!await dbContext.Vendors.AnyAsync(vendor => vendor.Id == "DRFT000001"))
        {
            dbContext.Vendors.Add(Vendor.ImportLegacy("DRFT000001", "PT Draft Should Be Ignored", VendorStatuses.Draft));
        }

        if (!await dbContext.Vendors.AnyAsync(vendor => vendor.Id == "APPR000001"))
        {
            dbContext.Vendors.Add(Vendor.ImportLegacy("APPR000001", "PT Approved Not Registered", VendorStatuses.Approved));
        }

        await dbContext.SaveChangesAsync();
    }

    private static object OneRow() => new
    {
        items = new object[]
        {
            new { trackerMethod = "TM-1", requirementDate = "2026-10-12", totalVendor = 3, amount = 100_000_000m, assignedOfficerName = "ALDJI ISMAIL KAHAR", lastStepCode = "READY" },
        },
    };

    private static object ScreenshotRows() => new
    {
        items = new object[]
        {
            new { trackerMethod = "TM-1", requirementDate = "2026-10-12", totalVendor = 3, amount = 100_000_000m, assignedOfficerName = "ALDJI ISMAIL KAHAR", lastStepCode = "READY" },
            new { trackerMethod = "TM-1", requirementDate = "2026-10-12", totalVendor = 4, amount = 50_000_000m, assignedOfficerName = "CELISKA RENIGIYANTI", lastStepCode = "EVAL" },
            new { trackerMethod = "TM-2", requirementDate = "2026-10-12", totalVendor = 2, amount = 100_000_000m, assignedOfficerName = "ALDJI ISMAIL KAHAR", lastStepCode = "RFQ" },
            new { trackerMethod = "TM-1", requirementDate = "2026-10-12", totalVendor = 3, amount = 100_000_000m, assignedOfficerName = "ALDJI ISMAIL KAHAR", lastStepCode = "EVAL" },
            new { trackerMethod = "TM-2", requirementDate = "2026-10-12", totalVendor = 2, amount = 50_000_000m, assignedOfficerName = "CELISKA RENIGIYANTI", lastStepCode = "TIA" },
        },
    };

    private static async Task DevLoginAsync(HttpClient client, string personnelNo)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/v1/internal/auth/dev-login",
            new { personnelNo });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
