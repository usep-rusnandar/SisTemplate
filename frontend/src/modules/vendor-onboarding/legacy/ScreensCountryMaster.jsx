/* fm3-converted */
import React from "react";
import { COUNTRY_CODE_MAX, COUNTRY_NAME_MAX, useCountryMaster } from "./CountryMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, IconButton, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Country Master Data.
   Source table: MSTR_COUNTRY_T (CountryCode varchar(6) PK, CountryName varchar(50)).
   Ops layout + DataTable CRUD aligned with KBLI and other master data screens. */

function CountryMasterData() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const cm = useCountryMaster();

  const ps = usePageSearch(tt("Search country code or name…", "Cari kode atau nama negara…"));
  const q = ps.query;
  const setQ = ps.setQuery;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("name"); // "name" | "code"
  const [sortDir, setSortDir] = React.useState("asc");
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);

  React.useEffect(() => { setPage(1); }, [q, pageSize, sortKey, sortDir]);

  const sorted = React.useMemo(() => {
    return [...cm.rows].sort((a, b) => {
      const cmp = sortKey === "code"
        ? a.CountryCode.localeCompare(b.CountryCode, undefined, { numeric: true })
        : a.CountryName.localeCompare(b.CountryName);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [cm.rows, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return sorted;
    return sorted.filter((r) => r.CountryCode.toLowerCase().includes(qq) || r.CountryName.toLowerCase().includes(qq));
  }, [sorted, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim();

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const longestName = React.useMemo(() => {
    if (!cm.rows.length) return null;
    return cm.rows.reduce((a, b) => (a.CountryName.length >= b.CountryName.length ? a : b));
  }, [cm.rows]);

  const saveCountry = (form) => {
    const res = modal.mode === "edit"
      ? cm.updateCountry(form.CountryCode, form.CountryName)
      : cm.addCountry(form.CountryCode, form.CountryName);
    if (!res.ok) return res;
    session.record({
      action: modal.mode === "edit" ? "Update" : "Create",
      module: "Country",
      desc: `${modal.mode === "edit" ? "Updated" : "Added"} country ${res.CountryName}`,
      tone: modal.mode === "edit" ? "brand" : "success",
    });
    toast.push({
      title: modal.mode === "edit" ? tt("Country updated", "Negara diperbarui") : tt("Country added", "Negara ditambahkan"),
      description: res.CountryName,
    });
    setModal(null);
    return res;
  };

  const confirmDelete = () => {
    cm.removeCountry(del.CountryCode);
    session.record({ action: "Delete", module: "Country", desc: `Deleted country ${del.CountryName}`, tone: "danger" });
    toast.push({ title: tt("Country deleted", "Negara dihapus"), description: del.CountryName, tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x.CountryCode === r.CountryCode);
      return (
        <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt,
          color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>
          {i + 1}
        </span>
      );
    } },
    { key: "code", label: tt("Country Code", "Kode Negara"), width: 120, render: (r) => (
      <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg,
        padding: "3px 8px", borderRadius: 6, letterSpacing: "0.04em" }}>{r.CountryCode}</span>
    ) },
    { key: "name", label: tt("Country Name", "Nama Negara"), render: (r) => (
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.45 }}>{r.CountryName}</span>
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
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Country", "Negara")}
        subtitle={tt(
          "International dial codes and display names used in vendor phone and address fields. Each code is a unique key in MSTR_COUNTRY_T.",
          "Kode telepon internasional dan nama tampilan untuk nomor telepon serta alamat vendor. Setiap kode adalah kunci unik di MSTR_COUNTRY_T."
        )}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>MSTR_COUNTRY_T</Badge>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", row: null })}>{tt("Add Country", "Tambah Negara")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="globe" label={tt("Total countries", "Total negara")} value={cm.rows.length} iconTone="brand" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching search", "Cocok pencarian") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
        <OpsStatCard icon="text" label={tt("Longest name", "Nama terpanjang")} value={longestName ? `${longestName.CountryName.length} ${tt("chars", "kar.")}` : "—"} iconTone="forest" />
      </OpsStatGrid>

      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 240 }}>
                <TextInput iconLeft="search" placeholder={tt("Search country code or name…", "Cari kode atau nama negara…")}
                  value={q} onChange={(e) => setQ(e.target.value)}
                  inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
              </div>
              <Button variant={sortKey === "code" ? "secondary" : "ghost"} size="sm" iconLeft="hash"
                onClick={() => setSortKey((k) => (k === "code" ? "name" : "code"))}>
                {sortKey === "code" ? tt("Country Code", "Kode Negara") : tt("Country Name", "Nama Negara")}
              </Button>
              <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm"
                iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"}
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
                {sortKey === "code"
                  ? (sortDir === "asc" ? "+ → z" : "z → +")
                  : (sortDir === "asc" ? "A → Z" : "Z → A")}
              </Button>
              {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => setQ("")}>{t("act.clear")}</Button>}
            </>}
            right={<Badge tone="neutral">{filtered.length} {tt("of", "dari")} {cm.rows.length}</Badge>} />
        </div>

        <DataTable columns={columns} data={pageRows} dense rowKey="CountryCode" onRowClick={(r) => setModal({ mode: "edit", row: r })}
          emptyTitle={hasFilter ? tt("No countries match your search", "Tidak ada negara yang cocok") : tt("No countries yet", "Belum ada negara")}
          emptyDesc={hasFilter
            ? tt("Try a different keyword or clear the search filter.", "Coba kata kunci lain atau bersihkan filter pencarian.")
            : tt("Add the first country to start the catalog.", "Tambahkan negara pertama untuk memulai katalog.")}
        />

        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>

      <CountryModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} onClose={() => setModal(null)} onSave={saveCountry} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2"
        title={tt("Delete Country", "Hapus Negara")}
        subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<>
          <Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button>
          <Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button>
        </>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>
          {tt("Remove country", "Hapus negara")} <b>{del && del.CountryCode}</b> — {del && del.CountryName}?
        </p>
      </Modal>
    </OpsPage>
  );
}

function CountryModal({ open, mode, row, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const [form, setForm] = React.useState({ CountryCode: "", CountryName: "" });
  const [err, setErr] = React.useState("");
  const codeRef = React.useRef(null);
  const nameRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setForm(row ? { CountryCode: row.CountryCode, CountryName: row.CountryName } : { CountryCode: "", CountryName: "" });
      setErr("");
      setTimeout(() => (isEdit ? nameRef.current : codeRef.current) && (isEdit ? nameRef.current : codeRef.current).focus(), 0);
    }
  }, [open, row, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const res = onSave({
      CountryCode: isEdit ? row.CountryCode : _normCountryCode(form.CountryCode),
      CountryName: _normCountryName(form.CountryName),
    });
    if (res && !res.ok) setErr(res.error);
  };

  const codeLeft = COUNTRY_CODE_MAX - (form.CountryCode || "").replace(/[^+0-9-]/g, "").length;
  const nameLeft = COUNTRY_NAME_MAX - (form.CountryName || "").length;

  return (
    <Modal open={open} onClose={onClose} width={520} icon="globe"
      title={isEdit ? tt("Edit Country", "Ubah Negara") : tt("Add Country", "Tambah Negara")}
      subtitle={isEdit ? tt("Update the display name for this dial code.", "Perbarui nama tampilan untuk kode telepon ini.") : tt("Enter a unique dial code and its display name.", "Masukkan kode telepon unik beserta nama tampilannya.")}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add Country", "Tambah Negara")}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Country Code", "Kode Negara")} required
          helper={isEdit ? tt("Primary key — cannot be changed", "Kunci utama — tidak dapat diubah") : tt("International dial code, max 6 characters", "Kode telepon internasional, maks. 6 karakter")}>
          <TextInput inputRef={codeRef} value={form.CountryCode} disabled={isEdit}
            onChange={(e) => { set("CountryCode", e.target.value.replace(/[^+0-9-]/g, "").slice(0, COUNTRY_CODE_MAX)); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="+62" />
          {!isEdit && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 11.5, color: codeLeft < 2 ? C.orange : C.textSubtle, fontVariantNumeric: "tabular-nums" }}>
              {codeLeft} {tt("characters left", "karakter tersisa")}
            </div>
          )}
        </Field>
        <Field label={tt("Country Name", "Nama Negara")} required>
          <TextInput inputRef={nameRef} value={form.CountryName}
            onChange={(e) => { set("CountryName", e.target.value.slice(0, COUNTRY_NAME_MAX)); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={tt("e.g. Indonesia (+62)", "cth. Indonesia (+62)")} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 11.5, color: nameLeft < 10 ? C.orange : C.textSubtle, fontVariantNumeric: "tabular-nums" }}>
            {nameLeft} {tt("characters left", "karakter tersisa")}
          </div>
        </Field>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

function _normCountryCode(code) {
  return String(code || "").trim().replace(/[^+0-9-]/g, "").slice(0, COUNTRY_CODE_MAX);
}

function _normCountryName(name) {
  return String(name || "").trim().slice(0, COUNTRY_NAME_MAX);
}

Object.assign(window, { CountryMasterData, CountryModal });
export { CountryMasterData, CountryModal };
