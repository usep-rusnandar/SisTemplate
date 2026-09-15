/* fm3-converted */
import React from "react";
import { cmGroups, cmLoadContracts, cmPersistContracts } from "./ContractMonData.jsx";
import { TrkStatCard } from "../../../shared/legacy/TrkStatCard.jsx";
import { trkFmtDate, trkRp, trkText } from "../../proposal-tracker/legacy/TrackerData.jsx";
import { Badge, Button, Card, DetailCard, Field, Icon, Select } from "../../../shared/legacy/Primitives.jsx";
import { Alert, PageHeader, Spinner, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Contract Monitoring ▸ Import Center.
   Migrate contract documents from SharePoint into Azure Blob. The DATA path writes contract rows to
   the Contract Database (via cmPersistContracts → projection); the DOCUMENT path is a server-side
   background job: each document is fetched from SharePoint and stored in Blob, tracked per row. The
   job keeps running after the user leaves this page; returning shows live status. See the Import
   Center backend (cm.IMPORT_JOB_T / cm.IMPORT_JOB_ROW_T) and ImportJobBackgroundRunner. */

/* Excel columns → Contract Database field mapping. `col` = exact header in the official template;
   `aliases` allow minor naming variants. Matching is whitespace/case-insensitive (see cmNormHeader).
   `date` columns arrive as Excel serial numbers and are converted to ISO (see cmExcelDate). */
const CM_IMPORT_MAPPING = [
  { col: "Contract Status",              field: "status",         req: true },
  { col: "Received Document Date",       field: "receivedDate",   date: true },
  { col: "Contract ID",                  field: "contractId",     req: true },
  { col: "Supplier Name",                field: "supplier",       req: true },
  { col: "Contract Title",               field: "title",          req: true },
  { col: "Value Estimated",              field: "value",          req: true },
  { col: "Job Site",                     field: "jobsite",        req: true },
  { col: "Contract Type",                field: "type",           req: true },
  { col: "Price Adjustment Agreement",   field: "priceAdj",       aliases: ["Price Adjustment"] },
  { col: "Ownership Contract",           field: "ownership",      aliases: ["Ownership"] },
  { col: "Contract Date",                field: "contractDate",   date: true },
  { col: "Effective Date",               field: "effectiveDate",  date: true },
  { col: "Expired Date",                 field: "expiredDate",    req: true, date: true },
  { col: "Draft Template",               field: "template",       aliases: ["Template"] },
  { col: "Classification",               field: "classification", req: true },
  { col: "Sub-Classification",           field: "subClass",       aliases: ["Sub Class", "Sub Classification"] },
  { col: "Frequancy Transaction",        field: "frequency",      aliases: ["Frequency Transaction"] },
  { col: "Owner",                        field: "owner" },
  { col: "User Department",              field: "userDept" },
  { col: "User PIC Name (Input Email)",  field: "picNames",       email: true, aliases: ["PIC", "User PIC Name"] },
  { col: "Contract System",              field: "systemNos",      aliases: ["Use System", "Contract System No"] },
  { col: "Link Document",                field: "link",           doc: true, aliases: ["Document Link (SharePoint)", "Document Link"] },
];

/* Normalize a header for tolerant matching: collapse whitespace, trim, lowercase. */
function cmNormHeader(h) {
  return String(h == null ? "" : h).replace(/\s+/g, " ").trim().toLowerCase();
}

/* Excel stores dates as serial numbers (days since 1899-12-30). Convert to ISO yyyy-MM-dd.
   Pass-through if the value is already a date-like string. */
function cmExcelDate(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 0 && n < 600000) {
      const d = new Date(Math.round((n - 25569) * 86400 * 1000)); // 25569 = 1970-01-01 in Excel serial
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? s : parsed.toISOString().slice(0, 10);
}

/* ---- Import-job API ------------------------------------------------------- */
async function cmJobApi(path, opts) {
  const res = await fetch(`/api/v1/contract-monitoring${path}`, { credentials: "include", ...(opts || {}) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}
function cmCreateImportJob(fileName, rows) {
  return cmJobApi("/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName, rows }) });
}
const cmListImportJobs = () => cmJobApi("/imports");
const cmGetImportJob = (id) => cmJobApi(`/imports/${id}`);
const cmRetryImportJob = (id) => cmJobApi(`/imports/${id}/retry`, { method: "POST" });
const cmRetryImportRow = (id, rowId) => cmJobApi(`/imports/${id}/rows/${rowId}/retry`, { method: "POST" });
const cmPauseImportJob = (id) => cmJobApi(`/imports/${id}/pause`, { method: "POST" });
const cmResumeImportJob = (id) => cmJobApi(`/imports/${id}/resume`, { method: "POST" });

const CM_JOB_TERMINAL = ["Completed", "CompletedWithErrors"];
const cmJobTerminal = (s) => CM_JOB_TERMINAL.includes(s);
const cmJobRunningish = (s) => s === "Running" || s === "Paused" || s === "Queued";

function cmFmtSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
function cmFmtWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

/* Parse a real .xlsx export (SheetJS) into contract rows using the column mapping. */
async function cmParseImportFile(file) {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error("Excel parser is not available.");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The workbook has no sheets.");
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  if (!matrix.length) return [];
  const headers = (matrix[0] || []).map(cmNormHeader);
  const colIndex = {};
  CM_IMPORT_MAPPING.forEach((m) => {
    const candidates = [m.col, ...(m.aliases || [])].map(cmNormHeader);
    colIndex[m.field] = headers.findIndex((h) => candidates.includes(h));
  });
  const rows = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r] || [];
    const row = { idx: r };
    CM_IMPORT_MAPPING.forEach((m) => {
      const j = colIndex[m.field];
      const cell = j >= 0 ? cells[j] : "";
      row[m.field] = m.date ? cmExcelDate(cell) : (cell == null ? "" : String(cell).trim());
    });
    row.value = Number(String(row.value).replace(/[^0-9.\-]/g, "")) || 0;
    const emails = String(row.picNames || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    row.picEmail = emails[0] || "";
    row.systemNos = String(row.systemNos || "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    row.type = row.type || "MAIN CONTRACT";
    row.status = row.status || "Active";
    if (row.contractId) rows.push(row);
  }
  return rows;
}

/* ---- Commodity master lookup (Classification / Sub-Classification) --------
   Import requires each row's Classification AND Sub-Classification to resolve against the commodity
   master data. Matching is by CODE or DESCRIPTION (case-insensitive) per the agreed rule; on a hit we
   attach the canonical description, on a miss the row is blocked with a clear message. Reading these
   sets needs masterData.commodity.view — granted read-only to ADM/Section Head/Officer CM. */
async function cmMasterSet(key) {
  const res = await fetch(`/api/v1/master-data/sets/${key}?take=20000`, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err; }
  const data = await res.json();
  return Array.isArray(data && data.records) ? data.records : [];
}

function cmBuildLookup(records) {
  const byCode = new Map();
  const byDesc = new Map();
  (records || []).forEach((r) => {
    const code = String(r.code == null ? "" : r.code).trim().toLowerCase();
    const name = String(r.name == null ? "" : r.name).trim().toLowerCase();
    if (code) byCode.set(code, r);
    if (name) byDesc.set(name, r);
  });
  return { byCode, byDesc };
}

async function cmLoadCommodityLookups() {
  const [cls, sub] = await Promise.all([
    cmMasterSet("commodity-classification"),
    cmMasterSet("commodity-subclassification"),
  ]);
  return { cls: cmBuildLookup(cls), sub: cmBuildLookup(sub) };
}

/* Match a cell value against a master lookup by code OR description; returns the record or null. */
function cmMatchCommodity(value, maps) {
  const v = String(value == null ? "" : value).trim().toLowerCase();
  if (!v || !maps) return null;
  return maps.byCode.get(v) || maps.byDesc.get(v) || null;
}

/* Annotate parsed rows with the resolved commodity description (or flag the miss). */
function cmAnnotateCommodity(rows, lookups) {
  return (rows || []).map((r) => {
    const clsRec = cmMatchCommodity(r.classification, lookups.cls);
    const subRec = cmMatchCommodity(r.subClass, lookups.sub);
    return {
      ...r,
      classificationDesc: clsRec ? clsRec.name : "",
      subClassDesc: subRec ? subRec.name : "",
      _clsOk: !!clsRec,
      _subOk: !!subRec,
    };
  });
}

/* Build & download a blank .xlsx import template whose headers exactly match the parser
   (CM_IMPORT_MAPPING), so the template can never drift from what the importer expects. */
function cmDownloadImportTemplate() {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error("Excel writer is not available.");
  const headers = CM_IMPORT_MAPPING.map((m) => m.col);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contracts");
  XLSX.writeFile(wb, "Contract-Import-Template.xlsx");
}

function ContractImport({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const toast = useToast();

  const [tab, setTab] = React.useState("import");      // import | history
  const [step, setStep] = React.useState(0);           // wizard: 0 upload, 1 mapping, 2 preview
  const [mergedOnly, setMergedOnly] = React.useState(false);
  const [expanded, setExpanded] = React.useState(() => new Set());
  const [rows, setRows] = React.useState([]);
  const [fileName, setFileName] = React.useState("");
  const [parseError, setParseError] = React.useState("");
  // Set when the commodity master could not be read (e.g. 403) — import is blocked because
  // Classification / Sub-Classification cannot be validated.
  const [commodityLookupError, setCommodityLookupError] = React.useState("");
  const fileInputRef = React.useRef(null);

  const [jobId, setJobId] = React.useState(null);      // attached running/just-finished job
  const [job, setJob] = React.useState(null);          // { job, rows }
  const [filter, setFilter] = React.useState("all");
  const [history, setHistory] = React.useState([]);
  const [histOpen, setHistOpen] = React.useState(null);
  const [histDetail, setHistDetail] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const groups = React.useMemo(() => cmGroups(rows).sort((a, b) => b.versions.length - a.versions.length || a.contractId.localeCompare(b.contractId)), [rows]);
  const mergedGroups = React.useMemo(() => groups.filter((g) => g.versions.length > 1), [groups]);
  const totalRows = rows.length;
  const distinctCount = groups.length;
  const dupRows = Math.max(0, totalRows - distinctCount);
  const docRows = rows.filter((r) => r.link && /^https?:/i.test(r.link)).length;
  const previewRows = mergedOnly ? mergedGroups : groups;
  const toggleRow = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Rows whose Classification / Sub-Classification did not resolve against the commodity master.
  // The import is blocked while any exist (or while the master could not be read).
  const commodityIssues = React.useMemo(() => {
    const classifications = new Set();
    const subClassifications = new Set();
    let count = 0;
    rows.forEach((r) => {
      const clsBad = !r._clsOk;
      const subBad = !r._subOk;
      if (clsBad) classifications.add(String(r.classification || "").trim() || "(empty)");
      if (subBad) subClassifications.add(String(r.subClass || "").trim() || "(empty)");
      if (clsBad || subBad) count += 1;
    });
    return { classifications: [...classifications], subClassifications: [...subClassifications], count };
  }, [rows]);
  const commodityBlocked = !!commodityLookupError || commodityIssues.count > 0;

  // On mount: load history and re-attach to any in-flight job (so leaving + returning shows status).
  React.useEffect(() => {
    cmListImportJobs().then((list) => {
      setHistory(list || []);
      const active = (list || []).find((j) => cmJobRunningish(j.status));
      if (active) setJobId(active.id);
    }).catch(() => {});
  }, []);

  // Live per-row progress via Server-Sent Events — the server only reads the DB while this page holds
  // the connection open, and stops once the job is terminal. Leave the page → connection closes → no
  // more queries. (No EventSource → one-shot fetch fallback.)
  React.useEffect(() => {
    if (!jobId) return undefined;
    let closed = false;
    let es = null;
    const onTerminalRefresh = () => cmListImportJobs().then((l) => !closed && setHistory(l || [])).catch(() => {});
    if (typeof window.EventSource === "function") {
      es = new EventSource(`/api/v1/contract-monitoring/imports/${jobId}/stream`);
      es.onmessage = (event) => {
        if (closed) return;
        let detail;
        try { detail = JSON.parse(event.data); } catch (e) { return; }
        if (!detail || detail.error || !detail.job) return;
        setJob(detail);
        if (cmJobTerminal(detail.job.status)) { closed = true; es.close(); onTerminalRefresh(); }
      };
      // EventSource auto-reconnects on transient drops; nothing to do on error.
    } else {
      cmGetImportJob(jobId).then((d) => !closed && setJob(d)).catch(() => {});
    }
    return () => { closed = true; if (es) es.close(); };
  }, [jobId]);

  const handleFile = async (file) => {
    if (!file) return;
    setParseError("");
    setCommodityLookupError("");
    try {
      const parsed = await cmParseImportFile(file);
      if (!parsed.length) { setParseError(tt("No contract rows found in the file.", "Tidak ada baris kontrak di berkas.")); return; }
      // Validate Classification / Sub-Classification against the commodity master (code or description).
      let annotated = parsed;
      try {
        const lookups = await cmLoadCommodityLookups();
        annotated = cmAnnotateCommodity(parsed, lookups);
      } catch (lookupErr) {
        setCommodityLookupError(lookupErr && lookupErr.status === 403
          ? tt("You don't have access to the Commodity master data, so Classification / Sub-Classification can't be validated.", "Anda tidak punya akses ke master data Commodity, sehingga Classification / Sub-Classification tidak bisa divalidasi.")
          : tt("Could not load the Commodity master data to validate Classification / Sub-Classification.", "Gagal memuat master data Commodity untuk memvalidasi Classification / Sub-Classification."));
      }
      setRows(annotated); setFileName(file.name); setStep(1);
      toast.push({ title: tt("File parsed", "Berkas terbaca"), description: `${file.name} · ${parsed.length} ${tt("rows", "baris")}` });
    } catch (e) {
      setParseError((e && e.message) || tt("Failed to read the Excel file.", "Gagal membaca berkas Excel."));
      toast.push({ title: tt("Parse failed", "Gagal parse"), description: (e && e.message) || "", tone: "error" });
    }
  };

  const downloadTemplate = () => {
    try {
      cmDownloadImportTemplate();
      toast.push({ title: tt("Template downloaded", "Template terunduh"), description: "Contract-Import-Template.xlsx" });
    } catch (e) {
      toast.push({ tone: "error", title: tt("Download failed", "Unduhan gagal"), description: (e && e.message) || "" });
    }
  };

  const startJob = async () => {
    if (!rows.length) { toast.push({ title: tt("Nothing to import", "Tidak ada data"), tone: "warning" }); return; }
    if (commodityBlocked) {
      toast.push({
        title: tt("Import blocked", "Import diblokir"),
        description: commodityLookupError || tt("Some Classification / Sub-Classification values are not in the Commodity master data.", "Sebagian nilai Classification / Sub-Classification tidak ada di master data Commodity."),
        tone: "error",
      });
      return;
    }
    setBusy(true);
    try {
      // MERGE into the existing register by Contract ID: contracts present in this file replace their
      // own versions; previously-imported contracts NOT in this file are kept (the database accumulates
      // across imports rather than being overwritten by the latest file).
      let existing = [];
      try { existing = cmLoadContracts() || []; } catch (e) { existing = []; }
      const incomingIds = new Set(rows.map((r) => r.contractId));
      const kept = existing.filter((r) => !incomingIds.has(r.contractId));
      const merged = [...kept, ...rows].map((r, i) => ({ ...r, idx: i + 1 }));
      await cmPersistContracts(merged);
      const payload = rows.map((r) => ({ rowIndex: r.idx, contractId: r.contractId, title: r.title, supplier: r.supplier, link: r.link || null }));
      const created = await cmCreateImportJob(fileName || "contract-export.xlsx", payload);
      setRows([]); setFileName(""); setStep(0);
      setJob(null); setFilter("all"); setJobId(created.id); setTab("import");
      toast.push({ title: tt("Migration started", "Migrasi dimulai"), description: tt("Running in the background — you can leave this page.", "Berjalan di latar — Anda bisa meninggalkan halaman ini.") });
    } catch (e) {
      toast.push({ title: tt("Couldn't start migration", "Gagal memulai migrasi"), description: (e && e.message) || "", tone: "error" });
    } finally { setBusy(false); }
  };

  const doRetry = async () => { try { await cmRetryImportJob(jobId); setJob(await cmGetImportJob(jobId)); } catch (e) { toast.push({ title: tt("Retry failed", "Gagal mengulang"), tone: "error" }); } };
  const doRetryRow = async (rowId) => { try { await cmRetryImportRow(jobId, rowId); setJob(await cmGetImportJob(jobId)); } catch (e) { toast.push({ title: tt("Retry failed", "Gagal mengulang"), tone: "error" }); } };
  const doPauseResume = async () => {
    if (!job) return;
    const paused = job.job.status === "Paused";
    try { await (paused ? cmResumeImportJob : cmPauseImportJob)(jobId); setJob(await cmGetImportJob(jobId)); } catch (e) {}
  };
  const newImport = () => { setJobId(null); setJob(null); setStep(0); setRows([]); setFileName(""); };

  const openHist = async (id) => {
    if (histOpen === id) { setHistOpen(null); setHistDetail(null); return; }
    setHistOpen(id); setHistDetail(null);
    try { setHistDetail(await cmGetImportJob(id)); } catch (e) {}
  };

  const runningJob = job && cmJobRunningish(job.job.status) ? job.job : null;
  const showPill = runningJob && tab !== "import";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
        <PageHeader title={tt("Import Center", "Pusat Import")}
          description={tt("Move contract documents from SharePoint into the Azure Blob vault. Migration runs in the background — leave the page and it keeps going.", "Pindahkan dokumen kontrak dari SharePoint ke Azure Blob. Migrasi berjalan di latar — tinggalkan halaman dan prosesnya tetap jalan.")} />
        <div style={{ display: "flex", gap: 4, backgroundColor: C.surfaceAlt, padding: 4, borderRadius: RADIUS.md }}>
          <CmTab active={tab === "import"} onClick={() => setTab("import")} icon="download" label={tt("Import", "Import")} C={C} />
          <CmTab active={tab === "history"} onClick={() => setTab("history")} icon="history" label={tt("History", "Riwayat")} count={history.length} C={C} />
        </div>
      </div>

      {tab === "import" && jobId && job && <CmMonitor job={job} filter={filter} setFilter={setFilter} C={C} tt={tt} lang={lang}
        onPauseResume={doPauseResume} onRetry={doRetry} onRetryRow={doRetryRow} onBackground={() => setTab("history")} onNew={newImport} onView={() => onNavigate && onNavigate("cmDatabase")} />}

      {tab === "import" && jobId && !job && (
        <Card style={{ padding: 46, textAlign: "center" }}><Spinner size={28} color={C.ocean} /><div style={{ marginTop: 12, color: C.textMuted, fontSize: 13 }}>{tt("Loading migration status…", "Memuat status migrasi…")}</div></Card>
      )}

      {tab === "import" && !jobId && (
        <CmWizard
          C={C} tt={tt} lang={lang} step={step} setStep={setStep}
          rows={rows} totalRows={totalRows} distinctCount={distinctCount} dupRows={dupRows} docRows={docRows}
          fileName={fileName} parseError={parseError} fileInputRef={fileInputRef} handleFile={handleFile} downloadTemplate={downloadTemplate}
          previewRows={previewRows} mergedOnly={mergedOnly} setMergedOnly={setMergedOnly} mergedGroups={mergedGroups}
          expanded={expanded} toggleRow={toggleRow} startJob={startJob} busy={busy}
          commodityIssues={commodityIssues} commodityLookupError={commodityLookupError} commodityBlocked={commodityBlocked} />
      )}

      {tab === "history" && <CmHistory history={history} open={histOpen} detail={histDetail} onOpen={openHist} C={C} tt={tt} lang={lang} />}

      {showPill && <CmPill job={runningJob} onClick={() => setTab("import")} C={C} tt={tt} />}
    </div>
  );
}

/* ---- tabs ---- */
function CmTab({ active, onClick, icon, label, count, C }) {
  return (
    <button type="button" onClick={onClick} style={{ ...FONT, cursor: "pointer", border: 0, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: RADIUS.sm, fontSize: 13, fontWeight: 600,
      backgroundColor: active ? C.surface : "transparent", color: active ? C.ocean : C.textMuted, boxShadow: active ? C.shadowSm : "none" }}>
      <Icon name={icon} size={15} />{label}
      {count != null && <span style={{ minWidth: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: active ? C.ocean : C.border, color: active ? "#fff" : C.textMuted }}>{count}</span>}
    </button>
  );
}

/* ---- live monitor (active / finished job) ---- */
function CmMonitor({ job, filter, setFilter, C, tt, lang, onPauseResume, onRetry, onRetryRow, onBackground, onNew, onView }) {
  const j = job.job, rows = job.rows || [];
  const c = (s) => rows.filter((r) => r.state === s).length;
  const inflight = c("Fetching") + c("Storing");
  const queued = c("Queued");
  const stored = j.stored, failed = j.failed, skipped = j.skipped, total = j.total || rows.length;
  const done = stored + failed + skipped;
  const pct = total ? Math.round(done / total * 100) : 0;
  const terminal = cmJobTerminal(j.status);
  const paused = j.status === "Paused";

  const stat = cmJobStatusPill(j.status, tt);
  const seg = (n, color) => total ? <i style={{ width: `${n / total * 100}%`, background: color, height: "100%", display: "block" }} /> : null;

  const filters = [["all", tt("All", "Semua"), total], ["transit", tt("In transit", "Transit"), inflight + queued], ["Stored", tt("Stored", "Tersimpan"), stored], ["Failed", tt("Failed", "Gagal"), failed], ["Skipped", tt("Skipped", "Dilewati"), skipped]];
  const inFilter = (r) => filter === "all" ? true : filter === "transit" ? (r.state === "Queued" || r.state === "Fetching" || r.state === "Storing") : r.state === filter;
  const shown = rows.filter(inFilter);

  return (
    <div>
      <Card style={{ padding: "20px 22px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
            <span style={{ width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: C.ocean + "1f", color: C.ocean, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="file-spreadsheet" size={21} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, overflowWrap: "anywhere" }}>{j.fileName}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                {tt("batch", "batch")} <span style={{ fontFamily: "monospace" }}>{j.batchCode}</span> · {cmFmtWhen(j.startedAt || j.createdAt)}{j.startedBy ? ` · ${j.startedBy}` : ""}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 11 }}>
            <Badge tone={stat.tone}>{stat.dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: "currentColor", display: "inline-block" }} />}{stat.label}</Badge>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {!terminal && <Button variant="secondary" size="sm" iconLeft={paused ? "play" : "pause"} onClick={onPauseResume}>{paused ? tt("Resume", "Lanjut") : tt("Pause", "Jeda")}</Button>}
              {!terminal && <Button variant="secondary" size="sm" iconLeft="layout-dashboard" onClick={onBackground}>{tt("Run in background", "Jalankan di latar")}</Button>}
              {terminal && failed > 0 && <Button variant="secondary" size="sm" iconLeft="rotate-ccw" onClick={onRetry}>{tt("Retry failed", "Ulang yang gagal")} · {failed}</Button>}
              {terminal && <Button size="sm" iconLeft="database" onClick={onView}>{tt("View Contract Database", "Lihat Contract Database")}</Button>}
              {terminal && <Button variant="secondary" size="sm" iconLeft="plus" onClick={onNew}>{tt("New import", "Import baru")}</Button>}
            </div>
          </div>
        </div>

        {/* aggregate transit bar */}
        <div style={{ marginTop: 18 }}>
          <div style={{ height: 12, borderRadius: 99, backgroundColor: C.surfaceAlt, overflow: "hidden", display: "flex", gap: 1.5 }}>
            {seg(stored, C.success)}{seg(inflight, C.ocean)}{seg(failed, C.danger)}{seg(skipped, C.warning || "#BE8526")}{seg(queued, C.border)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12, fontSize: 12 }}>
            <CmLeg sw={C.success} label={tt("Stored", "Tersimpan")} n={stored} C={C} />
            <CmLeg sw={C.ocean} label={tt("In transit", "Transit")} n={inflight} C={C} />
            <CmLeg sw={C.danger} label={tt("Failed", "Gagal")} n={failed} C={C} />
            <CmLeg sw={C.warning || "#BE8526"} label={tt("Skipped", "Dilewati")} n={skipped} C={C} />
            <CmLeg sw={C.border} label={tt("Queued", "Antre")} n={queued} C={C} />
            <span style={{ marginLeft: "auto", color: C.textMuted }}>{pct}% · <b style={{ color: C.text, fontFamily: "monospace" }}>{done}/{total}</b></span>
          </div>
        </div>
      </Card>

      {/* filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {filters.map(([k, l, n]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 600,
            border: `1px solid ${filter === k ? C.ocean : C.border}`, backgroundColor: filter === k ? C.brandBg : C.surface, color: filter === k ? C.ocean : C.textMuted }}>
            {l}<span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 700 }}>{n}</span>
          </button>
        ))}
      </div>

      <CmLedger rows={shown} C={C} tt={tt} readonly={false} onRetryRow={onRetryRow} />
    </div>
  );
}

function CmLeg({ sw, label, n, C }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: C.textMuted }}><span style={{ width: 9, height: 9, borderRadius: 3, background: sw }} />{label} <b style={{ color: C.text, fontFamily: "monospace" }}>{n}</b></span>;
}

/* ---- manifest ledger (shared by monitor + history detail) ---- */
function CmLedger({ rows, C, tt, readonly, onRetryRow }) {
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
          <thead><tr style={{ backgroundColor: C.surfaceAlt }}>
            {[tt("Contract", "Kontrak"), tt("Supplier", "Pemasok"), tt("Size", "Ukuran"), tt("Transit · SharePoint → Blob", "Transit · SharePoint → Blob"), tt("State", "Status")].map((h, i) => (
              <th key={i} style={{ textAlign: i === 2 ? "right" : "left", padding: "10px 16px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 36, textAlign: "center", color: C.textMuted }}>{tt("No documents in this view.", "Tidak ada dokumen di tampilan ini.")}</td></tr>}
            {rows.map((r) => {
              const active = r.state === "Fetching" || r.state === "Storing";
              return (
                <tr key={r.id} style={{ backgroundColor: r.state === "Failed" ? C.dangerBg : "transparent" }}>
                  <td style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSoft}`, maxWidth: 300 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.ocean, whiteSpace: "nowrap" }}>{r.contractId}</div>
                    <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{r.title}</div>
                  </td>
                  <td style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSoft}`, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{r.supplier}</td>
                  <td style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSoft}`, textAlign: "right", fontFamily: "monospace", fontSize: 12, color: C.textMuted, whiteSpace: "nowrap" }}>{cmFmtSize(r.sizeBytes)}</td>
                  <td style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSoft}` }}><CmTransit state={r.state} active={active} C={C} /></td>
                  <td style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSoft}` }}><CmStateChip r={r} C={C} tt={tt} onRetryRow={readonly ? null : onRetryRow} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* two-node transit track: SP → BLOB, filled by stage */
function CmTransit({ state, C }) {
  const stage = { Queued: 4, Fetching: 35, Storing: 72, Stored: 100, Failed: 50, Skipped: 0 }[state] || 0;
  const failed = state === "Failed";
  const done = state === "Stored";
  const fill = failed ? C.danger : done ? C.success : C.ocean;
  const originOn = state !== "Queued" && state !== "Skipped";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 200 }}>
      <span style={{ fontFamily: "monospace", fontSize: 9.5, fontWeight: 700, color: originOn ? C.ocean : C.textSubtle }}>SP</span>
      <div style={{ position: "relative", flex: 1, height: 7, borderRadius: 99, backgroundColor: C.surfaceAlt, overflow: "hidden" }}>
        <span style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 11, background: C.border }} />
        <span style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${stage}%`, borderRadius: 99, background: fill, transition: "width .4s ease" }} />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: 9.5, fontWeight: 700, color: done ? C.success : C.textSubtle }}>BLOB</span>
    </div>
  );
}

function CmStateChip({ r, C, tt, onRetryRow }) {
  switch (r.state) {
    case "Queued": return <Badge tone="neutral" size="sm">{tt("Queued", "Antre")}</Badge>;
    case "Fetching": return <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Spinner size={12} color={C.ocean} /><Badge tone="info" size="sm">{tt("Fetching", "Mengunduh")}</Badge></span>;
    case "Storing": return <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Spinner size={12} color={C.ocean} /><Badge tone="info" size="sm">{tt("Uploading", "Mengunggah")}</Badge></span>;
    case "Stored": return <Badge tone="success" size="sm"><Icon name="check" size={10} />{tt("Stored", "Tersimpan")}</Badge>;
    case "Skipped": return <span><Badge tone="warning" size="sm">{tt("Skipped", "Dilewati")}</Badge><div style={{ fontSize: 10.5, color: C.warning || "#9a6a16", marginTop: 3 }}>{r.failReason || tt("No document link", "Tanpa link dokumen")}</div></span>;
    case "Failed": return (
      <span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Badge tone="danger" size="sm"><Icon name="x" size={10} />{tt("Failed", "Gagal")}</Badge>
          {onRetryRow && <button type="button" onClick={() => onRetryRow(r.id)} style={{ ...FONT, cursor: "pointer", border: 0, background: "transparent", color: C.ocean, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px", borderRadius: RADIUS.sm }}><Icon name="rotate-ccw" size={11} />{tt("Retry", "Ulang")}</button>}
        </span>
        <div style={{ fontSize: 10.5, color: C.danger, marginTop: 3, maxWidth: 240, overflowWrap: "anywhere" }}>{r.failReason}</div>
      </span>
    );
    default: return null;
  }
}

function cmJobStatusPill(status, tt) {
  switch (status) {
    case "Running": return { tone: "info", label: tt("Running", "Berjalan"), dot: true };
    case "Paused": return { tone: "neutral", label: tt("Paused", "Dijeda"), dot: false };
    case "Queued": return { tone: "neutral", label: tt("Queued", "Antre"), dot: true };
    case "CompletedWithErrors": return { tone: "warning", label: tt("Completed with errors", "Selesai dengan error"), dot: false };
    default: return { tone: "success", label: tt("Completed", "Selesai"), dot: false };
  }
}

/* ---- docked background pill ---- */
function CmPill({ job, onClick, C, tt }) {
  const total = job.total || 0, done = job.stored + job.failed + job.skipped, pct = total ? Math.round(done / total * 100) : 0;
  return (
    <button type="button" onClick={onClick} style={{ ...FONT, cursor: "pointer", position: "fixed", right: 22, bottom: 22, zIndex: 50, display: "flex", alignItems: "center", gap: 12,
      backgroundColor: C.ocean, color: "#fff", border: 0, borderRadius: 14, padding: "11px 15px", boxShadow: "0 12px 34px -10px rgba(0,0,0,.45)" }}>
      <Spinner size={18} color="#fff" />
      <span style={{ textAlign: "left" }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700 }}>{job.status === "Paused" ? tt("Migration paused", "Migrasi dijeda") : tt("Migrating documents", "Migrasi dokumen")}</span>
        <span style={{ display: "block", fontSize: 11, opacity: 0.85, fontFamily: "monospace" }}>{done}/{total} · {pct}%{job.failed ? ` · ${job.failed} ${tt("failed", "gagal")}` : ""}</span>
      </span>
      <span style={{ backgroundColor: "rgba(255,255,255,.18)", borderRadius: 8, padding: "5px 9px", fontSize: 11, fontWeight: 700 }}>{tt("Open", "Buka")}</span>
    </button>
  );
}

/* ---- history logbook ---- */
function CmHistory({ history, open, detail, onOpen, C, tt, lang }) {
  if (!history.length) {
    return <Card style={{ padding: 46, textAlign: "center", color: C.textMuted }}><Icon name="inbox" size={26} /><div style={{ marginTop: 10 }}>{tt("No imports yet. Migrations you run will be logged here.", "Belum ada import. Migrasi yang Anda jalankan akan tercatat di sini.")}</div></Card>;
  }
  const dur = (j) => {
    if (!j.startedAt || !j.completedAt) return "—";
    const s = Math.max(1, Math.round((new Date(j.completedAt) - new Date(j.startedAt)) / 1000));
    return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s` : `${s}s`;
  };
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 680 }}>
          <thead><tr style={{ backgroundColor: C.surfaceAlt }}>
            {[tt("When", "Waktu"), tt("File", "Berkas"), tt("Docs", "Dok"), tt("Stored", "Tersimpan"), tt("Failed", "Gagal"), tt("Duration", "Durasi"), tt("Status", "Status")].map((h, i) => (
              <th key={i} style={{ textAlign: i >= 2 && i <= 5 ? "right" : "left", padding: "11px 16px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {history.map((j) => {
              const stat = cmJobStatusPill(j.status, tt);
              const isOpen = open === j.id;
              return (
                <React.Fragment key={j.id}>
                  <tr onClick={() => onOpen(j.id)} style={{ cursor: "pointer", backgroundColor: isOpen ? C.brandBg : "transparent" }}>
                    <td style={{ padding: "12px 16px", borderTop: `1px solid ${C.borderSoft}`, fontFamily: "monospace", fontSize: 12, color: C.textMuted, whiteSpace: "nowrap" }}>{cmFmtWhen(j.startedAt || j.createdAt)}</td>
                    <td style={{ padding: "12px 16px", borderTop: `1px solid ${C.borderSoft}` }}><div style={{ fontWeight: 600, color: C.text }}>{j.fileName}</div><div style={{ fontSize: 11.5, color: C.textSubtle }}>{j.startedBy || ""}</div></td>
                    <td style={{ padding: "12px 16px", borderTop: `1px solid ${C.borderSoft}`, textAlign: "right", fontFamily: "monospace" }}>{j.total}</td>
                    <td style={{ padding: "12px 16px", borderTop: `1px solid ${C.borderSoft}`, textAlign: "right", fontFamily: "monospace", color: C.success }}>{j.stored}</td>
                    <td style={{ padding: "12px 16px", borderTop: `1px solid ${C.borderSoft}`, textAlign: "right", fontFamily: "monospace", color: j.failed ? C.danger : C.textSubtle }}>{j.failed}</td>
                    <td style={{ padding: "12px 16px", borderTop: `1px solid ${C.borderSoft}`, textAlign: "right", fontFamily: "monospace", color: C.textMuted }}>{dur(j)}</td>
                    <td style={{ padding: "12px 16px", borderTop: `1px solid ${C.borderSoft}`, textAlign: "right" }}><Badge tone={stat.tone} size="sm">{stat.label}</Badge></td>
                  </tr>
                  {isOpen && (
                    <tr><td colSpan={7} style={{ padding: 14, borderTop: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceInset }}>
                      {detail ? <CmLedger rows={detail.rows} C={C} tt={tt} readonly /> : <div style={{ textAlign: "center", padding: 20 }}><Spinner size={20} color={C.ocean} /></div>}
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---- intake wizard (upload → map → preview → confirm) ---- */
function CmWizard({ C, tt, lang, step, setStep, rows, totalRows, distinctCount, dupRows, docRows, fileName, parseError, fileInputRef, handleFile, downloadTemplate, previewRows, mergedOnly, setMergedOnly, mergedGroups, expanded, toggleRow, startJob, busy, commodityIssues, commodityLookupError, commodityBlocked }) {
  // Clear, user-facing explanation of why the import can't proceed (commodity master lookup failed).
  const CommodityBlockAlert = () => {
    if (!commodityBlocked) return null;
    if (commodityLookupError) {
      return <div style={{ marginBottom: 14 }}><Alert tone="error" title={tt("Cannot validate commodity", "Tidak bisa memvalidasi commodity")} description={commodityLookupError} /></div>;
    }
    const parts = [];
    if (commodityIssues.classifications.length) parts.push(`${tt("Classification not in master data", "Classification tidak ada di master data")}: ${commodityIssues.classifications.join(", ")}`);
    if (commodityIssues.subClassifications.length) parts.push(`${tt("Sub-Classification not in master data", "Sub-Classification tidak ada di master data")}: ${commodityIssues.subClassifications.join(", ")}`);
    return (
      <div style={{ marginBottom: 14 }}>
        <Alert tone="error"
          title={`${tt("Import blocked", "Import diblokir")} — ${commodityIssues.count} ${tt("row(s) with unknown commodity", "baris dengan commodity tak dikenal")}`}
          description={`${parts.join(" · ")}. ${tt("Add these to Commodity master data (or fix the file) before continuing.", "Tambahkan ke master data Commodity (atau perbaiki berkas) sebelum melanjutkan.")}`} />
      </div>
    );
  };
  const STEPS = [
    { en: "Upload Excel", id: "Unggah Excel", icon: "file-spreadsheet" },
    { en: "Map columns", id: "Petakan kolom", icon: "columns-3" },
    { en: "Preview & confirm", id: "Pratinjau & konfirmasi", icon: "list-checks" },
  ];
  return (
    <div>
      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <MigNode icon="folder-symlink" title="SharePoint" sub={tt("Existing documents", "Dokumen eksisting")} tone={C.blue} />
          <MigArrow label={tt("Excel + files", "Excel + berkas")} C={C} />
          <MigNode icon="scan-text" title={tt("This application", "Aplikasi ini")} sub={tt("Reads & queues", "Baca & antre")} tone={C.ocean} />
          <MigArrow label={tt("migrate", "migrasi")} C={C} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <MigNode icon="database" title={tt("Contract Database", "Contract Database")} sub={tt("Contract data", "Data kontrak")} tone={C.success} small />
            <MigNode icon="cloud" title="Azure Blob Storage" sub={tt("Document files", "Berkas dokumen")} tone="#7C5CBF" small />
          </div>
        </div>
      </Card>

      <Card style={{ padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {STEPS.map((s, i) => {
            const st = i < step ? "done" : i === step ? "current" : "todo";
            const col = st === "done" ? C.success : st === "current" ? C.ocean : C.textSubtle;
            return (
              <React.Fragment key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: st === "todo" ? C.surfaceAlt : col + "1f", border: `2px solid ${st === "todo" ? C.border : col}`, color: col }}><Icon name={st === "done" ? "check" : s.icon} size={16} /></span>
                  <span style={{ fontSize: 12.5, fontWeight: i === step ? 700 : 600, color: st === "todo" ? C.textSubtle : C.text }}>{trkText(lang, s)}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, backgroundColor: i < step ? C.success : C.border, margin: "0 14px" }} />}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {step === 0 && (
        <DetailCard title={tt("Upload contract Excel", "Unggah Excel kontrak")} subtitle={tt("Use the standard Contract Monitoring export template (.xlsx).", "Gunakan template ekspor Contract Monitoring standar (.xlsx).")}>
          <div style={{ border: `2px dashed ${C.border}`, borderRadius: RADIUS.lg, padding: "36px 20px", textAlign: "center", backgroundColor: C.surfaceInset }}>
            <span style={{ width: 60, height: 60, borderRadius: RADIUS.lg, backgroundColor: C.ocean + "1a", color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Icon name="upload" size={28} /></span>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{tt("Drop the contract export here", "Letakkan ekspor kontrak di sini")}</div>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>{tt("or click to browse — .xlsx up to 25 MB", "atau klik untuk memilih — .xlsx hingga 25 MB")}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; handleFile(f); }} style={{ display: "none" }} />
              <Button variant="secondary" iconLeft="download" onClick={downloadTemplate}>{tt("Download template", "Unduh template")}</Button>
              <Button iconLeft="upload" onClick={() => fileInputRef.current && fileInputRef.current.click()}>{tt("Select file", "Pilih berkas")}</Button>
            </div>
          </div>
          {parseError && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "11px 14px", borderRadius: RADIUS.md, backgroundColor: C.dangerBg, color: C.danger, fontSize: 12.5 }}><Icon name="alert-triangle" size={15} />{parseError}</div>}
          {fileName && rows.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "11px 14px", borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}` }}>
              <Icon name="file-check-2" size={18} color={C.success} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{fileName}</div><div style={{ fontSize: 11.5, color: C.textSubtle }}>{totalRows} {tt("rows detected", "baris terdeteksi")}</div></div>
              <Button variant="link" size="sm" iconRight="arrow-right" onClick={() => setStep(1)}>{tt("Continue", "Lanjut")}</Button>
            </div>
          )}
        </DetailCard>
      )}

      {step === 1 && (
        <DetailCard title={tt("Map Excel columns to fields", "Petakan kolom Excel ke field")} subtitle={tt("Columns were auto-detected from the file header.", "Kolom terdeteksi otomatis dari header berkas.")}
          action={<Badge tone="success"><Icon name="check" size={11} />{CM_IMPORT_MAPPING.length} {tt("columns matched", "kolom cocok")}</Badge>}>
          <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ backgroundColor: C.surfaceAlt }}>
                {[tt("Excel column", "Kolom Excel"), "", tt("Database field", "Field database"), tt("Status", "Status")].map((h, i) => (
                  <th key={i} style={{ textAlign: "left", padding: "9px 14px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.textMuted }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {CM_IMPORT_MAPPING.map((m, i) => (
                  <tr key={i}>
                    <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}`, color: C.text, fontWeight: 500 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>{m.doc && <Icon name="paperclip" size={12} color="#7C5CBF" />}{m.col}</span></td>
                    <td style={{ padding: "9px 6px", borderTop: `1px solid ${C.borderSoft}`, color: C.textSubtle }}><Icon name="arrow-right" size={13} /></td>
                    <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}` }}><span style={{ fontFamily: "monospace", fontSize: 11.5, color: C.ocean, backgroundColor: C.brandBg, padding: "2px 8px", borderRadius: RADIUS.sm }}>{m.field}</span></td>
                    <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}` }}>{m.doc ? <Badge tone="info" size="sm"><Icon name="cloud-upload" size={10} />{tt("Migrate to Blob", "Migrasi ke Blob")}</Badge> : <Badge tone="success" size="sm"><Icon name="check" size={10} />{tt("Matched", "Cocok")}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}><CommodityBlockAlert /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <Button variant="secondary" iconLeft="arrow-left" onClick={() => setStep(0)}>{tt("Back", "Kembali")}</Button>
            <Button iconRight="arrow-right" onClick={() => setStep(2)}>{tt("Preview data", "Pratinjau data")}</Button>
          </div>
        </DetailCard>
      )}

      {step === 2 && (
        <div>
          <CommodityBlockAlert />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }} className="ag-trk-kpis">
            <TrkStatCard icon="rows-3" tone="brand" label={tt("Rows in file", "Baris di berkas")} value={totalRows} sub={tt("document rows", "baris dokumen")} />
            <TrkStatCard icon="file-text" tone="forest" label={tt("Distinct contracts", "Kontrak unik")} value={distinctCount} sub={tt("after distinct rule", "setelah aturan distinct")} />
            <TrkStatCard icon="git-merge" tone="orange" label={tt("Duplicates merged", "Duplikat digabung")} value={dupRows} sub={tt("amendment rows", "baris amandemen")} />
            <TrkStatCard icon="cloud-upload" tone="blue" label={tt("Docs → Blob", "Dokumen → Blob")} value={docRows} sub={tt("from SharePoint", "dari SharePoint")} />
          </div>
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: RADIUS.md, backgroundColor: C.ocean + "1f", color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="git-merge" size={16} /></span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{tt("How duplicate Contract Nos are merged", "Cara penggabungan No Kontrak duplikat")}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }} className="ag-trk-row3">
              <RuleStep n="1" icon="fingerprint" title={tt("Distinct Contract No", "No Kontrak distinct")} body={tt("Group every row by Contract No. Each becomes one contract.", "Kelompokkan setiap baris berdasarkan No Kontrak. Tiap No jadi satu kontrak.")} C={C} />
              <RuleStep n="2" icon="arrow-down-narrow-wide" title={tt("Sort by Expired Date", "Urutkan per Expired Date")} body={tt("Multiple rows for one No are ordered by Expired Date (oldest → newest).", "Beberapa baris untuk satu No diurutkan per Expired Date (lama → baru).")} C={C} />
              <RuleStep n="3" icon="columns-3" title={tt("Title first · data last", "Judul pertama · data terakhir")} body={tt("Title from the first row; every other field from the last row.", "Judul dari baris pertama; field lain dari baris terakhir.")} C={C} />
            </div>
          </Card>
          <DetailCard title={tt("Preview parsed contracts", "Pratinjau kontrak hasil parse")} subtitle={tt("One row per distinct contract. Every document with a link will be migrated.", "Satu baris per kontrak unik. Setiap dokumen berlink akan dimigrasi.")}
            action={<button type="button" onClick={() => setMergedOnly((v) => !v)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 500, border: `1px solid ${mergedOnly ? C.orange : C.border}`, backgroundColor: mergedOnly ? (C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)") : C.surface, color: mergedOnly ? C.orange : C.textMuted }}>
              <Icon name={mergedOnly ? "check-circle-2" : "git-merge"} size={13} />{tt("Merged only", "Hanya gabungan")} <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, backgroundColor: C.orange, color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{mergedGroups.length}</span>
            </button>} pad={0}>
            <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
                <thead><tr style={{ backgroundColor: C.surfaceAlt, position: "sticky", top: 0, zIndex: 1 }}>
                  {["", tt("Contract", "Kontrak"), tt("Supplier", "Pemasok"), tt("Rows", "Baris"), tt("Value", "Nilai"), tt("Expires", "Berakhir"), tt("Document", "Dokumen")].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 4 ? "right" : "left", padding: "9px 14px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.textMuted, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {previewRows.map((g) => {
                    const multi = g.versions.length > 1;
                    const open = expanded.has(g.contractId);
                    const hasDoc = g.link && /^https?:/i.test(g.link);
                    return (
                      <React.Fragment key={g.contractId}>
                        <tr onClick={() => multi && toggleRow(g.contractId)} style={{ cursor: multi ? "pointer" : "default", backgroundColor: open ? C.surfaceInset : "transparent" }}>
                          <td style={{ padding: "9px 10px 9px 14px", borderTop: `1px solid ${C.borderSoft}`, width: 26, color: C.textSubtle }}>{multi ? <Icon name={open ? "chevron-down" : "chevron-right"} size={15} color={C.orange} /> : <span style={{ display: "inline-block", width: 15 }} />}</td>
                          <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}`, maxWidth: 340 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: C.ocean }}>{g.contractId}</span>{multi && <Badge tone="orange" size="sm"><Icon name="git-merge" size={10} />{g.versions.length} {tt("rows", "baris")}</Badge>}</div>
                            <div style={{ fontSize: 11.5, color: C.text, fontWeight: 600, marginTop: 2, lineHeight: 1.35, overflowWrap: "anywhere" }}>{g.title}</div>
                          </td>
                          <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}`, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>{g.supplier}</td>
                          <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}`, color: C.textMuted }}>{g.versions.length}</td>
                          <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}`, textAlign: "right", fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{trkRp(g.value)}</td>
                          <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}`, color: C.textMuted, whiteSpace: "nowrap" }}>{trkFmtDate(g.currentExpiry, lang)}</td>
                          <td style={{ padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}` }}>{hasDoc ? <Badge tone="info" size="sm"><Icon name="cloud-upload" size={10} />{tt("Migrate", "Migrasi")}</Badge> : <Badge tone="neutral" size="sm">{tt("No file", "Tanpa berkas")}</Badge>}</td>
                        </tr>
                        {multi && open && <tr><td colSpan={7} style={{ padding: 0, borderTop: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceInset }}><MergeBreakdown g={g} C={C} lang={lang} tt={tt} /></td></tr>}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DetailCard>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <Button variant="secondary" iconLeft="arrow-left" onClick={() => setStep(1)}>{tt("Back", "Kembali")}</Button>
            <Button iconLeft={busy ? undefined : "cloud-upload"} disabled={busy || commodityBlocked} onClick={startJob}>{busy ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Spinner size={14} color="#fff" />{tt("Starting…", "Memulai…")}</span> : `${tt("Start migration", "Mulai migrasi")} · ${distinctCount}`}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleStep({ n, icon, title, body, C }) {
  return (
    <div style={{ display: "flex", gap: 11, padding: "12px 13px", borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, backgroundColor: C.ocean, color: "#fff", fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name={icon} size={14} color={C.ocean} /><span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{title}</span></div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4, lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}

function MergeBreakdown({ g, C, lang, tt }) {
  const vers = g.versions;
  const lastIdx = vers.length - 1;
  return (
    <div style={{ padding: "14px 16px 16px 50px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textSubtle, marginBottom: 10 }}>
        {tt("Duplicate rows for", "Baris duplikat untuk")} <span style={{ fontFamily: "monospace", color: C.ocean }}>{g.contractId}</span> · {tt("sorted by Expired Date", "diurutkan per Expired Date")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vers.map((v, i) => {
          const isFirst = i === 0, isLast = i === lastIdx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: RADIUS.md, border: `1px solid ${isLast ? C.orange + "55" : C.borderSoft}`, backgroundColor: C.surface }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, fontSize: 11, fontWeight: 700, backgroundColor: C.surfaceAlt, color: C.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <Badge tone={v.type === "MAIN CONTRACT" ? "brand" : "info"} size="sm">{v.type}</Badge>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                <div style={{ fontSize: 11, color: C.textSubtle }}>{tt("Expires", "Berakhir")} <b style={{ color: C.text }}>{trkFmtDate(v.expiredDate, lang)}</b> · {trkRp(v.value)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {isFirst && <Badge tone="success" size="sm"><Icon name="type" size={10} />{tt("Title source", "Sumber judul")}</Badge>}
                {isLast && <Badge tone="orange" size="sm"><Icon name="database" size={10} />{tt("Data source", "Sumber data")}</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MigNode({ icon, title, sub, tone, small }) {
  const C = useC();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: small ? "8px 12px" : "10px 14px", borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surface, minWidth: 0 }}>
      <span style={{ width: small ? 32 : 40, height: small ? 32 : 40, borderRadius: RADIUS.md, backgroundColor: tone + "1f", color: tone, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={icon} size={small ? 16 : 20} /></span>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: small ? 12.5 : 13.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>{title}</div><div style={{ fontSize: 11, color: C.textSubtle, whiteSpace: "nowrap" }}>{sub}</div></div>
    </div>
  );
}
function MigArrow({ label, C }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
      <Icon name="arrow-right" size={18} color={C.textSubtle} />
      <span style={{ fontSize: 10, color: C.textSubtle }}>{label}</span>
    </div>
  );
}
Object.assign(window, { ContractImport });
export { ContractImport };
