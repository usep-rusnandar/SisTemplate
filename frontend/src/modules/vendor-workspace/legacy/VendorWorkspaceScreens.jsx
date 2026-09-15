import React from "react";
import { useC, FONT, RADIUS, GRAD } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
import { Icon, IconButton, Button, Card, Badge } from "../../../shared/legacy/Primitives.jsx";
import { Alert, Spinner, Modal, PageHeader, Tooltip, useToast, fmtAppDate, OpsHero } from "../../../shared/legacy/PrimitivesX.jsx";
import {
  VwApiDocDownloadUrl, VwResolveFramedDocumentUrl, VwApiGetProfile, VwApiListDocs, VwApiGetCertificate, VwApiVendorMe,
  VwApiMapConfig, VwApiMasterSet, VwPortfolioOwnerKey, VwFmtMonthYearRange, VwIsOfficerPortfolio,
} from "./VendorOnboardingData.jsx";
import { VendorProfileWizard, vwIsIndonesiaCountry } from "./VendorProfileWizard.jsx";

/* Alamtri Geo Admin — Vendor Workspace: vendor self-service portal.
  This is the page a vendor sees about THEMSELVES — their company profile,
  legal & tax identity, classification, documents, and registration status.
  All data is loaded live from the backend (/api/v1/vendor-portal/*); there is no local seed. */


/* ---- helpers ---- */
function fmtDate(d, lang) {
  if (!d) return "—";
  const months = lang === "id"
    ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${months[m - 1]} ${y}`;
}

function VwProfileParentCode(record, payloadKey) {
  const direct = record && (record.parentCode || record.ParentCode);
  if (direct) return String(direct).trim();
  if (!record || !record.payloadJson) return "";
  try {
    const payload = typeof record.payloadJson === "string" ? JSON.parse(record.payloadJson) : record.payloadJson;
    const wanted = String(payloadKey || "").toLowerCase();
    const key = Object.keys(payload || {}).find((candidate) => candidate.toLowerCase() === wanted);
    return key && payload[key] != null ? String(payload[key]).trim() : "";
  } catch (e) {
    return "";
  }
}

const VW_EDITABLE_STATUSES = ["INVTD", "RSPND", "DRAFT", "REPIR"];

/* Identity badge: prefer uploaded vendor logo; fall back to monogram initials. */
function VwVendorLogoBadge({ logoDoc, monogram, size = 80 }) {
  const [src, setSrc] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setSrc("");
    if (!logoDoc || !logoDoc.id || logoDoc.isPlaceholder) return undefined;
    VwApiDocDownloadUrl(logoDoc.id)
      .then((url) => { if (!cancelled) setSrc(url || ""); })
      .catch(() => { if (!cancelled) setSrc(""); });
    return () => { cancelled = true; };
  }, [logoDoc && logoDoc.id]);
  const plate = {
    width: size,
    height: size,
    borderRadius: 18,
    flexShrink: 0,
    background: "#fff",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };
  if (src) {
    return (
      <div style={plate}>
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", padding: 8, display: "block", background: "#fff" }}
          onError={() => setSrc("")}
        />
      </div>
    );
  }
  return (
    <div style={{ ...plate, background: "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))", color: "#fff" }}>
      <span style={{ fontSize: Math.round(size * 0.34), fontWeight: 800, letterSpacing: "0.04em", lineHeight: 1 }}>{monogram}</span>
    </div>
  );
}

/* Vendor-facing status. The internal lifecycle has many steps (submitted, approval 1/2/3, …) that only
   matter to Alamtri staff; a vendor only needs to know which of four stages they're in. Maps the raw
   code to a simple label + tone + plain-language description. */
function VwVendorStatus(code) {
  switch (code) {
    case "INITL": return { en: "Initial", id: "Awal", tone: "neutral", dEn: "Your company data has been imported. Wait for an invitation from Alamtri Procurement.", dId: "Data perusahaan Anda sudah diimpor. Menunggu undangan dari Procurement Alamtri." };
    case "INVTD": return { en: "Invited", id: "Diundang", tone: "info", dEn: "You’ve been invited to register as an Alamtri vendor.", dId: "Anda diundang untuk mendaftar sebagai vendor Alamtri." };
    case "RSPND": return { en: "Responded", id: "Direspons", tone: "info", dEn: "Start your company registration to continue.", dId: "Mulai pendaftaran perusahaan untuk melanjutkan." };
    case "DRAFT":  return { en: "Draft", id: "Draf", tone: "neutral", dEn: "Saved as a draft — submit it when you’re ready.", dId: "Tersimpan sebagai draf — kirim jika sudah siap." };
    case "REPIR": return { en: "Needs Revision", id: "Perlu Revisi", tone: "warning", dEn: "Changes were requested — update your data and submit again.", dId: "Ada perbaikan yang diminta — perbarui data Anda lalu kirim ulang." };
    // Approved is an INTERNAL milestone: an Officer still has to register the vendor. Until then the
    // portal keeps saying On Process — telling a vendor they are registered before they are would be a
    // promise the system has not kept yet.
    case "APPRV": return { en: "On Process", id: "Sedang Diproses", tone: "brand", dEn: "Your registration has been approved and is being finalised.", dId: "Pendaftaran Anda telah disetujui dan sedang difinalisasi." };
    case "RGSTD": return { en: "Registered", id: "Terdaftar", tone: "success", dEn: "You’re a registered Alamtri vendor.", dId: "Anda adalah vendor Alamtri yang terdaftar." };
    case "RJCTD": return { en: "Rejected", id: "Ditolak", tone: "danger", dEn: "Your registration was not approved.", dId: "Pengajuan Anda tidak disetujui." };
    case "BLACK":  return { en: "Blacklisted", id: "Diblokir", tone: "danger", dEn: "This vendor account has been blacklisted.", dId: "Akun vendor ini telah diblokir." };
    case "": case null: case undefined: return { en: "—", id: "—", tone: "neutral", dEn: "", dId: "" };
    // SBMIT / APPR1 / APPR2 and any status an approval step is configured with: the vendor is waiting on
    // us. The portal deliberately shows one "On Process" for all of them — internal approval tiers are
    // not the vendor's business, and a configurable status must not leak a step name into the portal.
    default:      return { en: "On Process", id: "Sedang Diproses", tone: "brand", dEn: "Your submission is under review by Alamtri Procurement.", dId: "Pengajuan Anda sedang direview oleh Procurement Alamtri." };
  }
}

/* Right-hand preview pane — the split-screen half the old app used. Any "View" link on the left
   resolves its short-lived SAS URL and renders the document inline here, so the vendor never leaves
   the page to check an attachment. Sticky on desktop; stacks below the data on mobile. */
function VwPreviewPane({ preview, onClose, wide, subKey }) {
  const C = useC();
  const tt = useTT();
  const [src, setSrc] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const isMap = !!(preview && preview.map);
  React.useEffect(() => {
    let cancelled = false;
    setError(""); setSrc("");
    if (!preview || !preview.id) { setLoading(false); return; }
    setLoading(true);
    let objectUrl = "";
    VwApiDocDownloadUrl(preview.id)
      .then((url) => {
        if (!url) throw new Error("preview_unavailable");
        return VwResolveFramedDocumentUrl(url);
      })
      .then((framed) => {
        if (cancelled) {
          if (framed && framed.startsWith("blob:")) URL.revokeObjectURL(framed);
          return;
        }
        objectUrl = framed && framed.startsWith("blob:") ? framed : "";
        setSrc(framed || "");
        if (!framed) setError(tt("Document not available.", "Dokumen tidak tersedia."));
      })
      .catch(() => { if (!cancelled) setError(tt("Unable to load document.", "Tidak bisa memuat dokumen.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview, tt]);
  const bodyHeight = wide ? "calc(100vh - 130px)" : 480;
  const a = isMap ? preview.map : null;
  const mapSrc = a && subKey ? `https://atlas.microsoft.com/map/static/png?api-version=1.0&subscription-key=${subKey}&center=${a.longitude},${a.latitude}&zoom=15&width=1000&height=800&pins=default||${a.longitude} ${a.latitude}` : "";
  const filled = preview && (isMap || loading || src);
  return (
    <Card pad={0} style={{ overflow: "hidden", ...(wide ? { position: "sticky", top: 12 } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
        <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={isMap ? "map-pin" : "file-search"} size={16} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{isMap ? tt("Location", "Lokasi") : tt("Preview document", "Pratinjau dokumen")}</div>
          {preview && <div style={{ fontSize: 11.5, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isMap ? preview.title : preview.fileName}</div>}
        </div>
        {preview && <IconButton size="sm" name="x" variant="secondary" title={tt("Close preview", "Tutup pratinjau")} onClick={onClose} />}
      </div>
      <div style={{ height: bodyHeight, backgroundColor: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", padding: filled ? 0 : 24 }}>
        {!preview
          ? <div style={{ textAlign: "center", maxWidth: 280 }}>
              <div style={{ width: 56, height: 56, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Icon name="file-text" size={26} /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{tt("Nothing to preview yet", "Belum ada yang dipratinjau")}</div>
              <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 5, lineHeight: 1.5 }}>{tt("Click a document’s view icon, or a map, on the left to open it here.", "Klik ikon lihat pada dokumen, atau peta, di sebelah kiri untuk membukanya di sini.")}</div>
            </div>
          : isMap
            ? <div style={{ position: "relative", width: "100%", height: "100%" }}>
                {mapSrc
                  ? <img src={mapSrc} alt="map" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: C.textMuted }}>{tt("Map preview unavailable.", "Pratinjau peta tidak tersedia.")}</div>}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "9px 14px", backgroundColor: "rgba(1,43,62,0.78)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{a.latitude}, {a.longitude}</span>
                  <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer" style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>{tt("Open in Google Maps", "Buka di Google Maps")}</a>
                </div>
              </div>
          : loading ? <Spinner size={22} color={C.ocean} />
          : src ? <iframe title={preview.fileName || "document"} src={src} style={{ width: "100%", height: "100%", border: 0, backgroundColor: "#fff" }} />
          : <div style={{ fontSize: 13, color: C.textMuted }}>{error || tt("Document not available.", "Dokumen tidak tersedia.")}</div>}
      </div>
    </Card>
  );
}

/* Document "view" affordance — a single, standard eye icon + tooltip (matches the top-bar icons). */
function DocEye({ doc, onView }) {
  const C = useC();
  const tt = useTT();
  if (!doc) return <span style={{ color: C.textMuted }}>-</span>;
  return <IconButton size="sm" variant="secondary" name="search" title={tt("Preview document", "Pratinjau dokumen")} onClick={() => onView({ id: doc.id, fileName: doc.fileName })} />;
}

/* ---- Legacy-style read blocks (mirror VendorConnect's _VendorProfilePartial left column) ---- */

/* Centred section title on a rule — the old app's "line-with-text". */
function OldDivider({ children }) {
  const C = useC();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 12px" }}>
      <span style={{ flex: 1, height: 1, backgroundColor: C.border }} />
      <span style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{children}</span>
      <span style={{ flex: 1, height: 1, backgroundColor: C.border }} />
    </div>
  );
}

function OldCard({ title, children }) {
  const C = useC();
  return (
    <div style={{ backgroundColor: C.surface, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12 }}>
      {title && <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${C.borderSoft}` }}>{title}</div>}
      {children}
    </div>
  );
}

/* "NPWP — Tax Registration" style sub-header. */
function OldHead({ code, desc }) {
  const C = useC();
  return <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>{code}{desc ? <span style={{ fontSize: 12.5, fontWeight: 400, color: C.textMuted }}> — {desc}</span> : null}</div>;
}

/* Label / value row with alternating stripes (the old app's col-4 / ":" / col-8 pattern). Single
   language — the label follows the current UI language. */
function OldRow({ label, alt, children }) {
  const C = useC();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 42%) 12px minmax(0, 1fr)", gap: 6, alignItems: "start", padding: "8px 10px", backgroundColor: alt ? C.surfaceAlt : "transparent", borderRadius: 4 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{label}</div>
      <div style={{ color: C.textMuted, fontSize: 12.5 }}>:</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, minWidth: 0, width: "100%", wordBreak: "break-word" }}>{children}</div>
    </div>
  );
}

/* Document link — the standard eye icon + tooltip (see DocEye), or "-" when no file. */
function OldDoc({ doc, onView }) {
  return <DocEye doc={doc} onView={onView} />;
}

/* Static map thumbnail (Azure) with a "location" placeholder. Clickable when coordinates exist —
   opens the full map in the preview pane. */
function OldMap({ addr, subKey, onOpen }) {
  const C = useC();
  const tt = useTT();
  const a = addr || {};
  const has = a.latitude != null && a.longitude != null;
  const src = has && subKey
    ? `https://atlas.microsoft.com/map/static/png?api-version=1.0&subscription-key=${subKey}&center=${a.longitude},${a.latitude}&zoom=15&width=1200&height=180&pins=default||${a.longitude} ${a.latitude}`
    : "";
  const clickable = has && !!onOpen;
  const thumb = (
    <div onClick={clickable ? onOpen : undefined}
      style={{ width: "100%", height: 90, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", backgroundColor: C.surfaceAlt, display: "block", cursor: clickable ? "pointer" : "default", position: "relative" }}>
      {src ? <img src={src} alt="map" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: C.textSubtle, fontSize: 11 }}><span><Icon name="map" size={18} /><div>{tt("location", "lokasi")}</div></span></div>}
      {clickable && <span style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 6, backgroundColor: "rgba(1,43,62,0.72)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="maximize-2" size={12} /></span>}
    </div>
  );
  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      {clickable ? <Tooltip block label={tt("View location", "Lihat lokasi")}>{thumb}</Tooltip> : thumb}
      {has && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>{tt("Coordinates", "Koordinat")}: {a.latitude}, {a.longitude}</div>}
    </div>
  );
}

/* Simple themed table for the Commodity / Brand / KBLI / Sertifikat / Portfolio grids. */
function OldGrid({ cols, data, renderCells, empty }) {
  const C = useC();
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ backgroundColor: C.surfaceAlt, textAlign: "left" }}>
            {cols.map((c, i) => <th key={i} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: C.textMuted, width: c.width, textAlign: c.align || "left", whiteSpace: "nowrap" }}>{c.label}</th>)}
          </tr></thead>
          <tbody>
            {(!data || data.length === 0)
              ? <tr><td colSpan={cols.length} style={{ padding: 10, fontSize: 12, color: C.textSubtle, fontStyle: "italic" }}>{empty}</td></tr>
              : data.map((row, i) => <tr key={i} style={{ borderTop: `1px solid ${C.borderSoft}` }}>{renderCells(row, i)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorWorkspaceProfile({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const { lang, setLang } = useI18n();
  const toast = useToast();
  const [profile, setProfile] = React.useState(null);
  const [docs, setDocs] = React.useState([]);
  const [cert, setCert] = React.useState(null);
  const [me, setMe] = React.useState(null);
  const [mapCfg, setMapCfg] = React.useState({ subscriptionKey: "" });
  const [maps, setMaps] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [wide, setWide] = React.useState(true);

  // The data / preview split collapses at 980px (ag-menus-grid) — only pin the preview pane above that.
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 981px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener ? mq.addEventListener("change", sync) : mq.addListener(sync);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", sync) : mq.removeListener(sync); };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, c] = await Promise.all([
        VwApiGetProfile().catch(() => null),
        VwApiListDocs().catch(() => []),
        VwApiGetCertificate().catch(() => null),
      ]);
      setProfile(p);
      setDocs(Array.isArray(d) ? d : []);
      setCert(c);
    } finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // First visit only: Indonesia (or missing country) → ID, otherwise EN. An explicit flag toggle
  // writes vw_lang and is left alone on later loads.
  React.useEffect(() => {
    if (!profile) return;
    try {
      if (window.__procurementStorage && window.__procurementStorage.getItem("vw_lang")) return;
    } catch (e) { return; }
    const country = profile.office && profile.office.country;
    setLang(vwIsIndonesiaCountry(country) ? "id" : "en");
  }, [profile, setLang]);

  // Resolve the current user (PIC name/email), map key and friendly names for coded fields, so the
  // legacy-style read view can show names rather than raw codes (all best-effort, non-blocking).
  React.useEffect(() => {
    VwApiVendorMe().then(setMe).catch(() => {});
    VwApiMapConfig().then((c) => c && setMapCfg(c)).catch(() => {});
    const put = (alias, rows) => setMaps((m) => ({ ...m, [alias]: Object.fromEntries((rows || []).map((r) => [r.code, r])) }));
    [
      ["commodity-subclassification", "sub", 20000], ["commodity-classification", "cls", 5000], ["commodity-category", "cat", 1000],
      ["distributor-type", "distr", 200], ["kbli", "kbli", 20000], ["kbli-type", "ktype", 200], ["kbli-status", "kstatus", 200],
      ["special-requirement", "sr", 500], ["province", "prov", 500], ["country", "country", 500],
    ].forEach(([key, alias, take]) => VwApiMasterSet(key, { take }).then((rows) => put(alias, rows)).catch(() => {}));
  }, []);

  // City / district / village names cascade from the codes actually used in the profile's addresses.
  React.useEffect(() => {
    if (!profile) return;
    const merge = (alias, rows) => setMaps((m) => ({ ...m, [alias]: { ...(m[alias] || {}), ...Object.fromEntries((rows || []).map((r) => [r.code, r])) } }));
    const addrs = [profile.office, profile.warehouse, profile.workshop].filter(Boolean);
    const uniq = (xs) => Array.from(new Set(xs.filter(Boolean)));
    const cascade = (setKey, alias, parents) => Promise.all(parents.map((pc) => VwApiMasterSet(setKey, { parent: pc, take: 5000 }).catch(() => [])))
      .then((lists) => merge(alias, [].concat.apply([], lists))).catch(() => {});
    cascade("city", "kota", uniq(addrs.map((a) => a.provinceCode)));
    cascade("district", "kec", uniq(addrs.map((a) => a.cityCode)));
    cascade("village", "desa", uniq(addrs.map((a) => a.districtCode)));
  }, [profile]);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><Spinner size={26} /></div>;
  }

  const p = profile || {};
  const name = p.name || tt("My company", "Perusahaan saya");
  const statusCode = p.status || "DRAFT";
  const vs = VwVendorStatus(statusCode);
  const vsColor = { info: C.info, brand: C.ocean, success: C.forest, warning: C.orange, danger: C.danger, neutral: C.textMuted }[vs.tone] || C.textMuted;
  const editable = VW_EDITABLE_STATUSES.includes(statusCode);
  // Invitation stage (INVTD shown as "Invited", RSPND shown as "Responded"): no biodata or documents
  // exist yet, so the read view + preview pane below stay hidden until registration starts.
  const invitedStage = statusCode === "INVTD" || statusCode === "RSPND";
  const monogram = name.replace(/^PT\s+|^CV\s+/i, "").split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "V";
  const office = p.office || {};

  // Match uploaded documents (VENDOR_DOCUMENT_T) by type / owner-key, following the wizard's conventions.
  const docBy = (type) => docs.find((d) => !d.isPlaceholder && (d.documentType || "").toLowerCase() === type)
    || docs.find((d) => (d.documentType || "").toLowerCase() === type);
  const docByOwner = (type, owner) => docs.find((d) => (d.documentType || "").toLowerCase() === type && (d.ownerKey || "") === owner);
  const view = (d) => setPreview({ id: d.id, fileName: d.fileName });

  // Master-data name lookups (with parent chaining for the commodity hierarchy).
  const rec = (alias, code) => (code && maps[alias] && maps[alias][code]) || null;
  const nm = (alias, code) => { const r = rec(alias, code); return r ? r.name : null; };
  const dash = (v) => (v == null || v === "" ? "-" : v);
  const fmtIdr = (v) => "Rp " + Number(v || 0).toLocaleString("id-ID");
  const td = { padding: "8px 10px", verticalAlign: "top", color: C.text };
  const tdMuted = { padding: "8px 10px", verticalAlign: "top", color: C.textMuted };

  // One address block in the legacy layout (title card + striped rows + map thumbnail).
  const addressCard = (title, addrLabel, a) => {
    a = a || {};
    const rows = [
      { label: addrLabel, val: dash(a.address) },
      { label: tt("Map", "Peta"), val: <OldMap addr={a} subKey={mapCfg.subscriptionKey} onOpen={() => setPreview({ map: a, title })} /> },
      { label: tt("Country", "Negara"), val: dash(a.country) },
      { label: tt("Province", "Provinsi"), val: dash(nm("prov", a.provinceCode) || a.provinceCode) },
      { label: tt("City", "Kota"), val: dash(nm("kota", a.cityCode) || a.cityCode) },
      { label: tt("District", "Kecamatan"), val: dash(nm("kec", a.districtCode) || a.districtCode) },
      { label: tt("Village", "Kelurahan/Desa"), val: dash(nm("desa", a.villageCode) || a.villageCode) },
      { label: tt("ZIP/Post Code", "Kode Pos"), val: dash(a.postCode) },
    ];
    return <OldCard title={title}>{rows.map((r, i) => <OldRow key={i} label={r.label} alt={i % 2 === 0}>{r.val}</OldRow>)}</OldCard>;
  };

  return (
    <div>
      {editing && (
        <VendorProfileWizard
          initialProfile={profile}
          onCancel={() => setEditing(false)}
          onSaved={async (result, submit) => {
            await load();
            setEditing(false);
            toast.push({ title: submit ? tt("Submitted for review", "Terkirim untuk review") : tt("Draft saved", "Draf tersimpan") });
          }}
        />
      )}

      <PageHeader
        breadcrumb={[{ label: tt("Vendor Workspace", "Vendor Workspace") }, { label: tt("Vendor Profile", "Profil Vendor") }]}
        title={tt("My Vendor Profile", "Profil Vendor Saya")}
        description={tt("Keep your company information, legal documents, and classification up to date. This is the data Alamtri Procurement sees when evaluating you.",
                        "Jaga agar informasi perusahaan, dokumen legal, dan klasifikasi Anda tetap terkini. Inilah data yang dilihat Procurement Alamtri saat mengevaluasi Anda.")}
        actions={
          <Button iconLeft={statusCode === "RSPND" ? "arrow-right" : "pencil"} disabled={!editable} onClick={() => setEditing(true)}>
            {statusCode === "REPIR" ? tt("Revise profile", "Revisi profil")
              : statusCode === "RSPND" ? tt("Start registration", "Mulai pendaftaran")
              : tt("Edit profile & submit", "Ubah profil & kirim")}
          </Button>
        }
      />

      {statusCode === "RSPND" && <VwWelcomeBanner />}

      {!editable && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone={vs.tone === "danger" ? "error" : "info"} title={tt("Profile is read-only", "Profil hanya-baca")}
            description={tt("Your profile is currently under review or finalised, so it can't be edited. Alamtri Procurement will contact you if changes are needed.",
                            "Profil Anda sedang direview atau sudah final, sehingga tidak dapat diubah. Procurement Alamtri akan menghubungi Anda bila ada yang perlu diperbaiki.")} />
        </div>
      )}
      {statusCode === "REPIR" && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning" title={tt("Revision requested", "Perlu revisi")}
            description={p.lastReason
              ? p.lastReason
              : tt("Alamtri Procurement asked for changes. Update your profile and submit again.", "Procurement Alamtri meminta perubahan. Perbarui profil Anda lalu kirim ulang.")} />
        </div>
      )}

      {/* Identity band — the company itself is the hero (brand navy→teal) */}
      <div style={{ borderRadius: RADIUS.xl, overflow: "hidden", marginBottom: 18, background: GRAD.primary, color: "#fff", boxShadow: C.shadowMd }}>
        <div style={{ padding: "22px 24px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <VwVendorLogoBadge logoDoc={docBy("logo")} monogram={monogram} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>{tt("Vendor", "Vendor")}</div>
            <h3 style={{ margin: "5px 0 0", fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.1 }}>{name}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 9, flexWrap: "wrap", fontSize: 12.5, color: "rgba(255,255,255,0.82)" }}>
              {p.position && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="user" size={13} />{p.position}</span>}
              {office.address && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}><Icon name="map-pin" size={13} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>{office.address}</span></span>}
              {p.webAddress && <a href={`https://${p.webAddress}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", textDecoration: "none", fontWeight: 700 }}><Icon name="globe" size={13} />{p.webAddress}</a>}
            </div>
          </div>
          {/* Vendor status — far right, high contrast, with a plain-language note */}
          <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, maxWidth: 260 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>{tt("Vendor status", "Status vendor")}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 15px", borderRadius: RADIUS.pill, backgroundColor: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.22)" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: vsColor }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: vsColor, letterSpacing: "0.01em" }}>{lang === "id" ? vs.id : vs.en}</span>
            </span>
            {(lang === "id" ? vs.dId : vs.dEn) && <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.88)", textAlign: "right", lineHeight: 1.45 }}>{lang === "id" ? vs.dId : vs.dEn}</span>}
          </div>
        </div>
      </div>

      {/* Split screen (like the legacy app): filed record on the left, live document preview on the right */}
      {!invitedStage && (
      <div className="ag-menus-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>

          {cert && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: C.successBg, border: `1px solid ${C.successBorder || C.borderSoft}`, marginBottom: 18 }}>
              <Icon name="award" size={20} color={C.success} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{tt("E-certificate", "E-sertifikat")}: <span style={{ fontFamily: "monospace" }}>{cert.certificateNumber}</span>{cert.isRevoked ? <Badge tone="danger" size="sm" style={{ marginLeft: 8 }}>{tt("Revoked", "Dicabut")}</Badge> : null}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted }}>{tt("Issued", "Diterbitkan")}: {fmtAppDate(cert.issuedAt)}</div>
              </div>
              <Button size="sm" variant="secondary" iconLeft="search" onClick={() => view({ id: cert.documentId, fileName: `${String(cert.certificateNumber || "E-certificate").replace(/\//g, "-")}.pdf` })}>{tt("View", "Lihat")}</Button>
            </div>
          )}

          <OldDivider>Biodata</OldDivider>

          <OldCard>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>{tt("Vendor Biodata and Declaration Statement", "Biodata Vendor dan Pernyataan")}</div>
            {[
              { ok: p.isBiodataTrue, text: tt("All information provided in this Vendor Biodata is true, accurate, and complete.", "Seluruh informasi yang disampaikan dalam Biodata Vendor ini adalah benar, akurat dan lengkap.") },
              { ok: p.isAgreeSubmit, text: tt("I agree to complete this biodata and submit all required documents in line with Alamtri’s General and Specific Requirements.", "Saya bersedia mengisi biodata ini dan melengkapi seluruh dokumen yang dipersyaratkan sesuai Persyaratan Umum dan Khusus yang ditetapkan Alamtri.") },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: row.ok ? C.successBg : C.surfaceAlt, color: C.success, border: `1px solid ${row.ok ? C.success : C.border}` }}>{row.ok && <Icon name="check" size={11} />}</span>
                <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>{row.text}</div>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              {[
                { label: tt("Integrity Pact", "Pakta Integritas"), val: <OldDoc doc={docBy("pakta-integritas")} onView={view} /> },
                { label: tt("Company Profile", "Profil Perusahaan"), val: <OldDoc doc={docBy("company-profile")} onView={view} /> },
                { label: tt("Vendor Name", "Nama Perusahaan"), val: dash(p.name) },
                { label: tt("Person in Charge", "Nama Penanggung Jawab"), val: dash(me && me.name) },
                { label: tt("Position", "Jabatan"), val: dash(p.position) },
                { label: tt("Email Address", "Alamat Email"), val: dash(me && me.email) },
                { label: tt("Office Phone", "Telepon Kantor"), val: dash([p.officePhoneCountry, p.officePhoneArea, p.officePhoneNumber].filter(Boolean).join(" ")) },
                { label: tt("Mobile Phone", "Nomor Handphone"), val: dash([p.handphoneCountry, p.handphoneNumber].filter(Boolean).join(" ")) },
                { label: tt("Web Address", "Situs Perusahaan"), val: dash(p.webAddress) },
                { label: tt("Operational Organization Structure", "Struktur Organisasi Operasional"), val: <OldDoc doc={docBy("org-structure")} onView={view} /> },
              ].map((r, i) => <OldRow key={i} label={r.label} alt={i % 2 === 0}>{r.val}</OldRow>)}
            </div>
          </OldCard>

          {addressCard(tt("Office Address", "Alamat Kantor"), tt("Office Address", "Alamat Perusahaan"), p.office)}
          {addressCard(tt("Warehouse Address", "Alamat Gudang"), tt("Warehouse Address", "Alamat Gudang"), p.warehouse)}
          {addressCard(tt("Workshop Address", "Alamat Workshop"), tt("Workshop / Operational Kitchen Address", "Alamat Workshop / Dapur Operasional"), p.workshop)}

          <OldCard title={tt("Commodity", "Commodity")}>
            <OldGrid
              cols={[{ label: tt("Sub Classification", "Sub Klasifikasi") }, { label: tt("Classification", "Klasifikasi") }, { label: tt("Category", "Kategori") }]}
              data={p.subClassifications || []} empty={tt("No commodities.", "Tidak ada commodity.")}
              renderCells={(s) => { const subR = rec("sub", s.subClassificationCode); const clsCode = VwProfileParentCode(subR, "ClassificationId"); const clsR = rec("cls", clsCode); const catCode = VwProfileParentCode(clsR, "CategoryId"); return (
                <><td style={td}>{nm("sub", s.subClassificationCode) || s.subClassificationCode}</td><td style={tdMuted}>{nm("cls", clsCode) || dash(clsCode)}</td><td style={tdMuted}>{nm("cat", catCode) || dash(catCode)}</td></>
              ); }} />
          </OldCard>

          <OldCard title={tt("Brand", "Merek")}>
            <OldGrid
              cols={[{ label: tt("Brand", "Merek") }, { label: tt("Distributor Type", "Tipe Distributor") }, { label: tt("Expire Date", "Kedaluwarsa"), width: 110 }, { label: tt("File", "Berkas"), width: 46, align: "center" }]}
              data={p.brands || []} empty={tt("No brands.", "Tidak ada merek.")}
              renderCells={(b) => { const d = docByOwner("brand", b.brandName); return (
                <><td style={td}>{b.brandName}</td><td style={tdMuted}>{nm("distr", b.distributorTypeCode) || dash(b.distributorTypeCode)}</td><td style={tdMuted}>{b.expireDate ? fmtDate(b.expireDate, lang) : "-"}</td><td style={{ ...td, textAlign: "center" }}><DocEye doc={d} onView={view} /></td></>
              ); }} />
          </OldCard>

          <OldDivider>{tt("General Requirements", "Persyaratan Umum")}</OldDivider>

          <OldCard>
            <OldHead code="NPWP" desc={tt("Tax Registration", "Registrasi Pajak")} />
            {[
              { label: tt("NPWP No.", "No. NPWP"), val: dash(p.npwpNo) },
              { label: tt("NPWP File", "Berkas NPWP"), val: <OldDoc doc={docBy("npwp")} onView={view} /> },
            ].map((r, i) => <OldRow key={i} label={r.label} alt={i % 2 === 0}>{r.val}</OldRow>)}
          </OldCard>

          <OldCard>
            <OldHead code="NIB" desc={tt("Risk-Based Business Number", "Nomor Induk Berusaha Berbasis Resiko")} />
            {[
              { label: tt("NIB No.", "No. NIB"), val: dash(p.nibNo) },
              { label: tt("NIB File", "Berkas NIB"), val: <OldDoc doc={docBy("nib")} onView={view} /> },
            ].map((r, i) => <OldRow key={i} label={r.label} alt={i % 2 === 0}>{r.val}</OldRow>)}
          </OldCard>

          <OldCard>
            <OldHead code="AKTA" desc={tt("Establishment, latest amendment & adjustment + SK Menkumham", "Pendirian, Perubahan Terakhir dan Penyesuaian beserta SK Menkumham")} />
            {[
              { label: tt("Akta Pendirian No.", "No. Akta Pendirian"), val: dash(p.aktaPendirianNo) },
              { label: tt("Akta Pendirian Date", "Tgl. Akta Pendirian"), val: p.aktaPendirianDate ? fmtDate(p.aktaPendirianDate, lang) : "-" },
              { label: tt("Akta Pendirian File", "Berkas Akta Pendirian"), val: <OldDoc doc={docBy("akta-pendirian")} onView={view} /> },
              { label: tt("Akta Perubahan No.", "No. Akta Perubahan"), val: dash(p.aktaPerubahanNo) },
              { label: tt("Akta Perubahan Date", "Tgl. Akta Perubahan"), val: p.aktaPerubahanDate ? fmtDate(p.aktaPerubahanDate, lang) : "-" },
              { label: tt("Akta Perubahan File", "Berkas Akta Perubahan"), val: <OldDoc doc={docBy("akta-perubahan")} onView={view} /> },
              { label: tt("Akta Penyesuaian No.", "No. Akta Penyesuaian"), val: dash(p.aktaPenyesuaianNo) },
              { label: tt("Akta Penyesuaian Date", "Tgl. Akta Penyesuaian"), val: p.aktaPenyesuaianDate ? fmtDate(p.aktaPenyesuaianDate, lang) : "-" },
              { label: tt("Akta Penyesuaian File", "Berkas Akta Penyesuaian"), val: <OldDoc doc={docBy("akta-penyesuaian")} onView={view} /> },
            ].map((r, i) => <OldRow key={i} label={r.label} alt={i % 2 === 0}>{r.val}</OldRow>)}
          </OldCard>

          <OldCard>
            <OldHead code="SPPKP" desc={tt("Taxable Entrepreneur Confirmation Letter", "Surat Pengukuhan Pengusaha Kena Pajak Badan Usaha")} />
            {[
              { label: tt("SPPKP No.", "No. SPPKP"), val: dash(p.sppkpNo) },
              { label: tt("SPPKP File", "Berkas SPPKP"), val: <OldDoc doc={docBy("sppkp")} onView={view} /> },
            ].map((r, i) => <OldRow key={i} label={r.label} alt={i % 2 === 0}>{r.val}</OldRow>)}
          </OldCard>

          <OldCard>
            <OldHead code="KBLI" desc={tt("as listed in the NIB", "tercantum di NIB")} />
            <OldGrid
              cols={[{ label: tt("Risk", "Resiko"), width: 90 }, { label: "Id", width: 60 }, { label: tt("KBLI Description", "Deskripsi KBLI") }, { label: tt("Status", "Status"), width: 100 }, { label: tt("File", "Berkas"), width: 46, align: "center" }]}
              data={p.kblis || []} empty={tt("No KBLI.", "Tidak ada KBLI.")}
              renderCells={(k) => { const d = docByOwner("kbli", k.kbliCode); return (
                <><td style={tdMuted}>{nm("ktype", k.kbliTypeCode) || dash(k.kbliTypeCode)}</td><td style={td}>{k.kbliCode}</td><td style={tdMuted}>{nm("kbli", k.kbliCode) || "-"}</td><td style={tdMuted}>{nm("kstatus", k.kbliStatusCode) || dash(k.kbliStatusCode)}</td><td style={{ ...td, textAlign: "center" }}><DocEye doc={d} onView={view} /></td></>
              ); }} />
          </OldCard>

          <OldDivider>{tt("Specific Requirements", "Persyaratan Khusus")}</OldDivider>

          {(p.specialRequirements || []).map((r, i) => (
            <OldCard key={i}>
              <OldHead code={r.specialReqCode} desc={nm("sr", r.specialReqCode) || ""} />
              {[
                { label: tt(`${r.specialReqCode} No.`, `No. ${r.specialReqCode}`), val: dash(r.number) },
                { label: tt(`${r.specialReqCode} Expiry Date`, `Tgl. Kedaluwarsa ${r.specialReqCode}`), val: r.expireDate ? fmtDate(r.expireDate, lang) : "-" },
                { label: tt(`${r.specialReqCode} File`, `Berkas ${r.specialReqCode}`), val: <OldDoc doc={docByOwner("special-requirement", r.specialReqCode)} onView={view} /> },
              ].map((row, j) => <OldRow key={j} label={row.label} alt={j % 2 === 0}>{row.val}</OldRow>)}
            </OldCard>
          ))}

          <OldCard>
            <OldHead code={tt("SUPPORTING CERTIFICATE", "SERTIFIKAT PENDUKUNG")} desc={tt("per supplied goods / services", "sesuai barang/jasa yang disupply")} />
            <OldGrid
              cols={[{ label: tt("Certificate No", "No Sertifikat"), width: 120 }, { label: tt("Description", "Deskripsi") }, { label: tt("Expire Date", "Kedaluwarsa"), width: 110 }, { label: tt("File", "Berkas"), width: 46, align: "center" }]}
              data={p.certificates || []} empty={tt("No supporting certificates.", "Tidak ada sertifikat pendukung.")}
              renderCells={(r) => { const d = docByOwner("sertifikat", r.certificateNumber); return (
                <><td style={td}>{r.certificateNumber}</td><td style={tdMuted}>{dash(r.description)}</td><td style={tdMuted}>{r.expireDate ? fmtDate(r.expireDate, lang) : "-"}</td><td style={{ ...td, textAlign: "center" }}><DocEye doc={d} onView={view} /></td></>
              ); }} />
          </OldCard>

          <OldDivider>{tt("Portfolio of Project", "Portofolio Proyek")}</OldDivider>

          <OldCard>
            <OldGrid
              cols={[{ label: tt("Client", "Klien"), width: 120 }, { label: tt("Source", "Sumber"), width: 78 }, { label: tt("Scope of Work", "Lingkup Kerja") }, { label: tt("Total Value", "Nilai"), width: 120, align: "right" }, { label: tt("Duration", "Durasi"), width: 120 }, { label: tt("File", "Berkas"), width: 46, align: "center" }]}
              data={p.portfolios || []} empty={tt("No projects.", "Tidak ada proyek.")}
              renderCells={(r) => { const d = docByOwner("portfolio", VwPortfolioOwnerKey(r.client, r.contractStartDate)); return (
                <><td style={td}><div>{r.client}</div></td><td style={td}><Badge size="sm" tone={VwIsOfficerPortfolio(r) ? "brand" : "neutral"}>{VwIsOfficerPortfolio(r) ? tt("Officer", "Officer") : tt("Vendor", "Vendor")}</Badge></td><td style={tdMuted}>{dash(r.scopeOfWork)}</td><td style={{ ...tdMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtIdr(r.totalValue)}</td><td style={{ ...tdMuted, lineHeight: 1.35, whiteSpace: "nowrap" }}>{VwFmtMonthYearRange(r.contractStartDate, r.contractEndDate, lang)}</td><td style={{ ...td, textAlign: "center" }}><DocEye doc={d} onView={view} /></td></>
              ); }} />
          </OldCard>

        </div>

        <VwPreviewPane preview={preview} wide={wide} subKey={mapCfg.subscriptionKey} onClose={() => setPreview(null)} />
      </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 12, color: C.textSubtle }}>
        <Icon name="shield-check" size={14} />{tt("Your data is shared only with Alamtri Procurement for onboarding and vendor management.", "Data Anda hanya dibagikan kepada Procurement Alamtri untuk onboarding dan pengelolaan vendor.")}
      </div>
    </div>
  );
}

/* First-run welcome for a vendor who just set a password (status RSPND). Uses the shared OpsHero so
   it matches the Super Admin pages (Modules/Permissions); the approved Integrity Pact card rides in
   the hero's right slot. The primary "Start registration" action lives in the page header. */
function VwWelcomeBanner() {
  const tt = useTT();
  return (
    <OpsHero
      kicker={tt("Getting started", "Langkah awal")}
      kickerIcon="sparkles"
      title={tt("Welcome to the Vendor Workspace", "Selamat datang di Vendor Workspace")}
      subtitle={tt("Your next step is to complete your company registration.", "Langkah selanjutnya adalah melengkapi pendaftaran perusahaan Anda.")}
      compact
      right={<VwPaktaTemplateCard />}
    />
  );
}

/* Integrity Pact: download → sign → upload in step 1. White card, reads well on the dark hero. */
function VwPaktaTemplateCard() {
  const C = useC();
  const tt = useTT();
  const [hover, setHover] = React.useState(false);
  const btnBg = hover ? (C.scheme === "dark" ? "#2f9aa2" : "#0c6b72") : C.ocean;
  return (
    <div style={{ width: 340, maxWidth: "100%", backgroundColor: C.surface, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS.lg, boxShadow: "0 10px 30px rgba(1,43,62,0.20)", padding: 15 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ width: 38, height: 38, borderRadius: RADIUS.md, background: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="scroll-text" size={20} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{tt("Integrity Pact template", "Template Pakta Integritas")}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 1.45 }}>{tt("Download, sign, then upload it in step 1 of the registration.", "Unduh, tanda tangani, lalu unggah pada langkah 1 pendaftaran.")}</div>
        </div>
      </div>
      <a href="/templates/pakta-integritas-template.docx" download="Surat Pernyataan Pakta Integritas - Alamtri Group.docx"
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ ...FONT, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 13, height: 38, padding: "0 14px", borderRadius: RADIUS.md,
          backgroundColor: btnBg, color: "#fff", border: `1px solid ${btnBg}`, textDecoration: "none", fontWeight: 600, fontSize: 13.5, transition: "background-color 0.15s" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="download" size={15} />{tt("Download", "Unduh")}</span>
        <Icon name="arrow-right" size={15} />
      </a>
    </div>
  );
}

/* In-app PDF/document viewer for the vendor workspace — mirrors the internal Tracker viewer
   (TrkPdfDocumentModal): an 80vw modal with an iframe, driven by the "vw:view-doc" event that
   VwOpenDoc dispatches. Mounted once at the app root so it works from the profile and the wizard. */
function VwPdfDocumentViewer() {
  const C = useC();
  const tt = useTT();
  const [doc, setDoc] = React.useState(null);
  const [src, setSrc] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const handler = (e) => setDoc((e && e.detail) || null);
    window.addEventListener("vw:view-doc", handler);
    return () => window.removeEventListener("vw:view-doc", handler);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setError(""); setSrc("");
    if (!doc || !doc.id) { setLoading(false); return; }
    setLoading(true);
    let objectUrl = "";
    VwApiDocDownloadUrl(doc.id)
      .then((url) => {
        if (!url) throw new Error("preview_unavailable");
        return VwResolveFramedDocumentUrl(url);
      })
      .then((framed) => {
        if (cancelled) {
          if (framed && framed.startsWith("blob:")) URL.revokeObjectURL(framed);
          return;
        }
        objectUrl = framed && framed.startsWith("blob:") ? framed : "";
        setSrc(framed || "");
        if (!framed) setError(tt("Document not available.", "Dokumen tidak tersedia."));
      })
      .catch(() => { if (!cancelled) setError(tt("Unable to load document.", "Tidak bisa memuat dokumen.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc, tt]);

  return (
    <Modal
      open={!!doc}
      onClose={() => setDoc(null)}
      width="80vw"
      icon="file-search"
      title={tt("View PDF Document", "View PDF Document")}
      subtitle={doc ? doc.fileName : ""}
      overlayStyle={{ padding: 0, alignItems: "stretch" }}
      style={{ maxWidth: "80vw", height: "100vh", borderRadius: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflow: "hidden", padding: 16 }}
    >
      {doc && (
        <div style={{ height: "100%", minHeight: 0, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {loading ? <Spinner size={22} color={C.ocean} />
            : src ? <iframe title={doc.fileName || "document"} src={src} style={{ width: "100%", height: "100%", border: 0, backgroundColor: "#fff" }} />
            : <div style={{ fontSize: 13, color: C.textMuted }}>{error || tt("Document not available.", "Dokumen tidak tersedia.")}</div>}
        </div>
      )}
    </Modal>
  );
}

export { VendorWorkspaceProfile, VwPdfDocumentViewer, VwVendorStatus, VwProfileParentCode, OldDivider, OldCard, OldRow, OldMap, OldGrid, OldHead, DocEye, fmtDate };
Object.assign(window, { VendorWorkspaceProfile, VwPdfDocumentViewer, VwVendorStatus, VwProfileParentCode, OldDivider, OldCard, OldRow, OldMap, OldGrid, OldHead, DocEye, fmtDate });
