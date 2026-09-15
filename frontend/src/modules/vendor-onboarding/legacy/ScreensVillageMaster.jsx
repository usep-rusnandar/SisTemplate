/* fm3-converted */
import React from "react";
import { useCityMaster } from "./CityMasterData.jsx";
import { useDistrictMaster } from "./DistrictMasterData.jsx";
import { useProvinceMaster } from "./ProvinceMasterData.jsx";
import { VILLAGE_ID_MAX, VILLAGE_NAME_MAX, useVillageMaster } from "./VillageMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, IconButton, Select, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Village Master Data.
   Source table: MSTR_VILLAGE_T (VillageId varchar(13) PK, VillageName varchar(50), DistrictId FK). */

function VillageMasterData() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const vm = useVillageMaster();
  const dm = useDistrictMaster();
  const cm = useCityMaster();
  const pm = useProvinceMaster();

  const districtById = React.useMemo(() => Object.fromEntries(dm.rows.map((d) => [d.DistrictId, d])), [dm.rows]);
  const cityById = React.useMemo(() => Object.fromEntries(cm.rows.map((c) => [c.CityId, c])), [cm.rows]);

  const ps = usePageSearch(tt("Search village id or name…", "Cari id atau nama kelurahan/desa…"));
  const q = ps.query;
  const setQ = ps.setQuery;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");
  const [distFilter, setDistFilter] = React.useState("all");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [q, pageSize, sortKey, sortDir, distFilter]);

  const sorted = React.useMemo(() => {
    return [...vm.rows].sort((a, b) => {
      const cmp = sortKey === "id"
        ? a.VillageId.localeCompare(b.VillageId, undefined, { numeric: true })
        : a.VillageName.localeCompare(b.VillageName);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [vm.rows, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    let list = sorted;
    if (distFilter !== "all") list = list.filter((r) => r.DistrictId === distFilter);
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((r) => {
      const dist = districtById[r.DistrictId];
      const city = dist ? cityById[dist.CityId] : null;
      const distName = dm.districtMap[r.DistrictId] || "";
      const cityName = city ? city.CityName : "";
      const provName = city ? (pm.provinceMap[city.ProvinceId] || "") : "";
      return r.VillageId.toLowerCase().includes(qq) || r.VillageName.toLowerCase().includes(qq)
        || distName.toLowerCase().includes(qq) || cityName.toLowerCase().includes(qq) || provName.toLowerCase().includes(qq);
    });
  }, [sorted, q, distFilter, dm.districtMap, districtById, cityById, pm.provinceMap]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim() || distFilter !== "all";

  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const saveRow = (form) => {
    const res = modal.mode === "edit"
      ? vm.updateVillage(form.VillageId, form.VillageName, form.DistrictId)
      : vm.addVillage(form.VillageId, form.VillageName, form.DistrictId);
    if (!res.ok) return res;
    session.record({ action: modal.mode === "edit" ? "Update" : "Create", module: "Village", desc: `${modal.mode === "edit" ? "Updated" : "Added"} village ${res.VillageName}`, tone: modal.mode === "edit" ? "brand" : "success" });
    toast.push({ title: modal.mode === "edit" ? tt("Village updated", "Kelurahan/Desa diperbarui") : tt("Village added", "Kelurahan/Desa ditambahkan"), description: res.VillageName });
    setModal(null);
    return res;
  };

  const confirmDelete = () => {
    vm.removeVillage(del.VillageId);
    session.record({ action: "Delete", module: "Village", desc: `Deleted village ${del.VillageName}`, tone: "danger" });
    toast.push({ title: tt("Village deleted", "Kelurahan/Desa dihapus"), description: del.VillageName, tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.VillageId === r.VillageId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("Village Id", "Id Kel/Desa"), width: 140, render: (r) => (
      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg, padding: "3px 8px", borderRadius: 6 }}>{r.VillageId}</span>
    ) },
    { key: "name", label: tt("Village Name", "Nama Kelurahan/Desa"), render: (r) => (
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.VillageName}</span>
    ) },
    { key: "dist", label: tt("District", "Kecamatan"), width: 160, render: (r) => (
      <span style={{ fontSize: 12.5, color: C.textSubtle }}>{dm.districtMap[r.DistrictId] || r.DistrictId}</span>
    ) },
    { key: "city", label: tt("City", "Kota/Kabupaten"), width: 180, render: (r) => {
      const dist = districtById[r.DistrictId];
      const city = dist ? cityById[dist.CityId] : null;
      return <span style={{ fontSize: 12.5, color: C.textSubtle }}>{city ? city.CityName : "—"}</span>;
    } },
    { key: "prov", label: tt("Province", "Provinsi"), width: 160, render: (r) => {
      const dist = districtById[r.DistrictId];
      const city = dist ? cityById[dist.CityId] : null;
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

  const distOptions = [{ value: "all", label: tt("All districts", "Semua kecamatan") }, ...dm.rows.map((d) => ({ value: d.DistrictId, label: `${d.DistrictId} — ${d.DistrictName}` }))];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Village", "Kelurahan / Desa")}
        subtitle={tt("Lowest-level administrative units for vendor addresses. Linked to districts in MSTR_VILLAGE_T.", "Unit administratif terendah untuk alamat vendor. Terhubung ke kecamatan di MSTR_VILLAGE_T.")}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>MSTR_VILLAGE_T</Badge>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", row: null })}>{tt("Add Village", "Tambah Kel/Desa")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="home" label={tt("Total villages", "Total kel/desa")} value={vm.rows.length} iconTone="brand" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching filter", "Cocok filter") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
        <OpsStatCard icon="layers" label={tt("Sample data", "Data sampel")} value={tt("200 villages", "200 kel/desa")} iconTone="forest" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }} left={<>
            <div ref={ps.ref} style={{ width: 240 }}>
              <TextInput iconLeft="search" placeholder={tt("Search village id or name…", "Cari id atau nama kelurahan/desa…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
            </div>
            <Select value={distFilter} onChange={(e) => setDistFilter(e.target.value)} options={distOptions} style={{ minWidth: 240 }} />
            <Button variant={sortKey === "id" ? "secondary" : "ghost"} size="sm" iconLeft="hash" onClick={() => setSortKey((k) => (k === "id" ? "name" : "id"))}>
              {sortKey === "id" ? tt("Village Id", "Id Kel/Desa") : tt("Village Name", "Nama")}
            </Button>
            <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm" iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"} onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortKey === "id" ? (sortDir === "asc" ? "0 → 9" : "9 → 0") : (sortDir === "asc" ? "A → Z" : "Z → A")}
            </Button>
            {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setDistFilter("all"); }}>{t("act.clear")}</Button>}
          </>} right={<Badge tone="neutral">{filtered.length} {tt("of", "dari")} {vm.rows.length}</Badge>} />
        </div>
        <DataTable columns={columns} data={pageRows} dense rowKey="VillageId" onRowClick={(r) => setModal({ mode: "edit", row: r })}
          emptyTitle={hasFilter ? tt("No villages match your filter", "Tidak ada kel/desa yang cocok") : tt("No villages yet", "Belum ada kelurahan/desa")}
          emptyDesc={hasFilter ? tt("Try a different keyword or clear filters.", "Coba kata kunci lain atau bersihkan filter.") : tt("Add the first village to start the catalog.", "Tambahkan kelurahan/desa pertama.")} />
        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>
      <VillageModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} districts={dm.rows} onClose={() => setModal(null)} onSave={saveRow} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete Village", "Hapus Kelurahan/Desa")} subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}>{tt("Remove village", "Hapus kelurahan/desa")} <b>{del && del.VillageId}</b> — {del && del.VillageName}?</p>
      </Modal>
    </OpsPage>
  );
}

function VillageModal({ open, mode, row, districts, onClose, onSave }) {
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ VillageId: "", VillageName: "", DistrictId: "" });
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setForm(row ? { VillageId: row.VillageId, VillageName: row.VillageName, DistrictId: row.DistrictId } : { VillageId: "", VillageName: "", DistrictId: districts[0] ? districts[0].DistrictId : "" });
      setErr("");
    }
  }, [open, row, isEdit, districts]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    const res = onSave({
      VillageId: isEdit ? row.VillageId : String(form.VillageId).replace(/[^0-9.]/g, "").slice(0, VILLAGE_ID_MAX),
      VillageName: String(form.VillageName).trim().slice(0, VILLAGE_NAME_MAX),
      DistrictId: form.DistrictId,
    });
    if (res && !res.ok) setErr(res.error);
  };

  const distOptions = districts.map((d) => ({ value: d.DistrictId, label: `${d.DistrictId} — ${d.DistrictName}` }));

  return (
    <Modal open={open} onClose={onClose} width={520} icon="home"
      title={isEdit ? tt("Edit Village", "Ubah Kelurahan/Desa") : tt("Add Village", "Tambah Kelurahan/Desa")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add Village", "Tambah Kel/Desa")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Village Id", "Id Kelurahan/Desa")} required helper={isEdit ? tt("Primary key — cannot be changed", "Kunci utama — tidak dapat diubah") : tt("BPS code e.g. 31.71.01.1001", "Kode BPS cth. 31.71.01.1001")}>
          <TextInput value={form.VillageId} disabled={isEdit} onChange={(e) => { set("VillageId", e.target.value.replace(/[^0-9.]/g, "").slice(0, VILLAGE_ID_MAX)); setErr(""); }} placeholder="31.71.01.1001" />
        </Field>
        <Field label={tt("Village Name", "Nama Kelurahan/Desa")} required>
          <TextInput value={form.VillageName} onChange={(e) => { set("VillageName", e.target.value.slice(0, VILLAGE_NAME_MAX)); setErr(""); }} placeholder="Gambir" />
        </Field>
        <Field label={tt("District", "Kecamatan")} required>
          <Select value={form.DistrictId} onChange={(e) => set("DistrictId", e.target.value)} options={distOptions} />
        </Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

Object.assign(window, { VillageMasterData, VillageModal });
export { VillageMasterData, VillageModal };
