/* fm2-converted */
import React from "react";
import { EMAIL_SENDER_MODULES } from "../../data/legacy/Data.jsx";
import { useSession } from "../../session/legacy/Session.jsx";
/* Alamtri Geo Admin — shared settings store.
   Holds the platform configuration (email, security, session timeout, retention)
   in one place so both the Settings page and app-wide behaviors (e.g. the session
   lock screen) read the same values. Persisted through backend state API. */

const SETTINGS_STORE_KEY = "ag_settings_v1";

// Real values are backend-owned (InitialPlatformDataSeeder → core.SETTING_T). This is ONLY a blank
// client fallback shape (keys + types) so the Settings form renders before the backend responds —
// no seed values live in the frontend anymore.
// Per-module From / mailbox / To (test) keys (from_<slug> / mailbox_<slug> / toTest_<slug>).
const _SENDER_MODULE_BLANKS = {};
EMAIL_SENDER_MODULES.forEach((m) => {
  _SENDER_MODULE_BLANKS["from_" + m.key] = "";
  _SENDER_MODULE_BLANKS["mailbox_" + m.key] = "";
  _SENDER_MODULE_BLANKS["toTest_" + m.key] = "";
});

const DEFAULT_SETTINGS = {
  baseUrl: "",
  emailMode: "api",
  smtp: "", port: "", smtpAuth: false, login: "", pwd: "",
  fromVendor: "", mailboxVendor: "",
  fromProc: "", mailboxProc: "",
  ..._SENDER_MODULE_BLANKS,
  cc: "", bcc: "", encryption: "ssl",
  pwdDefault: false, reqDigit: false, reqLower: false, reqNonAlpha: false, reqUpper: false, pwdLen: "",
  lockEnabled: false, maxAttempts: "", lockDuration: "",
  sessionEnabled: false, lockScreen: false, timeout: "", countdown: "",
  emailConfirm: false, emailConfirmInternal: false, auditDelete: false, auditDays: "", notifDelete: false, notifDays: "", emailLogDelete: false, emailLogDays: "",
};

const SettingsCtx = React.createContext(null);

function SettingsProvider({ children }) {
  // This provider wraps the WHOLE app (incl. the login screen), so it must wait for an
  // authenticated session before hydrating: an unauthenticated GET /settings 401s, and with a
  // one-shot ([]) effect it would never re-fetch — leaving the form blank for the whole session
  // even though the backend has data. Keyed on the signed-in user so it (re)hydrates on
  // login/logout/re-login, mirroring the SessionProvider role-catalog pattern.
  const session = useSession();
  // personnelNo is the reliable "signed-in internal user" signal (realUser.id stays 0 for backend
  // sessions); keying on it also re-hydrates if a different user signs in after logout.
  const authKey = (session && session.realUser && (session.realUser.personnelNo || (session.realUser.id ? String(session.realUser.id) : ""))) || "";
  const [s, setS] = React.useState(() => {
    try { const v = window.__procurementStorage.getItem(SETTINGS_STORE_KEY); if (v) return persistableSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(v) }); } catch (e) {}
    return DEFAULT_SETTINGS;
  });
  const hydratedRef = React.useRef(false);
  const suppressNextSaveRef = React.useRef(false);
  const canViewSettings = !!(session && session.can && session.can("settings.view"));
  const canUpdateSettings = !!(session && session.can && session.can("settings.update"));
  React.useEffect(() => {
    if (!authKey || !canViewSettings) return;
    let cancelled = false;
    fetch("/api/v1/super-admin/settings", { credentials: "include", headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (cancelled) return;
        // Seed values are backend-owned (InitialPlatformDataSeeder → core.SETTING_T). The frontend
        // no longer pushes DEFAULT_SETTINGS; it only reads, and DEFAULT_SETTINGS is a local form
        // fallback shape used until the backend responds.
        if (payload && payload.hasData && payload.values) {
          // Hydration is not a user edit — don't let it trigger a PUT back to the server (which
          // would spam the audit log with a "settings updated" entry on every login).
          suppressNextSaveRef.current = true;
          setS(persistableSettings({ ...DEFAULT_SETTINGS, ...payload.values }));
        }
      })
      .catch((e) => console.warn("Settings backend API unavailable; using local/default settings.", e))
      .finally(() => { hydratedRef.current = true; });
    return () => { cancelled = true; };
  }, [authKey, canViewSettings]);
  React.useEffect(() => {
    try { window.__procurementStorage.setItem(SETTINGS_STORE_KEY, JSON.stringify(s)); } catch (e) {}
    if (!hydratedRef.current) return;
    if (suppressNextSaveRef.current) { suppressNextSaveRef.current = false; return; }
    if (!canUpdateSettings) return;
    fetch("/api/v1/super-admin/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: persistableSettings(s) }),
    }).catch((e) => console.warn("Settings backend save failed; local state remains active.", e));
  }, [s, canUpdateSettings]);
  const set = React.useCallback((k, v) => setS((p) => ({ ...p, [k]: v })), []);
  const api = React.useMemo(() => ({ s, set, setS }), [s, set]);
  return <SettingsCtx.Provider value={api}>{children}</SettingsCtx.Provider>;
}
function persistableSettings(values) {
  if (!values || typeof values !== "object") return values;
  const next = { ...values };
  delete next.toTest;
  return next;
}

function useSettings() { return React.useContext(SettingsCtx); }

Object.assign(window, { SettingsProvider, useSettings, DEFAULT_SETTINGS, persistableSettings });
export { SettingsProvider, useSettings, DEFAULT_SETTINGS, persistableSettings };
