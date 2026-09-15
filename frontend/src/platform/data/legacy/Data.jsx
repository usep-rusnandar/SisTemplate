/* fm2-converted */
/* Alamtri Geo Admin — realistic sample data (Indonesian enterprise flavor). */

const CURRENT_USER = { name: "", email: "", role: "" }

const APP_MODULES = [
  { key: "platform", name: "Platform Foundation", shortName: "Platform", icon: "layout-grid", owner: "Operations", edition: "internal", status: "Active", description: "Shared internal workspace, layout, notifications, and reusable shell capabilities." },
  { key: "administration", name: "Platform Administration", shortName: "Admin", icon: "shield", owner: "Operations", edition: "internal", status: "Active", description: "Users, roles, permissions, settings, audit, and supporting administration tools." },
]
const APP_MODULE_KEYS = APP_MODULES.map((m) => m.key)
const APP_MODULE_BY_KEY = Object.fromEntries(APP_MODULES.map((m) => [m.key, m]))
const APP_EDITION = (typeof window !== "undefined" && window.__APP_EDITION) || "internal"
function editionForModuleKey(key) { const m = APP_MODULE_BY_KEY[key]; return m ? (m.edition || "internal") : "internal" }

let _ROLE_CATALOG = []
function normalizeRoleModules(modules, roleName) {
  const known = (Array.isArray(modules) ? modules : []).filter((key) => !!APP_MODULE_BY_KEY[key])
  return known.length ? known : modulesForRoleName(roleName)
}
function setRoleCatalog(list) {
  _ROLE_CATALOG = (Array.isArray(list) ? list : []).map((r) => ({
    ...r,
    modules: normalizeRoleModules(r.modules, r.name),
  }))
}
function getRoleCatalog() { return _ROLE_CATALOG.slice() }

function modulesForRoleName(name) {
  const roleName = String(name || "")
  if (!roleName) return []
  if (roleName === "Super Admin") return APP_MODULE_KEYS.slice()
  if (roleName === "Administrator" || /^Administrator /.test(roleName)) return APP_MODULE_KEYS.slice()
  return ["platform"]
}
function moduleLabelsForRole(role) {
  const keys = role.modules && role.modules.length ? role.modules : modulesForRoleName(role.name)
  return keys.map((k) => APP_MODULE_BY_KEY[k]).filter(Boolean).map((m) => m.name)
}
function moduleKeysForRoleName(roleName) {
  const role = _ROLE_CATALOG.find((r) => r.name === roleName)
  return role ? (role.modules || []) : modulesForRoleName(roleName)
}
function moduleKeysForUser(user) {
  return [...new Set((user.roles || [user.role]).flatMap(moduleKeysForRoleName))]
}
function isModuleAdministratorRole(roleName) {
  return roleName === "Administrator" || /^Administrator /.test(roleName || "")
}
function adminModuleScopeForRoles(roles) {
  const rs = Array.isArray(roles) ? roles : [roles]
  if (rs.includes("Super Admin")) return null
  const adminRoles = rs.filter(isModuleAdministratorRole)
  if (adminRoles.length === 0) return null
  return [...new Set(adminRoles.flatMap(moduleKeysForRoleName))]
}

const PERMISSION_MODULES = [
  { module: "Dashboard", icon: "layout-grid", perms: [
    { key: "dashboard.view", name: "View dashboard", desc: "Access the main dashboard and KPI widgets", createdAt: "2024-01-10" },
    { key: "dashboard.export", name: "Export dashboard", desc: "Export dashboard widgets and charts", createdAt: "2024-01-10" },
  ]},
  { module: "Users", icon: "users-round", perms: [
    { key: "users.view", name: "View users", desc: "List and view user accounts", createdAt: "2024-01-10" },
    { key: "users.create", name: "Create user", desc: "Create new user accounts", createdAt: "2024-01-10" },
    { key: "users.update", name: "Update user", desc: "Edit user profile and account details", createdAt: "2024-01-10" },
    { key: "users.delete", name: "Delete user", desc: "Permanently remove user accounts", createdAt: "2024-01-10" },
    { key: "users.permissions", name: "Manage user permissions", desc: "Assign direct permissions to users", createdAt: "2024-01-10" },
  ]},
  { module: "Roles", icon: "shield-check", perms: [
    { key: "roles.view", name: "View roles", desc: "List and view roles", createdAt: "2024-01-10" },
    { key: "roles.create", name: "Create role", desc: "Define new roles", createdAt: "2024-01-10" },
    { key: "roles.update", name: "Update role", desc: "Edit role details and permissions", createdAt: "2024-01-10" },
    { key: "roles.delete", name: "Delete role", desc: "Remove non-system roles", createdAt: "2024-01-10" },
  ]},
  { module: "Permissions", icon: "key-round", perms: [
    { key: "permissions.view", name: "View permissions", desc: "List all system permissions", createdAt: "2024-01-10" },
    { key: "permissions.assign", name: "Assign permissions", desc: "Attach permissions to roles", createdAt: "2024-01-10" },
  ]},
  { module: "Languages", icon: "languages", perms: [
    { key: "languages.view", name: "View languages", desc: "List configured languages", createdAt: "2024-01-12" },
    { key: "languages.manage", name: "Manage languages", desc: "Add, enable, and set default languages", createdAt: "2024-01-12" },
    { key: "languages.translate", name: "Edit translations", desc: "Edit language text entries", createdAt: "2024-01-12" },
  ]},
  { module: "Email", icon: "mail", perms: [
    { key: "email.templates.view", name: "View email templates", desc: "Browse email templates", createdAt: "2024-01-15" },
    { key: "email.templates.manage", name: "Manage email templates", desc: "Create and edit email templates", createdAt: "2024-01-15" },
    { key: "email.logs.view", name: "View sent emails", desc: "Access the email delivery log", createdAt: "2024-01-15" },
  ]},
  { module: "Audit", icon: "scroll-text", perms: [
    { key: "audit.view", name: "View audit log", desc: "Read the system audit trail", createdAt: "2024-01-18" },
    { key: "audit.export", name: "Export audit log", desc: "Export audit records to CSV", createdAt: "2024-01-18" },
  ]},
  { module: "Settings", icon: "sliders-horizontal", perms: [
    { key: "settings.view", name: "View settings", desc: "Access system settings and the background-process catalog", createdAt: "2024-01-20" },
    { key: "settings.update", name: "Update settings", desc: "Modify system and security settings, and run scheduled background processes", createdAt: "2024-01-20" },
  ]},
]

let _PERMISSION_CATALOG = null
function setPermissionCatalog(groups) {
  const list = (Array.isArray(groups) ? groups : [])
    .map((g) => ({
      module: g.module || g.Module || "",
      icon: g.icon || g.Icon || "key-round",
      perms: (g.permissions || g.Permissions || g.perms || []).map((p) => ({
        key: p.key || p.Key,
        name: p.name || p.Name || p.key || p.Key,
        desc: p.description || p.Description || p.desc || "",
      })).filter((p) => p.key),
    }))
    .filter((g) => g.perms.length > 0)
  _PERMISSION_CATALOG = list.length > 0 ? list : null
  return getPermissionCatalog()
}
function getPermissionCatalog() { return _PERMISSION_CATALOG || PERMISSION_MODULES }
function permissionCatalogIsHydrated() { return _PERMISSION_CATALOG !== null }
function allPermissionKeys() { return getPermissionCatalog().flatMap((m) => m.perms.map((p) => p.key)) }

Object.assign(window, { CURRENT_USER, APP_MODULES, APP_MODULE_KEYS, APP_MODULE_BY_KEY, APP_EDITION, editionForModuleKey, modulesForRoleName, moduleKeysForRoleName, moduleKeysForUser, isModuleAdministratorRole, adminModuleScopeForRoles, moduleLabelsForRole, setRoleCatalog, getRoleCatalog, PERMISSION_MODULES, setPermissionCatalog, getPermissionCatalog, permissionCatalogIsHydrated, allPermissionKeys })

const LANGUAGES = []
const LANGUAGE_TEXT = []

Object.assign(window, { LANGUAGES, LANGUAGE_TEXT })

const EMAIL_CATEGORIES = [
  { key: "Users", tone: "neutral", icon: "users" },
  { key: "Platform", tone: "brand", icon: "layout-grid" },
  { key: "Notifications", tone: "info", icon: "bell" },
]

const EMAIL_TEMPLATES = []

const EMAIL_SENDER_MODULES = [
  { key: "users", label: "Users" },
  { key: "platform", label: "Platform" },
  { key: "notifications", label: "Notifications" },
]

function emailSenderModuleKeyForCategory(category) {
  const c = String(category || "").trim()
  if (!c) return null
  const hit = EMAIL_SENDER_MODULES.find((m) => m.label === c || (m.categoryAliases || []).includes(c))
  return hit ? hit.key : null
}

Object.assign(window, { EMAIL_CATEGORIES, EMAIL_TEMPLATES, EMAIL_SENDER_MODULES, emailSenderModuleKeyForCategory })
export { CURRENT_USER, APP_MODULES, APP_MODULE_KEYS, APP_MODULE_BY_KEY, APP_EDITION, editionForModuleKey, modulesForRoleName, moduleKeysForRoleName, moduleKeysForUser, isModuleAdministratorRole, adminModuleScopeForRoles, moduleLabelsForRole, setRoleCatalog, getRoleCatalog, PERMISSION_MODULES, setPermissionCatalog, getPermissionCatalog, permissionCatalogIsHydrated, allPermissionKeys, LANGUAGES, LANGUAGE_TEXT, EMAIL_CATEGORIES, EMAIL_TEMPLATES, EMAIL_SENDER_MODULES, emailSenderModuleKeyForCategory }
