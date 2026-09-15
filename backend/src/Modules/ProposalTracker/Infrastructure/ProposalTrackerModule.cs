using IntegratedProcurement.Modules.ProposalTracker.Application;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Modules.ProposalTracker.Infrastructure;

/// <summary>
/// Composition for the Proposal Tracker module: registers its data-access implementation behind the
/// Domain-owned repository port, plus its Application use-cases.
/// </summary>
public static class ProposalTrackerModule
{
    public static IServiceCollection AddProposalTrackerModule(this IServiceCollection services)
    {
        services.AddScoped<IProposalTrackerRepository, ProposalTrackerRepository>();
        services.AddScoped<ProposalTrackerService>();
        services.AddScoped<ITrackerRosterService, TrackerRosterService>();
        services.AddScoped<ITrackerWorkflowCommandPort>(sp => sp.GetRequiredService<ProposalTrackerService>());
        services.AddScoped<IEproposalIngestionService, EproposalIngestionService>();
        services.AddScoped<IEproposalMaterialService, EproposalMaterialService>();
        services.AddScoped<ITrackerLoaReadPort, TrackerLoaReadAdapter>();
        services.AddScoped<ITrackerBidEvaluationReadPort, TrackerBidEvaluationReadAdapter>();
        services.AddScoped<ITrackerAwardSnapshotReadPort, TrackerAwardSnapshotReadAdapter>();
        return services;
    }
}
