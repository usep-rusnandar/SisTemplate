/* fm3-converted */
import React from "react";
import { SPECIAL_REQ_DESC_MAX, SPECIAL_REQ_ID_MAX, useSpecialReqMaster } from "./SpecialReqMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, IconButton, Select, TextInput, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Special Requirement.
   Source table: MSTR_SPECIAL_REQUIREMENT_T. */

function SpecialRequirementMasterData() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const sm = useSpecialReqMaster();

  const ps = usePageSearch(tt("Search id or description…", "Cari id atau deskripsi…"));
  const q = ps.query;
  const setQ = ps.setQuery;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("order");
  const [sortDir, setSortDir] = React.useState("asc");
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [q, pageSize, sortKey, sortDir, activeFilter]);

  const sorted = React.useMemo(() => {
    return [...sm.rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "order") cmp = a.SpecialReqOrder - b.SpecialReqOrder || a.SpecialReqId.localeCompare(b.SpecialReqId);
      else if (sortKey === "id") cmp = a.SpecialReqId.localeCompare(b.SpecialReqId);
      else cmp = a.SpecialReqDesc.localeCompare(b.SpecialReqDesc);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sm.rows, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    let list = sorted;
    if (activeFilter === "active") list = list.filter((r) => r.SpecialReqIsActive);
    else if (activeFilter === "inactive") list = list.filter((r) => !r.SpecialReqIsActive);
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((r) => r.SpecialReqId.toLowerCase().includes(qq) || r.SpecialReqDesc.toLowerCase().includes(qq));
  }, [sorted, q, activeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim() || activeFilter !== "all";
  const activeCount = React.useMemo(() => sm.rows.filter((r) => r.SpecialReqIsActive).length, [sm.rows]);

  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const saveRow = (form) => {
    const res = modal.mode === "edit"
      ? sm.updateSpecialReq(form.SpecialReqId, form.SpecialReqDesc, form.SpecialReqIsActive, form.SpecialReqOrder)
      : sm.addSpecialReq(form.SpecialReqId, form.SpecialReqDesc, form.SpecialReqIsActive, form.SpecialReqOrder);
    if (!res.ok) return res;
    session.record({
      action: modal.mode === "edit" ? "Update" : "Create",
      module: "Special Requirement",
      desc: `${modal.mode === "edit" ? "Updated" : "Added"} ${res.SpecialReqId}`,
      tone: modal.mode === "edit" ? "brand" : "success",
    });
    toast.push({
      title: modal.mode === "edit" ? tt("Special requirement updated", "Persyaratan khusus diperbarui") : tt("Special requirement added", "Persyaratan khusus ditambahkan"),
      description: res.SpecialReqDesc,
    });
    setModal(null);
    return res;
  };

  const confirmDelete = () => {
    sm.removeSpecialReq(del.SpecialReqId);
    session.record({ action: "Delete", module: "Special Requirement", desc: `Deleted ${del.SpecialReqId}`, tone: "danger" });
    toast.push({ title: tt("Special requirement deleted", "Persyaratan khusus dihapus"), description: del.SpecialReqDesc, tone: "error" });
    setDel(null);
  };

  const sortLabel = sortKey === "order" ? tt("Display order", "Urutan tampil")
    : sortKey === "id" ? tt("Requirement Id", "Id Persyaratan")
    : tt("Description", "Deskripsi");

  const sortDirLabel = sortKey === "order"
    ? (sortDir === "asc" ? "0 → 9" : "9 → 0")
    : sortKey === "id"
    ? (sortDir === "asc" ? "A → Z" : "Z → A")
    : (sortDir === "asc" ? "A → Z" : "Z → A");

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.SpecialReqId === r.SpecialReqId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "order", label: tt("Order", "Urutan"), width: 72, align: "center", render: (r) => (
      <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.textSubtle }}>{r.SpecialReqOrder}</span>
    ) },
    { key: "id", label: tt("Requirement Id", "Id Persyaratan"), width: 120, render: (r) => (
      <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg, padding: "3px 8px", borderRadius: 6 }}>{r.SpecialReqId}</span>
    ) },
    { key: "desc", label: tt("Description", "Deskripsi"), render: (r) => (
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.45 }}>{r.SpecialReqDesc}</span>
    ) },
    { key: "active", label: tt("Status", "Status"), width: 100, render: (r) => (
      <Badge tone={r.SpecialReqIsActive ? "success" : "neutral"} dot>{r.SpecialReqIsActive ? tt("Active", "Aktif") : tt("Inactive", "Nonaktif")}</Badge>
    ) },
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

  const activeOptions = [
    { value: "all", label: tt("All status", "Semua status") },
    { value: "active", label: tt("Active only", "Aktif saja") },
    { value: "inactive", label: tt("Inactive only", "Nonaktif saja") },
  ];

  const cycleSortKey = () => setSortKey((k) => (k === "order" ? "id" : k === "id" ? "desc" : "order"));

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Special Requirement", "Persyaratan Khusus")}
        subtitle={tt(
          "Optional vendor compliance flags shown during registration and profile updates — licenses, certificates, and safety documents.",
          "Opsi persyaratan kepatuhan vendor saat registrasi dan pembaruan profil — izin, sertifikat, dan dokumen keselamatan."
        )}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>MSTR_SPECIAL_REQUIREMENT_T</Badge>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", row: null })}>{tt("Add requirement", "Tambah persyaratan")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="clipboard-check" label={tt("Total requirements", "Total persyaratan")} value={sm.rows.length} iconTone="brand" />
        <OpsStatCard icon="badge-check" label={tt("Active", "Aktif")} value={activeCount} iconTone="forest" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching filter", "Cocok filter") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }} left={<>
            <div ref={ps.ref} style={{ width: 240 }}>
              <TextInput iconLeft="search" placeholder={tt("Search id or description…", "Cari id atau deskripsi…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
            </div>
            <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} options={activeOptions} style={{ minWidth: 160 }} />
            <Button variant={sortKey !== "desc" ? "secondary" : "ghost"} size="sm" iconLeft="list-ordered" onClick={cycleSortKey}>{sortLabel}</Button>
            <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm" iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"} onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>{sortDirLabel}</Button>
            {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setActiveFilter("all"); }}>{t("act.clear")}</Button>}
          </>} right={<Badge tone="neutral">{filtered.length} {tt("of", "dari")} {sm.rows.length}</Badge>} />
        </div>
        <DataTable columns={columns} data={pageRows} dense rowKey="SpecialReqId" onRowClick={(r) => setModal({ mode: "edit", row: r })}
          emptyTitle={hasFilter ? tt("No requirements match your filter", "Tidak ada persyaratan yang cocok") : tt("No special requirements yet", "Belum ada persyaratan khusus")}
          emptyDesc={hasFilter ? tt("Try a different keyword or clear filters.", "Coba kata kunci lain atau bersihkan filter.") : tt("Add the first requirement to start the catalog.", "Tambahkan persyaratan pertama.")} />
        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>
      <SpecialReqModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} onClose={() => setModal(null)} onSave={saveRow} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete special requirement", "Hapus persyaratan khusus")} subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}>{tt("Remove requirement", "Hapus persyaratan")} <b>{del && del.SpecialReqId}</b> — {del && del.SpecialReqDesc}?</p>
      </Modal>
    </OpsPage>
  );
}

function SpecialReqModal({ open, mode, row, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ SpecialReqId: "", SpecialReqDesc: "", SpecialReqIsActive: true, SpecialReqOrder: 0 });
  const [err, setErr] = React.useState("");
  const idRef = React.useRef(null);
  const descRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setForm(row
        ? { SpecialReqId: row.SpecialReqId, SpecialReqDesc: row.SpecialReqDesc, SpecialReqIsActive: !!row.SpecialReqIsActive, SpecialReqOrder: row.SpecialReqOrder ?? 0 }
        : { SpecialReqId: "", SpecialReqDesc: "", SpecialReqIsActive: true, SpecialReqOrder: 0 });
      setErr("");
      setTimeout(() => (isEdit ? descRef.current : idRef.current) && (isEdit ? descRef.current : idRef.current).focus(), 0);
    }
  }, [open, row, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    const res = onSave({
      SpecialReqId: isEdit ? row.SpecialReqId : String(form.SpecialReqId).trim().slice(0, SPECIAL_REQ_ID_MAX),
      SpecialReqDesc: String(form.SpecialReqDesc).trim().slice(0, SPECIAL_REQ_DESC_MAX),
      SpecialReqIsActive: !!form.SpecialReqIsActive,
      SpecialReqOrder: parseInt(String(form.SpecialReqOrder), 10) || 0,
    });
    if (res && !res.ok) setErr(res.error);
  };

  const idLeft = SPECIAL_REQ_ID_MAX - (form.SpecialReqId || "").length;
  const descLeft = SPECIAL_REQ_DESC_MAX - (form.SpecialReqDesc || "").length;

  return (
    <Modal open={open} onClose={onClose} width={520} icon="clipboard-check"
      title={isEdit ? tt("Edit special requirement", "Ubah persyaratan khusus") : tt("Add special requirement", "Tambah persyaratan khusus")}
      subtitle={isEdit ? tt("Update description, display order, or active status.", "Perbarui deskripsi, urutan tampil, atau status aktif.") : tt("Define a compliance option vendors can declare during onboarding.", "Tentukan opsi kepatuhan yang dapat dinyatakan vendor saat onboarding.")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add requirement", "Tambah persyaratan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Requirement Id", "Id Persyaratan")} required helper={isEdit ? tt("Primary key — cannot be changed", "Kunci utama — tidak dapat diubah") : tt("Short code, max 10 characters", "Kode singkat, maks. 10 karakter")}>
          <TextInput inputRef={idRef} value={form.SpecialReqId} disabled={isEdit} onChange={(e) => { set("SpecialReqId", e.target.value.slice(0, SPECIAL_REQ_ID_MAX)); setErr(""); }} placeholder="IUJP" />
          {!isEdit && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 11.5, color: idLeft < 2 ? C.orange : C.textSubtle, fontVariantNumeric: "tabular-nums" }}>{idLeft} {tt("characters left", "karakter tersisa")}</div>}
        </Field>
        <Field label={tt("Description", "Deskripsi")} required>
          <TextInput inputRef={descRef} value={form.SpecialReqDesc} onChange={(e) => { set("SpecialReqDesc", e.target.value.slice(0, SPECIAL_REQ_DESC_MAX)); setErr(""); }} placeholder={tt("e.g. Izin Usaha Jasa Pertambangan", "cth. Izin Usaha Jasa Pertambangan")} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 11.5, color: descLeft < 15 ? C.orange : C.textSubtle, fontVariantNumeric: "tabular-nums" }}>{descLeft} {tt("characters left", "karakter tersisa")}</div>
        </Field>
        <Field label={tt("Display order", "Urutan tampil")} helper={tt("Lower numbers appear first in vendor forms", "Angka lebih kecil tampil lebih dulu di formulir vendor")}>
          <TextInput type="number" value={String(form.SpecialReqOrder)} onChange={(e) => set("SpecialReqOrder", e.target.value)} placeholder="0" />
        </Field>
        <Field label={tt("Active", "Aktif")}>
          <Toggle checked={form.SpecialReqIsActive} onChange={(v) => set("SpecialReqIsActive", v)} label={form.SpecialReqIsActive ? tt("Visible to vendors", "Tampil untuk vendor") : tt("Hidden from vendors", "Disembunyikan dari vendor")} />
        </Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

Object.assign(window, { SpecialRequirementMasterData, SpecialReqModal });
export { SpecialRequirementMasterData, SpecialReqModal };
