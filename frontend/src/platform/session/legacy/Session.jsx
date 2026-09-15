/* fm2-converted */
import React from "react";
import { CURRENT_USER, moduleKeysForRoleName, adminModuleScopeForRoles, setRoleCatalog } from "../../data/legacy/Data.jsx";
/* Alamtri Geo Admin — Session / Impersonation context.
   Single source of truth for "who is acting right now".
   - realUser   : the actually logged-in account (a Super Admin operator)
   - actingUser : the effective identity (the impersonated user, or realUser)
  Impersonation lets a Super Admin "Login as this user" to test/diagnose with
  that user's exact role & access. Internal login identity now comes from the
  backend session instead of browser persistence. */

const SESSION_STORE_KEY = "ag_impersonate_v1";
const AUDIT_STORE_KEY = "ag_audit_runtime_v1";
const SUPER_ADMIN_ROLE = "Super Admin";

const SessionCtx = React.createContext(null);

function _normalize(u) {
  // USERS rows use fullName; CURRENT_USER uses name — normalize to one shape.
  if (!u) return null;
  const roles = (u.roles && u.roles.length) ? u.roles.slice() : (u.role ? [u.role] : []);
  return { id: u.id, name: u.fullName || u.name, username: u.username, email: u.email, role: u.role || roles[0], roles: roles, reportTo: u.reportTo || "", personnelNo: u.personnelNo || "", permissions: Array.isArray(u.permissions) ? u.permissions.slice() : [], avatar: u.avatar || null, hasLocalPassword: !!u.hasLocalPassword };
}

function SessionProvider({ children }) {
  // Live override so a just-uploaded/removed avatar reflects immediately; the authoritative value is
  // the backend Blob URL returned by /auth/me (loginUser.avatar). No browser-stored avatar.
  // undefined = no override (use the login value); a string = just-uploaded URL; null = just-removed.
  const [avatarOverride, setAvatarOverride] = React.useState(undefined);
  // who actually logged in; sourced from backend session auth, not browser persistence
  const [loginUser, setLoginUser] = React.useState(null);
  const realUser = React.useMemo(() => {
    const base = loginUser ? _normalize(loginUser) : _normalize({ id: 0, ...CURRENT_USER });
    return { ...base, avatar: avatarOverride !== undefined ? avatarOverride : base.avatar };
  }, [loginUser, avatarOverride]);
  // The impersonated user is stored as a fully-normalized object (sourced from the backend
  // user list), so the session no longer depends on any frontend mock USERS array.
  const [impUser, setImpUser] = React.useState(null);

  const target = impUser;
  const isImpersonating = !!target;
  const actingUser = isImpersonating ? target : realUser;
  const effectiveRole = actingUser.role;            // primary role (compat)
  const effectiveRoles = actingUser.roles || [actingUser.role]; // all roles (union access)

  // Effective PERMISSIONS drive menu + action visibility (single source of truth). For the real
  // user they come from /auth/me; when a Super Admin impersonates, fetch the acted user's set.
  const [impPermissions, setImpPermissions] = React.useState([]);
  React.useEffect(() => {
    let cancelled = false;
    if (!isImpersonating || !target || !target.personnelNo) { setImpPermissions([]); return; }
    fetch(`/api/v1/internal/auth/effective-permissions/${encodeURIComponent(target.personnelNo)}`, { credentials: "include", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (!cancelled) setImpPermissions(Array.isArray(p && p.permissions) ? p.permissions : []); })
      .catch(() => { if (!cancelled) setImpPermissions([]); });
    return () => { cancelled = true; };
  }, [isImpersonating, target]);
  const effectivePermissions = isImpersonating ? impPermissions : (realUser.permissions || []);

  // Avatar URLs are short-lived Blob SAS links (1h). Re-fetch /auth/me periodically while signed in so
  // the profile photo never breaks during a long session; the fresh URL replaces the current override.
  React.useEffect(() => {
    if (!loginUser) return undefined;
    let cancelled = false;
    const refresh = () => {
      if (!window.__internalAuth || typeof window.__internalAuth.me !== "function") return;
      window.__internalAuth.me()
        .then((me) => {
          if (cancelled) return;
          if (!me || me.isAuthenticated === false) {
            window.dispatchEvent(new CustomEvent("ag:session-expired"));
            return;
          }
          setAvatarOverride(me.avatarUrl ?? null);
        })
        .catch(() => {});
    };
    const id = window.setInterval(refresh, 45 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [loginUser]);

  // ---- role catalog: hydrated once from the backend RBAC catalog (no frontend role mock) ----
  // Also pushed into the Data.jsx runtime catalog so the pure scoping helpers
  // (moduleKeysForRoleName / adminModuleScopeForRoles) resolve real backend role→module maps.
  const [roles, setRoles] = React.useState([]);
  React.useEffect(() => {
    let cancelled = false;
    if (!loginUser) { setRoles([]); setRoleCatalog([]); return; }
    const loginPerms = Array.isArray(loginUser.permissions) ? loginUser.permissions : [];
    if (loginPerms.includes("roles.view")) {
      fetch("/api/v1/administration/roles", { credentials: "include", headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled) return;
          const list = (Array.isArray(data) ? data : []).map((row) => ({
            id: row.roleId || row.id,
            name: row.name || "",
            description: row.description || "",
            users: row.users || 0,
            perms: row.permissions || row.perms || 0,
            system: !!(row.isSystem || row.system),
            isDefault: !!row.isDefault,
            modules: Array.isArray(row.modules) ? row.modules : [],
          }));
          setRoles(list);
          setRoleCatalog(list);
        })
        .catch(() => { if (!cancelled) { setRoles([]); setRoleCatalog([]); } });
    } else {
      setRoles([]);
      setRoleCatalog([]);
    }
    // Eager Tracker/holiday hydration is for principals who can actually read those APIs.
    // A Vendor Onboarding admin must not prefetch tracker-step, assignable-users, or holiday (HTTP 403).
    const can = (key) => effectivePermissions.includes(key);
    if (can("masterData.holiday.view") || can("masterData.proposalTracker.view")) {
      try { window.loadHolidays && window.loadHolidays(); } catch (e) {}
    }
    if (can("proposalTracker.view") || can("contractInitiationPlatform.view")
      || can("masterData.trackerStep.view") || can("masterData.trackerMethod.view")
      || can("masterData.proposalTracker.view")) {
      try { window.loadTrackerProcessModel && window.loadTrackerProcessModel(); } catch (e) {}
    }
    // Impersonation starts with empty effectivePermissions until /effective-permissions returns.
    // Use the real user's tracker access so Super Admin impersonating a Section Head still
    // reloads the officer roster for the acted-as personnel number (not the unscoped admin list).
    const realPerms = Array.isArray(realUser.permissions) ? realUser.permissions : [];
    if (can("proposalTracker.view") || realPerms.includes("proposalTracker.view")) {
      try {
        const personnelNo = (actingUser && (actingUser.personnelNo || actingUser.username)) || "";
        if (isImpersonating && !String(personnelNo).trim()) {
          window.loadTrackerAssignableUsers && window.loadTrackerAssignableUsers(true, "", { failClosed: true });
        } else {
          window.loadTrackerAssignableUsers && window.loadTrackerAssignableUsers(true, personnelNo);
        }
      } catch (e) {}
    }
    return () => { cancelled = true; };
  }, [loginUser, actingUser && actingUser.personnelNo, effectivePermissions]);

  // ---- runtime audit log: actions performed in-app, flagged when impersonating ----
  const [audit, setAudit] = React.useState(() => {
    try { const v = window.__procurementStorage.getItem(AUDIT_STORE_KEY); return v ? JSON.parse(v) : []; } catch (e) { return []; }
  });
  React.useEffect(() => { try { window.__procurementStorage.setItem(AUDIT_STORE_KEY, JSON.stringify(audit.slice(0, 200))); } catch (e) {} }, [audit]);

  const record = React.useCallback((e) => {
    const p = (n) => String(n).padStart(2, "0");
    const d = new Date();
    const time = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    const imp = e.impersonated != null ? e.impersonated : isImpersonating;
    const entry = {
      id: "rt-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      action: e.action, module: e.module, desc: e.desc, tone: e.tone || "brand",
      user: e.user || actingUser.name, ip: e.ip || "", time, daysAgo: 0,
      impersonated: !!imp, impersonatedBy: imp ? (e.impersonatedBy || realUser.name) : null,
    };
    setAudit((a) => [entry, ...a]);
  }, [actingUser, isImpersonating, realUser]);

  const api = React.useMemo(() => ({
    realUser, actingUser, isImpersonating, effectiveRole, effectiveRoles,
    // live backend role catalog (replaces the former ROLES frontend mock)
    roles,
    // effective permission set + helper — the authoritative gate for menu and UI actions
    permissions: effectivePermissions,
    can: (permissionKey) => effectivePermissions.includes(permissionKey),
    // impersonation belongs to the real signed-in Super Admin, so the quick switcher
    // stays available even while acting as another user.
    canImpersonate: (realUser.roles || [realUser.role]).includes(SUPER_ADMIN_ROLE),
    // a Super Admin role is only visible to someone effectively acting as Super Admin
    canSeeSuperAdminRole: effectiveRoles.includes(SUPER_ADMIN_ROLE),
    impersonate: (u) => setImpUser(_normalize(u)),
    stop: () => setImpUser(null),
    // authenticate as the backend-confirmed internal actor; clears any prior impersonation
    login: (u) => { setImpUser(null); setAvatarOverride(undefined); setLoginUser(u ? _normalize(u) : null); },
    logout: () => { setImpUser(null); setAvatarOverride(undefined); setLoginUser(null); },
    setAvatar: (url) => setAvatarOverride(url ?? null),
    auditEntries: audit, record,
  }), [realUser, actingUser, isImpersonating, effectiveRole, effectivePermissions, roles, audit, record]);

  return <SessionCtx.Provider value={api}>{children}</SessionCtx.Provider>;
}
function useSession() { return React.useContext(SessionCtx); }

Object.assign(window, { SessionProvider, useSession, SUPER_ADMIN_ROLE });
export { SessionProvider, useSession, SUPER_ADMIN_ROLE };
