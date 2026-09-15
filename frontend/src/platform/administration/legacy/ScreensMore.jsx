/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, IconButton, TableRefreshButton, Badge, Avatar, Card, TextInput, Select } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDateTime, Alert, Menu, MenuItem, MenuDivider, DataTable, Pagination, useToast, PageHeader, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard } from "../../../shared/legacy/PrimitivesX.jsx";
import { modulesForRoleName, adminModuleScopeForRoles, setPermissionCatalog, getPermissionCatalog, allPermissionKeys } from "../../data/legacy/Data.jsx";
import { useSession, SUPER_ADMIN_ROLE } from "../../session/legacy/Session.jsx";
import { useNotifications, notifAudience } from "../../notifications/legacy/Notifications.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
import { PermissionMatrix } from "./ScreensRoles.jsx";
/* Alamtri Geo Admin — Role Permissions (full page), Audit Log, Notifications. */

/* ============ Role Permissions ============ */
function RoleSummary({ selected, groups }) {
  const C = useC();
  const catalog = groups && groups.length ? groups : getPermissionCatalog();
  const total = catalog.reduce((s, m) => s + m.perms.length, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Assigned permissions</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>{selected.length}</span>
          <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 600 }}>/ {total}</span>
        </div>
        <div style={{ height: 7, borderRadius: 999, backgroundColor: C.surfaceAlt, marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(selected.length / total) * 100}%`, background: C.ocean, borderRadius: 999, transition: "width 0.2s" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {catalog.map((m) => {
          const keys = m.perms.map((p) => p.key); const on = keys.filter((k) => selected.includes(k)).length;
          return (
            <div key={m.module} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
              <span style={{ width: 24, height: 24, borderRadius: RADIUS.sm, backgroundColor: on ? C.brandBg : C.surfaceAlt, color: on ? C.ocean : C.textSubtle, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={m.icon} size={13} /></span>
              <span style={{ flex: 1, color: C.text, fontWeight: 500 }}>{m.module}</span>
              <span style={{ color: on === keys.length && on > 0 ? C.success : C.textMuted, fontWeight: 600 }}>{on}/{keys.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RolePermissions({ onNavigate }) {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const session = useSession();
  // Assigned permissions come ONLY from the backend. There used to be a `seed` here that faked each
  // role's set as "the first N catalog keys"; it seeded `working`, so a failed load left fabricated
  // checkmarks that Save then wrote over the role's real access.
  const [saved, setSaved] = React.useState({});
  const [permGroups, setPermGroups] = React.useState(() => getPermissionCatalog());
  const [loaded, setLoaded] = React.useState(false);
  const [rows, setRows] = React.useState([]); // hydrated from /role-permissions on mount
  const [loading, setLoading] = React.useState(false);
  const adminScope = adminModuleScopeForRoles(session.effectiveRoles);
  const roleAllowedForScope = (r) => !adminScope || (r.modules || modulesForRoleName(r.name)).some((k) => adminScope.includes(k));
  const visibleRoles = rows.filter((r) => roleAllowedForScope(r) && (session.canSeeSuperAdminRole || r.name !== SUPER_ADMIN_ROLE));
  const canManagePermissions = session.canSeeSuperAdminRole;
  const initialRoleId = (visibleRoles[0] && visibleRoles[0].id) || "";
  const [roleId, setRoleId] = React.useState(initialRoleId);
  const [working, setWorking] = React.useState([]);
  const [q, setQ] = React.useState("");
  const loadMatrix = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/administration/role-permissions", { credentials: "include", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Role permissions API failed: ${response.status}`);
      const data = await response.json();
      const apiRoles = Array.isArray(data.roles) ? data.roles.map((r) => ({
        id: r.roleId || r.id,
        name: r.name,
        description: r.description || "",
        users: r.users || 0,
        perms: r.permissions || 0,
        system: !!(r.isSystem || r.system),
        modules: Array.isArray(r.modules) ? r.modules : [],
      })) : [];
      const assignments = data.assignments || {};
      if (apiRoles.length) setRows(apiRoles);
      setPermGroups(setPermissionCatalog(data.permissionGroups));
      setSaved(assignments);
      const nextRole = apiRoles.some((r) => r.id === roleId) ? roleId : ((apiRoles[0] && apiRoles[0].id) || roleId);
      setRoleId(nextRole);
      setWorking(assignments[nextRole] || []);
      setLoaded(true);
    } catch (e) {
      console.warn("Administration role-permissions API unavailable; the editor stays read-only.", e);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [roleId]);
  React.useEffect(() => { loadMatrix(); }, []);
  React.useEffect(() => {
    if (!visibleRoles.some((r) => r.id === roleId)) {
      const next = (visibleRoles[0] && visibleRoles[0].id) || "";
      setRoleId(next);
      setWorking(saved[next] || []);
    }
  }, [session.effectiveRoles]);
  const role = visibleRoles.find((r) => r.id === roleId) || visibleRoles[0] || rows.find((r) => r.id === roleId);
  const activeRoleId = role ? role.id : roleId;
  const dirty = JSON.stringify([...working].sort()) !== JSON.stringify([...(saved[activeRoleId] || [])].sort());

  const selectRole = (id) => {
    if (dirty && !window.confirm("Discard unsaved changes to this role?")) return;
    setRoleId(id); setWorking(saved[id] || []);
  };
  const save = () => {
    // Never write a set we did not read: without a successful load, `working` is not this role's truth.
    if (!canManagePermissions || !loaded || !role) return;
    fetch(`/api/v1/administration/roles/${encodeURIComponent(activeRoleId)}/permissions`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: working }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Role permissions save failed: ${response.status}`);
        setSaved((s) => ({ ...s, [activeRoleId]: working }));
        setRows((rs) => rs.map((r) => r.id === activeRoleId ? { ...r, perms: working.length } : r));
        toast.push({ title: "Permissions saved", description: `${role ? role.name : activeRoleId} now has ${working.length} permissions.` });
      })
      .catch((e) => {
        // Do NOT mark it saved locally: permissions are an authorization record, and pretending the
        // write landed makes the UI disagree with the actual access the backend enforces.
        console.warn("Administration role-permissions save failed.", e);
        toast.push({ title: "Save failed", description: "The backend rejected the change; nothing was saved.", tone: "error" });
        loadMatrix();
      });
  };
  const reset = () => setWorking(saved[activeRoleId] || []);
  const roleList = visibleRoles.filter((r) => q === "" || r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <OpsPage>
      <OpsHero kicker="Administration" kickerIcon="shield" title="Role Permissions" subtitle="Assign and review the permissions granted to each role across all modules." compact
        right={canManagePermissions ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <OpsHeroButton variant="secondary" iconLeft="rotate-ccw" disabled={!dirty} onClick={reset}>{t("act.reset")}</OpsHeroButton>
          <OpsHeroButton variant="primary" iconLeft="save" disabled={!dirty || !loaded} onClick={save}>{t("act.save")}</OpsHeroButton>
        </div> : <Badge tone="neutral">Read only</Badge>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="key-round" label="Assigned" value={working.length} sub={`of ${allPermissionKeys().length} permissions`} iconTone="brand" />
        <OpsStatCard icon="shield" label="Roles" value={visibleRoles.length} sub={loading ? "loading..." : ""} iconTone="blue" />
        <OpsStatCard icon="users-round" label="Selected role" value={role ? role.name : "—"} sub={role ? `${(saved[activeRoleId] || []).length} saved` : ""} iconTone="forest" />
      </OpsStatGrid>

      {dirty && <div style={{ marginBottom: 14 }}><Alert tone="warning" title="Unsaved changes" description={`You have modified permissions for ${role ? role.name : activeRoleId}. Save to apply or reset to discard.`} /></div>}
      {!canManagePermissions && <div style={{ marginBottom: 14 }}><Alert tone="info" title="Read-only access" description="Only Super Admin can add roles or change role permissions." /></div>}

      <div style={{ display: "grid", gridTemplateColumns: "264px 1fr 300px", gap: 16, alignItems: "start" }} className="ag-rp-grid">
        {/* Role selector */}
        <Card pad={0} style={{ position: "sticky", top: 88 }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${C.borderSoft}` }}>
            <TextInput size="sm" iconLeft="search" placeholder="Find role…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ padding: 6, maxHeight: 520, overflowY: "auto" }}>
            {roleList.map((r) => {
              const active = r.id === roleId;
              return (
                <button key={r.id} onClick={() => selectRole(r.id)} style={{ ...FONT, display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", border: "none", textAlign: "left",
                  backgroundColor: active ? C.active : "transparent", borderRadius: RADIUS.md, cursor: "pointer", marginBottom: 2 }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = C.hover; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <span style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: active ? C.ocean : C.surfaceAlt, color: active ? "#fff" : C.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="shield" size={15} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: active ? 700 : 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                    <span style={{ display: "block", fontSize: 11, color: C.textMuted }}>{(saved[r.id] || []).length} permissions · {r.users} users</span>
                  </span>
                  {active && <Icon name="chevron-right" size={15} color={C.ocean} />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Permission matrix */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="shield-check" size={18} /></span>
              <div>
                {/* `role` is undefined until the matrix has loaded (rows starts empty), so every read of
                    it must be guarded — this section used to dereference it and blank the whole page. */}
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>{role ? role.name : (loading ? "Loading roles…" : "No role selected")} {role && role.system && <Badge tone="brand" size="sm">System</Badge>}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{role ? role.description : ""}</div>
              </div>
            </div>
            {canManagePermissions && <div style={{ display: "flex", gap: 8 }}>
              <Button variant="link" size="sm" onClick={() => setWorking(allPermissionKeys())}>Select all</Button>
              <Button variant="link" size="sm" onClick={() => setWorking([])}>Clear all</Button>
            </div>}
          </div>
          <PermissionMatrix selected={working} onChange={setWorking} compact groups={permGroups} readOnly={!canManagePermissions || !loaded || !role} />
        </div>

        {/* Summary */}
        <Card style={{ position: "sticky", top: 88 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 14 }}>Assigned summary</div>
          <RoleSummary selected={working} groups={permGroups} />
          <div style={{ borderTop: `1px solid ${C.borderSoft}`, marginTop: 16, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {canManagePermissions ? <>
              <Button fullWidth iconLeft="save" disabled={!dirty || !loaded} onClick={save}>{t("act.save")}</Button>
              <Button fullWidth variant="secondary" iconLeft="rotate-ccw" disabled={!dirty} onClick={reset}>{t("act.reset")}</Button>
            </> : <Button fullWidth variant="secondary" iconLeft="lock" disabled>Read only</Button>}
          </div>
        </Card>
      </div>
    </OpsPage>
  );
}

/* ============ Audit Log ============ */
function auditEntryFromApi(row) {
  const time = row.time || row.occurredAt || "";
  const parsed = time ? new Date(String(time).replace(" ", "T")) : null;
  const daysAgo = parsed && !Number.isNaN(parsed.getTime())
    ? Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000))
    : 0;
  const tone = row.action === "Create" ? "success"
    : row.action === "Delete" ? "danger"
      : row.action === "Update" ? "brand"
        : "neutral";
  return {
    id: row.id,
    action: row.action || "",
    user: row.user || row.actorName || "System",
    module: row.module || "",
    desc: row.description || row.desc || "",
    ip: row.ipAddress || row.ip || "",
    time,
    daysAgo,
    tone,
  };
}
function AuditLog() {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const ps = usePageSearch("Search action, user, IP…");
  const q = ps.query, setQ = ps.setQuery;
  const [range, setRange] = React.useState("all");
  const [userF, setUserF] = React.useState("all");
  const [moduleF, setModuleF] = React.useState("all");
  const [sortDir, setSortDir] = React.useState("desc");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [loading, setLoading] = React.useState(false);
  const [auditRows, setAuditRows] = React.useState([]);
  const refresh = React.useCallback((showToast) => {
    setLoading(true);
    fetch("/api/v1/super-admin/audit", { credentials: "include", headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`Audit API failed: ${response.status}`);
        return response.json();
      })
      .then((rows) => {
        setAuditRows((Array.isArray(rows) ? rows : []).map(auditEntryFromApi));
        if (showToast) toast.push({ title: "Refreshed", description: "Audit log is up to date." });
      })
      .catch((e) => {
        console.warn("Audit API unavailable.", e);
        setAuditRows([]);
        if (showToast) toast.push({ title: "Backend unavailable", description: "Audit log could not be loaded.", tone: "warning" });
      })
      .finally(() => setLoading(false));
  }, [toast]);
  React.useEffect(() => { refresh(false); }, [refresh]);
  const ALL = auditRows;
  const users = Array.from(new Set(ALL.map((a) => a.user)));
  const modules = Array.from(new Set(ALL.map((a) => a.module)));
  const rangeMax = { today: 0, "7d": 7, "30d": 30, all: 9999 }[range];

  const filtered = React.useMemo(() => {
    let r = ALL.filter((a) => (userF === "all" || a.user === userF) && (moduleF === "all" || a.module === moduleF) &&
      a.daysAgo <= rangeMax && (q === "" || [a.action, a.user, a.module, a.desc, a.ip].some((s) => s.toLowerCase().includes(q.toLowerCase()))));
    r = [...r].sort((a, b) => sortDir === "asc" ? a.time.localeCompare(b.time) : b.time.localeCompare(a.time));
    return r;
  }, [ALL, q, userF, moduleF, range, sortDir]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => { setPage(1); }, [q, userF, moduleF, range]);

  const actionIcon = { Login: "log-in", Logout: "log-out", Create: "plus-circle", Update: "pencil", Delete: "trash-2", Approve: "check-circle-2", Reject: "x-circle", Export: "download", "Failed login": "shield-alert" };
  const columns = [
    { key: "action", label: "Action", width: 150, render: (a) => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: RADIUS.sm, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
          backgroundColor: ({ success: C.successBg, danger: C.dangerBg, brand: C.brandBg, info: C.infoBg, neutral: C.surfaceAlt }[a.tone]),
          color: ({ success: C.success, danger: C.danger, brand: C.ocean, info: C.info, neutral: C.textMuted }[a.tone]) }}><Icon name={actionIcon[a.action] || "activity"} size={14} /></span>
        <span style={{ fontWeight: 600, color: C.text }}>{a.action}</span>
      </span>) },
    { key: "user", label: "User", render: (a) => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Avatar name={a.user} size={26} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: C.text, fontWeight: 500 }}>{a.user}</span>
            {a.impersonated && <Badge tone="orange" size="sm">Impersonated</Badge>}
          </span>
          {a.impersonated && <span style={{ display: "block", fontSize: 11, color: C.textMuted }}>by {a.impersonatedBy}</span>}
        </span>
      </span>) },
    { key: "module", label: "Module", width: 120, render: (a) => <Badge tone="neutral">{a.module}</Badge> },
    { key: "desc", label: "Description", render: (a) => <span style={{ color: C.textMuted, fontSize: 12.5 }}>{a.desc}</span> },
    { key: "ip", label: "IP address", width: 120, nowrap: true, render: (a) => <span style={{ fontFamily: "monospace", fontSize: 12, color: C.textMuted }}>{a.ip}</span> },
    { key: "time", label: "Timestamp", sortable: true, nowrap: true, width: 172, render: (a) => <span style={{ color: C.text, fontSize: 12.5 }}>{fmtAppDateTime(a.time)}</span> },
  ];
  return (
    <OpsPage>
      <OpsHero kicker="Administration" kickerIcon="shield" title={t("nav.audit")} subtitle="A complete, filterable record of every action performed across the platform." compact
        right={<OpsHeroButton variant="secondary" iconLeft="download" onClick={() => toast.push({ title: "Export started", description: `${filtered.length} records queued for CSV export.` })}>{t("act.export")}</OpsHeroButton>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="scroll-text" label="Total records" value={ALL.length} iconTone="brand" />
        <OpsStatCard icon="filter" label="Filtered" value={filtered.length} sub={filtered.length !== ALL.length ? "matching filters" : "all records"} iconTone="blue" />
        <OpsStatCard icon="users-round" label="Users" value={users.length} sub={`${modules.length} modules`} iconTone="forest" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 240 }}><TextInput iconLeft="search" placeholder="Search action, user, IP…" value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              <div style={{ width: 150 }}><Select value={range} onChange={(e) => setRange(e.target.value)} options={[{ value: "today", label: "Today" }, { value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" }, { value: "all", label: "All time" }]} /></div>
              <div style={{ width: 170 }}><Select value={userF} onChange={(e) => setUserF(e.target.value)} options={[{ value: "all", label: "All users" }, ...users.map((u) => ({ value: u, label: u }))]} /></div>
              <div style={{ width: 150 }}><Select value={moduleF} onChange={(e) => setModuleF(e.target.value)} options={[{ value: "all", label: "All modules" }, ...modules.map((m) => ({ value: m, label: m }))]} /></div>
              {(q || range !== "all" || userF !== "all" || moduleF !== "all") && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setRange("all"); setUserF("all"); setModuleF("all"); }}>{t("act.clear")}</Button>}
            </>}
            right={<TableRefreshButton onClick={() => refresh(true)} />} />
        </div>
        <DataTable columns={columns} data={pageRows} loading={loading} dense sortKey="time" sortDir={sortDir} onSort={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          emptyTitle="No audit records" emptyDesc="No actions match your current filters." />
        <div style={{ padding: "4px 16px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} /></div>
      </Card>
    </OpsPage>
  );
}

/* ============ Notifications ============ */
function NotificationsPage() {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const notif = useNotifications();
  const rows = notif.items;
  const [q, setQ] = React.useState("");
  const [sevF, setSevF] = React.useState("all");
  const [readF, setReadF] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const unread = notif.unread;

  const filtered = React.useMemo(() => rows.filter((n) => (sevF === "all" || n.severity === sevF) &&
    (readF === "all" || (readF === "unread" ? !n.read : n.read)) &&
    (q === "" || [n.title, n.detail].some((s) => s.toLowerCase().includes(q.toLowerCase())))), [rows, q, sevF, readF]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => { setPage(1); }, [q, sevF, readF]);

  const toggleRead = (id) => notif.toggleRead(id);
  const remove = (id) => { notif.remove(id); toast.push({ title: "Notification removed", tone: "error" }); };
  const markAll = () => { notif.markAllRead(); toast.push({ title: "All notifications marked as read" }); };

  const sevMeta = { danger: { tone: "danger", icon: "shield-alert", label: "Critical" }, warning: { tone: "warning", icon: "alert-triangle", label: "Warning" }, success: { tone: "success", icon: "check-circle-2", label: "Success" }, info: { tone: "info", icon: "info", label: "Info" } };
  const columns = [
    { key: "severity", label: "Severity", width: 120, render: (n) => { const m = sevMeta[n.severity]; return <Badge tone={m.tone} dot>{m.label}</Badge>; } },
    { key: "title", label: "Notification message", render: (n) => {
      const a = notifAudience(n);
      return (
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: C.text }}>{n.title}</span>
          <span title={a.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", color: a.kind === "all" ? C.orange : C.textMuted, backgroundColor: a.kind === "all" ? C.orange + "1c" : C.surfaceAlt, border: `1px solid ${a.kind === "all" ? "transparent" : C.borderSoft}`, padding: "1px 7px", borderRadius: RADIUS.pill }}>
            <Icon name={a.icon} size={11} />{a.kind === "all" ? "Announcement" : a.kind === "role" ? "For your role" : "Direct"}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{n.detail}</div>
      </div>); } },
    { key: "time", label: t("common.createdAt"), width: 150, nowrap: true, render: (n) => <span style={{ color: C.textMuted, fontSize: 12.5 }}>{fmtAppDateTime(n.time)}</span> },
    { key: "read", label: "Status", width: 110, render: (n) => n.read ? <Badge tone="neutral">Read</Badge> : <Badge tone="brand" dot>Unread</Badge> },
    { key: "_a", label: t("common.actions"), align: "right", width: 60, render: (n) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={188} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon={n.read ? "mail" : "mail-open"} label={n.read ? "Mark as unread" : "Mark as read"} onClick={() => toggleRead(n.id)} />
          <MenuDivider />
          <MenuItem icon="trash-2" label={t("act.delete")} danger onClick={() => remove(n.id)} />
        </Menu>
      </div>) },
  ];
  return (
    <div>
      <PageHeader title={t("notifications")} description="Manage system notifications, severity, and read status."
        breadcrumb={[{ label: "Alamtri Geo" }, { label: t("notifications") }]}
        meta={<Badge tone={unread ? "orange" : "neutral"} dot>{unread} unread</Badge>}
        actions={<Button variant="secondary" iconLeft="check-check" disabled={!unread} onClick={markAll}>{t("notifications.mark")}</Button>} />
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div style={{ width: 250 }}><TextInput iconLeft="search" placeholder="Search notifications…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <div style={{ width: 158 }}><Select value={sevF} onChange={(e) => setSevF(e.target.value)} options={[{ value: "all", label: "All severities" }, { value: "danger", label: "Critical" }, { value: "warning", label: "Warning" }, { value: "success", label: "Success" }, { value: "info", label: "Info" }]} /></div>
              <div style={{ width: 150 }}><Select value={readF} onChange={(e) => setReadF(e.target.value)} options={[{ value: "all", label: "All status" }, { value: "unread", label: "Unread" }, { value: "read", label: "Read" }]} /></div>
            </>}
            right={<span style={{ fontSize: 12.5, color: C.textMuted }}><b style={{ color: C.text }}>{filtered.length}</b> {t("common.results")}</span>} />
        </div>
        <DataTable columns={columns} data={pageRows} dense onRowClick={(n) => toggleRead(n.id)}
          emptyTitle="No notifications" emptyDesc="You're all caught up." />
        <div style={{ padding: "4px 16px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} /></div>
      </Card>
    </div>
  );
}

Object.assign(window, { RolePermissions, AuditLog, NotificationsPage });
export { RolePermissions, AuditLog, NotificationsPage };
