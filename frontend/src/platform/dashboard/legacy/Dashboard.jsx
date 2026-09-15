/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, Badge, Avatar, DetailCard, MetricCard } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDateTime, EmptyState, SegmentedControl, PageHeader } from "../../../shared/legacy/PrimitivesX.jsx";
import { useSession } from "../../session/legacy/Session.jsx";
import { useNotifications } from "../../notifications/legacy/Notifications.jsx";
/* Alamtri Geo Admin — Dashboard. All figures come from the backend metrics endpoint
   (/api/v1/dashboard/metrics): entity counts, users-by-role distribution, a 12-month audit
   activity trend, and recent audit events. No fabricated/demo data. */

function useWidth(ref) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  return w;
}

/* single-series area chart of monthly activity counts. data = [{ m, count }] */
function AreaChart({ data, height = 250 }) {
  const C = useC();
  const ref = React.useRef(null);
  const W = useWidth(ref);
  const [hi, setHi] = React.useState(null);
  const padL = 38, padR = 12, padT = 16, padB = 28;
  const innerW = Math.max(W - padL - padR, 10), innerH = height - padT - padB;
  const safe = data && data.length ? data : [{ m: "", count: 0 }];
  const max = Math.max(1, ...safe.map((d) => d.count)) * 1.12;
  const x = (i) => padL + (innerW * i) / Math.max(1, safe.length - 1);
  const y = (v) => padT + innerH - (innerH * v) / max;
  const line = safe.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(safe.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${padL},${(padT + innerH).toFixed(1)} Z`;
  const ticks = 4;
  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let idx = Math.round(((mx - padL) / innerW) * (safe.length - 1));
    idx = Math.max(0, Math.min(safe.length - 1, idx));
    setHi(idx);
  };
  const uid = "g" + (C.scheme === "dark" ? "d" : "l");
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height }} onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      {W > 0 && (
        <svg width={W} height={height} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.ocean} stopOpacity={C.scheme === "dark" ? 0.42 : 0.28} />
              <stop offset="100%" stopColor={C.ocean} stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: ticks + 1 }).map((_, i) => {
            const v = (max / ticks) * i, yy = y(v);
            return <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke={C.borderSoft} strokeWidth="1" />
              <text x={padL - 8} y={yy + 3.5} textAnchor="end" fontSize="10.5" fill={C.textSubtle} fontFamily="Plus Jakarta Sans">{Math.round(v)}</text>
            </g>;
          })}
          <path d={area} fill={`url(#${uid})`} />
          <path d={line} fill="none" stroke={C.ocean} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {safe.map((d, i) => <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10.5" fill={C.textSubtle} fontFamily="Plus Jakarta Sans">{d.m}</text>)}
          {hi != null && <>
            <line x1={x(hi)} y1={padT} x2={x(hi)} y2={padT + innerH} stroke={C.border} strokeWidth="1.5" />
            <circle cx={x(hi)} cy={y(safe[hi].count)} r="4.5" fill={C.surface} stroke={C.ocean} strokeWidth="2.5" />
          </>}
        </svg>
      )}
      {hi != null && (
        <div style={{ position: "absolute", left: Math.min(Math.max(x(hi) - 60, 4), W - 124), top: 4, width: 120, backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, boxShadow: C.shadowOverlay, padding: "8px 10px", pointerEvents: "none", ...FONT }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 4 }}>{safe[hi].m}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: C.ocean }} /> Events <b style={{ marginLeft: "auto", color: C.text }}>{safe[hi].count}</b></div>
        </div>
      )}
    </div>
  );
}

const _DIST_COLORS = ["ocean", "blue", "forest", "orange", "sage", "main"];
function RoleDistribution({ data }) {
  const C = useC();
  const rows = data || [];
  const total = rows.reduce((s, d) => s + d.value, 0) || 1;
  const col = (i) => { const k = _DIST_COLORS[i % _DIST_COLORS.length]; return ({ ocean: C.ocean, blue: C.blue, forest: C.forest, orange: C.orange, sage: C.sage, main: C.scheme === "dark" ? "#5C8B97" : C.main }[k] || C.ocean); };
  if (!rows.length) return <EmptyState icon="pie-chart" title="No role data" description="Assign roles to users to see the distribution." compact />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 2 }}>
        {rows.map((d, i) => <div key={d.label} style={{ width: `${(d.value / total) * 100}%`, backgroundColor: col(i) }} title={d.label} />)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 2 }}>
        {rows.map((d, i) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: col(i), flexShrink: 0 }} />
            <span style={{ color: C.text, fontWeight: 500, flex: 1 }}>{d.label}</span>
            <span style={{ color: C.textMuted }}>{d.value}</span>
            <span style={{ color: C.text, fontWeight: 700, width: 42, textAlign: "right" }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ onNavigate }) {
  const C = useC();
  const { t } = useI18n();
  const notif = useNotifications();
  const session = useSession();
  const [range, setRange] = React.useState("12m");
  const [metrics, setMetrics] = React.useState(null);
  const sevColor = { info: C.info, success: C.success, warning: C.warningText, danger: C.danger };

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/dashboard/metrics", { credentials: "include", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (!cancelled) setMetrics(m); })
      .catch(() => { if (!cancelled) setMetrics(null); });
    return () => { cancelled = true; };
  }, []);

  const m = metrics || {};
  const trend = Array.isArray(m.monthlyActivity) ? m.monthlyActivity.map((p) => ({ m: p.month, count: p.count })) : [];
  const activity = Array.isArray(m.recentActivity) ? m.recentActivity : [];
  const stats = [
    { label: "Total users", value: metrics ? String(m.usersCount) : "—", icon: "users-round", iconTone: "brand", route: "users" },
    { label: "Total roles", value: metrics ? String(m.rolesCount) : "—", icon: "shield-check", iconTone: "blue", route: "roles" },
    { label: "Total permissions", value: metrics ? String(m.permissionsCount) : "—", icon: "key-round", iconTone: "forest", route: "permissions" },
    { label: "Active languages", value: metrics ? String(m.languagesCount) : "—", icon: "languages", iconTone: "orange", route: "languages" },
    { label: "Unread notifications", value: String(notif.unread), hint: "priority", icon: "bell", iconTone: "danger", route: "notifications" },
    { label: "Audit events today", value: metrics ? String(m.auditToday) : "—", icon: "scroll-text", iconTone: "brand", route: "audit" },
  ];
  return (
    <div>
      <PageHeader title={`${t("dash.welcome")}, ${(session.actingUser.name || "").split(" ")[0]}`} description={t("dash.subtitle")}
        actions={<>
          <Button iconLeft="plus" onClick={() => onNavigate("users")}>{t("act.createUser")}</Button>
        </>} />

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
        {stats.map((s) => (
          <MetricCard
            key={s.label}
            label={s.label}
            value={s.value}
            hint={s.hint}
            icon={s.icon}
            iconTone={s.iconTone}
            onClick={() => onNavigate(s.route)}
          />
        ))}
      </div>

      {/* Chart + distribution */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, marginBottom: 18 }} className="ag-dash-row">
        <DetailCard title="Audit activity" subtitle="Audit events per month"
          action={<SegmentedControl size="sm" value={range} onChange={setRange} options={[{ value: "3m", label: "3M" }, { value: "6m", label: "6M" }, { value: "12m", label: "12M" }]} />}>
          <AreaChart data={range === "3m" ? trend.slice(-3) : range === "6m" ? trend.slice(-6) : trend} />
        </DetailCard>
        <DetailCard title="Users by role" subtitle={metrics ? `Distribution across ${m.usersCount} accounts` : "Distribution"}>
          <RoleDistribution data={m.roleDistribution} />
        </DetailCard>
      </div>

      {/* Activity + notifications */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }} className="ag-dash-row">
        <DetailCard title="Recent activity" pad={0}
          action={<Button variant="link" size="sm" iconRight="arrow-right" onClick={() => onNavigate("audit")}>View audit log</Button>}>
          <div>
            {activity.length === 0 && <div style={{ padding: "28px 20px" }}><EmptyState icon="scroll-text" title="No recent activity" description="Audit events will appear here as users work in the system." compact /></div>}
            {activity.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < activity.length - 1 ? `1px solid ${C.borderSoft}` : "none" }}>
                <Avatar name={a.user} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}><b style={{ fontWeight: 700 }}>{a.user}</b> {a.action} <b style={{ fontWeight: 600, color: C.ocean }}>{a.description}</b></div>
                  <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>{a.module} · {fmtAppDateTime(a.time)}</div>
                </div>
                <Badge tone={a.tone === "neutral" ? "neutral" : a.tone === "brand" ? "brand" : a.tone}>{a.module}</Badge>
              </div>
            ))}
          </div>
        </DetailCard>
        <DetailCard title="Notifications" subtitle={`${notif.unread} unread`}
          action={<Button variant="link" size="sm" disabled={!notif.unread} onClick={() => notif.markAllRead()}>Mark all read</Button>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {notif.items.slice(0, 5).map((n) => (
              <div key={n.id} onClick={() => notif.markRead(n.id)} style={{ display: "flex", gap: 11, padding: "10px 0", borderBottom: `1px solid ${C.borderSoft}`, cursor: "pointer" }}>
                <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: (sevColor[n.severity] || C.textSubtle) + "1f", color: sevColor[n.severity] || C.textSubtle }}>
                  <Icon name={n.severity === "danger" ? "shield-alert" : n.severity === "warning" ? "alert-triangle" : n.severity === "success" ? "check-circle-2" : "info"} size={15} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: C.text, fontWeight: n.read ? 500 : 600, lineHeight: 1.4 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{fmtAppDateTime(n.time)}</div>
                </div>
                {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: C.orange, marginTop: 6, flexShrink: 0 }} />}
              </div>
            ))}
            {notif.items.length === 0 && <div style={{ padding: "20px 4px" }}><EmptyState icon="bell" title="No notifications" description="You're all caught up." compact /></div>}
          </div>
        </DetailCard>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, AreaChart, RoleDistribution });
export { Dashboard, AreaChart, RoleDistribution };
