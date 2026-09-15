/* fm2-converted */
import React from "react";
import { RADIUS, FONT, GRAD, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, IconButton, Badge, Avatar, Card, DetailCard, TextInput, Field, Select, Textarea, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDateTime, Alert, EmptyState, Menu, MenuItem, MenuDivider, Modal, useToast, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard, Spinner } from "../../../shared/legacy/PrimitivesX.jsx";
import { EMAIL_CATEGORIES, EMAIL_TEMPLATES, emailSenderModuleKeyForCategory } from "../../data/legacy/Data.jsx";
import { useSession } from "../../session/legacy/Session.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
import { useSettings } from "../../settings/legacy/SettingsStore.jsx";
/* Alamtri Geo Admin — Email Templates (master-detail + preview) and Email Sent (delivery log). */

const EMAIL_TEMPLATES_API = "/api/v1/super-admin/email-templates";
const CM_EMAIL_TEMPLATES_API = "/api/v1/contract-monitoring/email-templates";
const CM_EMAIL_CATEGORY = "Contract Monitoring";
const EMAIL_SENT_API = "/api/v1/super-admin/email-sent";

function _emailFetchCollection(url) {
  return fetch(url, { credentials: "include", headers: { Accept: "application/json" } })
    .then((response) => response.ok ? response.json() : null)
    .catch(() => null);
}

function _emailPutCollection(url, items) {
  return fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

function _normalizeEmailTemplates(items) {
  return Array.isArray(items) ? items : [];
}

function _emailDaysAgo(sentAt) {
  if (!sentAt) return 0;
  const t = Date.parse(String(sentAt).replace(" ", "T"));
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

// Backend rows (core.EMAIL_SENT_T payloadJson) can be sparse — server-sent emails carry
// {id, category, recipient, email, subject, status, sentAt}. Fill the fields the log/preview read
// (daysAgo derived from sentAt, safe ref/vars/template defaults) so rows render without the former
// client-side outbox and never crash on a missing ref.
function _normalizeEmailSent(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    const id = it.id || it.messageId || it.MessageId || "";
    const sentAt = it.sentAt || it.SentAt || "";
    const category = it.category || it.Category || "";
    const email = it.email || it.to || it.recipient || "";
    return {
      opens: 0, cc: [], tier: null, template: "", templateId: "", vars: {},
      ...it,
      id,
      recipient: it.recipient || email,
      email,
      subject: it.subject || "",
      category,
      status: it.status || it.Status || "Delivered",
      sentAt,
      daysAgo: it.daysAgo != null ? it.daysAgo : _emailDaysAgo(sentAt),
      ref: it.ref || { id, kind: category || "Email", icon: "mail" },
      vars: it.vars || {},
    };
  });
}

// Seed data + shipped template metadata are backend-owned (InitialPlatformDataSeeder →
// core.EMAIL_TEMPLATE_T). The frontend only reads; no fallback constant, no reconcile, no push.
function _seedEmailTemplatesIfNeeded(payload, setRows) {
  const rows = payload && payload.hasData && payload.items ? _normalizeEmailTemplates(payload.items) : [];
  setRows(rows);
  return Promise.resolve(rows);
}

function _seedEmailSentIfNeeded(payload, setRows) {
  if (payload && payload.hasData && payload.items) {
    const rows = _normalizeEmailSent(payload.items);
    setRows(rows);
    return Promise.resolve(rows);
  }

  // Backend-owned; no frontend fallback/seed. Empty until real emails are sent.
  setRows([]);
  return Promise.resolve([]);
}

/* ============ Shared helpers ============ */
const CAT_META = Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c.key, c]));

function HighlightVars({ text }) {
  const C = useC();
  const parts = String(text).split(/(\{[a-zA-Z0-9]+\})/g);
  return parts.map((p, i) =>
    /^\{[a-zA-Z0-9]+\}$/.test(p)
      ? <span key={i} style={{ backgroundColor: C.brandBg, color: C.ocean, fontWeight: 600, padding: "0 4px", borderRadius: 4, fontSize: "0.92em" }}>{p}</span>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

/* Substitute {placeholders} with real values; leftover unknowns stay verbatim. */
function fillVars(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{([a-zA-Z0-9]+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}
/* Return a template with subject/body/cta resolved against a vars map. */
function resolveTemplate(tpl, vars) {
  if (!tpl) return tpl;
  return { ...tpl, subject: fillVars(tpl.subject, vars), body: fillVars(tpl.body, vars), cta: tpl.cta ? fillVars(tpl.cta, vars) : tpl.cta };
}

/* Tier ribbon palette for the Contract Expiry Reminder — fixed hex so the email
   reads the same on a white canvas regardless of the app theme. */
const REMINDER_TONES = {
  info:    { accent: "#2563EB", soft: "#EFF4FE", border: "#C3D7FB" },
  warning: { accent: "#B45309", soft: "#FEF6E7", border: "#F0D49A" },
  orange:  { accent: "#EA580C", soft: "#FEF1E9", border: "#F8CDAE" },
  danger:  { accent: "#DC2626", soft: "#FDECEC", border: "#F6C5C5" },
};
const EMAIL_INK = "#13343F", EMAIL_MUTE = "#5A6B73", EMAIL_LINE = "rgba(1,59,82,0.10)";

/* The Contract Expiry Reminder body: tier ribbon + countdown, intro, a contract
   details table, the styled Note callout, and a tier-coloured CTA. In authoring
   mode (no vars) the table cells show {placeholder} chips; for a sent message the
   resolved values are shown. */
function ReminderEmailBody({ tpl, highlight, vars }) {
  const tone = REMINDER_TONES[tpl.tone] || REMINDER_TONES.info;
  const chip = { ...FONT, backgroundColor: "#E7F0F4", color: "#013B52", fontWeight: 600, padding: "1px 6px", borderRadius: 4, fontSize: "0.92em", fontFamily: "monospace" };
  const field = (key) => highlight
    ? <span style={chip}>{`{${key}}`}</span>
    : <span>{vars && vars[key] != null ? String(vars[key]) : "—"}</span>;
  const days = !highlight && vars && vars.daysToExpiry != null ? `${vars.daysToExpiry} hari lagi` : "{daysToExpiry} hari lagi";
  const rows = [
    ["No. Perjanjian", field("contractNo"), true],
    ["Judul Kontrak", field("contractTitle"), false],
    ["Pemasok", field("supplier"), false],
    ["Jobsite", field("jobsite"), false],
    ["Tanggal Berakhir", field("expiryDate"), false],
  ];
  const intro = (tpl.intro || tpl.body || "").split("\n\n");
  const note = (tpl.note || "").split("\n\n").filter(Boolean);
  return (
    <>
      {/* tier ribbon + countdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, backgroundColor: tone.soft, border: `1px solid ${tone.border}`, borderLeft: `4px solid ${tone.accent}`, marginBottom: 20 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: tone.accent, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={tpl.icon || "bell"} size={16} /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ ...FONT, display: "block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: tone.accent }}>Contract Expiry Reminder</span>
            <span style={{ ...FONT, display: "block", fontSize: 14, fontWeight: 800, color: EMAIL_INK }}>{tpl.tierLabel} sebelum berakhir</span>
          </span>
        </span>
        <span style={{ ...FONT, flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: "#fff", backgroundColor: tone.accent, padding: "5px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>{days}</span>
      </div>

      {/* subject as title */}
      <div style={{ ...FONT, fontSize: 18, fontWeight: 800, color: "#013B52", letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: 18 }}>{highlight ? <HighlightVars text={tpl.subject} /> : tpl.subject}</div>

      {/* intro */}
      {intro.map((p, i) => (
        <p key={i} style={{ ...FONT, fontSize: 13.5, lineHeight: 1.65, color: "#3C4A52", margin: "0 0 14px", whiteSpace: "pre-wrap" }}>{p}</p>
      ))}

      {/* contract details table */}
      <div style={{ border: `1px solid ${EMAIL_LINE}`, borderRadius: 10, overflow: "hidden", margin: "18px 0 20px" }}>
        <div style={{ ...FONT, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: EMAIL_MUTE, padding: "10px 14px", backgroundColor: "#F6F9FA", borderBottom: `1px solid ${EMAIL_LINE}` }}>Detail Perjanjian / Amendment</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map(([label, value, mono], i) => (
              <tr key={i}>
                <td style={{ ...FONT, width: 140, verticalAlign: "top", padding: "9px 14px", fontSize: 12, color: EMAIL_MUTE, fontWeight: 600, borderBottom: i < rows.length - 1 ? `1px solid ${EMAIL_LINE}` : "none", backgroundColor: "#FCFDFD" }}>{label}</td>
                <td style={{ ...FONT, padding: "9px 14px", fontSize: 12.5, color: EMAIL_INK, fontWeight: mono ? 700 : 500, fontFamily: mono ? "monospace" : undefined, borderBottom: i < rows.length - 1 ? `1px solid ${EMAIL_LINE}` : "none" }}>{value}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...FONT, padding: "9px 14px", fontSize: 12, color: EMAIL_MUTE, fontWeight: 600, backgroundColor: tone.soft }}>Sisa Waktu</td>
              <td style={{ ...FONT, padding: "9px 14px", fontSize: 13, color: tone.accent, fontWeight: 800, backgroundColor: tone.soft }}>{highlight ? <span style={chip}>{"{daysToExpiry}"}</span> : (vars && vars.daysToExpiry != null ? vars.daysToExpiry : "—")} hari</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Note callout */}
      {note.length > 0 && (
        <div style={{ borderRadius: 10, backgroundColor: tone.soft, border: `1px solid ${tone.border}`, padding: "14px 16px", margin: "0 0 20px" }}>
          <div style={{ ...FONT, display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: tone.accent, marginBottom: 8 }}><Icon name="info" size={14} />Note</div>
          {note.map((p, i) => (
            <p key={i} style={{ ...FONT, fontSize: 12.5, lineHeight: 1.6, color: "#3C4A52", margin: i === note.length - 1 ? 0 : "0 0 10px" }}>{p}</p>
          ))}
        </div>
      )}

      {/* SLA reference tables (image templates per procurement method) */}
      {Array.isArray(tpl.slaImages) && tpl.slaImages.length > 0 && (
        <div style={{ margin: "0 0 20px" }}>
          <div style={{ ...FONT, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: EMAIL_MUTE, marginBottom: 10 }}>Tabel SLA Pengadaan</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tpl.slaImages.map((img, i) => (
              <div key={i} style={{ border: `1px solid ${EMAIL_LINE}`, borderRadius: 8, overflow: "hidden" }}>
                <img src={img.src} alt={img.label || "Tabel SLA Pengadaan"} style={{ display: "block", width: "100%", height: "auto" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {tpl.cta && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", background: tone.accent, color: "#fff", fontSize: 13.5, fontWeight: 700, borderRadius: 10 }}><Icon name="file-up" size={16} />{tpl.cta}</span>
        </div>
      )}
      <p style={{ ...FONT, fontSize: 12.5, lineHeight: 1.6, color: EMAIL_MUTE, margin: "16px 0 0" }}>Terima kasih atas perhatian dan kerja samanya.<br /><span style={{ color: EMAIL_INK, fontWeight: 700 }}>Tim Contract Monitoring</span> — Vendor Onboarding, Alamtri Geo</p>
    </>
  );
}

/* Rendered email specimen — header, subject, body, optional CTA, footer.
   highlight=true shows {placeholders} as chips (template authoring);
   highlight=false renders resolved copy (an actual sent message).
   When tpl.tier is set the body uses the dedicated Contract Expiry Reminder layout. */
function EmailPreview({ tpl, highlight = true, vars = null }) {
  const C = useC();
  if (!tpl) return null;
  const paras = tpl.body.split("\n\n");
  const Txt = ({ text }) => highlight ? <HighlightVars text={text} /> : <>{text}</>;
  return (
    <div style={{ backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, padding: 22 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#FFFFFF", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadowSm }}>
        {/* email header */}
        <div style={{ background: GRAD.primary, padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src="/assets/alamtri-logo-on-dark.png" alt="AlamTri geo" style={{ height: 28, display: "block" }} />
          <span style={{ ...FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>{tpl.category}</span>
        </div>
        {/* email body */}
        <div style={{ padding: "30px 32px 34px" }}>
          {tpl.tier ? <ReminderEmailBody tpl={tpl} highlight={highlight} vars={vars} /> : (
            <>
              <div style={{ ...FONT, fontSize: 18, fontWeight: 800, color: "#013B52", letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: 20 }}><Txt text={tpl.subject} /></div>
              {paras.map((p, i) => (
                <p key={i} style={{ ...FONT, fontSize: 13.5, lineHeight: 1.65, color: "#3C4A52", margin: "0 0 14px", whiteSpace: "pre-wrap" }}><Txt text={p} /></p>
              ))}
              {tpl.cta && (
                <div style={{ marginTop: 22 }}>
                  <span style={{ ...FONT, display: "inline-flex", alignItems: "center", padding: "11px 22px", background: "#013B52", color: "#fff", fontSize: 13.5, fontWeight: 600, borderRadius: RADIUS.md }}>{tpl.cta}</span>
                </div>
              )}
            </>
          )}
        </div>
        {/* email footer */}
        <div style={{ borderTop: "1px solid rgba(1,59,82,0.10)", padding: "16px 32px", backgroundColor: "#FBFCFC" }}>
          <div style={{ ...FONT, fontSize: 11, color: "#8A969D", lineHeight: 1.5 }}>Alamtri Geo · Internal operations platform<br />You're receiving this email as a registered user of the platform. This is an automated message — please do not reply.</div>
        </div>
      </div>
    </div>
  );
}

/* ============ Email Templates ============ */
function TemplateModal({ open, onClose, mode, initial, onSave, lockedCategory }) {
  const C = useC();
  const [form, setForm] = React.useState(initial || {});
  React.useEffect(() => { if (open) setForm(initial || { name: "", category: lockedCategory || EMAIL_CATEGORIES[0].key, subject: "", body: "", cta: "", status: "Draft", variables: [] }); }, [open, initial, lockedCategory]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const detectedVars = React.useMemo(() => {
    const found = new Set();
    `${form.subject || ""} ${form.body || ""}`.replace(/\{[a-zA-Z0-9]+\}/g, (m) => { found.add(m); return m; });
    return [...found];
  }, [form.subject, form.body]);
  const insertVar = (v) => set("body", `${form.body || ""}${v}`);
  const save = () => onSave({ ...form, category: lockedCategory || form.category, variables: detectedVars });

  return (
    <Modal open={open} onClose={onClose} width={720} icon={mode === "edit" ? "pencil" : "plus"}
      title={mode === "edit" ? "Edit email template" : "New email template"}
      subtitle={mode === "edit" ? initial && initial.id : "Author a new transactional email"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button iconLeft="check" onClick={save}>{mode === "edit" ? "Save template" : "Create template"}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14 }}>
          <Field label="Template name" required><TextInput value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Account created" /></Field>
          <Field label="Category" required>{lockedCategory
            ? <TextInput value={lockedCategory} disabled />
            : <Select value={form.category || EMAIL_CATEGORIES[0].key} onChange={(e) => set("category", e.target.value)} options={EMAIL_CATEGORIES.map((c) => ({ value: c.key, label: c.key }))} />}</Field>
        </div>
        <Field label="Subject line" required helper="Use {placeholders} for dynamic values — they're substituted at send time.">
          <TextInput value={form.subject || ""} onChange={(e) => set("subject", e.target.value)} placeholder="Your account is ready" />
        </Field>
        <Field label="Email body" required>
          <Textarea value={form.body || ""} onChange={(e) => set("body", e.target.value)} rows={8} placeholder="Hello {name}, …" />
        </Field>
        <Field label="Call-to-action button" helper="Leave empty for emails without a button (e.g. verification codes).">
          <TextInput value={form.cta || ""} onChange={(e) => set("cta", e.target.value)} placeholder="Sign in to your workspace" />
        </Field>
        <div>
          <div style={{ ...FONT, fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 8 }}>Common variables</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {["{name}", "{username}", "{loginUrl}", "{code}", "{amount}", "{dueDate}", "{resetUrl}", "{prId}", "{contractNo}", "{expiryDate}", "{daysToExpiry}", "{jobsite}"].map((v) => (
              <button key={v} onClick={() => insertVar(v)} style={{ ...FONT, fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: C.ocean, backgroundColor: C.brandBg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: "4px 9px", cursor: "pointer" }}>{v}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }}>
          <div><div style={{ ...FONT, fontSize: 13, fontWeight: 600, color: C.text }}>Active</div><div style={{ ...FONT, fontSize: 12, color: C.textMuted }}>Active templates are used for live sends. Drafts are not.</div></div>
          <Toggle checked={form.status === "Active"} onChange={(v) => set("status", v ? "Active" : "Draft")} />
        </div>
      </div>
    </Modal>
  );
}

function emailNowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function nextTemplateId(rows, lockedCategory) {
  const used = new Set((rows || []).map((r) => r.id));
  if (lockedCategory) {
    let n = 1;
    let id;
    do { id = `ET-CM-${String(n).padStart(4, "0")}`; n += 1; } while (used.has(id));
    return id;
  }
  let n = (rows || []).length + 1;
  let id;
  do { id = `ET-${String(n).padStart(2, "0")}`; n += 1; } while (used.has(id));
  return id;
}

function EmailTemplates({ lockedCategory } = {}) {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const session = useSession();
  const editorName = (session && session.actingUser && session.actingUser.name) || "System";
  const templatesApi = lockedCategory ? CM_EMAIL_TEMPLATES_API : EMAIL_TEMPLATES_API;
  const [rows, setRows] = React.useState(() => []);
  const [selId, setSelId] = React.useState(() => undefined);
  const ps = usePageSearch("Search templates…");
  const q = ps.query, setQ = ps.setQuery;
  const [catF, setCatF] = React.useState(lockedCategory || "all");
  const [modal, setModal] = React.useState(null); // { mode, initial }

  const canView = !lockedCategory
    || (session && session.can && (session.can("email.templates.view") || session.can("masterData.contractMonitoring.manage")));
  const canManage = !lockedCategory
    || (session && session.can && (session.can("email.templates.manage") || session.can("masterData.contractMonitoring.manage")));
  const canSendTest = session && session.can && session.can("settings.update");
  const impersonationPending = !!(lockedCategory && session && session.isImpersonating && !(session.permissions && session.permissions.length));

  React.useEffect(() => {
    if (impersonationPending || (lockedCategory && !canView)) return undefined;
    let cancelled = false;
    _emailFetchCollection(templatesApi)
      .then((payload) => _seedEmailTemplatesIfNeeded(payload, (next) => { if (!cancelled) setRows(next); }))
      .catch(() => null);
    return () => { cancelled = true; };
  }, [templatesApi, impersonationPending, lockedCategory, canView]);

  const persistTemplates = React.useCallback((nextRows) => {
    setRows(nextRows);
    void _emailPutCollection(templatesApi, nextRows).catch((error) => {
      console.warn("Email templates save failed; local state remains active.", error);
    });
  }, [templatesApi]);

  const list = rows.filter((r) => (lockedCategory || catF === "all" || r.category === catF) && (q === "" || [r.name, r.subject, r.category].some((s) => String(s || "").toLowerCase().includes(q.toLowerCase()))));
  const sel = rows.find((r) => r.id === selId) || list[0] || rows[0];
  React.useEffect(() => { if (sel && !list.find((r) => r.id === selId) && list[0]) setSelId(list[0].id); }, [catF, q, lockedCategory]);

  const activeCount = rows.filter((r) => r.status === "Active").length;

  const saveTemplate = (form) => {
    const nextForm = lockedCategory ? { ...form, category: lockedCategory } : form;
    if (!nextForm.name || !nextForm.subject || !nextForm.body) { toast.push({ title: "Name, subject, and body are required", tone: "error" }); return; }
    if (modal.mode === "edit") {
      const nextRows = rows.map((r) => (r.id === modal.initial.id ? { ...r, ...nextForm, updatedAt: emailNowStamp(), updatedBy: editorName } : r));
      persistTemplates(nextRows);
      toast.push({ title: "Template saved", description: `${nextForm.name} was updated.` });
    } else {
      const id = nextTemplateId(rows, lockedCategory);
      const meta = CAT_META[nextForm.category] || { icon: "mail" };
      const nextRows = [...rows, { ...nextForm, id, icon: meta.icon, updatedAt: emailNowStamp(), updatedBy: editorName }];
      persistTemplates(nextRows);
      setSelId(id);
      toast.push({ title: "Template created", description: `${nextForm.name} was added.` });
    }
    setModal(null);
  };
  const duplicate = (r) => {
    const id = nextTemplateId(rows, lockedCategory);
    persistTemplates([...rows, { ...r, id, category: lockedCategory || r.category, name: `${r.name} (copy)`, status: "Draft", updatedAt: emailNowStamp(), updatedBy: editorName }]);
    setSelId(id); toast.push({ title: "Template duplicated", description: `${r.name} (copy) was created as a draft.` });
  };
  const remove = (r) => {
    if (!window.confirm(`Delete template "${r.name}"? This cannot be undone.`)) return;
    persistTemplates(rows.filter((x) => x.id !== r.id)); toast.push({ title: "Template deleted", tone: "error" });
  };
  const toggleStatus = (r) => persistTemplates(rows.map((x) => (x.id === r.id ? { ...x, status: x.status === "Active" ? "Draft" : "Active" } : x)));

  if (impersonationPending) {
    return <OpsPage><div style={{ padding: 48, display: "flex", justifyContent: "center" }}><Spinner size={22} /></div></OpsPage>;
  }
  if (lockedCategory && !canView) {
    return <OpsPage><EmptyState icon="shield-off" title="Access denied" description="You do not have permission to manage Contract Monitoring email templates." /></OpsPage>;
  }

  return (
    <OpsPage>
      <OpsHero kicker={lockedCategory ? "Contract Monitoring" : "Super Admin"} kickerIcon={lockedCategory ? "file-text" : "crown"} title={t("nav.emailTemplates")} subtitle={lockedCategory ? "Author and manage Contract Monitoring reminder emails — subjects, body copy, and dynamic variables." : "Author and manage the transactional emails the platform sends — subjects, body copy, and dynamic variables."} compact
        right={canManage ? <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "new" })}>New template</OpsHeroButton> : null} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="mail" label="Templates" value={rows.length} iconTone="brand" />
        <OpsStatCard icon="check-circle-2" label="Active" value={activeCount} iconTone="forest" />
        <OpsStatCard icon="file-pen" label="Drafts" value={rows.length - activeCount} iconTone="orange" />
      </OpsStatGrid>

      <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 16, alignItems: "start" }} className="ag-rp-grid">
        {/* List */}
        <Card pad={0} style={{ position: "sticky", top: 88 }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${C.borderSoft}`, display: "flex", flexDirection: "column", gap: 9, flexShrink: 0 }}>
            <div ref={ps.ref}><TextInput size="sm" iconLeft="search" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
            {!lockedCategory && <Select size="sm" value={catF} onChange={(e) => setCatF(e.target.value)} options={[{ value: "all", label: "All categories" }, ...EMAIL_CATEGORIES.map((c) => ({ value: c.key, label: c.key }))]} />}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}><b style={{ color: C.text }}>{list.length}</b> {t("common.results")}</span>
              {(q || (!lockedCategory && catF !== "all")) && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); if (!lockedCategory) setCatF("all"); }}>{t("act.clear")}</Button>}
            </div>
          </div>
          <div style={{ padding: 6, maxHeight: 560, overflowY: "auto" }}>
            {list.length === 0 && <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12.5, color: C.textMuted }}>No templates match.</div>}
            {list.map((r) => {
              const active = r.id === sel.id;
              const cm = CAT_META[r.category] || { tone: "neutral", icon: "mail" };
              const tone = { brand: { bg: C.brandBg, fg: C.ocean }, danger: { bg: C.dangerBg, fg: C.danger }, info: { bg: C.infoBg, fg: C.info }, success: { bg: C.successBg, fg: C.success }, orange: { bg: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)", fg: C.orange }, neutral: { bg: C.surfaceAlt, fg: C.textMuted } }[cm.tone] || { bg: C.surfaceAlt, fg: C.textMuted };
              return (
                <button key={r.id} onClick={() => setSelId(r.id)} style={{ ...FONT, display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "10px 10px", border: "none", textAlign: "left",
                  backgroundColor: active ? C.active : "transparent", borderRadius: RADIUS.md, cursor: "pointer", marginBottom: 2 }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = C.hover; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <span style={{ width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: tone.bg, color: tone.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><Icon name={r.icon} size={16} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{r.name}</span>
                      {r.status === "Draft" && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.textSubtle, flexShrink: 0 }} title="Draft" />}
                    </span>
                    <span style={{ display: "block", fontSize: 11.5, color: C.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subject}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Detail */}
        {sel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailCard
              title={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>{sel.name}
                <Badge tone={(CAT_META[sel.category] || {}).tone}>{sel.category}</Badge>
                {sel.status === "Active" ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral" dot>Draft</Badge>}</span>}
              subtitle={`${sel.id} · Updated ${fmtAppDateTime(sel.updatedAt)} by ${sel.updatedBy}`}
              action={<div style={{ display: "flex", gap: 8 }}>
                {canSendTest && <Button variant="secondary" size="sm" iconLeft="send" onClick={() => {
                  fetch("/api/v1/super-admin/settings/test-email", {
                    method: "POST", credentials: "include",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({
                      subject: sel.subject,
                      body: sel.body || "",
                      cta: sel.cta || "",
                      module: emailSenderModuleKeyForCategory(sel.category),
                    }),
                  })
                    .then(async (r) => {
                      const data = await r.json().catch(() => null);
                      if (r.ok && data && data.delivered) toast.push({ title: "Test email sent", description: `A preview of "${sel.name}" was sent to ${data.to}.` });
                      else if (r.ok) toast.push({ tone: "error", title: "Send failed", description: "Delivery failed — check the Email Sent log." });
                      else toast.push({ tone: "error", title: "Send failed", description: (data && data.message) || "Fill the To (test) field for this module in Settings first." });
                    })
                    .catch(() => toast.push({ tone: "error", title: "Send failed", description: "Backend unavailable." }));
                }}>Send test</Button>}
                {canManage && <Button size="sm" iconLeft="pencil" onClick={() => setModal({ mode: "edit", initial: sel })}>{t("act.edit")}</Button>}
                {canManage && <Menu align="right" width={190} trigger={<IconButton name="more-horizontal" size="sm" variant="secondary" />}>
                  <MenuItem icon={sel.status === "Active" ? "pause" : "play"} label={sel.status === "Active" ? "Set as draft" : "Set as active"} onClick={() => toggleStatus(sel)} />
                  <MenuItem icon="copy" label="Duplicate" onClick={() => duplicate(sel)} />
                  <MenuDivider />
                  <MenuItem icon="trash-2" label={t("act.delete")} danger onClick={() => remove(sel)} />
                </Menu>}
              </div>}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 28px", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textSubtle, marginBottom: 5 }}>Subject line</div>
                  <div style={{ fontSize: 13.5, color: C.text, fontWeight: 500 }}><HighlightVars text={sel.subject} /></div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textSubtle, marginBottom: 5 }}>Variables ({(sel.variables || []).length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(sel.variables || []).length === 0 ? <span style={{ fontSize: 12.5, color: C.textMuted }}>None</span> :
                      sel.variables.map((v) => <span key={v} style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 600, color: C.ocean, backgroundColor: C.brandBg, padding: "2px 8px", borderRadius: RADIUS.sm }}>{v}</span>)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textSubtle, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}><Icon name="eye" size={13} /> Preview</div>
              <div style={{ ...FONT, fontSize: 12, color: C.textMuted, lineHeight: 1.5, margin: "-2px 0 12px" }}>The branded header, subject, button, and footer are applied when the email is sent. You edit the body text; placeholders such as {"{resetUrl}"} are filled at send time.</div>
              <EmailPreview tpl={sel} />
            </DetailCard>
          </div>
        )}
      </div>

      <TemplateModal open={!!modal} onClose={() => setModal(null)} mode={modal && modal.mode} initial={modal && modal.initial} onSave={saveTemplate} lockedCategory={lockedCategory} />
    </OpsPage>
  );
}

function CmEmailTemplates() {
  return <EmailTemplates lockedCategory={CM_EMAIL_CATEGORY} />;
}

/* ============ Email Sent — Sent Items mailbox ============ */
// We deliver via SMTP/gateway and cannot detect email opens, so there is no "Opened" state —
// the delivery lifecycle ends at Delivered/Failed (Skipped = sender/recipient missing, never attempted).
const SENT_STATUS = {
  Delivered: { tone: "info", icon: "check-check" },
  Failed: { tone: "danger", icon: "alert-circle" },
  Skipped: { tone: "warning", icon: "alert-triangle" },
};
const SENT_STATUS_FALLBACK = { tone: "neutral", icon: "mail" };
const SENT_STEPS = ["Queued", "Sent", "Delivered"];
function stepsReached(status) {
  if (status === "Delivered") return 3;
  return 2; // Failed / Skipped reach Sent, then stop
}
/* Compact horizontal delivery stepper for the reading pane. */
function MiniTimeline({ status }) {
  const C = useC();
  const reached = stepsReached(status);
  const failed = status === "Bounced" || status === "Failed";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
      {SENT_STEPS.map((step, i) => {
        const done = i < reached;
        const isFailPoint = failed && i === reached;
        const color = isFailPoint ? C.danger : done ? C.success : C.textSubtle;
        const last = i === SENT_STEPS.length - 1;
        return (
          <React.Fragment key={step}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: (done || isFailPoint) ? color : "transparent", border: `2px solid ${(done || isFailPoint) ? color : C.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {done && <Icon name="check" size={9} color="#fff" strokeWidth={3} />}
                {isFailPoint && <Icon name="x" size={9} color="#fff" strokeWidth={3} />}
              </span>
              <span style={{ ...FONT, fontSize: 11.5, fontWeight: 600, color: (done || isFailPoint) ? C.text : C.textSubtle }}>{isFailPoint ? status : step}</span>
            </span>
            {!last && <span style={{ width: 22, height: 2, backgroundColor: i < reached - 1 ? C.success : C.border, margin: "0 8px" }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* Outlook-style metadata row (label + value). */
function MetaRow({ label, children }) {
  const C = useC();
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 12.5, lineHeight: 1.6 }}>
      <span style={{ width: 48, flexShrink: 0, color: C.textSubtle, fontWeight: 600 }}>{label}</span>
      <span style={{ color: C.text, minWidth: 0 }}>{children}</span>
    </div>
  );
}

function ReadingPane({ row, onResend, toast }) {
  const C = useC();
  const { s } = useSettings(); // sender addresses are configured in Settings, not hardcoded
  if (!row) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <EmptyState icon="mail" title="Select a message" description="Choose a sent email from the list to view the full message, recipient, and delivery status." />
      </div>
    );
  }
  const baseTpl = (typeof EMAIL_TEMPLATES !== "undefined" ? EMAIL_TEMPLATES : []).find((t) => t.id === row.templateId);
  const fromAddr = (/vendor/i.test(row.category || "") ? s.fromVendor : s.fromProc) || s.fromProc || s.fromVendor || "";
  const resolved = baseTpl ? resolveTemplate(baseTpl, row.vars) : { ...row, body: "", category: row.category, cta: null };
  const meta = SENT_STATUS[row.status] || SENT_STATUS_FALLBACK;
  const cm = CAT_META[row.category] || {};
  const failed = row.status === "Bounced" || row.status === "Failed";
  const refTone = { brand: { bg: C.brandBg, fg: C.ocean }, danger: { bg: C.dangerBg, fg: C.danger }, info: { bg: C.infoBg, fg: C.info }, success: { bg: C.successBg, fg: C.success }, orange: { bg: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)", fg: C.orange }, neutral: { bg: C.surfaceAlt, fg: C.textMuted } }[cm.tone] || { bg: C.surfaceAlt, fg: C.textMuted };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0 }}>
        <Badge tone={meta.tone} dot>{row.status}</Badge>
        <span style={{ fontSize: 11.5, color: C.textMuted, fontFamily: "monospace" }}>{row.id}</span>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" size="sm" iconLeft="rotate-cw" onClick={() => onResend(row)}>Resend</Button>
        <Button variant="secondary" size="sm" iconLeft="download" onClick={() => toast.push({ title: "Message downloaded", description: `${row.id}.eml` })}>Download</Button>
        <Menu align="right" width={196} trigger={<IconButton name="more-horizontal" size="sm" variant="secondary" />}>
          <MenuItem icon="printer" label="Print message" onClick={() => toast.push({ title: "Opening print view…" })} />
          <MenuItem icon="external-link" label={`Open ${row.ref.kind.toLowerCase()}`} onClick={() => toast.push({ title: `${row.ref.kind} ${row.ref.id}`, description: "Opening the linked record…" })} />
          <MenuItem icon="copy" label="Copy recipient address" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(row.email); toast.push({ title: "Address copied" }); }} />
        </Menu>
      </div>

      {/* scrollable message */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 28px" }}>
        <h3 style={{ ...FONT, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.01em", lineHeight: 1.3, margin: "0 0 16px" }}>{resolved.subject}</h3>

        {/* sender / recipient header */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 16, borderBottom: `1px solid ${C.borderSoft}` }}>
          <span style={{ width: 40, height: 40, borderRadius: RADIUS.md, background: GRAD.primary, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="send" size={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Alamtri Geo Platform</span>
              <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: "nowrap", flexShrink: 0 }}>{fmtAppDateTime(row.sentAt)}</span>
            </div>
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              <MetaRow label="From">{fromAddr || "—"}</MetaRow>
              <MetaRow label="To"><span style={{ fontWeight: 600 }}>{row.recipient}</span> <span style={{ color: C.textMuted }}>&lt;{row.email}&gt;</span></MetaRow>
              <MetaRow label="Category"><Badge tone={cm.tone || "neutral"} size="sm">{row.category}</Badge></MetaRow>
            </div>
          </div>
        </div>

        {/* linked transaction + delivery status */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: refTone.bg, color: refTone.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={row.ref.icon} size={15} /></span>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textSubtle }}>Sent for {row.ref.kind}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{row.ref.id}</div>
            </div>
          </div>
          <MiniTimeline status={row.status} />
        </div>

        {failed && (
          <div style={{ marginTop: 16 }}>
            <Alert tone="error" title={`Delivery ${row.status.toLowerCase()}`} description={row.status === "Bounced" ? "The recipient's mail server rejected this message. Verify the address and resend." : "This message could not be sent. Try resending — if it keeps failing, contact your administrator."} />
          </div>
        )}

        {/* full rendered email */}
        <div style={{ marginTop: 16 }}>
          <EmailPreview tpl={resolved} highlight={false} vars={row.vars} />
        </div>
      </div>
    </div>
  );
}

function EmailSentMailbox({ reminderOnly = false }) {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = React.useState(() => []);
  const ps = usePageSearch(reminderOnly ? "Search recipient, contract, subject..." : "Search recipient, subject, ref...");
  const q = ps.query, setQ = ps.setQuery;
  const [statusF, setStatusF] = React.useState("all");
  const [moduleF, setModuleF] = React.useState("all");
  const [range, setRange] = React.useState("all");
  const [selId, setSelId] = React.useState(() => {
    return null;
  });
  const rangeMax = { today: 0, "7d": 7, "30d": 30, all: 9999 }[range];

  React.useEffect(() => {
    let cancelled = false;
    _emailFetchCollection(EMAIL_SENT_API)
      .then((payload) => _seedEmailSentIfNeeded(payload, (next) => { if (!cancelled) setRows(next); }))
      .catch(() => null);
    return () => { cancelled = true; };
  }, []);

  // Backend is the single source of truth for the delivery log (no client-side outbox merge).
  const mergedRows = React.useMemo(() =>
    reminderOnly ? rows.filter((r) => r.category === "Contract Monitoring") : rows,
  [rows, reminderOnly]);

  const sentToday = mergedRows.filter((r) => r.daysAgo === 0).length;
  const failed = mergedRows.filter((r) => r.status === "Bounced" || r.status === "Failed").length;

  const filtered = React.useMemo(() => mergedRows.filter((a) =>
    (reminderOnly ? (statusF === "all" || a.status === statusF) : (moduleF === "all" || a.category === moduleF)) && a.daysAgo <= rangeMax &&
    (q === "" || [a.recipient, a.email, a.subject, a.template, a.category, a.id, a.ref.id].some((s) => s.toLowerCase().includes(q.toLowerCase())))
  ).sort((a, b) => b.sentAt.localeCompare(a.sentAt)), [mergedRows, q, statusF, moduleF, range, reminderOnly]);

  const sel = mergedRows.find((r) => r.id === selId);
  React.useEffect(() => { if (!filtered.find((r) => r.id === selId)) setSelId(filtered[0] ? filtered[0].id : null); }, [q, statusF, moduleF, range]);

  const resend = (row) => { setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: "Delivered" } : r))); toast.push({ title: "Email resent", description: `${row.subject} was re-queued to ${row.email}.` }); };

  const snippetFor = (r) => {
    const tpl = (typeof EMAIL_TEMPLATES !== "undefined" ? EMAIL_TEMPLATES : []).find((x) => x.id === r.templateId);
    return tpl ? fillVars(tpl.body.split("\n\n")[0], r.vars) : "";
  };

  return (
    <OpsPage>
      <OpsHero kicker={reminderOnly ? "Contract Monitoring" : "Super Admin"} kickerIcon={reminderOnly ? "file-text" : "crown"}
        title={reminderOnly ? t("nav.reminderSent") : t("nav.emailSent")}
        subtitle={reminderOnly ? "Contract Monitoring reminder emails sent to PICs and stakeholders, with delivery state and linked contract reference." : "Every transactional email the platform has generated and sent - open a message to confirm it was composed and delivered for its action or transaction."}
        compact
        right={<OpsHeroButton variant="secondary" iconLeft="download" onClick={() => toast.push({ title: "Export started", description: `${filtered.length} records queued for CSV export.` })}>{t("act.export")}</OpsHeroButton>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="send" label="Total sent" value={mergedRows.length} iconTone="brand" />
        <OpsStatCard icon="calendar" label="Today" value={sentToday} iconTone="blue" />
        <OpsStatCard icon="alert-circle" label="Bounced / failed" value={failed} iconTone={failed ? "danger" : "forest"} />
      </OpsStatGrid>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" }} className="ag-mailbox">
        {/* List card */}
        <Card pad={0} style={{ overflow: "hidden", height: "calc(100vh - 290px)", minHeight: 560, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${C.borderSoft}`, display: "flex", flexDirection: "column", gap: 9, flexShrink: 0 }}>
            <div ref={ps.ref}><TextInput size="sm" iconLeft="search" placeholder={reminderOnly ? "Search recipient, contract, subject..." : "Search recipient, subject, ref..."} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><Select size="sm" value={reminderOnly ? statusF : moduleF} onChange={(e) => reminderOnly ? setStatusF(e.target.value) : setModuleF(e.target.value)} options={reminderOnly ? [{ value: "all", label: "All statuses" }, ...Object.keys(SENT_STATUS).map((s) => ({ value: s, label: s }))] : [{ value: "all", label: "All modules" }, ...EMAIL_CATEGORIES.map((c) => ({ value: c.key, label: c.key }))]} /></div>
              <div style={{ flex: 1 }}><Select size="sm" value={range} onChange={(e) => setRange(e.target.value)} options={[{ value: "today", label: "Today" }, { value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" }, { value: "all", label: "All time" }]} /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}><b style={{ color: C.text }}>{filtered.length}</b> {t("common.results")}</span>
              {(q || statusF !== "all" || moduleF !== "all" || range !== "all") && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setStatusF("all"); setModuleF("all"); setRange("all"); }}>{t("act.clear")}</Button>}
            </div>
          </div>
          {/* list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.length === 0 && <div style={{ padding: "40px 20px" }}><EmptyState icon="search-x" title="No emails found" description={reminderOnly ? "No Contract Monitoring reminder emails match your current filters." : "No sent emails match your current filters."} /></div>}
            {filtered.map((r) => {
              const active = sel && r.id === sel.id;
              const m = SENT_STATUS[r.status] || SENT_STATUS_FALLBACK;
              const dot = { success: C.success, info: C.info, warning: C.warningText, danger: C.danger, neutral: C.textMuted }[m.tone];
              const cm = CAT_META[r.category] || { tone: "neutral" };
              return (
                <button key={r.id} onClick={() => setSelId(r.id)} style={{ ...FONT, position: "relative", display: "block", width: "100%", textAlign: "left", border: "none",
                  borderBottom: `1px solid ${C.borderSoft}`, padding: "12px 16px 12px 18px", cursor: "pointer",
                  backgroundColor: active ? C.active : "transparent" }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = C.hover; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                  {active && <span style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, backgroundColor: C.ocean }} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                    <Avatar name={r.recipient} size={24} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.recipient}</span>
                    <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", flexShrink: 0 }}>{fmtAppDateTime(r.sentAt)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{r.subject}</div>
                  <div style={{ fontSize: 11.5, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 7 }}>{snippetFor(r)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: dot }}><span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: dot }} />{r.status}</span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: C.textSubtle }} />
                    <Badge tone={cm.tone} size="sm">{r.category}</Badge>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: C.textSubtle }} />
                    <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.ref.id}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
        {/* Reading pane card */}
        <Card pad={0} style={{ overflow: "hidden", height: "calc(100vh - 290px)", minHeight: 560 }}>
          <ReadingPane row={sel} onResend={resend} toast={toast} />
        </Card>
      </div>
    </OpsPage>
  );
}

function EmailSent() {
  return <EmailSentMailbox />;
}

function ReminderSent() {
  return <EmailSentMailbox reminderOnly />;
}

Object.assign(window, { EmailTemplates, CmEmailTemplates, EmailSent, ReminderSent });
export { EmailTemplates, CmEmailTemplates, EmailSent, ReminderSent };
