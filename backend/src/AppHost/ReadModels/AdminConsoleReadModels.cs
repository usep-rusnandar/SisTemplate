using System.Globalization;
using SisTemplate.Platform.Administration.Application;

namespace SisTemplate.AppHost.Api.ReadModels;

internal static class AdminConsoleReadModels
{
    private static readonly AdminModuleItem[] Modules =
    [
        new("administration", "Administration", "Internal", "Active", "Platform", 5),
        new("masterData", "Master Data", "Internal", "Active", "Platform", 3),
        new("superAdmin", "Super Admin", "Internal", "Active", "Platform", 9)
    ];

    private static readonly AdminRoleItem[] Roles =
    [
        new("SPR-ADM", "Super Admin", "Full unrestricted access to every module and setting.", 1, 37, true, ["superAdmin", "administration", "masterData"]),
        new("ADM-PLT", "Platform Administrator", "Administer users, roles, languages, email templates, settings, and master data.", 1, 21, false, ["administration", "masterData"]),
        new("AUD-PLT", "Platform Auditor", "Read-only access to the dashboard, audit log, and settings.", 1, 4, false, ["superAdmin"])
    ];

    private static readonly AdminUserItem[] Users =
    [
        new(1, "00109610", "usep.rusnandar", "USEP RUSNANDAR", "usep.rusnandar@saptaindra.co.id", "Active", ["Super Admin"], "2 min ago"),
        new(2, "00116251", "wita.aprilia", "WITA APRILIA", "wita.aprilia@saptaindra.co.id", "Active", ["Platform Administrator"], "1 hour ago"),
        new(3, "00117404", "yusuf.binsar", "YUSUF BINSAR", "yusuf.binsar@saptaindra.co.id", "Active", ["Platform Auditor"], "Yesterday")
    ];

    private static readonly PermissionGroup[] PermissionGroups =
    [
        new("Users", "users-round", [
            new("users.view", "View users", "List and view user accounts"),
            new("users.create", "Create user", "Create new user accounts"),
            new("users.update", "Update user", "Edit user profile and account details"),
            new("users.delete", "Delete user", "Deactivate user accounts"),
            new("users.permissions", "Manage user permissions", "Assign direct permissions to users")
        ]),
        new("Roles", "shield-check", [
            new("roles.view", "View roles", "List and view roles"),
            new("roles.create", "Create role", "Define new roles"),
            new("roles.update", "Update role", "Edit role details and permissions"),
            new("roles.delete", "Delete role", "Remove non-system roles")
        ]),
        new("Languages", "languages", [
            new("languages.view", "View languages", "List configured languages"),
            new("languages.manage", "Manage languages", "Add, enable, and set default languages"),
            new("languages.translate", "Edit translations", "Edit language text entries")
        ]),
        new("Email", "mail", [
            new("email.templates.view", "View email templates", "Browse email templates"),
            new("email.templates.manage", "Manage email templates", "Create and edit email templates"),
            new("email.logs.view", "View sent emails", "Access the email delivery log")
        ]),
        new("Audit", "scroll-text", [
            new("audit.view", "View audit log", "Read the system audit trail"),
            new("audit.export", "Export audit log", "Export audit records to CSV")
        ]),
        new("Settings", "sliders-horizontal", [
            new("settings.view", "View settings", "Access system settings"),
            new("settings.update", "Update settings", "Modify system and security settings")
        ])
    ];

    private static readonly MenuGroup[] MenuGroups =
    [
        new("superAdmin", "Super Admin", "crown", ["Modules", "Permissions", "Menus", "Languages", "Language Text", "Email Templates", "Email Sent", "Audit", "Settings", "Background processes"]),
        new("administration", "Administration", "shield", ["Users", "Roles", "Email Templates"]),
        new("masterData", "Master Data", "database", ["Holiday", "Country", "Administrative Regions"])
    ];

    private static readonly LanguageItem[] Languages =
    [
        new("en", "English", "Active", false, 428),
        new("id", "Bahasa Indonesia", "Active", true, 428)
    ];

    private static readonly LanguageTextItem[] LanguageText =
    [
        new("nav.superadmin", "Navigation", "Super Admin", "Super Admin", "Active"),
        new("nav.administration", "Navigation", "Administration", "Administrasi", "Active"),
        new("nav.masterData", "Navigation", "Master Data", "Master Data", "Active"),
        new("act.saveChanges", "Action", "Save changes", "Simpan perubahan", "Active"),
        new("validation.required", "Validation", "This field is required", "Kolom ini wajib diisi", "Active")
    ];

    private static readonly EmailTemplateItem[] EmailTemplates =
    [
        new("ET-01", "Account created", "Users", "Active", "Your SisTemplate account is ready", 3),
        new("ET-25", "Internal password reset", "Users", "Active", "Reset Password – SisTemplate", 4)
    ];

    private static readonly EmailSentItem[] EmailSent =
    [
        new("MSG-2026-0412", "Account created", "wita.aprilia@saptaindra.co.id", "Delivered", "2026-06-22 09:14"),
        new("MSG-2026-0411", "Internal password reset", "yusuf.binsar@saptaindra.co.id", "Delivered", "2026-06-22 08:00"),
        new("MSG-2026-0407", "Account created", "usep.rusnandar@saptaindra.co.id", "Opened", "2026-06-21 16:20")
    ];

    private static readonly AuditItem[] Audit =
    [
        new(1, "Login", "Usep Rusnandar", "Auth", "SSO login accepted", "103.28.14.2", "2026-06-22 08:58:22"),
        new(2, "Update", "Usep Rusnandar", "Users", "Updated role for Wita Aprilia", "103.28.14.8", "2026-06-22 08:51:33"),
        new(3, "Create", "Usep Rusnandar", "Roles", "Created role Platform Auditor", "103.28.14.21", "2026-06-21 16:42:10"),
        new(4, "Export", "Usep Rusnandar", "Audit", "Exported audit log to CSV", "103.28.14.2", "2026-06-21 14:08:55")
    ];

    private static readonly SettingItem[] Settings =
    [
        new("security.lockout", "User lock out", "Enabled", "Protect accounts from brute-force login attempts."),
        new("session.timeout", "Session timeout", "8 hours", "Internal SSO session idle timeout."),
        new("sso.enabled", "SISWarrior SSO", "False in Development", "Boolean integration switch."),
        new("email.sender", "Default email sender", "no-reply@sistemplate.local", "Transactional email sender identity.")
    ];

    private static readonly MasterDataSet[] MasterData =
    [
        new("holiday", "Holiday", "MSTR_HOLIDAY_T", "Administration", [
            new("HOL-2026-001", "Idul Fitri", "Active", "2026-03-21"),
            new("HOL-2026-002", "Independence Day", "Active", "2026-08-17")
        ]),
        new("country", "Country", "MSTR_COUNTRY_T", "Administration", [
            new("ID", "Indonesia", "Active", "+62"),
            new("SG", "Singapore", "Active", "+65")
        ]),
        new("administrativeRegions", "Administrative Regions", "MSTR_PROVINCE_T", "Administration", [
            new("32", "Jawa Barat", "Active", "Province"),
            new("31", "DKI Jakarta", "Active", "Province")
        ])
    ];

    public static ConsoleOverview SuperAdminOverview() =>
        new(
            "Super Admin",
            [
                new("Modules", FormatCount(Modules.Length), "Registered application modules"),
                new("Permissions", FormatCount(PermissionGroups.Sum(group => group.Permissions.Count)), "Atomic permission keys"),
                new("Menu groups", FormatCount(MenuGroups.Length), "Editable navigation groups"),
                new("Audit records", FormatCount(Audit.Length), "Recent activity records")
            ],
            MenuGroups.Where(group => group.Key is "superAdmin" or "administration" or "masterData").ToArray());

    public static IReadOnlyCollection<AdminModuleItem> ModulesList() => Modules;

    public static IReadOnlyCollection<PermissionGroup> PermissionList() => PermissionGroups;

    public static IReadOnlyCollection<MenuGroup> MenuList() => MenuGroups;

    public static IReadOnlyCollection<LanguageItem> LanguagesList() => Languages;

    public static IReadOnlyCollection<LanguageTextItem> LanguageTextList() => LanguageText;

    public static IReadOnlyCollection<EmailTemplateItem> EmailTemplateList() => EmailTemplates;

    public static IReadOnlyCollection<EmailSentItem> EmailSentList() => EmailSent;

    public static IReadOnlyCollection<AuditItem> AuditList() => Audit;

    public static IReadOnlyCollection<SettingItem> SettingsList() => Settings;

    public static ConsoleOverview AdministrationOverview() =>
        new(
            "Administration",
            [
                new("Users", FormatCount(Users.Length), "Internal accounts in scope"),
                new("Active users", FormatCount(Users.Count(user => user.Status == "Active")), "Can access internal app"),
                new("Roles", FormatCount(Roles.Length), "Configured role profiles"),
                new("Multi-role users", FormatCount(Users.Count(user => user.Roles.Count > 1)), "Union-based access")
            ],
            MenuGroups.Where(group => group.Key == "administration").ToArray());

    public static IReadOnlyCollection<AdminUserItem> UsersList() => Users;

    public static IReadOnlyCollection<AdminRoleItem> RolesList() => Roles;

    public static RolePermissionMatrix RolePermissionMatrix() =>
        new(
            Roles,
            PermissionGroups,
            Roles.ToDictionary(
                role => role.RoleId,
                role => PermissionGroups
                    .SelectMany(group => group.Permissions)
                    .Select(permission => permission.Key)
                    .Take(Math.Min(role.Permissions, PermissionGroups.Sum(group => group.Permissions.Count)))
                    .ToArray() as IReadOnlyCollection<string>));

    public static ConsoleOverview MasterDataOverview() =>
        new(
            "Master Data",
            [
                new("Datasets", FormatCount(MasterData.Length), "Master tables mirrored from mockup"),
                new("Administration refs", FormatCount(MasterData.Count(item => item.Owner == "Administration")), "Administration master references"),
                new("Total records", FormatCount(MasterData.Sum(item => item.Records.Count)), "Records across all master data sets")
            ],
            MenuGroups.Where(group => group.Key == "masterData").ToArray());

    public static IReadOnlyCollection<MasterDataSet> MasterDataSets() => MasterData;

    public static MasterDataSet? MasterDataSet(string key) =>
        MasterData.FirstOrDefault(item => string.Equals(item.Key, key, StringComparison.OrdinalIgnoreCase));

    private static string FormatCount(int value) =>
        value.ToString("N0", CultureInfo.InvariantCulture);
}

internal sealed record ConsoleOverview(
    string Area,
    IReadOnlyCollection<ConsoleMetric> Metrics,
    IReadOnlyCollection<MenuGroup> MenuGroups);

internal sealed record ConsoleMetric(string Label, string Value, string Description);

internal sealed record AdminModuleItem(
    string Key,
    string Name,
    string Edition,
    string Status,
    string Owner,
    int MenuItems);

internal sealed record MenuGroup(
    string Key,
    string Label,
    string Icon,
    IReadOnlyCollection<string> Items);

internal sealed record LanguageItem(
    string Code,
    string Name,
    string Status,
    bool IsDefault,
    int TextKeys);

internal sealed record LanguageTextItem(
    string Key,
    string Area,
    string EnglishText,
    string IndonesianText,
    string Status);

internal sealed record EmailTemplateItem(
    string TemplateId,
    string Name,
    string Category,
    string Status,
    string Subject,
    int Variables);

internal sealed record EmailSentItem(
    string MessageId,
    string Template,
    string Recipient,
    string Status,
    string SentAt);

internal sealed record AuditItem(
    int Id,
    string Action,
    string User,
    string Module,
    string Description,
    string IpAddress,
    string Time);

internal sealed record SettingItem(
    string Key,
    string Name,
    string Value,
    string Description);

internal sealed record RolePermissionMatrix(
    IReadOnlyCollection<AdminRoleItem> Roles,
    IReadOnlyCollection<PermissionGroup> PermissionGroups,
    IReadOnlyDictionary<string, IReadOnlyCollection<string>> Assignments);

