namespace IntegratedProcurement.BuildingBlocks.Application;

public static class PermissionKeys
{
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
    public const string MasterDataAdministrationView = "masterData.administration.view";
    public const string MasterDataAdministrationManage = "masterData.administration.manage";

    public static IReadOnlyCollection<string> All => [.. Fixed, .. MasterDataScreens.PermissionKeys];

    private static IReadOnlyCollection<string> Fixed =>
    [
        DashboardView,
        DashboardExport,
        UsersView,
        UsersCreate,
        UsersUpdate,
        UsersDelete,
        UsersPermissions,
        RolesView,
        RolesCreate,
        RolesUpdate,
        RolesDelete,
        PermissionsView,
        PermissionsAssign,
        LanguagesView,
        LanguagesManage,
        LanguagesTranslate,
        EmailTemplatesView,
        EmailTemplatesManage,
        EmailLogsView,
        EmailRemindersView,
        AuditView,
        AuditExport,
        SettingsView,
        SettingsUpdate,
        MasterDataAdministrationView,
        MasterDataAdministrationManage,
    ];
}
