/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, BrandLockup } from "../../../shared/legacy/Primitives.jsx";
import { Tabs, Modal, Tooltip } from "../../../shared/legacy/PrimitivesX.jsx";
/* About Application — sidebar version badge + modal (Info / Release Notes / Features / Specs).
   Content is backend-owned in core.APPLICATION_ABOUT_T (bilingual en/id). */

const ABOUT_API = "/api/v1/about";

const ABOUT_FALLBACK = {
  version: "1.0.0",
  release: "01-SEP-2026",
  name: { en: "SisTemplate", id: "SisTemplate" },
  description: {
    en: "SisTemplate is the generic internal application foundation: a reusable shell with permission-driven navigation, administration, notifications, and audit workspace ready as the starting point for new internal apps.",
    id: "SisTemplate adalah fondasi aplikasi internal generik: shell yang dapat dipakai ulang dengan navigasi berbasis permission, administrasi, notifikasi, dan ruang kerja audit sebagai titik awal untuk aplikasi internal baru.",
  },
  modules: [],
  features: [],
  releaseNotes: [],
  specifications: [],
};

let _aboutCache = null;
let _aboutPromise = null;

function aboutPick(value, lang) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (lang === "id" && value.id != null && value.id !== "") return String(value.id);
    if (value.en != null && value.en !== "") return String(value.en);
    if (value.id != null) return String(value.id);
  }
  return "";
}

function loadAboutApplication() {
  if (_aboutCache) return Promise.resolve(_aboutCache);
  if (_aboutPromise) return _aboutPromise;
  _aboutPromise = fetch(ABOUT_API, { credentials: "include", headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("about_unavailable"))))
    .then((data) => {
      _aboutCache = {
        version: data.version || ABOUT_FALLBACK.version,
        release: data.release || ABOUT_FALLBACK.release,
        name: data.name || ABOUT_FALLBACK.name,
        description: data.description || ABOUT_FALLBACK.description,
        modules: Array.isArray(data.modules) ? data.modules : [],
        features: Array.isArray(data.features) ? data.features : [],
        releaseNotes: Array.isArray(data.releaseNotes) ? data.releaseNotes : [],
        specifications: Array.isArray(data.specifications) ? data.specifications : [],
      };
      return _aboutCache;
    })
    .catch(() => {
      _aboutCache = ABOUT_FALLBACK;
      return _aboutCache;
    })
    .finally(() => { _aboutPromise = null; });
  return _aboutPromise;
}

function AboutInfoTab({ about, lang }) {
  const C = useC();
  const tt = useTT();
  const modules = about.modules || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13.5, color: C.text, lineHeight: 1.65, textAlign: "justify" }}>
        {aboutPick(about.description, lang)}
      </p>
      <p style={{ margin: 0, fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>
        {tt("This release covers", "Rilis ini mencakup")} <b>{modules.length}</b> {tt("capability areas:", "area kapabilitas:")}
      </p>
      {modules.map((m, i) => (
        <div key={i} style={{ paddingLeft: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            {i + 1}. {aboutPick(m.name, lang)}
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3 }}>
            {(m.items || []).map((item, j) => (
              <li key={j} style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.45 }}>{aboutPick(item, lang)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AboutReleaseNotesTab({ about, lang }) {
  const C = useC();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(about.releaseNotes || []).map((n) => (
        <div key={n.version}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text, textDecoration: "underline", textUnderlineOffset: 3 }}>
              Version {n.version}
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>({n.date})</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 5 }}>
            {(n.items || []).map((item, j) => (
              <li key={j} style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{aboutPick(item, lang)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AboutFeaturesTab({ about, lang }) {
  const C = useC();
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {(about.features || []).map((f, i) => (
        <div key={i} style={{
          padding: "10px 4px",
          borderTop: i === 0 ? `1px solid ${C.borderSoft}` : "none",
          borderBottom: `1px solid ${C.borderSoft}`,
          fontSize: 13, color: C.text, lineHeight: 1.55,
        }}>
          {aboutPick(f, lang)}
        </div>
      ))}
    </div>
  );
}

function AboutSpecificationsTab({ about, lang }) {
  const C = useC();
  const tt = useTT();
  return (
    <table style={{ ...FONT, width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "6px 8px 8px 0", color: C.textMuted, fontWeight: 700, borderBottom: `1px solid ${C.border}`, width: "42%" }}>{tt("Name", "Nama")}</th>
          <th style={{ textAlign: "left", padding: "6px 0 8px", color: C.textMuted, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{tt("Value", "Nilai")}</th>
        </tr>
      </thead>
      <tbody>
        {(about.specifications || []).map((s, i) => (
          s.isSection ? (
            <tr key={"sec-" + i}>
              <td colSpan={2} style={{ padding: "12px 0 4px", fontWeight: 800, color: C.text, fontSize: 12.5 }}>{aboutPick(s.name, lang)}</td>
            </tr>
          ) : (
            <tr key={i}>
              <td style={{ padding: "5px 8px 5px 0", color: C.textMuted, verticalAlign: "top" }}>{aboutPick(s.name, lang)}</td>
              <td style={{ padding: "5px 0", color: C.text, fontWeight: 600, verticalAlign: "top" }}>{s.value}</td>
            </tr>
          )
        ))}
      </tbody>
    </table>
  );
}

function AboutApplicationModal({ open, onClose, about }) {
  const C = useC();
  const { lang } = useI18n();
  const tt = useTT();
  const [tab, setTab] = React.useState("info");
  React.useEffect(() => { if (open) setTab("info"); }, [open]);
  if (!about) return null;
  const appName = aboutPick(about.name, lang);
  const tabs = [
    { id: "info", label: tt("Info", "Info"), icon: "monitor" },
    { id: "release", label: tt("Release Notes", "Catatan Rilis"), icon: "message-square" },
    { id: "features", label: tt("Features", "Fitur"), icon: "code-2" },
    { id: "specs", label: tt("Specifications", "Spesifikasi"), icon: "folder-open" },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={700}
      icon="boxes"
      title={tt("About Application", "Tentang Aplikasi")}
      subtitle={tt("All about", "Semua tentang") + " " + appName + " …"}
      footer={<Button variant="secondary" onClick={onClose}>{tt("Close", "Tutup")}</Button>}
      bodyStyle={{ paddingTop: 16 }}
    >
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <BrandLockup height={36} onDark={C.scheme === "dark"} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.ocean, letterSpacing: "-0.01em", marginBottom: 6 }}>
          {appName}
        </div>
        <div style={{ fontSize: 12.5, color: C.textMuted }}>
          {tt("Version:", "Versi:")}&nbsp;<span style={{ fontWeight: 800, color: C.ocean }}>{about.version}</span>
          &nbsp;&nbsp; {tt("Release date:", "Tanggal rilis:")}&nbsp;<span style={{ fontWeight: 800, color: C.ocean }}>{about.release}</span>
        </div>
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} style={{ marginBottom: 14 }} />
      {tab === "info" && <AboutInfoTab about={about} lang={lang} />}
      {tab === "release" && <AboutReleaseNotesTab about={about} lang={lang} />}
      {tab === "features" && <AboutFeaturesTab about={about} lang={lang} />}
      {tab === "specs" && <AboutSpecificationsTab about={about} lang={lang} />}
    </Modal>
  );
}

/* Sidebar footer trigger — ocean chip. */
function AboutVersionBadge({ compact = false }) {
  const C = useC();
  const tt = useTT();
  const [open, setOpen] = React.useState(false);
  const [about, setAbout] = React.useState(ABOUT_FALLBACK);
  const [hover, setHover] = React.useState(false);
  const versionLabel = String(about.version || "").replace(/^v/i, "");

  React.useEffect(() => {
    let cancelled = false;
    loadAboutApplication().then((data) => { if (!cancelled) setAbout(data); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Tooltip label={tt("About Application", "Tentang Aplikasi")} side={compact ? "right" : "top"}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            ...FONT,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: compact ? 0 : 7,
            height: compact ? 30 : 34,
            minWidth: compact ? 44 : undefined,
            padding: compact ? "0 6px" : "0 12px",
            borderRadius: RADIUS.md,
            border: "none",
            cursor: "pointer",
            backgroundColor: hover ? (C.scheme === "dark" ? "#2f9aa2" : "#0c6b72") : C.ocean,
            color: "#fff",
            fontSize: compact ? 10.5 : 12.5,
            fontWeight: 800,
            letterSpacing: "0.01em",
            transition: "background-color 0.12s",
            boxShadow: hover ? C.shadowSm : "none",
            flexShrink: 0,
          }}
        >
          {compact ? (
            <span>{versionLabel}</span>
          ) : (
            <>
              <Icon name="activity" size={14} color="#fff" />
              {tt("Version", "Versi")} {versionLabel}
            </>
          )}
        </button>
      </Tooltip>
      <AboutApplicationModal open={open} onClose={() => setOpen(false)} about={about} />
    </>
  );
}

Object.assign(window, {
  AboutVersionBadge,
  AboutApplicationModal,
  loadAboutApplication,
  ABOUT_FALLBACK,
  aboutPick,
});
export { AboutVersionBadge, AboutApplicationModal, loadAboutApplication, ABOUT_FALLBACK, aboutPick };
