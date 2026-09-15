using System.Reflection;
using NetArchTest.Rules;

namespace IntegratedProcurement.ArchitectureTests;

/// <summary>
/// Enforces Clean Architecture dependency rules across the modular monolith. These guardrails lock in
/// the inward dependency flow (Domain ← Application ← Infrastructure ← Host) and module isolation
/// (modules talk only through published Application contracts, never another module's Infrastructure).
/// See docs/REFACTORING_PLAN_CLEAN_ARCHITECTURE.md.
/// </summary>
public sealed class DependencyRuleTests
{
    // A representative type per layer assembly (NetArchTest inspects the whole assembly).
    private static readonly Assembly BuildingBlocksDomain =
        typeof(IntegratedProcurement.BuildingBlocks.Domain.Entities.Entity).Assembly;
    private static readonly Assembly BuildingBlocksApplication =
        typeof(IntegratedProcurement.BuildingBlocks.Application.Abstractions.ICurrentActor).Assembly;

    private static readonly Assembly[] ModuleDomainAssemblies =
    [
        typeof(IntegratedProcurement.Modules.ProposalTracker.Domain.TrackerProposal).Assembly,
        typeof(IntegratedProcurement.Modules.ContractMonitoring.Domain.Contract).Assembly,
        typeof(IntegratedProcurement.Modules.ContractInitiationPlatform.Domain.CipCase).Assembly,
        typeof(IntegratedProcurement.Modules.VendorOnboarding.Domain.Vendor).Assembly,
    ];

    private static readonly Assembly[] ModuleApplicationAssemblies =
    [
        typeof(IntegratedProcurement.Modules.ProposalTracker.Application.ProposalTrackerService).Assembly,
        typeof(IntegratedProcurement.Modules.ContractMonitoring.Application.ContractReminderService).Assembly,
        typeof(IntegratedProcurement.Modules.ContractInitiationPlatform.Application.CipCaseService).Assembly,
        typeof(IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations.CreateInvitationCommand).Assembly,
    ];

    private static readonly Assembly[] PlatformApplicationAssemblies =
    [
        typeof(IntegratedProcurement.Platform.Notifications.Application.INotificationService).Assembly,
        typeof(IntegratedProcurement.Platform.Audit.Application.IAuditTrail).Assembly,
        typeof(IntegratedProcurement.Platform.Documents.Application.IDocumentStorage).Assembly,
        typeof(IntegratedProcurement.Platform.Administration.Application.IAdminConsoleConfigurationService).Assembly,
        typeof(IntegratedProcurement.Platform.InternalIdentity.Application.Access.IInternalUserAccessService).Assembly,
        typeof(IntegratedProcurement.Platform.VendorIdentity.Application.IVendorAuthService).Assembly,
    ];

    private static readonly Assembly[] PlatformDomainAssemblies =
    [
        typeof(IntegratedProcurement.Platform.Notifications.Domain.NotificationEntry).Assembly,
        typeof(IntegratedProcurement.Platform.Audit.Domain.AuditLogEntry).Assembly,
        typeof(IntegratedProcurement.Platform.Settings.Domain.SettingEntry).Assembly,
        typeof(IntegratedProcurement.Platform.Administration.Domain.MenuTreeEntry).Assembly,
        typeof(IntegratedProcurement.Platform.InternalIdentity.Domain.InternalUser).Assembly,
    ];

    // Every module's Infrastructure namespace — no module's Domain/Application may depend on any of
    // these (their own = dependency-rule violation; another's = module-isolation violation).
    private static readonly string[] ModuleInfrastructureNamespaces =
    [
        "IntegratedProcurement.Modules.ProposalTracker.Infrastructure",
        "IntegratedProcurement.Modules.ContractMonitoring.Infrastructure",
        "IntegratedProcurement.Modules.ContractInitiationPlatform.Infrastructure",
        "IntegratedProcurement.Modules.VendorOnboarding.Infrastructure",
    ];

    // Things any Domain layer must never depend on.
    private static readonly string[] DomainForbidden =
    [
        "Microsoft.EntityFrameworkCore",
        "Microsoft.AspNetCore",
        "IntegratedProcurement.AppHost",
        "IntegratedProcurement.Platform.Persistence",
    ];

    // Things any Application layer must never depend on (Infrastructure/persistence/web/host).
    private static readonly string[] ApplicationForbidden =
    [
        "Microsoft.EntityFrameworkCore",
        "Microsoft.AspNetCore",
        "IntegratedProcurement.AppHost",
        "IntegratedProcurement.Platform.Persistence",
        "IntegratedProcurement.BuildingBlocks.Infrastructure",
    ];

    [Fact]
    public void ModuleDomain_DoesNotDependOnInfrastructureFrameworksOrWebHost()
    {
        AssertAll(ModuleDomainAssemblies, [.. DomainForbidden, .. ModuleInfrastructureNamespaces]);
    }

    [Fact]
    public void ModuleApplication_DoesNotDependOnInfrastructurePersistenceOrWebHost()
    {
        // Cross-module reads are allowed only through another module's Application (published port),
        // never its Infrastructure — that, plus the inward dependency rule, is what this asserts.
        AssertAll(ModuleApplicationAssemblies, [.. ApplicationForbidden, .. ModuleInfrastructureNamespaces]);
    }

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
    public void Persistence_DoesNotImplementModuleApplicationPorts()
    {
        var persistence = typeof(IntegratedProcurement.Platform.Persistence.ProcurementDbContext).Assembly;
        var result = Types.InAssembly(persistence)
            .Should()
            .NotHaveDependencyOnAny(
                "IntegratedProcurement.Modules.VendorOnboarding.Application",
                "IntegratedProcurement.Modules.ProposalTracker.Application",
                "IntegratedProcurement.Modules.ContractInitiationPlatform.Application",
                "IntegratedProcurement.Modules.ContractMonitoring.Application",
                "IntegratedProcurement.Platform.InternalIdentity.Application",
                "IntegratedProcurement.Platform.VendorIdentity.Application")
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

    [Fact]
    public void ModuleInfrastructure_DoesNotDependOnForeignModuleInfrastructure()
    {
        AssertAll(
        [
            typeof(IntegratedProcurement.Modules.ProposalTracker.Infrastructure.ProposalTrackerModule).Assembly,
        ],
        [
            "IntegratedProcurement.Modules.ContractMonitoring.Infrastructure",
            "IntegratedProcurement.Modules.ContractInitiationPlatform.Infrastructure",
            "IntegratedProcurement.Modules.VendorOnboarding.Infrastructure",
        ]);
        AssertAll(
        [
            typeof(IntegratedProcurement.Modules.ContractMonitoring.Infrastructure.ContractMonitoringModule).Assembly,
        ],
        [
            "IntegratedProcurement.Modules.ProposalTracker.Infrastructure",
            "IntegratedProcurement.Modules.ContractInitiationPlatform.Infrastructure",
            "IntegratedProcurement.Modules.VendorOnboarding.Infrastructure",
        ]);
        AssertAll(
        [
            typeof(IntegratedProcurement.Modules.ContractInitiationPlatform.Infrastructure.CipModule).Assembly,
        ],
        [
            "IntegratedProcurement.Modules.ProposalTracker.Infrastructure",
            "IntegratedProcurement.Modules.ContractMonitoring.Infrastructure",
            "IntegratedProcurement.Modules.VendorOnboarding.Infrastructure",
        ]);
        AssertAll(
        [
            typeof(IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.VendorOnboardingModule).Assembly,
        ],
        [
            "IntegratedProcurement.Modules.ProposalTracker.Infrastructure",
            "IntegratedProcurement.Modules.ContractMonitoring.Infrastructure",
            "IntegratedProcurement.Modules.ContractInitiationPlatform.Infrastructure",
        ]);
    }

    private static string Describe(Assembly assembly, TestResult result) =>
        $"{assembly.GetName().Name} violates dependency rule. Offending types: "
        + string.Join(", ", result.FailingTypeNames ?? []);
}
