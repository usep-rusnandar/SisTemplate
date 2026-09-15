/* fm3-converted */
import React from "react";
import { ContractMaterialListModal, cmFmtMaterialWhen, cmMatApi, cmParseMaterialFile } from "./ContractMaterial.jsx";
import { CM_CLASSES, CM_CONTRACTS, CM_FREQUENCIES, CM_JOBSITES, CM_PICS, CM_REMINDERS, CM_STATUS, CM_SUBCLASS, CM_TEMPLATES, CM_TODAY, cmAccessForSession, cmDateFromToday, cmDaysToExpiry, cmGroups, cmLoadContracts, cmReloadContracts, cmSaveContracts } from "./ContractMonData.jsx";
import { TrkStatCard } from "../../../shared/legacy/TrkStatCard.jsx";
import { trkFmtDate, trkRp, trkRpM, trkText } from "../../proposal-tracker/legacy/TrackerData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Avatar, Badge, Button, Card, DetailCard, Field, Icon, Select, TableRefreshButton, TextInput, Textarea } from "../../../shared/legacy/Primitives.jsx";
import { DataTable, Modal, PageHeader, Pagination, Spinner, Toolbar, Tooltip, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Contract Monitoring module.
   Database Monitoring Contract Application (per BRD V3): digital contract registry
   with status/expiry monitoring, amendment version history, search/tracking, a
   monitoring dashboard, and expiry reminders (<6mo / <4mo / <2mo / <30d). */

/* ---------- helpers ---------- */
function cmAddDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function cmRowsForSession(session, rows = cmLoadContracts()) {
  const access = cmAccessForSession(session);
  if (access.ownOnly) return rows.filter((r) => String(r.picEmail || "").toLowerCase() === String(session.actingUser.email || "").toLowerCase());
  return rows;
}
function cmGroupsForSession(session, rows = cmLoadContracts()) {
  return cmGroups(cmRowsForSession(session, rows));
}

function cmStatusBadge(status, lang) { const s = CM_STATUS[status] || CM_STATUS.Active; return <Badge tone={s.tone} dot>{lang === "id" ? s.id : s.en}</Badge>; }

function cmCountdownChip(days, lang) {
  const C = useC();
  if (days == null) return <span style={{ color: C.textSubtle }}>—</span>;
  if (days < 0) return <Badge tone="danger">{lang === "id" ? "Berakhir" : "Expired"} {Math.abs(days)}{lang === "id" ? " hr lalu" : "d ago"}</Badge>;
  const b = CM_REMINDERS.find((r) => days <= r.maxDays);
  const tone = b ? b.tone : "success";
  const label = days >= 365 ? `${(days / 365).toFixed(1)} ${lang === "id" ? "thn" : "yr"}` : `${days} ${lang === "id" ? "hr" : "d"}`;
  return <Badge tone={tone}>{label}</Badge>;
}

function cmReminderBucket(days) {
  if (days == null || days < 0 || days > 180) return null;
  return CM_REMINDERS.find((r) => days <= r.maxDays) || null;
}

function cmCountdownLevel(days, lang) {
  if (days == null) return { label: "—", tone: "neutral" };
  if (days < 0) return { label: lang === "id" ? "Lewat jatuh tempo" : "Past due", tone: "danger" };
  if (days <= 30) return { label: lang === "id" ? "< 30 hari (Kritis)" : "< 30 days (Critical)", tone: "danger" };
  if (days <= 60) return { label: lang === "id" ? "< 2 bulan (Tinggi)" : "< 2 months (High)", tone: "orange" };
  if (days <= 120) return { label: lang === "id" ? "< 4 bulan (Sedang)" : "< 4 months (Medium)", tone: "warning" };
  if (days <= 180) return { label: lang === "id" ? "< 6 bulan (Awal)" : "< 6 months (Early)", tone: "info" };
  return { label: lang === "id" ? "> 6 bulan (Existing)" : "> 6 months (Existing)", tone: "success" };
}

function cmCountdownCell(days, lang) {
  const C = useC();
  const level = cmCountdownLevel(days, lang);
  const toneColor = { danger: C.danger, orange: C.orange, warning: C.warningText, info: C.info, success: C.success, neutral: C.textMuted }[level.tone] || C.textMuted;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", minWidth: 0 }}>
      {cmCountdownChip(days, lang)}
      <span style={{ fontSize: 11, lineHeight: 1.25, color: toneColor, fontWeight: 700, whiteSpace: "nowrap" }}>{level.label}</span>
    </div>
  );
}

/* ---- reminder send pipeline (manual button + simulated daily scan) ----
   One path for both triggers, idempotent per (contractId, tier) — mirrors the
   production design. Production note: the daily scan is a Hangfire recurring job;
   the "Run daily scan" button here simulates it. Escalation CCs the Section Head
   when < 30 days remain. Sent reminders are recorded server-side (SmtpEmailSender →
   core.EMAIL_SENT_T) and surface in Reminder Sent / Email Sent from the backend. */
const CM_REMINDER_STORE_KEY = "ag_cm_reminders_v1";
const CM_SECTION_HEAD = { name: "Sari Indah", email: "sari.indah@saptaindra.co.id" };
function cmLoadReminders() { try { const s = window.__procurementStorage.getItem(CM_REMINDER_STORE_KEY); if (s) return JSON.parse(s); } catch (e) {} return []; }
function cmSaveReminders(list) { try { window.__procurementStorage.setItem(CM_REMINDER_STORE_KEY, JSON.stringify(list)); } catch (e) {} }
function cmDomainPost(path, body) {
  try {
    fetch(path, {
      method: "POST",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch((e) => console.warn("Contract Monitoring domain API command failed.", e));
  } catch (e) {}
}
function cmReminderSentFor(contractId, tierKey) { return cmLoadReminders().some((r) => r.contractId === contractId && r.tier === tierKey); }
function cmReminderRecord(contractId, tierKey) { return cmLoadReminders().find((r) => r.contractId === contractId && r.tier === tierKey) || null; }

/* Send the reminder for a contract's CURRENT tier. force=true allows manual re-send.
   The backend sends + records the email to core.EMAIL_SENT_T (category "Contract Monitoring") via a
   body-based endpoint (contract details in the body — robust to "/"-laden contract numbers and to
   contracts not in the domain), so every reminder shows up on the Reminder Sent page. Awaits the
   real result and only marks the local "sent" badge when the backend accepted it. */
async function cmSendReminder(g, trigger, force) {
  const bucket = cmReminderBucket(g.days);
  if (!bucket) return { sent: false, reason: "not-due" };
  if (!force && cmReminderSentFor(g.contractId, bucket.key)) return { sent: false, reason: "already" };
  const escalated = g.days <= 30;
  const payload = {
    contractNo: g.contractId, title: g.title, supplier: g.supplier, jobsite: g.jobsite,
    picNames: g.picNames || "", picEmail: g.picEmail || "",
    expiryDate: g.currentExpiry, daysToExpiry: g.days, tier: bucket.key, trigger, escalated,
  };
  try {
    const res = await fetch("/api/v1/contract-monitoring/reminders/send-email", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { sent: false, reason: "error", error: (data && (data.message || data.code)) || `HTTP ${res.status}` };
    }
    cmSaveReminders([{ contractId: g.contractId, tier: bucket.key, sentAt: `${CM_TODAY} 07:00`, trigger, days: g.days, escalated }, ...cmLoadReminders()]);
    return { sent: true, tier: bucket.key, escalated, delivered: !!(data && data.delivered) };
  } catch (e) {
    return { sent: false, reason: "error", error: (e && e.message) || "network error" };
  }
}

/* Manual "daily scan": send every due, not-yet-sent current-tier reminder for the contracts in view. */
async function cmRunDailyScan(groups) {
  let sent = 0, escalated = 0, skipped = 0, failed = 0;
  for (const g of groups.filter((x) => x.status === "Expiring")) {
    const r = await cmSendReminder(g, "Scheduled", false);
    if (r.sent) { sent += 1; if (r.escalated) escalated += 1; }
    else if (r.reason === "already") skipped += 1;
    else if (r.reason === "error") failed += 1;
  }
  return { sent, escalated, skipped, failed };
}

function CmDonut({ segments, total }) {
  const C = useC();
  const size = 176;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const safeTotal = Math.max(0, total || 0);
  const visible = (segments || []).filter((s) => s.value > 0);
  return (
    <div style={{ width: size, height: size, position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.surfaceAlt} strokeWidth={stroke} />
        {visible.map((s) => {
          const pct = safeTotal ? s.value / safeTotal : 0;
          const dash = pct * circumference;
          const node = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return node;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: 0, lineHeight: 1 }}>{safeTotal}</div>
        <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 700, marginTop: 3 }}>Contracts</div>
      </div>
    </div>
  );
}

/* =================== DASHBOARD =================== */
function ContractMonDashboard({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const access = cmAccessForSession(session);
  const rows = React.useMemo(() => cmRowsForSession(session), [session.actingUser.email, session.effectiveRole]);
  const allGroups = React.useMemo(() => cmGroups(rows), [rows]);

  // Period + jobsite filters. The period (year/month) filters the WHOLE dashboard by the contract
  // effective date (falling back to contract date). The jobsite selector narrows only the value card.
  const [yearF, setYearF] = React.useState("all");
  const [monthF, setMonthF] = React.useState("all");
  const [siteF, setSiteF] = React.useState("all");
  const cmPeriodDate = (g) => g.effectiveDate || g.contractDate || "";
  const CM_MONTHS = lang === "id"
    ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const yearOptions = React.useMemo(() => {
    const ys = Array.from(new Set(allGroups.map((g) => cmPeriodDate(g).slice(0, 4)).filter(Boolean))).sort().reverse();
    return [{ value: "all", label: tt("All years", "Semua tahun") }, ...ys.map((y) => ({ value: y, label: y }))];
  }, [allGroups, lang]);
  const monthOptions = [{ value: "all", label: tt("All months", "Semua bulan") },
    ...CM_MONTHS.map((nm, i) => ({ value: String(i + 1).padStart(2, "0"), label: nm }))];

  const groups = React.useMemo(() => allGroups.filter((g) => {
    const d = cmPeriodDate(g);
    if (yearF !== "all" && d.slice(0, 4) !== yearF) return false;
    if (monthF !== "all" && d.slice(5, 7) !== monthF) return false;
    return true;
  }), [allGroups, yearF, monthF]);

  const total = groups.length;
  const totalDocs = groups.reduce((s, g) => s + (g.versions ? g.versions.length : 1), 0);
  const active = groups.filter((g) => g.status === "Active").length;   // "Active" status = Existing (> 6mo)
  const expiring = groups.filter((g) => g.status === "Expiring").length; // Active but expiring within 6mo
  const expired = groups.filter((g) => g.status === "Expired").length;
  const totalValue = groups.reduce((s, g) => s + g.value, 0);

  // status donut — the "Active" status is the Existing (> 6mo) bucket; label it Existing to match the KPI cards.
  const statusColors = { Active: C.success, Expiring: C.warningText, Expired: C.danger };
  const statusSeg = ["Active", "Expiring", "Expired"].map((k) => ({ key: k, value: groups.filter((g) => g.status === k).length, color: statusColors[k], label: k === "Active" ? tt("Existing", "Existing") : trkText(lang, CM_STATUS[k]) })).filter((s) => s.value > 0);

  // by jobsite value — narrowed by the jobsite selector on the card header.
  const siteOptions = React.useMemo(() => {
    const sites = Array.from(new Set(groups.map((g) => g.jobsite).filter(Boolean))).sort();
    return [{ value: "all", label: tt("All jobsites", "Semua jobsite") }, ...sites.map((s) => ({ value: s, label: s }))];
  }, [groups, lang]);
  const siteMap = {};
  groups.filter((g) => siteF === "all" || g.jobsite === siteF).forEach((g) => { siteMap[g.jobsite] = (siteMap[g.jobsite] || 0) + g.value; });
  const bySite = Object.entries(siteMap).map(([site, value]) => ({ site, value })).sort((a, b) => b.value - a.value);
  const siteMax = Math.max(1, ...bySite.map((s) => s.value));

  // by classification count
  const clsMap = {};
  groups.forEach((g) => { clsMap[g.classification] = (clsMap[g.classification] || 0) + 1; });
  const byClass = Object.entries(clsMap).map(([cls, n]) => ({ cls, n })).sort((a, b) => b.n - a.n);

  // expiry buckets
  const buckets = CM_REMINDERS.map((r) => ({ ...r, items: [] }));
  const onTrack = [];
  groups.filter((g) => g.status !== "Expired").forEach((g) => {
    const b = CM_REMINDERS.find((r) => g.days <= r.maxDays);
    if (b) buckets.find((x) => x.key === b.key).items.push(g); else onTrack.push(g);
  });
  const soonest = [...groups].filter((g) => g.status !== "Expired").sort((a, b) => a.days - b.days).slice(0, 5);
  const bColor = { danger: C.danger, orange: C.orange, yellow: C.yellow, blue: C.blue };

  return (
    <div>
      <PageHeader title={tt("Contract Dashboard", "Dasbor Kontrak")} description={tt("Real-time overview of procurement contracts, value, and expiry.", "Ringkasan real-time kontrak pengadaan, nilai, dan masa berlaku.")}
        actions={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textMuted }}><Badge tone={access.canWrite ? "brand" : "neutral"}>{access.label}</Badge>{tt("As of", "Per")}: <b style={{ color: C.text }}>{trkFmtDate(CM_TODAY, lang)}</b></span>} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }} className="ag-cm-period-filter">
        <span style={{ ...FONT, fontSize: 12, fontWeight: 600, color: C.textMuted }}>{tt("Period", "Periode")}:</span>
        <div style={{ width: 150 }}><Select value={yearF} onChange={(e) => setYearF(e.target.value)} options={yearOptions} /></div>
        <div style={{ width: 150 }}><Select value={monthF} onChange={(e) => setMonthF(e.target.value)} options={monthOptions} /></div>
        {(yearF !== "all" || monthF !== "all") && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setYearF("all"); setMonthF("all"); }}>{tt("Clear", "Bersihkan")}</Button>}
        <span style={{ ...FONT, fontSize: 11.5, color: C.textSubtle }}>{tt("Filters the whole dashboard by contract effective date.", "Memfilter seluruh dashboard berdasarkan tanggal efektif kontrak.")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) minmax(260px, 1.55fr)", gap: 12, marginBottom: 16 }} className="ag-trk-kpis">
        <TrkStatCard icon="file-text" tone="brand" label={tt("Total contracts", "Total kontrak")} value={total} sub={`${totalDocs} ${tt("documents", "dokumen")}`} />
        <TrkStatCard icon="circle-check" tone="forest" label={tt("Existing", "Existing")} value={active} sub={tt("> 6 months", "> 6 bulan")} />
        <TrkStatCard icon="alarm-clock" tone="orange" label={tt("Expiring", "Akan berakhir")} value={expiring} sub={tt("< 6 months · need attention", "< 6 bulan · perlu perhatian")} />
        <TrkStatCard icon="circle-x" tone="danger" label={tt("Expired", "Berakhir")} value={expired} sub={tt("ended", "selesai")} />
        <TrkStatCard icon="banknote" tone="blue" label={tt("Total value", "Total nilai")} value={trkRpM(totalValue, lang)}
          valueTitle={trkRp(totalValue)} valueStyle={{ fontSize: 22, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: -0.25 }}
          sub={tt("contract value", "nilai kontrak")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 16, marginBottom: 16 }} className="ag-trk-row3">
        <DetailCard title={tt("Contracts by status", "Kontrak per status")}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <CmDonut segments={statusSeg} total={statusSeg.reduce((s, x) => s + x.value, 0)} />
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 7 }}>
              {statusSeg.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: s.color }} />
                  <span style={{ flex: 1, color: C.text, fontWeight: 500 }}>{s.label}</span>
                  <span style={{ color: C.text, fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </DetailCard>

        <DetailCard title={tt("Value by jobsite", "Nilai per jobsite")}
          action={<div style={{ width: 150 }}><Select value={siteF} onChange={(e) => setSiteF(e.target.value)} options={siteOptions} /></div>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bySite.length === 0 && <div style={{ ...FONT, fontSize: 12, color: C.textSubtle, padding: "8px 0" }}>{tt("No contracts for this filter.", "Tidak ada kontrak untuk filter ini.")}</div>}
            {bySite.map((s) => (
              <div key={s.site}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>{s.site}</span>
                  <span style={{ color: C.textMuted }}>{trkRpM(s.value, lang)}</span>
                </div>
                <div style={{ height: 9, borderRadius: 999, backgroundColor: C.surfaceAlt, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(6, (s.value / siteMax) * 100)}%`, height: "100%", borderRadius: 999, backgroundColor: C.ocean }} />
                </div>
              </div>
            ))}
          </div>
        </DetailCard>

        <DetailCard title={tt("Expiry reminders", "Pengingat masa berlaku")}
          action={<Button variant="link" size="sm" iconRight="arrow-right" onClick={() => onNavigate("cmExpiry")}>{tt("View", "Lihat")}</Button>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {buckets.map((b) => (
              <div key={b.key} style={{ padding: "11px 13px", borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: bColor[b.color] }} />
                  <span style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 600 }}>{lang === "id" ? b.id : b.en}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: b.items.length ? C.text : C.textSubtle, marginTop: 4 }}>{b.items.length}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textSubtle, marginBottom: 8 }}>{tt("Nearest to expire", "Paling dekat berakhir")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {soonest.map((g) => (
              <div key={g.contractId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.supplier}</div>
                  <div style={{ fontSize: 11, color: C.textSubtle }}>{trkFmtDate(g.currentExpiry, lang)}</div>
                </div>
                {cmCountdownChip(g.days, lang)}
              </div>
            ))}
          </div>
        </DetailCard>
      </div>

      <DetailCard title={tt("Contracts by classification", "Kontrak per klasifikasi")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {byClass.map((c) => (
            <div key={c.cls} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 13px", borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt }}>
              <Icon name="folder" size={15} color={C.ocean} />
              <span style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{c.cls}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.ocean }}>{c.n}</span>
            </div>
          ))}
        </div>
      </DetailCard>
    </div>
  );
}

/* =================== CONTRACT DATABASE (list + detail) =================== */
function ContractDatabase({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const access = cmAccessForSession(session);
  const [rows, setRows] = React.useState(() => cmLoadContracts());
  const [refreshing, setRefreshing] = React.useState(false);
  const persistRows = React.useCallback((producer) => {
    setRows((current) => {
      const next = producer(current);
      cmSaveContracts(next);
      return next;
    });
    const storage = typeof window !== "undefined" ? window.__procurementStorage : null;
    if (storage && typeof storage.flushPendingWrites === "function") {
      void storage.flushPendingWrites();
    }
  }, []);
  const reloadRows = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setRows(await cmReloadContracts());
    } finally {
      setRefreshing(false);
    }
  }, []);
  const visibleRows = React.useMemo(() => cmRowsForSession(session, rows), [rows, session.actingUser.email, session.effectiveRole]);
  const groups = React.useMemo(() => cmGroups(visibleRows), [visibleRows]);
  const [detail, setDetail] = React.useState(null);
  const [form, setForm] = React.useState({ open: false, mode: "create", contract: null });
  const [statusF, setStatusF] = React.useState("all");
  const [normalOnlyF, setNormalOnlyF] = React.useState(false);
  const [expirySoonF, setExpirySoonF] = React.useState(false);
  const [reminderBucketKeys, setReminderBucketKeys] = React.useState([]);
  const [siteF, setSiteF] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const ps = usePageSearch(tt("Search contract…", "Cari kontrak…"));
  const q = ps.query, setQ = ps.setQuery;
  // Re-read the register KV so CIP→CM handoffs appear. Do not call full hydrate() —
  // that wipes module permissions and lets a stale frontend-state copy of
  // ag_cm_contracts_v1 overwrite the domain store (empty Contract Database after refresh).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await cmReloadContracts();
        if (!cancelled) setRows(next);
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, []);
  React.useEffect(() => { setPage(1); }, [statusF, normalOnlyF, expirySoonF, reminderBucketKeys.join(","), siteF, q]);
  React.useEffect(() => {
    if (statusF !== "active") {
      setNormalOnlyF(false);
      setExpirySoonF(false);
      setReminderBucketKeys([]);
    }
  }, [statusF]);
  React.useEffect(() => {
    if (!expirySoonF) setReminderBucketKeys([]);
  }, [expirySoonF]);

  const reminderOptions = React.useMemo(() => [...CM_REMINDERS].sort((a, b) => b.maxDays - a.maxDays), []);
  const siteScopedGroups = groups.filter((g) => siteF === "all" || g.jobsite === siteF);
  const activeScope = siteScopedGroups.filter((g) => g.status !== "Expired");
  const bucketCounts = Object.fromEntries(reminderOptions.map((b) => [b.key, activeScope.filter((g) => (cmReminderBucket(g.days) || {}).key === b.key).length]));
  const counts = {
    all: siteScopedGroups.length,
    active: activeScope.length,
    expired: siteScopedGroups.filter((g) => g.status === "Expired").length,
    normal: activeScope.filter((g) => !cmReminderBucket(g.days)).length,
    expiringSoon: activeScope.filter((g) => !!cmReminderBucket(g.days)).length,
  };

  const filtered = siteScopedGroups.filter((g) => {
      if (statusF === "expired") return g.status === "Expired";
      if (statusF === "active") return g.status !== "Expired";
      return true;
    })
    .filter((g) => {
      if (statusF !== "active") return true;
      const bucket = cmReminderBucket(g.days);
      if (normalOnlyF) return !bucket;
      if (!expirySoonF) return true;
      if (!bucket) return false;
      return reminderBucketKeys.length === 0 || reminderBucketKeys.includes(bucket.key);
    })
    .filter((g) => { const qq = q.trim().toLowerCase(); return !qq || g.contractId.toLowerCase().includes(qq) || g.title.toLowerCase().includes(qq) || g.supplier.toLowerCase().includes(qq) || (g.userDept || "").toLowerCase().includes(qq); });
  const ordered = [...filtered].sort((a, b) => (b.days ?? -999999) - (a.days ?? -999999));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = ordered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = q || statusF !== "all" || normalOnlyF || expirySoonF || reminderBucketKeys.length > 0 || siteF !== "all";

  const columns = [
    { key: "contractId", label: tt("Contract", "Kontrak"), width: 500, render: (g) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar name={g.supplier.replace(/^PT\s+/, "")} size={30} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 700, color: C.ocean }}>{g.contractId}</span>
            {g.versions.length > 1 && <Badge tone="neutral" size="sm">{g.versions[g.versions.length - 1].type}</Badge>}
          </div>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 11.5, marginTop: 3, lineHeight: 1.35, whiteSpace: "normal", overflowWrap: "anywhere" }}>{g.title}</div>
          <div style={{ fontSize: 11, color: C.textSubtle, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.supplier} · {g.jobsite} · <span style={{ fontWeight: 700, color: C.text }}>{trkRp(g.value)}</span></div>
        </div>
      </div>) },
    { key: "classification", label: tt("Classification", "Klasifikasi"), width: 170, render: (g) => (
      <div><div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{g.classification}</div><div style={{ fontSize: 11, color: C.textSubtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.subClass}</div></div>) },
    { key: "currentExpiry", label: tt("Expires", "Berakhir"), width: 112, render: (g) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        <span style={{ fontSize: 12.5, color: C.text }}>{trkFmtDate(g.currentExpiry, lang)}</span>
        {cmStatusBadge(g.status, lang)}
      </div>) },
    { key: "days", label: tt("Countdown", "Hitung mundur"), width: 150, render: (g) => cmCountdownCell(g.days, lang) },
  ];

  const toggleBucket = (key) => {
    setReminderBucketKeys((keys) => keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
  };
  const countBubble = (n, toneColor) => (
    <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, backgroundColor: toneColor, color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: C.scheme === "dark" ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 2px rgba(1,59,82,0.10)" }}>{n}</span>
  );
  const filterChip = (key, label, n, tone) => {
    const act = reminderBucketKeys.includes(key);
    const toneColor = { danger: C.danger, orange: C.orange, warning: C.warningText, info: C.info }[tone] || C.ocean;
    return <button key={key} onClick={() => toggleBucket(key)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 400, border: `1px solid ${act ? toneColor : C.border}`, backgroundColor: act ? (tone === "danger" ? C.dangerBg : tone === "orange" ? (C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)") : tone === "warning" ? C.warningBg : C.infoBg) : C.surface, color: act ? toneColor : C.textMuted }}>
      {act && <Icon name="check" size={12} />}
      {label}{countBubble(n, toneColor)}
    </button>;
  };
  const statusChip = (key, label, n, toneColor, bg) => {
    const act = statusF === key;
    return <button key={key} onClick={() => { setStatusF(key); setNormalOnlyF(false); setExpirySoonF(false); setReminderBucketKeys([]); }} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 400, border: `1px solid ${act ? toneColor : C.border}`, backgroundColor: act ? bg : C.surface, color: act ? toneColor : C.textMuted }}>
      {act && <Icon name="check" size={13} />}
      {label}{countBubble(n, toneColor)}
    </button>;
  };

  return (
    <div>
      <PageHeader title={tt("Contract Database", "Database Kontrak")} description={tt("Central registry of procurement contracts with amendment history and document links.", "Registri terpusat kontrak pengadaan dengan riwayat amandemen dan tautan dokumen.")}
        actions={!access.canWrite ? <Badge tone="neutral">{tt("View Only", "Lihat saja")}</Badge> : null} />

      <Card pad={0}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 250 }}><TextInput iconLeft="search" placeholder={tt("Contract no, title, supplier…", "No kontrak, judul, pemasok…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {statusChip("all", tt("All", "Semua"), counts.all, C.ocean, C.brandBg)}
                {statusChip("active", tt("Active", "Aktif"), counts.active, C.success, C.successBg)}
                {statusChip("expired", tt("Expired", "Berakhir"), counts.expired, C.danger, C.dangerBg)}
              </div>
              <div style={{ width: 140 }}><Select value={siteF} onChange={(e) => setSiteF(e.target.value)} options={[{ value: "all", label: tt("All jobsites", "Semua jobsite") }, ...CM_JOBSITES.map((j) => ({ value: j, label: j }))]} /></div>
              {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setStatusF("all"); setNormalOnlyF(false); setExpirySoonF(false); setReminderBucketKeys([]); setSiteF("all"); }}>{tt("Clear", "Bersihkan")}</Button>}
            </>}
            right={<TableRefreshButton onClick={reloadRows} disabled={refreshing} title={tt("Refresh contracts", "Muat ulang kontrak")} />} />
          {statusF === "active" && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { setNormalOnlyF((v) => !v); setExpirySoonF(false); setReminderBucketKeys([]); }} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 400, border: `1px solid ${normalOnlyF ? C.success : C.border}`, backgroundColor: normalOnlyF ? C.successBg : C.surface, color: normalOnlyF ? C.success : C.textMuted }}>
                  {normalOnlyF ? <Icon name="check-circle-2" size={14} /> : <Icon name="circle" size={14} />}
                  {tt("Existing", "Existing")} {countBubble(counts.normal, C.success)}
                </button>
                <button onClick={() => { setExpirySoonF((v) => !v); setNormalOnlyF(false); }} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 400, border: `1px solid ${expirySoonF ? C.warningText : C.border}`, backgroundColor: expirySoonF ? C.warningBg : C.surface, color: expirySoonF ? C.warningText : C.textMuted }}>
                  {expirySoonF ? <Icon name="check-circle-2" size={14} /> : <Icon name="circle" size={14} />}
                  {tt("Expiring", "Akan Berakhir")} {countBubble(counts.expiringSoon, C.warningText)}
                </button>
                {!expirySoonF && !normalOnlyF && <span style={{ fontSize: 12, color: C.textSubtle }}>{tt("Select Existing or Expiring to narrow active contracts.", "Pilih Existing atau Akan Berakhir untuk mempersempit kontrak aktif.")}</span>}
              {expirySoonF && (
                <>
                  <span style={{ marginLeft: 16, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textSubtle }}>{tt("Reminder level", "Level pengingat")}</span>
                  {reminderOptions.map((b) => filterChip(b.key, trkText(lang, b), bucketCounts[b.key] || 0, b.tone))}
                </>
              )}
            </div>
          )}
        </div>
        <DataTable columns={columns} data={pageRows} dense rowKey="contractId" onRowClick={(g) => setDetail(g)}
          emptyTitle={tt("No contracts found", "Tidak ada kontrak")} emptyDesc={tt("Adjust the filters to see more.", "Sesuaikan filter untuk melihat lebih banyak.")} />
        <div style={{ padding: "4px 16px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} /></div>
      </Card>

      <ContractDetail group={detail} onClose={() => setDetail(null)} lang={lang} tt={tt} canWrite={access.canWrite} canSend={access.canWrite}
        onEdit={(g) => { setDetail(null); setForm({ open: true, mode: "edit", contract: g }); }} />
      <ContractFormModal open={form.open} mode={form.mode} group={form.contract} tt={tt} lang={lang}
        onClose={() => setForm({ open: false, mode: "create", contract: null })}
        onSave={(contract) => {
          if (form.mode === "edit") {
            persistRows((rs) => rs.map((r) => r.contractId === contract.contractId ? { ...r, ...contract } : r));
          } else {
            const id = (rows.length ? Math.max(...rows.map((r) => r.idx)) : 0) + 1;
            persistRows((rs) => [{ ...contract, idx: id, type: "MAIN CONTRACT", status: "Active", systemNos: contract.systemNos || [], link: contract.link || "" }, ...rs]);
          }
          setForm({ open: false, mode: "create", contract: null });
        }} />
    </div>
  );
}

function ContractDetail({ group: g, onClose, lang, tt, canWrite, canSend, onSent, onEdit }) {
  const C = useC();
  const toast = useToast();
  const [, forceUpd] = React.useReducer((x) => x + 1, 0);
  const [previewDoc, setPreviewDoc] = React.useState(null);
  const [matOpen, setMatOpen] = React.useState(false);
  const [matSummary, setMatSummary] = React.useState(null);
  const [matUploading, setMatUploading] = React.useState(false);
  const matFileRef = React.useRef(null);

  const refreshMatSummary = React.useCallback(async () => {
    if (!g || !g.contractId) return;
    try {
      const s = await cmMatApi(`/materials/summary?contractKey=${encodeURIComponent(g.contractId)}`);
      setMatSummary(s);
    } catch (_) {
      setMatSummary({ contractKey: g.contractId, totalCount: 0 });
    }
  }, [g && g.contractId]);

  React.useEffect(() => { refreshMatSummary(); }, [refreshMatSummary]);

  if (!g) return null;
  const curBucket = cmReminderBucket(g.days);
  const curSent = curBucket && cmReminderSentFor(g.contractId, curBucket.key);
  const doSend = async () => {
    const r = await cmSendReminder(g, "Manual", true);
    forceUpd();
    if (r.sent) {
      const extra = `${r.escalated ? ` · +${CM_SECTION_HEAD.name}` : ""}${r.delivered ? "" : tt(" · recorded (relay unreachable)", " · tercatat (relay tak terjangkau)")}`;
      toast.push({ title: tt("Reminder sent", "Reminder terkirim"), description: `${g.supplier}${extra}` });
      onSent && onSent();
    } else {
      toast.push({ tone: "error", title: tt("Reminder failed", "Reminder gagal"), description: r.error || r.reason || "" });
    }
  };
  const uploadMaterial = async (file) => {
    if (!file) return;
    setMatUploading(true);
    try {
      const rows = await cmParseMaterialFile(file);
      if (!rows.length) throw new Error(tt("No material rows in the file.", "Tidak ada baris material di file."));
      const mismatched = rows.find((r) => r.contractNo !== g.contractId);
      if (mismatched) {
        throw new Error(tt(
          `Contract No. '${mismatched.contractNo}' does not match selected contract '${g.contractId}'.`,
          `No. Kontrak '${mismatched.contractNo}' tidak cocok dengan kontrak terpilih '${g.contractId}'.`
        ));
      }
      const result = await cmMatApi("/materials/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractKey: g.contractId, fileName: file.name, rows }),
      });
      toast.push({
        title: tt("Materials uploaded", "Material diunggah"),
        description: tt(`${result.rowCount} rows replaced.`, `${result.rowCount} baris diganti.`),
      });
      await refreshMatSummary();
    } catch (err) {
      toast.push({ tone: "error", title: tt("Upload failed", "Upload gagal"), description: String(err.message || err) });
    } finally {
      setMatUploading(false);
      if (matFileRef.current) matFileRef.current.value = "";
    }
  };
  const reminderHistory = g.status === "Expiring"
    ? [...CM_REMINDERS].sort((a, b) => b.maxDays - a.maxDays).filter((r) => g.days <= r.maxDays)
    : [];
  const sec = (title, icon, children) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <Icon name={icon} size={14} color={C.ocean} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textSubtle }}>{title}</span>
      </div>
      {children}
    </div>
  );
  const kv = (label, value) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 600, wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
  return (
    <>
    <Modal open={!!g} onClose={onClose} width={820} style={{ maxWidth: 820 }} icon="file-text"
      title={g.title} subtitle={`${g.contractId} · ${g.supplier}`}
      footer={<>{canWrite && <Button iconLeft="pencil" onClick={() => onEdit && onEdit(g)}>{tt("Edit", "Ubah")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tt("Close", "Tutup")}</Button></>}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, marginBottom: 18, flexWrap: "wrap" }}>
        {cmStatusBadge(g.status, lang)}
        {cmCountdownChip(g.days, lang)}
        <span style={{ fontSize: 12.5, color: C.textMuted }}>{tt("Expires", "Berakhir")} {trkFmtDate(g.currentExpiry, lang)}</span>
        <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 800, color: C.text }}>{trkRp(g.value)}</span>
        {canSend && g.status === "Expiring" && (curSent
          ? <Badge tone="success" dot>{tt("Reminder sent", "Reminder terkirim")}</Badge>
          : <Button size="sm" iconLeft="send" onClick={doSend}>{tt("Send reminder", "Kirim reminder")}</Button>)}
      </div>

      {sec(tt("List of Material", "List of Material"), "package", (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surface }}>
          <Badge tone="brand">{tt("Materials", "Material")}: {(matSummary && matSummary.totalCount) || 0}</Badge>
          {matSummary && matSummary.sourceType && <Badge tone="neutral">{matSummary.sourceType}</Badge>}
          {matSummary && matSummary.importedAt && <span style={{ fontSize: 12, color: C.textMuted }}>{tt("Updated", "Diperbarui")} {cmFmtMaterialWhen(matSummary.importedAt)}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" variant="secondary" iconLeft="list" onClick={() => setMatOpen(true)}>{tt("View", "Lihat")}</Button>
            {canWrite && (
              <>
                <input ref={matFileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: "none" }}
                  onChange={(e) => uploadMaterial(e.target.files && e.target.files[0])} />
                <Button size="sm" iconLeft={matUploading ? "loader" : "upload"} disabled={matUploading} onClick={() => matFileRef.current && matFileRef.current.click()}>
                  {matUploading ? tt("Uploading…", "Mengunggah…") : tt("Upload Material", "Upload Material")}
                </Button>
              </>
            )}
          </div>
        </div>
      ))}

      {sec(tt("Overview", "Ikhtisar"), "info", (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {kv(tt("Jobsite", "Jobsite"), g.jobsite)}
          {kv(tt("Classification", "Klasifikasi"), g.classification)}
          {kv(tt("Sub-classification", "Sub-klasifikasi"), g.subClass)}
          {kv(tt("Template", "Template"), g.template)}
          {kv(tt("Frequency", "Frekuensi"), g.frequency)}
          {kv(tt("Ownership", "Kepemilikan"), g.ownership)}
        </div>
      ))}

      {sec(tt("Key dates", "Tanggal penting"), "calendar", (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
          {kv(tt("Received", "Diterima"), trkFmtDate(g.receivedDate, lang))}
          {kv(tt("Contract date", "Tgl kontrak"), trkFmtDate(g.contractDate, lang))}
          {kv(tt("Effective", "Mulai berlaku"), trkFmtDate(g.effectiveDate, lang))}
          {kv(tt("Expires", "Berakhir"), trkFmtDate(g.currentExpiry, lang))}
        </div>
      ))}

      {sec(tt("Ownership & contacts", "Kepemilikan & kontak"), "users-round", (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {kv(tt("Owner", "Owner"), g.owner)}
          {kv(tt("User department", "Departemen user"), g.userDept)}
          {kv(tt("PIC (input)", "PIC (input)"), g.picNames)}
          {kv("PIC Email", g.picEmail)}
          {kv(tt("Contract system no.", "No sistem kontrak"), g.systemNos.join(", "))}
        </div>
      ))}

      {g.priceAdj && /[a-zA-Z]/.test(g.priceAdj) && sec(tt("Price adjustment agreement", "Kesepakatan perubahan harga"), "file-pen", (
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, padding: "10px 12px", backgroundColor: C.warningBg, borderRadius: RADIUS.md }}>{g.priceAdj}</div>
      ))}

      {g.status === "Expiring" && sec(tt("Reminder history", "Riwayat reminder"), "mail-check", (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {reminderHistory.map((r) => {
            const toneColor = { danger: C.danger, orange: C.orange, warning: C.warningText, info: C.info }[r.tone] || C.ocean;
            const rec = cmReminderRecord(g.contractId, r.key);
            const isCurrent = curBucket && curBucket.key === r.key;
            const accent = rec ? C.success : toneColor;
            return (
              <div key={r.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${accent}22`, backgroundColor: `${accent}0f` }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: accent, backgroundColor: `${accent}18` }}><Icon name={rec ? "mail-check" : "clock"} size={14} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{trkText(lang, r)}</span>
                    {rec
                      ? <Badge tone="success" size="sm">{rec.trigger === "Manual" ? tt("Sent · manual", "Terkirim · manual") : tt("Sent · scheduled", "Terkirim · terjadwal")}</Badge>
                      : <Badge tone={r.tone} size="sm">{tt("Due", "Belum dikirim")}</Badge>}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
                    {rec ? `${trkFmtDate(rec.sentAt.split(" ")[0], lang)} · ${g.picEmail}${rec.escalated ? ` · +${CM_SECTION_HEAD.name}` : ""}` : `${tt("Scheduled around", "Dijadwalkan sekitar")} ${trkFmtDate(cmAddDays(g.currentExpiry, -r.maxDays), lang)}`}
                  </div>
                  {!rec && isCurrent && canSend && <div style={{ marginTop: 7 }}><Button size="xs" variant="secondary" iconLeft="send" onClick={doSend}>{tt("Send now", "Kirim sekarang")}</Button></div>}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {sec(tt("Amendment history", "Riwayat amandemen"), "git-commit-horizontal", (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {g.versions.map((v, i) => {
            const last = i === g.versions.length - 1;
            const docLink = v.link || g.link;
            return (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  {docLink ? (
                    <Tooltip label={tt("Open Document", "Buka Dokumen")} side="right">
                      <button type="button" onClick={() => setPreviewDoc({ link: docLink, title: v.title, contractId: g.contractId })} aria-label={tt("Open Document", "Buka Dokumen")}
                        style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: i === g.versions.length - 1 ? C.brandBg : C.surfaceAlt, border: `2px solid ${i === g.versions.length - 1 ? C.ocean : C.border}`, color: i === g.versions.length - 1 ? C.ocean : C.textMuted, cursor: "pointer", padding: 0 }}>
                        <Icon name={v.type === "MAIN CONTRACT" ? "file-text" : "file-plus"} size={13} />
                      </button>
                    </Tooltip>
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: i === g.versions.length - 1 ? C.brandBg : C.surfaceAlt, border: `2px solid ${i === g.versions.length - 1 ? C.ocean : C.border}`, color: i === g.versions.length - 1 ? C.ocean : C.textMuted }}>
                      <Icon name={v.type === "MAIN CONTRACT" ? "file-text" : "file-plus"} size={13} />
                    </div>
                  )}
                  {!last && <div style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: C.border, margin: "3px 0" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Badge tone={v.type === "MAIN CONTRACT" ? "brand" : "info"}>{v.type}</Badge>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{trkFmtDate(v.contractDate, lang)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>{v.title}</div>
                  <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 2 }}>{tt("Value", "Nilai")} {trkRp(v.value)} · {tt("expires", "berakhir")} {trkFmtDate(v.expiredDate, lang)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </Modal>
    {previewDoc && <CmDocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    <ContractMaterialListModal
      contractId={g.contractId}
      title={g.title}
      open={matOpen}
      onClose={() => setMatOpen(false)}
      canWrite={canWrite}
      onUploaded={() => refreshMatSummary()}
    />
    </>
  );
}

/* In-app PDF preview — same UX as the CIP LOA/document preview: resolves a contract document link to
   its migrated Azure Blob copy (short-lived SAS) and shows it inline in a modal iframe. */
function CmDocPreviewModal({ doc, onClose }) {
  const C = useC();
  const tt = useTT();
  const [src, setSrc] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setError(""); setSrc("");
    if (!doc) { setLoading(false); return undefined; }
    setLoading(true);
    fetch("/api/v1/contract-monitoring/documents/resolve", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link: doc.link, contractId: doc.contractId || null }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Resolve failed (${r.status})`);
        return r.json();
      })
      .then((res) => {
        if (cancelled) return;
        const url = res && res.migrated && res.url ? res.url : "";
        if (!url) {
          setError(tt("This document hasn't been migrated to storage yet.", "Dokumen ini belum dimigrasi ke storage."));
          return "";
        }
        if (/^https?:\/\/[^/]*blob\.core\.windows\.net\b/i.test(url)) return url;
        return fetch(url, { credentials: "include" }).then((fileRes) => {
          if (!fileRes.ok) throw new Error(`Download failed (${fileRes.status})`);
          return fileRes.blob().then((blob) => URL.createObjectURL(blob));
        });
      })
      .then((framed) => {
        if (cancelled) {
          if (framed && String(framed).startsWith("blob:")) URL.revokeObjectURL(framed);
          return;
        }
        if (framed) setSrc(framed);
      })
      .catch(() => { if (!cancelled) setError(tt("Unable to load document.", "Tidak bisa memuat dokumen.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doc, tt]);
  return (
    <Modal open={!!doc} onClose={onClose} width="80vw" icon="file-search"
      title={tt("View PDF Document", "View PDF Document")} subtitle={doc ? doc.title : ""}
      overlayStyle={{ padding: 0, alignItems: "stretch" }}
      style={{ maxWidth: "80vw", height: "100vh", borderRadius: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflow: "hidden", padding: 16 }}>
      {doc && (
        <div style={{ height: "100%", minHeight: 0, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {loading ? <Spinner size={22} color={C.ocean} />
            : src ? <iframe title={doc.title || "document"} src={src} style={{ width: "100%", height: "100%", border: 0, backgroundColor: "#fff" }} />
            : <div style={{ fontSize: 13, color: C.textMuted, padding: 20, textAlign: "center" }}>{error || tt("Document not available.", "Dokumen tidak tersedia.")}</div>}
        </div>
      )}
    </Modal>
  );
}

function ContractFormModal({ open, mode, group, onClose, onSave, tt, lang }) {
  const C = useC();
  const blank = {
    contractId: `CM-2026-${String(CM_CONTRACTS.length + 1).padStart(4, "0")}`,
    supplier: "",
    title: "",
    value: 1000000000,
    jobsite: CM_JOBSITES[0],
    classification: CM_CLASSES[0],
    subClass: CM_SUBCLASS[CM_CLASSES[0]][0],
    template: "Service Agreement",
    frequency: "Rutin",
    ownership: "SIS",
    owner: "Siti Maryam",
    userDept: "Contract Monitoring",
    picNames: "Rahmat Hidayat",
    picEmail: "rahmat.hidayat@saptaindra.co.id",
    receivedDate: CM_TODAY,
    contractDate: CM_TODAY,
    effectiveDate: CM_TODAY,
    expiredDate: cmDateFromToday(365),
    priceAdj: "",
  };
  const [form, setForm] = React.useState(blank);
  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit" && group) {
      setForm({
        ...blank,
        contractId: group.contractId,
        supplier: group.supplier,
        title: group.title,
        value: group.value,
        jobsite: group.jobsite,
        classification: group.classification,
        subClass: group.subClass,
        template: group.template,
        frequency: group.frequency,
        ownership: group.ownership,
        owner: group.owner,
        userDept: group.userDept,
        picNames: group.picNames,
        picEmail: group.picEmail,
        receivedDate: group.receivedDate,
        contractDate: group.contractDate,
        effectiveDate: group.effectiveDate,
        expiredDate: group.currentExpiry,
        priceAdj: group.priceAdj,
      });
    } else {
      setForm({ ...blank, contractId: `CM-2026-${String(Date.now()).slice(-4)}` });
    }
  }, [open, mode, group]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const picOptions = CM_PICS.map((p) => ({ value: p.email, label: `${p.name} - ${p.email}` }));
  const applyPic = (email) => {
    const pic = CM_PICS.find((p) => p.email === email) || CM_PICS[0];
    setForm((f) => ({ ...f, picEmail: pic.email, picNames: pic.name, userDept: pic.dept }));
  };
  const classOptions = CM_CLASSES.map((c) => ({ value: c, label: c }));
  const subOptions = (CM_SUBCLASS[form.classification] || []).map((s) => ({ value: s, label: s }));
  return (
    <Modal open={open} onClose={onClose} width={720} icon={mode === "edit" ? "file-pen" : "file-plus"}
      title={mode === "edit" ? tt("Edit contract", "Ubah kontrak") : tt("New contract", "Kontrak baru")}
      subtitle={tt("Officer Contract Monitoring can create and update contract metadata.", "Officer Contract Monitoring dapat membuat dan memperbarui metadata kontrak.")}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="check" onClick={() => onSave({ ...form, value: Number(form.value) || 0 })}>{tt("Save contract", "Simpan kontrak")}</Button>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Contract ID" required><TextInput value={form.contractId} onChange={(e) => set("contractId", e.target.value)} disabled={mode === "edit"} /></Field>
        <Field label={tt("Supplier", "Pemasok")} required><TextInput value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="PT ..." /></Field>
        <div style={{ gridColumn: "1 / -1" }}><Field label={tt("Contract title", "Judul kontrak")} required><TextInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={tt("Contract title", "Judul kontrak")} /></Field></div>
        <Field label={tt("Value", "Nilai")} required><TextInput value={String(form.value)} onChange={(e) => set("value", e.target.value.replace(/[^\d]/g, ""))} iconLeft="banknote" /></Field>
        <Field label="Jobsite"><Select value={form.jobsite} onChange={(e) => set("jobsite", e.target.value)} options={CM_JOBSITES.map((j) => ({ value: j, label: j }))} /></Field>
        <Field label={tt("Classification", "Klasifikasi")}><Select value={form.classification} onChange={(e) => { const cls = e.target.value; setForm((f) => ({ ...f, classification: cls, subClass: (CM_SUBCLASS[cls] || [""])[0] })); }} options={classOptions} /></Field>
        <Field label={tt("Sub-classification", "Sub-klasifikasi")}><Select value={form.subClass} onChange={(e) => set("subClass", e.target.value)} options={subOptions} /></Field>
        <Field label="Template"><Select value={form.template} onChange={(e) => set("template", e.target.value)} options={CM_TEMPLATES.map((x) => ({ value: x, label: x }))} /></Field>
        <Field label={tt("Frequency", "Frekuensi")}><Select value={form.frequency} onChange={(e) => set("frequency", e.target.value)} options={CM_FREQUENCIES.map((x) => ({ value: x, label: x }))} /></Field>
        <Field label={tt("Owner", "Owner")}><TextInput value={form.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
        <Field label="PIC Email"><Select value={form.picEmail} onChange={(e) => applyPic(e.target.value)} options={picOptions} /></Field>
        <Field label={tt("Effective date", "Mulai berlaku")}><TextInput type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} /></Field>
        <Field label={tt("Expired date", "Tanggal berakhir")}><TextInput type="date" value={form.expiredDate} onChange={(e) => set("expiredDate", e.target.value)} /></Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label={tt("Price adjustment / notes", "Perubahan harga / catatan")}>
            <Textarea rows={3} value={form.priceAdj} onChange={(e) => set("priceAdj", e.target.value)} placeholder={tt("Optional notes", "Catatan opsional")} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* =================== EXPIRY REMINDERS =================== */
function ContractExpiry() {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const access = cmAccessForSession(session);
  const rows = React.useMemo(() => cmRowsForSession(session), [session.actingUser.email, session.effectiveRole]);
  const groups = React.useMemo(() => cmGroups(rows), [rows]);
  const [selectedBucket, setSelectedBucket] = React.useState("all");
  const [detail, setDetail] = React.useState(null);
  const toast = useToast();
  const [, bump] = React.useReducer((x) => x + 1, 0); // re-read reminder store after sends

  const bColor = { danger: C.danger, orange: C.orange, yellow: C.yellow, blue: C.blue };
  const bucketOf = (days) => CM_REMINDERS.find((r) => days <= r.maxDays);
  const expiring = groups.filter((g) => g.status === "Expiring").sort((a, b) => a.days - b.days);
  const filtered = selectedBucket === "all" ? expiring : expiring.filter((g) => (bucketOf(g.days) || {}).key === selectedBucket);

  const sendOne = async (g) => {
    const r = await cmSendReminder(g, "Manual", true);
    bump();
    if (r.sent) {
      session.record({ action: "Notify", module: "Contract Monitoring", desc: `Manual reminder sent for ${g.contractId} (${g.supplier})`, tone: "brand" });
      const extra = `${r.escalated ? ` · +${CM_SECTION_HEAD.name}` : ""}${r.delivered ? "" : tt(" · recorded (relay unreachable)", " · tercatat (relay tak terjangkau)")}`;
      toast.push({ title: tt("Reminder sent", "Reminder terkirim"), description: `${g.supplier}${extra}` });
    } else {
      toast.push({ tone: "error", title: tt("Reminder failed", "Reminder gagal"), description: r.error || r.reason || "" });
    }
  };
  const runScan = async () => {
    const res = await cmRunDailyScan(groups);
    bump();
    session.record({ action: "Notify", module: "Contract Monitoring", desc: `Scheduled reminder scan — ${res.sent} sent, ${res.skipped} already sent, ${res.failed} failed`, tone: "brand" });
    toast.push({ title: tt("Daily scan complete", "Pemindaian harian selesai"), description: tt(`${res.sent} sent · ${res.escalated} escalated · ${res.skipped} already sent · ${res.failed} failed`, `${res.sent} terkirim · ${res.escalated} eskalasi · ${res.skipped} sudah dikirim · ${res.failed} gagal`) });
  };

  return (
    <div>
      <PageHeader title={tt("Expiry Reminders", "Pengingat Masa Berlaku")} description={tt("Only contracts currently in Expiring status. Reminder levels are grouped at 6, 4, 2 months and 30 days before expiry.", "Hanya kontrak dengan status Akan Berakhir. Level pengingat dikelompokkan pada 6, 4, 2 bulan dan 30 hari sebelum berakhir.")}
        actions={<>
          {access.canWrite && <Button variant="secondary" iconLeft="refresh-cw" onClick={runScan}>{tt("Run daily scan", "Jalankan pemindaian harian")}</Button>}
          <Badge tone={access.canWrite ? "brand" : "neutral"}>{access.label}</Badge>
        </>} />
      {access.canWrite && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "-6px 0 16px", fontSize: 12, color: C.textSubtle }}>
          <Icon name="clock" size={14} />{tt("Production: a Hangfire job runs this scan daily at 07:00 WIB. Here it is manual for the demo.", "Produksi: job Hangfire menjalankan pemindaian ini setiap hari pukul 07:00 WIB. Di sini manual untuk demo.")}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }} className="ag-trk-kpis">
        {CM_REMINDERS.slice().reverse().map((r) => {
          const n = expiring.filter((g) => { const b = bucketOf(g.days); return b && b.key === r.key; }).length;
          const active = selectedBucket === r.key;
          return <Card key={r.key} hover
            style={{ padding: 0, borderColor: active ? bColor[r.color] : C.cardBorder, backgroundColor: active ? `${bColor[r.color]}10` : C.surface, overflow: "hidden" }}>
            <button type="button" onClick={() => setSelectedBucket((b) => b === r.key ? "all" : r.key)}
              style={{ ...FONT, display: "block", width: "100%", padding: 16, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", color: C.text }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: bColor[r.color] + "22", color: bColor[r.color], display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="bell-ring" size={17} /></span>
                <span style={{ fontSize: 12.5, color: C.textMuted, fontWeight: 600 }}>{lang === "id" ? r.id : r.en}</span>
              </div>
              <div style={{ ...FONT, display: "inline-flex", alignItems: "baseline", gap: 7 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: n ? C.text : C.textSubtle }}>{n}</span>
                <span style={{ fontSize: 11.5, color: C.textSubtle }}>{tt("contracts", "kontrak")}</span>
              </div>
            </button>
          </Card>;
        })}
      </div>

      <Card pad={0}>
        <div style={{ padding: "13px 18px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{tt("Expiring contracts by nearest expiry", "Kontrak akan berakhir berdasarkan tanggal terdekat")}</span>
          <Badge tone="neutral">{filtered.length} {tt("contracts", "kontrak")}</Badge>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((g, i) => {
            const b = bucketOf(g.days);
            const col = b ? bColor[b.color] : C.success;
            return (
              <div key={g.contractId} onClick={() => setDetail(g)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.borderSoft}` : "none", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.hover; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: col, flexShrink: 0 }} />
                <Avatar name={g.supplier.replace(/^PT\s+/, "")} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: C.textSubtle }}>{g.contractId}</span>
                    {g.versions.length > 1 && <Badge tone="neutral" size="sm">{g.versions[g.versions.length - 1].type}</Badge>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.title}</div>
                  <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 1 }}>{g.supplier} · {g.jobsite} · {trkRp(g.value)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>{trkFmtDate(g.currentExpiry, lang)}</div>
                  <div style={{ marginTop: 4 }}>{cmCountdownChip(g.days, lang)}</div>
                </div>
                {access.canWrite && (
                  <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0, width: 96, display: "flex", justifyContent: "flex-end" }}>
                    {b && cmReminderSentFor(g.contractId, b.key)
                      ? <Badge tone="success" dot>{tt("Sent", "Terkirim")}</Badge>
                      : <Button size="xs" variant="secondary" iconLeft="send" onClick={() => sendOne(g)}>{tt("Send", "Kirim")}</Button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <ContractDetail group={detail} onClose={() => setDetail(null)} lang={lang} tt={tt} canWrite={false} canSend={access.canWrite}
        onSent={bump} onEdit={() => setDetail(null)} />
    </div>
  );
}

Object.assign(window, { ContractMonDashboard, ContractDatabase, ContractExpiry });
export { ContractMonDashboard, ContractDatabase, ContractExpiry };
