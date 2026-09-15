/* fm3-converted */
import React from "react";
import { AboutVersionBadge } from "../../../platform/about/legacy/AboutApplication.jsx";
import { ChangeImageModal, ChangePasswordModal, ProfileModal } from "../../../platform/account/legacy/AccountModals.jsx";
import { adminUserFromApi, adminUsersJson } from "../../../platform/administration/legacy/ScreensUsers.jsx";
import { APP_EDITION, APP_MODULES, APP_MODULE_BY_KEY, moduleKeysForRoleName } from "../../../platform/data/legacy/Data.jsx";
import { landingForPermissions, menuLabel, useMenus, sidebarMenuForPermissions } from "../../../platform/navigation/legacy/MenuData.jsx";
import { useNotifications } from "../../../platform/notifications/legacy/Notifications.jsx";
import { useSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Avatar, Badge, BrandLockup, Button, Field, Flag, Icon, IconButton, Select, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, Menu, MenuDivider, MenuItem, MenuLabel, Modal, Tooltip, fmtAppDateTime, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC, useTheme } from "../../../shared/legacy/Tokens.jsx";
import { LANGS, useI18n } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — app shell: BrandLogo, SideNav, TopBar, PageHeader, Toolbar, Breadcrumb. */

function BrandLogo({ height = 28, collapsed }) {
  const C = useC();
  if (collapsed) {
    return (
      <span style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <BrandLockup height={28} markOnly />
      </span>
    );
  }
  const onDark = C.navLogoChip && C.navLogoChip !== "transparent";
  return <BrandLockup height={height} onDark={onDark} />;
}

function NavRow({ item, active, collapsed, onClick, depth = 0 }) {
  const C = useC();
  const { t } = useI18n();
  const [hover, setHover] = React.useState(false);
  const isActive = active;
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={collapsed ? menuLabel(item, t) : undefined}
      style={{ ...FONT, position: "relative", display: "flex", alignItems: "center", gap: 11, width: "100%",
        padding: collapsed ? "9px 0" : depth ? "8px 10px 8px 12px" : "9px 10px", justifyContent: collapsed ? "center" : "flex-start",
        backgroundColor: isActive ? C.navActiveBg : hover ? C.navHover : "transparent", color: isActive ? C.navText : C.navTextMuted,
        fontSize: 13, fontWeight: isActive ? 700 : 500, border: "none", borderRadius: RADIUS.md, cursor: "pointer",
        transition: "background-color 0.12s, color 0.12s" }}>
      {isActive && !collapsed && <span style={{ position: "absolute", left: 0, top: 7, bottom: 7, width: 3, borderRadius: 3, backgroundColor: C.navAccent }} />}
      <span style={{ position: "relative", color: isActive ? C.navAccent : C.navTextMuted, display: "inline-flex", flexShrink: 0 }}>
        <Icon name={item.icon} size={collapsed ? 19 : 17} />
        {/* Collapsed rail has no room for the pill, so the count rides the icon instead of vanishing. */}
        {collapsed && item.badge != null && (
          <span style={{ position: "absolute", top: -6, right: -8, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8,
            backgroundColor: C.orange, color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex",
            alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{item.badge}</span>
        )}
      </span>
      {!collapsed && <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{menuLabel(item, t)}</span>}
      {!collapsed && item.badge != null && <Badge tone="orange" size="sm">{item.badge}</Badge>}
    </button>
  );
}



function SideNav({ route, onNavigate, collapsed, onToggleCollapse }) {
  const C = useC();
  const { t } = useI18n();
  const { menu } = useMenus();
  const session = useSession();
  // Super Admin gets a simplified operator nav: Super Admin, Administration, and Master Data.
  // Business modules remain reachable via impersonation.
  const roles = session.effectiveRoles || [session.effectiveRole];
  const [open, setOpen] = React.useState(() => ({
    superAdmin: true,
    administration: false,
  }));
  let visibleMenu = sidebarMenuForPermissions(menu, session.permissions, roles);
  const [hovered, setHovered] = React.useState(false);
  const showCollapsed = collapsed && !hovered; // visually collapsed (narrow rail)
  return (
    <div style={{ width: collapsed ? 72 : 256, flexShrink: 0, height: "100%", position: "relative", zIndex: collapsed ? 200 : "auto" }}>
    <aside
      onMouseEnter={() => { if (collapsed) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      style={{ ...FONT, width: showCollapsed ? 72 : 256, position: collapsed ? "absolute" : "relative", top: 0, left: 0,
      backgroundColor: C.navBg, backgroundImage: C.navBgImage, borderRight: `1px solid ${C.navBorder}`,
      boxShadow: collapsed && hovered ? C.shadowLg : "none",
      display: "flex", flexDirection: "column", height: "100%", flexShrink: 0, overflow: "hidden", transition: "width 0.18s ease, box-shadow 0.18s ease" }}>
      {/* Brand header */}
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: showCollapsed ? "center" : "flex-start", gap: 10, padding: showCollapsed ? 0 : "0 16px", borderBottom: `1px solid ${C.navBorderSoft}`, flexShrink: 0 }}>
        <BrandLogo height={32} collapsed={showCollapsed} />
        {!showCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.navTextSubtle, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Procurement</span>
          </div>
        )}
      </div>

      {/* Nav body */}
      <nav style={{ flex: 1, padding: showCollapsed ? "12px 10px" : "12px", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 2 }}>
        {visibleMenu.map((node) => {
          if (node.type === "item") {
            return <NavRow key={node.key} item={node} active={route === node.key} collapsed={showCollapsed} onClick={() => onNavigate(node.key)} />;
          }
          const isOpen = showCollapsed ? true : (open[node.key] !== false);
          const groupActive = node.children.some((c) => c.key === route);
          return (
            <div key={node.key} style={{ marginTop: 8 }}>
              {!showCollapsed ? (
                <button onClick={() => setOpen((o) => ({ ...o, [node.key]: !o[node.key] }))}
                  style={{ ...FONT, display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 10px", border: "none", background: "none", cursor: "pointer",
                    fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: groupActive ? C.navAccent : C.navTextSubtle }}>
                  <Icon name={node.icon} size={13} color={groupActive ? C.navAccent : C.navTextSubtle} />
                  <span style={{ flex: 1, textAlign: "left" }}>{menuLabel(node, t)}</span>
                  <span style={{ display: "flex", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}><Icon name="chevron-down" size={13} color={C.navTextSubtle} /></span>
                </button>
              ) : <div style={{ height: 1, backgroundColor: C.navBorderSoft, margin: "8px 6px" }} />}
              {isOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                  {node.children.map((c) => <NavRow key={c.key} item={c} active={route === c.key} collapsed={showCollapsed} onClick={() => onNavigate(c.key)} depth={1} />)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer — version chip opens About Application (same look as the former top-bar badge). */}
      <div style={{ padding: showCollapsed ? "10px" : "10px 12px", borderTop: `1px solid ${C.navBorderSoft}`, display: "flex", alignItems: "center", gap: 8, justifyContent: showCollapsed ? "center" : "space-between", flexWrap: "wrap" }}>
        <AboutVersionBadge compact={showCollapsed} />
        <Tooltip label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")} side="right">
        <button onClick={onToggleCollapse} style={{ ...FONT, width: 30, height: 30, borderRadius: RADIUS.md, border: "none", background: "transparent", color: C.navTextMuted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.navHover} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
          <Icon name={collapsed ? "panel-left-open" : "panel-left-close"} size={18} />
        </button>
        </Tooltip>
      </div>
    </aside>
    </div>
  );
}

/* ---------- Top Bar ---------- */
function ThemeMenu() {
  const C = useC();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <Menu align="right" width={180} trigger={<IconButton name={theme === "dark" ? "moon" : "sun"} title={t("theme")} />}>
      <MenuLabel>{t("theme")}</MenuLabel>
      <MenuItem icon="sun" label={t("theme.light")} active={theme === "light"} onClick={() => setTheme("light")} trailing={theme === "light" ? <Icon name="check" size={14} color={C.ocean} /> : null} />
      <MenuItem icon="moon" label={t("theme.dark")} active={theme === "dark"} onClick={() => setTheme("dark")} trailing={theme === "dark" ? <Icon name="check" size={14} color={C.ocean} /> : null} />
    </Menu>
  );
}
function LangMenu() {
  const C = useC();
  const { t, lang, setLang } = useI18n();
  const cur = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <Menu align="right" width={190} trigger={
      <Tooltip label={t("language")} side="bottom">
      <button style={{ ...FONT, display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, width: 44, borderRadius: RADIUS.md, border: "1px solid transparent", background: "transparent", cursor: "pointer" }}>
        <Flag code={cur.code} size={24} />
      </button>
      </Tooltip>}>
      <MenuLabel>{t("language")}</MenuLabel>
      {LANGS.map((l) => <MenuItem key={l.code} label={<span style={{ display: "inline-flex", gap: 9, alignItems: "center" }}><Flag code={l.code} size={18} />{l.label}</span>}
        active={lang === l.code} onClick={() => setLang(l.code)} trailing={lang === l.code ? <Icon name="check" size={14} color={C.ocean} /> : null} />)}
    </Menu>
  );
}
function NotifMenu({ onView }) {
  const C = useC();
  const { t } = useI18n();
  const { items, unread, markRead, markAllRead } = useNotifications();
  const sevColor = { info: C.info, success: C.success, warning: C.warningText, danger: C.danger };
  return (
    <Menu align="right" width={340} menuStyle={{ padding: 0 }} trigger={
      <span style={{ position: "relative", display: "inline-flex" }}>
        <IconButton name="bell" title={t("notifications")} />
        {unread > 0 && <span style={{ position: "absolute", top: 3, right: 3, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, backgroundColor: C.orange, color: "#fff", fontSize: 9.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.surface}` }}>{unread}</span>}
      </span>}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="bell" size={16} color={C.text} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{t("notifications")}</span>
          {unread > 0 && <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, backgroundColor: C.orange, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>}
        </span>
        <span onClick={(e) => { e.stopPropagation(); if (unread) markAllRead(); }}
          style={{ fontSize: 11.5, color: unread ? C.ocean : C.textSubtle, fontWeight: 600, cursor: unread ? "pointer" : "default", whiteSpace: "nowrap" }}>{t("notifications.mark")}</span>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {items.length === 0 && <div style={{ padding: "28px 14px", textAlign: "center", fontSize: 12.5, color: C.textMuted }}>{t("notifications.empty")}</div>}
        {items.slice(0, 5).map((n) => (
          <div key={n.id} onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
            style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: n.read ? "transparent" : C.brandBg + "55", cursor: "pointer", transition: "background-color 0.12s" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: n.read ? "transparent" : (sevColor[n.severity] || C.textSubtle), border: n.read ? `1.5px solid ${C.border}` : "none", marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: n.read ? 500 : 700, color: C.text, lineHeight: 1.35 }}>{n.title}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1, display: "inline-flex", alignItems: "center", gap: 5 }}>
                {n.audience && n.audience.scope === "all" && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: C.orange, fontWeight: 700 }}><Icon name="megaphone" size={11} />Announcement</span>}
                {n.audience && n.audience.scope === "all" && <span style={{ color: C.textSubtle }}>·</span>}
                {fmtAppDateTime(n.time)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div onClick={onView} style={{ padding: "10px 14px", textAlign: "center", fontSize: 12.5, fontWeight: 600, color: C.ocean, cursor: "pointer" }}>{t("notifications.view")}</div>
    </Menu>
  );
}
/* ---------- Impersonation bar ---------- */
function ImpersonationBar({ onExit }) {
  const C = useC();
  const session = useSession();
  if (!session.isImpersonating) return null;
  const orange = C.orange;
  return (
    <div style={{ ...FONT, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", height: 42, flexShrink: 0,
      backgroundColor: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.10)", borderBottom: `1px solid ${C.scheme === "dark" ? "rgba(240,116,61,0.3)" : "rgba(235,102,46,0.28)"}` }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, backgroundColor: orange, color: "#fff", flexShrink: 0 }}><Icon name="venetian-mask" size={13} /></span>
      <span style={{ fontSize: 13, color: C.text }}>
        Viewing as <b style={{ fontWeight: 700 }}>{session.actingUser.name}</b>
        <span style={{ color: C.textMuted }}> · {session.actingUser.role}</span>
        <span style={{ color: C.textMuted }}> — actions are recorded in the audit log as impersonated.</span>
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={() => { session.stop(); onExit && onExit(); }}
        style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", borderRadius: RADIUS.md, cursor: "pointer",
          border: `1px solid ${orange}`, background: "transparent", color: orange, fontSize: 12.5, fontWeight: 700 }}>
        <Icon name="undo-2" size={14} />Back to my account
      </button>
    </div>
  );
}

function UserMenu({ user, onNavigate, onLock, ssoEnabled, ssoHomeUrl }) {
  const C = useC();
  const { t } = useI18n();
  const session = useSession();
  const { menu } = useMenus();
  const imp = session.isImpersonating;
  const [acct, setAcct] = React.useState(null); // "profile" | "password" | "image"
  return (
    <>
    <Menu align="right" width={244} trigger={
      <button style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 9, height: 40, padding: "0 6px 0 8px", borderRadius: RADIUS.pill, border: `1px solid ${imp ? C.orange : C.border}`, background: C.surface, cursor: "pointer" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{user.name}</span>
          <span style={{ fontSize: 10.5, color: imp ? C.orange : C.textMuted, fontWeight: imp ? 700 : 400, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(user.roles && user.roles.length ? user.roles : [user.role]).filter(Boolean).join(" · ")}</span>
        </div>
        <Avatar name={user.name} src={user.avatar} size={30} />
      </button>}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px 10px" }}>
        <Avatar name={user.name} src={user.avatar} size={38} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
        </div>
      </div>
      <MenuDivider />
      {imp && (
        <>
          <div style={{ margin: "2px 10px 6px", padding: "8px 10px", borderRadius: RADIUS.md, backgroundColor: C.scheme === "dark" ? "rgba(240,116,61,0.14)" : "rgba(235,102,46,0.10)", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="venetian-mask" size={14} color={C.orange} />
            <span style={{ fontSize: 11.5, color: C.text, lineHeight: 1.4 }}>Impersonating. Your account is <b>{session.realUser.name}</b>.</span>
          </div>
          <MenuItem icon="undo-2" label="Back to My Account" onClick={() => { session.stop(); onNavigate(landingForPermissions(menu, session.realUser.permissions || [], session.realUser.roles)); }} />
          <MenuDivider />
        </>
      )}
      <MenuItem icon="user" label={t("profile")} onClick={() => setAcct("profile")} />
      {session.realUser?.hasLocalPassword && (
        <MenuItem icon="key-round" label={t("changePassword") || "Change password"} onClick={() => setAcct("password")} />
      )}
      <MenuItem icon="image" label={t("changeImage")} onClick={() => setAcct("image")} />
      <MenuDivider />
      <MenuItem icon="lock" label={t("lockScreen")} onClick={() => onLock && onLock()} />
      {ssoEnabled
        // SSO handles sign-out at the identity provider; leaving the app means returning to the
        // SISWarrior portal, so Logout is hidden and replaced by "Back to SIS Warrior".
        ? <MenuItem icon="external-link" label="Back to SIS Warrior" onClick={() => { if (ssoHomeUrl) window.location.assign(ssoHomeUrl); }} />
        : <MenuItem icon="log-out" label={t("logout")} danger onClick={() => onNavigate("logout")} />}
    </Menu>
    <ProfileModal open={acct === "profile"} onClose={() => setAcct(null)} user={user} />
    <ChangePasswordModal open={acct === "password"} onClose={() => setAcct(null)} />
    <ChangeImageModal open={acct === "image"} onClose={() => setAcct(null)} user={user}
      onApply={(url) => session.setAvatar(url)} onRemove={() => session.setAvatar(null)} />
    </>
  );
}

/* Quick impersonation switcher — Super Admin only. Picking a user behaves exactly like
   the "Login as this user" action on the Users page (same confirm modal + audit record). */
function ImpersonateMenu({ onNavigate }) {
  const C = useC();
  const session = useSession();
  const toast = useToast();
  const [q, setQ] = React.useState("");
  const [moduleKey, setModuleKey] = React.useState("all");
  const [imp, setImp] = React.useState(null);
  // Real users come from the backend (same source as the Users admin screen) — no mock array.
  const [users, setUsers] = React.useState([]);
  React.useEffect(() => {
    if (!session.canImpersonate) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await adminUsersJson("/api/v1/administration/users");
        if (!cancelled) setUsers((Array.isArray(data) ? data : []).map(adminUserFromApi));
      } catch (e) { if (!cancelled) setUsers([]); }
    })();
    return () => { cancelled = true; };
  }, [session.canImpersonate]);
  if (!session.canImpersonate) return null;
  const list = users.filter((u) => u.email !== session.realUser.email && u.email !== session.actingUser.email);
  // Only modules of the current app edition are selectable here — e.g. the external-only Vendor
  // Workspace is hidden in the internal app (it cannot be accessed/impersonated from here).
  const moduleOptions = [{ value: "all", label: "All modules" }, ...APP_MODULES.filter((m) => (m.edition || "internal") === APP_EDITION && m.status !== "Retired").map((m) => ({ value: m.key, label: m.name }))];
  // role → module keys, resolved via the backend-hydrated catalog (falls back to name pattern)
  const userModules = (u) => [...new Set((u.roles || [u.role]).flatMap(moduleKeysForRoleName))];
  const moduleFiltered = moduleKey === "all" ? list : list.filter((u) => userModules(u).includes(moduleKey));
  const ql = q.trim().toLowerCase();
  const filtered = ql ? moduleFiltered.filter((u) => {
    const roles = (u.roles || [u.role]).join(" ");
    const modules = userModules(u).map((k) => APP_MODULE_BY_KEY[k] && APP_MODULE_BY_KEY[k].name).filter(Boolean).join(" ");
    return [u.fullName, u.role, roles, u.username, modules].some((s) => s.toLowerCase().includes(ql));
  }) : moduleFiltered;
  const selectedModule = moduleOptions.find((m) => m.value === moduleKey) || moduleOptions[0];
  const start = (u) => {
    session.record({ action: "Impersonate", module: "Auth", desc: `Started impersonating ${u.fullName} (${u.role})`, tone: "brand", impersonated: false, user: session.realUser.name });
    session.impersonate(u);
    setImp(null);
    toast.push({ title: "Impersonation started", description: `You are now viewing as ${u.fullName} (${u.role}).` });
    onNavigate("landing");
  };
  return (
    <>
    <Menu align="right" width={332} menuStyle={{ padding: 0 }} trigger={
      <Tooltip label="Login as another user" side="bottom">
      <button style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: RADIUS.pill, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", color: C.text }}>
        <Icon name="venetian-mask" size={16} color={C.ocean} />
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>Impersonate</span>
        <Icon name="chevron-down" size={14} color={C.textMuted} />
      </button>
      </Tooltip>}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.borderSoft}` }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}><Icon name="venetian-mask" size={15} color={C.ocean} />Login as user</div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>Switch into a user's role to test &amp; diagnose.</div>
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: "10px 12px 8px", display: "flex", flexDirection: "column", gap: 8, borderBottom: `1px solid ${C.borderSoft}` }}>
        <Field label="Module">
          <Select size="sm" value={moduleKey} onChange={(e) => { setModuleKey(e.target.value); setQ(""); }} options={moduleOptions} />
        </Field>
        <TextInput size="sm" iconLeft="search" placeholder={`Search users in ${selectedModule.label}...`} value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.textMuted }}>
            <Icon name="filter" size={12} color={C.textSubtle} />Choose module, then user
          </span>
          <Badge tone="neutral" size="sm">{filtered.length} users</Badge>
        </div>
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto", padding: "6px 6px 8px" }}>
        {filtered.length === 0 && <div style={{ padding: "18px 12px", textAlign: "center", fontSize: 12.5, color: C.textMuted }}>No users found for {selectedModule.label}</div>}
        {filtered.map((u) => (
          <button key={u.id} onClick={() => setImp(u)}
            style={{ ...FONT, display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px", border: "none", background: "transparent", borderRadius: RADIUS.sm, cursor: "pointer", textAlign: "left" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.hover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            <Avatar name={u.fullName} size={30} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.fullName}</div>
              <div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.role}</div>
            </div>
            <Icon name="log-in" size={14} color={C.textSubtle} />
          </button>
        ))}
      </div>
    </Menu>
    <Modal open={!!imp} onClose={() => setImp(null)} width={460} icon="venetian-mask" title="Login as this user" subtitle="Impersonate for testing & diagnostics"
      footer={<><Button variant="secondary" onClick={() => setImp(null)}>Cancel</Button>
        <Button iconLeft="log-in" onClick={() => start(imp)}>Yes, login as user</Button></>}>
      {imp && <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }}>
          <Avatar name={imp.fullName} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{imp.fullName}</div>
            <div style={{ fontSize: 12.5, color: C.textMuted }}>{imp.role} · {imp.email}</div>
          </div>
        </div>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>You will be signed in as <b>{imp.fullName}</b> — navigation, permissions, and access will all switch to the <b>{imp.role}</b> role, exactly as if they had logged in themselves. You can return to your own account at any time.</p>
        <Alert tone="info" title="Recorded as impersonation" description="Anything you create or change while impersonating is written to the audit log as an impersonated action by your account." />
      </div>}
    </Modal>
    </>
  );
}

function TopBar({ title, user, notifications, onNavigate, onSearch, onLock, ssoEnabled, ssoHomeUrl }) {
  const C = useC();
  const { t } = useI18n();
  const search = useSearch();
  const [fs, setFs] = React.useState(false);
  const toggleFs = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); setFs(true); }
    else { document.exitFullscreen && document.exitFullscreen().catch(() => {}); setFs(false); }
  };
  return (
    <header style={{ ...FONT, height: 64, backgroundColor: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 14, flexShrink: 0, position: "sticky", top: 0, zIndex: 100 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.01em", margin: 0, whiteSpace: "nowrap" }}>{title}</h1>
      <div style={{ flex: 1 }} />
      {search && search.topbarVisible && (
        <div style={{ width: 248 }} className="ag-topsearch">
          <TextInput placeholder={search.placeholder} iconLeft="search" value={search.query} onChange={(e) => search.setQuery(e.target.value)}
            inputRef={search.topbarInputRef} onFocus={() => search.markFocus(true)} onBlur={() => search.markFocus(false)}
            iconRight={<span style={{ fontSize: 10, color: C.textSubtle, fontWeight: 600, padding: "1px 5px", border: `1px solid ${C.border}`, borderRadius: 4 }}>⌘K</span>} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <IconButton name={fs ? "minimize" : "maximize"} title={t("fullscreen")} onClick={toggleFs} />
        <ThemeMenu />
        <LangMenu />
        <NotifMenu onView={() => onNavigate("notifications")} />
      </div>
      <div style={{ width: 1, height: 28, backgroundColor: C.border, margin: "0 2px" }} />
      <ImpersonateMenu onNavigate={onNavigate} />
      <UserMenu user={user} onNavigate={onNavigate} onLock={onLock} ssoEnabled={ssoEnabled} ssoHomeUrl={ssoHomeUrl} />
    </header>
  );
}

/* Breadcrumb / PageHeader / Toolbar moved to PrimitivesX.jsx (shared page chrome). */

Object.assign(window, { BrandLogo, SideNav, TopBar, ImpersonationBar });
export { BrandLogo, SideNav, TopBar, ImpersonationBar };
