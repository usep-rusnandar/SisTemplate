/* fm2-converted */
import React from "react";
import { RADIUS, GRAD, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, Badge, Card, DetailCard, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDate, Alert, EmptyState, SegmentedControl, DataTable, PageHeader, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard } from "../../../shared/legacy/PrimitivesX.jsx";
import { setPermissionCatalog, getPermissionCatalog, permissionCatalogIsHydrated } from "../../data/legacy/Data.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
/* Alamtri Geo Admin — Permissions (grouped module view + flat table) and Placeholder for later-phase pages. */

function Permissions() {
  const C = useC();
  const { t } = useI18n();
  const ps = usePageSearch("Search permission key, name…");
  const q = ps.query, setQ = ps.setQuery;
  const [view, setView] = React.useState("grouped");
  // The catalog is whatever the backend actually has in iam.PERMISSION_T — this page used to render a
  // hardcoded list that drifted from it (it still showed the masterData.view/manage pair that C9 dropped).
  const [catalog, setCatalog] = React.useState(() => getPermissionCatalog());
  const [stale, setStale] = React.useState(!permissionCatalogIsHydrated());
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/super-admin/permissions", { credentials: "include", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`permissions ${r.status}`))))
      .then((data) => { if (!cancelled) { setCatalog(setPermissionCatalog(data)); setStale(false); } })
      .catch((e) => { if (!cancelled) { console.warn("Permission catalog unavailable; showing the built-in fallback.", e); setStale(true); } });
    return () => { cancelled = true; };
  }, []);
  const total = catalog.reduce((s, m) => s + m.perms.length, 0);

  const matches = (p) => q === "" || [p.key, p.name, p.desc].some((s) => (s || "").toLowerCase().includes(q.toLowerCase()));
  const groups = catalog.map((m) => ({ ...m, perms: m.perms.filter(matches) })).filter((m) => m.perms.length > 0);
  const flat = catalog.flatMap((m) => m.perms.filter(matches).map((p) => ({ ...p, module: m.module, icon: m.icon })));

  const flatCols = [
    { key: "key", label: "Permission key", sortable: false, nowrap: true, render: (p) => <span style={{ fontFamily: "monospace", fontSize: 12, color: C.ocean, fontWeight: 600 }}>{p.key}</span> },
    { key: "name", label: "Permission name", render: (p) => <span style={{ fontWeight: 600, color: C.text }}>{p.name}</span> },
    { key: "module", label: "Module", render: (p) => <Badge tone="neutral">{p.module}</Badge> },
    { key: "desc", label: "Description", render: (p) => <span style={{ color: C.textMuted, fontSize: 12.5 }}>{p.desc}</span> },
    { key: "createdAt", label: t("common.createdAt"), nowrap: true, render: (p) => <span style={{ color: C.textMuted, fontSize: 12.5 }}>{p.createdAt ? fmtAppDate(p.createdAt) : "—"}</span> },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Super Admin" kickerIcon="crown" title={t("nav.permissions")} subtitle={t("perms.desc")} compact
        right={<OpsHeroButton variant="secondary" iconLeft="download">{t("act.export")}</OpsHeroButton>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="key-round" label="Total permissions" value={total} iconTone="brand" />
        <OpsStatCard icon="layout-grid" label="Modules" value={catalog.length} iconTone="blue" />
        <OpsStatCard icon="layout-list" label="Grouped view" value={groups.length} sub={q ? "matching search" : "all modules"} iconTone="forest" />
      </OpsStatGrid>
      {stale && <Alert tone="warning" title="Showing the built-in fallback catalog" description="The permission catalog could not be read from the backend, so this list may not match what the API actually enforces." style={{ marginBottom: 14 }} />}

      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 240 }}><TextInput iconLeft="search" placeholder="Search permission key, name…" value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              {q && <Button variant="link" size="sm" iconLeft="x" onClick={() => setQ("")}>{t("act.clear")}</Button>}
            </>}
            right={<SegmentedControl value={view} onChange={setView} options={[{ value: "grouped", label: "Grouped", icon: "layout-list" }, { value: "table", label: "Table", icon: "table" }]} />} />
        </div>

        {view === "grouped" ? (
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
            {groups.map((mod) => (
              <DetailCard key={mod.module} pad={0}
                title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={mod.icon} size={15} /></span>
                  {mod.module}</span>}
                action={<Badge tone="neutral">{mod.perms.length}</Badge>}>
                <div>
                  {mod.perms.map((p, i) => (
                    <div key={p.key} style={{ padding: "12px 20px", borderBottom: i < mod.perms.length - 1 ? `1px solid ${C.borderSoft}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.name}</span>
                        <span style={{ fontFamily: "monospace", fontSize: 11.5, color: C.ocean, fontWeight: 600, backgroundColor: C.brandBg, padding: "2px 7px", borderRadius: RADIUS.sm }}>{p.key}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, lineHeight: 1.45 }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </DetailCard>
            ))}
            {groups.length === 0 && <div style={{ gridColumn: "1 / -1" }}><EmptyState icon="search-x" title="No permissions found" description="Try a different search term." /></div>}
          </div>
        ) : (
          <DataTable columns={flatCols} data={flat} dense rowKey="key" emptyTitle="No permissions found" />
        )}
      </Card>
    </OpsPage>
  );
}

function Placeholder({ route, onNavigate }) {
  const C = useC();
  const meta = {
    menus: { icon: "list", title: "Menus", desc: "Configure the application's navigation menu structure and visibility per role." },
    languages: { icon: "languages", title: "Languages", desc: "Manage available languages, defaults, and enablement." },
    languageText: { icon: "globe", title: "Language Text", desc: "Edit translation strings across the platform's locales." },
    emailTemplates: { icon: "mail", title: "Email Templates", desc: "Author and manage transactional email templates." },
    cmEmailTemplates: { icon: "mail", title: "Email Templates", desc: "Author and manage Contract Monitoring reminder email templates." },
    emailSent: { icon: "send", title: "Email Sent", desc: "Review the outbound email delivery log and statuses." },
    settings: { icon: "sliders-horizontal", title: "Settings", desc: "System, security, and notification configuration." },
    audit: { icon: "scroll-text", title: "Audit Log", desc: "A complete, filterable trail of every system action." },
    notifications: { icon: "bell", title: "Notifications", desc: "Manage notification messages, severity, and read status." },
    profile: { icon: "user", title: "Profile", desc: "Your account profile and preferences." },
    changePassword: { icon: "key-round", title: "Change Password", desc: "Update your account password." },
    changeImage: { icon: "image", title: "Change Image", desc: "Update your profile picture." },
  }[route] || { icon: "construction", title: "Module", desc: "This module is part of the next build phase." };
  return (
    <div>
      <PageHeader title={meta.title} description={meta.desc} breadcrumb={[{ label: "Alamtri Geo" }, { label: meta.title }]} />
      <Card>
        <div style={{ textAlign: "center", padding: "44px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ width: 64, height: 64, borderRadius: RADIUS.xl, background: GRAD.horizon, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}><Icon name={meta.icon} size={30} /></span>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{meta.title}</div>
          <div style={{ fontSize: 13.5, color: C.textMuted, maxWidth: 420, lineHeight: 1.55 }}>{meta.desc}</div>
          <Badge tone="orange" size="md">Planned for next build phase</Badge>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <Button variant="secondary" iconLeft="arrow-left" onClick={() => onNavigate("dashboard")}>Back to dashboard</Button>
            <Button iconLeft="check-circle-2" onClick={() => onNavigate("users")}>Explore core screens</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { Permissions, Placeholder });
export { Permissions, Placeholder };
