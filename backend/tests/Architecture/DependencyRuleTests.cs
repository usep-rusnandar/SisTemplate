using System.Reflection;
using NetArchTest.Rules;

namespace IntegratedProcurement.ArchitectureTests;

public sealed class DependencyRuleTests
{
    private static readonly Assembly BuildingBlocksDomain =
        typeof(IntegratedProcurement.BuildingBlocks.Domain.Entities.Entity).Assembly;
    private static readonly Assembly BuildingBlocksApplication =
        typeof(IntegratedProcurement.BuildingBlocks.Application.Abstractions.ICurrentActor).Assembly;

    private static readonly Assembly[] PlatformApplicationAssemblies =
    [
        typeof(IntegratedProcurement.Platform.Notifications.Application.INotificationService).Assembly,
        typeof(IntegratedProcurement.Platform.Audit.Application.IAuditTrail).Assembly,
        typeof(IntegratedProcurement.Platform.Documents.Application.IDocumentStorage).Assembly,
        typeof(IntegratedProcurement.Platform.Administration.Application.IAdminConsoleConfigurationService).Assembly,
        typeof(IntegratedProcurement.Platform.InternalIdentity.Application.Access.IInternalUserAccessService).Assembly,
    ];

    private static readonly Assembly[] PlatformDomainAssemblies =
    [
        typeof(IntegratedProcurement.Platform.Notifications.Domain.NotificationEntry).Assembly,
        typeof(IntegratedProcurement.Platform.Audit.Domain.AuditLogEntry).Assembly,
        typeof(IntegratedProcurement.Platform.Settings.Domain.SettingEntry).Assembly,
        typeof(IntegratedProcurement.Platform.Administration.Domain.MenuTreeEntry).Assembly,
        typeof(IntegratedProcurement.Platform.InternalIdentity.Domain.InternalUser).Assembly,
    ];

    private static readonly string[] DomainForbidden =
    [
        "Microsoft.EntityFrameworkCore",
        "Microsoft.AspNetCore",
        "IntegratedProcurement.AppHost",
        "IntegratedProcurement.Platform.Persistence",
    ];

    private static readonly string[] ApplicationForbidden =
    [
        "Microsoft.EntityFrameworkCore",
        "Microsoft.AspNetCore",
        "IntegratedProcurement.AppHost",
        "IntegratedProcurement.Platform.Persistence",
        "IntegratedProcurement.BuildingBlocks.Infrastructure",
    ];

    [Fact]
    public void PlatformDomain_HasNoOutwardDependencies()
    {
        AssertAll(PlatformDomainAssemblies,
        [
            .. DomainForbidden,
            "IntegratedProcurement.BuildingBlocks.Application",
            "IntegratedProcurement.BuildingBlocks.Infrastructure",
        ]);
    }

    [Fact]
    public void PlatformApplication_DoesNotDependOnInfrastructurePersistenceOrWebHost()
    {
        AssertAll(PlatformApplicationAssemblies, ApplicationForbidden);
    }

    [Fact]
    public void BuildingBlocksDomain_HasNoOutwardDependencies()
    {
        var result = Types.InAssembly(BuildingBlocksDomain)
            .Should()
            .NotHaveDependencyOnAny(
                "Microsoft.EntityFrameworkCore",
                "Microsoft.AspNetCore",
                "IntegratedProcurement.AppHost",
                "IntegratedProcurement.Platform.Persistence",
                "IntegratedProcurement.BuildingBlocks.Application",
                "IntegratedProcurement.BuildingBlocks.Infrastructure")
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(BuildingBlocksDomain, result));
    }

    [Fact]
    public void BuildingBlocksApplication_DoesNotDependOnInfrastructureOrPersistenceOrWebHost()
    {
        var result = Types.InAssembly(BuildingBlocksApplication)
            .Should()
            .NotHaveDependencyOnAny(
                "Microsoft.EntityFrameworkCore",
                "IntegratedProcurement.AppHost",
                "IntegratedProcurement.Platform.Persistence",
                "IntegratedProcurement.BuildingBlocks.Infrastructure")
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(BuildingBlocksApplication, result));
    }

    [Fact]
    public void Persistence_DoesNotImplementPlatformApplicationPorts()
    {
        var persistence = typeof(IntegratedProcurement.Platform.Persistence.ProcurementDbContext).Assembly;
        var result = Types.InAssembly(persistence)
            .Should()
            .NotHaveDependencyOnAny(
                "IntegratedProcurement.Platform.InternalIdentity.Application",
                "IntegratedProcurement.Platform.Documents.Application",
                "IntegratedProcurement.Platform.Notifications.Application")
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(persistence, result));
    }

    private static void AssertAll(Assembly[] assemblies, string[] forbidden)
    {
        foreach (var assembly in assemblies)
        {
            var result = Types.InAssembly(assembly)
                .Should()
                .NotHaveDependencyOnAny(forbidden)
                .GetResult();

            Assert.True(result.IsSuccessful, Describe(assembly, result));
        }
    }

    private static string Describe(Assembly assembly, TestResult result) =>
        $"{assembly.GetName().Name} violates dependency rule. Offending types: "
        + string.Join(", ", result.FailingTypeNames ?? []);
}
