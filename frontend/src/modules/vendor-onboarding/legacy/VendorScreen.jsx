/* fm3-converted */
import React from "react";
import { VM_APPROVAL_CHANGED_EVENT, VM_REGISTRY_API, VM_STATUS, VmApiApprovalContext, VmApiApprovalQueue, VmApiDeleteOfficerPortfolio, VmApiDeleteOfficerPortfolioDoc, VmApiGetCertificate, VmApiGetVendor, VmApiGetVendorAccount, VmApiIssueCertificate, VmApiJson, VmApiMasterSet, VmApiReviewAction, VmApiSaveOfficerPortfolio, VmApiSendVendorActivation, VmApiUnlockVendor, VmApiUploadOfficerPortfolioDoc, VmApiVendorDatabase, VmApiVendorDocDownloadUrl, VmApiVendorDocs, VmApiVendorHistory, VmHydrateVendorStatuses, VmResolveFramedDocumentUrl, VmResolveRegion, VmSlaMeta, VmStatusMasterEntry } from "./VendorData.jsx";
import { VwAddDays, VwApiCreateInvite, VwFmtMonthYearRange, VwIsOfficerPortfolio, VwIsOfficerVendorActor, VwNormDateOnly, VwOfficerPortfolioWritable, VwPortfolioOwnerKey, VwTodayStr } from "../../vendor-workspace/legacy/VendorOnboardingData.jsx";
import { OldCard, OldDivider, OldGrid, OldHead, OldMap, OldRow, VwProfileParentCode, VwVendorStatus, fmtDate } from "../../vendor-workspace/legacy/VendorWorkspaceScreens.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Avatar, Badge, Button, Card, Field, Icon, IconButton, Select, StatusBadge, TableRefreshButton, TextInput, Textarea } from "../../../shared/legacy/Primitives.jsx";
import { DataTable, Modal, PageHeader, Pagination, Spinner, Toolbar, fmtAppDate, fmtAppDateTime, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, GRAD, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Vendor ▸ Vendor Registry (real backend, Fase 4).
   Reviewer-facing registry over /api/v1/vendor-onboarding/vendors: searchable/filterable
   list, full profile drawer with documents + status trail, and the approval workflow
   actions (approve / request revision / reject / blacklist / unblacklist). */

/* Label precedence: Master Data ▸ Vendor Status wins, the built-in VM_STATUS map is the fallback for
   codes the master does not carry, and the code itself is the last resort. Indonesian falls back to
   the built-in translation unless the master record supplies nameId. The tone always comes from code —
   it is presentation, not configuration. */
function vmStatusMeta(code) {
  const builtIn = VM_STATUS[code] || { en: code || "—", id: code || "—", tone: "neutral" };
  const master = VmStatusMasterEntry(code);
  if (!master) return builtIn;
  return {
    ...builtIn,
    en: master.name || builtIn.en,
    id: master.nameId || builtIn.id || master.name,
    desc: master.description || null,
    descId: master.descriptionId || master.description || null,
  };
}
function vmLabel(code, lang) { const m = vmStatusMeta(code); return lang === "id" ? m.id : m.en; }

/* Blacklisting is hidden for now (asked for on 2026-08-03). Nothing was deleted: the endpoints, the
   BLACK status, its label and the aggregate rules all stay — flip this to true to offer the actions
   again. Kept as one flag so the feature comes back in a single edit rather than a re-implementation. */
const VM_BLACKLIST_ENABLED = false;

/* Blacklist actions, which depend on the status alone. Approve / revise / reject are NOT derived here:
   the backend decides them per approval step and returns them in approvalContext.allowedActions —
   necessary now that a step's status is configurable and no longer a fixed APPR* tier. */
function vmActionsFor(code) {
  if (!VM_BLACKLIST_ENABLED) return [];
  if (["APPRV", "RGSTD"].includes(code)) return ["blacklist"];
  if (code === "BLACK") return ["unblacklist"];
  return [];
}
const VM_ACTION_META = {
  "approve":          { icon: "check", tone: "primary",   en: "Approve",          id: "Setujui",       reason: false },
  "request-revision": { icon: "file-pen", tone: "secondary", en: "Request revision", id: "Minta revisi",  reason: true },
  "reject":           { icon: "x", tone: "danger",        en: "Reject",           id: "Tolak",         reason: true },
  "blacklist":        { icon: "ban", tone: "danger",      en: "Blacklist",        id: "Blacklist",     reason: true },
  "unblacklist":      { icon: "rotate-ccw", tone: "secondary", en: "Unblacklist",  id: "Cabut blacklist", reason: false },
};

/* Prefer uploaded vendor logo on the identity band; fall back to monogram initials. */
function vmLogoDoc(docs) {
  return (docs || []).find((d) => !d.isPlaceholder && String(d.documentType || "").toLowerCase() === "logo") || null;
}

function VmVendorLogoBadge({ vendorId, logoDoc, monogram, size = 80 }) {
  const [src, setSrc] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setSrc("");
    if (!logoDoc || logoDoc.isPlaceholder) return undefined;
    const container = logoDoc.container || logoDoc.blobContainer || "";
    const blobKey = logoDoc.blobKey || "";
    const load = async () => {
      try {
        if (vendorId && logoDoc.id) {
          const url = await VmApiVendorDocDownloadUrl(vendorId, logoDoc.id);
          if (!cancelled && url) { setSrc(url); return; }
        }
      } catch (e) { /* fall through to container/key */ }
      if (!container || !blobKey) return;
      try {
        const result = await VmApiJson(`/api/v1/documents/download?container=${encodeURIComponent(container)}&key=${encodeURIComponent(blobKey)}`);
        if (!cancelled) setSrc((result && result.url) || "");
      } catch (e) {
        if (!cancelled) setSrc("");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [vendorId, logoDoc && logoDoc.id, logoDoc && logoDoc.container, logoDoc && logoDoc.blobContainer, logoDoc && logoDoc.blobKey, logoDoc && logoDoc.isPlaceholder]);
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

/* Internal reviewer counterpart of Vendor Workspace's VwPreviewPane. It deliberately keeps the
   same structure and proportions, but resolves documents through the internal download endpoint. */
function VmReviewerPreviewPane({ preview, onClose, wide, subKey }) {
  const C = useC();
  const tt = useTT();
  const [src, setSrc] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setError("");
    setSrc("");
    if (!preview || preview.map || !preview.container || !preview.blobKey) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    let objectUrl = "";
    VmApiJson(`/api/v1/documents/download?container=${encodeURIComponent(preview.container)}&key=${encodeURIComponent(preview.blobKey)}`)
      .then((result) => {
        const url = result && result.url;
        if (!url) throw new Error("preview_unavailable");
        return VmResolveFramedDocumentUrl(url);
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
      .catch(() => { if (!cancelled) setError(tt("Unable to load document.", "Dokumen tidak dapat dimuat.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview, tt]);

  const isMap = Boolean(preview && preview.map);
  const map = isMap ? preview.map : null;
  const mapSrc = map && subKey
    ? `https://atlas.microsoft.com/map/static/png?api-version=1.0&subscription-key=${encodeURIComponent(subKey)}&center=${map.longitude},${map.latitude}&zoom=15&width=1000&height=800&pins=default||${map.longitude} ${map.latitude}`
    : "";
  const filled = preview && (isMap || loading || src || error);
  return (
    <Card pad={0} style={{ overflow: "hidden", display: "flex", flexDirection: "column", ...(wide ? { position: "sticky", top: 0, height: "calc(100vh - 40px)" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
        <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={isMap ? "map-pin" : "file-search"} size={16} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{isMap ? tt("Location", "Lokasi") : tt("Preview document", "Pratinjau dokumen")}</div>
          {preview && <div style={{ fontSize: 11.5, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isMap ? preview.title : preview.fileName}</div>}
        </div>
        {preview && <IconButton size="sm" name="x" variant="secondary" title={tt("Close preview", "Tutup pratinjau")} onClick={onClose} />}
      </div>
      <div style={{ height: wide ? "auto" : 480, flex: wide ? 1 : "none", minHeight: 0, backgroundColor: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", padding: filled ? 0 : 24 }}>
        {!preview
          ? <div style={{ textAlign: "center", maxWidth: 280 }}>
              <span style={{ width: 52, height: 52, margin: "0 auto 12px", borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="file-search" size={24} /></span>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{tt("Nothing to preview yet", "Belum ada dokumen yang dipratinjau")}</div>
              <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.5, color: C.textMuted }}>{tt("Select the magnifying-glass icon beside a document.", "Pilih ikon kaca pembesar di samping dokumen.")}</div>
            </div>
          : isMap
            ? <div style={{ position: "relative", width: "100%", height: "100%" }}>
                {mapSrc
                  ? <img src={mapSrc} alt={preview.title || tt("Map", "Peta")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: C.textMuted }}>{tt("Map preview unavailable.", "Pratinjau peta tidak tersedia.")}</div>}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "9px 14px", backgroundColor: "rgba(1,43,62,0.78)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{map.latitude}, {map.longitude}</span>
                  <a href={`https://www.google.com/maps?q=${map.latitude},${map.longitude}`} target="_blank" rel="noreferrer" style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>{tt("Open in Google Maps", "Buka di Google Maps")}</a>
                </div>
              </div>
          : loading
            ? <Spinner size={22} color={C.ocean} />
            : src
              ? <iframe title={preview.fileName || "document"} src={src} style={{ width: "100%", height: "100%", border: 0, backgroundColor: "#fff" }} />
              : <div style={{ fontSize: 13, color: C.textMuted }}>{error || tt("Document not available.", "Dokumen tidak tersedia.")}</div>}
      </div>
    </Card>
  );
}


function VmRegistryTable({ approvalOnly }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const toast = useToast();
  const [rows, setRows] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [detailId, setDetailId] = React.useState(null);
  const [statusF, setStatusF] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("");
  const [sortDir, setSortDir] = React.useState("asc");
  const [master, setMaster] = React.useState({ commodity: {}, kbli: {} });
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [registerTarget, setRegisterTarget] = React.useState(null);
  const [registerBusy, setRegisterBusy] = React.useState(false);
  const canRegisterVendor = Boolean(!approvalOnly && session.can("vendorOnboarding.register"));
  // Status labels are configuration (Master Data ▸ Vendor Status); hydrate once, then re-render so
  // the badges pick them up. Failure is silent — the built-in labels stay.
  const [, setStatusRevision] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    VmHydrateVendorStatuses().then(() => { if (!cancelled) setStatusRevision((value) => value + 1); });
    return () => { cancelled = true; };
  }, []);
  const ps = usePageSearch(tt("Search vendor…", "Cari vendor…"));
  const q = ps.query, setQ = ps.setQuery;

  const exportDatabase = React.useCallback(async () => {
    if (approvalOnly || exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ language: lang });
      if (q.trim()) params.set("search", q.trim());
      if (statusF !== "all") params.set("status", statusF);
      const response = await fetch(`${VM_REGISTRY_API}/database/export?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
      const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1].trim()) : "Vendor-Database.xlsx";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.push({
        title: tt("Export complete", "Export selesai"),
        description: tt(`${total} vendors exported to Excel.`, `${total} vendor diekspor ke Excel.`),
      });
    } catch (error) {
      toast.push({
        title: tt("Export failed", "Export gagal"),
        description: (error && error.message) || tt("Unable to generate the Excel file.", "File Excel tidak dapat dibuat."),
        tone: "error",
      });
    } finally {
      setExporting(false);
    }
  }, [approvalOnly, exporting, lang, q, statusF, toast, total, tt]);

  const load = React.useCallback(() => {
    setLoading(true);
    const request = approvalOnly ? VmApiApprovalQueue : VmApiVendorDatabase;
    request({
      search: q.trim(),
      status: statusF,
      page,
      pageSize,
      overdueOnly: approvalOnly && overdueOnly,
      sortBy: !approvalOnly && sortKey ? sortKey : undefined,
      sortDir: !approvalOnly && sortKey ? sortDir : undefined,
    })
      .then((result) => { setRows(result.items); setTotal(result.total); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [approvalOnly, overdueOnly, page, pageSize, q, sortDir, sortKey, statusF]);
  React.useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  React.useEffect(() => { setPage(1); }, [statusF, q, overdueOnly, sortKey, sortDir]);
  const doSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  React.useEffect(() => {
    if (approvalOnly) return;
    let cancelled = false;
    Promise.all([
      VmApiMasterSet("commodity-subclassification", 20000).catch(() => []),
      VmApiMasterSet("kbli", 20000).catch(() => []),
    ]).then(([commodity, kbli]) => {
      if (cancelled) return;
      const index = (items) => Object.fromEntries(items.map((item) => [item.code, item.name]));
      setMaster({ commodity: index(commodity), kbli: index(kbli) });
    });
    return () => { cancelled = true; };
  }, [approvalOnly]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const join = (values, lookup) => (values || []).map((value) => lookup ? (lookup[value] || value) : value).filter(Boolean).join(", ") || "—";
  const vendorCell = (v) => (
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <Avatar name={(v.name || "V").replace(/^PT\s+/, "")} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
        </div>
      </div>
  );
  const statusCell = (v) => {
    const s = vmStatusMeta(v.status);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Badge tone={s.tone} dot>{lang === "id" ? s.id : s.en}</Badge>
        {canRegisterVendor && v.status === "APPRV" && (
          <IconButton size="sm" variant="brand" name="badge-check"
            title={tt("Register vendor", "Daftarkan vendor")}
            disabled={registerBusy}
            onClick={(e) => { e.stopPropagation(); setRegisterTarget(v); }} />
        )}
      </div>
    );
  };
  const plain = (value) => <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>{value || "—"}</span>;
  /* Internal wording for a status: the master description if configured, else the vendor-facing text
     from Vendor Workspace (which deliberately collapses the approval tiers into "On Process"). */
  const statusDescription = (code) => {
    const meta = vmStatusMeta(code);
    const configured = lang === "id" ? meta.descId : meta.desc;
    if (configured) return configured;
    const fallback = VwVendorStatus(code);
    return lang === "id" ? fallback.dId : fallback.dEn;
  };
  /* SLA reading for the step the vendor is waiting on. Purely informational — an overdue step
     never blocks the approval itself. */
  const slaCell = (v) => {
    if (!v.currentStationNumber || v.currentStepSlaStatus === "NotTracked") return plain(null);
    const meta = VmSlaMeta(v.currentStepSlaStatus);
    const detail = v.currentStepSlaStatus === "Overdue"
      ? `${v.currentStepDaysOverdue} ${tt(v.currentStepDaysOverdue === 1 ? "day late" : "days late", "hari terlambat")}`
      : v.currentStepSlaStatus === "DueToday"
        ? tt("due today", "jatuh tempo hari ini")
        : `${v.currentStepDaysRemaining} ${tt(v.currentStepDaysRemaining === 1 ? "day left" : "days left", "hari lagi")}`;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Badge tone={meta.tone} dot>{lang === "id" ? meta.id : meta.en}</Badge>
        <span style={{ fontSize: 11, color: C.textSubtle, lineHeight: 1.35 }}>
          {v.currentStepDueDate ? fmtAppDate(v.currentStepDueDate) : "—"} · {detail}
        </span>
      </div>
    );
  };

  const approvalColumns = [
    { key: "review", label: tt("Review", "Tinjau"), width: 92, render: (v) => <Button size="sm" iconLeft="search" onClick={(e) => { e.stopPropagation(); setDetailId(v.id); }}>{tt("Open", "Buka")}</Button> },
    { key: "name", label: tt("Vendor", "Vendor"), width: 300, render: vendorCell },
    { key: "status", label: tt("Status", "Status"), width: 150, render: (v) => { const s = vmStatusMeta(v.status); return <Badge tone={s.tone} dot>{lang === "id" ? s.id : s.en}</Badge>; } },
    { key: "approvalStep", label: tt("Current approval step", "Langkah approval saat ini"), width: 300, render: (v) => plain(v.currentStationNumber
      ? `${tt("Step", "Langkah")} ${v.currentStationNumber}/${v.totalStations}: ${v.currentStatusName} · ${v.currentApproverRoleCode}`
      : "—") },
    { key: "sla", label: tt("SLA", "SLA"), width: 190, render: slaCell },
    { key: "description", label: tt("Description", "Keterangan"), width: 250, render: (v) => plain(statusDescription(v.status)) },
    { key: "lastChangedBy", label: tt("Created By", "Dibuat Oleh"), width: 170, render: (v) => plain(v.lastChangedByName || v.lastChangedBy || v.picName) },
    { key: "lastChangedAt", label: tt("Date", "Tanggal"), width: 170, render: (v) => plain((v.lastChangedAt || v.updatedAt) ? fmtAppDateTime(v.lastChangedAt || v.updatedAt) : "—") },
    { key: "lastReason", label: tt("Reject / repair reason", "Alasan tolak / perbaikan"), width: 375, render: (v) => plain(v.lastReason) },
  ];

  const databaseColumns = [
    { key: "id", label: tt("Vendor ID", "ID Vendor"), width: 112.5, sortable: true, render: (v) => <button onClick={(e) => { e.stopPropagation(); setDetailId(v.id); }} style={{ ...FONT, border: 0, padding: 0, background: "transparent", color: C.ocean, fontFamily: "monospace", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>{v.id}</button> },
    { key: "name", label: tt("Vendor Name", "Nama Vendor"), width: 300, sortable: true, render: vendorCell },
    { key: "status", label: tt("Status", "Status"), width: canRegisterVendor ? 188 : 145, sortable: true, render: statusCell },
    { key: "statusDescription", label: tt("Description", "Keterangan"), width: 234, sortable: true, render: (v) => plain(statusDescription(v.status)) },
    { key: "picName", label: tt("Person in Charge", "Nama Penanggung Jawab"), width: 190, sortable: true, render: (v) => plain(v.picName) },
    { key: "position", label: tt("Position", "Jabatan"), width: 187.5, sortable: true, render: (v) => plain(v.position) },
    { key: "email", label: "Email", width: 252, sortable: true, render: (v) => plain(v.email) },
    { key: "officePhone", label: tt("Office Phone", "Telepon Kantor"), width: 150, sortable: true, render: (v) => plain(v.officePhone) },
    { key: "mobilePhone", label: tt("Mobile Phone", "Telepon Seluler"), width: 150, sortable: true, render: (v) => plain(v.mobilePhone) },
    { key: "webAddress", label: tt("Web Address", "Situs"), width: 180, sortable: true, render: (v) => plain(v.webAddress) },
    { key: "officeAddress", label: tt("Office Address", "Alamat Kantor"), width: 325, sortable: true, render: (v) => plain(v.officeAddress) },
    { key: "warehouseAddress", label: tt("Warehouse Address", "Alamat Gudang"), width: 325, sortable: true, render: (v) => plain(v.warehouseAddress) },
    { key: "workshopAddress", label: tt("Workshop Address", "Alamat Workshop"), width: 325, sortable: true, render: (v) => plain(v.workshopAddress) },
    { key: "npwpNo", label: "NPWP", width: 170, sortable: true, render: (v) => plain(v.npwpNo) },
    { key: "nibNo", label: "NIB", width: 170, sortable: true, render: (v) => plain(v.nibNo) },
    { key: "aktaPendirianNo", label: tt("Deed of Establishment", "Akta Pendirian"), width: 180, sortable: true, render: (v) => plain(v.aktaPendirianNo) },
    { key: "aktaPerubahanNo", label: tt("Deed of Amendment", "Akta Perubahan"), width: 180, sortable: true, render: (v) => plain(v.aktaPerubahanNo) },
    { key: "aktaPenyesuaianNo", label: tt("Deed of Adjustment", "Akta Penyesuaian"), width: 180, sortable: true, render: (v) => plain(v.aktaPenyesuaianNo) },
    { key: "sppkpNo", label: "SPPKP", width: 192, sortable: true, render: (v) => plain(v.sppkpNo) },
    { key: "commodityCodes", label: tt("Commodity", "Commodity"), width: 650, sortable: true, render: (v) => plain(join(v.commodityCodes, master.commodity)) },
    { key: "kbliCodes", label: tt("KBLI ID", "ID KBLI"), width: 360, sortable: true, render: (v) => plain(join(v.kbliCodes)) },
    { key: "kbliDescriptions", label: tt("KBLI Description", "Deskripsi KBLI"), width: 810, sortable: true, render: (v) => plain(join(v.kbliCodes, master.kbli)) },
    { key: "portfolioClients", label: tt("Portfolio Client", "Klien Portofolio"), width: 220, sortable: true, render: (v) => plain(join(v.portfolioClients)) },
    { key: "portfolioScopes", label: tt("Scope of Work", "Lingkup Kerja"), width: 504, sortable: true, render: (v) => plain(join(v.portfolioScopes)) },
    { key: "certificateNumbers", label: tt("Certificate No.", "No. Sertifikat"), width: 200, sortable: true, render: (v) => plain(join(v.certificateNumbers)) },
    { key: "certificateDescriptions", label: tt("Certificate Description", "Deskripsi Sertifikat"), width: 350, sortable: true, render: (v) => plain(join(v.certificateDescriptions)) },
  ];
  const columns = approvalOnly ? approvalColumns : databaseColumns;

  const issueCert = async () => {
    if (!registerTarget) return;
    setRegisterBusy(true);
    try {
      await VmApiIssueCertificate(registerTarget.id);
      setRegisterTarget(null);
      toast.push({ title: tt("Vendor registered", "Vendor terdaftar"), description: tt("The e-certificate has been issued.", "E-sertifikat telah diterbitkan.") });
      load();
    } catch (e) {
      const msg = e.status === 409 ? (e.payload && e.payload.message) || tt("Not eligible.", "Tidak memenuhi syarat.") : (e.message || tt("Failed.", "Gagal."));
      toast.push({ tone: "error", title: tt("Failed", "Gagal"), description: msg });
    } finally { setRegisterBusy(false); }
  };

  return (
    <div>
      <PageHeader
        title={approvalOnly ? tt("Vendor Approval", "Approval Vendor") : tt("Vendor Database", "Database Vendor")}
        description={approvalOnly
          ? tt("Applications waiting for your approval role. Open a dossier to review the profile, documents, and status history.", "Pengajuan yang menunggu peran approval Anda. Buka berkas untuk meninjau profil, dokumen, dan riwayat status.")
          : tt("One consolidated row per vendor, including legal, commodity, portfolio, and certificate data.", "Satu baris terkonsolidasi per vendor, termasuk data legal, commodity, portofolio, dan sertifikat.")}
      />

      <Card pad={0}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 300 }}><TextInput iconLeft="search" placeholder={tt("Search vendor, NPWP, NIB…", "Cari vendor, NPWP, NIB…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              {approvalOnly && <label style={{ ...FONT, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted, cursor: "pointer" }}>
                <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
                {tt("Overdue only", "Hanya terlambat")}
              </label>}
              {!approvalOnly && <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...FONT, height: 34, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: "0 30px 0 10px", background: C.surface, color: C.text, fontSize: 12 }}>
                <option value="all">{tt("All statuses", "Semua status")}</option>
                {Object.keys(VM_STATUS).map((key) => <option key={key} value={key}>{vmLabel(key, lang)}</option>)}
              </select>}
              {loading ? <Spinner size={16} /> : <span style={{ fontSize: 12, color: C.textSubtle }}>{total} {tt("vendors", "vendor")}</span>}
            </>}
            right={<>
              {!approvalOnly && <IconButton variant="brand" size="sm" name="download"
                title={exporting ? tt("Exporting…", "Mengekspor…") : tt("Export to Excel", "Export ke Excel")}
                disabled={loading || exporting || total === 0} onClick={exportDatabase} />}
              <TableRefreshButton onClick={load} disabled={loading} title={tt("Refresh vendors", "Muat ulang vendor")} />
            </>} />
        </div>
        <DataTable columns={columns} data={rows} dense striped={!approvalOnly} rowKey="id" onRowClick={(v) => setDetailId(v.id)}
          sortKey={approvalOnly ? undefined : sortKey} sortDir={approvalOnly ? undefined : sortDir} onSort={approvalOnly ? undefined : doSort}
          emptyTitle={approvalOnly ? tt("No applications await your review", "Tidak ada pengajuan yang menunggu review Anda") : tt("No vendors found", "Tidak ada vendor")}
          emptyDesc={tt("Adjust the filters or refresh the data.", "Sesuaikan filter atau muat ulang data.")} />
        <div style={{ padding: "4px 16px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={total} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} /></div>
      </Card>

      {detailId && <VendorDetail vendorId={detailId} onClose={() => setDetailId(null)} onChanged={load} lang={lang} tt={tt} approvalMode={approvalOnly} />}
      <Modal open={!!registerTarget} onClose={() => { if (!registerBusy) setRegisterTarget(null); }} width={460} icon="badge-check"
        title={tt("Register this vendor?", "Daftarkan vendor ini?")}
        subtitle={tt("Approved → Registered", "Approved → Registered")}
        footer={<>
          <Button variant="secondary" disabled={registerBusy} onClick={() => setRegisterTarget(null)}>{tt("Cancel", "Batal")}</Button>
          <Button iconLeft="badge-check" disabled={registerBusy} onClick={issueCert}>{registerBusy ? <Spinner size={14} /> : tt("Register vendor", "Daftarkan vendor")}</Button>
        </>}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ width: 36, height: 36, borderRadius: RADIUS.md, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: C.successBg, color: C.success }}><Icon name="badge-check" size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>
              {tt("Register", "Daftarkan")} <strong>{registerTarget && registerTarget.name}</strong>?
            </div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>
              {tt("This issues the vendor's e-certificate and is what makes them visible as registered in their own Workspace.",
                "Ini menerbitkan e-sertifikat vendor dan itulah yang membuat statusnya terlihat sebagai terdaftar di Workspace mereka.")}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function VendorRegistry() { return <VmRegistryTable approvalOnly={false} />; }
function VendorApprovalQueue() { return <VmRegistryTable approvalOnly />; }

/* ---- full vendor profile + review actions ---- */
function VendorDetail({ vendorId, onClose, onChanged, lang, tt, approvalMode }) {
  const C = useC();
  const session = useSession();
  const toast = useToast();
  const [profile, setProfile] = React.useState(null);
  const [docs, setDocs] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [prompt, setPrompt] = React.useState(null); // { action }
  const [confirmAction, setConfirmAction] = React.useState(null);
  // The dossier is long enough to scroll past several screens, so it offers its own back-to-top.
  const bodyRef = React.useRef(null);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const onScroll = () => setScrolled(body.scrollTop > 420);
    body.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => body.removeEventListener("scroll", onScroll);
  }, [loading]);
  const scrollToTop = () => {
    if (!bodyRef.current) return;
    // Smooth is animation-driven, so it never advances where frames are not painted (a background
    // tab) and it is unwelcome for a reader who asked for less motion — jump instantly for them.
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bodyRef.current.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };
  const [reason, setReason] = React.useState("");
  const [regionNames, setRegionNames] = React.useState({});
  const [cert, setCert] = React.useState(null);
  const [account, setAccount] = React.useState([]);
  const [approvalContext, setApprovalContext] = React.useState(null);
  const [maps, setMaps] = React.useState({});
  const [preview, setPreview] = React.useState(null);
  const [wide, setWide] = React.useState(true);
  const [mapCfg, setMapCfg] = React.useState({ subscriptionKey: "" });
  const [pfModal, setPfModal] = React.useState(null);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 981px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener ? mq.addEventListener("change", sync) : mq.addListener(sync);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", sync) : mq.removeListener(sync); };
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      VmApiGetVendor(vendorId).catch(() => null),
      VmApiVendorDocs(vendorId).catch(() => []),
      VmApiVendorHistory(vendorId).catch(() => []),
      VmApiGetCertificate(vendorId).catch(() => null),
      VmApiGetVendorAccount(vendorId).catch(() => []),
      VmApiApprovalContext(vendorId).catch(() => null),
    ]).then(([p, d, h, c, a, approval]) => { setProfile(p); setDocs(d); setHistory(h); setCert(c); setAccount(a); setApprovalContext(approval); }).finally(() => setLoading(false));
  }, [vendorId]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    VmApiJson(`${VM_REGISTRY_API}/map-config`)
      .then((config) => { if (config) setMapCfg(config); })
      .catch(() => {});
  }, []);

  // Resolve province/city/district/village codes → names for all three addresses.
  React.useEffect(() => {
    if (!profile) return;
    const jobs = [];
    [profile.office, profile.warehouse, profile.workshop].forEach((a) => {
      if (!a) return;
      [["province", a.provinceCode], ["city", a.cityCode], ["district", a.districtCode], ["village", a.villageCode]].forEach(([set, code]) => {
        if (code) jobs.push(VmResolveRegion(set, code).then((name) => [`${set}:${code}`, name]));
      });
    });
    if (jobs.length) Promise.all(jobs).then((pairs) => setRegionNames((m) => { const n = { ...m }; pairs.forEach(([k, v]) => { n[k] = v; }); return n; }));
  }, [profile]);

  // Resolve commodity / brand / KBLI / special-requirement CODES → names so the read view mirrors the
  // vendor's own Workspace profile (shows names, not raw codes). Best-effort via the admin master-data
  // endpoint; on a 403 / miss it simply falls back to the code. Commodity chains via parentCode.
  React.useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const mset = async (key, take) => {
      try {
        const d = await VmApiJson(`/api/v1/master-data/sets/${key}${take ? `?take=${take}` : ""}`);
        return (d && Array.isArray(d.records)) ? d.records : [];
      } catch (e) { return []; }
    };
    const put = (alias, rows) => { if (!cancelled) setMaps((m) => ({ ...m, [alias]: Object.fromEntries((rows || []).map((r) => [r.code, r])) })); };
    [
      ["commodity-subclassification", "sub", 20000], ["commodity-classification", "cls", 5000], ["commodity-category", "cat", 1000],
      ["distributor-type", "distr", 200], ["kbli", "kbli", 20000], ["kbli-type", "ktype", 200], ["kbli-status", "kstatus", 200],
      ["special-requirement", "sr", 500],
    ].forEach(([key, alias, take]) => mset(key, take).then((rows) => put(alias, rows)));
    return () => { cancelled = true; };
  }, [profile]);

  const runAction = async (action, reasonText) => {
    setBusy(true);
    try {
      await VmApiReviewAction(vendorId, action, reasonText);
      toast.push({ title: tt("Done", "Berhasil"), description: lang === "id" ? VM_ACTION_META[action].id : VM_ACTION_META[action].en });
      setPrompt(null); setConfirmAction(null); setReason("");
      load(); if (onChanged) onChanged();
      // The decision moves the vendor off (or onto) somebody's queue — let the sidebar badge recount.
      window.dispatchEvent(new Event(VM_APPROVAL_CHANGED_EVENT));
    } catch (e) {
      const msg = e.status === 409 ? (e.payload && e.payload.message) || tt("Action not allowed from current status.", "Aksi tidak diizinkan dari status saat ini.") : (e.message || tt("Action failed.", "Aksi gagal."));
      toast.push({ tone: "error", title: tt("Failed", "Gagal"), description: msg });
    } finally { setBusy(false); }
  };
  const clickAction = (action) => {
    if (action === "approve") setConfirmAction(action);
    else if (VM_ACTION_META[action].reason) { setPrompt({ action }); setReason(""); }
    else runAction(action, null);
  };

  const unlockAccount = async () => {
    setBusy(true);
    try {
      const res = await VmApiUnlockVendor(vendorId);
      setAccount((res && res.accounts) || []);
      toast.push({ title: tt("Account unlocked", "Akun dibuka"), description: tt("The vendor can sign in again.", "Vendor dapat masuk kembali.") });
    } catch (e) {
      const msg = e.status === 403
        ? tt("You don't have permission to unlock accounts.", "Anda tidak memiliki izin untuk membuka akun.")
        : (e.message || tt("Failed to unlock the account.", "Gagal membuka akun."));
      toast.push({ tone: "error", title: tt("Failed", "Gagal"), description: msg });
    } finally { setBusy(false); }
  };
  const sendActivation = async () => {
    setBusy(true);
    try {
      const res = await VmApiSendVendorActivation(vendorId);
      toast.push({ title: tt("Activation link sent", "Link aktivasi terkirim"), description: res?.email || acct.email || "" });
    } catch (e) {
      toast.push({ tone: "error", title: tt("Failed", "Gagal"), description: e.message || tt("Failed to send activation link.", "Gagal mengirim link aktivasi.") });
    } finally { setBusy(false); }
  };
  const inviteImportedVendor = async () => {
    const email = acct.email;
    if (!email) return;
    setBusy(true);
    try {
      const result = await VwApiCreateInvite({
        email,
        vendorName: name,
        picName: acct.completeName || name,
        vendorId,
        expiredAt: `${VwAddDays(VwTodayStr(), 14)}T23:59:59+07:00`,
        note: tt("Re-invite after Ariba import", "Undang ulang setelah impor Ariba"),
      });
      toast.push({
        title: tt("Invitation sent", "Undangan terkirim"),
        description: `${result.invite.email} · ${tt("Code", "Kode")}: ${result.invitationCode}`,
      });
      load();
      if (onChanged) onChanged();
    } catch (e) {
      const code = e.payload && e.payload.code;
      const msg = code === "active_invitation_exists"
        ? tt("An invitation was already sent to this email. Use Resend on Vendor Invitation.", "Undangan untuk email ini sudah dikirim. Gunakan Kirim ulang di Undangan Vendor.")
        : code === "email_registered"
          ? tt("This email already belongs to a registered vendor account. Vendors that already set a password cannot be invited again.", "Email ini sudah dipakai akun vendor yang sudah daftar. Vendor yang sudah membuat password tidak bisa diundang lagi.")
        : (e.message || tt("Failed to send invitation.", "Gagal mengirim undangan."));
      toast.push({ tone: "error", title: tt("Failed", "Gagal"), description: msg });
    } finally { setBusy(false); }
  };

  const p = profile || {};
  const statusCode = p.status || "DRAFT";
  const name = p.name || tt("Vendor", "Vendor");
  /* Internal wording, from vmStatusMeta (master data) — NOT the vendor-facing VwVendorStatus, which
     deliberately collapses Approved and Registered into one "Registered" for the portal. A reviewer has
     to see the difference: an approved vendor still needs the Officer to register it. */
  const vsMeta = vmStatusMeta(statusCode);
  const vs = { en: vsMeta.en, id: vsMeta.id, tone: vsMeta.tone, dEn: vsMeta.desc || "", dId: vsMeta.descId || vsMeta.desc || "" };
  const vsColor = { info: C.info, brand: C.ocean, success: C.forest, warning: C.orange, danger: C.danger, neutral: C.textMuted }[vs.tone] || C.textMuted;
  const canReview = Boolean(approvalMode && approvalContext && approvalContext.canReview);
  const canManage = Boolean(!approvalMode && session.can("vendorOnboarding.manage"));
  const canViewContacts = session.can("vendorOnboarding.contacts");
  const actions = canReview
    ? (approvalContext.allowedActions || [])
    : canManage
      ? vmActionsFor(statusCode).filter((action) => ["blacklist", "unblacklist"].includes(action))
      : [];
  const lockedAccounts = (account || []).filter((a) => a.isLockedOut);
  const isLocked = lockedAccounts.length > 0;
  const acct = (account || []).find((a) => a.isWorkspacePic) || (account && account[0]) || {};
  const canInviteInitial = Boolean(statusCode === "INITL" && acct.email && session.can("vendorOnboarding.invite"));
  // Invitation stage (INVTD / RSPND): no biodata or documents exist yet — show identity + history only.
  // Activation-link banner is for imported accounts that are not yet invited; INVTD already used the invite path.
  const invitedStage = statusCode === "INVTD" || statusCode === "RSPND";
  const canActivate = Boolean(!canInviteInitial && !invitedStage && acct.email && !acct.hasLogin && acct.isWorkspacePic !== false && (session.can("vendorOnboarding.import") || session.can("vendorOnboarding.manage")));
  const officerParty = VwIsOfficerVendorActor(session.effectiveRoles);
  const officerCanEditPortfolio = Boolean(officerParty && VwOfficerPortfolioWritable(statusCode, approvalContext));
  const monogram = name.replace(/^PT\s+|^CV\s+/i, "").split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "V";
  const office = p.office || {};

  // Master-data name lookups (commodity hierarchy chains via parentCode); best-effort → falls back to code.
  const rec = (alias, code) => (code && maps[alias] && maps[alias][code]) || null;
  const nm = (alias, code) => { const r = rec(alias, code); return r ? r.name : null; };
  const dash = (v) => (v == null || v === "" ? "-" : v);
  const profileLabel = (label) => <span style={{ fontWeight: 400 }}>{label}</span>;
  const fmtIdr = (v) => "Rp " + Number(v || 0).toLocaleString("id-ID");
  const td = { padding: "8px 10px", verticalAlign: "top", color: C.text };
  const tdMuted = { padding: "8px 10px", verticalAlign: "top", color: C.textMuted };

  // Uploaded documents matched by type / owner-key (same conventions as the vendor wizard).
  // Selecting one drives the right-hand reviewer preview without leaving the profile.
  const docBy = (type) => docs.find((d) => !d.isPlaceholder && (d.documentType || "").toLowerCase() === type)
    || docs.find((d) => (d.documentType || "").toLowerCase() === type);
  const docByOwner = (type, owner) => docs.find((d) => (d.documentType || "").toLowerCase() === type && (d.ownerKey || "") === owner);
  const viewDocument = (d) => setPreview({ container: d.container, blobKey: d.blobKey, fileName: d.fileName });
  const removeOfficerPortfolio = async (row) => {
    if (!row || !row.id) return;
    setBusy(true);
    try {
      await VmApiDeleteOfficerPortfolio(vendorId, row.id);
      toast.push({ title: tt("Portfolio removed", "Portofolio dihapus") });
      load();
    } catch (e) {
      toast.push({ tone: "error", title: tt("Failed", "Gagal"), description: e.message || tt("Could not delete the portfolio.", "Tidak dapat menghapus portofolio.") });
    } finally { setBusy(false); }
  };
  const docEye = (d) => d
    ? <IconButton size="sm" variant="secondary" name="search" title={tt("View document", "Lihat dokumen")} onClick={() => viewDocument(d)} />
    : <span style={{ color: C.textMuted }}>-</span>;

  const rn = (set, code) => (code ? (regionNames[`${set}:${code}`] || code) : "");
  const addressCard = (title, addrLabel, a) => {
    a = a || {};
    const has = a.latitude != null && a.longitude != null;
    const rows = [
      { label: addrLabel, val: dash(a.address) },
      { label: tt("Map", "Peta"), val: <OldMap addr={a} subKey={mapCfg.subscriptionKey} onOpen={has ? () => setPreview({ map: a, title }) : null} /> },
      { label: tt("Country", "Negara"), val: dash(a.country) },
      { label: tt("Province", "Provinsi"), val: dash(rn("province", a.provinceCode)) },
      { label: tt("City", "Kota"), val: dash(rn("city", a.cityCode)) },
      { label: tt("District", "Kecamatan"), val: dash(rn("district", a.districtCode)) },
      { label: tt("Village", "Kelurahan/Desa"), val: dash(rn("village", a.villageCode)) },
      { label: tt("ZIP/Post Code", "Kode Pos"), val: dash(a.postCode) },
    ];
    return <OldCard title={title}>{rows.map((r, i) => <OldRow key={i} label={profileLabel(r.label)} alt={i % 2 === 0}>{r.val}</OldRow>)}</OldCard>;
  };
  const historyAsc = [...history].sort((a, b) => {
    const left = a.changedAt ? new Date(a.changedAt).getTime() : 0;
    const right = b.changedAt ? new Date(b.changedAt).getTime() : 0;
    return left - right;
  });
  const statusHistory = (
    <div style={{ marginTop: 18 }}>
      <OldDivider>{tt("Status history", "Riwayat status")}</OldDivider>
      {approvalContext && (approvalContext.stations || []).length > 0 &&
        <OldCard title={tt("Approval route & SLA", "Rute approval & SLA")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(approvalContext.stations || []).map((step) => {
              const meta = VmSlaMeta(step.slaStatus);
              const done = step.state === "Done";
              const current = step.state === "Current";
              const tone = done ? C.success : current ? C.ocean : C.textSubtle;
              const bg = done ? C.successBg : current ? C.brandBg : C.surfaceAlt;
              return (
                <div key={step.statusCode} style={{ display: "flex", gap: 11, alignItems: "flex-start", minWidth: 0 }}>
                  <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "50%", background: bg, color: tone, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 850 }}>{step.position}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{step.name}</span>
                      <span style={{ fontSize: 11, color: C.textSubtle }}>{step.approverRoleName || step.approverRoleCode}</span>
                      {step.slaStatus !== "NotTracked" && <Badge tone={meta.tone}>{lang === "id" ? meta.id : meta.en}</Badge>}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: C.textSubtle, lineHeight: 1.45 }}>
                      {step.slaDays == null
                        ? tt("No SLA target", "Tanpa target SLA")
                        : `${tt("Target", "Target")} ${step.slaDays} ${tt("working days", "hari kerja")}${step.dueDate ? ` · ${tt("due", "jatuh tempo")} ${fmtAppDate(step.dueDate)}` : ""}`}
                      {done && step.workingDaysTaken != null && ` · ${tt("took", "memakan")} ${step.workingDaysTaken} ${tt("working days", "hari kerja")}`}
                      {done && step.leftAt && ` · ${fmtAppDateTime(step.leftAt)}`}
                      {done && step.actorId && ` · ${step.actorId}`}
                      {done && step.actorName && ` — ${step.actorName}`}
                      {current && tt(" · waiting now", " · sedang menunggu")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </OldCard>}
      <OldCard title={tt("Lifecycle compatibility log", "Log kompatibilitas lifecycle")}>
        {(historyAsc.length === 0) ? <span style={{ fontSize: 12.5, color: C.textSubtle }}>—</span> : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {historyAsc.map((h, i) => {
              const meta = vmStatusMeta(h.statusCode);
              const actorText = [h.createdBy, h.actorName].filter(Boolean).join(" — ");
              return (
                <div key={`${h.statusCode}-${h.changedAt || i}`} style={{ display: "flex", gap: 12, minWidth: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: meta.tone === "danger" ? C.dangerBg : C.brandBg, color: meta.tone === "danger" ? C.danger : C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={i === historyAsc.length - 1 ? "circle-check" : "dot"} size={15} /></span>
                    {i < historyAsc.length - 1 && <span style={{ width: 2, minHeight: 34, flex: 1, backgroundColor: C.borderSoft, margin: "3px 0" }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1, padding: "2px 0 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: C.text }}>{h.statusCode || "—"}</span>
                      <Badge tone={meta.tone} dot>{lang === "id" ? meta.id : meta.en}</Badge>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: C.textSubtle }}>{h.changedAt ? fmtAppDateTime(h.changedAt) : "—"}{actorText ? ` · ${actorText}` : ""}</div>
                    {h.reason && <div style={{ marginTop: 5, fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>{h.reason}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </OldCard>
      {canViewContacts && (
        <>
          <OldDivider>{tt("Vendor contacts", "Kontak vendor")}</OldDivider>
          <OldCard>
            <OldGrid
              cols={[
                { label: tt("Contact", "Kontak") },
                { label: tt("Workspace key", "Kunci workspace"), width: 148 },
                { label: tt("Workspace login", "Login workspace"), width: 150 },
                { label: tt("Status", "Status"), width: 110 },
              ]}
              data={account || []}
              empty={tt("No vendor contacts yet.", "Belum ada kontak vendor.")}
              renderCells={(r) => {
                const active = r.status === "Active";
                return (
                  <>
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: C.text }}>{String(r.completeName || "").toUpperCase() || "—"}</div>
                      <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{r.email || "—"}</div>
                    </td>
                    <td style={td}>
                      {r.isWorkspacePic
                        ? <Badge tone="brand">{tt("PIC Vendor", "PIC Vendor")}</Badge>
                        : <span style={{ fontSize: 12, color: C.textSubtle }}>{tt("Cadangan", "Cadangan")}</span>}
                    </td>
                    <td style={td}>
                      {r.isWorkspacePic
                        ? <Badge tone={r.hasLogin ? "success" : "warning"}>{r.hasLogin ? tt("Activated", "Sudah aktivasi") : tt("Needs activation", "Perlu aktivasi")}</Badge>
                        : <span style={{ fontSize: 12, color: C.textSubtle }}>{tt("No workspace access", "Tanpa akses workspace")}</span>}
                    </td>
                    <td style={td}><StatusBadge status={active ? "Active" : "Inactive"} /></td>
                  </>
                );
              }} />
          </OldCard>
        </>
      )}
    </div>
  );

  return (
    <>
    <Modal open onClose={onClose}
      hideHeader
      width="100vw"
      overlayStyle={{ padding: 0, alignItems: "stretch" }}
      style={{ maxWidth: "100vw", height: "100vh", borderRadius: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflow: "auto" }}
      bodyRef={bodyRef}
      title={p.name || tt("Vendor", "Vendor")} subtitle={(vendorId || "").slice(0, 8)} icon="building-2">
      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><Spinner size={24} /></div> : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <IconButton size="md" name="x" variant="secondary" title={tt("Close vendor profile", "Tutup profil vendor")} onClick={onClose} style={{ boxShadow: C.shadowSm }} />
          </div>

          {/* Identity band — same hero the vendor sees on their own Workspace profile */}
          <div style={{ borderRadius: RADIUS.xl, overflow: "hidden", marginBottom: 18, background: GRAD.primary, color: "#fff", boxShadow: C.shadowMd }}>
            <div style={{ padding: "22px 24px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <VmVendorLogoBadge vendorId={vendorId} logoDoc={vmLogoDoc(docs)} monogram={monogram} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>{tt("Vendor", "Vendor")}</div>
                <h3 style={{ margin: "5px 0 0", fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.1 }}>{name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 9, flexWrap: "wrap", fontSize: 12.5, color: "rgba(255,255,255,0.82)" }}>
                  {p.position && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="user" size={13} />{p.position}</span>}
                  {office.address && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}><Icon name="map-pin" size={13} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>{office.address}</span></span>}
                  {p.webAddress && <a href={p.webAddress.startsWith("http") ? p.webAddress : `https://${p.webAddress}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", textDecoration: "none", fontWeight: 700 }}><Icon name="globe" size={13} />{p.webAddress}</a>}
                </div>
              </div>
              <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, maxWidth: 260 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>{tt("Vendor status", "Status vendor")}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 15px", borderRadius: RADIUS.pill, backgroundColor: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.22)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: vsColor }} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: vsColor, letterSpacing: "0.01em" }}>{lang === "id" ? vs.id : vs.en}</span>
                </span>
                {(lang === "id" ? vs.dId : vs.dEn) && <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.88)", textAlign: "right", lineHeight: 1.45 }}>{lang === "id" ? vs.dId : vs.dEn}</span>}
                {approvalContext && approvalContext.awaitingApproval && <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.68)", textAlign: "right", lineHeight: 1.45 }}>
                  {`${tt("Step", "Langkah")} ${approvalContext.stationNumber}/${approvalContext.totalStations}: ${approvalContext.statusName || approvalContext.statusCode} · ${approvalContext.approverRoleName || approvalContext.approverRoleCode}`}
                </span>}
              </div>
            </div>
          </div>

          {isLocked && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: C.warningBg || C.surfaceAlt, border: `1px solid ${C.warningBorder || C.border}`, marginBottom: 18, flexWrap: "wrap" }}>
              <Icon name="lock" size={20} color={C.warning || C.danger} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{tt("Login account locked out", "Akun login terkunci")}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted }}>
                  {lockedAccounts[0].lockoutEnd
                    ? tt("Auto-unlocks at ", "Terbuka otomatis pada ") + fmtAppDateTime(lockedAccounts[0].lockoutEnd)
                    : tt("Locked", "Terkunci")}
                  {typeof lockedAccounts[0].accessFailedCount === "number"
                    ? " · " + tt("failed attempts: ", "percobaan gagal: ") + lockedAccounts[0].accessFailedCount
                    : ""}
                </div>
              </div>
              <Button size="sm" iconLeft="lock-open" disabled={busy || loading} onClick={unlockAccount}>{busy ? <Spinner size={14} /> : tt("Unlock", "Buka kunci")}</Button>
            </div>
          )}

          {canInviteInitial && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: C.brandBg, border: `1px solid ${C.ocean}33`, marginBottom: 18, flexWrap: "wrap" }}>
              <Icon name="user-plus" size={20} color={C.ocean} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{tt("Imported vendor is waiting for an invitation", "Vendor impor menunggu undangan")}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted }}>{acct.email} · {tt("Invite them so they can set a password and start registration.", "Undang vendor agar mereka bisa membuat password dan memulai registrasi.")}</div>
              </div>
              <Button size="sm" iconLeft="send" disabled={busy || loading} onClick={inviteImportedVendor}>{busy ? <Spinner size={14} /> : tt("Invite vendor", "Undang vendor")}</Button>
            </div>
          )}

          {canActivate && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: C.brandBg, border: `1px solid ${C.ocean}33`, marginBottom: 18, flexWrap: "wrap" }}>
              <Icon name="mail-check" size={20} color={C.ocean} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{tt("Imported account is waiting for activation", "Akun hasil import menunggu aktivasi")}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted }}>{acct.email} · {tt("No initial password is stored.", "Tidak ada password awal yang disimpan.")}</div>
              </div>
              <Button size="sm" iconLeft="send" disabled={busy || loading} onClick={sendActivation}>{busy ? <Spinner size={14} /> : tt("Send activation link", "Kirim link aktivasi")}</Button>
            </div>
          )}

          {actions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 18, padding: "14px 16px", borderRadius: RADIUS.lg, border: `1px solid ${C.cardBorder || C.border}`, borderLeft: `3px solid ${canReview ? C.ocean : C.border}`, backgroundColor: C.surface, boxShadow: C.shadowSm, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220, flex: "1 1 300px" }}>
                <span style={{ width: 38, height: 38, borderRadius: RADIUS.md, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: canReview ? C.brandBg : C.surfaceAlt, color: canReview ? C.ocean : C.textMuted }}>
                  <Icon name={canReview ? "shield-check" : "settings-2"} size={19} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 750, color: C.text }}>{canReview ? tt("Approval decision", "Keputusan approval") : tt("Vendor actions", "Aksi vendor")}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, color: C.textMuted, lineHeight: 1.45 }}>
                    {canReview
                      ? tt("Choose the next step after reviewing the vendor profile and documents.", "Pilih langkah berikutnya setelah meninjau profil dan dokumen vendor.")
                      : tt("Manage the vendor's registration and account status.", "Kelola status registrasi dan akun vendor.")}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flex: "0 1 auto", flexWrap: "wrap" }}>
                {actions.map((a) => {
                  const m = VM_ACTION_META[a];
                  const dangerStyle = m.tone === "danger" ? { color: C.danger, borderColor: C.danger } : undefined;
                  return <Button key={a} variant={m.tone === "primary" ? undefined : "secondary"} size="md" iconLeft={m.icon} style={dangerStyle} disabled={busy || loading} onClick={() => clickAction(a)}>{lang === "id" ? m.id : m.en}</Button>;
                })}
              </div>
            </div>
          )}

          {prompt && (
            <div style={{ marginBottom: 18, padding: 14, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, backgroundColor: C.surfaceInset }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>{lang === "id" ? VM_ACTION_META[prompt.action].id : VM_ACTION_META[prompt.action].en} — {tt("reason", "alasan")}</div>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tt("Explain the reason (visible in the status trail)…", "Jelaskan alasannya (tampil di riwayat status)…")} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <Button variant="secondary" size="sm" onClick={() => { setPrompt(null); setReason(""); }}>{tt("Cancel", "Batal")}</Button>
                <Button size="sm" disabled={busy || reason.trim().length < 3} onClick={() => runAction(prompt.action, reason.trim())}>{busy ? <Spinner size={14} /> : tt("Confirm", "Konfirmasi")}</Button>
              </div>
            </div>
          )}

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
                  <Button size="sm" variant="secondary" iconLeft="search" onClick={() => viewDocument(cert)}>{tt("View", "Lihat")}</Button>
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
                    { label: tt("Integrity Pact", "Pakta Integritas"), val: docEye(docBy("pakta-integritas")) },
                    { label: tt("Company Profile", "Profil Perusahaan"), val: docEye(docBy("company-profile")) },
                    { label: tt("Vendor Name", "Nama Perusahaan"), val: dash(p.name) },
                    { label: tt("Person in Charge", "Nama Penanggung Jawab"), val: dash(acct.completeName) },
                    { label: tt("Position", "Jabatan"), val: dash(p.position) },
                    { label: tt("Email Address", "Alamat Email"), val: dash(acct.email) },
                    { label: tt("Office Phone", "Telepon Kantor"), val: dash([p.officePhoneCountry, p.officePhoneArea, p.officePhoneNumber].filter(Boolean).join(" ")) },
                    { label: tt("Mobile Phone", "Nomor Handphone"), val: dash([p.handphoneCountry, p.handphoneNumber].filter(Boolean).join(" ")) },
                    { label: tt("Web Address", "Situs Perusahaan"), val: dash(p.webAddress) },
                    { label: tt("Operational Organization Structure", "Struktur Organisasi Operasional"), val: docEye(docBy("org-structure")) },
                  ].map((r, i) => <OldRow key={i} label={profileLabel(r.label)} alt={i % 2 === 0}>{r.val}</OldRow>)}
                </div>
              </OldCard>

              {addressCard(tt("Office Address", "Alamat Kantor"), tt("Office Address", "Alamat Perusahaan"), p.office)}
              {addressCard(tt("Warehouse Address", "Alamat Gudang"), tt("Warehouse Address", "Alamat Gudang"), p.warehouse)}
              {addressCard(tt("Workshop Address", "Alamat Workshop"), tt("Workshop / Operational Kitchen Address", "Alamat Workshop / Dapur Operasional"), p.workshop)}

              <OldCard title={tt("Commodity", "Commodity")}>
                <OldGrid
                  cols={[{ label: tt("Sub Classification", "Sub Klasifikasi") }, { label: tt("Classification", "Klasifikasi") }, { label: tt("Category", "Kategori") }]}
                  data={p.subClassifications || []} empty={tt("No commodities.", "Tidak ada commodity.")}
                  renderCells={(sc) => { const subR = rec("sub", sc.subClassificationCode); const clsCode = VwProfileParentCode(subR, "ClassificationId"); const clsR = rec("cls", clsCode); const catCode = VwProfileParentCode(clsR, "CategoryId"); return (
                    <><td style={td}>{nm("sub", sc.subClassificationCode) || sc.subClassificationCode}</td><td style={tdMuted}>{nm("cls", clsCode) || dash(clsCode)}</td><td style={tdMuted}>{nm("cat", catCode) || dash(catCode)}</td></>
                  ); }} />
              </OldCard>

              <OldCard title={tt("Brand", "Merek")}>
                <OldGrid
                  cols={[{ label: tt("Brand", "Merek") }, { label: tt("Distributor Type", "Tipe Distributor") }, { label: tt("Expire Date", "Kedaluwarsa"), width: 110 }, { label: tt("File", "Berkas"), width: 46, align: "center" }]}
                  data={p.brands || []} empty={tt("No brands.", "Tidak ada merek.")}
                  renderCells={(b) => { const d = docByOwner("brand", b.brandName); return (
                    <><td style={td}>{b.brandName}</td><td style={tdMuted}>{nm("distr", b.distributorTypeCode) || dash(b.distributorTypeCode)}</td><td style={tdMuted}>{b.expireDate ? fmtDate(b.expireDate, lang) : "-"}</td><td style={{ ...td, textAlign: "center" }}>{docEye(d)}</td></>
                  ); }} />
              </OldCard>

              <OldDivider>{tt("General Requirements", "Persyaratan Umum")}</OldDivider>

              <OldCard>
                <OldHead code="NPWP" desc={tt("Tax Registration", "Registrasi Pajak")} />
                {[
                  { label: tt("NPWP No.", "No. NPWP"), val: dash(p.npwpNo) },
                  { label: tt("NPWP File", "Berkas NPWP"), val: docEye(docBy("npwp")) },
                ].map((r, i) => <OldRow key={i} label={profileLabel(r.label)} alt={i % 2 === 0}>{r.val}</OldRow>)}
              </OldCard>

              <OldCard>
                <OldHead code="NIB" desc={tt("Risk-Based Business Number", "Nomor Induk Berusaha Berbasis Resiko")} />
                {[
                  { label: tt("NIB No.", "No. NIB"), val: dash(p.nibNo) },
                  { label: tt("NIB File", "Berkas NIB"), val: docEye(docBy("nib")) },
                ].map((r, i) => <OldRow key={i} label={profileLabel(r.label)} alt={i % 2 === 0}>{r.val}</OldRow>)}
              </OldCard>

              <OldCard>
                <OldHead code="AKTA" desc={tt("Establishment, latest amendment & adjustment + SK Menkumham", "Pendirian, Perubahan Terakhir dan Penyesuaian beserta SK Menkumham")} />
                {[
                  { label: tt("Akta Pendirian No.", "No. Akta Pendirian"), val: dash(p.aktaPendirianNo) },
                  { label: tt("Akta Pendirian Date", "Tgl. Akta Pendirian"), val: p.aktaPendirianDate ? fmtDate(p.aktaPendirianDate, lang) : "-" },
                  { label: tt("Akta Pendirian File", "Berkas Akta Pendirian"), val: docEye(docBy("akta-pendirian")) },
                  { label: tt("Akta Perubahan No.", "No. Akta Perubahan"), val: dash(p.aktaPerubahanNo) },
                  { label: tt("Akta Perubahan Date", "Tgl. Akta Perubahan"), val: p.aktaPerubahanDate ? fmtDate(p.aktaPerubahanDate, lang) : "-" },
                  { label: tt("Akta Perubahan File", "Berkas Akta Perubahan"), val: docEye(docBy("akta-perubahan")) },
                  { label: tt("Akta Penyesuaian No.", "No. Akta Penyesuaian"), val: dash(p.aktaPenyesuaianNo) },
                  { label: tt("Akta Penyesuaian Date", "Tgl. Akta Penyesuaian"), val: p.aktaPenyesuaianDate ? fmtDate(p.aktaPenyesuaianDate, lang) : "-" },
                  { label: tt("Akta Penyesuaian File", "Berkas Akta Penyesuaian"), val: docEye(docBy("akta-penyesuaian")) },
                ].map((r, i) => <OldRow key={i} label={profileLabel(r.label)} alt={i % 2 === 0}>{r.val}</OldRow>)}
              </OldCard>

              <OldCard>
                <OldHead code="SPPKP" desc={tt("Taxable Entrepreneur Confirmation Letter", "Surat Pengukuhan Pengusaha Kena Pajak Badan Usaha")} />
                {[
                  { label: tt("SPPKP No.", "No. SPPKP"), val: dash(p.sppkpNo) },
                  { label: tt("SPPKP File", "Berkas SPPKP"), val: docEye(docBy("sppkp")) },
                ].map((r, i) => <OldRow key={i} label={profileLabel(r.label)} alt={i % 2 === 0}>{r.val}</OldRow>)}
              </OldCard>

              <OldCard>
                <OldHead code="KBLI" desc={tt("as listed in the NIB", "tercantum di NIB")} />
                <OldGrid
                  cols={[{ label: tt("Risk", "Resiko"), width: 90 }, { label: "Id", width: 60 }, { label: tt("KBLI Description", "Deskripsi KBLI") }, { label: tt("Status", "Status"), width: 100 }, { label: tt("File", "Berkas"), width: 46, align: "center" }]}
                  data={p.kblis || []} empty={tt("No KBLI.", "Tidak ada KBLI.")}
                  renderCells={(k) => { const d = docByOwner("kbli", k.kbliCode); return (
                    <><td style={tdMuted}>{nm("ktype", k.kbliTypeCode) || dash(k.kbliTypeCode)}</td><td style={td}>{k.kbliCode}</td><td style={tdMuted}>{nm("kbli", k.kbliCode) || "-"}</td><td style={tdMuted}>{nm("kstatus", k.kbliStatusCode) || dash(k.kbliStatusCode)}</td><td style={{ ...td, textAlign: "center" }}>{docEye(d)}</td></>
                  ); }} />
              </OldCard>

              <OldDivider>{tt("Specific Requirements", "Persyaratan Khusus")}</OldDivider>

              {(p.specialRequirements || []).map((r, i) => (
                <OldCard key={i}>
                  <OldHead code={r.specialReqCode} desc={nm("sr", r.specialReqCode) || ""} />
                  {[
                    { label: tt(`${r.specialReqCode} No.`, `No. ${r.specialReqCode}`), val: dash(r.number) },
                    { label: tt(`${r.specialReqCode} Expiry Date`, `Tgl. Kedaluwarsa ${r.specialReqCode}`), val: r.expireDate ? fmtDate(r.expireDate, lang) : "-" },
                    { label: tt(`${r.specialReqCode} File`, `Berkas ${r.specialReqCode}`), val: docEye(docByOwner("special-requirement", r.specialReqCode)) },
                  ].map((row, j) => <OldRow key={j} label={profileLabel(row.label)} alt={j % 2 === 0}>{row.val}</OldRow>)}
                </OldCard>
              ))}
              {(p.specialRequirements || []).length === 0 && (
                <OldCard><div style={{ fontSize: 12, color: C.textSubtle, fontStyle: "italic" }}>{tt("No specific requirements.", "Tidak ada persyaratan khusus.")}</div></OldCard>
              )}

              <OldCard>
                <OldHead code={tt("SUPPORTING CERTIFICATE", "SERTIFIKAT PENDUKUNG")} desc={tt("per supplied goods / services", "sesuai barang/jasa yang disupply")} />
                <OldGrid
                  cols={[{ label: tt("Certificate No", "No Sertifikat"), width: 120 }, { label: tt("Description", "Deskripsi") }, { label: tt("Expire Date", "Kedaluwarsa"), width: 110 }, { label: tt("File", "Berkas"), width: 46, align: "center" }]}
                  data={p.certificates || []} empty={tt("No supporting certificates.", "Tidak ada sertifikat pendukung.")}
                  renderCells={(r) => { const d = docByOwner("sertifikat", r.certificateNumber); return (
                    <><td style={td}>{r.certificateNumber}</td><td style={tdMuted}>{dash(r.description)}</td><td style={tdMuted}>{r.expireDate ? fmtDate(r.expireDate, lang) : "-"}</td><td style={{ ...td, textAlign: "center" }}>{docEye(d)}</td></>
                  ); }} />
              </OldCard>

              <OldDivider>{tt("Portfolio of Project", "Portofolio Proyek")}</OldDivider>

              <OldCard>
                {officerCanEditPortfolio && (
                  <div style={{ marginBottom: 10 }}>
                    <Button size="sm" variant="secondary" iconLeft="plus" onClick={() => setPfModal({ mode: "add" })}>{tt("Add portfolio", "Tambah portofolio")}</Button>
                  </div>
                )}
                {officerParty && !officerCanEditPortfolio && (
                  <div style={{ marginBottom: 10, fontSize: 12, color: C.textMuted, lineHeight: 1.45 }}>
                    {tt("Officer can add a portfolio after the vendor is submitted for approval, and after it is Approved / Registered.", "Officer dapat menambah portofolio setelah vendor diajukan untuk approval, dan setelah status Approved / Registered.")}
                  </div>
                )}
                <OldGrid
                  cols={[
                    ...(officerCanEditPortfolio ? [{ label: "", width: 72 }] : []),
                    { label: tt("Client", "Klien"), width: 120 },
                    { label: tt("Source", "Sumber"), width: 78 },
                    { label: tt("Scope of Work", "Lingkup Kerja") },
                    { label: tt("Total Value", "Nilai"), width: 120, align: "right" },
                    { label: tt("Duration", "Durasi"), width: 120 },
                    { label: tt("File", "Berkas"), width: 46, align: "center" },
                  ]}
                  data={p.portfolios || []} empty={tt("No projects.", "Tidak ada proyek.")}
                  renderCells={(r) => {
                    const d = docByOwner("portfolio", VwPortfolioOwnerKey(r.client, r.contractStartDate));
                    const officerRow = VwIsOfficerPortfolio(r);
                    const canMutateRow = officerCanEditPortfolio && officerRow;
                    return (
                    <>
                      {officerCanEditPortfolio && (
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          {canMutateRow ? (
                            <>
                              <IconButton size="sm" name="pencil" variant="secondary" title={tt("Edit", "Ubah")} onClick={() => setPfModal({ mode: "edit", row: r })} />
                              <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove", "Hapus")} onClick={() => removeOfficerPortfolio(r)} />
                            </>
                          ) : <span style={{ color: C.textMuted }}>—</span>}
                        </td>
                      )}
                      <td style={td}>{r.client}</td>
                      <td style={td}><Badge size="sm" tone={officerRow ? "brand" : "neutral"}>{officerRow ? tt("Officer", "Officer") : tt("Vendor", "Vendor")}</Badge></td>
                      <td style={tdMuted}>{dash(r.scopeOfWork)}</td>
                      <td style={{ ...tdMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtIdr(r.totalValue)}</td>
                      <td style={{ ...tdMuted, lineHeight: 1.35, whiteSpace: "nowrap" }}>{VwFmtMonthYearRange(r.contractStartDate, r.contractEndDate, lang)}</td>
                      <td style={{ ...td, textAlign: "center" }}>{docEye(d)}</td>
                    </>
                    );
                  }} />
              </OldCard>

              {statusHistory}

              </div>
              <VmReviewerPreviewPane preview={preview} wide={wide} subKey={mapCfg.subscriptionKey} onClose={() => setPreview(null)} />
            </div>
          )}

          {invitedStage && (
            <div style={{ width: wide ? "calc(50% - 9px)" : "100%" }}>
              {statusHistory}
            </div>
          )}

        </>
      )}
      {/* Floating back-to-top. Fixed to the viewport because the dossier fills the screen; it appears
          only once there is a meaningful distance to travel back. */}
      {scrolled && !loading && (
        <button type="button" onClick={scrollToTop}
          title={tt("Back to top", "Kembali ke atas")}
          aria-label={tt("Back to top", "Kembali ke atas")}
          style={{ ...FONT, position: "fixed", right: 26, bottom: 26, zIndex: 30, width: 44, height: 44, borderRadius: "50%",
            border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.ocean, boxShadow: C.shadowLg,
            display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Icon name="arrow-up" size={19} />
        </button>
      )}
    </Modal>
    <Modal open={confirmAction === "approve"} onClose={() => { if (!busy) setConfirmAction(null); }} width={460} icon="shield-check"
      title={tt("Confirm approval", "Konfirmasi persetujuan")}
      subtitle={approvalContext && approvalContext.stationNumber
        ? `${tt("Approval step", "Langkah approval")} ${approvalContext.stationNumber}/${approvalContext.totalStations}`
        : undefined}
      footer={<>
        <Button variant="secondary" disabled={busy} onClick={() => setConfirmAction(null)}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="check" disabled={busy} onClick={() => runAction("approve", null)}>{busy ? <Spinner size={14} /> : tt("Approve vendor", "Setujui vendor")}</Button>
      </>}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ width: 36, height: 36, borderRadius: RADIUS.md, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: C.successBg, color: C.success }}><Icon name="check" size={18} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>
            {tt("Approve", "Setujui")} <strong>{name}</strong>?
          </div>
          <div style={{ marginTop: 5, fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>
            {tt("This records your decision and moves the vendor to the next approval stage.", "Keputusan Anda akan dicatat dan vendor akan dilanjutkan ke tahap approval berikutnya.")}
          </div>
        </div>
      </div>
    </Modal>
    <VmOfficerPortfolioModal
      open={!!pfModal}
      vendorId={vendorId}
      editing={pfModal && pfModal.mode === "edit" ? pfModal.row : null}
      docs={docs}
      onViewDoc={viewDocument}
      onChanged={load}
      onClose={() => setPfModal(null)}
    />
    </>
  );
}

function vmFmtIdrDigits(v) {
  const d = String(v == null ? "" : v).replace(/\D/g, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
}

function VmOfficerPortfolioModal({ open, vendorId, editing, docs, onViewDoc, onChanged, onClose }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const [client, setClient] = React.useState("");
  const [scope, setScope] = React.useState("");
  const [value, setValue] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [heldId, setHeldId] = React.useState(null);
  const savedRef = React.useRef(false);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    setClient(editing ? (editing.client || "") : "");
    setScope(editing ? (editing.scopeOfWork || "") : "");
    setValue(editing ? String(editing.totalValue || "") : "");
    setStart(editing ? String(editing.contractStartDate || "").slice(0, 7) : "");
    setEnd(editing ? String(editing.contractEndDate || "").slice(0, 7) : "");
    setHeldId(null);
    savedRef.current = false;
    setBusy(false);
  }, [open, editing]);

  const ownerKey = VwPortfolioOwnerKey(client, start);
  const doc = ownerKey ? (docs || []).find((d) => (d.documentType || "").toLowerCase() === "portfolio" && (d.ownerKey || "") === ownerKey) : null;
  const keyLocked = !!doc;
  const portfolioId = (editing && editing.id) || heldId;
  const payload = () => ({
    client: client.trim(),
    scopeOfWork: scope.trim(),
    totalValue: Number(value) || 0,
    contractStartDate: VwNormDateOnly(start),
    contractEndDate: VwNormDateOnly(end) || VwNormDateOnly(start),
  });

  const persistRow = async () => {
    const body = payload();
    return VmApiSaveOfficerPortfolio(vendorId, body, portfolioId || undefined);
  };

  const save = async () => {
    if (!client.trim() || !scope.trim() || !start || !end) {
      toast.push({ tone: "error", title: tt("Client, scope, start and end are required.", "Klien, lingkup, mulai & akhir wajib diisi.") });
      return;
    }
    setBusy(true);
    try {
      await persistRow();
      savedRef.current = true;
      toast.push({ title: tt("Portfolio saved", "Portofolio disimpan") });
      onChanged();
      onClose();
    } catch (e) {
      toast.push({ tone: "error", title: tt("Failed", "Gagal"), description: e.message });
    } finally { setBusy(false); }
  };

  const upload = async (file) => {
    if (!file) return;
    if (!client.trim() || !scope.trim() || !start || !end) {
      toast.push({ tone: "error", title: tt("Fill the required fields first.", "Lengkapi field wajib terlebih dahulu.") });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const name = String(file.name || "").toLowerCase();
    const okExt = [".jpg", ".jpeg", ".png", ".pdf"].some((ext) => name.endsWith(ext));
    if (!okExt) {
      toast.push({ tone: "error", title: tt("File not allowed", "File tidak diizinkan"), description: "jpg, jpeg, png, pdf" });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.push({ tone: "error", title: tt("File not allowed", "File tidak diizinkan"), description: "5MB max" });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      if (!portfolioId) {
        const created = await persistRow();
        if (created && created.id) setHeldId(created.id);
      }
      await VmApiUploadOfficerPortfolioDoc(vendorId, file, ownerKey);
      await onChanged();
      toast.push({ title: tt("Uploaded", "Terunggah"), description: file.name });
    } catch (e) {
      toast.push({ tone: "error", title: tt("Upload failed", "Gagal unggah"), description: e.message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeDoc = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      await VmApiDeleteOfficerPortfolioDoc(vendorId, doc.id);
      await onChanged();
    } catch (e) {
      toast.push({ tone: "error", title: tt("Delete failed", "Gagal hapus"), description: e.message });
    } finally { setBusy(false); }
  };

  const handleClose = async () => {
    if (!savedRef.current && !editing && heldId) {
      try { await VmApiDeleteOfficerPortfolio(vendorId, heldId); await onChanged(); } catch (e) { /* best effort */ }
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} width={560} icon="briefcase" title={tt("Portfolio of Project", "Portofolio Proyek")} subtitle={tt("Add / Edit Project", "Tambah / Ubah Proyek")}
      footer={<><Button variant="secondary" disabled={busy} onClick={handleClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="save" disabled={busy} onClick={save}>{busy ? <Spinner size={14} /> : tt("Save", "Simpan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Client *", "Klien *")}><TextInput value={client} disabled={keyLocked} onChange={(e) => setClient(String(e.target.value || "").toUpperCase())} style={{ textTransform: "uppercase" }} /></Field>
        <Field label={tt("Scope of Work *", "Lingkup Kerja *")}><Textarea value={scope} rows={3} onChange={(e) => setScope(String(e.target.value || "").toUpperCase())} style={{ textTransform: "uppercase" }} /></Field>
        <Field label={tt("Value (IDR)", "Nilai (IDR)")}><TextInput type="text" inputMode="numeric" value={vmFmtIdrDigits(value)} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={tt("Contract start", "Mulai kontrak")}><TextInput type="month" value={start} disabled={keyLocked} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={tt("Contract end", "Akhir kontrak")}><TextInput type="month" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        {keyLocked && (
          <div style={{ fontSize: 11.5, color: C.textSubtle }}>
            {tt("Client and start month are locked while a document is attached. Remove the file to change them.", "Klien dan bulan mulai terkunci selama dokumen terlampir. Hapus berkas untuk mengubahnya.")}
          </div>
        )}
        <Field label={tt("Document", "Dokumen")}>
          {doc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={() => onViewDoc(doc)} style={{ ...FONT, background: "none", border: "none", padding: 0, cursor: "pointer", color: C.ocean, fontWeight: 700, fontSize: 13, textDecoration: "underline", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{doc.fileName}</button>
              <IconButton size="sm" name="search" variant="secondary" title={tt("View", "Lihat")} onClick={() => onViewDoc(doc)} />
              <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove", "Hapus")} onClick={removeDoc} />
              {busy && <Spinner size={14} />}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: "none" }} onChange={(e) => upload(e.target.files && e.target.files[0])} />
              <Button size="sm" variant="secondary" iconLeft="upload" disabled={busy || !client.trim() || !scope.trim() || !start || !end} onClick={() => inputRef.current && inputRef.current.click()}>{tt("Choose file", "Pilih file")}</Button>
              {busy && <Spinner size={14} />}
              <span style={{ fontSize: 11.5, color: C.textSubtle }}>{(!client.trim() || !scope.trim() || !start || !end) ? tt("fill required fields first", "lengkapi field wajib dulu") : "jpg, jpeg, png, pdf · 5MB max"}</span>
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}

Object.assign(window, { VendorRegistry, VendorApprovalQueue });
export { VendorRegistry, VendorApprovalQueue };
