using SisTemplate.BuildingBlocks.Application;
using SisTemplate.Platform.InternalIdentity.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace SisTemplate.Platform.Persistence.Seeding;

public static class InitialIamDataSeeder
{
    private static readonly SeedRole[] Roles =
    [
        new("SPR-ADM", "Super Admin", null, true, null),
        new("ADM-PLT", "Platform Administrator", ModuleKeys.Administration, false,
        [
            PermissionKeys.DashboardView,
            PermissionKeys.UsersView,
            PermissionKeys.UsersCreate,
            PermissionKeys.UsersUpdate,
            PermissionKeys.UsersDelete,
            PermissionKeys.UsersPermissions,
            PermissionKeys.RolesView,
            PermissionKeys.RolesCreate,
            PermissionKeys.RolesUpdate,
            PermissionKeys.RolesDelete,
            PermissionKeys.PermissionsView,
            PermissionKeys.PermissionsAssign,
            PermissionKeys.LanguagesView,
            PermissionKeys.LanguagesManage,
            PermissionKeys.LanguagesTranslate,
            PermissionKeys.EmailTemplatesView,
            PermissionKeys.EmailTemplatesManage,
            PermissionKeys.EmailLogsView,
            PermissionKeys.SettingsView,
            PermissionKeys.SettingsUpdate,
            PermissionKeys.MasterDataAdministrationView,
            PermissionKeys.MasterDataAdministrationManage,
        ]),
        new("AUD-PLT", "Platform Auditor", ModuleKeys.Audit, false,
        [
            PermissionKeys.DashboardView,
            PermissionKeys.AuditView,
            PermissionKeys.AuditExport,
            PermissionKeys.SettingsView,
        ]),
    ];

    private static readonly SeedPermission[] Permissions =
    [
        new(PermissionKeys.DashboardView, "dashboard", "View dashboard", "Access the main dashboard and KPI widgets"),
        new(PermissionKeys.DashboardExport, "dashboard", "Export dashboard", "Export dashboard widgets and charts"),
        new(PermissionKeys.UsersView, "users", "View users", "List and view user accounts"),
        new(PermissionKeys.UsersCreate, "users", "Create user", "Create new user accounts"),
        new(PermissionKeys.UsersUpdate, "users", "Update user", "Edit user profile and account details"),
        new(PermissionKeys.UsersDelete, "users", "Delete user", "Permanently remove user accounts"),
        new(PermissionKeys.UsersPermissions, "users", "Manage user permissions", "Assign direct permissions to users"),
        new(PermissionKeys.RolesView, "roles", "View roles", "List and view roles"),
        new(PermissionKeys.RolesCreate, "roles", "Create role", "Define new roles"),
        new(PermissionKeys.RolesUpdate, "roles", "Update role", "Edit role details and permissions"),
        new(PermissionKeys.RolesDelete, "roles", "Delete role", "Remove non-system roles"),
        new(PermissionKeys.PermissionsView, "permissions", "View permissions", "List all system permissions"),
        new(PermissionKeys.PermissionsAssign, "permissions", "Assign permissions", "Attach permissions to roles"),
        new(PermissionKeys.LanguagesView, "languages", "View languages", "List configured languages"),
        new(PermissionKeys.LanguagesManage, "languages", "Manage languages", "Add, enable, and set default languages"),
        new(PermissionKeys.LanguagesTranslate, "languages", "Edit translations", "Edit language text entries"),
        new(PermissionKeys.EmailTemplatesView, "email", "View email templates", "Browse email templates"),
        new(PermissionKeys.EmailTemplatesManage, "email", "Manage email templates", "Create and edit email templates"),
        new(PermissionKeys.EmailLogsView, "email", "View sent emails", "Access the email delivery log"),
        new(PermissionKeys.EmailRemindersView, "email", "View reminder logs", "Access reminder delivery logs"),
        new(PermissionKeys.AuditView, "audit", "View audit log", "Read the system audit trail"),
        new(PermissionKeys.AuditExport, "audit", "Export audit log", "Export audit records to CSV"),
        new(PermissionKeys.SettingsView, "settings", "View settings", "Access system settings and the background-process catalog"),
        new(PermissionKeys.SettingsUpdate, "settings", "Update settings", "Modify system and security settings, and run scheduled background processes"),
        new(PermissionKeys.MasterDataAdministrationView, "masterData", "View administration master data", "Read platform reference-data sets and records"),
        new(PermissionKeys.MasterDataAdministrationManage, "masterData", "Manage administration master data", "Create and edit platform reference-data records"),
    ];

    private static readonly SeedPermission[] MasterDataScreenPermissions =
    [
        .. MasterDataScreens.All.SelectMany(screen => new[]
        {
            new SeedPermission(screen.ViewPermission, "masterData", $"View {screen.Name} master data", $"Read the {screen.Name} master data screen"),
            new SeedPermission(screen.ManagePermission, "masterData", $"Manage {screen.Name} master data", $"Create and edit records on the {screen.Name} master data screen"),
        }),
    ];

    private static IEnumerable<SeedPermission> AllPermissions => [.. Permissions, .. MasterDataScreenPermissions];

    /// <summary>Every permission key this seeder inserts. Used by the RBAC catalog guard test.</summary>
    public static IReadOnlyCollection<string> CatalogPermissionKeys =>
        [.. AllPermissions.Select(permission => permission.Key)];

    /// <summary>Every permission key referenced by a role grant. Used by the RBAC catalog guard test.</summary>
    public static IReadOnlyCollection<string> GrantedPermissionKeys =>
        [.. Roles.Where(role => role.PermissionKeys is { Count: > 0 }).SelectMany(role => role.PermissionKeys!)];

    private static readonly SeedUser[] Users =
    [
        new("00109610", "USEP RUSNANDAR", "usep.rusnandar@saptaindra.co.id", "IT & OT DEVELOPMENT DEPARTMENT", "SENIOR OFFICER - ERP & INTEGRATION", InternalIdentityStatuses.Active, ["Super Admin"]),
        new("00116251", "WITA APRILIA", "wita.aprilia@saptaindra.co.id", "IT & OT DEVELOPMENT DEPARTMENT", "PLATFORM ADMINISTRATOR", InternalIdentityStatuses.Active, ["Platform Administrator"]),
        new("00117404", "YUSUF BINSAR", "yusuf.binsar@saptaindra.co.id", "IT & OT DEVELOPMENT DEPARTMENT", "PLATFORM AUDITOR", InternalIdentityStatuses.Active, ["Platform Auditor"]),
    ];

    public static async Task SeedInitialIamDataAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ProcurementDbContext>();
        await dbContext.Database.MigrateAsync();

        await SeedPermissionsAsync(dbContext);
        await SeedRolesAsync(dbContext);
        await SeedUsersAsync(dbContext);
    }

    private static async Task SeedPermissionsAsync(ProcurementDbContext dbContext)
    {
        var existing = await dbContext.Permissions.ToDictionaryAsync(permission => permission.Key, StringComparer.OrdinalIgnoreCase);
        foreach (var seed in AllPermissions)
        {
            if (!existing.ContainsKey(seed.Key))
            {
                dbContext.Permissions.Add(PermissionDefinition.Create(seed.Key, seed.ModuleKey, seed.Name, seed.Description));
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedRolesAsync(ProcurementDbContext dbContext)
    {
        var existingRoles = await dbContext.InternalRoles.ToDictionaryAsync(role => role.Code, StringComparer.OrdinalIgnoreCase);
        foreach (var seed in Roles)
        {
            if (!existingRoles.TryGetValue(seed.Code, out var role))
            {
                role = InternalRole.Create(seed.Code, seed.Name, seed.ModuleKey, seed.IsSystem);
                dbContext.InternalRoles.Add(role);
            }
            else
            {
                role.Update(seed.Name, seed.ModuleKey, seed.IsSystem);
            }
        }

        await dbContext.SaveChangesAsync();

        var permissions = await dbContext.Permissions.ToDictionaryAsync(permission => permission.Key, StringComparer.OrdinalIgnoreCase);
        var roles = await dbContext.InternalRoles.ToDictionaryAsync(role => role.Code, StringComparer.OrdinalIgnoreCase);
        dbContext.InternalRolePermissions.RemoveRange(dbContext.InternalRolePermissions);
        foreach (var seed in Roles)
        {
            var role = roles[seed.Code];

            // Null PermissionKeys grants every permission (used for the Super Admin role).
            var grantedKeys = seed.PermissionKeys ?? permissions.Keys;
            foreach (var permissionKey in grantedKeys)
            {
                if (permissions.TryGetValue(permissionKey, out var permission))
                {
                    dbContext.InternalRolePermissions.Add(InternalRolePermissionAssignment.Create(role.Id, permission.Id));
                }
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedUsersAsync(ProcurementDbContext dbContext)
    {
        var existingUsers = await dbContext.InternalUsers.ToDictionaryAsync(user => user.PersonnelNo, StringComparer.OrdinalIgnoreCase);
        foreach (var seed in Users)
        {
            if (!existingUsers.TryGetValue(seed.PersonnelNo, out var user))
            {
                user = InternalUser.Create(seed.PersonnelNo, seed.FullName, seed.Email, seed.Department, seed.Position);
                dbContext.InternalUsers.Add(user);
            }
            else
            {
                user.UpdateProfile(seed.FullName, seed.Email, seed.Department, seed.Position);
                user.SetStatus(seed.Status);
            }
        }

        await dbContext.SaveChangesAsync();

        var users = await dbContext.InternalUsers.ToDictionaryAsync(user => user.PersonnelNo, StringComparer.OrdinalIgnoreCase);
        var roles = await dbContext.InternalRoles.ToDictionaryAsync(role => role.Name, StringComparer.OrdinalIgnoreCase);
        dbContext.InternalUserRoles.RemoveRange(dbContext.InternalUserRoles);
        foreach (var seed in Users)
        {
            var user = users[seed.PersonnelNo];
            foreach (var roleName in seed.RoleNames)
            {
                if (roles.TryGetValue(roleName, out var role))
                {
                    dbContext.InternalUserRoles.Add(InternalUserRole.Create(user.Id, role.Id));
                }
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private sealed record SeedRole(string Code, string Name, string? ModuleKey, bool IsSystem, IReadOnlyCollection<string>? PermissionKeys);
    private sealed record SeedPermission(string Key, string ModuleKey, string Name, string? Description);
    private sealed record SeedUser(string PersonnelNo, string FullName, string Email, string Department, string Position, string Status, IReadOnlyCollection<string> RoleNames);
}
