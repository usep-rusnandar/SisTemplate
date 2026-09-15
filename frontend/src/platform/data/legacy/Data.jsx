/* fm2-converted */
/* Alamtri Geo Admin — realistic sample data (Indonesian enterprise flavor). */

// Neutral pre-login placeholder only. The real identity always comes from the backend session
// (/auth/me) via session.login(); no hardcoded person/role lives in the frontend.
const CURRENT_USER = { name: "", email: "", role: "" };

/* edition: "external" = vendor-facing portal (vendor.html); "internal" = staff portal (index.html).
   This is the single source of truth for the internal/external deployment split. */
const APP_MODULES = [
  { key: "vendorWorkspace", name: "Vendor Workspace", shortName: "VW", icon: "handshake", owner: "Procurement", edition: "external", status: "Active", description: "Vendor self-service workspace — vendors manage their own company profile, documents, onboarding, and expediting." },
  { key: "vendorOnboarding", name: "Vendor Onboarding", shortName: "Vendor", icon: "building-2", owner: "Procurement", edition: "internal", status: "Active", description: "Vendor registry, onboarding, approvals, and invitations." },
  { key: "proposalTracker", name: "Proposal Tracker", shortName: "Proposal Tracker", icon: "route", owner: "Procurement", edition: "internal", status: "Active", description: "Proposal tracking, SLA, Term Sheet → Contract, LOA, and recycle workflows." },
  { key: "contractInitiationPlatform", name: "Contract Initiation Platform", shortName: "CIP", icon: "sparkles", owner: "Legal & Procurement", edition: "internal", status: "Retired", description: "Merged into Proposal Tracker. Term Sheet, templates, and repository live under Tracker." },
  { key: "contractMonitoring", name: "Contract Monitoring", shortName: "CM", icon: "file-text", owner: "Contract Monitoring", edition: "internal", status: "Active", description: "Contract database, expiry reminders, monitoring dashboard, and import migration." },
];
const APP_MODULE_KEYS = APP_MODULES.map((m) => m.key);
const APP_MODULE_BY_KEY = Object.fromEntries(APP_MODULES.map((m) => [m.key, m]));
const APP_EDITION = (typeof window !== "undefined" && window.__APP_EDITION) || "internal";
function editionForModuleKey(key) { const m = APP_MODULE_BY_KEY[key]; return m ? (m.edition || "internal") : "internal"; }

/* Runtime role catalog — hydrated from the backend RBAC catalog (/api/v1/administration/roles)
   by SessionProvider and exposed as session.roles. This replaces the former ROLES mock array;
   roles now live only in the backend. The pure name-pattern mapping (modulesForRoleName) below
   remains the deterministic fallback used before hydration and for role names not (yet) in the
   catalog, so menu/module scoping keeps working without any seeded role data. */
let _ROLE_CATALOG = [];
function setRoleCatalog(list) {
  _ROLE_CATALOG = (Array.isArray(list) ? list : []).map((r) => ({
    ...r,
    modules: (r.modules && r.modules.length) ? r.modules.slice() : modulesForRoleName(r.name),
  }));
}
function getRoleCatalog() { return _ROLE_CATALOG.slice(); }

function modulesForRoleName(name) {
  if (name === "Super Admin") return APP_MODULE_KEYS.slice();
  if (name === "Division Head") return APP_MODULE_KEYS.slice(); // only cross-module role; Dept Heads are per-module now
  if (name === "Vendor") return ["vendorWorkspace"];
  if (name.includes("Vendor")) return ["vendorOnboarding"];     // Admin/Department/Section/Officer Vendor Onboarding
  if (name.includes("Tracker")) return ["proposalTracker"];     // "…Proposal Tracker"
  if (name.includes("Contract Initiation Platform")) return ["proposalTracker"];
  if (name.includes("Contract Monitoring")) return ["contractMonitoring"];
  return [];
}
function moduleLabelsForRole(role) {
  const keys = role.modules && role.modules.length ? role.modules : modulesForRoleName(role.name);
  return keys.map((k) => APP_MODULE_BY_KEY[k]).filter(Boolean).map((m) => m.name);
}
function moduleKeysForRoleName(roleName) {
  const role = _ROLE_CATALOG.find((r) => r.name === roleName);
  return role ? (role.modules || []) : modulesForRoleName(roleName);
}
function moduleKeysForUser(user) {
  return [...new Set((user.roles || [user.role]).flatMap(moduleKeysForRoleName))];
}
function isModuleAdministratorRole(roleName) {
  return /^Administrator /.test(roleName || "");
}
function adminModuleScopeForRoles(roles) {
  const rs = Array.isArray(roles) ? roles : [roles];
  if (rs.includes("Super Admin")) return null;
  const adminRoles = rs.filter(isModuleAdministratorRole);
  if (adminRoles.length === 0) return null;
  return [...new Set(adminRoles.flatMap(moduleKeysForRoleName))];
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
    { key: "email.reminders.view", name: "View reminder sent", desc: "Access Contract Monitoring reminder delivery logs", createdAt: "2024-01-15" },
  ]},
  { module: "Audit", icon: "scroll-text", perms: [
    { key: "audit.view", name: "View audit log", desc: "Read the system audit trail", createdAt: "2024-01-18" },
    { key: "audit.export", name: "Export audit log", desc: "Export audit records to CSV", createdAt: "2024-01-18" },
  ]},
  { module: "Settings", icon: "sliders-horizontal", perms: [
    { key: "settings.view", name: "View settings", desc: "Access system settings and the background-process catalog", createdAt: "2024-01-20" },
    { key: "settings.update", name: "Update settings", desc: "Modify system and security settings, and run scheduled background processes", createdAt: "2024-01-20" },
  ]},
  // Module-scoped permissions (keys mirror backend PermissionKeys.cs — {moduleKey}.{action}).
  { module: "Vendor Onboarding", icon: "building-2", perms: [
    { key: "vendorOnboarding.view", name: "View vendors", desc: "Read/enter the Vendor Onboarding module — registry, profiles, and history", createdAt: "2024-01-22" },
    { key: "vendorOnboarding.manage", name: "Manage vendors", desc: "Blacklist/unblacklist, issue e-certificates, and administer vendor records", createdAt: "2024-01-22" },
    { key: "vendorOnboarding.approve", name: "Approve vendors", desc: "Act on the current role-assigned step in a versioned approval workflow", createdAt: "2026-07-31" },
    { key: "vendorOnboarding.invite", name: "Invite vendors", desc: "Create and send vendor registration invitations", createdAt: "2024-01-22" },
    { key: "vendorOnboarding.approve1", name: "Vendor approval — step 1", desc: "Approve/reject/request revision for submitted registrations (SBMIT)", createdAt: "2024-01-22" },
    { key: "vendorOnboarding.approve2", name: "Vendor approval — step 2", desc: "Approve/reject/request revision at the second step (APPR1)", createdAt: "2024-01-22" },
    { key: "vendorOnboarding.approveFinal", name: "Vendor approval — final", desc: "Final approval/reject/request revision (APPR2/APPR3)", createdAt: "2024-01-22" },
    { key: "vendorOnboarding.contacts", name: "Manage vendor contacts", desc: "List vendor contacts and set which person is the PIC Vendor for Vendor Workspace", createdAt: "2026-08-13" },
  ]},
  { module: "Proposal Tracker", icon: "route", perms: [
    { key: "proposalTracker.view", name: "View Proposal Tracker", desc: "Read dashboards, proposals, and LOA documents", createdAt: "2024-01-22" },
    { key: "proposalTracker.manage", name: "Manage Proposal Tracker", desc: "Distribute, clock-in/out, complete, recycle, and reassign proposals", createdAt: "2024-01-22" },
  ]},
  { module: "Contract Initiation Platform", icon: "sparkles", perms: [
    { key: "contractInitiationPlatform.view", name: "View Contract Initiation Platform", desc: "Read cases, templates, repository, and authorization master", createdAt: "2024-01-22" },
    { key: "contractInitiationPlatform.manage", name: "Manage Contract Initiation Platform", desc: "Create/advance cases, generate documents, and register contracts", createdAt: "2024-01-22" },
  ]},
  { module: "Contract Monitoring", icon: "file-text", perms: [
    { key: "contractMonitoring.view", name: "View Contract Monitoring", desc: "Read contracts, expiry, and reminder history", createdAt: "2024-01-22" },
    { key: "contractMonitoring.manage", name: "Manage Contract Monitoring", desc: "Send reminders, run scans, and import contracts", createdAt: "2024-01-22" },
  ]},
  // Master data is broken down per owning module (C9): a module's Administrator only sees its own
  // sets. The single masterData.view/manage pair was DROPPED from the backend by C9's migration.
  { module: "Master Data", icon: "database", perms: [
    { key: "masterData.vendorOnboarding.view", name: "View Vendor Onboarding master data", desc: "Read Vendor Onboarding master data sets and records", createdAt: "2024-01-22" },
    { key: "masterData.vendorOnboarding.manage", name: "Manage Vendor Onboarding master data", desc: "Create and edit Vendor Onboarding master data records", createdAt: "2024-01-22" },
    { key: "masterData.proposalTracker.view", name: "View Proposal Tracker master data", desc: "Read Proposal Tracker master data sets and records", createdAt: "2024-01-22" },
    { key: "masterData.proposalTracker.manage", name: "Manage Proposal Tracker master data", desc: "Create and edit Proposal Tracker master data records", createdAt: "2024-01-22" },
    { key: "masterData.contractInitiationPlatform.view", name: "View CIP master data", desc: "Read Contract Initiation Platform master data sets and records", createdAt: "2024-01-22" },
    { key: "masterData.contractInitiationPlatform.manage", name: "Manage CIP master data", desc: "Create and edit Contract Initiation Platform master data records", createdAt: "2024-01-22" },
    { key: "masterData.contractMonitoring.view", name: "View Contract Monitoring master data", desc: "Read Contract Monitoring master data sets and records", createdAt: "2024-01-22" },
    { key: "masterData.contractMonitoring.manage", name: "Manage Contract Monitoring master data", desc: "Create and edit Contract Monitoring master data records", createdAt: "2024-01-22" },
  ]},
];

/* Runtime permission catalog — hydrated from the backend (GET /api/v1/administration/role-permissions
   or /api/v1/super-admin/permissions, both of which return the real iam.PERMISSION_T rows grouped by
   owning module). PERMISSION_MODULES above is only the pre-hydration fallback: it is hand-maintained
   and WILL drift from the backend, so anything that assigns permissions must prefer this catalog.
   Same shape as PERMISSION_MODULES ({ module, icon, perms: [{ key, name, desc }] }). */
let _PERMISSION_CATALOG = null;
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
    .filter((g) => g.perms.length > 0);
  _PERMISSION_CATALOG = list.length > 0 ? list : null;
  return getPermissionCatalog();
}
/* The hydrated catalog when available, else the static fallback. Never empty. */
function getPermissionCatalog() { return _PERMISSION_CATALOG || PERMISSION_MODULES; }
function permissionCatalogIsHydrated() { return _PERMISSION_CATALOG !== null; }
function allPermissionKeys() { return getPermissionCatalog().flatMap((m) => m.perms.map((p) => p.key)); }


Object.assign(window, { CURRENT_USER, APP_MODULES, APP_MODULE_KEYS, APP_MODULE_BY_KEY, APP_EDITION, editionForModuleKey, modulesForRoleName, moduleKeysForRoleName, moduleKeysForUser, isModuleAdministratorRole, adminModuleScopeForRoles, moduleLabelsForRole, setRoleCatalog, getRoleCatalog, PERMISSION_MODULES, setPermissionCatalog, getPermissionCatalog, permissionCatalogIsHydrated, allPermissionKeys });

// ---- Languages ----
const LANGUAGES = [] /* seed moved to backend (core.LANGUAGE_T/LANGUAGE_TEXT_T/EMAIL_TEMPLATE_T) */;

// ---- Language Text (EN base → ID target) ----
const LANGUAGE_TEXT = [] /* seed moved to backend (core.LANGUAGE_T/LANGUAGE_TEXT_T/EMAIL_TEMPLATE_T) */;

Object.assign(window, { LANGUAGES, LANGUAGE_TEXT });

// ---- Email Templates ----
const EMAIL_CATEGORIES = [
  { key: "Users", tone: "neutral", icon: "users" },
  { key: "Vendor Onboarding", tone: "success", icon: "building-2" },
  { key: "Vendor Workspace", tone: "brand", icon: "handshake" },
  { key: "Proposal Tracker", tone: "brand", icon: "route" },
  { key: "Contract Initiation Platform", tone: "orange", icon: "sparkles" },
  { key: "Contract Monitoring", tone: "info", icon: "file-text" },
];

const EMAIL_TEMPLATES = [] /* seed moved to backend (core.LANGUAGE_T/LANGUAGE_TEXT_T/EMAIL_TEMPLATE_T) */;

// Per-module email sender identity (Settings ▸ Email). Each module has its own From + mailbox name
// + To (test), stored as from_<key> / mailbox_<key> / toTest_<key> and resolved server-side
// (EmailTestRedirect.ModuleSlugForCategory). `key` = module slug; `label` = Settings + email category
// (categoryAliases keep legacy "Tracker" for older email-template rows).
const EMAIL_SENDER_MODULES = [
  { key: "users", label: "Users" },
  { key: "vendorOnboarding", label: "Vendor Onboarding" },
  { key: "vendorWorkspace", label: "Vendor Workspace" },
  { key: "proposalTracker", label: "Proposal Tracker", categoryAliases: ["Tracker"] },
  { key: "contractInitiationPlatform", label: "Contract Initiation Platform" },
  { key: "contractMonitoring", label: "Contract Monitoring" },
];

function emailSenderModuleKeyForCategory(category) {
  const c = String(category || "").trim();
  if (!c) return null;
  const hit = EMAIL_SENDER_MODULES.find((m) => m.label === c || (m.categoryAliases || []).includes(c));
  return hit ? hit.key : null;
}

// Email delivery log + reminders are backend-driven (ScreensEmail reads /api/v1/super-admin/email-sent).
Object.assign(window, { EMAIL_CATEGORIES, EMAIL_TEMPLATES, EMAIL_SENDER_MODULES, emailSenderModuleKeyForCategory });
export { CURRENT_USER, APP_MODULES, APP_MODULE_KEYS, APP_MODULE_BY_KEY, APP_EDITION, editionForModuleKey, modulesForRoleName, moduleKeysForRoleName, moduleKeysForUser, isModuleAdministratorRole, adminModuleScopeForRoles, moduleLabelsForRole, setRoleCatalog, getRoleCatalog, PERMISSION_MODULES, setPermissionCatalog, getPermissionCatalog, permissionCatalogIsHydrated, allPermissionKeys, LANGUAGES, LANGUAGE_TEXT, EMAIL_CATEGORIES, EMAIL_TEMPLATES, EMAIL_SENDER_MODULES, emailSenderModuleKeyForCategory };
