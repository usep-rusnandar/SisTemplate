/* fm3-converted */
import React from "react";
import { PROVINCE_ID_MAX, PROVINCE_NAME_MAX, useProvinceMaster } from "./ProvinceMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, IconButton, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Province Master Data.
   Source table: MSTR_PROVINCE_T (ProvinceId varchar(2) PK, ProvinceName varchar(50)). */

function ProvinceMasterData() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const pm = useProvinceMaster();

  const ps = usePageSearch(tt("Search province id or name…", "Cari id atau nama provinsi…"));
  const q = ps.query;
  const setQ = ps.setQuery;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [q, pageSize, sortKey, sortDir]);

  const sorted = React.useMemo(() => {
    return [...pm.rows].sort((a, b) => {
      const cmp = sortKey === "id"
        ? a.ProvinceId.localeCompare(b.ProvinceId, undefined, { numeric: true })
        : a.ProvinceName.localeCompare(b.ProvinceName);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [pm.rows, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return sorted;
    return sorted.filter((r) => r.ProvinceId.toLowerCase().includes(qq) || r.ProvinceName.toLowerCase().includes(qq));
  }, [sorted, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim();

  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const saveRow = (form) => {
    const res = modal.mode === "edit"
      ? pm.updateProvince(form.ProvinceId, form.ProvinceName)
      : pm.addProvince(form.ProvinceId, form.ProvinceName);
    if (!res.ok) return res;
    session.record({ action: modal.mode === "edit" ? "Update" : "Create", module: "Province", desc: `${modal.mode === "edit" ? "Updated" : "Added"} province ${res.ProvinceName}`, tone: modal.mode === "edit" ? "brand" : "success" });
    toast.push({ title: modal.mode === "edit" ? tt("Province updated", "Provinsi diperbarui") : tt("Province added", "Provinsi ditambahkan"), description: res.ProvinceName });
    setModal(null);
    return res;
  };

  const confirmDelete = () => {
    pm.removeProvince(del.ProvinceId);
    session.record({ action: "Delete", module: "Province", desc: `Deleted province ${del.ProvinceName}`, tone: "danger" });
    toast.push({ title: tt("Province deleted", "Provinsi dihapus"), description: del.ProvinceName, tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.ProvinceId === r.ProvinceId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("Province Id", "Id Provinsi"), width: 100, render: (r) => (
      <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg, padding: "3px 8px", borderRadius: 6 }}>{r.ProvinceId}</span>
    ) },
    { key: "name", label: tt("Province Name", "Nama Provinsi"), render: (r) => (
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.ProvinceName}</span>
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

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Province", "Provinsi")}
        subtitle={tt("Indonesian province codes for vendor address hierarchy. Each code is a unique key in MSTR_PROVINCE_T.", "Kode provinsi Indonesia untuk hierarki alamat vendor. Setiap kode adalah kunci unik di MSTR_PROVINCE_T.")}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>MSTR_PROVINCE_T</Badge>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", row: null })}>{tt("Add Province", "Tambah Provinsi")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="map" label={tt("Total provinces", "Total provinsi")} value={pm.rows.length} iconTone="brand" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching search", "Cocok pencarian") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
        <OpsStatCard icon="layers" label={tt("Sample data", "Data sampel")} value={tt("34 provinces", "34 provinsi")} iconTone="forest" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }} left={<>
            <div ref={ps.ref} style={{ width: 240 }}>
              <TextInput iconLeft="search" placeholder={tt("Search province id or name…", "Cari id atau nama provinsi…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
            </div>
            <Button variant={sortKey === "id" ? "secondary" : "ghost"} size="sm" iconLeft="hash" onClick={() => setSortKey((k) => (k === "id" ? "name" : "id"))}>
              {sortKey === "id" ? tt("Province Id", "Id Provinsi") : tt("Province Name", "Nama Provinsi")}
            </Button>
            <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm" iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"} onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortKey === "id" ? (sortDir === "asc" ? "0 → 9" : "9 → 0") : (sortDir === "asc" ? "A → Z" : "Z → A")}
            </Button>
            {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => setQ("")}>{t("act.clear")}</Button>}
          </>} right={<Badge tone="neutral">{filtered.length} {tt("of", "dari")} {pm.rows.length}</Badge>} />
        </div>
        <DataTable columns={columns} data={pageRows} dense rowKey="ProvinceId" onRowClick={(r) => setModal({ mode: "edit", row: r })}
          emptyTitle={hasFilter ? tt("No provinces match your search", "Tidak ada provinsi yang cocok") : tt("No provinces yet", "Belum ada provinsi")}
          emptyDesc={hasFilter ? tt("Try a different keyword or clear the search filter.", "Coba kata kunci lain atau bersihkan filter.") : tt("Add the first province to start the catalog.", "Tambahkan provinsi pertama.")} />
        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>
      <ProvinceModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} onClose={() => setModal(null)} onSave={saveRow} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete Province", "Hapus Provinsi")} subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}>{tt("Remove province", "Hapus provinsi")} <b>{del && del.ProvinceId}</b> — {del && del.ProvinceName}?</p>
      </Modal>
    </OpsPage>
  );
}

function ProvinceModal({ open, mode, row, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ ProvinceId: "", ProvinceName: "" });
  const [err, setErr] = React.useState("");
  const idRef = React.useRef(null);
  const nameRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setForm(row ? { ProvinceId: row.ProvinceId, ProvinceName: row.ProvinceName } : { ProvinceId: "", ProvinceName: "" });
      setErr("");
      setTimeout(() => (isEdit ? nameRef.current : idRef.current) && (isEdit ? nameRef.current : idRef.current).focus(), 0);
    }
  }, [open, row, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    const res = onSave({ ProvinceId: isEdit ? row.ProvinceId : String(form.ProvinceId).replace(/\D/g, "").slice(0, PROVINCE_ID_MAX), ProvinceName: String(form.ProvinceName).trim().slice(0, PROVINCE_NAME_MAX) });
    if (res && !res.ok) setErr(res.error);
  };

  return (
    <Modal open={open} onClose={onClose} width={520} icon="map"
      title={isEdit ? tt("Edit Province", "Ubah Provinsi") : tt("Add Province", "Tambah Provinsi")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add Province", "Tambah Provinsi")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Province Id", "Id Provinsi")} required helper={isEdit ? tt("Primary key — cannot be changed", "Kunci utama — tidak dapat diubah") : tt("2-digit BPS code", "Kode BPS 2 digit")}>
          <TextInput inputRef={idRef} value={form.ProvinceId} disabled={isEdit} onChange={(e) => { set("ProvinceId", e.target.value.replace(/\D/g, "").slice(0, PROVINCE_ID_MAX)); setErr(""); }} placeholder="31" />
        </Field>
        <Field label={tt("Province Name", "Nama Provinsi")} required>
          <TextInput inputRef={nameRef} value={form.ProvinceName} onChange={(e) => { set("ProvinceName", e.target.value.slice(0, PROVINCE_NAME_MAX)); setErr(""); }} placeholder="DKI JAKARTA" />
        </Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

Object.assign(window, { ProvinceMasterData, ProvinceModal });
export { ProvinceMasterData, ProvinceModal };
