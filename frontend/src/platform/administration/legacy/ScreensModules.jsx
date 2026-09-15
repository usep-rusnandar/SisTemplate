/* fm2-converted */
import React from "react";
import { RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, Badge, StatusBadge, Card, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { DataTable, Toolbar, OpsPage, OpsHero, OpsStatGrid, OpsStatCard } from "../../../shared/legacy/PrimitivesX.jsx";
import { APP_MODULES } from "../../data/legacy/Data.jsx";
import { useSession, SUPER_ADMIN_ROLE } from "../../session/legacy/Session.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
/* Alamtri Geo Admin — Modules: Super Admin module registry. */

function Modules() {
  const C = useC();
  const { t } = useI18n();
  const session = useSession();
  const ps = usePageSearch("Search modules...");
  const q = ps.query, setQ = ps.setQuery;

  const roleCatalog = session.roles || [];
  // real users from the backend (this is a Super-Admin screen) for the per-module user count
  const [allUsers, setAllUsers] = React.useState([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await window.adminUsersJson("/api/v1/administration/users");
        if (!cancelled) setAllUsers((Array.isArray(data) ? data : []).map(window.adminUserFromApi));
      } catch (e) { if (!cancelled) setAllUsers([]); }
    })();
    return () => { cancelled = true; };
  }, []);
  const rows = React.useMemo(() => APP_MODULES.map((m) => {
    const roles = roleCatalog.filter((r) => (r.modules || []).includes(m.key) || r.name === SUPER_ADMIN_ROLE);
    const users = allUsers.filter((u) => (u.roles || [u.role]).some((roleName) => {
      const role = roleCatalog.find((r) => r.name === roleName);
      return role && ((role.modules || []).includes(m.key) || role.name === SUPER_ADMIN_ROLE);
    }));
    return { ...m, roles, users };
  }), [roleCatalog, allUsers]);

  const filtered = rows.filter((m) => q === "" || [m.name, m.shortName, m.owner, m.description].some((s) => s.toLowerCase().includes(q.toLowerCase())));
  const activeCount = rows.filter((m) => m.status === "Active").length;
  const totalRolesAssigned = rows.reduce((s, m) => s + m.roles.length, 0);

  const columns = [
    { key: "name", label: "Module", render: (m) => (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={m.icon} size={17} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{m.name}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted }}>{m.shortName}</div>
        </div>
      </div>) },
    { key: "description", label: "Description", render: (m) => <span style={{ color: C.textMuted, fontSize: 12.5, lineHeight: 1.45 }}>{m.description}</span> },
    { key: "owner", label: "Owner", nowrap: true, render: (m) => <Badge tone="neutral">{m.owner}</Badge> },
    { key: "roles", label: "Roles", align: "right", width: 92, render: (m) => <span style={{ fontWeight: 700, color: C.text }}>{m.roles.length}</span> },
    { key: "users", label: "Users", align: "right", width: 92, render: (m) => <span style={{ fontWeight: 700, color: C.text }}>{m.users.length}</span> },
    { key: "status", label: "Status", width: 110, render: (m) => <StatusBadge status={m.status} /> },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Super Admin" kickerIcon="crown" title={t("nav.modules")} subtitle={t("modules.desc")} compact />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="layout-grid" label="Total modules" value={rows.length} iconTone="brand" />
        <OpsStatCard icon="check-circle-2" label="Active" value={activeCount} sub={`${rows.length - activeCount} inactive`} iconTone="forest" />
        <OpsStatCard icon="shield" label="Roles assigned" value={totalRolesAssigned} sub="across all modules" iconTone="blue" />
      </OpsStatGrid>

      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 240 }}><TextInput iconLeft="search" placeholder="Search modules..." value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              {q && <Button variant="link" size="sm" iconLeft="x" onClick={() => setQ("")}>{t("act.clear")}</Button>}
            </>}
            right={<Badge tone="brand">{filtered.length} modules</Badge>} />
        </div>
        <DataTable columns={columns} data={filtered} dense rowKey="key" emptyTitle="No modules found" emptyDesc="Try a different search term." />
      </Card>
    </OpsPage>
  );
}

Object.assign(window, { Modules });
export { Modules };
