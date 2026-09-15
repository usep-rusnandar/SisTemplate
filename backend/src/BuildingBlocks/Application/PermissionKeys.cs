namespace IntegratedProcurement.BuildingBlocks.Application;

/// <summary>
/// Single source of truth for permission keys. A permission is the atomic authorization primitive —
/// menus, API endpoints (<c>RequirePermission</c>), and UI actions all check the SAME key. Roles are
/// just named bundles of these. Format: module-scoped keys are <c>{moduleKey}.{action}</c> (camelCase,
/// see <see cref="ModuleKeys"/>); platform-wide keys use a short <c>{resource}.{action}</c>.
/// Keep in sync with the seeder — <c>InitialIamDataSeederPermissionCatalogTests</c> guards that
/// the seeded catalog equals <see cref="All"/>.
/// </summary>
public static class PermissionKeys
{
    // Platform-wide (not owned by a functional module)
    public const string DashboardView = "dashboard.view";
    public const string DashboardExport = "dashboard.export";
    public const string UsersView = "users.view";
    public const string UsersCreate = "users.create";
    public const string UsersUpdate = "users.update";
    public const string UsersDelete = "users.delete";
    public const string UsersPermissions = "users.permissions";
    public const string RolesView = "roles.view";
    public const string RolesCreate = "roles.create";
    public const string RolesUpdate = "roles.update";
    public const string RolesDelete = "roles.delete";
    public const string PermissionsView = "permissions.view";
    public const string PermissionsAssign = "permissions.assign";
    public const string LanguagesView = "languages.view";
    public const string LanguagesManage = "languages.manage";
    public const string LanguagesTranslate = "languages.translate";
    public const string EmailTemplatesView = "email.templates.view";
    public const string EmailTemplatesManage = "email.templates.manage";
    public const string EmailLogsView = "email.logs.view";
    public const string EmailRemindersView = "email.reminders.view";
    public const string AuditView = "audit.view";
    public const string AuditExport = "audit.export";
    public const string SettingsView = "settings.view";
    public const string SettingsUpdate = "settings.update";

    // Proposal Tracker
    public const string ProposalTrackerView = "proposalTracker.view";
    public const string ProposalTrackerManage = "proposalTracker.manage";

    // Contract Initiation Platform
    public const string ContractInitiationPlatformView = "contractInitiationPlatform.view";
    public const string ContractInitiationPlatformManage = "contractInitiationPlatform.manage";

    // Contract Monitoring
    public const string ContractMonitoringView = "contractMonitoring.view";
    public const string ContractMonitoringManage = "contractMonitoring.manage";
    /// <summary>Read the expiry monitor and reminder-history views. Held by every Contract
    /// Monitoring role except the basic <c>User Contract Monitoring</c> (USER-CM), who is limited to
    /// the Contract Dashboard and Contract Database.</summary>
    public const string ContractMonitoringRemindersView = "contractMonitoring.reminders.view";

    // Master Data — a broad key per owning module, PLUS a per-screen key generated from
    // MasterDataScreens (masterData.{screenId}.view|manage). Either unlocks the screen, so any
    // administrator role can be given any single screen without touching code; the module-wide key
    // stays the convenient default. See MasterDataScreens.
    public const string MasterDataVendorOnboardingView = "masterData.vendorOnboarding.view";
    public const string MasterDataVendorOnboardingManage = "masterData.vendorOnboarding.manage";
    public const string MasterDataProposalTrackerView = "masterData.proposalTracker.view";
    public const string MasterDataProposalTrackerManage = "masterData.proposalTracker.manage";
    public const string MasterDataContractInitiationPlatformView = "masterData.contractInitiationPlatform.view";
    public const string MasterDataContractInitiationPlatformManage = "masterData.contractInitiationPlatform.manage";
    public const string MasterDataContractMonitoringView = "masterData.contractMonitoring.view";
    public const string MasterDataContractMonitoringManage = "masterData.contractMonitoring.manage";

    // Vendor Onboarding (view = module-entry gate; approve = dynamic workflow eligibility;
    // legacy tier-specific keys remain temporarily for backward-compatible IAM data).
    public const string VendorOnboardingView = "vendorOnboarding.view";
    public const string VendorOnboardingManage = "vendorOnboarding.manage";
    public const string VendorOnboardingInvite = "vendorOnboarding.invite";
    public const string VendorOnboardingImport = "vendorOnboarding.import";
    /// <summary>Turn an approved vendor into a registered one (and issue its e-certificate).</summary>
    public const string VendorOnboardingRegister = "vendorOnboarding.register";
    public const string VendorOnboardingApprove = "vendorOnboarding.approve";
    public const string VendorOnboardingApprove1 = "vendorOnboarding.approve1";
    public const string VendorOnboardingApprove2 = "vendorOnboarding.approve2";
    public const string VendorOnboardingApproveFinal = "vendorOnboarding.approveFinal";
    /// <summary>List and manage vendor contacts, including who is the Vendor Workspace PIC.</summary>
    public const string VendorOnboardingContacts = "vendorOnboarding.contacts";

    /// <summary>Every known permission key (guard-test target) — the fixed keys plus the per-screen
    /// Master Data keys generated from <see cref="MasterDataScreens"/>.</summary>
    public static IReadOnlyCollection<string> All =>
        [.. Fixed, .. MasterDataScreens.PermissionKeys];

    private static IReadOnlyCollection<string> Fixed =>
    [
        DashboardView, DashboardExport,
        UsersView, UsersCreate, UsersUpdate, UsersDelete, UsersPermissions,
        RolesView, RolesCreate, RolesUpdate, RolesDelete,
        PermissionsView, PermissionsAssign,
        LanguagesView, LanguagesManage, LanguagesTranslate,
        EmailTemplatesView, EmailTemplatesManage, EmailLogsView, EmailRemindersView,
        AuditView, AuditExport,
        SettingsView, SettingsUpdate,
        ProposalTrackerView, ProposalTrackerManage,
        ContractInitiationPlatformView, ContractInitiationPlatformManage,
        ContractMonitoringView, ContractMonitoringManage, ContractMonitoringRemindersView,
        MasterDataVendorOnboardingView, MasterDataVendorOnboardingManage,
        MasterDataProposalTrackerView, MasterDataProposalTrackerManage,
        MasterDataContractInitiationPlatformView, MasterDataContractInitiationPlatformManage,
        MasterDataContractMonitoringView, MasterDataContractMonitoringManage,
        VendorOnboardingView, VendorOnboardingManage, VendorOnboardingInvite, VendorOnboardingImport, VendorOnboardingRegister,
        VendorOnboardingApprove,
        VendorOnboardingApprove1, VendorOnboardingApprove2, VendorOnboardingApproveFinal,
        VendorOnboardingContacts,
    ];
}
