/* fm2-converted */
import React from "react";
import { RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Flag, Button, IconButton, TableRefreshButton, Badge, Card, TextInput, Field, Select, Textarea, Checkbox, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDateTime, Menu, MenuItem, Modal, DataTable, Pagination, useToast, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard } from "../../../shared/legacy/PrimitivesX.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
/* Alamtri Geo Admin — Languages, Language Text, Settings. */

const LANGUAGES_API = "/api/v1/super-admin/languages";
const LANGUAGE_TEXT_API = "/api/v1/super-admin/language-text";

function _langFetchCollection(url) {
  return fetch(url, { credentials: "include", headers: { Accept: "application/json" } })
    .then((response) => response.ok ? response.json() : null)
    .catch(() => null);
}

function _langPutCollection(url, items) {
  return fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

function _normalizeLanguages(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: item.id ?? (index + 1),
    name: item.name ?? "",
    code: item.code ?? "",
    flag: item.flag ?? "🌐",
    enabled: item.enabled !== false,
    isDefault: !!item.isDefault,
    progress: item.progress ?? 0,
    createdAt: item.createdAt ?? "",
  }));
}

function _normalizeLanguageText(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: item.id ?? (index + 1),
    key: item.key ?? "",
    base: item.base ?? "",
    target: item.target ?? "",
  }));
}

// Seed data is backend-owned (InitialPlatformDataSeeder → core.LANGUAGE_T / LANGUAGE_TEXT_T).
// The frontend only reads; when the backend has no data it shows an empty list (no push).
function _seedLanguagesIfNeeded(payload, setRows) {
  const rows = payload && payload.hasData && payload.items ? _normalizeLanguages(payload.items) : [];
  setRows(rows);
  return Promise.resolve(rows);
}

function _seedLanguageTextIfNeeded(payload, setRows) {
  const rows = payload && payload.hasData && payload.items ? _normalizeLanguageText(payload.items) : [];
  setRows(rows);
  return Promise.resolve(rows);
}

/* ============ Languages ============ */
function AddLanguageModal({ open, onClose, onAdd }) {
  const C = useC();
  const [form, setForm] = React.useState({ name: "", code: "", flag: "🌐", enabled: true });
  React.useEffect(() => { if (open) setForm({ name: "", code: "", flag: "🌐", enabled: true }); }, [open]);
  return (
    <Modal open={open} onClose={onClose} width={460} icon="languages" title="Add language" subtitle="Add a new locale to the platform"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button iconLeft="plus" onClick={() => onAdd(form)}>Add language</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 14 }}>
          <Field label="Language name" required><TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Vietnamese" /></Field>
          <Field label="Code" required><TextInput value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().slice(0, 3) }))} placeholder="vi" /></Field>
        </div>
        <Field label="Flag emoji"><TextInput value={form.flag} onChange={(e) => setForm((f) => ({ ...f, flag: e.target.value }))} placeholder="🌐" /></Field>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }}>
          <div><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Enable immediately</div><div style={{ fontSize: 12, color: C.textMuted }}>Make this language selectable to users.</div></div>
          <Toggle checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
        </div>
      </div>
    </Modal>
  );
}

function Languages({ onNavigate }) {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = React.useState(() => []);
  const [loading, setLoading] = React.useState(false);
  const [add, setAdd] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    _langFetchCollection(LANGUAGES_API)
      .then((payload) => _seedLanguagesIfNeeded(payload, (next) => { if (!cancelled) setRows(next); }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const persistLanguages = React.useCallback((nextRows) => {
    setRows(nextRows);
    void _langPutCollection(LANGUAGES_API, nextRows).catch((error) => {
      console.warn("Language configuration save failed; local state remains active.", error);
    });
  }, []);

  const setDefault = (id) => {
    const nextRows = rows.map((l) => ({ ...l, isDefault: l.id === id, enabled: l.id === id ? true : l.enabled }));
    persistLanguages(nextRows);
    toast.push({ title: "Default language updated", description: `${rows.find((l) => l.id === id).name} is now the default.` });
  };
  const toggleEnabled = (id) => {
    const nextRows = rows.map((l) => (l.id === id && !l.isDefault ? { ...l, enabled: !l.enabled } : l));
    persistLanguages(nextRows);
  };
  const addLang = (form) => {
    if (!form.name || !form.code) { toast.push({ title: "Name and code are required", tone: "error" }); return; }
    const nextRows = [...rows, { id: Math.max(...rows.map((r) => r.id), 0) + 1, ...form, isDefault: false, progress: 0, createdAt: "2026-06-02 09:30" }];
    persistLanguages(nextRows);
    toast.push({ title: "Language added", description: `${form.name} (${form.code}) was added.` }); setAdd(false);
  };

  const columns = [
    { key: "flag", label: "Flag", width: 72, render: (l) => <Flag code={l.code} size={26} /> },
    { key: "name", label: "Name", render: (l) => <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{l.name}</span> },
    { key: "isDefault", label: "Default", width: 110, render: (l) => l.isDefault ? <Badge tone="brand" dot>Default</Badge> : <span style={{ color: C.textSubtle, fontSize: 12.5 }}>—</span> },
    { key: "enabled", label: "Enabled", width: 100, render: (l) => <div onClick={(e) => e.stopPropagation()}><Toggle checked={l.enabled} onChange={() => toggleEnabled(l.id)} disabled={l.isDefault} /></div> },
    { key: "progress", label: "Translation", width: 180, render: (l) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: C.surfaceAlt, overflow: "hidden", minWidth: 70 }}>
          <div style={{ height: "100%", width: `${l.progress}%`, borderRadius: 999, backgroundColor: l.progress === 100 ? C.success : l.progress > 50 ? C.ocean : C.warningText }} /></div>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, width: 34, textAlign: "right" }}>{l.progress}%</span>
      </div>) },
    { key: "createdAt", label: t("common.createdAt"), nowrap: true, render: (l) => <span style={{ color: C.textMuted, fontSize: 12.5 }}>{fmtAppDateTime(l.createdAt)}</span> },
    { key: "_a", label: t("common.actions"), align: "right", width: 150, render: (l) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <Button variant="secondary" size="sm" iconLeft="type" onClick={() => onNavigate("languageText")}>Change texts</Button>
        <Menu align="right" width={170} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="star" label="Set as default" onClick={() => setDefault(l.id)} active={l.isDefault} />
          <MenuItem icon="type" label="Change texts" onClick={() => onNavigate("languageText")} />
        </Menu>
      </div>) },
  ];
  const enabledCount = rows.filter((l) => l.enabled).length;
  return (
    <OpsPage>
      <OpsHero kicker="Super Admin" kickerIcon="crown" title={t("nav.languages")} subtitle="Manage available languages, enablement, and the default locale." compact
        right={<OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setAdd(true)}>Add language</OpsHeroButton>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="languages" label="Languages" value={rows.length} iconTone="brand" />
        <OpsStatCard icon="toggle-right" label="Enabled" value={enabledCount} sub={`${rows.length - enabledCount} disabled`} iconTone="forest" />
        <OpsStatCard icon="star" label="Default" value={(rows.find((l) => l.isDefault) || {}).code || "—"} iconTone="blue" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }} right={<TableRefreshButton onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 600); }} />} />
        </div>
        <DataTable columns={columns} data={rows} loading={loading} dense emptyTitle="No languages" />
      </Card>
      <AddLanguageModal open={add} onClose={() => setAdd(false)} onAdd={addLang} />
    </OpsPage>
  );
}

/* ============ Language Text ============ */
function LanguageText() {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = React.useState(() => []);
  const [languages, setLanguages] = React.useState(() => []);
  const ps = usePageSearch("Search key or value…");
  const q = ps.query, setQ = ps.setQuery;
  const [target, setTarget] = React.useState("id");
  const [onlyMissing, setOnlyMissing] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [loading, setLoading] = React.useState(false);
  const [edit, setEdit] = React.useState(null);
  const [editVal, setEditVal] = React.useState("");

  const hydrate = React.useCallback(() => {
    setLoading(true);
    return Promise.all([
      _langFetchCollection(LANGUAGES_API),
      _langFetchCollection(LANGUAGE_TEXT_API),
    ]).then(([languagePayload, textPayload]) => {
      return Promise.all([
        _seedLanguagesIfNeeded(languagePayload, setLanguages),
        _seedLanguageTextIfNeeded(textPayload, setRows),
      ]);
    }).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const refresh = () => {
    void hydrate().then(() => {
      toast.push({ title: "Refreshed", description: "Translation strings are up to date." });
    });
  };

  const targetName = (languages.find((l) => l.code === target) || {}).name || "Target";
  const filtered = React.useMemo(() => rows.filter((r) => (!onlyMissing || !r.target) && (q === "" || [r.key, r.base, r.target].some((s) => (s || "").toLowerCase().includes(q.toLowerCase())))), [rows, q, onlyMissing]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => { setPage(1); }, [q, onlyMissing]);
  const translated = rows.filter((r) => r.target).length;

  const openEdit = (r) => { setEdit(r); setEditVal(r.target || ""); };
  const saveEdit = () => {
    const nextRows = rows.map((r) => (r.id === edit.id ? { ...r, target: editVal } : r));
    setRows(nextRows);
    void _langPutCollection(LANGUAGE_TEXT_API, nextRows).catch((error) => {
      console.warn("Language text save failed; local state remains active.", error);
    });
    toast.push({ title: "Translation saved", description: edit.key });
    setEdit(null);
  };

  const columns = [
    { key: "key", label: "Key", width: 220, nowrap: true, render: (r) => <span style={{ fontFamily: "monospace", fontSize: 12, color: C.ocean, fontWeight: 600 }}>{r.key}</span> },
    { key: "base", label: "Base value (EN)", render: (r) => <span style={{ color: C.text }}>{r.base}</span> },
    { key: "target", label: `Target value (${target.toUpperCase()})`, render: (r) => r.target
      ? <span style={{ color: C.text }}>{r.target}</span>
      : <Badge tone="warning" dot>Missing</Badge> },
    { key: "_a", label: t("common.actions"), align: "right", width: 70, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="sm" iconLeft="pencil" onClick={() => openEdit(r)}>{t("act.edit")}</Button>
      </div>) },
  ];
  return (
    <OpsPage>
      <OpsHero kicker="Super Admin" kickerIcon="crown" title={t("nav.languageText")} subtitle="Edit translation strings for each enabled locale." compact />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="type" label="Total strings" value={rows.length} iconTone="brand" />
        <OpsStatCard icon="check-circle-2" label="Translated" value={translated} sub={`${rows.length - translated} missing`} iconTone="forest" />
        <OpsStatCard icon="globe" label="Target locale" value={target.toUpperCase()} sub={targetName} iconTone="blue" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 260 }}><TextInput iconLeft="search" placeholder="Search key or value…" value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              <div style={{ width: 170 }}><Select value={target} onChange={(e) => setTarget(e.target.value)} options={languages.filter((l) => l.enabled && !l.isDefault).map((l) => ({ value: l.code, label: l.name }))} /></div>
              <Checkbox checked={onlyMissing} onChange={setOnlyMissing} label="Only missing" />
            </>}
            right={<TableRefreshButton onClick={refresh} />} />
        </div>
        <DataTable columns={columns} data={pageRows} loading={loading} dense onRowClick={openEdit} emptyTitle="No strings found" />
        <div style={{ padding: "4px 16px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} /></div>
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} width={540} icon="type" title="Edit translation" subtitle={edit && edit.key}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button iconLeft="check" onClick={saveEdit}>Save translation</Button></>}>
        {edit && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Translation key"><TextInput value={edit.key} disabled /></Field>
          <Field label="Base value — English"><div style={{ padding: "10px 12px", borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, border: `1px solid ${C.border}`, fontSize: 13.5, color: C.text }}>{edit.base}</div></Field>
          <Field label={`Target value — ${targetName}`} required helper="Use {placeholders} exactly as they appear in the base value.">
            <Textarea value={editVal} onChange={(e) => setEditVal(e.target.value)} rows={3} placeholder="Enter translation…" />
          </Field>
        </div>}
      </Modal>
    </OpsPage>
  );
}

Object.assign(window, { Languages, LanguageText });
export { Languages, LanguageText };
