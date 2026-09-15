/* fm3-converted */
import React from "react";
import { CITY_ID_MAX, CITY_NAME_MAX, useCityMaster } from "./CityMasterData.jsx";
import { useProvinceMaster } from "./ProvinceMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, IconButton, Select, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ City Master Data.
   Source table: MSTR_CITY_T (CityId varchar(5) PK, CityName varchar(50), ProvinceId FK). */

function CityMasterData() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const cm = useCityMaster();
  const pm = useProvinceMaster();

  const ps = usePageSearch(tt("Search city id or name…", "Cari id atau nama kota/kabupaten…"));
  const q = ps.query;
  const setQ = ps.setQuery;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");
  const [provFilter, setProvFilter] = React.useState("all");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [q, pageSize, sortKey, sortDir, provFilter]);

  const sorted = React.useMemo(() => {
    return [...cm.rows].sort((a, b) => {
      const cmp = sortKey === "id"
        ? a.CityId.localeCompare(b.CityId, undefined, { numeric: true })
        : a.CityName.localeCompare(b.CityName);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [cm.rows, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    let list = sorted;
    if (provFilter !== "all") list = list.filter((r) => r.ProvinceId === provFilter);
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((r) => r.CityId.toLowerCase().includes(qq) || r.CityName.toLowerCase().includes(qq) || (pm.provinceMap[r.ProvinceId] || "").toLowerCase().includes(qq));
  }, [sorted, q, provFilter, pm.provinceMap]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim() || provFilter !== "all";

  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const saveRow = (form) => {
    const res = modal.mode === "edit"
      ? cm.updateCity(form.CityId, form.CityName, form.ProvinceId)
      : cm.addCity(form.CityId, form.CityName, form.ProvinceId);
    if (!res.ok) return res;
    session.record({ action: modal.mode === "edit" ? "Update" : "Create", module: "City", desc: `${modal.mode === "edit" ? "Updated" : "Added"} city ${res.CityName}`, tone: modal.mode === "edit" ? "brand" : "success" });
    toast.push({ title: modal.mode === "edit" ? tt("City updated", "Kota/Kabupaten diperbarui") : tt("City added", "Kota/Kabupaten ditambahkan"), description: res.CityName });
    setModal(null);
    return res;
  };

  const confirmDelete = () => {
    cm.removeCity(del.CityId);
    session.record({ action: "Delete", module: "City", desc: `Deleted city ${del.CityName}`, tone: "danger" });
    toast.push({ title: tt("City deleted", "Kota/Kabupaten dihapus"), description: del.CityName, tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.CityId === r.CityId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("City Id", "Id Kota/Kab."), width: 110, render: (r) => (
      <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg, padding: "3px 8px", borderRadius: 6 }}>{r.CityId}</span>
    ) },
    { key: "name", label: tt("City Name", "Nama Kota/Kabupaten"), render: (r) => (
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.CityName}</span>
    ) },
    { key: "prov", label: tt("Province", "Provinsi"), width: 180, render: (r) => (
      <span style={{ fontSize: 12.5, color: C.textSubtle }}>{pm.provinceMap[r.ProvinceId] || r.ProvinceId}</span>
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

  const provOptions = [{ value: "all", label: tt("All provinces", "Semua provinsi") }, ...pm.rows.map((p) => ({ value: p.ProvinceId, label: `${p.ProvinceId} — ${p.ProvinceName}` }))];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("City / Regency", "Kota / Kabupaten")}
        subtitle={tt("City and regency codes under each province. Linked to MSTR_CITY_T for vendor addresses.", "Kode kota dan kabupaten di bawah setiap provinsi. Terhubung ke MSTR_CITY_T untuk alamat vendor.")}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>MSTR_CITY_T</Badge>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", row: null })}>{tt("Add City", "Tambah Kota/Kab.")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="building-2" label={tt("Total cities", "Total kota/kab.")} value={cm.rows.length} iconTone="brand" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching filter", "Cocok filter") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
        <OpsStatCard icon="layers" label={tt("Sample data", "Data sampel")} value={tt("44 cities", "44 kota/kab.")} iconTone="forest" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }} left={<>
            <div ref={ps.ref} style={{ width: 240 }}>
              <TextInput iconLeft="search" placeholder={tt("Search city id or name…", "Cari id atau nama kota/kabupaten…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
            </div>
            <Select value={provFilter} onChange={(e) => setProvFilter(e.target.value)} options={provOptions} style={{ minWidth: 200 }} />
            <Button variant={sortKey === "id" ? "secondary" : "ghost"} size="sm" iconLeft="hash" onClick={() => setSortKey((k) => (k === "id" ? "name" : "id"))}>
              {sortKey === "id" ? tt("City Id", "Id Kota/Kab.") : tt("City Name", "Nama")}
            </Button>
            <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm" iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"} onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortKey === "id" ? (sortDir === "asc" ? "0 → 9" : "9 → 0") : (sortDir === "asc" ? "A → Z" : "Z → A")}
            </Button>
            {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setProvFilter("all"); }}>{t("act.clear")}</Button>}
          </>} right={<Badge tone="neutral">{filtered.length} {tt("of", "dari")} {cm.rows.length}</Badge>} />
        </div>
        <DataTable columns={columns} data={pageRows} dense rowKey="CityId" onRowClick={(r) => setModal({ mode: "edit", row: r })}
          emptyTitle={hasFilter ? tt("No cities match your filter", "Tidak ada kota/kab. yang cocok") : tt("No cities yet", "Belum ada kota/kabupaten")}
          emptyDesc={hasFilter ? tt("Try a different keyword or clear filters.", "Coba kata kunci lain atau bersihkan filter.") : tt("Add the first city to start the catalog.", "Tambahkan kota/kabupaten pertama.")} />
        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>
      <CityModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} provinces={pm.rows} onClose={() => setModal(null)} onSave={saveRow} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete City", "Hapus Kota/Kabupaten")} subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}>{tt("Remove city", "Hapus kota/kabupaten")} <b>{del && del.CityId}</b> — {del && del.CityName}?</p>
      </Modal>
    </OpsPage>
  );
}

function CityModal({ open, mode, row, provinces, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ CityId: "", CityName: "", ProvinceId: "" });
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setForm(row ? { CityId: row.CityId, CityName: row.CityName, ProvinceId: row.ProvinceId } : { CityId: "", CityName: "", ProvinceId: provinces[0] ? provinces[0].ProvinceId : "" });
      setErr("");
    }
  }, [open, row, isEdit, provinces]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    const res = onSave({
      CityId: isEdit ? row.CityId : String(form.CityId).replace(/[^0-9.]/g, "").slice(0, CITY_ID_MAX),
      CityName: String(form.CityName).trim().slice(0, CITY_NAME_MAX),
      ProvinceId: form.ProvinceId,
    });
    if (res && !res.ok) setErr(res.error);
  };

  const provOptions = provinces.map((p) => ({ value: p.ProvinceId, label: `${p.ProvinceId} — ${p.ProvinceName}` }));

  return (
    <Modal open={open} onClose={onClose} width={520} icon="building-2"
      title={isEdit ? tt("Edit City", "Ubah Kota/Kabupaten") : tt("Add City", "Tambah Kota/Kabupaten")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add City", "Tambah Kota/Kab.")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("City Id", "Id Kota/Kabupaten")} required helper={isEdit ? tt("Primary key — cannot be changed", "Kunci utama — tidak dapat diubah") : tt("BPS code e.g. 31.71", "Kode BPS cth. 31.71")}>
          <TextInput value={form.CityId} disabled={isEdit} onChange={(e) => { set("CityId", e.target.value.replace(/[^0-9.]/g, "").slice(0, CITY_ID_MAX)); setErr(""); }} placeholder="31.71" />
        </Field>
        <Field label={tt("City Name", "Nama Kota/Kabupaten")} required>
          <TextInput value={form.CityName} onChange={(e) => { set("CityName", e.target.value.slice(0, CITY_NAME_MAX)); setErr(""); }} placeholder="KOTA ADM. JAKARTA PUSAT" />
        </Field>
        <Field label={tt("Province", "Provinsi")} required>
          <Select value={form.ProvinceId} onChange={(e) => set("ProvinceId", e.target.value)} options={provOptions} />
        </Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

Object.assign(window, { CityMasterData, CityModal });
export { CityMasterData, CityModal };
