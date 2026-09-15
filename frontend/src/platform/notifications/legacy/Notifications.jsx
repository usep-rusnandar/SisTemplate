/* fm2-converted */
import React from "react";
import { useSession } from "../../session/legacy/Session.jsx";
/* Alamtri Geo Admin — Notifications context.
   Single source of truth for notifications, shared by the top-bar bell (badge +
   popup), the dashboard card, and the full Notifications page. Any read/delete
   action updates everywhere live.

   Backed by the backend Notifications API (/api/v1/notifications). Notifications are
   produced by real system events only — there is no dummy seed and no browser storage. */

const NOTIF_API = "/api/v1/notifications";

const NotifCtx = React.createContext(null);

/* who is a notification for? a user sees it if it's a broadcast announcement,
   targeted to their role, or addressed to them directly. The backend already
   filters to the current actor, so this stays only for label/compat helpers. */
function notifVisibleTo(n, user) {
  const a = n.audience;
  if (!a || a.scope === "all") return true;
  if (a.scope === "role") { const ur = (user && (user.roles || [user.role])) || []; return (a.roles || []).some((r) => ur.includes(r)); }
  if (a.scope === "user") return a.user === (user && user.username);
  return false;
}
function notifAudience(n) {
  const a = n.audience;
  if (!a || a.scope === "all") return { label: "Announcement", icon: "megaphone", kind: "all" };
  if (a.scope === "role") return { label: (a.roles || []).join(" · "), icon: "users-round", kind: "role" };
  return { label: "Direct", icon: "at-sign", kind: "user" };
}

async function notifFetch(path, init) {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { ...(init && init.headers) },
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error((payload && (payload.title || payload.code)) || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

/* fire-and-forget command: optimistic local state already applied by caller. */
function notifCommand(path, init) {
  try {
    notifFetch(path, init).catch((e) => console.warn("Notifications API command failed.", e));
  } catch (e) { /* ignore */ }
}

function NotifProvider({ children }) {
  const session = useSession();
  const user = session.actingUser;
  const userKey = (user && (user.personnelNo || user.username)) || "";
  const [items, setItems] = React.useState([]);

  const load = React.useCallback(() => {
    if (!userKey) { setItems([]); return; }
    notifFetch(NOTIF_API)
      .then((data) => { setItems((data && Array.isArray(data.items)) ? data.items : []); })
      .catch((e) => { console.warn("Notifications API load failed.", e); setItems([]); });
  }, [userKey]);

  React.useEffect(() => { load(); }, [load]);

  const api = React.useMemo(() => {
    const unread = items.filter((n) => !n.read).length;
    return {
      items, allItems: items, unread,
      markRead: (id) => {
        setItems((rs) => rs.map((n) => (n.id === id ? { ...n, read: true } : n)));
        notifCommand(`${NOTIF_API}/${encodeURIComponent(id)}/read`, { method: "POST" });
      },
      markUnread: (id) => {
        setItems((rs) => rs.map((n) => (n.id === id ? { ...n, read: false } : n)));
        notifCommand(`${NOTIF_API}/${encodeURIComponent(id)}/unread`, { method: "POST" });
      },
      toggleRead: (id) => {
        let nextRead = true;
        setItems((rs) => rs.map((n) => {
          if (n.id !== id) return n;
          nextRead = !n.read;
          return { ...n, read: nextRead };
        }));
        notifCommand(`${NOTIF_API}/${encodeURIComponent(id)}/${nextRead ? "read" : "unread"}`, { method: "POST" });
      },
      markAllRead: () => {
        setItems((rs) => rs.map((n) => ({ ...n, read: true })));
        notifCommand(`${NOTIF_API}/read-all`, { method: "POST" });
      },
      remove: (id) => {
        setItems((rs) => rs.filter((n) => n.id !== id));
        notifCommand(`${NOTIF_API}/${encodeURIComponent(id)}`, { method: "DELETE" });
      },
      reset: load,
    };
  }, [items, load]);

  return <NotifCtx.Provider value={api}>{children}</NotifCtx.Provider>;
}
function useNotifications() { return React.useContext(NotifCtx); }

Object.assign(window, { NotifProvider, useNotifications, notifVisibleTo, notifAudience });
export { NotifProvider, useNotifications, notifVisibleTo, notifAudience };
