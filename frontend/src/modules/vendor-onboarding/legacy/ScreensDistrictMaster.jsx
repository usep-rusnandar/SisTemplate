/* fm3-converted */
import React from "react";
import { useCityMaster } from "./CityMasterData.jsx";
import { DISTRICT_ID_MAX, DISTRICT_NAME_MAX, useDistrictMaster } from "./DistrictMasterData.jsx";
import { useProvinceMaster } from "./ProvinceMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, IconButton, Select, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ District Master Data.
   Source table: MSTR_DISTRICT_T (DistrictId varchar(8) PK, DistrictName varchar(50), CityId FK). */

function DistrictMasterData() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const dm = useDistrictMaster();
  const cm = useCityMaster();
  const pm = useProvinceMaster();

  const cityById = React.useMemo(() => Object.fromEntries(cm.rows.map((c) => [c.CityId, c])), [cm.rows]);

  const ps = usePageSearch(tt("Search district id or name…", "Cari id atau nama kecamatan…"));
  const q = ps.query;
  const setQ = ps.setQuery;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");
  const [cityFilter, setCityFilter] = React.useState("all");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [q, pageSize, sortKey, sortDir, cityFilter]);

  const sorted = React.useMemo(() => {
    return [...dm.rows].sort((a, b) => {
      const cmp = sortKey === "id"
        ? a.DistrictId.localeCompare(b.DistrictId, undefined, { numeric: true })
        : a.DistrictName.localeCompare(b.DistrictName);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [dm.rows, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    let list = sorted;
    if (cityFilter !== "all") list = list.filter((r) => r.CityId === cityFilter);
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((r) => {
      const city = cityById[r.CityId];
      const provName = city ? (pm.provinceMap[city.ProvinceId] || "") : "";
      const cityName = cm.cityMap[r.CityId] || "";
      return r.DistrictId.toLowerCase().includes(qq) || r.DistrictName.toLowerCase().includes(qq)
        || cityName.toLowerCase().includes(qq) || provName.toLowerCase().includes(qq);
    });
  }, [sorted, q, cityFilter, cm.cityMap, cityById, pm.provinceMap]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim() || cityFilter !== "all";

  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const saveRow = (form) => {
    const res = modal.mode === "edit"
      ? dm.updateDistrict(form.DistrictId, form.DistrictName, form.CityId)
      : dm.addDistrict(form.DistrictId, form.DistrictName, form.CityId);
    if (!res.ok) return res;
    session.record({ action: modal.mode === "edit" ? "Update" : "Create", module: "District", desc: `${modal.mode === "edit" ? "Updated" : "Added"} district ${res.DistrictName}`, tone: modal.mode === "edit" ? "brand" : "success" });
    toast.push({ title: modal.mode === "edit" ? tt("District updated", "Kecamatan diperbarui") : tt("District added", "Kecamatan ditambahkan"), description: res.DistrictName });
    setModal(null);
    return res;
  };

  const confirmDelete = () => {
    dm.removeDistrict(del.DistrictId);
    session.record({ action: "Delete", module: "District", desc: `Deleted district ${del.DistrictName}`, tone: "danger" });
    toast.push({ title: tt("District deleted", "Kecamatan dihapus"), description: del.DistrictName, tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.DistrictId === r.DistrictId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("District Id", "Id Kecamatan"), width: 120, render: (r) => (
      <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg, padding: "3px 8px", borderRadius: 6 }}>{r.DistrictId}</span>
    ) },
    { key: "name", label: tt("District Name", "Nama Kecamatan"), render: (r) => (
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.DistrictName}</span>
    ) },
    { key: "city", label: tt("City", "Kota/Kabupaten"), width: 200, render: (r) => (
      <span style={{ fontSize: 12.5, color: C.textSubtle }}>{cm.cityMap[r.CityId] || r.CityId}</span>
    ) },
    { key: "prov", label: tt("Province", "Provinsi"), width: 180, render: (r) => {
      const city = cityById[r.CityId];
      return <span style={{ fontSize: 12.5, color: C.textSubtle }}>{city ? (pm.provinceMap[city.ProvinceId] || city.ProvinceId) : "—"}</span>;
    } },
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

  const cityOptions = [{ value: "all", label: tt("All cities", "Semua kota/kab.") }, ...cm.rows.map((c) => ({ value: c.CityId, label: `${c.CityId} — ${c.CityName}` }))];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("District", "Kecamatan")}
        subtitle={tt("Sub-city administrative districts. Each record links to a city in MSTR_DISTRICT_T.", "Kecamatan di bawah kota/kabupaten. Setiap record terhubung ke kota di MSTR_DISTRICT_T.")}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>MSTR_DISTRICT_T</Badge>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", row: null })}>{tt("Add District", "Tambah Kecamatan")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="landmark" label={tt("Total districts", "Total kecamatan")} value={dm.rows.length} iconTone="brand" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching filter", "Cocok filter") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
        <OpsStatCard icon="layers" label={tt("Sample data", "Data sampel")} value={tt("120 districts", "120 kecamatan")} iconTone="forest" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }} left={<>
            <div ref={ps.ref} style={{ width: 240 }}>
              <TextInput iconLeft="search" placeholder={tt("Search district id or name…", "Cari id atau nama kecamatan…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
            </div>
            <Select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} options={cityOptions} style={{ minWidth: 220 }} />
            <Button variant={sortKey === "id" ? "secondary" : "ghost"} size="sm" iconLeft="hash" onClick={() => setSortKey((k) => (k === "id" ? "name" : "id"))}>
              {sortKey === "id" ? tt("District Id", "Id Kecamatan") : tt("District Name", "Nama")}
            </Button>
            <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm" iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"} onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortKey === "id" ? (sortDir === "asc" ? "0 → 9" : "9 → 0") : (sortDir === "asc" ? "A → Z" : "Z → A")}
            </Button>
            {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setCityFilter("all"); }}>{t("act.clear")}</Button>}
          </>} right={<Badge tone="neutral">{filtered.length} {tt("of", "dari")} {dm.rows.length}</Badge>} />
        </div>
        <DataTable columns={columns} data={pageRows} dense rowKey="DistrictId" onRowClick={(r) => setModal({ mode: "edit", row: r })}
          emptyTitle={hasFilter ? tt("No districts match your filter", "Tidak ada kecamatan yang cocok") : tt("No districts yet", "Belum ada kecamatan")}
          emptyDesc={hasFilter ? tt("Try a different keyword or clear filters.", "Coba kata kunci lain atau bersihkan filter.") : tt("Add the first district to start the catalog.", "Tambahkan kecamatan pertama.")} />
        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>
      <DistrictModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} cities={cm.rows} onClose={() => setModal(null)} onSave={saveRow} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete District", "Hapus Kecamatan")} subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}>{tt("Remove district", "Hapus kecamatan")} <b>{del && del.DistrictId}</b> — {del && del.DistrictName}?</p>
      </Modal>
    </OpsPage>
  );
}

function DistrictModal({ open, mode, row, cities, onClose, onSave }) {
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ DistrictId: "", DistrictName: "", CityId: "" });
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setForm(row ? { DistrictId: row.DistrictId, DistrictName: row.DistrictName, CityId: row.CityId } : { DistrictId: "", DistrictName: "", CityId: cities[0] ? cities[0].CityId : "" });
      setErr("");
    }
  }, [open, row, isEdit, cities]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    const res = onSave({
      DistrictId: isEdit ? row.DistrictId : String(form.DistrictId).replace(/[^0-9.]/g, "").slice(0, DISTRICT_ID_MAX),
      DistrictName: String(form.DistrictName).trim().slice(0, DISTRICT_NAME_MAX),
      CityId: form.CityId,
    });
    if (res && !res.ok) setErr(res.error);
  };

  const cityOptions = cities.map((c) => ({ value: c.CityId, label: `${c.CityId} — ${c.CityName}` }));

  return (
    <Modal open={open} onClose={onClose} width={520} icon="landmark"
      title={isEdit ? tt("Edit District", "Ubah Kecamatan") : tt("Add District", "Tambah Kecamatan")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add District", "Tambah Kecamatan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("District Id", "Id Kecamatan")} required helper={isEdit ? tt("Primary key — cannot be changed", "Kunci utama — tidak dapat diubah") : tt("BPS code e.g. 31.71.01", "Kode BPS cth. 31.71.01")}>
          <TextInput value={form.DistrictId} disabled={isEdit} onChange={(e) => { set("DistrictId", e.target.value.replace(/[^0-9.]/g, "").slice(0, DISTRICT_ID_MAX)); setErr(""); }} placeholder="31.71.01" />
        </Field>
        <Field label={tt("District Name", "Nama Kecamatan")} required>
          <TextInput value={form.DistrictName} onChange={(e) => { set("DistrictName", e.target.value.slice(0, DISTRICT_NAME_MAX)); setErr(""); }} placeholder="Gambir" />
        </Field>
        <Field label={tt("City", "Kota/Kabupaten")} required>
          <Select value={form.CityId} onChange={(e) => set("CityId", e.target.value)} options={cityOptions} />
        </Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

Object.assign(window, { DistrictMasterData, DistrictModal });
export { DistrictMasterData, DistrictModal };
