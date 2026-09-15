/* fm3-converted */
import React from "react";
import { cmAccessForSession } from "./ContractMonData.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { DataTable, Modal, PageHeader, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Contract Monitoring ▸ List of Material.
   Domain-backed materials (cm.CONTRACT_MATERIAL_T). Manual upload parses Excel in the browser
   (SheetJS) then POSTs rows; SharePoint folder sync is server-side. */

function cmMatApi(path, opts) {
  return fetch(`/api/v1/contract-monitoring${path}`, { credentials: "include", ...(opts || {}) }).then(async (res) => {
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const body = await res.json(); if (body && body.error) msg = body.error; } catch (_) { /* ignore */ }
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  });
}

function cmMatNormHeader(h) {
  return String(h == null ? "" : h).replace(/\./g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function cmMatParseUnitPrice(raw) {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const cleaned = String(raw).trim().replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`Invalid Unit Price '${raw}'`);
  return n;
}

/* Parse LoM Excel (first sheet) → rows. Headers must match the official template. */
async function cmParseMaterialFile(file) {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error("Excel parser is not available.");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The workbook has no sheets.");
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false, raw: false });
  if (!matrix.length) return [];

  let headerIdx = -1;
  let map = null;
  for (let i = 0; i < Math.min(10, matrix.length); i++) {
    const trial = {};
    (matrix[i] || []).forEach((cell, col) => {
      const key = cmMatNormHeader(cell);
      if (key === "contract no" || key === "contract number" || key === "contract id") trial.contractNo = col;
      else if (key === "material/service number" || key === "material number" || key === "service number") trial.materialNumber = col;
      else if (key === "description") trial.description = col;
      else if (key === "site") trial.site = col;
      else if (key === "currency") trial.currency = col;
      else if (key === "unit price" || key === "unitprice" || key === "price") trial.unitPrice = col;
    });
    if (trial.contractNo != null && trial.materialNumber != null && trial.description != null
      && trial.site != null && trial.currency != null && trial.unitPrice != null) {
      headerIdx = i;
      map = trial;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error("Required columns not found. Expected: Contract No., Material/Service Number, Description, Site, Currency, Unit Price.");
  }

  const rows = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const line = matrix[r] || [];
    const contractNo = String(line[map.contractNo] ?? "").trim();
    let materialNumber = String(line[map.materialNumber] ?? "").trim();
    const description = String(line[map.description] ?? "").trim();
    if (!materialNumber && description) materialNumber = description;
    if (!contractNo && !materialNumber) continue;
    rows.push({
      contractNo,
      materialNumber,
      description,
      site: String(line[map.site] ?? "").trim(),
      currency: String(line[map.currency] ?? "").trim(),
      unitPrice: cmMatParseUnitPrice(line[map.unitPrice]),
    });
  }
  return rows;
}

function cmFmtMaterialWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

function cmFmtUnitPrice(n, currency) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const formatted = num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return currency ? `${currency} ${formatted}` : formatted;
}

async function cmDownloadMaterialTemplate() {
  const response = await fetch("/api/v1/contract-monitoring/materials/template", { credentials: "include" });
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try { const body = await response.json(); if (body && body.error) msg = body.error; } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "List-of-Material-Template.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ContractMaterialSync({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const access = cmAccessForSession(session);
  const [folderUrl, setFolderUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = React.useState(false);

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await cmDownloadMaterialTemplate();
    } catch (err) {
      toast.push({ tone: "error", title: tt("Download failed", "Unduhan gagal"), description: String(err.message || err) });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const runSync = async () => {
    if (!folderUrl.trim()) {
      toast.push({ tone: "error", title: tt("Folder link required", "Link folder wajib") });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const data = await cmMatApi("/materials/sync-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderUrl: folderUrl.trim() }),
      });
      setResult(data);
      toast.push({
        title: tt("Sync finished", "Sinkronisasi selesai"),
        description: tt(
          `${data.imported} imported · ${data.skipped} skipped · ${data.contractNotFound} not found · ${data.failed} failed`,
          `${data.imported} diimpor · ${data.skipped} dilewati · ${data.contractNotFound} tidak ketemu · ${data.failed} gagal`
        ),
      });
    } catch (err) {
      toast.push({ tone: "error", title: tt("Sync failed", "Sinkronisasi gagal"), description: String(err.message || err) });
    } finally {
      setBusy(false);
    }
  };

  const statusTone = (s) => {
    if (s === "Imported") return "success";
    if (s === "Skipped") return "neutral";
    if (s === "ContractNotFound") return "warning";
    return "danger";
  };

  return (
    <div>
      <PageHeader
        title={tt("Material Sync", "Sinkronisasi Material")}
        description={tt(
          "Read List-of-Material Excel files from a SharePoint folder. File name must match Contract No. with '/' replaced by '-'.",
          "Baca file Excel List of Material dari folder SharePoint. Nama file harus cocok dengan No. Kontrak ( '/' diganti '-' )."
        )}
        actions={
          <>
            <Button variant="secondary" iconLeft={downloadingTemplate ? "loader" : "download"} disabled={downloadingTemplate} onClick={downloadTemplate}>
              {tt("Download template", "Unduh template")}
            </Button>
            {!access.canWrite ? <Badge tone="neutral">{tt("View Only", "Lihat saja")}</Badge> : null}
          </>
        }
      />

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 820 }}>
          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>
            {tt(
              "Paste a sharing link to the SharePoint folder that contains one .xlsx per contract (e.g. 137-SIS-K-PCU-VIII-2024.xlsx). Unchanged files (same name + Last Modified) are skipped.",
              "Tempel sharing link folder SharePoint yang berisi satu .xlsx per kontrak (contoh 137-SIS-K-PCU-VIII-2024.xlsx). File yang belum berubah (nama + Last Modified sama) akan dilewati."
            )}
            {" "}
            <a
              href="/api/v1/contract-monitoring/materials/template"
              onClick={(e) => { e.preventDefault(); downloadTemplate(); }}
              style={{ color: C.ocean, fontWeight: 650, textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              {tt("Download the List-of-Material template", "Unduh template List of Material")}
            </a>
            {tt(
              " — required columns: Contract No., Material/Service Number, Description, Site, Currency, Unit Price. Fill Material/Service Number on every row.",
              " — kolom wajib: Contract No., Material/Service Number, Description, Site, Currency, Unit Price. Isi Material/Service Number di setiap baris."
            )}
          </div>
          <TextInput
            iconLeft="link"
            placeholder="https://….sharepoint.com/:f:/…"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            disabled={busy || !access.canWrite}
          />
          <div style={{ display: "flex", gap: 8 }}>
            {access.canWrite && (
              <Button iconLeft={busy ? "loader" : "cloud-download"} disabled={busy} onClick={runSync}>
                {busy ? tt("Syncing…", "Menyinkronkan…") : tt("Sync folder", "Sinkronkan folder")}
              </Button>
            )}
            {onNavigate && (
              <Button variant="secondary" iconLeft="database" onClick={() => onNavigate("cmDatabase")}>
                {tt("Contract Database", "Database Kontrak")}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {result && (
        <Card style={{ marginTop: 14 }} pad={0}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone="brand">{tt("Files", "File")}: {result.filesSeen}</Badge>
            <Badge tone="success">{tt("Imported", "Diimpor")}: {result.imported}</Badge>
            <Badge tone="neutral">{tt("Skipped", "Dilewati")}: {result.skipped}</Badge>
            <Badge tone="warning">{tt("Not found", "Tidak ketemu")}: {result.contractNotFound}</Badge>
            <Badge tone="danger">{tt("Failed", "Gagal")}: {result.failed}</Badge>
          </div>
          <DataTable
            dense
            rowKey="fileName"
            columns={[
              { key: "fileName", header: tt("File", "File"), render: (r) => <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{r.fileName}</span> },
              { key: "status", header: tt("Status", "Status"), width: 130, render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
              { key: "contractKey", header: tt("Contract No.", "No. Kontrak"), render: (r) => r.contractKey || "—" },
              { key: "rowCount", header: tt("Rows", "Baris"), width: 80, render: (r) => (r.rowCount == null ? "—" : r.rowCount) },
              { key: "message", header: tt("Message", "Pesan"), render: (r) => <span style={{ color: C.textMuted, fontSize: 12 }}>{r.message || "—"}</span> },
            ]}
            data={result.files || []}
            emptyTitle={tt("No files", "Tidak ada file")}
          />
        </Card>
      )}
    </div>
  );
}

function ContractMaterialListModal({ contractId, title, open, onClose, canWrite, onUploaded }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const fileRef = React.useRef(null);
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [data, setData] = React.useState(null);

  const load = React.useCallback(async () => {
    if (!open || !contractId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        contractKey: contractId,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q.trim()) qs.set("q", q.trim());
      const res = await cmMatApi(`/materials?${qs.toString()}`);
      setData(res);
    } catch (err) {
      toast.push({ tone: "error", title: tt("Load failed", "Gagal memuat"), description: String(err.message || err) });
    } finally {
      setLoading(false);
    }
  }, [open, contractId, page, pageSize, q]);

  React.useEffect(() => { load(); }, [load]);

  const summary = data && data.summary;
  const total = (data && data.total) || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const doUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const rows = await cmParseMaterialFile(file);
      if (!rows.length) throw new Error(tt("No material rows in the file.", "Tidak ada baris material di file."));
      const mismatched = rows.find((r) => r.contractNo !== contractId);
      if (mismatched) {
        throw new Error(tt(
          `Contract No. '${mismatched.contractNo}' does not match selected contract '${contractId}'.`,
          `No. Kontrak '${mismatched.contractNo}' tidak cocok dengan kontrak terpilih '${contractId}'.`
        ));
      }
      const result = await cmMatApi("/materials/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractKey: contractId, fileName: file.name, rows }),
      });
      toast.push({
        title: tt("Materials uploaded", "Material diunggah"),
        description: tt(`${result.rowCount} rows replaced.`, `${result.rowCount} baris diganti.`),
      });
      setPage(1);
      await load();
      onUploaded && onUploaded(result);
    } catch (err) {
      toast.push({ tone: "error", title: tt("Upload failed", "Upload gagal"), description: String(err.message || err) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={960}
      style={{ maxWidth: 960 }}
      icon="package"
      title={tt("List of Material", "List of Material")}
      subtitle={`${contractId}${title ? ` · ${title}` : ""}`}
      footer={<Button variant="secondary" onClick={onClose}>{tt("Close", "Tutup")}</Button>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 12px", borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, border: `1px solid ${C.borderSoft}` }}>
          <Badge tone="brand">{tt("Total", "Total")}: {(summary && summary.totalCount) != null ? summary.totalCount : total}</Badge>
          {summary && summary.sourceType && <Badge tone="neutral">{summary.sourceType}</Badge>}
          {summary && summary.fileName && <span style={{ fontSize: 12, color: C.textMuted }}>{summary.fileName}</span>}
          {summary && summary.importedAt && <span style={{ fontSize: 12, color: C.textSubtle }}>{cmFmtMaterialWhen(summary.importedAt)}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {canWrite && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: "none" }}
                  onChange={(e) => doUpload(e.target.files && e.target.files[0])} />
                <Button size="sm" iconLeft={uploading ? "loader" : "upload"} disabled={uploading} onClick={() => fileRef.current && fileRef.current.click()}>
                  {uploading ? tt("Uploading…", "Mengunggah…") : tt("Upload Material", "Upload Material")}
                </Button>
              </>
            )}
          </div>
        </div>

        <Toolbar
          style={{ margin: 0 }}
          left={<>
            <div style={{ width: 280 }}>
              <TextInput iconLeft="search" placeholder={tt("Material no or description…", "No material atau deskripsi…")} value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            {loading && <span style={{ fontSize: 12, color: C.textSubtle }}>{tt("Loading…", "Memuat…")}</span>}
          </>}
          right={null}
        />

        <DataTable
          dense
          rowKey={(r) => `${r.sortOrder}-${r.materialNumber}`}
          columns={[
            { key: "sortOrder", header: "#", width: 56, render: (r) => r.sortOrder },
            { key: "materialNumber", header: tt("Material/Service No.", "No. Material/Service"), render: (r) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{r.materialNumber}</span> },
            { key: "description", header: tt("Description", "Deskripsi") },
            { key: "site", header: tt("Site", "Site"), width: 90 },
            { key: "currency", header: tt("Currency", "Mata uang"), width: 80 },
            { key: "unitPrice", header: tt("Unit Price", "Harga satuan"), width: 130, render: (r) => cmFmtUnitPrice(r.unitPrice, r.currency) },
          ]}
          data={(data && data.items) || []}
          emptyTitle={tt("No materials", "Tidak ada material")}
          emptyDesc={tt("Upload an Excel file to populate this contract's List of Material.", "Unggah file Excel untuk mengisi List of Material kontrak ini.")}
        />
        <Pagination page={page} pageCount={pageCount} onPage={setPage} total={total} pageSize={pageSize}
          onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </Modal>
  );
}

Object.assign(window, { ContractMaterialSync, ContractMaterialListModal, cmParseMaterialFile, cmMatApi, cmFmtMaterialWhen });
export { ContractMaterialSync, ContractMaterialListModal, cmParseMaterialFile, cmMatApi, cmFmtMaterialWhen };
