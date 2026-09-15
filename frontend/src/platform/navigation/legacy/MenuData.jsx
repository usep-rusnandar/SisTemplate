/* fm2-converted */
import React from "react"
import { APP_EDITION } from "../../data/legacy/Data.jsx"

const MENU_ROLES = ["Super Admin", "Administrator", "User"]
const ALL_ROLES = [...MENU_ROLES]
const VENDOR_ROLES = []
const VENDOR_WORKSPACE_ROLES = []
const ADMIN_ROLES = ["Administrator"]

const DEFAULT_MENU = [
  { id: "m-dashboards", type: "group", key: "dashboards", labelKey: "nav.dashboard", label: "", icon: "layout-grid", enabled: true, roles: [...ALL_ROLES], children: [
    { id: "m-dashboard", type: "item", key: "dashboard", labelKey: "nav.dashboard", label: "", icon: "layout-grid", route: "dashboard", enabled: true, roles: [...ALL_ROLES] },
    { id: "m-notifications", type: "item", key: "notifications", labelKey: "notifications", label: "", icon: "bell", route: "notifications", enabled: true, roles: [...ALL_ROLES] },
  ]},
  { id: "m-superadmin", type: "group", key: "superAdmin", labelKey: "nav.superadmin", label: "", icon: "crown", enabled: true, roles: ["Super Admin"], children: [
    { id: "m-modules", type: "item", key: "modules", labelKey: "nav.modules", label: "", icon: "blocks", route: "modules", enabled: true, roles: ["Super Admin"] },
    { id: "m-permissions", type: "item", key: "permissions", labelKey: "nav.permissions", label: "", icon: "key-round", route: "permissions", enabled: true, roles: ["Super Admin"] },
    { id: "m-menus", type: "item", key: "menus", labelKey: "nav.menus", label: "", icon: "list", route: "menus", enabled: true, roles: ["Super Admin"] },
    { id: "m-languages", type: "item", key: "languages", labelKey: "nav.languages", label: "", icon: "languages", route: "languages", enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-languageText", type: "item", key: "languageText", labelKey: "nav.languageText", label: "", icon: "globe", route: "languageText", enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-emailTemplates", type: "item", key: "emailTemplates", labelKey: "nav.emailTemplates", label: "", icon: "mail", route: "emailTemplates", enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-emailSent", type: "item", key: "emailSent", labelKey: "nav.emailSent", label: "", icon: "send", route: "emailSent", enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-audit", type: "item", key: "audit", labelKey: "nav.audit", label: "", icon: "scroll-text", route: "audit", enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-settings", type: "item", key: "settings", labelKey: "nav.settings", label: "", icon: "sliders-horizontal", route: "settings", enabled: true, roles: ["Super Admin"] },
    { id: "m-backgroundProcesses", type: "item", key: "backgroundProcesses", labelKey: "nav.backgroundProcesses", label: "", icon: "timer", route: "backgroundProcesses", enabled: true, roles: ["Super Admin"] },
  ]},
  { id: "m-administration", type: "group", key: "administration", labelKey: "nav.administration", label: "", icon: "shield", enabled: true, roles: ["Super Admin", "Administrator"], children: [
    { id: "m-users", type: "item", key: "users", labelKey: "nav.users", label: "", icon: "users-round", route: "users", enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-roles", type: "item", key: "roles", labelKey: "nav.roles", label: "", icon: "shield-check", route: "roles", enabled: true, roles: ["Super Admin", "Administrator"] },
    { id: "m-rolePermissions", type: "item", key: "rolePermissions", labelKey: "", label: "Role Permissions", icon: "key-round", route: "rolePermissions", enabled: true, roles: ["Super Admin", "Administrator"] },
  ]},
]

const MENU_PERMISSIONS = {
  dashboard: ["dashboard.view"],
  notifications: [],
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
  users: ["users.view"],
  roles: ["roles.view"],
  rolePermissions: ["roles.view"],
}

function _applyCodePermissions(nodes) {
  return (nodes || []).map((n) => {
    const next = { ...n }
    if (Object.prototype.hasOwnProperty.call(MENU_PERMISSIONS, n.key)) next.requiredPermissions = MENU_PERMISSIONS[n.key] || []
    else if (!Array.isArray(next.requiredPermissions)) next.requiredPermissions = []
    if (n.children) next.children = _applyCodePermissions(n.children)
    return next
  })
}
(function _bakeDefault(nodes) {
  for (const n of nodes) {
    if (Object.prototype.hasOwnProperty.call(MENU_PERMISSIONS, n.key)) n.requiredPermissions = MENU_PERMISSIONS[n.key] || []
    else if (!Array.isArray(n.requiredPermissions)) n.requiredPermissions = []
    if (n.children) _bakeDefault(n.children)
  }
})(DEFAULT_MENU)

const MENU_STORE_KEY = "ag_menu_v32"
const RETIRED_MENU_KEYS = [
  "vendorWorkflow", "cipInbox", "contractInitiationPlatform", "cipWorkflow", "vendorConnectImport",
  "trackerDashboard", "trackerProposals", "trackerOverdue", "cipDashboard", "cipTemplates", "cipAuthorization", "cipRepository",
  "vendor", "vendorContacts", "vendorApproval", "vendorInvitation", "vendorImport",
  "cmDashboard", "cmDatabase", "cmExpiry", "reminderSent", "cmEmailTemplates", "cmImport", "cmMaterialSync",
  "vwDashboard", "holiday", "trackerStep", "trackerMethod", "vendorRelationship", "vendorDocReq", "brand", "kbli", "country",
  "adminRegions", "specialRequirement", "commodity", "vendorStatus", "kbliType", "kbliStatus",
]
const RELOCATED_MENU_KEYS = []

function _ensureCodeMenuNodes(nodes) {
  return _mergeMissingMenuNodes(_pruneMenuKeys(_pruneRetiredMenuNodes(nodes), RELOCATED_MENU_KEYS), DEFAULT_MENU)
}
function _pruneRetiredMenuNodes(nodes) {
  return _pruneMenuKeys(nodes, RETIRED_MENU_KEYS)
}
function _pruneMenuKeys(nodes, keys) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter((node) => !keys.includes(node.key))
    .map((node) => (node.children ? { ...node, children: _pruneMenuKeys(node.children, keys) } : node))
}
function _mergeMissingMenuNodes(current, defaults) {
  const result = Array.isArray(current) ? current.map((node) => ({ ...node })) : []
  defaults.forEach((def, defIndex) => {
    const index = result.findIndex((node) => node.key === def.key)
    if (index >= 0) {
      if (def.children) result[index] = { ...result[index], children: _mergeMissingMenuNodes(result[index].children || [], def.children) }
      return
    }
    let insertAt = defIndex === 0 ? 0 : result.length
    for (let i = defIndex - 1; i >= 0; i -= 1) {
      const previous = result.findIndex((node) => node.key === defaults[i].key)
      if (previous >= 0) { insertAt = previous + 1; break }
      if (i == 0) insertAt = 0
    }
    result.splice(insertAt, 0, _cloneMenuNode(def))
  })
  return result
}
function _cloneMenuNode(node) {
  return { ...node, children: node.children ? node.children.map(_cloneMenuNode) : node.children }
}
function _patchTree(nodes, id, patch) {
  return nodes.map((n) => {
    if (n.id === id) n = { ...n, ...patch }
    if (n.children) n = { ...n, children: _patchTree(n.children, id, patch) }
    return n
  })
}
function _removeTree(nodes, id) {
  return nodes.filter((n) => n.id !== id).map((n) => (n.children ? { ...n, children: _removeTree(n.children, id) } : n))
}
function _addTree(nodes, parentId, node) {
  if (parentId == null) return [...nodes, node]
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), node] }
    if (n.children) return { ...n, children: _addTree(n.children, parentId, node) }
    return n
  })
}
function _moveTree(nodes, id, dir) {
  const idx = nodes.findIndex((n) => n.id === id)
  if (idx !== -1) {
    const ni = idx + dir
    if (ni < 0 || ni >= nodes.length) return nodes
    const copy = [...nodes]
    const [it] = copy.splice(idx, 1)
    copy.splice(ni, 0, it)
    return copy
  }
  return nodes.map((n) => (n.children ? { ...n, children: _moveTree(n.children, id, dir) } : n))
}
function findMenuNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) { const f = findMenuNode(n.children, id); if (f) return f }
  }
  return null
}
function menuParentOf(nodes, id, parent = null) {
  for (const n of nodes) {
    if (n.id === id) return parent
    if (n.children) { const f = menuParentOf(n.children, id, n); if (f) return f }
  }
  return null
}
function menuLabel(node, t) {
  if (node.label && node.label.trim()) return node.label
  if (node.labelKey && t) { const v = t(node.labelKey); if (v && v !== node.labelKey) return v }
  return node.key
}
function _nodeGranted(node, permsSet) {
  const req = node.requiredPermissions || []
  return req.length === 0 || req.some((p) => permsSet.has(p))
}
function visibleMenuForPermissions(menu, permissions) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions || [])
  const ed = APP_EDITION || "internal"
  const editionOk = (n) => !n.edition || n.edition === ed
  const ok = (n) => n.enabled && editionOk(n) && _nodeGranted(n, perms)
  return (menu || [])
    .filter(ok)
    .map((n) => (n.type === "group" ? { ...n, children: (n.children || []).filter(ok) } : n))
    .filter((n) => n.type !== "group" || n.children.length > 0)
}
const SUPER_ADMIN_NAV_GROUPS = new Set(["dashboards", "superAdmin", "administration"])
function sidebarMenuForPermissions(menu, permissions, roles) {
  let vis = visibleMenuForPermissions(menu, permissions)
  const list = Array.isArray(roles) ? roles : (roles ? [roles] : [])
  if (list.includes("Super Admin")) vis = vis.filter((n) => SUPER_ADMIN_NAV_GROUPS.has(n.key))
  return vis
}
function landingForPermissions(menu, permissions, roles) {
  const vis = sidebarMenuForPermissions(menu, permissions, roles)
  for (const n of vis) {
    if (n.type === "item") return n.route || n.key
    if (n.children && n.children.length) return n.children[0].route || n.children[0].key
  }
  return "dashboard"
}
const MenuCtx = React.createContext(null)
function MenuProvider({ children }) {
  const [menu, setMenu] = React.useState(() => {
    try { const s = window.__procurementStorage.getItem(MENU_STORE_KEY); if (s) return _applyCodePermissions(_ensureCodeMenuNodes(JSON.parse(s))) } catch (e) {}
    return DEFAULT_MENU
  })
  const hydratedRef = React.useRef(false)
  React.useEffect(() => {
    let cancelled = false
    const loadMenu = () => {
      const store = window.__procurementStorage
      const can = (key) => store && typeof store.canPermission === "function" && store.canPermission(key)
      if (!can("settings.view")) return
      const canUpdate = can("settings.update")
      fetch("/api/v1/super-admin/menu-tree", { credentials: "include", headers: { Accept: "application/json" } })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (cancelled) return
          if (payload && payload.hasData && payload.payloadJson) {
            const parsed = JSON.parse(payload.payloadJson)
            setMenu(_applyCodePermissions(_ensureCodeMenuNodes(Array.isArray(parsed) ? parsed : DEFAULT_MENU)))
          } else if (canUpdate) {
            fetch("/api/v1/super-admin/menu-tree", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payloadJson: JSON.stringify(DEFAULT_MENU) }) }).catch((e) => console.warn("Menu backend seed failed.", e))
          }
        })
        .catch((e) => console.warn("Menu backend API unavailable; using local/default menu.", e))
        .finally(() => { if (canUpdate) hydratedRef.current = true })
    }
    const store = window.__procurementStorage
    let off = () => {}
    if (store && typeof store.onAuthenticated === "function") off = store.onAuthenticated(() => { if (!cancelled) loadMenu() })
    else loadMenu()
    return () => { cancelled = true; off() }
  }, [])
  React.useEffect(() => {
    try { window.__procurementStorage.setItem(MENU_STORE_KEY, JSON.stringify(menu)) } catch (e) {}
    if (!hydratedRef.current) return
    const store = window.__procurementStorage
    if (!(store && typeof store.canPermission === "function" && store.canPermission("settings.update"))) return
    fetch("/api/v1/super-admin/menu-tree", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payloadJson: JSON.stringify(menu) }) }).catch((e) => console.warn("Menu backend save failed; local state remains active.", e))
  }, [menu])
  const api = React.useMemo(() => ({
    menu,
    setMenu,
    updateNode: (id, patch) => setMenu((m) => _patchTree(m, id, patch)),
    moveNode: (id, dir) => setMenu((m) => _moveTree(m, id, dir)),
    removeNode: (id) => setMenu((m) => _removeTree(m, id)),
    addNode: (parentId, node) => setMenu((m) => _addTree(m, parentId, node)),
    moveToParent: (id, parentId) => setMenu((m) => { const node = findMenuNode(m, id); if (!node) return m; return _addTree(_removeTree(m, id), parentId, node) }),
    toggleRequiredPermission: (id, permKey) => setMenu((m) => m.map(function rec(n) {
      if (n.id === id) { const cur = n.requiredPermissions || []; const has = cur.includes(permKey); return { ...n, requiredPermissions: has ? cur.filter((p) => p !== permKey) : [...cur, permKey] } }
      return n.children ? { ...n, children: n.children.map(rec) } : n
    })),
    resetMenu: () => setMenu(DEFAULT_MENU),
  }), [menu])
  return <MenuCtx.Provider value={api}>{children}</MenuCtx.Provider>
}
function useMenus() { return React.useContext(MenuCtx) }

Object.assign(window, { MENU_ROLES, ALL_ROLES, VENDOR_ROLES, VENDOR_WORKSPACE_ROLES, DEFAULT_MENU, MENU_PERMISSIONS, MenuProvider, useMenus, menuLabel, findMenuNode, menuParentOf, visibleMenuForPermissions, sidebarMenuForPermissions, landingForPermissions })
export { MENU_ROLES, ALL_ROLES, VENDOR_ROLES, VENDOR_WORKSPACE_ROLES, DEFAULT_MENU, MENU_PERMISSIONS, MenuProvider, useMenus, menuLabel, findMenuNode, menuParentOf, visibleMenuForPermissions, sidebarMenuForPermissions, landingForPermissions }
