using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Platform.Persistence.Seeding;

namespace IntegratedProcurement.AppHost.Api.IntegrationTests;

/// <summary>
/// Naming/consistency guard for the RBAC catalog. Fast (no server/DB): asserts the seeder's
/// permission catalog is exactly <see cref="PermissionKeys.All"/> and that every role grant
/// references a seeded key — so permission drift fails the build.
/// </summary>
public sealed class PermissionCatalogGuardTests
{
    [Fact]
    public void SeededPermissionCatalogEqualsPermissionKeysSoT()
    {
        var sot = PermissionKeys.All.ToHashSet(StringComparer.Ordinal);
        var seeded = InitialIamDataSeeder.CatalogPermissionKeys.ToHashSet(StringComparer.Ordinal);

        Assert.Empty(seeded.Except(sot));   // seeded a key not in the SoT
        Assert.Empty(sot.Except(seeded));   // SoT key never seeded
    }

    [Fact]
    public void EveryRoleGrantReferencesASeededPermission()
    {
        var seeded = InitialIamDataSeeder.CatalogPermissionKeys.ToHashSet(StringComparer.Ordinal);
        var unknownGrants = InitialIamDataSeeder.GrantedPermissionKeys.Where(key => !seeded.Contains(key)).ToArray();

        Assert.Empty(unknownGrants);
    }

    [Fact]
    public void EveryPermissionKeyIsCamelCaseModuleOrShortResourceDotAction()
    {
        // {segment}.{...}.{action} — every segment is a lowerCamel identifier (no hyphen/underscore/abbrev-casing).
        foreach (var key in PermissionKeys.All)
        {
            foreach (var segment in key.Split('.'))
            {
                Assert.Matches("^[a-z][a-zA-Z0-9]*$", segment);
            }
        }
    }
}
