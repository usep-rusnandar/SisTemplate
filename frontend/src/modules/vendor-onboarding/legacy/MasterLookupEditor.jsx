/* fm3-converted */
import React from "react";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, IconButton, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Generic editable master-data lookup screen.
   Drives a small CRUD table off a backend master-data set (/api/v1/master-data/sets/{key})
   using the per-record upsert/delete endpoints. Used by the VendorConnect lookup masters
   (Vendor Status, KBLI Type, KBLI Status) that were split out of the old read-only viewer.

   A field config describes each column/form input:
     { key, label, labelId, kind: "code" | "name" | "payload", type, width, max, required, mono, placeholder }
   - exactly one "code" field (the record Code / primary key, locked on edit)
   - an optional "name" field (maps to record.Name; if absent, Name = Code)
   - any number of "payload" fields (stored together in record.PayloadJson, camelCase keys) */

function _mleApi(setKey) { return `/api/v1/master-data/sets/${setKey}`; }

function _mleField(fields, kind) { return fields.find((f) => f.kind === kind); }

async function _mleFetchSet(setKey) {
  try {
    const res = await fetch(_mleApi(setKey), { credentials: "include", headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

function _mleRowFromRecord(cfg, rec) {
  const codeField = _mleField(cfg.fields, "code");
  const nameField = _mleField(cfg.fields, "name");
  const row = {};
  row[codeField.key] = String((rec && rec.code) || "");
  if (nameField) row[nameField.key] = String((rec && rec.name) || "");
  let payload = {};
  try { payload = rec && rec.payloadJson ? JSON.parse(rec.payloadJson) : {}; } catch (e) { payload = {}; }
  cfg.fields.filter((f) => f.kind === "payload").forEach((f) => {
    const pascal = f.key.charAt(0).toUpperCase() + f.key.slice(1);
    const v = payload[f.key] != null ? payload[f.key] : payload[pascal];
    // An `optional` number stays blank when unset — 0 would read as "zero days" rather than "not set".
    row[f.key] = v != null ? v : (f.type === "number" && !f.optional ? 0 : "");
  });
  return row;
}

function _mleRecordBody(cfg, row) {
  const codeField = _mleField(cfg.fields, "code");
  const nameField = _mleField(cfg.fields, "name");
  const payloadFields = cfg.fields.filter((f) => f.kind === "payload");
  const body = {
    setName: cfg.setName,
    tableName: cfg.tableName,
    owner: cfg.owner,
    name: nameField ? row[nameField.key] : row[codeField.key],
    status: "Active",
    description: "",
    payloadJson: null,
  };
  if (payloadFields.length) {
    const payload = {};
    payloadFields.forEach((f) => {
      const blank = String(row[f.key] == null ? "" : row[f.key]).trim() === "";
      payload[f.key] = f.type === "number"
        ? (f.optional && blank ? null : (Number(row[f.key]) || 0))
        : String(row[f.key] || "");
    });
    body.payloadJson = JSON.stringify(payload);
  }
  return body;
}

async function _mleUpsert(cfg, row) {
  const codeField = _mleField(cfg.fields, "code");
  const code = row[codeField.key];
  const res = await fetch(`${_mleApi(cfg.setKey)}/records/${encodeURIComponent(code)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(_mleRecordBody(cfg, row)),
  });
  if (!res.ok) throw new Error(`Save failed (${res.status}).`);
}

async function _mleDelete(cfg, code) {
  const res = await fetch(`${_mleApi(cfg.setKey)}/records/${encodeURIComponent(code)}`, {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status}).`);
}

function MasterLookupScreen({ cfg }) {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();

  const codeField = _mleField(cfg.fields, "code");
  const nameField = _mleField(cfg.fields, "name");
  const primaryTextField = nameField || codeField;

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null);
  const [del, setDel] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const ps = usePageSearch(tt(cfg.searchEn, cfg.searchId));
  const q = ps.query;
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);

  const reload = React.useCallback(async () => {
    const payload = await _mleFetchSet(cfg.setKey);
    const mapped = payload && payload.hasData
      ? (Array.isArray(payload.records) ? payload.records : []).map((rec) => _mleRowFromRecord(cfg, rec)).filter((r) => !!r[codeField.key])
      : [];
    // Sort by cfg.sortBy when given (e.g. vendor-status by its Order payload field), else by code.
    const sortKey = cfg.sortBy || codeField.key;
    const sortField = cfg.fields.find((f) => f.key === sortKey);
    mapped.sort((a, b) => (sortField && sortField.type === "number")
      ? (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0)
      : String(a[sortKey]).localeCompare(String(b[sortKey]), undefined, { numeric: true }));
    setRows(mapped);
    setLoading(false);
  }, [cfg, codeField.key]);

  React.useEffect(() => { reload(); }, [reload]);
  React.useEffect(() => { setPage(1); }, [q, pageSize]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => cfg.fields.some((f) => String(r[f.key] == null ? "" : r[f.key]).toLowerCase().includes(qq)));
  }, [rows, q, cfg.fields]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilter = !!q.trim();
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const save = async (form) => {
    const isEdit = modal.mode === "edit";
    const code = isEdit ? modal.row[codeField.key] : String(form[codeField.key] || "").trim();
    if (!code) return { ok: false, error: tt(`${codeField.label} is required.`, `${tt(codeField.label, codeField.labelId || codeField.label)} wajib diisi.`) };
    for (const f of cfg.fields) {
      if (f.required && f.kind !== "code" && !String(form[f.key] == null ? "" : form[f.key]).trim()) {
        return { ok: false, error: tt(`${f.label} is required.`, `${tt(f.label, f.labelId || f.label)} wajib diisi.`) };
      }
    }
    if (!isEdit && rows.some((r) => String(r[codeField.key]).toLowerCase() === code.toLowerCase())) {
      return { ok: false, error: tt(`${codeField.label} already exists.`, `${tt(codeField.label, codeField.labelId || codeField.label)} sudah ada.`) };
    }
    const row = { ...form, [codeField.key]: code };
    setBusy(true);
    try {
      await _mleUpsert(cfg, row);
      await reload();
      session.record({
        action: isEdit ? "Update" : "Create",
        module: cfg.moduleLabel,
        desc: `${isEdit ? "Updated" : "Added"} ${cfg.moduleLabel} ${row[primaryTextField.key]}`,
        tone: isEdit ? "brand" : "success",
      });
      toast.push({ title: isEdit ? tt("Record updated", "Data diperbarui") : tt("Record added", "Data ditambahkan"), description: String(row[primaryTextField.key]) });
      setModal(null);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e && e.message) || String(e) };
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await _mleDelete(cfg, del[codeField.key]);
      await reload();
      session.record({ action: "Delete", module: cfg.moduleLabel, desc: `Deleted ${cfg.moduleLabel} ${del[primaryTextField.key]}`, tone: "danger" });
      toast.push({ title: tt("Record deleted", "Data dihapus"), description: String(del[primaryTextField.key]), tone: "error" });
      setDel(null);
    } catch (e) {
      toast.push({ title: tt("Delete failed", "Gagal menghapus"), description: (e && e.message) || String(e), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filtered.findIndex((x) => x[codeField.key] === r[codeField.key]);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    ...cfg.fields.map((f) => ({
      key: f.key,
      label: tt(f.label, f.labelId || f.label),
      width: f.width,
      render: (r) => {
        const val = r[f.key] == null || r[f.key] === "" ? "—" : String(r[f.key]);
        if (f.mono) return <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg, padding: "3px 8px", borderRadius: 6, letterSpacing: "0.04em" }}>{val}</span>;
        return <span style={{ fontSize: 13, fontWeight: f.kind === "name" ? 500 : 400, color: r[f.key] == null || r[f.key] === "" ? C.textSubtle : C.text }}>{val}</span>;
      },
    })),
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
      <OpsHero kicker="Master data" kickerIcon="database" title={tt(cfg.titleEn, cfg.titleId)}
        subtitle={tt(cfg.subtitleEn, cfg.subtitleId)} compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral" dot>{cfg.source}</Badge>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", row: null })}>{tt(cfg.addEn, cfg.addId)}</OpsHeroButton>
        </div>} />

      <OpsStatGrid cols={2}>
        <OpsStatCard icon={cfg.icon} label={tt("Total records", "Total data")} value={rows.length} iconTone="brand" />
        <OpsStatCard icon={hasFilter ? "search" : "list"} label={hasFilter ? tt("Matching search", "Cocok pencarian") : tt("In current view", "Dalam tampilan")} value={filtered.length} iconTone="blue" />
      </OpsStatGrid>

      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<div ref={ps.ref} style={{ width: 260 }}>
              <TextInput iconLeft="search" placeholder={tt(cfg.searchEn, cfg.searchId)} value={q} onChange={(e) => ps.setQuery(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
            </div>}
            right={<>
              {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={() => ps.setQuery("")}>{t("act.clear")}</Button>}
              <Badge tone="neutral">{filtered.length} {tt("of", "dari")} {rows.length}</Badge>
            </>} />
        </div>

        <DataTable columns={columns} data={pageRows} dense rowKey={codeField.key} onRowClick={(r) => setModal({ mode: "edit", row: r })}
          emptyTitle={loading ? tt("Loading…", "Memuat…") : (hasFilter ? tt("No records match your search", "Tidak ada data yang cocok") : tt("No records yet", "Belum ada data"))}
          emptyDesc={loading ? "" : (hasFilter ? tt("Try a different keyword or clear the filter.", "Coba kata kunci lain atau bersihkan filter.") : tt("Add the first record to start the catalog.", "Tambahkan data pertama untuk memulai katalog."))} />

        <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>

      <MasterLookupModal open={!!modal} mode={modal && modal.mode} row={modal && modal.row} cfg={cfg} busy={busy} onClose={() => setModal(null)} onSave={save} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2"
        title={tt("Delete record", "Hapus data")} subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<>
          <Button variant="secondary" onClick={() => setDel(null)} disabled={busy}>{tt("Cancel", "Batal")}</Button>
          <Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete} disabled={busy}>{tt("Delete", "Hapus")}</Button>
        </>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>
          {tt("Remove", "Hapus")} <b>{del && del[codeField.key]}</b>{nameField && del ? ` — ${del[nameField.key]}` : ""}?
        </p>
      </Modal>
    </OpsPage>
  );
}

function MasterLookupModal({ open, mode, row, cfg, busy, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const codeField = _mleField(cfg.fields, "code");
  const [form, setForm] = React.useState({});
  const [err, setErr] = React.useState("");
  const firstRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const base = {};
    cfg.fields.forEach((f) => { base[f.key] = row ? row[f.key] : (f.type === "number" && !f.optional ? 0 : ""); });
    setForm(base);
    setErr("");
    setTimeout(() => firstRef.current && firstRef.current.focus(), 0);
  }, [open, row, cfg.fields]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const res = await onSave(form);
    if (res && !res.ok) setErr(res.error);
  };

  const editable = cfg.fields.filter((f) => !(isEdit && f.kind === "code"));
  let firstAssigned = false;

  return (
    <Modal open={open} onClose={onClose} width={560} icon={cfg.icon}
      title={isEdit ? tt(`Edit ${cfg.titleEn}`, `Ubah ${cfg.titleId}`) : tt(`Add ${cfg.titleEn}`, `Tambah ${cfg.titleId}`)}
      subtitle={isEdit ? tt("Update this record.", "Perbarui data ini.") : tt("Create a new record.", "Buat data baru.")}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="check" onClick={submit} disabled={busy}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add", "Tambah")}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {cfg.fields.map((f) => {
          const locked = isEdit && f.kind === "code";
          const assignRef = !firstAssigned && !locked ? (firstAssigned = true, firstRef) : null;
          return (
            <Field key={f.key} label={tt(f.label, f.labelId || f.label)} required={!!f.required}
              helper={locked ? tt("Primary key — cannot be changed", "Kunci utama — tidak dapat diubah") : (f.helperEn ? tt(f.helperEn, f.helperId || f.helperEn) : undefined)}>
              <TextInput inputRef={assignRef} value={form[f.key] == null ? "" : String(form[f.key])} disabled={locked || busy}
                onChange={(e) => {
                  let v = e.target.value;
                  if (f.type === "number") v = v.replace(/[^0-9]/g, "");
                  if (f.max) v = v.slice(0, f.max);
                  set(f.key, v);
                  if (err) setErr("");
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && f.kind !== "payload") submit(); }}
                placeholder={f.placeholder || ""} />
            </Field>
          );
        })}
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

/* ---- The three VendorConnect lookup masters (split out of the old ReadOnly viewer) ---- */

const VENDOR_STATUS_CFG = {
  setKey: "vendor-status", setName: "Vendor Status", tableName: "MSTR_STATUS_T", owner: "VendorOnboarding",
  moduleLabel: "Vendor Status", source: "MSTR_STATUS_T", icon: "waypoints", sortBy: "order",
  titleEn: "Vendor Status", titleId: "Status Vendor",
  // This set IS the approval route: Approver Role makes a status an approval step, Next Id is where an
  // approval sends the vendor, SLA is the working-day target for that wait. There is no separate
  // workflow configuration — editing here re-routes the approval.
  subtitleEn: "Vendor lifecycle statuses and the approval route: who approves each one, where it goes next, and the working-day target.",
  subtitleId: "Status siklus hidup vendor beserta rute approval-nya: siapa yang menyetujui, ke status mana lanjutnya, dan target hari kerjanya.",
  addEn: "Add Status", addId: "Tambah Status", searchEn: "Search status…", searchId: "Cari status…",
  fields: [
    // 10 chars: the approval chain uses role-shaped codes such as DEPHD-VDR (9).
    { key: "id", kind: "code", label: "Status Id", labelId: "Id Status", width: 130, max: 10, required: true, mono: true, placeholder: "e.g. INVTD" },
    { key: "name", kind: "name", label: "Name", labelId: "Nama", width: 225, max: 50, required: true, placeholder: "e.g. Invited" },
    // The two prose columns carry the longest values in the set, so they get the room: the description
    // reads as a full sentence ("Waiting for Department Head Approval") and used to wrap at 150px.
    { key: "description", kind: "payload", label: "Description", labelId: "Deskripsi", width: 300, max: 150, placeholder: "e.g. Waiting for response from Vendor" },
    { key: "approverRoleCode", kind: "payload", label: "Approver Role", labelId: "Role Penyetuju", width: 150, max: 50, mono: true, placeholder: "e.g. DEPHD-VDR",
      helperEn: "Role code that approves at this status (blank = not an approval step)", helperId: "Kode role yang menyetujui pada status ini (kosong = bukan langkah approval)" },
    { key: "nextId", kind: "payload", label: "Next Id", labelId: "Id Berikutnya", width: 130, max: 10, mono: true, placeholder: "e.g. RSPND", helperEn: "Next status code in the lifecycle (blank = terminal)", helperId: "Kode status berikutnya (kosong = akhir)" },
    { key: "slaDays", kind: "payload", label: "SLA (working days)", labelId: "SLA (hari kerja)", type: "number", optional: true, width: 130, max: 3,
      helperEn: "Target while waiting here; weekends and holidays excluded (blank = untracked)", helperId: "Target selama menunggu di sini; akhir pekan dan hari libur dikecualikan (kosong = tanpa target)" },
    { key: "order", kind: "payload", label: "Order", labelId: "Urutan", type: "number", width: 90, max: 3 },
  ],
};

const KBLI_TYPE_CFG = {
  setKey: "kbli-type", setName: "KBLI Type", tableName: "MSTR_KBLI_TYPE_T", owner: "VendorOnboarding",
  moduleLabel: "KBLI Type", source: "MSTR_KBLI_TYPE_T", icon: "layers",
  titleEn: "KBLI Type", titleId: "Tipe KBLI",
  subtitleEn: "OSS risk-classification tiers assigned to a KBLI code.",
  subtitleId: "Tingkat klasifikasi risiko OSS untuk sebuah kode KBLI.",
  addEn: "Add Type", addId: "Tambah Tipe", searchEn: "Search type…", searchId: "Cari tipe…",
  fields: [
    { key: "id", kind: "code", label: "Type Id", labelId: "Id Tipe", width: 120, max: 10, required: true, mono: true, placeholder: "e.g. 1RH" },
    { key: "desc", kind: "name", label: "Description", labelId: "Deskripsi", required: true, max: 100, placeholder: "e.g. Rendah" },
  ],
};

const KBLI_STATUS_CFG = {
  setKey: "kbli-status", setName: "KBLI Status", tableName: "MSTR_KBLI_STATUS_T", owner: "VendorOnboarding",
  moduleLabel: "KBLI Status", source: "MSTR_KBLI_STATUS_T", icon: "badge-check",
  titleEn: "KBLI Status", titleId: "Status KBLI",
  subtitleEn: "Whether a vendor's KBLI permit has been issued.",
  subtitleId: "Status penerbitan izin KBLI vendor.",
  addEn: "Add Status", addId: "Tambah Status", searchEn: "Search status…", searchId: "Cari status…",
  fields: [
    { key: "id", kind: "code", label: "Status Id", labelId: "Id Status", width: 120, max: 5, required: true, mono: true, placeholder: "e.g. T" },
    { key: "desc", kind: "name", label: "Description", labelId: "Deskripsi", required: true, max: 100, placeholder: "e.g. Terbit" },
  ],
};

function VendorStatusMaster() { return <MasterLookupScreen cfg={VENDOR_STATUS_CFG} />; }
function KbliTypeMaster() { return <MasterLookupScreen cfg={KBLI_TYPE_CFG} />; }
function KbliStatusMaster() { return <MasterLookupScreen cfg={KBLI_STATUS_CFG} />; }

Object.assign(window, { MasterLookupScreen, VendorStatusMaster, KbliTypeMaster, KbliStatusMaster });
export { MasterLookupScreen, VendorStatusMaster, KbliTypeMaster, KbliStatusMaster };
