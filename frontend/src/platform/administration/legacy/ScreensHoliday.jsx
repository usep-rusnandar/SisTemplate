/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, IconButton, TableRefreshButton, Badge, Card, TextInput, Field, Select, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDate, Alert, Menu, MenuItem, MenuDivider, Modal, DataTable, Pagination, useToast, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard } from "../../../shared/legacy/PrimitivesX.jsx";
import { useSession } from "../../session/legacy/Session.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
/* Alamtri Geo Admin — Master Data ▸ Holiday.
   A full-year holiday register: national holidays, joint leave (cuti bersama),
   and company days off for a selected year. Year switcher, at-a-glance summary,
   month strip, searchable/filterable table, and add/edit/delete. */

const HOLIDAY_TYPES = {
  National:     { label: "National holiday", short: "National", tone: "brand",   icon: "flag" },
  "Joint Leave":{ label: "Joint leave",      short: "Joint leave", tone: "orange", icon: "users-round" },
  Company:      { label: "Company day off",  short: "Company", tone: "neutral",  icon: "building-2" },
};

/* Holidays live only in the backend master-data set `holiday` (records store the full holiday
   object in payloadJson). The former HOLIDAYS_SEED array is gone. This runtime cache is hydrated
   from the backend and kept on window.__holidayCache so the Tracker working-day engine
   (TrackerCalendar) can read it synchronously. */
const HOLIDAY_MASTER_API = "/api/v1/master-data/sets/holiday";
const HOLIDAY_SET_NAME = "Holiday";
const HOLIDAY_TABLE_NAME = "MSTR_HOLIDAY_T";
const HOLIDAY_OWNER = "Administration";

let _holidayCache = null;
let _holidayPromise = null;

function _holidayFromRecord(rec) {
  let obj = {};
  try { obj = rec && rec.payloadJson ? JSON.parse(rec.payloadJson) : {}; } catch (e) {}
  return {
    id: obj.id || (rec && rec.code) || "",
    date: obj.date || "",
    name: obj.name || (rec && rec.name) || "",
    type: obj.type || "National",
    recurring: !!obj.recurring,
    note: obj.note || "",
  };
}
function _mapHolidayRecords(records) {
  return (Array.isArray(records) ? records : []).map(_holidayFromRecord).filter((h) => h.date);
}
function _setHolidayCache(rows) { _holidayCache = rows; window.__holidayCache = rows; }

// fetch (and cache) the holiday set; deduped via _holidayPromise. Pass force=true to refetch.
function loadHolidays(force) {
  if (_holidayCache && !force) return Promise.resolve(_holidayCache);
  if (_holidayPromise && !force) return _holidayPromise;
  _holidayPromise = fetch(HOLIDAY_MASTER_API, { credentials: "include", headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((payload) => {
      const rows = payload && payload.hasData ? _mapHolidayRecords(payload.records) : [];
      _setHolidayCache(rows);
      try { window.dispatchEvent(new CustomEvent("ag:holidays-loaded")); } catch (e) {}
      return rows;
    })
    .catch(() => { _setHolidayCache(_holidayCache || []); return _holidayCache; })
    .finally(() => { _holidayPromise = null; });
  return _holidayPromise;
}
// synchronous holiday date-set for the tracker working-day engine (kicks off hydration lazily)
function holidayDateSet() {
  if (!_holidayCache && !_holidayPromise) { try { void loadHolidays(); } catch (e) {} }
  return new Set((_holidayCache || []).map((h) => h.date));
}

async function _putHolidayRecord(h) {
  const response = await fetch(`${HOLIDAY_MASTER_API}/records/${encodeURIComponent(h.id)}`, {
    method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: HOLIDAY_SET_NAME, tableName: HOLIDAY_TABLE_NAME, owner: HOLIDAY_OWNER,
      name: h.name, status: "Active", description: h.note || "", payloadJson: JSON.stringify(h),
    }),
  });
  if (!response.ok) throw new Error(`Holiday save failed with status ${response.status}.`);
}
async function _deleteHolidayRecord(id) {
  const response = await fetch(`${HOLIDAY_MASTER_API}/records/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error(`Holiday delete failed with status ${response.status}.`);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TODAY_ISO = (function () {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

/* parse "YYYY-MM-DD" into local parts without timezone drift */
function hParts(iso) { const [y, m, d] = (iso || "").split("-").map(Number); return { y, m, d, dow: new Date(y, m - 1, d).getDay() }; }
function hYear(iso) { return Number((iso || "").slice(0, 4)); }
function hMonth(iso) { return Number((iso || "").slice(5, 7)); }
function hIsWeekend(iso) { const dow = hParts(iso).dow; return dow === 0 || dow === 6; }
function hDaysFromToday(iso) { return Math.round((new Date(iso) - new Date(TODAY_ISO)) / 86400000); }

function Holiday() {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const session = useSession();

  const [rows, setRows] = React.useState(() => _holidayCache || []);
  const [year, setYear] = React.useState(2026);
  const [typeF, setTypeF] = React.useState("all");
  const [monthF, setMonthF] = React.useState(null); // 1..12 or null
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [loading, setLoading] = React.useState(false);
  const [modal, setModal] = React.useState(null);   // { mode, holiday }
  const [del, setDel] = React.useState(null);
  const ps = usePageSearch("Search holiday name…");
  const q = ps.query, setQ = ps.setQuery;

  React.useEffect(() => { setPage(1); }, [year, typeF, monthF, q]);

  // hydrate from the backend master-data set on mount
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadHolidays().then((data) => { if (!cancelled) { setRows(data || []); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  // keep the shared cache (read by the tracker working-day engine) in sync with edits.
  // Guard on length so the empty first render doesn't clobber the cache before hydration.
  React.useEffect(() => { if (rows && rows.length) _setHolidayCache(rows); }, [rows]);

  const yearRows = React.useMemo(() => rows.filter((r) => hYear(r.date) === year), [rows, year]);
  const years = React.useMemo(() => {
    const set = new Set(rows.map((r) => hYear(r.date))); set.add(year); set.add(2026);
    return [...set].sort((a, b) => a - b);
  }, [rows, year]);

  const counts = React.useMemo(() => {
    const byMonth = Array(12).fill(0);
    let national = 0, joint = 0, company = 0;
    yearRows.forEach((r) => { byMonth[hMonth(r.date) - 1]++; if (r.type === "National") national++; else if (r.type === "Joint Leave") joint++; else company++; });
    return { total: yearRows.length, national, joint, company, byMonth };
  }, [yearRows]);

  const nextUp = React.useMemo(() => {
    return [...rows].filter((r) => hDaysFromToday(r.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  }, [rows]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    return yearRows
      .filter((r) => (typeF === "all" || r.type === typeF))
      .filter((r) => (monthF == null || hMonth(r.date) === monthF))
      .filter((r) => !qq || r.name.toLowerCase().includes(qq) || (r.note || "").toLowerCase().includes(qq))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [yearRows, typeF, monthF, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = q || typeF !== "all" || monthF != null;

  const refresh = () => {
    setLoading(true);
    loadHolidays(true).then((data) => { setRows(data || []); setLoading(false); toast.push({ title: "Refreshed", description: "Holiday list is up to date." }); });
  };

  const save = (form) => {
    if (modal.mode === "edit") {
      const next = { ...rows.find((r) => r.id === form.id), ...form };
      setRows((rs) => rs.map((r) => (r.id === form.id ? next : r)));
      void _putHolidayRecord(next).catch((e) => { console.warn("Holiday save failed; local state kept.", e); toast.push({ title: "Save failed", description: "Backend update failed; local state was updated.", tone: "warning" }); });
      session.record({ action: "Update", module: "Holiday", desc: `Updated holiday ${form.name}`, tone: "brand" });
      toast.push({ title: "Holiday updated", description: form.name });
    } else {
      const id = `H-${Date.now().toString().slice(-6)}`;
      const created = { ...form, id };
      setRows((rs) => [...rs, created]);
      void _putHolidayRecord(created).catch((e) => { console.warn("Holiday create failed; local state kept.", e); toast.push({ title: "Save failed", description: "Backend create failed; local state was updated.", tone: "warning" }); });
      session.record({ action: "Create", module: "Holiday", desc: `Added holiday ${form.name}`, tone: "success" });
      toast.push({ title: "Holiday added", description: `${form.name} · ${fmtLong(form.date)}` });
      setYear(hYear(form.date));
    }
    setModal(null);
  };
  const confirmDelete = () => {
    const id = del.id;
    setRows((rs) => rs.filter((r) => r.id !== id));
    void _deleteHolidayRecord(id).catch((e) => { console.warn("Holiday delete failed; local state kept.", e); toast.push({ title: "Delete failed", description: "Backend delete failed; local state was updated.", tone: "warning" }); });
    session.record({ action: "Delete", module: "Holiday", desc: `Deleted holiday ${del.name}`, tone: "danger" });
    toast.push({ title: "Holiday deleted", tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "date", label: "Date", sortable: true, width: 168, render: (r) => <DateChip iso={r.date} /> },
    { key: "name", label: "Holiday", render: (r) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{r.name}</div>
        {r.note && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>{r.note}</div>}
      </div>) },
    { key: "type", label: "Type", width: 150, render: (r) => { const ty = HOLIDAY_TYPES[r.type]; return <Badge tone={ty.tone}><Icon name={ty.icon} size={12} />{ty.short}</Badge>; } },
    { key: "recurring", label: "Repeat", width: 116, render: (r) => r.recurring
        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.textMuted, fontWeight: 500 }}><Icon name="repeat" size={13} />Annual</span>
        : <span style={{ fontSize: 12, color: C.textSubtle }}>One-off</span> },
    { key: "_a", label: "", align: "right", width: 56, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="pencil" label={t("act.edit")} onClick={() => setModal({ mode: "edit", holiday: r })} />
          <MenuItem icon="copy" label="Duplicate" onClick={() => setModal({ mode: "create", holiday: { ...r, id: undefined, name: r.name } })} />
          <MenuDivider />
          <MenuItem icon="trash-2" label={t("act.delete")} danger onClick={() => setDel(r)} />
        </Menu>
      </div>) },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={t("nav.holiday")} subtitle="Maintain national holidays, joint leave, and company days off for the working calendar." compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <YearSwitcher year={year} years={years} onChange={setYear} />
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", holiday: null })}>Add holiday</OpsHeroButton>
        </div>} />

      <OpsStatGrid cols={4} className="ag-holiday-stats">
        <OpsStatCard icon="calendar-days" label="Total days off" value={counts.total} sub={`in ${year}`} iconTone="brand" />
        <OpsStatCard icon="flag" label="National holidays" value={counts.national} iconTone="blue" />
        <OpsStatCard icon="users-round" label="Joint leave" value={counts.joint} sub="cuti bersama" iconTone="orange" />
        <NextCard holiday={nextUp} />
      </OpsStatGrid>

      {/* year at a glance */}
      <Card pad={0} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textSubtle }}>{year} at a glance</span>
          {monthF != null && <Button variant="link" size="sm" iconLeft="x" onClick={() => setMonthF(null)}>Clear month</Button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 8, padding: 14 }} className="ag-month-strip">
          {MONTHS_SHORT.map((m, i) => {
            const n = counts.byMonth[i]; const active = monthF === i + 1;
            return (
              <button key={m} onClick={() => setMonthF(active ? null : i + 1)}
                style={{ ...FONT, cursor: "pointer", textAlign: "left", padding: "10px 10px 9px", borderRadius: RADIUS.md,
                  border: `1px solid ${active ? C.ocean : C.borderSoft}`, backgroundColor: active ? C.brandBg : n ? C.surface : C.surfaceAlt,
                  boxShadow: active ? C.focusRing : "none", transition: "border-color 0.12s, background-color 0.12s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: active ? C.ocean : n ? C.text : C.textSubtle }}>{m}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: n ? (active ? C.ocean : C.text) : C.textSubtle }}>{n || "—"}</span>
                </div>
                <div style={{ display: "flex", gap: 3, marginTop: 8, minHeight: 6 }}>
                  {Array.from({ length: Math.min(n, 6) }).map((_, k) => <span key={k} style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.ocean, opacity: active ? 1 : 0.55 }} />)}
                  {n > 6 && <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, lineHeight: "6px" }}>+{n - 6}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* table */}
      <Card pad={0}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 256 }}><TextInput iconLeft="search" placeholder="Search holiday name…" value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              <div style={{ width: 168 }}><Select value={typeF} onChange={(e) => setTypeF(e.target.value)} options={[{ value: "all", label: "All types" }, ...Object.keys(HOLIDAY_TYPES).map((k) => ({ value: k, label: HOLIDAY_TYPES[k].label }))]} /></div>
              {monthF != null && <Badge tone="brand">{MONTHS_SHORT[monthF - 1]} {year}</Badge>}
              {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setTypeF("all"); setMonthF(null); }}>{t("act.clear")}</Button>}
            </>}
            right={<TableRefreshButton onClick={refresh} />} />
        </div>
        <DataTable columns={columns} data={pageRows} loading={loading} dense rowKey="id" onRowClick={(r) => setModal({ mode: "edit", holiday: r })}
          emptyTitle={`No holidays in ${year}`} emptyDesc="Add the first holiday for this year to get started." />
        <div style={{ padding: "4px 16px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} /></div>
      </Card>

      <HolidayModal open={!!modal} mode={modal && modal.mode} holiday={modal && modal.holiday} year={year} onClose={() => setModal(null)} onSave={save} />
      <Modal open={!!del} onClose={() => setDel(null)} width={420} icon="trash-2" title="Delete holiday" subtitle="This action cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>Delete holiday</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>Remove <b>{del && del.name}</b> ({del && fmtLong(del.date)}) from the calendar?</p>
      </Modal>
    </OpsPage>
  );
}

/* date helpers for display */
function fmtLong(iso) { return fmtAppDate(iso); }

/* compact date cell: day number + month, weekday below, weekend tinted */
function DateChip({ iso }) {
  const C = useC();
  const p = hParts(iso);
  const weekend = hIsWeekend(iso);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div style={{ width: 42, flexShrink: 0, textAlign: "center", borderRadius: RADIUS.sm, border: `1px solid ${C.borderSoft}`, overflow: "hidden", backgroundColor: C.surface }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", color: "#fff", backgroundColor: weekend ? C.orange : C.main, padding: "1px 0" }}>{MONTHS_SHORT[p.m - 1].toUpperCase()}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>{String(p.d).padStart(2, "0")}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{fmtAppDate(iso)}</div>
        <div style={{ fontSize: 11, color: weekend ? C.orange : C.textSubtle, fontWeight: weekend ? 600 : 500 }}>{weekend ? "Weekend" : "Weekday"}</div>
      </div>
    </div>
  );
}

/* year stepper + dropdown */
function YearSwitcher({ year, years, onChange }) {
  const C = useC();
  const idx = years.indexOf(year);
  const step = (d) => { const v = year + d; onChange(v); };
  const navBtn = (icon, d) => (
    <button onClick={() => step(d)} style={{ ...FONT, width: 34, height: 36, border: "none", background: "transparent", color: C.textMuted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.hover} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
      <Icon name={icon} size={17} />
    </button>
  );
  return (
    <div style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: C.surface, height: 38 }}>
      {navBtn("chevron-left", -1)}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "0 12px", borderLeft: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, height: "100%" }}>
        <Icon name="calendar" size={15} color={C.ocean} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{year}</span>
      </div>
      {navBtn("chevron-right", 1)}
    </div>
  );
}

/* "next holiday" highlight card */
function NextCard({ holiday }) {
  const C = useC();
  if (!holiday) return <OpsStatCard icon="calendar-check" label="Upcoming holiday" value="—" iconTone="forest" />;
  const days = hDaysFromToday(holiday.date);
  const rel = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`;
  return (
    <div style={{ ...FONT, position: "relative", overflow: "hidden", borderRadius: RADIUS.lg, padding: "16px 18px", background: "linear-gradient(135deg, #013B52 0%, #0F828A 130%)", color: "#fff" }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}><Icon name="calendar-check" size={14} />Next holiday</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{holiday.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12.5, color: "rgba(255,255,255,0.82)" }}>
        <span>{fmtLong(holiday.date)}</span>
        <span style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.5)" }} />
        <span style={{ fontWeight: 700, color: "#fff" }}>{rel}</span>
      </div>
    </div>
  );
}

/* add / edit modal */
function HolidayModal({ open, mode, holiday, year, onClose, onSave }) {
  const C = useC();
  const isEdit = mode === "edit";
  const blank = { date: `${year}-01-01`, name: "", type: "National", recurring: false, note: "" };
  const [form, setForm] = React.useState(blank);
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    if (open) { setForm(holiday ? { ...blank, ...holiday } : { ...blank, date: `${year}-01-01` }); setErr(""); }
    // eslint-disable-next-line
  }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.date) return setErr("Pick a date for the holiday.");
    if (!form.name.trim()) return setErr("Enter the holiday name.");
    onSave({ ...form, name: form.name.trim(), note: (form.note || "").trim() });
  };
  const preview = form.date ? `${WEEKDAYS_SHORT[hParts(form.date).dow]}, ${fmtLong(form.date)}` : "";
  return (
    <Modal open={open} onClose={onClose} width={520} icon={isEdit ? "pencil" : "calendar-plus"}
      title={isEdit ? "Edit holiday" : "Add holiday"} subtitle={isEdit ? "Update this calendar entry" : "Create a new entry in the holiday calendar"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button iconLeft="check" onClick={submit}>{isEdit ? "Save changes" : "Add holiday"}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Date" required helper={preview}>
            <DateField value={form.date} onChange={(v) => { set("date", v); if (err) setErr(""); }} />
          </Field>
          <Field label="Type" required>
            <Select value={form.type} onChange={(e) => set("type", e.target.value)} options={Object.keys(HOLIDAY_TYPES).map((k) => ({ value: k, label: HOLIDAY_TYPES[k].label }))} />
          </Field>
        </div>
        <Field label="Holiday name" required>
          <TextInput value={form.name} onChange={(e) => { set("name", e.target.value); if (err) setErr(""); }} placeholder="e.g. Hari Kemerdekaan Republik Indonesia" iconLeft="calendar-days" />
        </Field>
        <Field label="Note" helper="Optional — an English label or short context.">
          <TextInput value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Independence Day" />
        </Field>
        <div style={{ padding: "12px 14px", border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Repeats annually</div>
            <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>Recurring holidays roll forward to the same date each year.</div>
          </div>
          <Toggle checked={form.recurring} onChange={(v) => set("recurring", v)} />
        </div>
        {err && <Alert tone="error" title={err} />}
      </div>
    </Modal>
  );
}

/* native date input styled to match TextInput */
function DateField({ value, onChange }) {
  const C = useC();
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ ...FONT, display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 12px", backgroundColor: C.inputBg,
      borderRadius: RADIUS.md, border: `1px solid ${focused ? C.ocean : C.border}`, boxShadow: focused ? C.focusRing : "none", transition: "border-color 0.15s, box-shadow 0.15s" }}>
      <Icon name="calendar" size={15} color={C.textMuted} />
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ flex: 1, background: "transparent", outline: "none", border: "none", fontSize: 13.5, color: C.text, fontFamily: FONT.fontFamily, minWidth: 0, colorScheme: C.scheme }} />
    </div>
  );
}

Object.assign(window, { Holiday, loadHolidays, holidayDateSet });
export { Holiday, loadHolidays, holidayDateSet };
