/** Kebab URL paths aligned with backend module prefixes. Route keys stay the legacy screen ids. */

export const ROUTE_PATHS = {
  dashboard: "/dashboard",
  notifications: "/notifications",
  users: "/administration/users",
  vendorContacts: "/vendor-onboarding/contacts",
  roles: "/administration/roles",
  modules: "/administration/modules",
  permissions: "/administration/permissions",
  rolePermissions: "/administration/role-permissions",
  languages: "/administration/languages",
  languageText: "/administration/language-text",
  emailTemplates: "/administration/email-templates",
  emailSent: "/administration/email-sent",
  settings: "/administration/settings",
  backgroundProcesses: "/administration/background-processes",
  menus: "/administration/menus",
  audit: "/administration/audit",
  holiday: "/master-data/holiday",
  trackerStep: "/master-data/tracker-step",
  trackerMethod: "/master-data/tracker-method",
  vendorRelationship: "/master-data/vendor-relationship",
  vendorDocReq: "/master-data/vendor-document-requirement",
  brand: "/master-data/brand",
  kbli: "/master-data/kbli",
  country: "/master-data/country",
  adminRegions: "/master-data/admin-regions",
  specialRequirement: "/master-data/special-requirement",
  commodity: "/master-data/commodity",
  vendorStatus: "/master-data/vendor-status",
  kbliType: "/master-data/kbli-type",
  kbliStatus: "/master-data/kbli-status",
  trackerDashboard: "/proposal-tracker",
  trackerProposals: "/proposal-tracker/proposals",
  trackerOverdue: "/proposal-tracker/overdue",
  vendor: "/vendor-onboarding/vendors",
  vendorApproval: "/vendor-onboarding/approval",
  vendorInvitation: "/vendor-onboarding/invitations",
  vendorImport: "/vendor-onboarding/ariba-import",
  reminderSent: "/contract-monitoring/reminder-sent",
  cmEmailTemplates: "/contract-monitoring/email-templates",
  cmDashboard: "/contract-monitoring",
  cmDatabase: "/contract-monitoring/database",
  cmExpiry: "/contract-monitoring/expiry",
  cmImport: "/contract-monitoring/import",
  cmMaterialSync: "/contract-monitoring/material-sync",
  cipDashboard: "/proposal-tracker/term-sheet",
  cipWorkflow: "/proposal-tracker/workflow",
  cipTemplates: "/proposal-tracker/templates",
  cipAuthorization: "/proposal-tracker/authorization",
  cipRepository: "/proposal-tracker/repository",
  vwDashboard: "/vendor-workspace",
};

const PATH_TO_ROUTE = Object.fromEntries(Object.entries(ROUTE_PATHS).map(([key, path]) => [path, key]));

export function pathForRoute(key) {
  return ROUTE_PATHS[key] || "/dashboard";
}

export function routeFromPath(pathname) {
  if (!pathname || pathname === "/") return null;
  const clean = pathname.replace(/\/+$/, "") || "/";
  // Vendor Contacts moved from Administration into the Vendor group.
  if (clean === "/administration/vendor-contacts") return "vendorContacts";
  // CIP screens live under Proposal Tracker; keep old kebab bookmarks working.
  if (clean === "/contract-initiation-platform") return "cipDashboard";
  if (clean === "/contract-initiation-platform/workflow") return "cipWorkflow";
  if (clean === "/contract-initiation-platform/templates") return "cipTemplates";
  if (clean === "/contract-initiation-platform/authorization") return "cipAuthorization";
  if (clean === "/contract-initiation-platform/repository") return "cipRepository";
  return PATH_TO_ROUTE[clean] || PATH_TO_ROUTE[pathname] || null;
}

export const PLATFORM_ROUTE_KEYS = new Set([
  "dashboard", "notifications", "users", "roles", "modules", "permissions",
  "rolePermissions", "languages", "languageText", "emailTemplates", "emailSent", "settings",
  "menus", "audit", "backgroundProcesses",
]);

export const PORTAL_MODULE_KEYS = {
  "vendor-onboarding": new Set([
    "vendor", "vendorContacts", "vendorApproval", "vendorInvitation", "vendorImport",
    "brand", "kbli", "country", "adminRegions", "specialRequirement", "commodity",
    "vendorStatus", "kbliType", "kbliStatus", "vendorRelationship", "vendorDocReq",
  ]),
  "proposal-tracker": new Set([
    "trackerDashboard", "trackerProposals", "trackerOverdue",
    "cipDashboard", "cipWorkflow", "cipTemplates", "cipAuthorization", "cipRepository",
    "holiday", "trackerStep", "trackerMethod",
  ]),
  "contract-monitoring": new Set([
    "cmDashboard", "cmDatabase", "cmExpiry", "reminderSent", "cmImport", "cmMaterialSync", "cmEmailTemplates",
  ]),
};

export function currentPortal() {
  return (typeof window !== "undefined" && window.__APP_PORTAL) || "suite";
}

export function routeAllowedOnPortal(key, portal = currentPortal()) {
  if (!portal || portal === "suite" || portal === "external") return true;
  if (PLATFORM_ROUTE_KEYS.has(key)) return true;
  const local = PORTAL_MODULE_KEYS[portal];
  return !local || local.has(key);
}
