using IntegratedProcurement.BuildingBlocks.Application;
using IntegratedProcurement.Platform.InternalIdentity.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedProcurement.Platform.Persistence.Seeding;

public static class InitialIamDataSeeder
{
    // Permission keys come from the PermissionKeys single source of truth (BuildingBlocks.Application).
    private const string ProposalTrackerView = PermissionKeys.ProposalTrackerView;
    private const string ProposalTrackerManage = PermissionKeys.ProposalTrackerManage;
    private const string CipView = PermissionKeys.ContractInitiationPlatformView;
    private const string CipManage = PermissionKeys.ContractInitiationPlatformManage;
    private const string ContractsView = PermissionKeys.ContractMonitoringView;
    private const string ContractsManage = PermissionKeys.ContractMonitoringManage;
    private const string ContractsRemindersView = PermissionKeys.ContractMonitoringRemindersView;
    // Per-screen Commodity master-data view (generated from MasterDataScreens). Granted read-only to
    // Contract Monitoring roles so they can look up commodity Classification / Sub-Classification.
    private const string MdCommodityView = "masterData.commodity.view";
    private const string MdVdrView = PermissionKeys.MasterDataVendorOnboardingView;
    private const string MdVdrManage = PermissionKeys.MasterDataVendorOnboardingManage;
    private const string MdTrkView = PermissionKeys.MasterDataProposalTrackerView;
    private const string MdTrkManage = PermissionKeys.MasterDataProposalTrackerManage;
    private const string MdCipView = PermissionKeys.MasterDataContractInitiationPlatformView;
    private const string MdCipManage = PermissionKeys.MasterDataContractInitiationPlatformManage;
    private const string MdCmView = PermissionKeys.MasterDataContractMonitoringView;
    private const string MdCmManage = PermissionKeys.MasterDataContractMonitoringManage;
    private const string DashboardView = PermissionKeys.DashboardView;
    private const string VendorView = PermissionKeys.VendorOnboardingView;
    private const string VendorManage = PermissionKeys.VendorOnboardingManage;
    private const string VendorInvite = PermissionKeys.VendorOnboardingInvite;
    private const string VendorImport = PermissionKeys.VendorOnboardingImport;
    private const string VendorRegister = PermissionKeys.VendorOnboardingRegister;
    private const string VendorApprove = PermissionKeys.VendorOnboardingApprove;
    private const string VendorApprove1 = PermissionKeys.VendorOnboardingApprove1;
    private const string VendorApprove2 = PermissionKeys.VendorOnboardingApprove2;
    private const string VendorApproveFinal = PermissionKeys.VendorOnboardingApproveFinal;
    private const string VendorContacts = PermissionKeys.VendorOnboardingContacts;

    private static readonly string[] ModuleAdministratorPermissions =
    [
        PermissionKeys.UsersView,
        PermissionKeys.UsersCreate,
        PermissionKeys.UsersUpdate,
        PermissionKeys.UsersPermissions,
        PermissionKeys.RolesView,
    ];

    /// <summary>Kept only on Super Admin; revoked from every other seeded role on each startup.</summary>
    private static readonly string[] SuperAdminOnlyPermissionKeys =
    [
        "audit.view",
        "audit.export",
    ];

    private static readonly SeedRole[] Roles =
    [
        // Super Admin holds every permission (null = all).
        new("SPR-ADM", "Super Admin", null, true, null),

        // Administrators — full manage of one module + master data + module-scoped user administration.
        // They may inspect (but not create/update) role definitions; role assignment is limited to
        // their module by the Administration access-scope service.
        new("ADM-VDR", "Administrator Vendor Onboarding", "vendorOnboarding", false,
            [DashboardView, .. ModuleAdministratorPermissions, MdVdrView, MdVdrManage,
             VendorView, VendorManage, VendorApprove1, VendorApprove2, VendorApproveFinal, VendorContacts]),
        new("ADM-TRK", "Administrator Proposal Tracker", "proposalTracker", false,
            [DashboardView, .. ModuleAdministratorPermissions, ProposalTrackerView, ProposalTrackerManage, MdTrkView, MdTrkManage,
             CipView, CipManage, MdCipView, MdCipManage]),
        new("ADM-CM", "Administrator Contract Monitoring", "contractMonitoring", false,
            [DashboardView, .. ModuleAdministratorPermissions, ContractsView, ContractsManage, ContractsRemindersView, MdCmView, MdCmManage, MdCommodityView, "email.reminders.view"]),

        // Division Head — cross-module oversight + final vendor approval.
        new("DIV-HD", "Division Head", null, false,
            [DashboardView, ProposalTrackerView, CipView, ContractsView, ContractsRemindersView, VendorView, VendorApprove, VendorApproveFinal]),

        // Department Heads — per-module read-only oversight + master data (Vendor also holds step-2 approval).
        new("DEPHD-VDR", "Department Head Vendor Onboarding", "vendorOnboarding", false,
            [DashboardView, VendorView, VendorApprove, VendorApprove2]),
        new("DEPHD-TRK", "Department Head Proposal Tracker", "proposalTracker", false,
            [DashboardView, ProposalTrackerView, CipView]),
        new("DEPHD-CM", "Department Head Contract Monitoring", "contractMonitoring", false,
            [DashboardView, ContractsView, ContractsRemindersView]),

        // Section Heads — manage operations of one module.
        new("SECHD-VDR", "Section Head Vendor Onboarding", "vendorOnboarding", false,
            [DashboardView, VendorView, VendorApprove1]),
        new("SECHD-TRK", "Section Head Proposal Tracker", "proposalTracker", false,
            [DashboardView, ProposalTrackerView, ProposalTrackerManage, CipView, CipManage]),
        new("SECHD-CM", "Section Head Contract Monitoring", "contractMonitoring", false,
            [DashboardView, ContractsView, ContractsManage, ContractsRemindersView, MdCommodityView]),

        // Officers — day-to-day execution of one module. Vendor Officer also owns invitations,
        // imports, Vendor Contacts, and registering an approved vendor (e-certificate).
        new("OFFCR-VDR", "Officer Vendor Onboarding", "vendorOnboarding", false,
            [DashboardView, VendorView, VendorInvite, VendorImport, VendorApprove, VendorRegister, VendorContacts]),
        new("OFFCR-TRK", "Officer Proposal Tracker", "proposalTracker", false,
            [DashboardView, ProposalTrackerView, ProposalTrackerManage, CipView, CipManage]),
        new("OFFCR-CM", "Officer Contract Monitoring", "contractMonitoring", false,
            [DashboardView, ContractsView, ContractsManage, ContractsRemindersView, MdCommodityView]),

        // Read-only end user — Contract Dashboard + Contract Database only (no expiry/reminders,
        // gated by contractMonitoring.reminders.view which USER-CM deliberately does not hold).
        new("USER-CM", "User Contract Monitoring", "contractMonitoring", false,
            [DashboardView, ContractsView]),

        // Read-only viewer of the Vendor Onboarding module — no manage/approve actions.
        new("RDONLY-VDR", "Read Only Vendor Onboarding", "vendorOnboarding", false,
            [DashboardView, VendorView])
    ];

    private static readonly SeedPermission[] Permissions =
    [
        new(DashboardView, "dashboard", "View dashboard", "Access the main dashboard and KPI widgets"),
        new("dashboard.export", "dashboard", "Export dashboard", "Export dashboard widgets and charts"),
        new("users.view", "users", "View users", "List and view user accounts"),
        new("users.create", "users", "Create user", "Create new user accounts"),
        new("users.update", "users", "Update user", "Edit user profile and account details"),
        new("users.delete", "users", "Delete user", "Permanently remove user accounts"),
        new("users.permissions", "users", "Manage user permissions", "Assign direct permissions to users"),
        new("roles.view", "roles", "View roles", "List and view roles"),
        new("roles.create", "roles", "Create role", "Define new roles"),
        new("roles.update", "roles", "Update role", "Edit role details and permissions"),
        new("roles.delete", "roles", "Delete role", "Remove non-system roles"),
        new("permissions.view", "permissions", "View permissions", "List all system permissions"),
        new("permissions.assign", "permissions", "Assign permissions", "Attach permissions to roles"),
        new("languages.view", "languages", "View languages", "List configured languages"),
        new("languages.manage", "languages", "Manage languages", "Add, enable, and set default languages"),
        new("languages.translate", "languages", "Edit translations", "Edit language text entries"),
        new("email.templates.view", "email", "View email templates", "Browse email templates"),
        new("email.templates.manage", "email", "Manage email templates", "Create and edit email templates"),
        new("email.logs.view", "email", "View sent emails", "Access the email delivery log"),
        new("email.reminders.view", "email", "View reminder sent", "Access Contract Monitoring reminder delivery logs"),
        // Audit menu/API is Super Admin only (granted via SPR-ADM null PermissionKeys = all).
        new("audit.view", "audit", "View audit log", "Read the system audit trail (Super Admin only)"),
        new("audit.export", "audit", "Export audit log", "Export audit records to CSV (Super Admin only)"),
        new("settings.view", "settings", "View settings", "Access system settings and the background-process catalog"),
        new("settings.update", "settings", "Update settings", "Modify system and security settings, and run scheduled background processes"),
        new(ProposalTrackerView, "proposalTracker", "View Proposal Tracker", "Read Proposal Tracker dashboards, proposals, and LOA documents"),
        new(ProposalTrackerManage, "proposalTracker", "Manage Proposal Tracker", "Distribute, clock-in/out, complete, recycle, and reassign proposals"),
        new(CipView, "contractInitiationPlatform", "View Contract Initiation Platform", "Read Contract Initiation Platform cases, templates, repository, and authorization master"),
        new(CipManage, "contractInitiationPlatform", "Manage Contract Initiation Platform", "Create and advance Contract Initiation Platform cases, generate documents, and register contracts"),
        new(ContractsView, "contractMonitoring", "View Contract Monitoring", "Read contracts, expiry, and reminder history"),
        new(ContractsManage, "contractMonitoring", "Manage Contract Monitoring", "Send reminders, run scans, and import contracts"),
        new(ContractsRemindersView, "contractMonitoring", "View Contract Monitoring reminders", "See the Expiry Monitor and Reminders Sent views (all CM roles except the basic User Contract Monitoring)"),
        new(MdVdrView, "masterData", "View Vendor Onboarding master data", "Read Vendor Onboarding master data sets and records"),
        new(MdVdrManage, "masterData", "Manage Vendor Onboarding master data", "Create and edit Vendor Onboarding master data records"),
        new(MdTrkView, "masterData", "View Proposal Tracker master data", "Read Proposal Tracker master data sets and records"),
        new(MdTrkManage, "masterData", "Manage Proposal Tracker master data", "Create and edit Proposal Tracker master data records"),
        new(MdCipView, "masterData", "View CIP master data", "Read Contract Initiation Platform master data sets and records"),
        new(MdCipManage, "masterData", "Manage CIP master data", "Create and edit Contract Initiation Platform master data records"),
        new(MdCmView, "masterData", "View Contract Monitoring master data", "Read Contract Monitoring master data sets and records"),
        new(MdCmManage, "masterData", "Manage Contract Monitoring master data", "Create and edit Contract Monitoring master data records"),
        new(VendorView, "vendorOnboarding", "View vendors", "Read/enter the Vendor Onboarding module — registry, profiles, and history"),
        new(VendorManage, "vendorOnboarding", "Manage vendors", "Blacklist/unblacklist vendors, issue e-certificates, and administer vendor records"),
        new(VendorInvite, "vendorOnboarding", "Invite vendors", "Create, resend, and revoke vendor registration invitations"),
        new(VendorImport, "vendorOnboarding", "Import Ariba vendors", "Validate and commit controlled vendor migration batches from Ariba workbooks"),
        new(VendorRegister, "vendorOnboarding", "Register approved vendors", "Move an approved vendor to registered and issue its e-certificate"),
        new(VendorApprove, "vendorOnboarding", "Approve vendors", "Act on the current role-assigned step in a versioned Vendor Onboarding approval workflow"),
        new(VendorApprove1, "vendorOnboarding", "Vendor approval — step 1", "Approve, reject, or request revision for submitted vendor registrations (SBMIT)"),
        new(VendorApprove2, "vendorOnboarding", "Vendor approval — step 2", "Approve, reject, or request revision at the second approval step (APPR1)"),
        new(VendorApproveFinal, "vendorOnboarding", "Vendor approval — final", "Give final approval, reject, or request revision at the last step (APPR2/APPR3)"),
        new(VendorContacts, "vendorOnboarding", "Manage vendor contacts", "List vendor contacts and set which person is the PIC Vendor for Vendor Workspace"),
    ];

    /// <summary>
    /// One view/manage pair per Master Data screen, generated from <see cref="MasterDataScreens"/> so a
    /// new screen brings its permissions with it. Granting one of these lets ANY administrator role
    /// open that single screen, independent of the module-wide keys above.
    /// </summary>
    private static readonly SeedPermission[] MasterDataScreenPermissions =
    [
        .. MasterDataScreens.All.SelectMany(screen => new[]
        {
            new SeedPermission(screen.ViewPermission, "masterData", $"View {screen.Name} master data",
                $"Read the {screen.Name} master data screen"),
            new SeedPermission(screen.ManagePermission, "masterData", $"Manage {screen.Name} master data",
                $"Create and edit records on the {screen.Name} master data screen"),
        }),
    ];

    private static IEnumerable<SeedPermission> AllPermissions => [.. Permissions, .. MasterDataScreenPermissions];

    private static readonly SeedUser[] Users =
    [
        new("80008913", "ADITYA PRIYAMBODO", "aditya.priyambodo@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SECTION HEAD - OPERATION VENDOR ONBOARDING", InternalIdentityStatuses.Active, ["Section Head Proposal Tracker"]),
        new("80010029", "AHMAD ZAKKI IDHAM", "ahmad.idham@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - GENERAL VENDOR SELECTIO", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("80008601", "ALDJI ISMAIL KAHAR", "aldji.kahar@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - GENERAL VENDOR SELECTIO", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("11040397", "ANDI KURNIAWAN", "andi.kurniawan@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SECTION HEAD - CONTRACT MANAGEMENT", InternalIdentityStatuses.Active, ["Section Head Contract Monitoring"]),
        new("80005516", "ANDY PRASETIO WIBOWO", "andy.prasetio@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "DEPARTMENT HEAD - VENDOR ONBOARDING", InternalIdentityStatuses.Active, ["Department Head Proposal Tracker", "Department Head Vendor Onboarding"]),
        new("80006600", "ARI PAMUNGKAS", "ari.pamungkas@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SECTION HEAD - GENERAL VENDOR ONBOARDING", InternalIdentityStatuses.Active, ["Section Head Proposal Tracker"]),
        new("12080430", "BENJAMIN L. RUMBI", "benjamin.rumbi@alamtri.com", "", "DIVISION HEAD - PROCUREMENT", InternalIdentityStatuses.Active, ["Division Head"]),
        new("00118209", "CELISKA RENIGIYANTI", "celiska.renigiyanti@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "OFFICER - GENERAL VENDOR SELECTION", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("80005716", "DINDA SEKAR KINANTI", "dinda.sekar@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "OFFICER - GENERAL VENDOR ONBOARDING", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("80010439", "DITA IRMAYANI", "dita.irmayani@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "OFFICER - CONTRACT MANAGEMENT", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("00109501", "ELFIKRIE ANDROSS", "elfikrie.andross@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - GENERAL VENDOR SELECTIO", InternalIdentityStatuses.Active, ["Section Head Proposal Tracker"]),
        new("80006738", "FADJRIN NUR RAHMAYANI", "fadjrin.rahmayani@saptaindra.co.id", "SOURCING DEPARTMENT", "SENIOR OFFICER - SOURCING PLANNER", InternalIdentityStatuses.Active, ["Officer Vendor Onboarding"]),
        new("00118322", "FAHMI ZUL FIKRI", "fahmi.zulfikri@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "OFFICER - OPERATION VENDOR SEL", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("80009423", "FIANI NUR AMALIA", "fiani.amalia@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - GENERAL VENDOR ONBOARDING", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("01111041", "IMANIAR RUSYDIAWAN", "imaniar.rusydiawan@saptaindra.co.id", "IT & OT DEVELOPMENT DEPARTMENT", "SECTION HEAD - ERP & INTEGRATION SYSTEM", InternalIdentityStatuses.Active, ["Administrator Vendor Onboarding"]),
        new("80004160", "KADRYAL ROSCIE", "kadryal.roscie@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - CONTRACT MANAGEMENT", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("80002388", "MAI RISNAWATI", "mai.risnawati@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - GENERAL VENDOR SELECTIO", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("80009858", "NUR ALFI HIDAYATI", "nur.hidayati@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - OPERATION VENDOR ONBOARDING", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("00107638", "POLY MAHENDRA PUTERA", "poly.mahendra@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SECTION HEAD - OPERATION VENDOR SEL", InternalIdentityStatuses.Active, ["Section Head Proposal Tracker"]),
        new("00105155", "SITI FATIMAH", "s.fatimah@saptaindra.co.id", "SOURCING DEPARTMENT", "SENIOR OFFICER - VENDOR RELATIONSHIP MGM", InternalIdentityStatuses.Active, ["Officer Vendor Onboarding", "Administrator Vendor Onboarding"]),
        new("18090005", "SITI MARIAM KENCANA SARI", "siti.mariam@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - CONTRACT MANAGEMENT", InternalIdentityStatuses.Active, ["Officer Contract Monitoring"]),
        new("00109610", "USEP RUSNANDAR", "usep.rusnandar@saptaindra.co.id", "IT & OT DEVELOPMENT DEPARTMENT", "SENIOR OFFICER - ERP & INTEGRATION", InternalIdentityStatuses.Active, ["Super Admin"]),
        new("00109439", "VECKY NOVRITZ", "vecky@saptaindra.co.id", "SOURCING DEPARTMENT", "DEPARTMENT HEAD - SOURCING", InternalIdentityStatuses.Active, ["Department Head Proposal Tracker"]),
        new("80010942", "WIRANTIA HANAN FEBRILLA", "wirantia.febrilla@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "SENIOR OFFICER - OPERATION VENDOR SEL", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("00116251", "WITA APRILIA", "wita.aprilia@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "ADMIN SUPPORT - CONTRACT MANAGEMENT", InternalIdentityStatuses.Active, ["Officer Contract Monitoring"]),
        new("80012050", "YANA SUBYANTORO", "yana.subyantoro@saptaindra.co.id", "VENDOR ONBOARDING DEPARTMENT", "OFFICER - OPERATION VENDOR SEL", InternalIdentityStatuses.Active, ["Officer Proposal Tracker"]),
        new("00108091", "YOHANES ARI", "yohanes.ari@saptaindra.co.id", "SOURCING DEPARTMENT", "LEAD OFFICER - SOURCING PLANNER", InternalIdentityStatuses.Active, ["Administrator Vendor Onboarding"]),
        new("00117404", "YUSUF BINSAR", "yusuf.binsar@saptaindra.co.id", "SOURCING DEPARTMENT", "SENIOR OFFICER - SOURCING PLANNER", InternalIdentityStatuses.Active, ["Read Only Vendor Onboarding"])
    ];

    /// <summary>
    /// Direct manager emails for Proposal Tracker org chart (report-to). Applied only when ManagerUserId is unset.
    /// Personnel-number pairs are a fallback when staging/production emails drifted from the seed.
    /// </summary>
    private static readonly (string Email, string ManagerEmail)[] UserManagerLinks =
    [
        ("andy.prasetio@saptaindra.co.id", "benjamin.rumbi@alamtri.com"),
        ("ari.pamungkas@saptaindra.co.id", "andy.prasetio@saptaindra.co.id"),
        ("elfikrie.andross@saptaindra.co.id", "andy.prasetio@saptaindra.co.id"),
        ("aditya.priyambodo@saptaindra.co.id", "andy.prasetio@saptaindra.co.id"),
        ("poly.mahendra@saptaindra.co.id", "andy.prasetio@saptaindra.co.id"),
        ("dinda.sekar@saptaindra.co.id", "ari.pamungkas@saptaindra.co.id"),
        ("fiani.amalia@saptaindra.co.id", "ari.pamungkas@saptaindra.co.id"),
        ("mai.risnawati@saptaindra.co.id", "elfikrie.andross@saptaindra.co.id"),
        ("celiska.renigiyanti@saptaindra.co.id", "elfikrie.andross@saptaindra.co.id"),
        ("aldji.kahar@saptaindra.co.id", "elfikrie.andross@saptaindra.co.id"),
        ("nur.hidayati@saptaindra.co.id", "aditya.priyambodo@saptaindra.co.id"),
        ("kadryal.roscie@saptaindra.co.id", "aditya.priyambodo@saptaindra.co.id"),
        ("fahmi.zulfikri@saptaindra.co.id", "poly.mahendra@saptaindra.co.id"),
        ("wirantia.febrilla@saptaindra.co.id", "poly.mahendra@saptaindra.co.id"),
        ("yana.subyantoro@saptaindra.co.id", "poly.mahendra@saptaindra.co.id"),
    ];

    private static readonly (string PersonnelNo, string ManagerPersonnelNo)[] UserManagerLinksByNrp =
    [
        ("80005516", "12080430"),
        ("80006600", "80005516"),
        ("00109501", "80005516"),
        ("80008913", "80005516"),
        ("00107638", "80005516"),
        ("80005716", "80006600"),
        ("80009423", "80006600"),
        ("80002388", "00109501"),
        ("00118209", "00109501"),
        ("80008601", "00109501"),
        ("80009858", "80008913"),
        ("80004160", "80008913"),
        ("00118322", "00107638"),
        ("80010942", "00107638"),
        ("80012050", "00107638"),
    ];

    /// <summary>The permission keys this seeder defines (guard-test target vs <see cref="PermissionKeys.All"/>).</summary>
    public static IReadOnlyCollection<string> CatalogPermissionKeys =>
        AllPermissions.Select(permission => permission.Key).ToArray();

    /// <summary>Every permission key referenced by a role grant (guard-test target — must all be seeded).</summary>
    public static IReadOnlyCollection<string> GrantedPermissionKeys =>
        Roles.Where(role => role.PermissionKeys is not null)
            .SelectMany(role => role.PermissionKeys!)
            .Distinct()
            .ToArray();

    public static async Task SeedInitialIamDataAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        await dbContext.Database.MigrateAsync();
        await SeedRolesAsync(dbContext);
        await SeedPermissionsAsync(dbContext);
        await SeedUsersAsync(dbContext);
        await SeedUserRolesAsync(dbContext);
        await RemapAndRetireCipRolesAsync(dbContext);
        await SeedRolePermissionsAsync(dbContext);
        await RestrictSuperAdminOnlyPermissionsAsync(dbContext);
        await SeedUserManagersAsync(dbContext);
    }

    /// <summary>
    /// CIP product roles are retired into the matching Tracker roles. Idempotent: users who already
    /// hold the Tracker role only lose the CIP assignment; leftover CIP role rows are deleted after
    /// their assignments and permission grants are removed.
    /// </summary>
    private static readonly (string CipCode, string TrackerCode)[] CipRoleRemap =
    [
        ("ADM-CIP", "ADM-TRK"),
        ("DEPHD-CIP", "DEPHD-TRK"),
        ("SECHD-CIP", "SECHD-TRK"),
        ("OFFCR-CIP", "OFFCR-TRK"),
    ];

    private static async Task RemapAndRetireCipRolesAsync(ProcurementDbContext dbContext)
    {
        var roles = await dbContext.InternalRoles.ToListAsync();
        var rolesByCode = roles.ToDictionary(role => role.Code, StringComparer.OrdinalIgnoreCase);

        foreach (var (cipCode, trackerCode) in CipRoleRemap)
        {
            if (!rolesByCode.TryGetValue(cipCode, out var cipRole)
                || !rolesByCode.TryGetValue(trackerCode, out var trackerRole))
            {
                continue;
            }

            var cipAssignments = await dbContext.InternalUserRoles
                .Where(assignment => assignment.RoleId == cipRole.Id)
                .ToListAsync();
            var trackerUserIds = await dbContext.InternalUserRoles
                .Where(assignment => assignment.RoleId == trackerRole.Id)
                .Select(assignment => assignment.UserId)
                .ToHashSetAsync();

            foreach (var assignment in cipAssignments)
            {
                if (trackerUserIds.Add(assignment.UserId))
                {
                    dbContext.InternalUserRoles.Add(InternalUserRole.Create(assignment.UserId, trackerRole.Id));
                }

                dbContext.InternalUserRoles.Remove(assignment);
            }

            await dbContext.SaveChangesAsync();

            await dbContext.InternalRolePermissions
                .Where(assignment => assignment.RoleId == cipRole.Id)
                .ExecuteDeleteAsync();

            dbContext.InternalRoles.Remove(cipRole);
            await dbContext.SaveChangesAsync();
            rolesByCode.Remove(cipCode);
        }
    }

    private static async Task SeedRolesAsync(ProcurementDbContext dbContext)
    {
        var existingCodes = await dbContext.InternalRoles
            .Select(role => role.Code)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase);
        foreach (var role in Roles.Where(role => !existingCodes.Contains(role.Code)))
        {
            dbContext.InternalRoles.Add(InternalRole.Create(role.Code, role.Name, role.ModuleKey, role.IsSystem));
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedPermissionsAsync(ProcurementDbContext dbContext)
    {
        var existingKeys = await dbContext.Permissions
            .Select(permission => permission.Key)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase);
        foreach (var permission in AllPermissions.Where(permission => !existingKeys.Contains(permission.Key)))
        {
            dbContext.Permissions.Add(PermissionDefinition.Create(
                permission.Key,
                permission.ModuleKey,
                permission.Name,
                permission.Description));
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedUsersAsync(ProcurementDbContext dbContext)
    {
        var existingPersonnelNumbers = await dbContext.InternalUsers
            .Select(user => user.PersonnelNo)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase);
        foreach (var seed in Users.Where(user => !existingPersonnelNumbers.Contains(user.PersonnelNo)))
        {
            var user = InternalUser.Create(
                seed.PersonnelNo,
                seed.DisplayName,
                seed.Email,
                seed.Department,
                seed.Position);
            user.SetStatus(seed.Status);
            dbContext.InternalUsers.Add(user);
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedUserRolesAsync(ProcurementDbContext dbContext)
    {
        var usersByPersonnelNo = await dbContext.InternalUsers.ToDictionaryAsync(user => user.PersonnelNo);
        var rolesByName = await dbContext.InternalRoles.ToDictionaryAsync(role => role.Name);
        var existingAssignments = await dbContext.InternalUserRoles
            .Select(userRole => new { userRole.UserId, userRole.RoleId })
            .ToArrayAsync();
        var existing = existingAssignments
            .Select(item => $"{item.UserId:N}:{item.RoleId:N}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var seed in Users)
        {
            if (!usersByPersonnelNo.TryGetValue(seed.PersonnelNo, out var user))
            {
                continue;
            }

            foreach (var roleName in seed.RoleNames)
            {
                if (!rolesByName.TryGetValue(roleName, out var role))
                {
                    continue;
                }

                var key = $"{user.Id:N}:{role.Id:N}";
                if (existing.Add(key))
                {
                    dbContext.InternalUserRoles.Add(InternalUserRole.Create(user.Id, role.Id));
                }
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedUserManagersAsync(ProcurementDbContext dbContext)
    {
        var users = await dbContext.InternalUsers
            .Where(user => user.DeletedAt == null && user.Email != null)
            .ToListAsync();
        var byEmail = users
            .Where(user => !string.IsNullOrWhiteSpace(user.Email))
            .GroupBy(user => user.Email!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        var byPersonnelNo = users
            .Where(user => !string.IsNullOrWhiteSpace(user.PersonnelNo))
            .GroupBy(user => user.PersonnelNo, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var changed = false;
        foreach (var (email, managerEmail) in UserManagerLinks)
        {
            if (!byEmail.TryGetValue(email, out var user) || user.ManagerUserId is not null)
            {
                continue;
            }

            if (!byEmail.TryGetValue(managerEmail, out var manager))
            {
                continue;
            }

            user.SetManager(manager.Id);
            changed = true;
        }

        foreach (var (personnelNo, managerPersonnelNo) in UserManagerLinksByNrp)
        {
            if (!byPersonnelNo.TryGetValue(personnelNo, out var user) || user.ManagerUserId is not null)
            {
                continue;
            }

            if (!byPersonnelNo.TryGetValue(managerPersonnelNo, out var manager))
            {
                continue;
            }

            user.SetManager(manager.Id);
            changed = true;
        }

        if (changed)
        {
            await dbContext.SaveChangesAsync();
        }
    }

    private static async Task SeedRolePermissionsAsync(ProcurementDbContext dbContext)
    {
        var rolesByCode = await dbContext.InternalRoles.ToDictionaryAsync(role => role.Code);
        var permissionsByKey = await dbContext.Permissions.ToDictionaryAsync(permission => permission.Key);
        var existingAssignments = await dbContext.InternalRolePermissions
            .Select(rolePermission => new { rolePermission.RoleId, rolePermission.PermissionId })
            .ToArrayAsync();
        var existing = existingAssignments
            .Select(item => $"{item.RoleId:N}:{item.PermissionId:N}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var allPermissionKeys = AllPermissions.Select(permission => permission.Key).ToArray();

        foreach (var seed in Roles)
        {
            if (!rolesByCode.TryGetValue(seed.Code, out var role))
            {
                continue;
            }

            // Null PermissionKeys grants every permission (Super Admin); otherwise the explicit set.
            var grantedKeys = seed.PermissionKeys ?? allPermissionKeys;
            foreach (var permissionKey in grantedKeys)
            {
                if (!permissionsByKey.TryGetValue(permissionKey, out var permission))
                {
                    continue;
                }

                var key = $"{role.Id:N}:{permission.Id:N}";
                if (existing.Add(key))
                {
                    dbContext.InternalRolePermissions.Add(InternalRolePermissionAssignment.Create(role.Id, permission.Id));
                }
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task RestrictSuperAdminOnlyPermissionsAsync(ProcurementDbContext dbContext)
    {
        var superAdminRoleId = await dbContext.InternalRoles
            .AsNoTracking()
            .Where(role => role.Code == "SPR-ADM")
            .Select(role => (Guid?)role.Id)
            .FirstOrDefaultAsync();
        if (superAdminRoleId is null)
        {
            return;
        }

        var restrictedPermissionIds = await dbContext.Permissions
            .AsNoTracking()
            .Where(permission => SuperAdminOnlyPermissionKeys.Contains(permission.Key))
            .Select(permission => permission.Id)
            .ToArrayAsync();
        if (restrictedPermissionIds.Length == 0)
        {
            return;
        }

        await dbContext.InternalRolePermissions
            .Where(assignment =>
                restrictedPermissionIds.Contains(assignment.PermissionId)
                && assignment.RoleId != superAdminRoleId.Value)
            .ExecuteDeleteAsync();
    }

    private sealed record SeedRole(
        string Code,
        string Name,
        string? ModuleKey,
        bool IsSystem,
        string[]? PermissionKeys);

    private sealed record SeedPermission(
        string Key,
        string ModuleKey,
        string Name,
        string Description);

    private sealed record SeedUser(
        string PersonnelNo,
        string DisplayName,
        string Email,
        string Department,
        string Position,
        string Status,
        IReadOnlyCollection<string> RoleNames);
}
