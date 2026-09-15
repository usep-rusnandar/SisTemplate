/** Internal shell routes. */

export const ROUTE_PATHS = {
  dashboard: "/dashboard",
  notifications: "/notifications",
  users: "/administration/users",
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
}

const PATH_TO_ROUTE = Object.fromEntries(Object.entries(ROUTE_PATHS).map(([key, path]) => [path, key]))

export function pathForRoute(key) {
  return ROUTE_PATHS[key] || "/dashboard"
}

export function routeFromPath(pathname) {
  if (!pathname || pathname === "/") return null
  const clean = pathname.replace(/\/+$/, "") || "/"
  return PATH_TO_ROUTE[clean] || PATH_TO_ROUTE[pathname] || null
}

export const PLATFORM_ROUTE_KEYS = new Set(Object.keys(ROUTE_PATHS))

export function currentPortal() {
  return "suite"
}

export function routeAllowedOnPortal(key) {
  return PLATFORM_ROUTE_KEYS.has(key)
}
