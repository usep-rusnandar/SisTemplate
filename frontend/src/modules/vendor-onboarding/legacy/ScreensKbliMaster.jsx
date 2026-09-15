/* fm3-converted */
import React from "react";
import { KBLI_DESC_MAX, KBLI_ID_MAX, useKbliMaster } from "./KbliMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, IconButton, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ KBLI Master Data.
   Source table: MSTR_KBLI_T (KbliId varchar(5) PK, KbliDesc varchar(200)).
   Ops layout + DataTable CRUD aligned with Brand and other master data screens. */

function KbliMasterData() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const km = useKbliMaster();

  const ps = usePageSearch(tt("Search KBLI id or description…", "Cari id atau deskripsi KBLI…"));
  const q = ps.query;
  const setQ = ps.setQuery;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortDir, setSortDir] = React.useState("asc");
  const [modal, setModal] = React.useState(null); // { mode: "create"|"edit", row }
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [q, pageSize, sortDir]);

  const sorted = React.useMemo(() => {
    return [...km.rows].sort((a, b) => {
      const cmp = a.KbliId.localeCompare(b.KbliId, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [km.rows, sortDir]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return sorted;
    return sorted.filter((r) => r.KbliId.toLowerCase().includes(qq) || r.KbliDesc.toLowerCase().includes(qq));
  }, [sorted, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim();

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const longestDesc = React.useMemo(() => {
    if (!km.rows.length) return null;
    return km.rows.reduce((a, b) => (a.KbliDesc.length >= b.KbliDesc.length ? a : b));
  }, [km.rows]);

  const saveKbli = (form) => {
    const res = modal.mode === "edit"
      ? km.updateKbli(form.KbliId, form.KbliDesc)
      : km.addKbli(form.KbliId, form.KbliDesc);
    if (!res.ok) return res;
    session.record({
      action: modal.mode === "edit" ? "Update" : "Create",
      module: "KBLI",
      desc: `${modal.mode === "edit" ? "Updated" : "Added"} KBLI ${res.KbliId}`,
      tone: modal.mode === "edit" ? "brand" : "success",
    });
    toast.push({
      title: modal.mode === "edit" ? tt("KBLI updated", "KBLI diperbarui") : tt("KBLI added", "KBLI ditambahkan"),
      description: res.KbliId,
    });
    setModal(null);
    return res;
  };

  const confirmDelete = () => {
    km.removeKbli(del.KbliId);
    session.record({ action: "Delete", module: "KBLI", desc: `Deleted KBLI ${del.KbliId}`, tone: "danger" });
    toast.push({ title: tt("KBLI deleted", "KBLI dihapus"), description: del.KbliId, tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.KbliId === r.KbliId);
      return (
        <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt,
          color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>
          {i + 1}
        </span>
      );
    } },
    { key: "id", label: tt("Kbli Id", "Id KBLI"), width: 100, render: (r) => (
      <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg,
        padding: "3px 8px", borderRadius: 6, letterSpacing: "0.04em" }}>{r.KbliId}</span>
    ) },
    { key: "desc", label: tt("Description", "Deskripsi"), render: (r) => (
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.45 }}>{r.KbliDesc}</span>
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
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("KBLI", "KBLI")}
        subtitle={tt(
          "Indonesian Standard Industrial Classification codes linked to vendor commodities and sub-classifications. Each code is a unique key in MSTR_KBLI_T.",
          "Kode Klasifikasi Baku Lapangan Usaha Indonesia untuk komoditas vendor dan sub-klasifikasi. Setiap kode adalah kunci unik di MSTR_KBLI_T."
        )}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>MSTR_KBLI_T</Badge>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", row: null })}>{tt("Add KBLI", "Tambah KBLI")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="layers" label={tt("Total codes", "Total kode")} value={km.rows.length} iconTone="brand" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching search", "Cocok pencarian") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
        <OpsStatCard icon="text" label={tt("Longest description", "Deskripsi terpanjang")} value={longestDesc ? `${longestDesc.KbliDesc.length} ${tt("chars", "kar.")}` : "—"} iconTone="forest" />
      </OpsStatGrid>

      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 240 }}>
                <TextInput iconLeft="search" placeholder={tt("Search KBLI id or description…", "Cari id atau deskripsi KBLI…")}
                  value={q} onChange={(e) => setQ(e.target.value)}
                  inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
              </div>
              <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm"
                iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"}
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
                {sortDir === "asc" ? "0 → 9" : "9 → 0"}
              </Button>
              {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => setQ("")}>{t("act.clear")}</Button>}
            </>}
            right={<Badge tone="neutral">{filtered.length} {tt("of", "dari")} {km.rows.length}</Badge>} />
        </div>

        <DataTable columns={columns} data={pageRows} dense rowKey="KbliId" onRowClick={(r) => setModal({ mode: "edit", row: r })}
          emptyTitle={hasFilter ? tt("No KBLI codes match your search", "Tidak ada kode KBLI yang cocok") : tt("No KBLI codes yet", "Belum ada kode KBLI")}
          emptyDesc={hasFilter
            ? tt("Try a different keyword or clear the search filter.", "Coba kata kunci lain atau bersihkan filter pencarian.")
            : tt("Add the first KBLI code to start the catalog.", "Tambahkan kode KBLI pertama untuk memulai katalog.")}
        />

        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>

      <KbliModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} onClose={() => setModal(null)} onSave={saveKbli} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2"
        title={tt("Delete KBLI", "Hapus KBLI")}
        subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<>
          <Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button>
          <Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button>
        </>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>
          {tt("Remove KBLI", "Hapus KBLI")} <b>{del && del.KbliId}</b> — {del && del.KbliDesc}?
        </p>
      </Modal>
    </OpsPage>
  );
}

function KbliModal({ open, mode, row, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ KbliId: "", KbliDesc: "" });
  const [err, setErr] = React.useState("");
  const idRef = React.useRef(null);
  const descRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setForm(row ? { KbliId: row.KbliId, KbliDesc: row.KbliDesc } : { KbliId: "", KbliDesc: "" });
      setErr("");
      setTimeout(() => (isEdit ? descRef.current : idRef.current) && (isEdit ? descRef.current : idRef.current).focus(), 0);
    }
  }, [open, row, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const res = onSave({
      KbliId: isEdit ? row.KbliId : _normKbliId(form.KbliId),
      KbliDesc: _normKbliDesc(form.KbliDesc),
    });
    if (res && !res.ok) setErr(res.error);
  };

  const idLeft = KBLI_ID_MAX - (form.KbliId || "").replace(/\D/g, "").length;
  const descLeft = KBLI_DESC_MAX - (form.KbliDesc || "").length;

  return (
    <Modal open={open} onClose={onClose} width={520} icon="layers"
      title={isEdit ? tt("Edit KBLI", "Ubah KBLI") : tt("Add KBLI", "Tambah KBLI")}
      subtitle={isEdit ? tt("Update the description for this classification code.", "Perbarui deskripsi untuk kode klasifikasi ini.") : tt("Enter a unique 5-digit KBLI code and its description.", "Masukkan kode KBLI 5 digit unik beserta deskripsinya.")}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add KBLI", "Tambah KBLI")}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Kbli Id", "Id KBLI")} required
          helper={isEdit ? tt("Primary key — cannot be changed", "Kunci utama — tidak dapat diubah") : tt("5-digit numeric code", "Kode numerik 5 digit")}>
          <TextInput inputRef={idRef} value={form.KbliId} disabled={isEdit}
            onChange={(e) => { set("KbliId", e.target.value.replace(/\D/g, "").slice(0, KBLI_ID_MAX)); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="01614" />
          {!isEdit && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 11.5, color: idLeft < 2 ? C.orange : C.textSubtle, fontVariantNumeric: "tabular-nums" }}>
              {idLeft} {tt("digits left", "digit tersisa")}
            </div>
          )}
        </Field>
        <Field label={tt("Description", "Deskripsi")} required>
          <TextInput inputRef={descRef} value={form.KbliDesc}
            onChange={(e) => { set("KbliDesc", e.target.value.slice(0, KBLI_DESC_MAX)); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={tt("e.g. Jasa Penyemprotan Dan Penyerbukan Melalui Udara", "cth. Jasa Penyemprotan Dan Penyerbukan Melalui Udara")} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 11.5, color: descLeft < 20 ? C.orange : C.textSubtle, fontVariantNumeric: "tabular-nums" }}>
            {descLeft} {tt("characters left", "karakter tersisa")}
          </div>
        </Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

function _normKbliId(id) {
  return String(id || "").trim().replace(/\D/g, "").slice(0, KBLI_ID_MAX);
}

function _normKbliDesc(desc) {
  return String(desc || "").trim().slice(0, KBLI_DESC_MAX);
}

Object.assign(window, { KbliMasterData, KbliModal });
export { KbliMasterData, KbliModal };
