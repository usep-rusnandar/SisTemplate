/* fm3-converted */
import React from "react";
import { CIP_AUTHORIZATION_BANDS, CIP_AUTH_MASTER_EVENT, CIP_CONTRACT_CELL, CIP_CONTRACT_FIELD_GROUPS, CIP_CONTRACT_SIGNING_NOTES, CIP_CONTRACT_SIGNING_ROLES, CIP_CONTRACT_SIGNING_SECTIONS, CIP_DOCTYPES, CIP_PHASES, CIP_STAGE, CIP_STATUS, CIP_TEMPLATES, CIP_TEMPLATE_MERGE_KEYS, CIP_TERMSHEET_TEMPLATE_FIELDS, CIP_TERMSHEET_TEMPLATE_META, CIP_TPL_CAT, CIP_TPL_CATS, CIP_USD_RATE, cipAuthMasterSnapshot, cipAuthorizationCell, cipAuthorizationForCase, cipContractMatrixCell, cipContractSigningForCase, cipDefaultAuthMaster, cipPhaseForStage, cipPhaseIdx, cipRepositoryDocs, cipResolveDocumentUrl, cipSaveAuthMaster, cipTemplateCleanupIssues, cipTemplateDoc, cipTemplateLibraryStats, cipTemplateMergePlan, cipTemplateReadiness, useCipStore } from "./ContractCIPData.jsx";
import { trkFmtDate, trkRp, trkRpM, trkText } from "../../proposal-tracker/legacy/TrackerData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { Badge, Button, Card, DetailCard, Field, Icon, IconButton, Select, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Spinner, fmtAppDate, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Contract Initiation Platform (CIP) screens.
   Dashboard (command center), Template Library (the real 23 standardized Legal templates),
   Document Repository (includes Tracker LOA projected as supporting documents). */

/* =================== shared CIP visual identity =================== */

const CIP_HERO_GRAD = "linear-gradient(118deg, #012B3E 0%, #013B52 38%, #0F828A 100%)";
const CIP_HERO_PATTERN =
  "radial-gradient(ellipse 520px 300px at 88% -20%, rgba(63,182,190,0.35), transparent 60%), " +
  "radial-gradient(ellipse 420px 260px at 12% 130%, rgba(0,92,150,0.45), transparent 65%), " +
  "repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 26px)";

function CIPDocumentPreviewModal({ document, onClose }) {
  const C = useC();
  const tt = useTT();
  const [src, setSrc] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setError("");
    if (!document) { setSrc(""); setLoading(false); return undefined; }
    if (document.src) { setSrc(document.src); setLoading(false); return undefined; }
    setSrc(""); setLoading(true);
    cipResolveDocumentUrl(document)
      .then((url) => { if (!cancelled) { setSrc(url); if (!url) setError(tt("Document not available.", "Dokumen tidak tersedia.")); } })
      .catch(() => { if (!cancelled) setError(tt("Unable to load document.", "Tidak bisa memuat dokumen.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [document, tt]);
  return (
    <Modal
      open={!!document}
      onClose={onClose}
      width="80vw"
      icon="file-search"
      title={tt("View PDF Document", "View PDF Document")}
      subtitle={document ? document.fileName : ""}
      overlayStyle={{ padding: 0, alignItems: "stretch" }}
      style={{ maxWidth: "80vw", height: "100vh", borderRadius: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflow: "hidden", padding: 16 }}
    >
      {document && (
        <div style={{ height: "100%", minHeight: 0, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {loading ? <Spinner size={22} color={C.ocean} />
            : src ? <iframe title={document.title || document.fileName} src={src} style={{ width: "100%", height: "100%", border: 0, backgroundColor: "#fff" }} />
            : <div style={{ fontSize: 13, color: C.textMuted }}>{error || tt("Document not available.", "Dokumen tidak tersedia.")}</div>}
        </div>
      )}
    </Modal>
  );
}

function CipPage({ children }) {
  return <div className="cip-page">{children}</div>;
}

function CipHero({ kicker, title, subtitle, right, children, style, compact }) {
  return (
    <div className="cip-fade-up cip-hero" style={{ position: "relative", overflow: "hidden", borderRadius: RADIUS.xl, background: CIP_HERO_GRAD, padding: compact ? "20px 24px" : "26px 28px", marginBottom: 18, color: "#fff", boxShadow: "0 18px 48px rgba(1,43,62,0.22)", ...style }}>
      <div className="cip-grain" aria-hidden="true" />
      <div className="cip-hero-orb" aria-hidden="true" />
      <div style={{ position: "absolute", inset: 0, background: CIP_HERO_PATTERN, pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          {kicker && <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FD4D9", marginBottom: 8 }}><Icon name="sparkles" size={12} color="#7FD4D9" />{kicker}</div>}
          <div className="cip-display" style={{ fontSize: compact ? 20 : 26, lineHeight: 1.18 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 8, maxWidth: 680, lineHeight: 1.58, fontWeight: 500 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* procurement chain — Proposals → Term Sheet / Contract → Contract Monitoring */
function CipIntegrationBridge({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const nodes = [
    { icon: "route", label: "Proposal Tracker", sub: tt("Award, then LOA ∥ Contract", "Award, lalu LOA ∥ Contract"), route: "trackerProposals", color: "#4AA3D6", bg: "rgba(0,92,150,0.18)" },
    { icon: "sparkles", label: tt("Term Sheet", "Term Sheet"), sub: tt("Termsheet → Contract", "Termsheet → Kontrak"), route: "cipDashboard", color: "#7FD4D9", bg: "rgba(15,130,138,0.28)", active: true },
    { icon: "file-check-2", label: tt("Contract Mon.", "Contract Mon."), sub: tt("Executed contracts", "Kontrak final"), route: "contractDatabase", color: "#ABD096", bg: "rgba(17,113,59,0.22)" },
  ];
  return (
    <div className="cip-bridge cip-fade-up" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", alignItems: "stretch", gap: 10, marginBottom: 16 }}>
      {nodes.map((n, i) => (
        <React.Fragment key={n.label}>
          <button type="button" onClick={() => onNavigate && onNavigate(n.route)} className="cip-card-lift" style={{ ...FONT, cursor: "pointer", border: `1px solid ${n.active ? C.ocean + "55" : C.borderSoft}`, borderRadius: RADIUS.lg, padding: "14px 16px", textAlign: "left", background: n.active ? `linear-gradient(145deg, ${C.brandBg}, ${C.surface})` : C.surface, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: n.bg, color: n.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: n.active ? "0 0 0 3px rgba(15,130,138,0.12)" : "none" }}><Icon name={n.icon} size={20} color={n.color} /></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: C.text }}>{n.label}{n.active && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: C.ocean, letterSpacing: "0.06em", textTransform: "uppercase" }}>{tt("you are here", "posisi aktif")}</span>}</span>
              <span style={{ display: "block", fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{n.sub}</span>
            </span>
          </button>
          {i < nodes.length - 1 && (
            <div className="cip-bridge-arrows" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px", color: C.textSubtle }}>
              <svg width="28" height="16" viewBox="0 0 28 16" fill="none" aria-hidden="true">
                <path className="cip-bridge-line" d="M0 8 H20 M16 4 L22 8 L16 12" stroke={C.ocean} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* provenance chip — where a piece of data came from (the BRD correction made visible) */
function CipSourceChip({ kind, size = "md" }) {
  const C = useC();
  const tt = useTT();
  const map = {
    tracker: { icon: "route", label: tt("From Proposal Tracker", "Dari Proposal Tracker"), bg: "rgba(0,92,150,0.12)", fg: C.scheme === "dark" ? "#4AA3D6" : "#005C96" },
    vendor:  { icon: "database", label: tt("Vendor DB", "DB Vendor"), bg: "rgba(15,130,138,0.12)", fg: C.ocean },
    ai:      { icon: "sparkles", label: tt("Auto-generated", "Auto-generate"), bg: "rgba(124,92,191,0.13)", fg: C.scheme === "dark" ? "#B49BE8" : "#7C5CBF" },
  };
  const m = map[kind] || map.tracker;
  const pad = size === "sm" ? "1px 7px" : "2.5px 9px";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: pad, borderRadius: RADIUS.pill, fontSize: size === "sm" ? 10 : 10.5, fontWeight: 700, backgroundColor: m.bg, color: m.fg, whiteSpace: "nowrap" }}>
      <Icon name={m.icon} size={size === "sm" ? 10 : 11} color={m.fg} />{m.label}
    </span>
  );
}

/* status badge */
function cipStatusBadge(status, lang) { const s = CIP_STATUS[status] || CIP_STATUS.intake; return <Badge tone={s.tone} dot>{lang === "id" ? s.id : s.en}</Badge>; }

/* mini 2-phase pipeline indicator used in tables */
function CipMiniPipeline({ stage }) {
  const C = useC();
  const idx = cipPhaseIdx(stage);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, width: 104 }}>
      {CIP_PHASES.map((s, i) => (
        <span key={s.key} title={s.en} style={{ height: 6, borderRadius: 999, backgroundColor: i < idx ? C.success : i === idx ? C.ocean : C.surfaceAlt, ...(i === idx ? { animation: "cipPulse 1.6s ease-in-out infinite" } : {}) }} />
      ))}
    </div>
  );
}

/* the big tracker-style 2-phase pipeline (dashboard) */
function CipPipelineFlow({ cases, onStage }) {
  const C = useC();
  const { lang } = useI18n();
  const counts = CIP_PHASES.map((s) => cases.filter((c) => cipPhaseForStage(c.stage) === s.key).length);
  return (
    <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "stretch", gap: 10 }}>
        {CIP_PHASES.map((s, i) => {
          const n = counts[i];
          const hot = n > 0;
          return (
            <React.Fragment key={s.key}>
              <button onClick={() => onStage && onStage(s.key)} style={{ ...FONT, cursor: "pointer", border: "none", background: "none", padding: 0, minWidth: 0 }}>
                <div style={{ minHeight: 94, borderRadius: RADIUS.md, padding: "15px 16px", textAlign: "left", backgroundColor: hot ? C.brandBg : C.surfaceInset, border: `1px solid ${hot ? C.ocean + "44" : C.borderSoft}`, transition: "transform .15s ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: hot ? C.ocean : C.surfaceAlt, color: hot ? "#fff" : C.textSubtle, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={s.icon} size={18} color={hot ? "#fff" : C.textSubtle} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: hot ? C.text : C.textSubtle }}>{trkText(lang, s)}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{lang === "id" ? s.desc_id : s.desc_en}</span>
                    </span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800, color: hot ? C.ocean : C.textSubtle }}>{n}<span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, marginLeft: 6 }}>cases</span></div>
                </div>
              </button>
              {i < CIP_PHASES.length - 1 && (
                <div style={{ alignSelf: "center", flexShrink: 0, padding: "0 2px", color: C.textSubtle, display: "flex" }}><Icon name="arrow-right" size={20} color={C.textSubtle} /></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </Card>
  );
}

function cipKB(size) { return size >= 1000 ? `${(size / 1000).toFixed(1)} MB` : `${size} KB`; }

/* =================== DASHBOARD =================== */

function CIPDashboard({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const cip = useCipStore();

  const cases = cip.cases;
  const recentDocuments = cipRepositoryDocs(cases).slice(0, 5);
  const active = cases.filter((c) => !c.contractActivityCompletedAt).length;
  const finalUpload = cases.filter((c) => c.stage === "final" && !c.contractActivityCompletedAt).length;
  const executed = cases.filter((c) => !!c.contractActivityCompletedAt).length;
  const totalValue = cases.reduce((s, c) => s + (c.value || 0), 0);

  const heroKpis = [
    { icon: "files", label: tt("Active cases", "Kasus aktif"), value: active },
    { icon: "upload", label: tt("Final upload", "Upload final"), value: finalUpload },
    { icon: "award", label: tt("Executed", "Kontrak final"), value: executed },
    { icon: "banknote", label: tt("Pipeline value", "Nilai pipeline"), value: trkRpM(totalValue, lang) },
  ];

  const topTpl = [...CIP_TEMPLATES].sort((a, b) => b.usage - a.usage).slice(0, 5);
  const maxUsage = Math.max(...topTpl.map((t) => t.usage));
  const recent = [...cases].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return (
    <CipPage>
      <CipHero
        kicker="Proposal Tracker"
        title={tt("From award Term Sheet to executed contract.", "Dari Term Sheet award ke kontrak final.")}
        subtitle={tt(
          "Bid Evaluation / Negotiation winners continue to Term Sheet in Tracker. When Term Sheet is done, LOA and Contract run in parallel.",
          "Pemenang Bid Evaluation / Negotiation dilanjutkan ke Term Sheet di Tracker. Setelah Term Sheet selesai, LOA dan Contract berjalan paralel.")}
        right={
          <div style={{ display: "flex", gap: 9, flexShrink: 0, alignItems: "center" }}>
            <button onClick={() => onNavigate("cipRepository")} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px", borderRadius: RADIUS.md, border: "none", backgroundColor: "#fff", color: "#013B52", fontSize: 13, fontWeight: 700 }}>
              <Icon name="archive" size={15} color="#013B52" />{tt("Document Repository", "Repositori Dokumen")}
            </button>
            <button onClick={() => onNavigate("cipTemplates")} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px", borderRadius: RADIUS.md, border: "1px solid rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              <Icon name="layout-template" size={15} color="#fff" />{tt("23 templates", "23 template")}
            </button>
          </div>
        }>
        <div className="cip-hero-kpis" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 20 }}>
          {heroKpis.map((k, i) => (
            <div key={i} style={{ borderRadius: RADIUS.lg, padding: "13px 15px", backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(4px)", animation: `cipFadeUp .5s ${0.08 * i + 0.1}s cubic-bezier(.2,.7,.3,1) both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}><Icon name={k.icon} size={13} color="#7FD4D9" />{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 5, letterSpacing: "-0.01em" }}>{k.value}</div>
            </div>
          ))}
        </div>
      </CipHero>

      <CipIntegrationBridge onNavigate={onNavigate} />

      <CipPipelineFlow cases={cases} onStage={() => onNavigate("cipWorkflow")} />

      <div className="cip-dash-grid" style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* latest documents from the active Term Sheet cases */}
        <DetailCard
          title={tt("Latest documents", "Dokumen terbaru")}
          subtitle={tt("LOA, Termsheet, draft, and final contracts linked to active Term Sheet cases.", "LOA, Termsheet, draf, dan kontrak final yang terhubung ke kasus Term Sheet aktif.")}
          action={<Button variant="link" size="sm" iconRight="arrow-right" onClick={() => onNavigate("cipRepository")}>{tt("Open repository", "Buka repositori")}</Button>} pad={0}>
          <div>
            {recentDocuments.map((doc, i) => (
              <div key={doc.id} onClick={() => onNavigate("cipWorkflow", doc.caseId)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < recentDocuments.length - 1 ? `1px solid ${C.borderSoft}` : "none", cursor: "pointer" }}>
                <span style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: C.infoBg, color: C.info, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={CIP_DOCTYPES[doc.type].icon} size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.caseId} · {doc.vendor}</div>
                </div>
                <Badge tone={CIP_DOCTYPES[doc.type].tone} size="sm">{trkText(lang, CIP_DOCTYPES[doc.type])}</Badge>
              </div>
            ))}
            {recentDocuments.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: C.textMuted }}>{tt("No case documents are available yet.", "Belum ada dokumen kasus.")}</div>}
          </div>
        </DetailCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* efficiency strip */}
          <Card style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 46, height: 46, borderRadius: RADIUS.md, background: CIP_HERO_GRAD, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="zap" size={22} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 21, fontWeight: 800, color: C.text, lineHeight: 1.15 }}>± 8 {tt("min", "menit")} <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{tt("per draft", "per draf")}</span></div>
                <div style={{ fontSize: 11.5, color: C.textMuted }}>{tt("vs ± 32 working hours manually — every clause pre-filled from the award result.", "vs ± 32 jam kerja manual — setiap pasal terisi otomatis dari hasil award.")}</div>
              </div>
            </div>
            <div style={{ height: 7, borderRadius: 999, backgroundColor: C.surfaceAlt, marginTop: 13, overflow: "hidden" }}>
              <div className="cip-grow" style={{ width: "96%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#0F828A,#3FB6BE)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.textSubtle, marginTop: 5 }}>
              <span>{tt("time saved", "waktu terpangkas")}</span><span style={{ fontWeight: 700, color: C.ocean }}>96%</span>
            </div>
          </Card>

          {/* template leaderboard */}
          <DetailCard title={tt("Most-used templates", "Template terbanyak dipakai")}
            action={<Button variant="link" size="sm" iconRight="arrow-right" onClick={() => onNavigate("cipTemplates")}>{tt("Library", "Pustaka")}</Button>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {topTpl.map((t, i) => {
                const cat = CIP_TPL_CAT[t.cat];
                return (
                  <div key={t.code}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4, gap: 8 }}>
                      <span style={{ color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><span style={{ fontFamily: "monospace", fontSize: 10.5, color: C.textSubtle, marginRight: 6 }}>{t.code}</span>{t.id}</span>
                      <span style={{ color: C.textMuted, flexShrink: 0, fontWeight: 700 }}>{t.usage}×</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, backgroundColor: C.surfaceAlt, overflow: "hidden" }}>
                      <div className="cip-grow" style={{ width: `${(t.usage / maxUsage) * 100}%`, height: "100%", borderRadius: 999, backgroundColor: cat.color, animationDelay: `${i * 0.07}s` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </DetailCard>
        </div>
      </div>

      {/* recent cases */}
      <DetailCard title={tt("Recent cases", "Kasus terbaru")} pad={0}
        action={<Button variant="link" size="sm" iconRight="arrow-right" onClick={() => onNavigate("cipWorkflow")}>{tt("View all", "Lihat semua")}</Button>}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr>
            {[tt("Case", "Kasus"), tt("Vendor", "Vendor"), tt("Pipeline", "Pipeline"), tt("Template", "Template"), tt("Value", "Nilai"), tt("Status", "Status")].map((h, i) => (
              <th key={i} style={{ textAlign: i === 4 ? "right" : "left", padding: "10px 18px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {recent.map((c) => (
              <tr key={c.id} onClick={() => onNavigate("cipWorkflow", c.id)} style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.hover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                <td style={{ padding: "11px 18px", borderBottom: `1px solid ${C.borderSoft}` }}>
                  <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: C.ocean }}>{c.id}</div>
                  <div style={{ fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{c.title}</div>
                </td>
                <td style={{ padding: "11px 18px", borderBottom: `1px solid ${C.borderSoft}`, color: C.textMuted }}>{c.vendor}</td>
                <td style={{ padding: "11px 18px", borderBottom: `1px solid ${C.borderSoft}` }}>
                  <CipMiniPipeline stage={c.stage} />
                  <div style={{ fontSize: 10.5, color: C.textSubtle, marginTop: 4 }}>{trkText(lang, CIP_STAGE[c.stage])}</div>
                </td>
                <td style={{ padding: "11px 18px", borderBottom: `1px solid ${C.borderSoft}` }}>{c.template ? <Badge tone="neutral">{c.template}</Badge> : <span style={{ color: C.textSubtle }}>—</span>}</td>
                <td style={{ padding: "11px 18px", borderBottom: `1px solid ${C.borderSoft}`, textAlign: "right", fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{trkRp(c.value)}</td>
                <td style={{ padding: "11px 18px", borderBottom: `1px solid ${C.borderSoft}` }}>{cipStatusBadge(c.status, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetailCard>
    </CipPage>
  );
}

/* =================== TEMPLATE LIBRARY (the real 23) =================== */

/* ---------- merge-review: how the token-annotated templates fill (for CIP-team review) ---------- */
async function cipDownloadTemplateSample(key) {
  const res = await fetch(`/api/v1/contract-initiation-platform/templates/sample?templateKey=${encodeURIComponent(key)}`, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`(${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${key}-SAMPLE.docx`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
const CIP_MERGE_COVERAGE = {
  full: { tone: "success", en: "Full", id: "Lengkap", icon: "check-circle-2" },
  partial: { tone: "warning", en: "Partial", id: "Sebagian", icon: "alert-triangle" },
  anchors: { tone: "neutral", en: "Anchors only", id: "Anchor saja", icon: "minus-circle" },
  missing: { tone: "danger", en: "Not annotated", id: "Belum dianotasi", icon: "x-circle" },
};
// Coverage derived from the token set: needs both a SIS-side and a vendor-side signatory for FULL.
function cipMergeCoverage(tokens) {
  const set = new Set(tokens || []);
  const sisSig = set.has("NAMA_TTD_PIHAK1");
  const venSig = set.has("NAMA_TTD_VENDOR");
  const party = sisSig || venSig || set.has("ENTITAS_SIS") || set.has("NAMA_VENDOR");
  if (!party) return "anchors";
  return sisSig && venSig ? "full" : "partial";
}
function CipTemplateMergeReview() {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const [catalog, setCatalog] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [openKey, setOpenKey] = React.useState("");
  const [preview, setPreview] = React.useState(null);   // { key, url }
  const [previewing, setPreviewing] = React.useState("");
  const [previewMsg, setPreviewMsg] = React.useState("");
  // Revoke the object URL of the previous preview whenever it changes / on unmount.
  React.useEffect(() => () => { if (preview && preview.src && preview.src.indexOf("blob:") === 0) URL.revokeObjectURL(preview.src); }, [preview]);
  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/contract-initiation-platform/templates/merge-catalog", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`(${r.status})`))))
      .then((data) => { if (alive) setCatalog(Array.isArray(data) ? data : []); })
      .catch((e) => { if (alive) setError(String((e && e.message) || e)); });
    return () => { alive = false; };
  }, []);
  const byKey = React.useMemo(() => {
    const m = {};
    (catalog || []).forEach((x) => { m[x.templateKey] = x.tokens || []; });
    return m;
  }, [catalog]);
  const rows = React.useMemo(() => CIP_TEMPLATES.map((t) => {
    const key = CIP_TEMPLATE_MERGE_KEYS[t.code] || null;
    const tokens = key ? byKey[key] : null;
    const cov = !key || tokens == null ? "missing" : cipMergeCoverage(tokens);
    return { t, key, tokens: tokens || [], cov };
  }), [byKey]);
  const counts = rows.reduce((a, r) => { a[r.cov] = (a[r.cov] || 0) + 1; return a; }, {});
  const generate = async (key) => {
    setBusy(key); setError("");
    try { await cipDownloadTemplateSample(key); }
    catch (e) { setError(tt("Could not generate sample ", "Gagal membuat sample ") + ((e && e.message) || "")); }
    finally { setBusy(""); }
  };
  const openPreview = async (key) => {
    if (!key) return;
    setPreviewing(key); setPreviewMsg("");
    try {
      const res = await fetch(`/api/v1/contract-initiation-platform/templates/sample?templateKey=${encodeURIComponent(key)}&format=pdf`, { method: "POST", credentials: "include" });
      if (res.ok) {
        setPreview({ title: `${key} (sample)`, fileName: `${key}-SAMPLE.pdf`, src: URL.createObjectURL(await res.blob()) });
      } else {
        let code = `(${res.status})`;
        try { const j = await res.json(); if (j && j.code) code = j.code; } catch (e) {}
        setPreviewMsg(code === "pdf_unavailable"
          ? tt("In-app PDF preview needs LibreOffice or Word on the server. Download the .docx instead.", "Preview PDF in-app butuh LibreOffice atau Word di server. Silakan unduh .docx.")
          : tt("PDF conversion failed. Download the .docx instead.", "Konversi PDF gagal. Silakan unduh .docx."));
      }
    } catch (e) {
      setPreviewMsg(tt("Could not open preview ", "Gagal membuka preview ") + ((e && e.message) || ""));
    } finally { setPreviewing(""); }
  };
  const tile = (covKey, n) => {
    const c = CIP_MERGE_COVERAGE[covKey];
    const fg = c.tone === "success" ? C.success : c.tone === "warning" ? C.warningText : c.tone === "danger" ? (C.dangerText || "#C0392B") : C.textMuted;
    const bg = c.tone === "success" ? C.successBg : c.tone === "warning" ? C.warningBg : c.tone === "danger" ? (C.dangerBg || "rgba(192,57,43,0.12)") : C.surfaceAlt;
    return (
      <div key={covKey} style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: bg, color: fg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={c.icon} size={16} /></span>
        <div><div style={{ fontSize: 18, fontWeight: 650, color: C.text, lineHeight: 1 }}>{n || 0}</div><div style={{ fontSize: 11.3, color: C.textMuted, marginTop: 3 }}>{trkText(lang, c)}</div></div>
      </div>
    );
  };
  return (
    <>
      <Alert tone="info" style={{ marginBottom: 14 }}
        title={tt("Merge review for the Tracker team", "Review merge untuk tim Tracker")}
        description={tt("Each template was annotated with merge tokens (lampiran removed). Generate a sample .docx to see how the filled contract reads, and confirm the party/signatory mapping. PARTIAL / ANCHORS items still need manual token mapping; residual [..] markers are non-merge fields filled during drafting.", "Tiap template sudah dianotasi token merge (lampiran dibuang). Generate sample .docx untuk melihat hasil kontrak terisi, dan konfirmasi mapping pihak/penandatangan. Item PARTIAL / ANCHORS masih perlu mapping token manual; marker [..] yang tersisa adalah field non-merge yang diisi saat drafting.")} />
      {error && <Alert tone="warning" style={{ marginBottom: 14 }} title={tt("Request failed", "Permintaan gagal")} description={error} />}
      {previewMsg && <Alert tone="info" style={{ marginBottom: 14 }} title={tt("Preview unavailable", "Preview tidak tersedia")} description={previewMsg} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }} className="cip-split">
        {tile("full", counts.full)}{tile("partial", counts.partial)}{tile("anchors", counts.anchors)}{tile("missing", counts.missing)}
      </div>
      {catalog == null && !error && <div style={{ fontSize: 12.5, color: C.textMuted, padding: 14 }}>{tt("Loading merge catalog…", "Memuat katalog merge…")}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(({ t, key, tokens, cov }) => {
          const cat = CIP_TPL_CAT[t.cat];
          const c = CIP_MERGE_COVERAGE[cov];
          const open = openKey === t.code;
          return (
            <div key={t.code} style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px" }}>
                <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, backgroundColor: cat.color + "1c", color: cat.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700 }}>{t.code.split("-")[1]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: cat.color }}>{t.code}</span>
                    <Badge tone={c.tone} size="sm"><Icon name={c.icon} size={10} />{trkText(lang, c)}</Badge>
                    <span style={{ fontSize: 10.6, color: C.textSubtle }}>{tokens.length} {tt("tokens", "token")}</span>
                  </div>
                  <div style={{ fontSize: 12.8, fontWeight: 600, color: C.text, marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.id}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 10.2, color: C.textSubtle, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key || tt("not mapped", "belum dipetakan")}.docx</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <Button variant="secondary" size="sm" iconLeft="braces" disabled={!tokens.length} onClick={() => setOpenKey(open ? "" : t.code)}>{open ? tt("Hide", "Tutup") : tt("Tokens", "Token")}</Button>
                  <Button variant="secondary" size="sm" iconLeft="eye" disabled={!key || previewing === key} onClick={() => openPreview(key)}>{previewing === key ? tt("Opening…", "Membuka…") : tt("Preview", "Preview")}</Button>
                  <Button size="sm" iconLeft="download" disabled={!key || busy === key} onClick={() => generate(key)}>{busy === key ? tt("Generating…", "Membuat…") : tt("Sample .docx", "Sample .docx")}</Button>
                </div>
              </div>
              {open && tokens.length > 0 && (
                <div style={{ padding: "0 14px 12px", display: "flex", flexWrap: "wrap", gap: 5, borderTop: `1px dashed ${C.borderSoft}`, paddingTop: 10 }}>
                  {tokens.map((tok) => <span key={tok} style={{ fontFamily: "monospace", fontSize: 10.5, color: C.ocean, backgroundColor: C.brandBg, borderRadius: RADIUS.pill, padding: "2px 8px" }}>{`{{${tok}}}`}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <CIPDocumentPreviewModal document={preview} onClose={() => setPreview(null)} />
    </>
  );
}
function CIPTemplates() {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const [catF, setCatF] = React.useState("all");
  const [preview, setPreview] = React.useState(null);
  const [view, setView] = React.useState("library");
  const ps = usePageSearch(tt("Search template…", "Cari template…"));
  const q = ps.query, setQ = ps.setQuery;
  const stats = React.useMemo(() => cipTemplateLibraryStats(CIP_TEMPLATES), []);
  const readinessSummary = React.useMemo(() => CIP_TEMPLATES.reduce((acc, t) => {
    const r = cipTemplateReadiness(t);
    acc[r.key] = (acc[r.key] || 0) + 1;
    return acc;
  }, {}), []);

  const filtered = CIP_TEMPLATES.filter((t) => catF === "all" || t.cat === catF)
    .filter((t) => {
      const qq = q.trim().toLowerCase();
      const doc = cipTemplateDoc(t);
      return !qq || [t.id, t.en, t.code, t.kw.join(" "), doc && doc.fileName].filter(Boolean).some((s) => String(s).toLowerCase().includes(qq));
    });

  const metricTile = (icon, label, value, sub, tone = "brand") => (
    <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, padding: 14, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: tone === "warning" ? C.warningBg : tone === "success" ? C.successBg : C.brandBg, color: tone === "warning" ? C.warningText : tone === "success" ? C.success : C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={icon} size={16} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, lineHeight: 1.1, fontWeight: 650, color: C.text }}>{value}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
        </div>
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textSubtle, marginTop: 9, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );

  return (
    <CipPage>
      <CipHero
        kicker={tt("Template library", "Pustaka template")}
        title={tt("23 standardized contract templates", "23 template kontrak terstandar")}
        subtitle={tt("A working intake view for the real contract templates: source file, cleanup status, placeholder volume, and field-mapping readiness.", "Tampilan intake untuk template kontrak asli: file sumber, status cleanup, volume placeholder, dan kesiapan mapping field.")}
        compact
        right={<Badge tone="brand" style={{ alignSelf: "flex-start" }}><Icon name="folder-check" size={12} />{tt("Source folder linked", "Folder sumber terhubung")}</Badge>}
      />

      <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: RADIUS.pill, backgroundColor: C.surfaceAlt, border: `1px solid ${C.borderSoft}`, marginBottom: 16 }}>
        {[{ k: "library", icon: "library", en: "Intake library", id: "Pustaka intake" }, { k: "review", icon: "file-pen", en: "Merge review", id: "Review merge" }].map((v) => {
          const act = view === v.k;
          return <button key={v.k} type="button" onClick={() => setView(v.k)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 15px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 600, border: "none", backgroundColor: act ? C.surface : "transparent", color: act ? C.ocean : C.textMuted, boxShadow: act ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <Icon name={v.icon} size={13} />{tt(v.en, v.id)}
          </button>;
        })}
      </div>

      {view === "library" ? (<>
      <DetailCard
        title={tt("Template intake control", "Kontrol intake template")}
        subtitle={tt("The library now treats the Word files as controlled master assets, not just catalog labels.", "Library sekarang memperlakukan file Word sebagai aset master terkontrol, bukan sekadar label katalog.")}
        action={<Badge tone={stats.cleanup ? "warning" : "success"}><Icon name={stats.cleanup ? "alert-triangle" : "check-circle-2"} size={12} />{stats.cleanup} {tt("need cleanup", "perlu cleanup")}</Badge>}
        style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(170px, 1fr))", gap: 10 }} className="cip-split">
          {metricTile("files", tt("contract templates", "template kontrak"), stats.total, `${stats.docx} .docx · ${stats.legacy} .doc legacy`, "brand")}
          {metricTile("braces", tt("detected placeholders", "placeholder terdeteksi"), stats.placeholders.toLocaleString("id-ID"), tt("Candidates for auto-fill or manual field capture", "Kandidat auto-fill atau input manual"), "success")}
          {metricTile("file-stack", tt("page range", "rentang halaman"), `${stats.pagesMin}-${stats.pagesMax}`, tt("Real legal templates, not short samples", "Template legal asli, bukan sample pendek"), "brand")}
          {metricTile("shield-alert", tt("readiness queue", "antrian kesiapan"), `${readinessSummary.ready || 0}/${stats.total}`, tt("Ready for mapping without conversion/comment cleanup", "Siap mapping tanpa konversi/comment cleanup"), stats.cleanup ? "warning" : "success")}
        </div>
      </DetailCard>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div ref={ps.ref} style={{ width: 280 }}><TextInput iconLeft="search" placeholder={tt("Search name, code, keyword…", "Cari nama, kode, kata kunci…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {[{ key: "all" }, ...CIP_TPL_CATS].map((c) => {
            const act = catF === c.key;
            const label = c.key === "all" ? tt("All", "Semua") : trkText(lang, c);
            return <button key={c.key} onClick={() => setCatF(c.key)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 600, border: `1px solid ${act ? (c.color || C.ocean) : C.border}`, backgroundColor: act ? (c.color ? c.color + "1c" : C.brandBg) : C.surface, color: act ? (c.color || C.ocean) : C.textMuted }}>
              {c.color && <span style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: c.color }} />}{label}
            </button>;
          })}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.textSubtle }}>{filtered.length} / 23 {tt("templates", "template")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
        {filtered.map((t, i) => {
          const cat = CIP_TPL_CAT[t.cat];
          const doc = cipTemplateDoc(t);
          const readiness = cipTemplateReadiness(t);
          const plan = cipTemplateMergePlan(t);
          const issues = cipTemplateCleanupIssues(t);
          const num = t.code.split("-")[1];
          return (
            <Card key={t.code} style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", animation: `cipFadeUp .4s ${Math.min(i * 0.03, 0.35)}s cubic-bezier(.2,.7,.3,1) both` }}>
              <div style={{ position: "absolute", top: -16, right: 2, fontSize: 74, fontWeight: 650, color: cat.color, opacity: C.scheme === "dark" ? 0.13 : 0.08, lineHeight: 1, pointerEvents: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{num}</div>
              <div style={{ height: 4, backgroundColor: cat.color, opacity: 0.85 }} />
              <div style={{ padding: "14px 16px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: cat.color }}>{t.code}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1.5px 8px", borderRadius: RADIUS.pill, backgroundColor: cat.color + "1c", color: cat.color }}>{trkText(lang, cat)}</span>
                  <Badge tone={readiness.tone} size="sm">{trkText(lang, readiness)}</Badge>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginTop: 6, lineHeight: 1.35, minHeight: 36 }}>{t.id}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{t.en}</div>
              </div>
              <div style={{ padding: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: 5 }}>
                {t.kw.slice(0, 4).map((s, j) => <span key={j} style={{ fontSize: 10.5, color: C.textMuted, backgroundColor: C.surfaceAlt, padding: "2px 8px", borderRadius: RADIUS.pill }}>{s}</span>)}
              </div>
              <div style={{ padding: "0 16px 14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
                  {[
                    [tt("Pages", "Hal."), doc.pages],
                    [tt("Pasal", "Pasal"), doc.pasalDetected],
                    [tt("Fields", "Field"), doc.placeholders],
                    [tt("Manual", "Manual"), plan.manual],
                  ].map(([label, value], idx) => (
                    <div key={label} style={{ padding: "8px 7px", borderRight: idx < 3 ? `1px solid ${C.borderSoft}` : "none", backgroundColor: idx === 2 || idx === 3 ? C.surfaceInset : C.surface }}>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 650 }}>{value}</div>
                      <div style={{ fontSize: 10.4, color: C.textSubtle, marginTop: 1 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, minHeight: 22, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10.8, color: C.textMuted, backgroundColor: C.surfaceAlt, padding: "2px 7px", borderRadius: RADIUS.pill }}>{doc.ext.toUpperCase()}</span>
                  {issues.slice(0, 2).map((issue) => <Badge key={issue.key} tone={issue.tone} size="sm">{trkText(lang, issue)}</Badge>)}
                  {issues.length === 0 && <Badge tone="success" size="sm"><Icon name="check" size={10} />{tt("Clean master", "Master bersih")}</Badge>}
                </div>
              </div>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderTop: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceInset }}>
                <span style={{ fontSize: 11.5, color: C.textMuted }}><b style={{ color: C.text }}>{plan.percent}%</b> {tt("auto-fill estimate", "estimasi auto-fill")}</span>
                <Button variant="link" size="sm" iconRight="eye" onClick={() => setPreview(t)}>{tt("Inspect", "Inspect")}</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} width={620}
        title={preview ? `${preview.code} — ${preview.id}` : ""}
        subtitle={preview ? preview.en : ""}>
        {preview && (
          <div>
            {(() => {
              const doc = cipTemplateDoc(preview);
              const readiness = cipTemplateReadiness(preview);
              const plan = cipTemplateMergePlan(preview);
              const issues = cipTemplateCleanupIssues(preview);
              return (
                <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <Badge tone={readiness.tone}><Icon name="gauge" size={11} />{trkText(lang, readiness)}</Badge>
              <Badge tone="neutral"><Icon name="file-text" size={11} />{doc.pages} {tt("pages", "halaman")}</Badge>
              <Badge tone="neutral"><Icon name="braces" size={11} />{doc.placeholders} {tt("placeholders", "placeholder")}</Badge>
              <Badge tone="brand"><Icon name="calendar" size={11} />{tt(`Legal standard ${fmtAppDate(doc.effectiveDate)}`, `Standar Legal ${fmtAppDate(doc.effectiveDate)}`)}</Badge>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ padding: "12px 14px", backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.borderSoft}` }}>
                <div style={{ fontSize: 12.8, fontWeight: 650, color: C.text }}>{tt("Source document", "Dokumen sumber")}</div>
                <div style={{ fontFamily: "monospace", fontSize: 10.8, color: C.textMuted, marginTop: 4, wordBreak: "break-all" }}>{doc.path}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }} className="cip-split">
                {[
                  [tt("Words", "Kata"), doc.words.toLocaleString("id-ID")],
                  [tt("Tables", "Tabel"), doc.tables],
                  [tt("Pasal detected", "Pasal terdeteksi"), doc.pasalDetected],
                  [tt("Legal notes", "Catatan legal"), doc.notes],
                ].map(([label, value], idx) => (
                  <div key={label} style={{ padding: "10px 12px", borderRight: idx < 3 ? `1px solid ${C.borderSoft}` : "none" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650, color: C.text }}>{value}</div>
                    <div style={{ fontSize: 10.8, color: C.textSubtle, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }} className="cip-split">
              <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, padding: 13 }}>
                <div style={{ fontSize: 11, fontWeight: 650, color: C.textMuted, textTransform: "uppercase", marginBottom: 8 }}>{tt("Merge readiness", "Kesiapan merge")}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
                  <span style={{ fontSize: 12.5, color: C.text }}>{tt("Auto-fill estimate", "Estimasi auto-fill")}</span>
                  <span style={{ fontSize: 18, color: C.ocean, fontWeight: 650 }}>{plan.percent}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 99, backgroundColor: C.surfaceAlt, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${plan.percent}%`, borderRadius: 99, backgroundColor: C.ocean }} />
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                  <Badge tone="success" size="sm">{plan.auto} {tt("auto", "auto")}</Badge>
                  <Badge tone={plan.manual > 60 ? "warning" : "neutral"} size="sm">{plan.manual} {tt("manual fields", "field manual")}</Badge>
                </div>
              </div>
              <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, padding: 13 }}>
                <div style={{ fontSize: 11, fontWeight: 650, color: C.textMuted, textTransform: "uppercase", marginBottom: 8 }}>{tt("Cleanup queue", "Antrian cleanup")}</div>
                {issues.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {issues.map((issue) => <Badge key={issue.key} tone={issue.tone}><Icon name="dot" size={12} />{trkText(lang, issue)}</Badge>)}
                  </div>
                ) : (
                  <Alert tone="success" title={tt("Clean master", "Master bersih")} description={tt("No legacy format, tracked revision, or comments detected in the intake scan.", "Tidak ada format legacy, tracked revision, atau komentar dari hasil scan intake.")} />
                )}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", color: C.textMuted, marginBottom: 8 }}>{tt("Field mapping groups", "Grup mapping field")}</div>
            <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
              {CIP_CONTRACT_FIELD_GROUPS.map((group, i) => (
                <div key={group.key} style={{ display: "grid", gridTemplateColumns: "minmax(150px, 0.9fr) minmax(220px, 1.1fr)", gap: 10, padding: "10px 13px", borderBottom: i < CIP_CONTRACT_FIELD_GROUPS.length - 1 ? `1px solid ${C.borderSoft}` : "none" }}>
                  <div>
                    <div style={{ fontSize: 12.3, color: C.text, fontWeight: 600 }}>{trkText(lang, group)}</div>
                    <div style={{ fontSize: 10.8, color: C.textSubtle, marginTop: 2 }}>{group.source}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {group.fields.map((field) => <span key={field} style={{ fontSize: 10.6, color: C.textMuted, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: "2px 7px" }}>{field}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 10 }}>{tt("The clause preview is intentionally replaced by real document health and mapping signals because the source files contain full legal wording.", "Preview pasal sengaja diganti dengan sinyal kesehatan dokumen dan mapping karena file sumber sudah berisi wording legal penuh.")}</div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>
      </>) : (
        <CipTemplateMergeReview />
      )}
    </CipPage>
  );
}

/* =================== AUTHORIZATION MASTER =================== */

function CipContractDot({ state, selected }) {
  const C = useC();
  const base = {
    width: selected ? 18 : 15,
    height: selected ? 18 : 15,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    boxShadow: selected ? `0 0 0 4px ${C.brandBg}` : "none",
  };
  if (state === "signer") return <span title="Contract signer" style={{ ...base, backgroundColor: "#0B84C6", border: "1.5px solid #064B76" }} />;
  if (state === "alternate") return <span title="Replacement signer" style={{ ...base, backgroundColor: C.surface, border: "1.5px solid #064B76" }} />;
  if (state === "president") return <span title="President Director route" style={{ ...base, backgroundColor: C.text, border: `1.5px solid ${C.text}` }} />;
  return <span style={{ ...base, width: 6, height: 6, backgroundColor: C.borderSoft }} />;
}

function CipContractSignerRoute({ c, compact = false }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const route = cipContractSigningForCase(c || { value: 0 }, CIP_USD_RATE);
  return (
    <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, padding: compact ? 12 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <Icon name="file-signature" size={16} color={C.ocean} />
        <div style={{ fontSize: 12.8, fontWeight: 600, color: C.text }}>{tt("Contract signing route", "Route penandatangan Contract")}</div>
        <Badge tone="brand">{route.band.code}</Badge>
        <Badge tone="neutral">VT {route.band.label}</Badge>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 9 }}>
        {route.signers.map((signer, index) => (
          <div key={signer.key} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, padding: "10px 11px", minWidth: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: C.ocean, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{index + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.4, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{signer.label}</div>
              <div style={{ fontSize: 11.2, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{signer.defaultName}</div>
            </div>
          </div>
        ))}
      </div>
      {!compact && (
        <div style={{ marginTop: 10, fontSize: 11.4, color: C.textSubtle, lineHeight: 1.45 }}>
          {tt("This route is separate from the Term Sheet authorization matrix.", "Route ini terpisah dari matrix authorization Term Sheet.")}
        </div>
      )}
    </div>
  );
}

function CipContractMatrixPolicy({ sampleCase }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const route = cipContractSigningForCase(sampleCase || { value: 1489600000 }, CIP_USD_RATE);
  const cellLabel = (state) => {
    const cell = CIP_CONTRACT_CELL[state];
    return cell ? trkText(lang, cell) : tt("Not required", "Tidak wajib");
  };
  return (
    <Card pad={0} style={{ overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "13px 16px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="file-signature" size={16} color={C.ocean} />
          {tt("Contract Activity Signing Matrix", "Matrix Penandatangan Contract Activity")}
        </div>
        <Badge tone="brand"><Icon name="split" size={11} />{tt("Separate from Term Sheet", "Terpisah dari Term Sheet")}</Badge>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap", fontSize: 11.5, color: C.textMuted }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><CipContractDot state="signer" />{tt("Signer", "Signer")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><CipContractDot state="alternate" />{tt("Replacement", "Pengganti")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><CipContractDot state="president" />President Director</span>
        </div>
      </div>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}`, display: "grid", gridTemplateColumns: "minmax(260px, 0.9fr) minmax(320px, 1.1fr)", gap: 12 }} className="cip-split">
        <CipContractSignerRoute c={sampleCase || { value: 1489600000 }} compact />
        <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, backgroundColor: C.surfaceAlt, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>{tt("Policy notes", "Catatan policy")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {CIP_CONTRACT_SIGNING_NOTES.map((note, index) => (
              <div key={note.key} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 7, fontSize: 11.5, color: C.textMuted, lineHeight: 1.42 }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: C.surface, border: `1px solid ${C.borderSoft}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.text }}>{index + 1}</span>
                <span>{trkText(lang, note)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 1120, borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, zIndex: 2, backgroundColor: "#0F5D6C", color: "#fff", textAlign: "left", padding: "10px 10px", width: 235, borderRight: "1px solid rgba(255,255,255,0.24)" }}>
                {tt("Contract Activity", "Contract Activity")}
              </th>
              {CIP_AUTHORIZATION_BANDS.map((band) => {
                const selected = band.key === route.band.key;
                return (
                  <th key={band.key} style={{ backgroundColor: selected ? "#0B84C6" : "#0F5D6C", color: "#fff", padding: "8px 7px", minWidth: 92, borderRight: "1px solid rgba(255,255,255,0.24)", verticalAlign: "top" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.25 }}>{band.label}</div>
                    <div style={{ fontSize: 8.6, opacity: 0.86, marginTop: 5, fontStyle: "italic" }}>({band.code})</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {CIP_CONTRACT_SIGNING_SECTIONS.map((section) => (
              <React.Fragment key={section.key}>
                <tr>
                  <td colSpan={CIP_AUTHORIZATION_BANDS.length + 1} style={{ backgroundColor: C.surfaceInset, color: C.text, padding: "8px 10px", fontWeight: 600, borderTop: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}` }}>{section.title}</td>
                </tr>
                {section.rows.map((row, rowIndex) => {
                  const role = CIP_CONTRACT_SIGNING_ROLES[row.roleKey];
                  return (
                    <tr key={`${section.key}-${row.roleKey}`}>
                      <td style={{ position: "sticky", left: 0, zIndex: 1, backgroundColor: rowIndex % 2 ? C.surface : C.surfaceAlt, borderRight: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}`, padding: "8px 10px" }}>
                        <div style={{ fontSize: 12.2, fontWeight: 600, color: C.text }}>{role.label}</div>
                        <div style={{ fontSize: 10.6, color: C.textSubtle, marginTop: 2 }}>{role.defaultName}</div>
                      </td>
                      {CIP_AUTHORIZATION_BANDS.map((band) => {
                        const state = cipContractMatrixCell(row.roleKey, band.key);
                        const selected = band.key === route.band.key;
                        return (
                          <td key={band.key} title={`${role.label} · ${band.code} · ${cellLabel(state)}`} style={{ textAlign: "center", padding: "8px 7px", borderRight: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: selected ? "rgba(11,132,198,0.08)" : rowIndex % 2 ? C.surface : C.surfaceAlt }}>
                            <CipContractDot state={state} selected={selected && !!state} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceInset, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: C.textMuted }}>
        <Icon name="map-pinned" size={13} color={C.textMuted} />
        <span>{tt("Legend: VT = Value Transaction", "Legend: VT = Value Transaction")}</span>
        <Badge tone="neutral">JAHO & All SITE</Badge>
      </div>
    </Card>
  );
}

function CIPAuthorizationMaster() {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const [activeBand, setActiveBand] = React.useState("td");
  const [master, setMaster] = React.useState(() => cipAuthMasterSnapshot());
  const [editSigner, setEditSigner] = React.useState(null);
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    const h = () => setMaster(cipAuthMasterSnapshot());
    window.addEventListener(CIP_AUTH_MASTER_EVENT, h);
    return () => window.removeEventListener(CIP_AUTH_MASTER_EVENT, h);
  }, []);
  const band = CIP_AUTHORIZATION_BANDS.find((b) => b.key === activeBand) || CIP_AUTHORIZATION_BANDS[3];
  const sampleUsd = Number.isFinite(band.maxUsd) ? (band.minUsd + band.maxUsd) / 2 : band.minUsd + 1000000;
  const auth = cipAuthorizationForCase({ value: sampleUsd * CIP_USD_RATE }, CIP_USD_RATE, master);
  const requiredCount = master.roles.reduce((sum, role) => sum + CIP_AUTHORIZATION_BANDS.filter((b) => cipAuthorizationCell(role.key, b.key, master)).length, 0);
  const setMasterDirty = (fn) => {
    setMaster((m) => {
      const next = fn(m);
      setDirty(true);
      return next;
    });
  };
  const cycleCell = (roleKey, bandKey) => {
    const seq = ["", "required", "ack", "board"];
    setMasterDirty((m) => {
      const cur = ((m.matrix[roleKey] || {})[bandKey]) || "";
      const nextState = seq[(seq.indexOf(cur) + 1) % seq.length];
      const matrix = { ...m.matrix, [roleKey]: { ...(m.matrix[roleKey] || {}), [bandKey]: nextState } };
      if (!nextState) delete matrix[roleKey][bandKey];
      return { ...m, matrix };
    });
  };
  const saveMaster = () => {
    cipSaveAuthMaster(master);
    setDirty(false);
    toast.push({ title: tt("Authorization Master saved", "Master Authorization disimpan"), description: tt("Generate Termsheet will use the updated signer matrix.", "Generate Termsheet akan memakai matrix signer terbaru.") });
  };
  const resetMaster = () => {
    const next = cipDefaultAuthMaster();
    setMaster(next);
    cipSaveAuthMaster(next);
    setDirty(false);
    toast.push({ title: tt("Authorization Master reset", "Master Authorization di-reset") });
  };
  const saveSigner = (form) => {
    const key = form.key || `signer${Date.now()}`;
    const role = { key, label: form.label.trim(), defaultName: form.defaultName.trim(), defaultTitle: form.defaultTitle.trim(), group: form.group || "approved" };
    if (!role.label || !role.defaultName) return;
    setMasterDirty((m) => {
      const exists = m.roles.some((r) => r.key === key);
      return { ...m, roles: exists ? m.roles.map((r) => (r.key === key ? role : r)) : [...m.roles, role], matrix: { ...m.matrix, [key]: { ...(m.matrix[key] || {}) } } };
    });
    setEditSigner(null);
  };
  const removeSigner = (roleKey) => {
    setMasterDirty((m) => {
      const matrix = { ...m.matrix };
      delete matrix[roleKey];
      return { ...m, roles: m.roles.filter((r) => r.key !== roleKey), matrix };
    });
  };
  const dot = (state, selected) => {
    const base = { width: 17, height: 17, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto", transition: "transform .15s ease, box-shadow .15s ease" };
    if (state === "required") return <span style={{ ...base, backgroundColor: "#0B84C6", border: "1.5px solid #064B76", boxShadow: selected ? "0 0 0 4px rgba(11,132,198,0.16)" : "none" }} />;
    if (state === "ack") return <span style={{ ...base, backgroundColor: C.surface, border: "1.5px solid #064B76", boxShadow: selected ? "0 0 0 4px rgba(11,132,198,0.14)" : "none" }} />;
    if (state === "board") return <span style={{ ...base, backgroundColor: "#57798D", border: "1.5px solid #3E5C6E", boxShadow: selected ? "0 0 0 4px rgba(87,121,141,0.18)" : "none" }} />;
    return <span style={{ ...base, width: 7, height: 7, backgroundColor: C.borderSoft, border: "none" }} />;
  };
  return (
    <OpsPage>
      <OpsHero kicker={tt("Master data", "Data master")} kickerIcon="database"
        title={tt("Authorization Master", "Master Authorization")}
        subtitle={tt("Maintain Term Sheet authorization and review the separate Contract signing matrix by value band.", "Kelola authorization Term Sheet dan review matrix penandatangan Contract yang terpisah berdasarkan band nilai.")}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {dirty && <Badge tone="warning"><Icon name="circle-alert" size={12} />{tt("Unsaved", "Belum disimpan")}</Badge>}
          <OpsHeroButton variant="secondary" iconLeft="rotate-ccw" onClick={resetMaster}>{tt("Reset", "Reset")}</OpsHeroButton>
          <OpsHeroButton variant="primary" iconLeft="save" onClick={saveMaster}>{tt("Save changes", "Simpan perubahan")}</OpsHeroButton>
        </div>}
      />

      <OpsStatGrid cols={4}>
        <OpsStatCard icon="badge-dollar-sign" label={tt("USD conversion", "Konversi USD")} value={`IDR ${CIP_USD_RATE.toLocaleString("id-ID")}`} sub="1 USD" iconTone="brand" />
        <OpsStatCard icon="columns-3" label={tt("Value bands", "Band nilai")} value={CIP_AUTHORIZATION_BANDS.length} sub="VT matrix" iconTone="blue" />
        <OpsStatCard icon="users-round" label={tt("Authority roles", "Role otorisasi")} value={master.roles.length} sub={tt("signer master", "master signer")} iconTone="forest" />
        <OpsStatCard icon="check-circle-2" label={tt("Term Sheet cells", "Cell Term Sheet")} value={requiredCount} sub={tt("editable rules", "aturan editable")} iconTone="orange" />
      </OpsStatGrid>

      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 16, alignItems: "start" }} className="cip-detail-grid">
        <DetailCard title={tt("Signer list", "Daftar signer")} subtitle={tt("Names, titles, and role groups", "Nama, jabatan, dan kelompok role")}
          action={<Button size="sm" iconLeft="plus" onClick={() => setEditSigner({ key: "", label: "", defaultName: "", defaultTitle: "", group: "approved" })}>{tt("Add", "Tambah")}</Button>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {master.roles.map((role, i) => (
              <div key={role.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, backgroundColor: C.surface }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.2, color: C.text, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role.label}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role.defaultName}</div>
                </div>
                <IconButton name="pencil" title={tt("Edit signer", "Edit signer")} onClick={() => setEditSigner(role)} />
                <IconButton name="trash-2" title={tt("Remove signer", "Hapus signer")} onClick={master.roles.length <= 1 ? undefined : () => removeSigner(role.key)} style={master.roles.length <= 1 ? { opacity: 0.42, cursor: "not-allowed" } : {}} />
              </div>
            ))}
          </div>
        </DetailCard>

        <Card pad={0} style={{ overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{tt("Matrix Authorization Term Sheet", "Matrix Authorization Term Sheet")}</div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: C.textMuted }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{dot("required")} {tt("Required signer", "Penandatangan wajib")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{dot("ack")} {tt("Acknowledged", "Diketahui")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{dot("board")} {tt("Board route", "Route BOD")}</span>
            </div>
          </div>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 12 }}>
            <Icon name="mouse-pointer-click" size={13} />{tt("Click a cell to cycle: blank → required → acknowledged → board route.", "Klik cell untuk mengganti: kosong → wajib → diketahui → route BOD.")}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 1120, borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, zIndex: 2, backgroundColor: "#0F5D6C", color: "#fff", textAlign: "left", padding: "11px 10px", width: 220, borderRight: "1px solid rgba(255,255,255,0.24)" }}>{tt("Role", "Role")}</th>
                  {CIP_AUTHORIZATION_BANDS.map((b) => {
                    const selected = activeBand === b.key;
                    return (
                      <th key={b.key} style={{ backgroundColor: selected ? "#0B84C6" : "#0F5D6C", color: "#fff", padding: "9px 8px", minWidth: 92, borderRight: "1px solid rgba(255,255,255,0.24)", verticalAlign: "top" }}>
                        <button onClick={() => setActiveBand(b.key)} style={{ ...FONT, cursor: "pointer", border: "none", background: "transparent", color: "#fff", padding: 0, width: "100%", textAlign: "center" }}>
                          <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, lineHeight: 1.25 }}>{b.label}</span>
                          <span style={{ display: "block", fontSize: 9, fontStyle: "italic", opacity: 0.86, marginTop: 5 }}>{b.code}</span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {master.roles.map((role, rowIdx) => (
                  <tr key={role.key}>
                    <td style={{ position: "sticky", left: 0, zIndex: 1, backgroundColor: rowIdx % 2 ? C.surface : C.surfaceAlt, borderTop: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, padding: "9px 10px" }}>
                      <div style={{ fontSize: 12.2, fontWeight: 800, color: C.text }}>{role.label}</div>
                      <div style={{ fontSize: 10.6, color: C.textSubtle, marginTop: 2 }}>{role.defaultName}</div>
                    </td>
                    {CIP_AUTHORIZATION_BANDS.map((b) => {
                      const state = cipAuthorizationCell(role.key, b.key, master);
                      const selected = activeBand === b.key;
                      return (
                        <td key={b.key} style={{ textAlign: "center", padding: "9px 8px", borderTop: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: selected ? "rgba(11,132,198,0.08)" : rowIdx % 2 ? C.surface : C.surfaceAlt }}>
                          <button onClick={() => { setActiveBand(b.key); cycleCell(role.key, b.key); }} title={`${role.label} · ${b.code}`} style={{ ...FONT, cursor: "pointer", border: "none", background: "transparent", padding: 2 }}>{dot(state, selected && state)}</button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <CipContractMatrixPolicy sampleCase={{ value: sampleUsd * CIP_USD_RATE }} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 16 }} className="cip-split">
        <DetailCard title={tt("Active signer sequence", "Urutan signer aktif")} subtitle={`${band.code} · ${band.label}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {auth.signers.map((s, i) => (
              <div key={s.key} style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, padding: 12, backgroundColor: C.surface }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: C.ocean, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginTop: 8 }}>{s.defaultName}</div>
                <div style={{ fontSize: 11.2, color: C.textMuted, marginTop: 2 }}>{s.defaultTitle}</div>
              </div>
            ))}
          </div>
        </DetailCard>
        <DetailCard title={tt("Template binding", "Binding template")} subtitle={CIP_TERMSHEET_TEMPLATE_META.odsFile}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {CIP_TERMSHEET_TEMPLATE_FIELDS.slice(0, 7).map((field) => (
              <div key={field.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, borderBottom: `1px solid ${C.borderSoft}`, paddingBottom: 7 }}>
                <span style={{ color: C.text, fontWeight: 700 }}>{field.id}</span>
                <span style={{ color: C.textSubtle, fontFamily: "monospace" }}>row {field.row}</span>
              </div>
            ))}
          </div>
        </DetailCard>
      </div>
      <CipSignerEditor open={!!editSigner} signer={editSigner} onClose={() => setEditSigner(null)} onSave={saveSigner} />
    </OpsPage>
  );
}

function CipSignerEditor({ open, signer, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const [form, setForm] = React.useState(signer || {});
  React.useEffect(() => { if (open) setForm(signer || {}); }, [open, signer && signer.key]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isNew = !form.key;
  return (
    <Modal open={open} onClose={onClose} width={500} icon="user-cog" title={isNew ? tt("Add signer", "Tambah signer") : tt("Edit signer", "Edit signer")}
      subtitle={tt("Signer metadata used by the Termsheet authorization sequence.", "Metadata signer yang dipakai oleh urutan otorisasi Termsheet.")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={() => onSave(form)} disabled={!String(form.label || "").trim() || !String(form.defaultName || "").trim()}>{tt("Apply", "Terapkan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Authorization role", "Role otorisasi")} required>
          <TextInput iconLeft="shield-check" value={form.label || ""} onChange={(e) => set("label", e.target.value)} placeholder="Dept. Head Procurement" />
        </Field>
        <Field label={tt("Signer name", "Nama signer")} required>
          <TextInput iconLeft="user" value={form.defaultName || ""} onChange={(e) => set("defaultName", e.target.value)} placeholder="Andy Prasetio Wibowo" />
        </Field>
        <Field label={tt("Position title", "Jabatan")}>
          <TextInput iconLeft="briefcase-business" value={form.defaultTitle || ""} onChange={(e) => set("defaultTitle", e.target.value)} placeholder="Vendor Onboarding Dept. Head" />
        </Field>
        <Field label={tt("Signature group", "Grup tanda tangan")}>
          <Select value={form.group || "approved"} onChange={(e) => set("group", e.target.value)} options={[
            { value: "prepared", label: "Prepared by" },
            { value: "submitted", label: "Submitted by" },
            { value: "approved", label: "Approved by" },
            { value: "noted", label: "Noted by" },
          ]} />
        </Field>
        <Alert tone="info" title={tt("Matrix assignment", "Assignment matrix")} description={tt("After saving this signer, click the matrix cells to assign which value bands require this role.", "Setelah signer disimpan, klik cell matrix untuk menentukan band nilai yang membutuhkan role ini.")} />
      </div>
    </Modal>
  );
}

/* =================== DOCUMENT REPOSITORY =================== */

function CIPRepository({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const toast = useToast();
  const cip = useCipStore();
  const [typeF, setTypeF] = React.useState("all");
  const ps = usePageSearch(tt("Search document…", "Cari dokumen…"));
  const q = ps.query, setQ = ps.setQuery;

  const docs = cipRepositoryDocs(cip.cases);
  const counts = { all: docs.length };
  Object.keys(CIP_DOCTYPES).forEach((k) => (counts[k] = docs.filter((d) => d.type === k).length));
  const filtered = docs.filter((d) => typeF === "all" || d.type === typeF)
    .filter((d) => { const qq = q.trim().toLowerCase(); return !qq || d.name.toLowerCase().includes(qq) || d.caseTitle.toLowerCase().includes(qq) || d.vendor.toLowerCase().includes(qq) || d.caseId.toLowerCase().includes(qq); });

  const chip = (key, label, n, icon) => {
    const act = typeF === key;
    return <button key={key} onClick={() => setTypeF(key)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 600, border: `1px solid ${act ? C.ocean : C.border}`, backgroundColor: act ? C.brandBg : C.surface, color: act ? C.ocean : C.textMuted }}>
      {icon && <Icon name={icon} size={12} />}{label}<span style={{ fontSize: 11, fontWeight: 700 }}>{n}</span>
    </button>;
  };

  const columns = [
    { key: "name", label: tt("Document", "Dokumen"), width: 330, render: (d) => {
      const m = CIP_DOCTYPES[d.type];
      return <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={m.icon} size={16} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
          <div style={{ fontSize: 11, color: C.textSubtle }}>{cipKB(d.size)} · {trkFmtDate(d.date, lang)}</div>
        </div>
      </div>; } },
    { key: "type", label: tt("Type", "Jenis"), width: 130, render: (d) => { const m = CIP_DOCTYPES[d.type]; return <Badge tone={m.tone}>{trkText(lang, m)}</Badge>; } },
    { key: "caseId", label: tt("Case", "Kasus"), width: 250, render: (d) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: C.ocean }}>{d.caseId}</div>
        <div style={{ fontSize: 11.5, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.caseTitle}</div>
      </div>) },
    { key: "vendor", label: tt("Vendor", "Vendor"), width: 200, render: (d) => <span style={{ fontSize: 12.5, color: C.text }}>{d.vendor}</span> },
    { key: "act", label: "", width: 110, align: "right", render: (d) => (
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <IconButton name="eye" size="sm" title={tt("Open", "Buka")} onClick={() => { if (d.blobKey) cipResolveDocumentUrl(d).then((u) => u && window.open(u, "_blank")).catch(() => {}); else onNavigate("cipWorkflow", d.caseId); }} />
        <IconButton name="download" size="sm" title={tt("Download", "Unduh")} onClick={() => toast.push({ title: tt("Download started", "Unduhan dimulai"), description: d.name })} />
      </div>) },
  ];

  return (
    <CipPage>
      <CipHero
        kicker={tt("Digital archive", "Arsip digital")}
        title={tt("Document Repository", "Repositori Dokumen")}
        subtitle={tt("Central, structured archive of every document the platform produced — LOA, Termsheet, draft and executed contracts.", "Arsip terpusat & terstruktur untuk seluruh dokumen yang dihasilkan platform — LOA, Termsheet, draf dan kontrak final.")}
        compact
        right={<Badge tone="brand" style={{ alignSelf: "flex-start" }}><Icon name="archive" size={12} />{counts.all} {tt("documents", "dokumen")}</Badge>}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {chip("all", tt("All", "Semua"), counts.all, "files")}
        {Object.keys(CIP_DOCTYPES).map((k) => chip(k, trkText(lang, CIP_DOCTYPES[k]), counts[k], CIP_DOCTYPES[k].icon))}
        <div ref={ps.ref} style={{ width: 280, marginLeft: "auto" }}><TextInput iconLeft="search" placeholder={tt("Search name, case, vendor…", "Cari nama, kasus, vendor…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
      </div>

      <Card pad={0}>
        <DataTable columns={columns} data={filtered} dense rowKey="id"
          emptyTitle={tt("No documents", "Tidak ada dokumen")} emptyDesc={tt("Documents appear as cases move through the pipeline.", "Dokumen muncul saat kasus berjalan melewati pipeline.")} />
      </Card>
    </CipPage>
  );
}

Object.assign(window, { CIPDashboard, CIPTemplates, CIPAuthorizationMaster, CIPRepository, CipPage, CipHero, CipIntegrationBridge, CipSourceChip, CipMiniPipeline, CipPipelineFlow, CipContractDot, CipContractSignerRoute, CipContractMatrixPolicy, cipStatusBadge, cipKB, CIP_HERO_GRAD, CIP_HERO_PATTERN, CIPDocumentPreviewModal });
export { CIPDashboard, CIPTemplates, CIPAuthorizationMaster, CIPRepository, CipPage, CipHero, CipIntegrationBridge, CipSourceChip, CipMiniPipeline, CipPipelineFlow, CipContractDot, CipContractSignerRoute, CipContractMatrixPolicy, cipStatusBadge, cipKB, CIP_HERO_GRAD, CIP_HERO_PATTERN, CIPDocumentPreviewModal };
