using System.Reflection;
using NetArchTest.Rules;

namespace SisTemplate.ArchitectureTests;

public sealed class DependencyRuleTests
{
    private static readonly Assembly BuildingBlocksDomain =
        typeof(SisTemplate.BuildingBlocks.Domain.Entities.Entity).Assembly;
    private static readonly Assembly BuildingBlocksApplication =
        typeof(SisTemplate.BuildingBlocks.Application.Abstractions.ICurrentActor).Assembly;

    private static readonly Assembly[] PlatformApplicationAssemblies =
    [
        typeof(SisTemplate.Platform.Notifications.Application.INotificationService).Assembly,
        typeof(SisTemplate.Platform.Audit.Application.IAuditTrail).Assembly,
        typeof(SisTemplate.Platform.Documents.Application.IDocumentStorage).Assembly,
        typeof(SisTemplate.Platform.Administration.Application.IAdminConsoleConfigurationService).Assembly,
        typeof(SisTemplate.Platform.InternalIdentity.Application.Access.IInternalUserAccessService).Assembly,
    ];

    private static readonly Assembly[] PlatformDomainAssemblies =
    [
        typeof(SisTemplate.Platform.Notifications.Domain.NotificationEntry).Assembly,
        typeof(SisTemplate.Platform.Audit.Domain.AuditLogEntry).Assembly,
        typeof(SisTemplate.Platform.Settings.Domain.SettingEntry).Assembly,
        typeof(SisTemplate.Platform.Administration.Domain.MenuTreeEntry).Assembly,
        typeof(SisTemplate.Platform.InternalIdentity.Domain.InternalUser).Assembly,
    ];

    private static readonly string[] DomainForbidden =
    [
        "Microsoft.EntityFrameworkCore",
        "Microsoft.AspNetCore",
        "SisTemplate.AppHost",
        "SisTemplate.Platform.Persistence",
    ];

    private static readonly string[] ApplicationForbidden =
    [
        "Microsoft.EntityFrameworkCore",
        "Microsoft.AspNetCore",
        "SisTemplate.AppHost",
        "SisTemplate.Platform.Persistence",
        "SisTemplate.BuildingBlocks.Infrastructure",
    ];

    [Fact]
    public void PlatformDomain_HasNoOutwardDependencies()
    {
        AssertAll(PlatformDomainAssemblies,
        [
            .. DomainForbidden,
            "SisTemplate.BuildingBlocks.Application",
            "SisTemplate.BuildingBlocks.Infrastructure",
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
                "SisTemplate.AppHost",
                "SisTemplate.Platform.Persistence",
                "SisTemplate.BuildingBlocks.Application",
                "SisTemplate.BuildingBlocks.Infrastructure")
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
                "SisTemplate.AppHost",
                "SisTemplate.Platform.Persistence",
                "SisTemplate.BuildingBlocks.Infrastructure")
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(BuildingBlocksApplication, result));
    }

    [Fact]
    public void Persistence_DoesNotImplementPlatformApplicationPorts()
    {
        var persistence = typeof(SisTemplate.Platform.Persistence.ProcurementDbContext).Assembly;
        var result = Types.InAssembly(persistence)
            .Should()
            .NotHaveDependencyOnAny(
                "SisTemplate.Platform.InternalIdentity.Application",
                "SisTemplate.Platform.Documents.Application",
                "SisTemplate.Platform.Notifications.Application")
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
