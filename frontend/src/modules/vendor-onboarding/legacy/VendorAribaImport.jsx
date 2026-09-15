/* fm3-converted */
import React from "react";
import { Badge, Button, Card, Icon } from "../../../shared/legacy/Primitives.jsx";
import { PageHeader, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useTT } from "../../../shared/legacy/i18n.jsx";
/* Vendor Onboarding · Ariba migration desk. Server-side validation is authoritative; the browser
   never mutates vendor data until the Officer explicitly commits a validated batch. */

async function aribaImportApi(path, options) {
  const response = await fetch(`/api/v1/vendor-onboarding/imports${path}`, { credentials: "include", ...(options || {}) });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.title || payload?.code || `HTTP ${response.status}`);
  return payload;
}

function VendorAribaImport() {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const fileRef = React.useRef(null);
  const [file, setFile] = React.useState(null);
  const [batch, setBatch] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [busy, setBusy] = React.useState("");
  const [filter, setFilter] = React.useState("all");

  const loadHistory = React.useCallback(() => aribaImportApi("").then((items) => setHistory(items || [])).catch(() => {}), []);
  React.useEffect(() => { loadHistory(); }, [loadHistory]);

  const validateFile = async () => {
    if (!file) return;
    setBusy("validate");
    try {
      const body = new FormData(); body.append("file", file);
      const result = await aribaImportApi("/validate", { method: "POST", body });
      setBatch(result); setFilter("all"); await loadHistory();
      toast.push({ title: tt("Validation completed", "Validasi selesai"), description: `${result.totalRows} ${tt("vendor rows checked", "baris vendor diperiksa")}` });
    } catch (error) {
      toast.push({ title: tt("Validation failed", "Validasi gagal"), description: error.message, tone: "error" });
    } finally { setBusy(""); }
  };

  const commit = async () => {
    if (!batch || batch.errorRows > 0) return;
    setBusy("commit");
    try {
      const result = await aribaImportApi(`/${batch.id}/commit`, { method: "POST" });
      setBatch(result); await loadHistory();
      toast.push({ title: tt("Import completed", "Import selesai"), description: `${result.importedRows} ${tt("vendors created as INITL", "vendor dibuat sebagai INITL")}` });
    } catch (error) {
      toast.push({ title: tt("Import failed", "Import gagal"), description: error.message, tone: "error" });
    } finally { setBusy(""); }
  };

  const openBatch = async (id) => {
    setBusy("detail");
    try { setBatch(await aribaImportApi(`/${id}`)); setFilter("all"); }
    finally { setBusy(""); }
  };

  const statusTone = (status) => status === "Error" || status === "CompletedWithErrors" ? "danger"
    : status === "Warning" ? "warning" : status === "Imported" || status === "Completed" ? "success" : "info";
  const filteredRows = (batch?.rows || []).filter((row) => filter === "all" || row.status === filter);
  const canCommit = batch && batch.status === "Validated" && batch.errorRows === 0 && (batch.readyRows + batch.warningRows) > 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        <PageHeader title={tt("Ariba Vendor Migration", "Migrasi Vendor Ariba")}
          description={tt("A controlled, create-only path from an Ariba workbook into vendor registration.", "Jalur terkendali dan create-only dari workbook Ariba ke registrasi vendor.")} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, maxWidth: 360 }}>
          <Button variant="secondary" iconLeft="download" onClick={() => { window.location.href = "/api/v1/vendor-onboarding/imports/template"; }}>
            {tt("Download template", "Unduh template")}
          </Button>
          <div style={{ ...FONT, fontSize: 11.5, lineHeight: 1.4, color: C.textMuted, textAlign: "right" }}>
            {tt("Includes two sample vendors (SAMPLE-001 / SAMPLE-002). Officer Ariba inject workbooks are also accepted — labels and packed cells are normalized on upload.", "Sudah berisi dua contoh vendor (SAMPLE-001 / SAMPLE-002). Workbook inject Ariba officer juga diterima — label dan sel gabungan dinormalisasi saat unggah.")}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.45fr) minmax(300px,.55fr)", gap: 16, alignItems: "start" }}>
        <div>
          <Card style={{ overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
              {["Upload", "Validate", "Commit"].map((label, index) => {
                const active = index === 0 ? !batch : index === 1 ? batch?.status === "Validated" : batch?.status !== "Validated";
                const complete = index === 0 ? !!batch : index === 1 ? batch && batch.status !== "Validated" : batch?.status === "Completed";
                return <React.Fragment key={label}>
                  {index > 0 && <span style={{ flex: 1, height: 1, background: complete || active ? C.ocean : C.border }} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: active || complete ? C.ocean : C.textMuted, fontSize: 12, fontWeight: 700 }}>
                    <span style={{ width: 25, height: 25, display: "grid", placeItems: "center", borderRadius: 99, background: complete ? C.ocean : active ? C.ocean + "18" : C.surfaceAlt, color: complete ? "#fff" : "inherit", border: `1px solid ${active || complete ? C.ocean : C.border}` }}>
                      {complete ? <Icon name="check" size={13} /> : index + 1}
                    </span>{tt(label, label === "Upload" ? "Unggah" : label === "Validate" ? "Validasi" : "Commit")}
                  </div>
                </React.Fragment>;
              })}
            </div>

            {!batch && <div style={{ padding: 22 }}>
              <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files?.[0] || null); }}
                style={{ ...FONT, width: "100%", padding: "38px 24px", borderRadius: RADIUS.lg, border: `1px dashed ${file ? C.ocean : C.borderStrong || C.border}`,
                  background: file ? C.ocean + "0b" : C.surfaceAlt, color: C.text, cursor: "pointer", textAlign: "center" }}>
                <span style={{ width: 48, height: 48, margin: "0 auto 12px", borderRadius: 14, background: C.ocean + "18", color: C.ocean, display: "grid", placeItems: "center" }}><Icon name="file-spreadsheet" size={24} /></span>
                <div style={{ fontWeight: 750, fontSize: 15 }}>{file ? file.name : tt("Drop the completed Ariba template here", "Letakkan template Ariba yang sudah diisi di sini")}</div>
                <div style={{ color: C.textMuted, fontSize: 12, marginTop: 5 }}>{tt("XLSX only · maximum 10 MB · no documents in workbook", "Hanya XLSX · maksimum 10 MB · tanpa dokumen dalam workbook")}</div>
              </button>
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <Button iconLeft="scan-search" disabled={!file || !!busy} onClick={validateFile}>{busy === "validate" ? tt("Validating…", "Memvalidasi…") : tt("Validate workbook", "Validasi workbook")}</Button>
              </div>
            </div>}

            {batch && <div>
              <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: C.ocean + "18", color: C.ocean, display: "grid", placeItems: "center" }}><Icon name="file-check-2" size={20} /></span>
                  <div><div style={{ fontWeight: 750 }}>{batch.fileName}</div><div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{tt("Batch", "Batch")} {String(batch.id).slice(0, 8)}</div></div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" iconLeft="rotate-ccw" onClick={() => { setBatch(null); setFile(null); }}>{tt("New validation", "Validasi baru")}</Button>
                  {canCommit && <Button iconLeft="database-zap" disabled={!!busy} onClick={commit}>{busy === "commit" ? tt("Committing…", "Memproses…") : tt("Commit import", "Commit import")}</Button>}
                </div>
              </div>
              {batch.errorRows > 0 && <div style={{ margin: 16, padding: "12px 14px", borderRadius: RADIUS.md, background: C.dangerSoft || "#fff2f2", color: C.danger || "#b42318", display: "flex", gap: 10, fontSize: 13 }}>
                <Icon name="shield-alert" size={17} /><span><b>{tt("Commit is blocked.", "Commit diblokir.")}</b> {tt("Correct every error in Excel, then validate a new batch.", "Perbaiki seluruh error di Excel, lalu validasi batch baru.")}</span>
              </div>}
              <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr>{["Row", "Ariba Vendor ID", "Vendor", "PIC email", "Status", "Finding"].map((heading) => <th key={heading} style={{ padding: "10px 8px", textAlign: "left", color: C.textMuted, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{heading}</th>)}</tr></thead>
                  <tbody>{filteredRows.map((row) => <tr key={row.id}>
                    <td style={{ padding: "11px 8px", borderBottom: `1px solid ${C.border}` }}>{row.rowNumber}</td>
                    <td style={{ padding: "11px 8px", borderBottom: `1px solid ${C.border}`, fontFamily: "monospace", fontWeight: 650 }}>{row.externalVendorId || "—"}</td>
                    <td style={{ padding: "11px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 650 }}>{row.vendorName || "—"}{row.vendorId && <div style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>{row.vendorId}</div>}</td>
                    <td style={{ padding: "11px 8px", borderBottom: `1px solid ${C.border}` }}>{row.picEmail || "—"}</td>
                    <td style={{ padding: "11px 8px", borderBottom: `1px solid ${C.border}` }}><Badge tone={statusTone(row.status)}>{row.status}</Badge></td>
                    <td style={{ padding: "11px 8px", borderBottom: `1px solid ${C.border}`, minWidth: 260 }}>{(row.issues || []).length ? row.issues.map((issue, i) => <div key={i} style={{ color: issue.level === "error" ? C.danger : C.textMuted, marginBottom: 3 }}><b>{issue.field}:</b> {issue.message}</div>) : <span style={{ color: C.success || "#16865c" }}>{tt("Ready to import", "Siap diimport")}</span>}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </div>}
          </Card>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 13 }}>{tt("Batch readiness", "Kesiapan batch")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {[["Ready", batch?.readyRows || 0, C.ocean], ["Warnings", batch?.warningRows || 0, C.warning || "#b7791f"], ["Errors", batch?.errorRows || 0, C.danger || "#c53030"], ["Imported", batch?.importedRows || 0, C.success || "#16865c"]].map(([label, value, color]) =>
                <button type="button" key={label} onClick={() => setFilter(label === "Warnings" ? "Warning" : label === "Errors" ? "Error" : label)} style={{ ...FONT, padding: 12, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: C.surface, textAlign: "left", cursor: batch ? "pointer" : "default" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tt(label, label === "Ready" ? "Siap" : label === "Warnings" ? "Peringatan" : label === "Errors" ? "Error" : "Terimport")}</div>
                </button>)}
            </div>
            {batch && filter !== "all" && <button type="button" onClick={() => setFilter("all")} style={{ ...FONT, border: 0, background: "none", color: C.ocean, fontSize: 12, padding: "10px 0 0", cursor: "pointer" }}>{tt("Show all rows", "Tampilkan semua baris")}</button>}
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><b style={{ fontSize: 13 }}>{tt("Migration policy", "Kebijakan migrasi")}</b><Icon name="shield-check" size={18} color={C.ocean} /></div>
            {[tt("Create-only except INITL email collisions.", "Create-only kecuali tabrakan email INITL."), tt("PIC emails already used by an INITL vendor overwrite that vendor. Any other status is skipped and does not block the rest of the batch.", "PIC email yang sudah dipakai vendor INITL menimpa data vendor itu. Status lain dilewati dan tidak memblokir sisa batch."), tt("Vendor starts as INITL. An officer must invite them to start registration.", "Vendor berstatus INITL. Officer harus mengundang mereka untuk memulai registrasi."), tt("Inject workbooks are normalized on upload (Office Address, wilayah names, packed KBLI, code + description commodities).", "Workbook inject dinormalisasi saat unggah (Office Address, nama wilayah, KBLI gabungan, komoditas kode + deskripsi)."), tt("Temporary documents are visibly marked and must be replaced.", "Dokumen sementara ditandai dan wajib diganti."), tt("Vendor cannot sign in until they accept the officer invitation and set a password.", "Vendor belum bisa masuk sampai menerima undangan officer dan membuat password.")].map((text, index) => <div key={index} style={{ display: "flex", gap: 8, color: C.textMuted, fontSize: 12, lineHeight: 1.45, marginTop: 9 }}><Icon name="check" size={14} color={C.ocean} style={{ marginTop: 2 }} />{text}</div>)}
          </Card>

          <Card style={{ overflow: "hidden" }}>
            <div style={{ padding: "13px 15px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 13 }}>{tt("Recent batches", "Batch terbaru")}</b><button type="button" title={tt("Refresh", "Muat ulang")} onClick={loadHistory} style={{ border: 0, background: "transparent", color: C.textMuted, cursor: "pointer", padding: 4 }}><Icon name="refresh-cw" size={16} /></button></div>
            <div>{history.slice(0, 6).map((item) => <button type="button" key={item.id} onClick={() => openBatch(item.id)} style={{ ...FONT, width: "100%", border: 0, borderBottom: `1px solid ${C.border}`, background: "transparent", padding: "11px 15px", textAlign: "left", cursor: "pointer", color: C.text }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 12, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.fileName}</span><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{item.totalRows} rows · {new Date(item.createdAt).toLocaleString()}</div>
            </button>)}</div>
            {!history.length && <div style={{ padding: 18, color: C.textMuted, fontSize: 12 }}>{tt("No migration batch yet.", "Belum ada batch migrasi.")}</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
export { VendorAribaImport };
Object.assign(window, { VendorAribaImport });
