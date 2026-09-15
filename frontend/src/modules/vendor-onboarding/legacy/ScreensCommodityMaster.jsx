/* fm3-converted */
import React from "react";
import * as XLSX from "xlsx";
import { CATEGORY_DESC_MAX, CATEGORY_ID_MAX, CLASSIFICATION_DESC_MAX, CLASSIFICATION_ID_MAX, SUBCLASSIFICATION_DESC_MAX, SUBCLASSIFICATION_ID_MAX, _kbliRulePreview, useCommodityMaster } from "./CommodityMasterData.jsx";
import { useKbliMaster } from "./KbliMasterData.jsx";
import { useSpecialReqMaster } from "./SpecialReqMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Checkbox, Field, Icon, IconButton, Select, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, MasterDataTabsCard, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Commodity (3-tab: Sub-classification, Classification, Category). */

function _commodityExcelStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function _downloadCommodityExcel(fileName, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows || []);
  XLSX.utils.book_append_sheet(wb, ws, String(sheetName || "Sheet1").slice(0, 31));
  XLSX.writeFile(wb, fileName);
}

function useTablePaintReady() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready;
}

function _CommodityIdChip({ children, width }) {
  const C = useC();
  return (
    <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg, padding: "3px 8px", borderRadius: 6, letterSpacing: "0.03em", display: "inline-block", maxWidth: width }}>{children}</span>
  );
}

function CommodityMasterData() {
  const tt = useTT();
  const cm = useCommodityMaster();
  const [tab, setTab] = React.useState("subClassification");

  const tabs = [
    { id: "subClassification", label: tt("Sub-classification", "Sub-klasifikasi"), icon: "list-tree", badge: cm.loading ? undefined : cm.subClassifications.length },
    { id: "classification", label: tt("Classification", "Klasifikasi"), icon: "git-branch", badge: cm.loading ? undefined : cm.classifications.length },
    { id: "category", label: tt("Category", "Kategori"), icon: "boxes", badge: cm.loading ? undefined : cm.categories.length },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Commodity", "Komoditas")}
        subtitle={tt(
          "Three-level vendor commodity taxonomy — category, classification, and sub-classification — used when vendors declare what they supply.",
          "Taksonomi komoditas vendor tiga tingkat — kategori, klasifikasi, dan sub-klasifikasi — untuk deklarasi barang/jasa vendor."
        )}
        compact
        right={<Badge tone="neutral" dot>MSTR_SUBCLASSIFICATION_T · KBLI · SPECIAL_REQ</Badge>} />

      <MasterDataTabsCard tabs={tabs} active={tab} onChange={setTab}>
        {tab === "subClassification" && <CommoditySubClassificationTab />}
        {tab === "classification" && <CommodityClassificationTab />}
        {tab === "category" && <CommodityCategoryTab />}
      </MasterDataTabsCard>
    </OpsPage>
  );
}

function CommodityCategoryTab() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const canManage = session.can("masterData.commodity.manage");
  const cm = useCommodityMaster();
  const painted = useTablePaintReady();
  const tableLoading = !!cm.loading || !painted;
  const ps = usePageSearch(tt("Search category id or description…", "Cari id atau deskripsi kategori…"));
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [ps.query, pageSize, sortKey, sortDir]);

  const sorted = React.useMemo(() => {
    if (tableLoading) return [];
    return [...cm.categories].sort((a, b) => {
    const cmp = sortKey === "id" ? a.CategoryId.localeCompare(b.CategoryId) : a.CategoryDesc.localeCompare(b.CategoryDesc);
    return sortDir === "asc" ? cmp : -cmp;
  });
  }, [tableLoading, cm.categories, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    const qq = ps.query.trim().toLowerCase();
    if (!qq) return sorted;
    return sorted.filter((r) => r.CategoryId.toLowerCase().includes(qq) || r.CategoryDesc.toLowerCase().includes(qq));
  }, [sorted, ps.query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!ps.query.trim();
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.CategoryId === r.CategoryId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("Id", "Id"), width: 80, render: (r) => <_CommodityIdChip>{r.CategoryId}</_CommodityIdChip> },
    { key: "desc", label: tt("Description", "Deskripsi"), render: (r) => <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.CategoryDesc}</span> },
    { key: "_a", label: "", align: "right", width: 56, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="pencil" label={tt("Edit", "Ubah")} onClick={() => setModal({ mode: "edit", row: r })} />
          <MenuDivider />
          <MenuItem icon="trash-2" label={tt("Delete", "Hapus")} danger onClick={() => setDel(r)} />
        </Menu>
      </div>
    ) },
  ];

  return (
  <>
    <CommodityTabToolbar ps={ps} searchPlaceholder={tt("Search category id or description…", "Cari id atau deskripsi kategori…")} hasFilter={hasFilter} onClear={() => ps.setQuery("")}
      sortKey={sortKey} sortDir={sortDir} onSortKey={() => setSortKey((k) => (k === "id" ? "desc" : "id"))} onSortDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
      sortLabel={sortKey === "id" ? tt("Id", "Id") : tt("Description", "Deskripsi")}
      sortDirLabel={sortDir === "asc" ? "A → Z" : "Z → A"}
      filtered={tableLoading ? 0 : filtered.length} total={tableLoading ? 0 : cm.categories.length} clearLabel={t("act.clear")}
      right={canManage ? <OpsHeroButton variant="primary" iconLeft="plus" disabled={tableLoading} onClick={() => setModal({ mode: "create", row: null })}>{tt("Add category", "Tambah kategori")}</OpsHeroButton> : null} />
    <Card pad={0}>
      <DataTable columns={canManage ? columns : columns.filter((c) => c.key !== "_a")} data={pageRows} dense rowKey="CategoryId" loading={tableLoading} onRowClick={tableLoading || !canManage ? undefined : (r) => setModal({ mode: "edit", row: r })}
        emptyTitle={hasFilter ? tt("No categories match", "Tidak ada kategori yang cocok") : tt("No categories yet", "Belum ada kategori")}
        emptyDesc={tt("Add a category to start the commodity taxonomy.", "Tambahkan kategori untuk memulai taksonomi komoditas.")} />
      <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
        <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </Card>
    <CommodityCategoryModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} onClose={() => setModal(null)}
      onSave={(form) => {
        const res = modal.mode === "edit" ? cm.updateCategory(form.CategoryId, form.CategoryDesc) : cm.addCategory(form.CategoryId, form.CategoryDesc);
        if (!res.ok) return res;
        session.record({ action: modal.mode === "edit" ? "Update" : "Create", module: "Commodity Category", desc: res.CategoryDesc, tone: modal.mode === "edit" ? "brand" : "success" });
        toast.push({ title: modal.mode === "edit" ? tt("Category updated", "Kategori diperbarui") : tt("Category added", "Kategori ditambahkan"), description: res.CategoryDesc });
        setModal(null);
        return res;
      }} />
    <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete category", "Hapus kategori")}
      footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={() => {
        const res = cm.removeCategory(del.CategoryId);
        if (!res.ok) { toast.push({ title: res.error, tone: "error" }); return; }
        session.record({ action: "Delete", module: "Commodity Category", desc: del.CategoryDesc, tone: "danger" });
        toast.push({ title: tt("Category deleted", "Kategori dihapus"), description: del.CategoryDesc, tone: "error" });
        setDel(null);
      }}>{tt("Delete", "Hapus")}</Button></>}>
      <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}><b>{del && del.CategoryId}</b> — {del && del.CategoryDesc}?</p>
    </Modal>
  </>
  );
}

function CommodityClassificationTab() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const canManage = session.can("masterData.commodity.manage");
  const cm = useCommodityMaster();
  const painted = useTablePaintReady();
  const tableLoading = !!cm.loading || !painted;
  const ps = usePageSearch(tt("Search classification…", "Cari klasifikasi…"));
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [ps.query, pageSize, sortKey, sortDir]);

  const sorted = React.useMemo(() => {
    if (tableLoading) return [];
    return [...cm.classifications].sort((a, b) => {
    const cmp = sortKey === "id" ? a.ClassificationId.localeCompare(b.ClassificationId, undefined, { numeric: true }) : a.ClassificationDesc.localeCompare(b.ClassificationDesc);
    return sortDir === "asc" ? cmp : -cmp;
  });
  }, [tableLoading, cm.classifications, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    const qq = ps.query.trim().toLowerCase();
    if (!qq) return sorted;
    return sorted.filter((r) => r.ClassificationId.toLowerCase().includes(qq) || r.ClassificationDesc.toLowerCase().includes(qq) || (cm.categoryMap[r.CategoryId] || "").toLowerCase().includes(qq));
  }, [sorted, ps.query, cm.categoryMap]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!ps.query.trim();
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.ClassificationId === r.ClassificationId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("Id", "Id"), width: 100, render: (r) => <_CommodityIdChip>{r.ClassificationId}</_CommodityIdChip> },
    { key: "desc", label: tt("Classification", "Klasifikasi"), render: (r) => <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.ClassificationDesc}</span> },
    { key: "cat", label: tt("Category", "Kategori"), width: 200, render: (r) => <span style={{ fontSize: 12.5, color: C.textSubtle }}>{cm.categoryMap[r.CategoryId] || r.CategoryId}</span> },
    { key: "_a", label: "", align: "right", width: 56, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="pencil" label={tt("Edit", "Ubah")} onClick={() => setModal({ mode: "edit", row: r })} />
          <MenuDivider />
          <MenuItem icon="trash-2" label={tt("Delete", "Hapus")} danger onClick={() => setDel(r)} />
        </Menu>
      </div>
    ) },
  ];

  return (
  <>
    <CommodityTabToolbar ps={ps} searchPlaceholder={tt("Search classification…", "Cari klasifikasi…")} hasFilter={hasFilter} onClear={() => ps.setQuery("")}
      sortKey={sortKey} sortDir={sortDir} onSortKey={() => setSortKey((k) => (k === "id" ? "desc" : "id"))} onSortDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
      sortLabel={sortKey === "id" ? tt("Id", "Id") : tt("Classification", "Klasifikasi")}
      sortDirLabel={sortKey === "id" ? (sortDir === "asc" ? "0 → 9" : "9 → 0") : (sortDir === "asc" ? "A → Z" : "Z → A")}
      filtered={tableLoading ? 0 : filtered.length} total={tableLoading ? 0 : cm.classifications.length} clearLabel={t("act.clear")}
      right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" size="sm" iconLeft="download" disabled={tableLoading || !filtered.length} onClick={() => {
          _downloadCommodityExcel(`Commodity-Classification-${_commodityExcelStamp()}.xlsx`, "Classification", filtered.map((r) => ({
            Id: r.ClassificationId,
            Classification: r.ClassificationDesc,
            CategoryId: r.CategoryId,
            Category: cm.categoryMap[r.CategoryId] || r.CategoryId,
          })));
          toast.push({ title: tt("Excel downloaded", "Excel diunduh"), description: tt(`${filtered.length} classification(s).`, `${filtered.length} klasifikasi.`) });
        }}>{tt("Download Excel", "Unduh Excel")}</Button>
        {canManage && <OpsHeroButton variant="primary" iconLeft="plus" disabled={tableLoading} onClick={() => setModal({ mode: "create", row: null })}>{tt("Add classification", "Tambah klasifikasi")}</OpsHeroButton>}
      </div>} />
    <Card pad={0}>
      <DataTable columns={canManage ? columns : columns.filter((c) => c.key !== "_a")} data={pageRows} dense rowKey="ClassificationId" loading={tableLoading} onRowClick={tableLoading || !canManage ? undefined : (r) => setModal({ mode: "edit", row: r })}
        emptyTitle={hasFilter ? tt("No classifications match", "Tidak ada klasifikasi yang cocok") : tt("No classifications yet", "Belum ada klasifikasi")}
        emptyDesc={tt("Add a classification under a category.", "Tambahkan klasifikasi di bawah kategori.")} />
      <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
        <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </Card>
    <CommodityClassificationModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} categories={cm.categories} onClose={() => setModal(null)}
      onSave={(form) => {
        const res = modal.mode === "edit"
          ? cm.updateClassification(form.ClassificationId, form.ClassificationDesc, form.CategoryId)
          : cm.addClassification(form.ClassificationId, form.ClassificationDesc, form.CategoryId);
        if (!res.ok) return res;
        session.record({ action: modal.mode === "edit" ? "Update" : "Create", module: "Commodity Classification", desc: res.ClassificationDesc, tone: modal.mode === "edit" ? "brand" : "success" });
        toast.push({ title: modal.mode === "edit" ? tt("Classification updated", "Klasifikasi diperbarui") : tt("Classification added", "Klasifikasi ditambahkan"), description: res.ClassificationDesc });
        setModal(null);
        return res;
      }} />
    <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete classification", "Hapus klasifikasi")}
      footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={() => {
        const res = cm.removeClassification(del.ClassificationId);
        if (!res.ok) { toast.push({ title: res.error, tone: "error" }); return; }
        session.record({ action: "Delete", module: "Commodity Classification", desc: del.ClassificationDesc, tone: "danger" });
        toast.push({ title: tt("Classification deleted", "Klasifikasi dihapus"), description: del.ClassificationDesc, tone: "error" });
        setDel(null);
      }}>{tt("Delete", "Hapus")}</Button></>}>
      <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}><b>{del && del.ClassificationId}</b> — {del && del.ClassificationDesc}?</p>
    </Modal>
  </>
  );
}

function _CommoditySpecMark({ on, title }) {
  const C = useC();
  return (
    <span
      aria-label={on ? "yes" : "no"}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: `1.75px solid ${on ? C.text : C.border}`,
        backgroundColor: on ? C.text : "transparent",
        boxSizing: "border-box",
      }}
    />
  );
}

function _CommodityBulletList({ items, mono }) {
  const C = useC();
  if (!items || !items.length) return <span style={{ color: C.textSubtle, fontSize: 12 }}>—</span>;
  return (
    <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: C.text, lineHeight: 1.5 }}>
      {items.map((x) => <li key={x} style={{ fontFamily: mono ? "monospace" : "inherit", fontWeight: mono ? 700 : 400 }}>{x}</li>)}
    </ul>
  );
}

function _CommodityKbliTagField({ value, onChange, kbliRows, tt, err, onErr, bare, placeholder }) {
  const C = useC();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const wrapRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const available = React.useMemo(() => kbliRows.filter((r) => !value.includes(r.KbliId)), [kbliRows, value]);

  const matches = React.useMemo(() => {
    const qq = query.trim().toLowerCase();
    const list = available;
    if (!qq) return list.slice(0, 12);
    return list.filter((r) => r.KbliId.includes(qq) || r.KbliDesc.toLowerCase().includes(qq)).slice(0, 12);
  }, [available, query]);

  React.useEffect(() => { setActiveIdx(0); }, [query, open]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const addKbli = (id) => {
    if (!id || value.includes(id)) return;
    onChange([...value, id].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    setQuery("");
    setOpen(false);
    onErr && onErr("");
  };

  const onInputKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActiveIdx((i) => Math.min(i + 1, Math.max(matches.length - 1, 0))); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && matches[activeIdx]) addKbli(matches[activeIdx].KbliId);
      else {
        const exact = available.find((r) => r.KbliId === query.replace(/\D/g, "").slice(0, 5));
        if (exact) addKbli(exact.KbliId);
        else if (query.trim()) onErr && onErr(tt("KBLI code not found in master.", "Kode KBLI tidak ada di master."));
      }
      return;
    }
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Backspace" && !query && value.length) onChange(value.slice(0, -1));
  };

  const kbliDesc = Object.fromEntries(kbliRows.map((r) => [r.KbliId, r.KbliDesc]));

  const control = (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div onClick={() => { inputRef.current && inputRef.current.focus(); setOpen(true); }}
        style={{ border: `1px solid ${err ? C.danger : open ? C.ocean : C.border}`, borderRadius: RADIUS.md, padding: "8px 10px", minHeight: 46, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", backgroundColor: C.inputBg, boxShadow: open ? `0 0 0 3px ${C.brandBg}` : "none", transition: "border-color 0.12s, box-shadow 0.12s" }}>
        {value.map((id) => (
          <span key={id} title={kbliDesc[id] || id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, backgroundColor: C.brandBg, color: C.ocean, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
            {id}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== id)); }} style={{ border: "none", background: "transparent", color: C.ocean, cursor: "pointer", padding: 0, display: "inline-flex" }} aria-label={tt("Remove", "Hapus")}>
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
        <input ref={inputRef} value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onErr && onErr(""); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKey}
          placeholder={value.length ? tt("Add another…", "Tambah lagi…") : (placeholder || tt("Search KBLI code or description…", "Cari kode atau deskripsi KBLI…"))}
          style={{ ...FONT, flex: 1, minWidth: 140, border: "none", outline: "none", background: "transparent", fontSize: 13, color: C.text, padding: "4px 2px" }} />
      </div>

      {open && matches.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 40, backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, boxShadow: C.shadowLg, maxHeight: 220, overflowY: "auto" }}>
          {matches.map((row, i) => (
            <button key={row.KbliId} type="button"
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => addKbli(row.KbliId)}
              style={{ ...FONT, display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left", padding: "9px 12px", border: "none", cursor: "pointer",
                backgroundColor: i === activeIdx ? C.hover : "transparent", borderBottom: i < matches.length - 1 ? `1px solid ${C.borderSoft}` : "none" }}>
              <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, minWidth: 48, flexShrink: 0 }}>{row.KbliId}</span>
              <span style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.4 }}>{row.KbliDesc}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && matches.length === 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 40, backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, boxShadow: C.shadowMd, padding: "12px 14px", fontSize: 12.5, color: C.textMuted }}>
          {tt("No matching KBLI in master data.", "Tidak ada KBLI yang cocok di master data.")}
        </div>
      )}
    </div>
  );

  if (bare) return control;
  return (
    <Field label={tt("KBLI", "KBLI")} helper={tt("Search by code or description, then pick from the list.", "Cari berdasarkan kode atau deskripsi, lalu pilih dari daftar.")}>
      {control}
    </Field>
  );
}

/* DNF rule builder: each group is an AND-list of KBLI codes; groups are OR'd.
   Example: [["27201","27202"],["29300"]] → (27201 AND 27202) OR 29300. */
function _CommodityKbliRuleBuilder({ groups, onChange, kbliRows, tt, err, onErr }) {
  const C = useC();
  const safeGroups = (groups && groups.length) ? groups : [[]];
  const preview = _kbliRulePreview(safeGroups, "AND", "OR");

  const setGroup = (idx, ids) => {
    const next = safeGroups.map((g, i) => (i === idx ? ids : g));
    onChange(next);
    onErr && onErr("");
  };
  const addGroup = () => { onChange([...safeGroups, []]); onErr && onErr(""); };
  const removeGroup = (idx) => {
    const next = safeGroups.filter((_, i) => i !== idx);
    onChange(next.length ? next : [[]]);
    onErr && onErr("");
  };

  return (
    <div style={{ border: `1px solid ${err ? C.danger : C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>{tt("KBLI requirement", "Ketentuan KBLI")}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tt("Codes in a group are AND; groups are OR.", "Kode dalam satu grup = AND; antar-grup = OR.")}</div>
        </div>
        <Button type="button" variant="secondary" size="sm" iconLeft="plus" onClick={addGroup}>{tt("Add OR group", "Tambah grup OR")}</Button>
      </div>
      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {safeGroups.map((group, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: C.borderSoft }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: C.ocean }}>OR</span>
                <div style={{ flex: 1, height: 1, backgroundColor: C.borderSoft }} />
              </div>
            )}
            <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, padding: "10px", backgroundColor: C.surface }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted }}>
                  {tt("Group", "Grup")} {idx + 1}
                  <span style={{ fontWeight: 500, marginLeft: 6, color: C.textSubtle }}>({tt("AND", "AND")})</span>
                </span>
                {safeGroups.length > 1 && (
                  <button type="button" onClick={() => removeGroup(idx)} style={{ border: "none", background: "transparent", color: C.textMuted, cursor: "pointer", padding: 2, display: "inline-flex" }} aria-label={tt("Remove group", "Hapus grup")}>
                    <Icon name="trash-2" size={14} />
                  </button>
                )}
              </div>
              <_CommodityKbliTagField bare value={group} onChange={(ids) => setGroup(idx, ids)} kbliRows={kbliRows} tt={tt} err={err} onErr={onErr}
                placeholder={tt("Add KBLI to this AND group…", "Tambah KBLI ke grup AND ini…")} />
            </div>
          </React.Fragment>
        ))}
        {preview && (
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "monospace", padding: "8px 10px", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.sm, border: `1px dashed ${C.borderSoft}` }}>
            <span style={{ fontWeight: 700, color: C.textSubtle, marginRight: 6 }}>{tt("Rule", "Aturan")}:</span>
            {preview}
          </div>
        )}
      </div>
    </div>
  );
}

function CommoditySubClassificationTab() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const canManage = session.can("masterData.commodity.manage");
  const cm = useCommodityMaster();
  const painted = useTablePaintReady();
  const tableLoading = !!cm.loading || !painted;
  const sm = useSpecialReqMaster();
  const km = useKbliMaster();
  const ps = usePageSearch(tt("Search sub-classification…", "Cari sub-klasifikasi…"));
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  const activeSpecialReqs = React.useMemo(() => [...sm.rows]
    .filter((r) => r.SpecialReqIsActive)
    .sort((a, b) => (a.SpecialReqOrder - b.SpecialReqOrder) || a.SpecialReqId.localeCompare(b.SpecialReqId)), [sm.rows]);

  const kbliDescMap = React.useMemo(() => {
    if (tableLoading) return {};
    return Object.fromEntries(km.rows.map((r) => [r.KbliId, r.KbliDesc]));
  }, [tableLoading, km.rows]);

  React.useEffect(() => { setPage(1); }, [ps.query, pageSize, sortKey, sortDir]);

  const specIds = React.useMemo(() => activeSpecialReqs.map((r) => r.SpecialReqId), [activeSpecialReqs]);

  // Pivot special-req / KBLI / parent labels once per data snapshot. The old path
  // re-walked junctions and rebuilt column renderers on every search keystroke.
  const displayRows = React.useMemo(() => {
    if (tableLoading) return [];
    const { categoryMap, classificationMap, classificationById, specialReqBySubId, kbliGroupsBySubId, kbliBySubId } = cm;
    const rows = cm.subClassifications.map((r) => {
      const cls = classificationById[r.ClassificationId];
      const reqSet = specialReqBySubId[r.SubClassificationId];
      const _sr = {};
      specIds.forEach((id) => { _sr[id] = !!(reqSet && reqSet.has(id)); });
      const kbliIds = kbliBySubId[r.SubClassificationId] || [];
      return {
        ...r,
        _sr,
        _cls: classificationMap[r.ClassificationId] || r.ClassificationId || "",
        _cat: cls ? (categoryMap[cls.CategoryId] || cls.CategoryId || "") : "",
        _kbliPreview: _kbliRulePreview(kbliGroupsBySubId[r.SubClassificationId] || [], "AND", "OR"),
        _kbliSearch: kbliIds.map((id) => `${id} ${kbliDescMap[id] || ""}`).join(" "),
      };
    });
    return rows.sort((a, b) => {
      const cmp = sortKey === "id"
        ? a.SubClassificationId.localeCompare(b.SubClassificationId, undefined, { numeric: true })
        : a.SubClassificationDesc.localeCompare(b.SubClassificationDesc);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tableLoading, cm.subClassifications, cm.subClassificationSpecialReq, cm.subClassificationKbliRule, cm.categoryMap, cm.classificationMap, cm.classificationById, cm.specialReqBySubId, cm.kbliGroupsBySubId, cm.kbliBySubId, specIds, kbliDescMap, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    const qq = ps.query.trim().toLowerCase();
    const source = !qq ? displayRows : displayRows.filter((r) => {
      const specHit = specIds.some((id) => String(id || "").toLowerCase().includes(qq) && r._sr?.[id]);
      return r.SubClassificationId.toLowerCase().includes(qq)
        || r.SubClassificationDesc.toLowerCase().includes(qq)
        || (r._cls || "").toLowerCase().includes(qq)
        || (r._cat || "").toLowerCase().includes(qq)
        || (r._kbliSearch || "").toLowerCase().includes(qq)
        || specHit;
    });
    return source.map((r, i) => ({ ...r, _idx: i + 1 }));
  }, [displayRows, ps.query, specIds]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!ps.query.trim();
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const columns = React.useMemo(() => {
    const base = [
      { key: "idx", label: "#", width: 56, render: (r) => (
        <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{r._idx}</span>
      ) },
      { key: "id", label: tt("Id", "Id"), width: 108, render: (r) => <_CommodityIdChip width={100}>{r.SubClassificationId}</_CommodityIdChip> },
      { key: "desc", label: tt("Sub-classification", "Sub-klasifikasi"), width: 200, render: (r) => <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.SubClassificationDesc}</span> },
      { key: "cls", label: tt("Classification", "Klasifikasi"), width: 180, render: (r) => <span style={{ fontSize: 12.5, color: C.textSubtle }}>{r._cls || r.ClassificationId}</span> },
      { key: "cat", label: tt("Category", "Kategori"), width: 150, render: (r) => <span style={{ fontSize: 12.5, color: C.textSubtle }}>{r._cat || "—"}</span> },
      { key: "kbliId", label: tt("KBLI rule", "Aturan KBLI"), width: 280, render: (r) => {
        if (!r._kbliPreview) return <span style={{ color: C.textSubtle, fontSize: 12 }}>—</span>;
        return <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.45 }}>{r._kbliPreview}</span>;
      } },
    ];
    const specCols = activeSpecialReqs.map((req) => ({
      key: `sr_${req.SpecialReqId}`,
      label: <span title={req.SpecialReqDesc || req.SpecialReqId}>{req.SpecialReqId}</span>,
      width: 72,
      align: "center",
      render: (r) => <_CommoditySpecMark on={!!(r._sr && r._sr[req.SpecialReqId])} title={req.SpecialReqDesc || req.SpecialReqId} />,
    }));
    const tail = [
      { key: "_a", label: "", align: "right", width: 56, render: (r) => (
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
          <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
            <MenuItem icon="pencil" label={tt("Edit", "Ubah")} onClick={() => setModal({ mode: "edit", row: r })} />
            <MenuDivider />
            <MenuItem icon="trash-2" label={tt("Delete", "Hapus")} danger onClick={() => setDel(r)} />
          </Menu>
        </div>
      ) },
    ];
    return [...base, ...specCols, ...tail];
  }, [C, tt, activeSpecialReqs]);

  return (
  <>
    <CommodityTabToolbar ps={ps} searchPlaceholder={tt("Search sub-classification, KBLI, classification…", "Cari sub-klasifikasi, KBLI, klasifikasi…")} hasFilter={hasFilter} onClear={() => ps.setQuery("")}
      sortKey={sortKey} sortDir={sortDir} onSortKey={() => setSortKey((k) => (k === "id" ? "desc" : "id"))} onSortDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
      sortLabel={sortKey === "id" ? tt("Id", "Id") : tt("Sub-classification", "Sub-klasifikasi")}
      sortDirLabel={sortKey === "id" ? (sortDir === "asc" ? "0 → 9" : "9 → 0") : (sortDir === "asc" ? "A → Z" : "Z → A")}
      filtered={tableLoading ? 0 : filtered.length} total={tableLoading ? 0 : cm.subClassifications.length} clearLabel={t("act.clear")}
      right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" size="sm" iconLeft="download" disabled={tableLoading || !filtered.length} onClick={() => {
          const specHeaders = activeSpecialReqs.map((req) => req.SpecialReqId);
          _downloadCommodityExcel(`Commodity-SubClassification-${_commodityExcelStamp()}.xlsx`, "Sub-classification", filtered.map((r) => {
            const row = {
              Id: r.SubClassificationId || "",
              SubClassification: r.SubClassificationDesc || "",
              ClassificationId: r.ClassificationId || "",
              Classification: r._cls || "",
              Category: r._cat || "",
              KbliRule: r._kbliPreview || "",
            };
            specHeaders.forEach((id) => { row[id] = r._sr?.[id] ? "Yes" : ""; });
            return row;
          }));
          toast.push({ title: tt("Excel downloaded", "Excel diunduh"), description: tt(`${filtered.length} sub-classification(s).`, `${filtered.length} sub-klasifikasi.`) });
        }}>{tt("Download Excel", "Unduh Excel")}</Button>
        {canManage && <OpsHeroButton variant="primary" iconLeft="plus" disabled={tableLoading} onClick={() => setModal({ mode: "create", row: null })}>{tt("Add sub-classification", "Tambah sub-klasifikasi")}</OpsHeroButton>}
      </div>} />
    <Card pad={0}>
      <DataTable columns={canManage ? columns : columns.filter((c) => c.key !== "_a")} data={pageRows} dense rowKey="SubClassificationId" loading={tableLoading} onRowClick={tableLoading || !canManage ? undefined : (r) => setModal({ mode: "edit", row: r })}
        emptyTitle={hasFilter ? tt("No sub-classifications match", "Tidak ada sub-klasifikasi yang cocok") : tt("No sub-classifications yet", "Belum ada sub-klasifikasi")}
        emptyDesc={tt("Add a sub-classification with KBLI codes and special requirements.", "Tambahkan sub-klasifikasi beserta kode KBLI dan persyaratan khusus.")} />
      <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
        <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </Card>
    <CommoditySubClassificationModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row}
      categories={cm.categories} classifications={cm.classifications}
      kbliRows={km.rows} specialReqRows={sm.rows}
      getKbliRule={(id) => cm.getSubKbliRule(id)} getSpecialReqIds={(id) => cm.getSubSpecialReqIds(id)}
      onClose={() => setModal(null)}
      onSave={(form) => {
        const res = modal.mode === "edit"
          ? cm.updateSubClassification(form.SubClassificationId, form.SubClassificationDesc, form.ClassificationId, form.KbliGroups, form.SpecialReqIds)
          : cm.addSubClassification(form.SubClassificationId, form.SubClassificationDesc, form.ClassificationId, form.KbliGroups, form.SpecialReqIds);
        if (!res.ok) return res;
        session.record({ action: modal.mode === "edit" ? "Update" : "Create", module: "Commodity Sub-classification", desc: res.SubClassificationDesc, tone: modal.mode === "edit" ? "brand" : "success" });
        toast.push({ title: modal.mode === "edit" ? tt("Sub-classification updated", "Sub-klasifikasi diperbarui") : tt("Sub-classification added", "Sub-klasifikasi ditambahkan"), description: res.SubClassificationDesc });
        setModal(null);
        return res;
      }} />
    <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete sub-classification", "Hapus sub-klasifikasi")}
      footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={() => {
        cm.removeSubClassification(del.SubClassificationId);
        session.record({ action: "Delete", module: "Commodity Sub-classification", desc: del.SubClassificationDesc, tone: "danger" });
        toast.push({ title: tt("Sub-classification deleted", "Sub-klasifikasi dihapus"), description: del.SubClassificationDesc, tone: "error" });
        setDel(null);
      }}>{tt("Delete", "Hapus")}</Button></>}>
      <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}><b>{del && del.SubClassificationId}</b> — {del && del.SubClassificationDesc}?</p>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: "10px 0 0" }}>{tt("Linked KBLI codes and special requirements are removed with this record.", "Kode KBLI dan persyaratan khusus yang terhubung ikut dihapus.")}</p>
    </Modal>
  </>
  );
}

function CommodityTabToolbar({ ps, searchPlaceholder, hasFilter, onClear, sortKey, sortDir, onSortKey, onSortDir, sortLabel, sortDirLabel, filtered, total, clearLabel, leftExtra, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      <Toolbar style={{ margin: 0, flex: 1 }} left={<>
        <div ref={ps.ref} style={{ width: 240 }}>
          <TextInput iconLeft="search" placeholder={searchPlaceholder} value={ps.query} onChange={(e) => ps.setQuery(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
        </div>
        {leftExtra}
        <Button variant={sortKey === "id" ? "secondary" : "ghost"} size="sm" iconLeft="hash" onClick={onSortKey}>{sortLabel}</Button>
        <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm" iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"} onClick={onSortDir}>{sortDirLabel}</Button>
        {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={onClear}>{clearLabel}</Button>}
      </>} right={<>
        <Badge tone="neutral">{filtered} / {total}</Badge>
        {right}
      </>} />
    </div>
  );
}

function CommodityCategoryModal({ open, mode, row, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ CategoryId: "", CategoryDesc: "" });
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    if (open) { setForm(row ? { CategoryId: row.CategoryId, CategoryDesc: row.CategoryDesc } : { CategoryId: "", CategoryDesc: "" }); setErr(""); }
  }, [open, row]);
  const submit = () => { const res = onSave({ CategoryId: isEdit ? row.CategoryId : form.CategoryId.trim().slice(0, CATEGORY_ID_MAX), CategoryDesc: form.CategoryDesc.trim().slice(0, CATEGORY_DESC_MAX) }); if (res && !res.ok) setErr(res.error); };
  return (
    <Modal open={open} onClose={onClose} width={480} icon="boxes" title={isEdit ? tt("Edit category", "Ubah kategori") : tt("Add category", "Tambah kategori")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add category", "Tambah kategori")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Id", "Id")} required><TextInput value={form.CategoryId} disabled={isEdit} onChange={(e) => { setForm((f) => ({ ...f, CategoryId: e.target.value.slice(0, CATEGORY_ID_MAX) })); setErr(""); }} placeholder="M" /></Field>
        <Field label={tt("Description", "Deskripsi")} required><TextInput value={form.CategoryDesc} onChange={(e) => { setForm((f) => ({ ...f, CategoryDesc: e.target.value.slice(0, CATEGORY_DESC_MAX) })); setErr(""); }} placeholder="Material - Barang" /></Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

function CommodityClassificationModal({ open, mode, row, categories, onClose, onSave }) {
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ ClassificationId: "", ClassificationDesc: "", CategoryId: "" });
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    if (open) setForm(row ? { ClassificationId: row.ClassificationId, ClassificationDesc: row.ClassificationDesc, CategoryId: row.CategoryId } : { ClassificationId: "", ClassificationDesc: "", CategoryId: categories[0] ? categories[0].CategoryId : "" });
    setErr("");
  }, [open, row, categories]);
  const catOptions = categories.map((c) => ({ value: c.CategoryId, label: `${c.CategoryId} — ${c.CategoryDesc}` }));
  const submit = () => { const res = onSave({ ClassificationId: isEdit ? row.ClassificationId : form.ClassificationId.trim().slice(0, CLASSIFICATION_ID_MAX), ClassificationDesc: form.ClassificationDesc.trim().slice(0, CLASSIFICATION_DESC_MAX), CategoryId: form.CategoryId }); if (res && !res.ok) setErr(res.error); };
  return (
    <Modal open={open} onClose={onClose} width={520} icon="git-branch" title={isEdit ? tt("Edit classification", "Ubah klasifikasi") : tt("Add classification", "Tambah klasifikasi")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add classification", "Tambah klasifikasi")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Id", "Id")} required><TextInput value={form.ClassificationId} disabled={isEdit} onChange={(e) => { setForm((f) => ({ ...f, ClassificationId: e.target.value.slice(0, CLASSIFICATION_ID_MAX) })); setErr(""); }} placeholder="M.01" /></Field>
        <Field label={tt("Classification", "Klasifikasi")} required><TextInput value={form.ClassificationDesc} onChange={(e) => { setForm((f) => ({ ...f, ClassificationDesc: e.target.value.slice(0, CLASSIFICATION_DESC_MAX) })); setErr(""); }} placeholder="Spareparts" /></Field>
        <Field label={tt("Category", "Kategori")} required><Select value={form.CategoryId} onChange={(e) => setForm((f) => ({ ...f, CategoryId: e.target.value }))} options={catOptions} /></Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

function CommoditySubClassificationModal({ open, mode, row, categories, classifications, kbliRows, specialReqRows, getKbliRule, getSpecialReqIds, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ SubClassificationId: "", SubClassificationDesc: "", CategoryId: "", ClassificationId: "", KbliGroups: [[]], SpecialReqIds: [] });
  const [err, setErr] = React.useState("");
  const [kbliErr, setKbliErr] = React.useState("");

  const activeSpecialReqs = React.useMemo(() => [...specialReqRows]
    .filter((r) => r.SpecialReqIsActive)
    .sort((a, b) => (a.SpecialReqOrder - b.SpecialReqOrder) || a.SpecialReqId.localeCompare(b.SpecialReqId)), [specialReqRows]);

  const clsForCategory = React.useMemo(() => classifications.filter((c) => c.CategoryId === form.CategoryId), [classifications, form.CategoryId]);
  const catOptions = categories.map((c) => ({ value: c.CategoryId, label: `${c.CategoryId} — ${c.CategoryDesc}` }));
  const clsOptions = clsForCategory.map((c) => ({ value: c.ClassificationId, label: `${c.ClassificationId} — ${c.ClassificationDesc}` }));

  React.useEffect(() => {
    if (!open) return;
    if (row) {
      const cls = classifications.find((c) => c.ClassificationId === row.ClassificationId);
      const rule = getKbliRule(row.SubClassificationId);
      setForm({
        SubClassificationId: row.SubClassificationId,
        SubClassificationDesc: row.SubClassificationDesc,
        CategoryId: cls ? cls.CategoryId : (categories[0] ? categories[0].CategoryId : ""),
        ClassificationId: row.ClassificationId,
        KbliGroups: (rule && rule.length) ? rule : [[]],
        SpecialReqIds: getSpecialReqIds(row.SubClassificationId),
      });
    } else {
      const firstCat = categories[0] ? categories[0].CategoryId : "";
      const firstCls = classifications.find((c) => c.CategoryId === firstCat);
      setForm({
        SubClassificationId: "",
        SubClassificationDesc: "",
        CategoryId: firstCat,
        ClassificationId: firstCls ? firstCls.ClassificationId : "",
        KbliGroups: [[]],
        SpecialReqIds: [],
      });
    }
    setErr("");
    setKbliErr("");
  }, [open, row, categories, classifications, getKbliRule, getSpecialReqIds]);

  const setCategory = (CategoryId) => {
    const nextCls = classifications.find((c) => c.CategoryId === CategoryId);
    setForm((f) => ({ ...f, CategoryId, ClassificationId: nextCls ? nextCls.ClassificationId : "" }));
    setErr("");
  };

  const toggleSpecialReq = (id, on) => {
    setForm((f) => ({
      ...f,
      SpecialReqIds: on ? [...f.SpecialReqIds, id] : f.SpecialReqIds.filter((x) => x !== id),
    }));
  };

  const submit = () => {
    const res = onSave({
      SubClassificationId: isEdit ? row.SubClassificationId : form.SubClassificationId.trim().slice(0, SUBCLASSIFICATION_ID_MAX),
      SubClassificationDesc: form.SubClassificationDesc.trim().slice(0, SUBCLASSIFICATION_DESC_MAX),
      ClassificationId: form.ClassificationId,
      KbliGroups: form.KbliGroups,
      SpecialReqIds: form.SpecialReqIds,
    });
    if (res && !res.ok) setErr(res.error);
  };

  return (
    <Modal open={open} onClose={onClose} width={680} icon="list-tree"
      title={isEdit ? tt("Edit sub-classification", "Ubah sub-klasifikasi") : tt("Add sub-classification", "Tambah sub-klasifikasi")}
      subtitle={isEdit ? row && row.SubClassificationId : tt("Saves to sub-classification, KBLI rule, and special requirement tables.", "Menyimpan ke tabel sub-klasifikasi, aturan KBLI, dan persyaratan khusus.")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{tt("Save", "Simpan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.34fr) minmax(0, 0.66fr)", gap: 14 }}>
          <Field label={tt("Id", "Id")} required>
            <TextInput value={form.SubClassificationId} disabled={isEdit}
              onChange={(e) => { setForm((f) => ({ ...f, SubClassificationId: e.target.value.slice(0, SUBCLASSIFICATION_ID_MAX) })); setErr(""); }}
              placeholder="M.01.01" />
          </Field>
          <Field label={tt("Description", "Deskripsi")} required>
            <TextInput value={form.SubClassificationDesc}
              onChange={(e) => { setForm((f) => ({ ...f, SubClassificationDesc: e.target.value.slice(0, SUBCLASSIFICATION_DESC_MAX) })); setErr(""); }}
              placeholder="Battery / Accumulator" />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={tt("Category", "Kategori")} required>
            <Select value={form.CategoryId} onChange={(e) => setCategory(e.target.value)} options={catOptions} />
          </Field>
          <Field label={tt("Classification", "Klasifikasi")} required>
            <Select value={form.ClassificationId} onChange={(e) => { setForm((f) => ({ ...f, ClassificationId: e.target.value })); setErr(""); }}
              options={clsOptions.length ? clsOptions : [{ value: "", label: tt("No classification in this category", "Tidak ada klasifikasi di kategori ini") }]} />
          </Field>
        </div>

        <_CommodityKbliRuleBuilder groups={form.KbliGroups} onChange={(KbliGroups) => setForm((f) => ({ ...f, KbliGroups }))} kbliRows={kbliRows} tt={tt} err={kbliErr} onErr={setKbliErr} />

        <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.borderSoft}`, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>
            {tt("Special requirement", "Persyaratan khusus")}
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "6px 12px 10px" }}>
            {activeSpecialReqs.length === 0
              ? <p style={{ fontSize: 12.5, color: C.textMuted, margin: "10px 0" }}>{tt("No active special requirements in master data.", "Tidak ada persyaratan khusus aktif di master data.")}</p>
              : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  {activeSpecialReqs.map((req) => {
                    const checked = form.SpecialReqIds.includes(req.SpecialReqId);
                    return (
                      <label key={req.SpecialReqId} title={req.SpecialReqDesc} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", cursor: "pointer", minWidth: 0 }}>
                        <span style={{ paddingTop: 1, flexShrink: 0 }}><Checkbox checked={checked} onChange={(on) => toggleSpecialReq(req.SpecialReqId, on)} /></span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{req.SpecialReqId}</span>
                          <span style={{ display: "block", fontSize: 11.5, color: C.textMuted, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.SpecialReqDesc}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
          </div>
        </div>

        {(err || kbliErr) && <Alert tone="danger">{err || kbliErr}</Alert>}
      </div>
    </Modal>
  );
}

Object.assign(window, { CommodityMasterData, CommodityCategoryModal, CommodityClassificationModal, CommoditySubClassificationModal });
export { CommodityMasterData, CommodityCategoryModal, CommodityClassificationModal, CommoditySubClassificationModal };
