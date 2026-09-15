/* fm2-converted */
import React from "react";
import { APP_EDITION } from "../../data/legacy/Data.jsx";
/* Alamtri Geo Admin — menu structure as shared, editable state.
   This is the SINGLE SOURCE OF TRUTH for the sidebar: editing it on the Menus
   page updates the live left navigation. Persisted through backend state API. */

// Menu access is permission-driven (menu nodes gate on requiredPermissions); these role-name
// arrays are legacy metadata for the menu editor's role picker only. Kept as a static list
// since the backend role catalog hydrates asynchronously after this module loads.
const MENU_ROLES = ["Super Admin", "Administrator Vendor Onboarding", "Administrator Proposal Tracker", "Administrator Contract Monitoring", "Division Head", "Department Head Vendor Onboarding", "Department Head Proposal Tracker", "Department Head Contract Monitoring", "Section Head Vendor Onboarding", "Section Head Proposal Tracker", "Section Head Contract Monitoring", "Officer Vendor Onboarding", "Officer Proposal Tracker", "Officer Contract Monitoring", "User Contract Monitoring", "Vendor"];

const ALL_ROLES = [...MENU_ROLES];

const TRACKER_ROLES = ["Super Admin", "Administrator Proposal Tracker", "Section Head Proposal Tracker", "Officer Proposal Tracker", "Division Head", "Department Head Proposal Tracker"];

const CONTRACT_MON_ROLES = ["Super Admin", "Administrator Contract Monitoring", "Section Head Contract Monitoring", "Officer Contract Monitoring", "User Contract Monitoring", "Division Head", "Department Head Contract Monitoring"];

const VENDOR_ROLES = ["Super Admin", "Administrator Vendor Onboarding", "Section Head Vendor Onboarding", "Officer Vendor Onboarding", "Division Head", "Department Head Vendor Onboarding"];

const VENDOR_WORKSPACE_ROLES = ["Super Admin", "Vendor"];

// every module-administrator role (there is no generic "Administrator" role in the data)
const ADMIN_ROLES = ["Administrator Vendor Onboarding", "Administrator Proposal Tracker", "Administrator Contract Monitoring"];

const DEFAULT_MENU = [
  { id: "m-dashboards", type: "group", key: "dashboards", labelKey: "nav.dashboard", label: "", icon: "layout-grid", enabled: true, roles: [...ALL_ROLES], children: [
    { id: "m-trackerDashboard", type: "item", key: "trackerDashboard", labelKey: "nav.trackerDashboard", label: "", icon: "gauge", route: "trackerDashboard", enabled: true, roles: [...TRACKER_ROLES] },
    { id: "m-cipDashboard",     type: "item", key: "cipDashboard",     labelKey: "nav.cipDashboard",     label: "", icon: "file-signature", route: "cipDashboard",     enabled: true, roles: [...TRACKER_ROLES] },
    { id: "m-cmDashboard",      type: "item", key: "cmDashboard",      labelKey: "nav.contractDashboard", label: "", icon: "gauge", route: "cmDashboard",     enabled: true, roles: [...CONTRACT_MON_ROLES] },
    { id: "m-vwDashboard",      type: "item", key: "vwDashboard",      labelKey: "nav.vwDashboard",      label: "", icon: "building-2", route: "vwDashboard",   enabled: true, edition: "external", roles: [...VENDOR_WORKSPACE_ROLES] },
  ]},
  { id: "m-vendorgroup", type: "group", key: "vendorGroup", labelKey: "nav.vendor", label: "", icon: "building-2", enabled: true, roles: [...ALL_ROLES], children: [
    { id: "m-vendor",           type: "item", key: "vendor",           labelKey: "nav.vendorDatabase",   label: "", icon: "database", route: "vendor",           enabled: true, roles: [...VENDOR_ROLES] },
    { id: "m-vendorContacts",   type: "item", key: "vendorContacts",   labelKey: "nav.vendorContacts",   label: "", icon: "users-round", route: "vendorContacts", enabled: true, roles: ["Super Admin", "Officer Vendor Onboarding"] },
    { id: "m-vendorApproval",   type: "item", key: "vendorApproval",   labelKey: "",                     label: "Vendor Approval", icon: "badge-check", route: "vendorApproval", enabled: true, roles: [...VENDOR_ROLES] },
    { id: "m-vendorInvitation", type: "item", key: "vendorInvitation", labelKey: "nav.vendorInvitation", label: "", icon: "send",     route: "vendorInvitation", enabled: true, roles: ["Super Admin", "Officer Vendor Onboarding"] },
    { id: "m-vendorImport",     type: "item", key: "vendorImport",     labelKey: "nav.vendorImport",     label: "", icon: "file-spreadsheet", route: "vendorImport", enabled: true, roles: ["Super Admin", "Officer Vendor Onboarding"] },
  ]},
  { id: "m-tracker", type: "group", key: "proposalTracker", labelKey: "nav.tracker", label: "", icon: "route", enabled: true, roles: [...TRACKER_ROLES], children: [
    { id: "m-trackerProposals", type: "item", key: "trackerProposals", labelKey: "nav.trackerProposals", label: "", icon: "clipboard-list",  route: "trackerProposals", enabled: true, roles: [...TRACKER_ROLES] },
    { id: "m-trackerOverdue",   type: "item", key: "trackerOverdue",   labelKey: "nav.trackerOverdue",   label: "", icon: "alarm-clock",     route: "trackerOverdue",   enabled: true, roles: [...TRACKER_ROLES] },
    { id: "m-cipTemplates",  type: "item", key: "cipTemplates",  labelKey: "nav.cipTemplates",  label: "", icon: "layout-template",  route: "cipTemplates",  enabled: true, roles: [...TRACKER_ROLES] },
    { id: "m-cipRepository", type: "item", key: "cipRepository", labelKey: "nav.cipRepository", label: "", icon: "archive",          route: "cipRepository", enabled: true, roles: [...TRACKER_ROLES] },
  ]},
  { id: "m-contractmon", type: "group", key: "contractMonitoring", labelKey: "nav.contractMon", label: "", icon: "file-text", enabled: true, roles: [...CONTRACT_MON_ROLES], children: [
    { id: "m-cmDatabase",  type: "item", key: "cmDatabase",  labelKey: "nav.cmDatabase",  label: "", icon: "database",      route: "cmDatabase",  enabled: true, roles: [...CONTRACT_MON_ROLES] },
    { id: "m-cmExpiry",    type: "item", key: "cmExpiry",    labelKey: "nav.cmExpiry",    label: "", icon: "bell-ring",     route: "cmExpiry",    enabled: true, roles: [...CONTRACT_MON_ROLES] },
    { id: "m-reminderSent", type: "item", key: "reminderSent", labelKey: "nav.reminderSent", label: "", icon: "send",       route: "reminderSent", enabled: true, roles: ["Super Admin", "Section Head Contract Monitoring", "Officer Contract Monitoring"] },
    { id: "m-cmImport",    type: "item", key: "cmImport",    labelKey: "nav.cmImport",    label: "", icon: "cloud-upload",  route: "cmImport",    enabled: true, roles: ["Super Admin", "Officer Contract Monitoring"] },
    { id: "m-cmMaterialSync", type: "item", key: "cmMaterialSync", labelKey: "nav.cmMaterialSync", label: "", icon: "package", route: "cmMaterialSync", enabled: true, roles: ["Super Admin", "Officer Contract Monitoring"] },
  ]},
  { id: "m-superadmin", type: "group", key: "superAdmin", labelKey: "nav.superadmin", label: "", icon: "crown", enabled: true, roles: ["Super Admin"], children: [
    { id: "m-modules",        type: "item", key: "modules",        labelKey: "nav.modules",        label: "", icon: "blocks",               route: "modules",        enabled: true, roles: ["Super Admin"] },
    { id: "m-permissions",    type: "item", key: "permissions",    labelKey: "nav.permissions",    label: "", icon: "key-round",            route: "permissions",    enabled: true, roles: ["Super Admin"] },
    { id: "m-menus",          type: "item", key: "menus",          labelKey: "nav.menus",          label: "", icon: "list",                 route: "menus",          enabled: true, roles: ["Super Admin"] },
    { id: "m-languages",      type: "item", key: "languages",      labelKey: "nav.languages",      label: "", icon: "languages",            route: "languages",      enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-languageText",   type: "item", key: "languageText",   labelKey: "nav.languageText",   label: "", icon: "globe",                route: "languageText",   enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-emailTemplates", type: "item", key: "emailTemplates", labelKey: "nav.emailTemplates", label: "", icon: "mail",                 route: "emailTemplates", enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-emailSent",      type: "item", key: "emailSent",      labelKey: "nav.emailSent",      label: "", icon: "send",                 route: "emailSent",      enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-audit",          type: "item", key: "audit",          labelKey: "nav.audit",          label: "", icon: "scroll-text",          route: "audit",          enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-settings",       type: "item", key: "settings",       labelKey: "nav.settings",       label: "", icon: "sliders-horizontal",   route: "settings",       enabled: true, roles: ["Super Admin"] },
    { id: "m-backgroundProcesses", type: "item", key: "backgroundProcesses", labelKey: "nav.backgroundProcesses", label: "", icon: "timer", route: "backgroundProcesses", enabled: true, roles: ["Super Admin"] },
  ]},
  { id: "m-administration", type: "group", key: "administration", labelKey: "nav.administration", label: "", icon: "shield", enabled: true, roles: ["Super Admin", "Administrator", ...ADMIN_ROLES], children: [
    { id: "m-users", type: "item", key: "users", labelKey: "nav.users", label: "", icon: "users-round",  route: "users", enabled: true, roles: ["Super Admin", "Administrator", ...ADMIN_ROLES] },
    { id: "m-roles", type: "item", key: "roles", labelKey: "nav.roles", label: "", icon: "shield-check", route: "roles", enabled: true, roles: ["Super Admin", "Administrator", ...ADMIN_ROLES] },
    { id: "m-cmEmailTemplates", type: "item", key: "cmEmailTemplates", labelKey: "nav.emailTemplates", label: "", icon: "mail", route: "cmEmailTemplates", enabled: true, roles: ["Super Admin", "Administrator Contract Monitoring"] },
  ]},
  { id: "m-masterdata", type: "group", key: "masterData", labelKey: "nav.masterData", label: "", icon: "database", enabled: true, roles: ["Super Admin", ...ADMIN_ROLES], children: [
    { id: "m-holiday",        type: "item", key: "holiday",        labelKey: "nav.holiday",        label: "", icon: "calendar-days", route: "holiday",       enabled: true, roles: ["Super Admin", "Administrator Proposal Tracker"] },
    { id: "m-trackerStep",    type: "item", key: "trackerStep",    labelKey: "nav.trackerStep",    label: "", icon: "list-ordered",  route: "trackerStep",   enabled: true, roles: ["Super Admin", "Administrator Proposal Tracker"] },
    { id: "m-trackerMethod",  type: "item", key: "trackerMethod",  labelKey: "nav.trackerMethod",  label: "", icon: "workflow",      route: "trackerMethod", enabled: true, roles: ["Super Admin", "Administrator Proposal Tracker"] },
    { id: "m-cipAuthorization", type: "item", key: "cipAuthorization", labelKey: "nav.cipAuthorization", label: "", icon: "shield-check", route: "cipAuthorization", enabled: true, roles: ["Super Admin", "Administrator Proposal Tracker"] },
    { id: "m-vendorRelationship", type: "item", key: "vendorRelationship", labelKey: "nav.vendorRelationship", label: "", icon: "handshake",  route: "vendorRelationship", enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-vendorDocReq",       type: "item", key: "vendorDocReq",       labelKey: "nav.vendorDocReq",       label: "", icon: "file-check", route: "vendorDocReq",       enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-brand",              type: "item", key: "brand",              labelKey: "nav.brand",              label: "", icon: "tag",        route: "brand",              enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-kbli",               type: "item", key: "kbli",               labelKey: "nav.kbli",               label: "", icon: "layers",     route: "kbli",               enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-country",            type: "item", key: "country",            labelKey: "nav.country",            label: "", icon: "globe",      route: "country",            enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-adminRegions",       type: "item", key: "adminRegions",       labelKey: "nav.adminRegions",       label: "", icon: "map-pinned", route: "adminRegions",       enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-specialRequirement", type: "item", key: "specialRequirement", labelKey: "nav.specialRequirement", label: "", icon: "list-checks", route: "specialRequirement", enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-commodity",          type: "item", key: "commodity",          labelKey: "nav.commodity",          label: "", icon: "boxes",        route: "commodity",          enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-vendorStatus",       type: "item", key: "vendorStatus",       labelKey: "nav.vendorStatus",       label: "", icon: "waypoints",   route: "vendorStatus",       enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-kbliType",           type: "item", key: "kbliType",           labelKey: "nav.kbliType",           label: "", icon: "layers",      route: "kbliType",           enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
    { id: "m-kbliStatus",         type: "item", key: "kbliStatus",         labelKey: "nav.kbliStatus",         label: "", icon: "badge-check", route: "kbliStatus",         enabled: true, roles: ["Super Admin", "Administrator Vendor Onboarding"] },
  ]},
];

/* Permission-driven visibility (single source of truth = backend permissions).
   node.key -> permission keys that grant it; a node is visible if the user holds ANY of them.
   A node with NO entry (empty list) is visible to any authenticated user (e.g. group shells,
   the external Vendor Workspace which uses the edition gate instead). Matches PermissionKeys.cs. */
const MENU_PERMISSIONS = {
  // Dashboards
  trackerDashboard: ["proposalTracker.view"],
  cipDashboard: ["proposalTracker.view", "contractInitiationPlatform.view"],
  cmDashboard: ["contractMonitoring.view"],
  // vwDashboard: external edition only — left open (edition gate handles it)
  // Vendor Onboarding
  vendor: ["vendorOnboarding.view", "vendorOnboarding.manage", "vendorOnboarding.approve", "vendorOnboarding.approve1", "vendorOnboarding.approve2", "vendorOnboarding.approveFinal"],
  vendorContacts: ["vendorOnboarding.contacts"],
  vendorApproval: ["vendorOnboarding.approve", "vendorOnboarding.manage"],
  vendorInvitation: ["vendorOnboarding.invite"],
  vendorImport: ["vendorOnboarding.import"],
  // Proposal Tracker
  trackerProposals: ["proposalTracker.view"],
  trackerOverdue: ["proposalTracker.view"],
  cipWorkflow: ["proposalTracker.view", "contractInitiationPlatform.view"],
  cipTemplates: ["proposalTracker.view", "contractInitiationPlatform.view"],
  cipRepository: ["proposalTracker.view", "contractInitiationPlatform.view"],
  // Contract Monitoring
  cmDatabase: ["contractMonitoring.view"],
  // Expiry Monitor + Reminders Sent need the reminders-view permission (every CM role except the
  // basic User Contract Monitoring), so USER-CM sees only Contract Dashboard + Contract Database.
  cmExpiry: ["contractMonitoring.reminders.view"],
  reminderSent: ["contractMonitoring.reminders.view"],
  cmImport: ["contractMonitoring.manage"],
  cmMaterialSync: ["contractMonitoring.manage"],
  // Super Admin — the group shell itself requires settings.view so granting a single
  // child permission (e.g. email.templates.view) cannot leak the Super Admin catalog.
  superAdmin: ["settings.view"],
  modules: ["settings.view"],
  permissions: ["permissions.view"],
  menus: ["settings.view"],
  languages: ["languages.view"],
  languageText: ["languages.view"],
  emailTemplates: ["email.templates.view"],
  emailSent: ["email.logs.view"],
  audit: ["audit.view"],
  settings: ["settings.view"],
  backgroundProcesses: ["settings.view"],
  // Administration
  users: ["users.view"],
  roles: ["roles.view"],
  // Contract Monitoring templates: Super Admin (email.templates.*) or ADM-CM (master-data manage).
  // Do not grant global email.templates.* to ADM-CM — that would open the Super Admin catalog API.
  cmEmailTemplates: ["email.templates.view", "masterData.contractMonitoring.manage"],
  // Master Data — each screen has its OWN key (masterData.<screenId>.view) so it can be granted to any
  // administrator role, plus the broad module key as the convenient default. ANY of the two is enough;
  // mirror of MasterDataScreens.cs on the backend — keep the pairs in sync.
  holiday: ["masterData.holiday.view", "masterData.proposalTracker.view"],
  trackerStep: ["masterData.trackerStep.view", "masterData.proposalTracker.view"],
  trackerMethod: ["masterData.trackerMethod.view", "masterData.proposalTracker.view"],
  cipAuthorization: ["masterData.cipAuthorization.view", "masterData.proposalTracker.view", "masterData.contractInitiationPlatform.view"],
  vendorRelationship: ["masterData.distributorType.view", "masterData.vendorOnboarding.view"],
  vendorDocReq: ["masterData.vendorDocumentRequirement.view", "masterData.vendorOnboarding.view"],
  brand: ["masterData.brand.view", "masterData.vendorOnboarding.view"],
  kbli: ["masterData.kbli.view", "masterData.vendorOnboarding.view"],
  country: ["masterData.country.view", "masterData.vendorOnboarding.view"],
  adminRegions: ["masterData.administrativeRegions.view", "masterData.vendorOnboarding.view"],
  specialRequirement: ["masterData.specialRequirement.view", "masterData.vendorOnboarding.view"],
  commodity: ["masterData.commodity.view", "masterData.vendorOnboarding.view"],
  vendorStatus: ["masterData.vendorStatus.view", "masterData.vendorOnboarding.view"],
  kbliType: ["masterData.kbliType.view", "masterData.vendorOnboarding.view"],
  kbliStatus: ["masterData.kbliStatus.view", "masterData.vendorOnboarding.view"],
};

// Permission gating is CODE-OWNED: MENU_PERMISSIONS (above) is the single source of truth. A node's
// requiredPermissions is ALWAYS re-derived from the map by its key on every load — a persisted menu-tree
// carries only STRUCTURE (order, enabled, labels, custom nodes), so permission changes take effect on the
// next load without having to clear the saved tree. (Before this, a saved tree baked stale requiredPermissions
// and silently overrode code changes — see the C9/C7 menu-staleness bugs.) Nodes with no mapping (bespoke
// custom nodes an admin added) keep their own requiredPermissions. `roles` stays as legacy display metadata.
function _applyCodePermissions(nodes) {
  return (nodes || []).map((n) => {
    const next = { ...n };
    if (Object.prototype.hasOwnProperty.call(MENU_PERMISSIONS, n.key)) {
      next.requiredPermissions = MENU_PERMISSIONS[n.key] || [];
    } else if (!Array.isArray(next.requiredPermissions)) {
      next.requiredPermissions = [];
    }
    if (n.children) next.children = _applyCodePermissions(n.children);
    return next;
  });
}
// Bake code permissions into the default tree in place (it is a module-level constant reused as the
// fallback + reset source), always overriding so the default reflects the current MENU_PERMISSIONS.
(function _bakeDefault(nodes) {
  for (const n of nodes) {
    if (Object.prototype.hasOwnProperty.call(MENU_PERMISSIONS, n.key)) n.requiredPermissions = MENU_PERMISSIONS[n.key] || [];
    else if (!Array.isArray(n.requiredPermissions)) n.requiredPermissions = [];
    if (n.children) _bakeDefault(n.children);
  }
})(DEFAULT_MENU);

const MENU_STORE_KEY = "ag_menu_v32";

// Persisted menu trees pre-date newly shipped code routes. Add only missing code-owned nodes and
// preserve every existing label/order/enabled customization. Administrators can hide one by
// disabling it; an absent required route is restored so a stale saved tree cannot mask the feature.
// Generic on purpose: every node shipped in DEFAULT_MENU is reconciled, so a new screen appears
// without a bespoke patch here (this replaced a hand-written case for m-vendorApproval alone).
// Keys of screens the code once shipped and has since retired. A saved tree keeps them for ever
// otherwise, rendering a dead route under its raw key. Custom nodes an administrator added are NOT
// in this list and survive untouched — retiring a screen means adding its key here, deliberately.
const RETIRED_MENU_KEYS = ["vendorWorkflow", "cipInbox", "contractInitiationPlatform", "cipWorkflow", "vendorConnectImport"];
// Nodes that still exist but moved parent. Strip them from a saved tree so merge
// re-inserts them under the current DEFAULT_MENU parent (not a duplicate in the old group).
const RELOCATED_MENU_KEYS = ["vendorContacts", "cipDashboard", "cipTemplates", "cipRepository", "cipAuthorization"];

function _ensureCodeMenuNodes(nodes) {
  return _mergeMissingMenuNodes(
    _pruneMenuKeys(_pruneRetiredMenuNodes(nodes), RELOCATED_MENU_KEYS),
    DEFAULT_MENU);
}

function _pruneRetiredMenuNodes(nodes) {
  return _pruneMenuKeys(nodes, RETIRED_MENU_KEYS);
}

function _pruneMenuKeys(nodes, keys) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter((node) => !keys.includes(node.key))
    .map((node) => (node.children ? { ...node, children: _pruneMenuKeys(node.children, keys) } : node));
}

function _mergeMissingMenuNodes(current, defaults) {
  const result = Array.isArray(current) ? current.map((node) => ({ ...node })) : [];
  defaults.forEach((def, defIndex) => {
    const index = result.findIndex((node) => node.key === def.key);
    if (index >= 0) {
      if (def.children) {
        result[index] = { ...result[index], children: _mergeMissingMenuNodes(result[index].children || [], def.children) };
      }
      return;
    }
    // Restore it next to the default sibling that precedes it, so a re-added node lands where the
    // code puts it rather than at the bottom of the group.
    let insertAt = defIndex === 0 ? 0 : result.length;
    for (let i = defIndex - 1; i >= 0; i -= 1) {
      const previous = result.findIndex((node) => node.key === defaults[i].key);
      if (previous >= 0) { insertAt = previous + 1; break; }
      if (i === 0) insertAt = 0;
    }
    result.splice(insertAt, 0, _cloneMenuNode(def));
  });
  return result;
}

function _cloneMenuNode(node) {
  return { ...node, children: node.children ? node.children.map(_cloneMenuNode) : node.children };
}

/* ---------- immutable tree helpers ---------- */
function _patchTree(nodes, id, patch) {
  return nodes.map((n) => {
    if (n.id === id) n = { ...n, ...patch };
    if (n.children) n = { ...n, children: _patchTree(n.children, id, patch) };
    return n;
  });
}
function _removeTree(nodes, id) {
  return nodes.filter((n) => n.id !== id).map((n) => (n.children ? { ...n, children: _removeTree(n.children, id) } : n));
}
function _addTree(nodes, parentId, node) {
  if (parentId == null) return [...nodes, node];
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), node] };
    if (n.children) return { ...n, children: _addTree(n.children, parentId, node) };
    return n;
  });
}
function _moveTree(nodes, id, dir) {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx !== -1) {
    const ni = idx + dir;
    if (ni < 0 || ni >= nodes.length) return nodes;
    const copy = [...nodes];
    const [it] = copy.splice(idx, 1);
    copy.splice(ni, 0, it);
    return copy;
  }
  return nodes.map((n) => (n.children ? { ...n, children: _moveTree(n.children, id, dir) } : n));
}
function findMenuNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) { const f = findMenuNode(n.children, id); if (f) return f; }
  }
  return null;
}
function menuParentOf(nodes, id, parent = null) {
  for (const n of nodes) {
    if (n.id === id) return parent;
    if (n.children) { const f = menuParentOf(n.children, id, n); if (f) return f; }
  }
  return null;
}

/* resolve display label: custom override wins, then i18n key, then raw key */
function menuLabel(node, t) {
  if (node.label && node.label.trim()) return node.label;
  if (node.labelKey && t) { const v = t(node.labelKey); if (v && v !== node.labelKey) return v; }
  return node.key;
}

/* ---------- permission-driven visibility (single source of truth = backend permissions) ---------- */
/* A node is visible if the user holds ANY of its requiredPermissions (empty list = visible to any
   authenticated user). Group shells stay if they end up with at least one visible child. The old
   role-name filtering + hardcoded admin/executive-head special-cases are gone: everything is a
   consequence of the permission set the backend returns in /auth/me. */
function _nodeGranted(node, permsSet) {
  const req = node.requiredPermissions || [];
  return req.length === 0 || req.some((p) => permsSet.has(p));
}

function visibleMenuForPermissions(menu, permissions) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions || []);
  const ed = APP_EDITION || "internal";
  const portal = (typeof window !== "undefined" && window.__APP_PORTAL) || "suite";
  const editionOk = (n) => !n.edition || n.edition === ed;
  const portalOk = (n) => {
    if (!portal || portal === "suite" || portal === "external") return true;
    if (!n.route && n.type === "group") return true;
    if (!n.route) return true;
    const platform = new Set([
      "dashboard", "notifications", "users", "roles", "modules", "permissions",
      "rolePermissions", "languages", "languageText", "emailTemplates", "emailSent", "settings",
      "menus", "audit", "backgroundProcesses",
    ]);
    if (platform.has(n.route)) return true;
    const local = {
      "vendor-onboarding": new Set(["vendor", "vendorContacts", "vendorApproval", "vendorInvitation", "vendorImport", "brand", "kbli", "country", "adminRegions", "specialRequirement", "commodity", "vendorStatus", "kbliType", "kbliStatus", "vendorRelationship", "vendorDocReq"]),
      "proposal-tracker": new Set(["trackerDashboard", "trackerProposals", "trackerOverdue", "cipDashboard", "cipWorkflow", "cipTemplates", "cipAuthorization", "cipRepository", "holiday", "trackerStep", "trackerMethod"]),
      "contract-monitoring": new Set(["cmDashboard", "cmDatabase", "cmExpiry", "reminderSent", "cmImport", "cmMaterialSync", "cmEmailTemplates"]),
    }[portal];
    return !local || local.has(n.route);
  };
  const ok = (n) => n.enabled && editionOk(n) && portalOk(n) && _nodeGranted(n, perms);
  return (menu || [])
    .filter(ok)
    .map((n) => (n.type === "group" ? { ...n, children: (n.children || []).filter(ok) } : n))
    .filter((n) => n.type !== "group" || n.children.length > 0);
}

/* Same list the left rail shows: permission-filtered, then Super Admin console-only groups. */
const SUPER_ADMIN_NAV_GROUPS = new Set(["superAdmin", "administration", "masterData"]);

function sidebarMenuForPermissions(menu, permissions, roles) {
  let vis = visibleMenuForPermissions(menu, permissions);
  const list = Array.isArray(roles) ? roles : (roles ? [roles] : []);
  if (list.includes("Super Admin")) vis = vis.filter((n) => SUPER_ADMIN_NAV_GROUPS.has(n.key));
  return vis;
}

/* First item in the left sidebar for this permission/role set. */
function landingForPermissions(menu, permissions, roles) {
  const vis = sidebarMenuForPermissions(menu, permissions, roles);
  for (const n of vis) {
    if (n.type === "item") return n.route || n.key;
    if (n.children && n.children.length) return n.children[0].route || n.children[0].key;
  }
  return "dashboard";
}

const MenuCtx = React.createContext(null);

function MenuProvider({ children }) {
  const [menu, setMenu] = React.useState(() => {
    try { const s = window.__procurementStorage.getItem(MENU_STORE_KEY); if (s) return _applyCodePermissions(_ensureCodeMenuNodes(JSON.parse(s))); } catch (e) {}
    return DEFAULT_MENU;
  });
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    let cancelled = false;
    const loadMenu = () => {
      const store = window.__procurementStorage;
      const can = (key) => store && typeof store.canPermission === "function" && store.canPermission(key);
      if (!can("settings.view")) return;
      const canUpdate = can("settings.update");
      fetch("/api/v1/super-admin/menu-tree", { credentials: "include", headers: { Accept: "application/json" } })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (cancelled) return;
          if (payload && payload.hasData && payload.payloadJson) {
            const parsed = JSON.parse(payload.payloadJson);
            setMenu(_applyCodePermissions(_ensureCodeMenuNodes(Array.isArray(parsed) ? parsed : DEFAULT_MENU)));
          } else if (canUpdate) {
            fetch("/api/v1/super-admin/menu-tree", {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payloadJson: JSON.stringify(DEFAULT_MENU) }),
            }).catch((e) => console.warn("Menu backend seed failed.", e));
          }
        })
        .catch((e) => console.warn("Menu backend API unavailable; using local/default menu.", e))
        .finally(() => { if (canUpdate) hydratedRef.current = true; });
    };
    // /super-admin/menu-tree is authenticated (super-admin) scope. Defer until a session exists so the
    // logged-out sign-in page fires no 401s. onAuthenticated runs immediately once already signed in.
    const store = window.__procurementStorage;
    let off = () => {};
    if (store && typeof store.onAuthenticated === "function") {
      off = store.onAuthenticated(() => { if (!cancelled) loadMenu(); });
    } else {
      loadMenu();
    }
    return () => { cancelled = true; off(); };
  }, []);
  React.useEffect(() => {
    try { window.__procurementStorage.setItem(MENU_STORE_KEY, JSON.stringify(menu)); } catch (e) {}
    if (!hydratedRef.current) return;
    const store = window.__procurementStorage;
    if (!(store && typeof store.canPermission === "function" && store.canPermission("settings.update"))) return;
    fetch("/api/v1/super-admin/menu-tree", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payloadJson: JSON.stringify(menu) }),
    }).catch((e) => console.warn("Menu backend save failed; local state remains active.", e));
  }, [menu]);

  const api = React.useMemo(() => ({
    menu,
    setMenu,
    updateNode: (id, patch) => setMenu((m) => _patchTree(m, id, patch)),
    moveNode: (id, dir) => setMenu((m) => _moveTree(m, id, dir)),
    removeNode: (id) => setMenu((m) => _removeTree(m, id)),
    addNode: (parentId, node) => setMenu((m) => _addTree(m, parentId, node)),
    moveToParent: (id, parentId) => setMenu((m) => {
      const node = findMenuNode(m, id);
      if (!node) return m;
      return _addTree(_removeTree(m, id), parentId, node);
    }),
    toggleRequiredPermission: (id, permKey) => setMenu((m) => m.map(function rec(n) {
      if (n.id === id) { const cur = n.requiredPermissions || []; const has = cur.includes(permKey); return { ...n, requiredPermissions: has ? cur.filter((p) => p !== permKey) : [...cur, permKey] }; }
      return n.children ? { ...n, children: n.children.map(rec) } : n;
    })),
    resetMenu: () => setMenu(DEFAULT_MENU),
  }), [menu]);

  return <MenuCtx.Provider value={api}>{children}</MenuCtx.Provider>;
}
function useMenus() { return React.useContext(MenuCtx); }

Object.assign(window, { MENU_ROLES, ALL_ROLES, VENDOR_ROLES, VENDOR_WORKSPACE_ROLES, DEFAULT_MENU, MENU_PERMISSIONS, MenuProvider, useMenus, menuLabel, findMenuNode, menuParentOf, visibleMenuForPermissions, sidebarMenuForPermissions, landingForPermissions });
export { MENU_ROLES, ALL_ROLES, VENDOR_ROLES, VENDOR_WORKSPACE_ROLES, DEFAULT_MENU, MENU_PERMISSIONS, MenuProvider, useMenus, menuLabel, findMenuNode, menuParentOf, visibleMenuForPermissions, sidebarMenuForPermissions, landingForPermissions };
