using IntegratedProcurement.Modules.VendorOnboarding.Application;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Certificates;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Contacts;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Documents;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Profile;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Migration;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Invitations;
using IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Contacts;
using IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Invitations;
using IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Migration;
using IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.Notifications;
using IntegratedProcurement.Modules.VendorOnboarding.Application.Review;
using IntegratedProcurement.Modules.VendorOnboarding.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Modules.VendorOnboarding.Infrastructure;

/// <summary>DI composition for the Vendor Onboarding module's Infrastructure (repositories + use-cases).</summary>
public static class VendorOnboardingModule
{
    public static IServiceCollection AddVendorOnboardingModule(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IVendorDocumentRepository, VendorDocumentRepository>();
        services.AddScoped<VendorDocumentService>();
        services.AddScoped<IVendorAribaImportService, VendorAribaImportService>();

        services.AddScoped<IVendorContactService, VendorContactService>();
        services.AddScoped<IVendorInvitationService, VendorInvitationService>();
        services.AddScoped<IVendorRepository, VendorRepository>();
        services.AddScoped<IVendorRegistryReadPort, VendorRegistryReadPort>();
        services.AddScoped<IVendorOfficeAddressReadPort, VendorOfficeAddressReadPort>();
        services.AddScoped<IRegisteredVendorReadPort, RegisteredVendorReadPort>();
        services.AddScoped<IVendorDatabaseExportService, VendorDatabaseExportService>();
        services.AddScoped<IVendorStatusCatalogReadPort, VendorStatusCatalogReadPort>();
        services.AddScoped<IVendorActorNameReadPort, VendorActorNameReadPort>();
        services.AddScoped<IInternalRoleReadPort, InternalRoleReadPort>();
        services.AddScoped<VendorApprovalChainProvider>();
        services.AddScoped<ICommodityKbliRuleReadPort, CommodityKbliRuleReadPort>();
        services.AddScoped<VendorProfileService>();
        services.AddScoped<VendorOfficerPortfolioService>();
        services.AddScoped<VendorApprovalService>();
        services.AddScoped<VendorReviewService>();
        services.AddScoped<IVendorOnboardingMailer, VendorOnboardingMailer>();
        services.AddScoped<VendorCertificateService>();
        return services;
    }
}
