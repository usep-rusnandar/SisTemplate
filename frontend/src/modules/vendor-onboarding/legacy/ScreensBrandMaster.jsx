/* fm3-converted */
import React from "react";
import { BRAND_NAME_MAX, useBrandMaster } from "./BrandMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, DetailCard, Field, Icon, IconButton, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Brand Master Data.
   Source table: MSTR_BRAND_T (BrandName varchar(50) PK).
   Follows the established Master Data pattern: PageHeader + MetricCards +
   Toolbar + DataTable + Modal. */

function _brandTone(name) {
  const tones = ["brand", "blue", "orange", "forest"];
  return tones[(String(name || "A").charCodeAt(0) || 65) % tones.length];
}

function _brandToneColor(C, tone) {
  return ({ brand: C.ocean, blue: C.blue, orange: C.orange, forest: C.forest })[tone] || C.ocean;
}

function BrandMasterData() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const bm = useBrandMaster();

  const ps = usePageSearch(tt("Search brand…", "Cari merek…"));
  const q = ps.query;
  const setQ = ps.setQuery;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortDir, setSortDir] = React.useState("asc");
  const [modal, setModal] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [q, pageSize, sortDir]);

  const sorted = React.useMemo(() => {
    return [...bm.brands].sort((a, b) => {
      const cmp = a.BrandName.localeCompare(b.BrandName);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [bm.brands, sortDir]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return sorted;
    return sorted.filter((b) => b.BrandName.toLowerCase().includes(qq));
  }, [sorted, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim();

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const longestBrand = React.useMemo(() => {
    if (!bm.brands.length) return null;
    return bm.brands.reduce((a, b) => (a.BrandName.length >= b.BrandName.length ? a : b));
  }, [bm.brands]);

  const saveBrand = (name) => {
    const res = bm.addBrand(name);
    if (!res.ok) return res;
    session.record({ action: "Create", module: "Brand", desc: `Added brand ${res.BrandName}`, tone: "success" });
    toast.push({ title: tt("Brand added", "Merek ditambahkan"), description: res.BrandName });
    setModal(false);
    return res;
  };

  const confirmDelete = () => {
    bm.removeBrand(del.BrandName);
    session.record({ action: "Delete", module: "Brand", desc: `Deleted brand ${del.BrandName}`, tone: "danger" });
    toast.push({ title: tt("Brand deleted", "Merek dihapus"), description: del.BrandName, tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((b) => b.BrandName === r.BrandName);
      return (
        <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt,
          color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>
          {i + 1}
        </span>
      );
    } },
    { key: "brand", label: tt("Brand", "Merek"), render: (r) => {
      const tone = _brandTone(r.BrandName);
      const col = _brandToneColor(C, tone);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
            backgroundColor: col + "1A", color: col, fontWeight: 800, fontSize: 13, letterSpacing: "-0.02em" }}>
            {(r.BrandName || "?").charAt(0).toUpperCase()}
          </span>
          <span style={{ minWidth: 0, fontWeight: 600, color: C.text, fontSize: 13 }}>{r.BrandName}</span>
        </div>
      );
    } },
    { key: "len", label: tt("Length", "Panjang"), width: 92, render: (r) => (
      <span style={{ fontSize: 12.5, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
        {r.BrandName.length}<span style={{ color: C.textSubtle }}> / {BRAND_NAME_MAX}</span>
      </span>
    ) },
    { key: "_a", label: "", align: "right", width: 56, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="trash-2" label={tt("Delete", "Hapus")} danger onClick={() => setDel(r)} />
        </Menu>
      </div>
    ) },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Brand", "Merek")}
        subtitle={tt(
          "Canonical brand names used across vendor profiles and commodity mapping. Each name is a unique key in MSTR_BRAND_T.",
          "Nama merek baku untuk profil vendor dan pemetaan komoditas. Setiap nama adalah kunci unik di MSTR_BRAND_T."
        )}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>MSTR_BRAND_T</Badge>
          <OpsHeroButton iconLeft="upload" onClick={() => setBulkOpen(true)}>{tt("Bulk upload", "Unggah massal")}</OpsHeroButton>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal(true)}>{tt("Add brand", "Tambah merek")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="tags" label={tt("Total brands", "Total merek")} value={bm.brands.length} iconTone="brand" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching search", "Cocok pencarian") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
        <OpsStatCard icon="text" label={tt("Longest name", "Nama terpanjang")} value={longestBrand ? `${longestBrand.BrandName.length} ${tt("chars", "kar.")}` : "—"} iconTone="forest" />
      </OpsStatGrid>

      <Card pad={0}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 280 }}>
                <TextInput iconLeft="search" placeholder={tt("Search brand name…", "Cari nama merek…")}
                  value={q} onChange={(e) => setQ(e.target.value)}
                  inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
              </div>
              <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm"
                iconLeft={sortDir === "asc" ? "arrow-down-a-z" : "arrow-up-a-z"}
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
                {sortDir === "asc" ? "A → Z" : "Z → A"}
              </Button>
              {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => setQ("")}>{t("act.clear")}</Button>}
              {hasFilter && <Badge tone="brand">{filtered.length} {tt("results", "hasil")}</Badge>}
            </>}
            right={<Badge tone="neutral">{filtered.length} {tt("of", "dari")} {bm.brands.length}</Badge>}
          />
        </div>

        <DataTable columns={columns} data={pageRows} dense rowKey="BrandName"
          emptyTitle={hasFilter ? tt("No brands match your search", "Tidak ada merek yang cocok") : tt("No brands yet", "Belum ada merek")}
          emptyDesc={hasFilter
            ? tt("Try a different keyword or clear the search filter.", "Coba kata kunci lain atau bersihkan filter pencarian.")
            : tt("Add the first brand to start building the catalog.", "Tambahkan merek pertama untuk memulai katalog.")}
        />

        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>

      <BrandModal open={modal} onClose={() => setModal(false)} onSave={saveBrand} />
      <BrandBulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} bm={bm} session={session} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2"
        title={tt("Delete brand", "Hapus merek")}
        subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<>
          <Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button>
          <Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button>
        </>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>
          {tt("Remove", "Hapus merek")} <b>{del && del.BrandName}</b> {tt("from the brand catalog?", "dari katalog merek?")}
        </p>
      </Modal>
    </OpsPage>
  );
}

function BrandModal({ open, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const [name, setName] = React.useState("");
  const [err, setErr] = React.useState("");
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setErr("");
      setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
    }
  }, [open]);

  const submit = () => {
    const res = onSave(name);
    if (!res.ok) return setErr(res.error);
  };

  const remaining = BRAND_NAME_MAX - (name || "").length;

  return (
    <Modal open={open} onClose={onClose} width={480} icon="tag"
      title={tt("Add brand", "Tambah merek")}
      subtitle={tt("Enter a unique brand name (max 50 characters).", "Masukkan nama merek unik (maks. 50 karakter).")}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="check" onClick={submit}>{tt("Add brand", "Tambah merek")}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Brand name", "Nama merek")} required status={err ? "error" : "default"} helper={err || tt("Primary key — must be unique", "Kunci utama — harus unik")}>
          <TextInput inputRef={inputRef} value={name}
            onChange={(e) => { setName(e.target.value.slice(0, BRAND_NAME_MAX)); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={tt("e.g. 3M, ABB, CATERPILLAR", "cth. 3M, ABB, CATERPILLAR")}
            status={err ? "error" : "default"} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -6, fontSize: 11.5, color: remaining < 8 ? C.orange : C.textSubtle, fontVariantNumeric: "tabular-nums" }}>
          {remaining} {tt("characters left", "karakter tersisa")}
        </div>
        {name.trim() && (
          <DetailCard title={tt("Preview", "Pratinjau")} pad={14}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: RADIUS.md, display: "inline-flex", alignItems: "center", justifyContent: "center",
                backgroundColor: _brandToneColor(C, _brandTone(name)) + "1A", color: _brandToneColor(C, _brandTone(name)), fontWeight: 800, fontSize: 14 }}>
                {name.trim().charAt(0).toUpperCase()}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{name.trim()}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>MSTR_BRAND_T</div>
              </div>
            </div>
          </DetailCard>
        )}
      </div>
    </Modal>
  );
}

function _bulkOutcomeMeta(outcome, tt) {
  if (outcome === "created") return { tone: "success", label: tt("New", "Baru") };
  if (outcome === "skippedExisting") return { tone: "neutral", label: tt("Skip (exists)", "Lewati (sudah ada)") };
  if (outcome === "skippedDuplicate") return { tone: "warning", label: tt("Skip (duplicate)", "Lewati (duplikat)") };
  return { tone: "danger", label: tt("Invalid", "Tidak valid") };
}

function BrandBulkUploadModal({ open, onClose, bm, session }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const fileRef = React.useRef(null);
  const [file, setFile] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const [busy, setBusy] = React.useState("");
  const [err, setErr] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setBusy("");
      setErr("");
      setFilter("all");
      setPage(1);
    }
  }, [open]);

  const takeFile = (next) => {
    if (!next) return;
    const name = (next.name || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      setErr(tt("Upload an .xlsx or .csv file.", "Unggah file .xlsx atau .csv."));
      return;
    }
    setFile(next);
    setPreview(null);
    setErr("");
    setFilter("all");
    setPage(1);
  };

  const runPreview = async () => {
    if (!file) return;
    setBusy("preview");
    setErr("");
    try {
      const result = await bm.previewBrandImport(file);
      setPreview(result);
      setPage(1);
    } catch (error) {
      setErr(error.message || tt("Could not read the file.", "File tidak dapat dibaca."));
    } finally {
      setBusy("");
    }
  };

  const runCommit = async () => {
    if (!file || !preview || preview.created === 0) return;
    setBusy("commit");
    setErr("");
    try {
      const result = await bm.commitBrandImport(file);
      setPreview(result);
      session.record({
        action: "Create",
        module: "Brand",
        desc: `Bulk imported ${result.created} brand(s); skipped ${result.skippedExisting} existing`,
        tone: "success",
      });
      toast.push({
        title: tt("Brand upload complete", "Unggah merek selesai"),
        description: tt(
          `${result.created} added · ${result.skippedExisting} skipped (already exist)`,
          `${result.created} ditambah · ${result.skippedExisting} dilewati (sudah ada)`
        ),
      });
      if (result.created > 0) onClose();
    } catch (error) {
      setErr(error.message || tt("Import failed.", "Import gagal."));
    } finally {
      setBusy("");
    }
  };

  const downloadTemplate = async () => {
    setBusy("template");
    setErr("");
    try {
      await bm.downloadImportTemplate();
    } catch (error) {
      setErr(error.message || tt("Could not download the template.", "Template tidak dapat diunduh."));
    } finally {
      setBusy("");
    }
  };

  const rows = preview?.rows || [];
  const filtered = rows.filter((row) => {
    if (filter === "created") return row.outcome === "created";
    if (filter === "skipped") return row.outcome === "skippedExisting" || row.outcome === "skippedDuplicate";
    if (filter === "invalid") return row.outcome === "invalid";
    return true;
  });
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const columns = [
    { key: "rowNumber", label: tt("Row", "Baris"), width: 64, render: (r) => (
      <span style={{ color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{r.rowNumber}</span>
    ) },
    { key: "name", label: tt("Brand", "Merek"), render: (r) => (
      <span style={{ fontWeight: 600, color: C.text }}>{r.name || "—"}</span>
    ) },
    { key: "outcome", label: tt("Status", "Status"), width: 168, render: (r) => {
      const meta = _bulkOutcomeMeta(r.outcome, tt);
      return <Badge tone={meta.tone}>{meta.label}</Badge>;
    } },
    { key: "reason", label: tt("Note", "Catatan"), render: (r) => (
      <span style={{ fontSize: 12.5, color: C.textMuted }}>{r.reason || "—"}</span>
    ) },
  ];

  return (
    <Modal open={open} onClose={onClose} width={760} icon="upload"
      title={tt("Bulk upload brands", "Unggah massal merek")}
      subtitle={tt(
        "Create-only. Names that already exist in MSTR_BRAND_T are skipped.",
        "Hanya menambah data baru. Nama yang sudah ada di MSTR_BRAND_T dilewati."
      )}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tt("Close", "Tutup")}</Button>
        {!preview && <Button iconLeft="scan-search" disabled={!file || !!busy} onClick={runPreview}>
          {busy === "preview" ? tt("Checking…", "Memeriksa…") : tt("Preview", "Pratinjau")}
        </Button>}
        {preview && !preview.committed && (
          <Button iconLeft="check" disabled={busy || preview.created === 0} onClick={runCommit}>
            {busy === "commit"
              ? tt("Importing…", "Mengimpor…")
              : tt(`Import ${preview.created} new`, `Impor ${preview.created} baru`)}
          </Button>
        )}
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.45 }}>
            {tt("Excel (.xlsx) or CSV. Column BrandName. Max 50 characters per name.", "Excel (.xlsx) atau CSV. Kolom BrandName. Maks. 50 karakter per nama.")}
          </div>
          <Button variant="secondary" size="sm" iconLeft="download" disabled={!!busy} onClick={downloadTemplate}>
            {tt("Download template", "Unduh template")}
          </Button>
        </div>

        <button type="button" onClick={() => fileRef.current && fileRef.current.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); takeFile(event.dataTransfer.files && event.dataTransfer.files[0]); }}
          style={{ ...FONT, width: "100%", padding: "22px 18px", borderRadius: RADIUS.lg,
            border: `1px dashed ${file ? C.ocean : C.border}`, background: file ? C.ocean + "0b" : C.surfaceAlt,
            color: C.text, cursor: "pointer", textAlign: "center" }}>
          <span style={{ width: 40, height: 40, margin: "0 auto 10px", borderRadius: 12, background: C.ocean + "18",
            color: C.ocean, display: "grid", placeItems: "center" }}>
            <Icon name="file-spreadsheet" size={20} />
          </span>
          <div style={{ fontWeight: 750, fontSize: 14 }}>{file ? file.name : tt("Drop the brand file here", "Letakkan file merek di sini")}</div>
          <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
            {tt("or click to browse — .xlsx / .csv up to 5 MB", "atau klik untuk memilih — .xlsx / .csv hingga 5 MB")}
          </div>
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          hidden onChange={(event) => { takeFile(event.target.files && event.target.files[0]); event.target.value = ""; }} />

        {err && <Alert tone="error" title={tt("Upload issue", "Masalah unggahan")} description={err} />}

        {preview && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {[
                ["all", tt("Rows", "Baris"), preview.totalRows, C.text],
                ["created", tt("New", "Baru"), preview.created, C.success || C.ocean],
                ["skipped", tt("Skipped", "Dilewati"), (preview.skippedExisting || 0) + (preview.skippedDuplicate || 0), C.orange],
                ["invalid", tt("Invalid", "Tidak valid"), preview.invalid, C.danger],
              ].map(([key, label, value, color]) => (
                <button key={key} type="button" onClick={() => { setFilter(key); setPage(1); }}
                  style={{ ...FONT, padding: "10px 12px", borderRadius: RADIUS.md, textAlign: "left", cursor: "pointer",
                    border: `1px solid ${filter === key ? C.ocean : C.border}`,
                    background: filter === key ? C.ocean + "12" : C.surface }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
                </button>
              ))}
            </div>
            {preview.created === 0 && (
              <Alert tone="info" title={tt("Nothing new to import", "Tidak ada data baru")}
                description={tt("Every valid name is already in the catalog, or the file has no usable rows.", "Setiap nama valid sudah ada di katalog, atau file tidak berisi baris yang dapat dipakai.")} />
            )}
            <DataTable columns={columns} data={pageRows} dense rowKey="rowNumber"
              emptyTitle={tt("No rows in this view", "Tidak ada baris di tampilan ini")} />
            {filtered.length > pageSize && (
              <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

Object.assign(window, { BrandMasterData, BrandModal, BrandBulkUploadModal });
export { BrandMasterData, BrandModal, BrandBulkUploadModal };
