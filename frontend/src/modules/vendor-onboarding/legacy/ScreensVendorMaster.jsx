/* fm3-converted */
import React from "react";
import { VENDORS } from "./VendorData.jsx";
import { VENDOR_TONES, useVendorMaster } from "./VendorMasterData.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Field, Icon, IconButton, Select, TextInput, Textarea, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, PageHeader, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Vendor Onboarding screens.
   VendorRelationshipMaster   : CRUD list of vendor↔brand relationship types.
   VendorDocRequirementMaster : CRUD list of onboarding document requirements
                                with category, mandatory flag and validity period.
   Both follow the established Master Data pattern (PageHeader + MetricCards +
   DataTable + Modal) and read live counts from the VENDORS registry. */

function _vTone(C, tone) {
  return ({ brand: C.ocean, blue: C.blue, orange: C.orange, forest: C.forest, danger: C.danger })[tone] || C.ocean;
}

/* ============================================================
   VENDOR RELATIONSHIP TYPE — Master Data
   ============================================================ */
function VendorRelationshipMaster() {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const vm = useVendorMaster();
  const [modal, setModal] = React.useState(null); // { mode, rel }
  const [del, setDel] = React.useState(null);

  const save = (form) => {
    if (modal.mode === "edit") {
      vm.updateRelationship(form.id, { name: form.name, code: form.code, tone: form.tone, desc: form.desc });
      session.record({ action: "Update", module: "Vendor Relationship", desc: `Updated relationship ${form.name}`, tone: "brand" });
      toast.push({ title: tt("Distributor type updated", "Tipe distributor diperbarui"), description: form.name });
    } else {
      vm.addRelationship({ name: form.name, code: form.code, tone: form.tone, desc: form.desc });
      session.record({ action: "Create", module: "Vendor Relationship", desc: `Added relationship ${form.name}`, tone: "success" });
      toast.push({ title: tt("Distributor type added", "Tipe distributor ditambahkan"), description: form.name });
    }
    setModal(null);
  };
  const confirmDelete = () => {
    vm.removeRelationship(del.id);
    session.record({ action: "Delete", module: "Vendor Relationship", desc: `Deleted relationship ${del.name}`, tone: "danger" });
    toast.push({ title: tt("Distributor type deleted", "Tipe distributor dihapus"), tone: "error" });
    setDel(null);
  };

  const mapped = vm.vendorsWithRelationship;
  const topRel = React.useMemo(() => {
    let best = null, max = -1;
    vm.relationships.forEach((r) => { const n = vm.relationshipUseCount(r); if (n > max) { max = n; best = r; } });
    return best;
  }, [vm.relationships]);

  const columns = [
    { key: "name", label: tt("Distributor Type", "Tipe Distributor"), render: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
          backgroundColor: _vTone(C, r.tone) + "1A", color: _vTone(C, r.tone) }}><Icon name="handshake" size={17} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{r.name}</div>
          {r.desc && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>{r.desc}</div>}
        </div>
      </div>) },
    { key: "code", label: tt("Code", "Kode"), width: 120, render: (r) => <Badge tone={r.tone}>{r.code || "—"}</Badge> },
    { key: "used", label: tt("Used by", "Dipakai oleh"), width: 150, render: (r) => {
      const n = vm.relationshipUseCount(r);
      return <span style={{ fontSize: 12.5, color: n ? C.textMuted : C.textSubtle }}>{n} {tt(n === 1 ? "vendor" : "vendors", "vendor")}</span>;
    } },
    { key: "_reorder", label: tt("Order", "Urutan"), width: 92, render: (r) => {
      const i = vm.relationships.findIndex((x) => x.id === r.id);
      return (
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 2 }}>
          <IconButton name="chevron-up" size="sm" title={tt("Move up", "Naik")} onClick={() => vm.moveRelationship(r.id, -1)} style={i === 0 ? { opacity: 0.3, pointerEvents: "none" } : null} />
          <IconButton name="chevron-down" size="sm" title={tt("Move down", "Turun")} onClick={() => vm.moveRelationship(r.id, 1)} style={i === vm.relationships.length - 1 ? { opacity: 0.3, pointerEvents: "none" } : null} />
        </div>);
    } },
    { key: "_a", label: "", align: "right", width: 56, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="pencil" label={tt("Edit", "Ubah")} onClick={() => setModal({ mode: "edit", rel: r })} />
          <MenuDivider />
          <MenuItem icon="trash-2" label={tt("Delete", "Hapus")} danger onClick={() => setDel(r)} />
        </Menu>
      </div>) },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Distributor Type", "Tipe Distributor")}
        subtitle={tt("How a vendor is appointed for the brands it supplies (e.g. brand owner or authorised distributor). Used on the vendor Brand entry.",
          "Bagaimana vendor ditunjuk untuk merek yang dipasoknya (mis. brand owner atau distributor resmi). Dipakai pada entri Brand vendor.")}
        compact
        right={<OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", rel: null })}>{tt("Add type", "Tambah tipe")}</OpsHeroButton>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="handshake" label={tt("Distributor types", "Tipe distributor")} value={vm.relationships.length} iconTone="brand" />
        <OpsStatCard icon="building-2" label={tt("Vendors mapped", "Vendor terpetakan")} value={mapped} iconTone="blue" />
        <OpsStatCard icon="trophy" label={tt("Most common", "Paling umum")} value={topRel ? topRel.code : "—"} iconTone="forest" />
      </OpsStatGrid>

      <Card pad={0}>
        <DataTable columns={columns} data={vm.relationships} dense rowKey="id" onRowClick={(r) => setModal({ mode: "edit", rel: r })}
          emptyTitle={tt("No distributor types", "Belum ada tipe distributor")} emptyDesc={tt("Add the first distributor type to get started.", "Tambahkan tipe distributor pertama untuk memulai.")} />
      </Card>

      <RelationshipModal open={!!modal} mode={modal && modal.mode} rel={modal && modal.rel} onClose={() => setModal(null)} onSave={save} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete distributor type", "Hapus tipe distributor")} subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>{tt("Remove the", "Hapus tipe")} <b>{del && del.name}</b> {tt("distributor type?", "distributor ini?")}
          {del && vm.relationshipUseCount(del) > 0 && <> {tt("It currently maps to", "Saat ini terpetakan ke")} <b>{vm.relationshipUseCount(del)}</b> {tt("vendor(s).", "vendor.")}</>}</p>
      </Modal>
    </OpsPage>
  );
}

function RelationshipModal({ open, mode, rel, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const isEdit = mode === "edit";
  const blank = { name: "", code: "", tone: "brand", desc: "" };
  const [form, setForm] = React.useState(blank);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { if (open) { setForm(rel ? { ...blank, ...rel } : blank); setErr(""); } }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return setErr(tt("Enter the distributor type name.", "Masukkan nama tipe distributor."));
    onSave({ ...form, id: rel && rel.id, name: form.name.trim(), code: (form.code || "").trim().toUpperCase(), desc: (form.desc || "").trim() });
  };
  return (
    <Modal open={open} onClose={onClose} width={540} icon={isEdit ? "pencil" : "handshake"}
      title={isEdit ? tt("Edit distributor type", "Ubah tipe distributor") : tt("Add distributor type", "Tambah tipe distributor")}
      subtitle={isEdit ? tt("Update this distributor type", "Perbarui tipe distributor ini") : tt("Create a new distributor type", "Buat tipe distributor baru")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add type", "Tambah tipe")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14 }}>
          <Field label={tt("Distributor type name", "Nama tipe distributor")} required>
            <TextInput value={form.name} onChange={(e) => { set("name", e.target.value); if (err) setErr(""); }} placeholder={tt("e.g. Authorized Distributor", "mis. Distributor Resmi")} iconLeft="handshake" />
          </Field>
          <Field label={tt("Code", "Kode")} helper={tt("Short tag", "Tag singkat")}>
            <TextInput value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. DIST" />
          </Field>
        </div>
        <Field label={tt("Accent color", "Warna aksen")}>
          <div style={{ display: "flex", gap: 8 }}>
            {VENDOR_TONES.map((tn) => {
              const col = _vTone(C, tn); const active = form.tone === tn;
              return <button key={tn} type="button" onClick={() => set("tone", tn)} title={tn}
                style={{ width: 32, height: 32, borderRadius: RADIUS.md, cursor: "pointer", backgroundColor: col,
                  border: active ? `2px solid ${C.text}` : `2px solid transparent`, boxShadow: active ? C.focusRing : "none" }} />;
            })}
          </div>
        </Field>
        <Field label={tt("Description", "Deskripsi")} helper={tt("Optional — when this relationship applies.", "Opsional — kapan hubungan ini berlaku.")}>
          <Textarea value={form.desc} onChange={(e) => set("desc", e.target.value)} rows={3} placeholder={tt("Short description of the relationship", "Deskripsi singkat hubungan")} />
        </Field>
        {err && <Alert tone="error" title={err} />}
      </div>
    </Modal>
  );
}

/* ============================================================
   VENDOR DOCUMENT REQUIREMENT — Master Data
   ============================================================ */
function VendorDocRequirementMaster() {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const toast = useToast();
  const session = useSession();
  const vm = useVendorMaster();
  const [modal, setModal] = React.useState(null); // { mode, doc }
  const [del, setDel] = React.useState(null);

  const save = (form) => {
    const payload = { name: form.name, code: form.code, mandatory: form.mandatory,
      hasExpiry: form.hasExpiry, validityMonths: form.hasExpiry ? (Number(form.validityMonths) || 12) : 0, note: form.note };
    if (modal.mode === "edit") {
      vm.updateDoc(form.id, payload);
      session.record({ action: "Update", module: "Vendor Document", desc: `Updated document ${form.name}`, tone: "brand" });
      toast.push({ title: tt("Document updated", "Dokumen diperbarui"), description: form.name });
    } else {
      vm.addDoc(payload);
      session.record({ action: "Create", module: "Vendor Document", desc: `Added document ${form.name}`, tone: "success" });
      toast.push({ title: tt("Document added", "Dokumen ditambahkan"), description: form.name });
    }
    setModal(null);
  };
  const confirmDelete = () => {
    vm.removeDoc(del.id);
    session.record({ action: "Delete", module: "Vendor Document", desc: `Deleted document ${del.name}`, tone: "danger" });
    toast.push({ title: tt("Document deleted", "Dokumen dihapus"), tone: "error" });
    setDel(null);
  };

  const mandatoryCount = vm.docs.filter((d) => d.mandatory).length;
  const expiryCount = vm.docs.filter((d) => d.hasExpiry).length;
  const filtered = vm.docs;

  const columns = [
    { key: "name", label: tt("Document", "Dokumen"), render: (d) => (
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
            backgroundColor: C.brandBg, color: C.ocean }}><Icon name="file-check" size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{d.name}</div>
            {d.note && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 460 }}>{d.note}</div>}
          </div>
        </div>
    ) },
    { key: "code", label: tt("Code", "Kode"), width: 150, render: (d) => <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean }}>{d.code || "—"}</span> },
    { key: "req", label: tt("Requirement", "Kewajiban"), width: 120, render: (d) => d.mandatory
      ? <Badge tone="danger" dot>{tt("Mandatory", "Wajib")}</Badge>
      : <Badge tone="neutral">{tt("Optional", "Opsional")}</Badge> },
    { key: "validity", label: tt("Validity", "Masa berlaku"), width: 140, render: (d) => d.hasExpiry
      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, fontWeight: 600 }}><Icon name="timer-reset" size={14} color={C.orange} />{d.validityMonths} {tt("months", "bulan")}</span>
      : <span style={{ fontSize: 12.5, color: C.textSubtle }}>{tt("No expiry", "Tanpa kedaluwarsa")}</span> },
    { key: "onfile", label: tt("On file", "Tersedia"), width: 130, render: (d) => {
      const n = vm.docOnFileCount(d);
      if (n == null) return <span style={{ fontSize: 12.5, color: C.textSubtle }}>—</span>;
      return <span style={{ fontSize: 12.5, color: n ? C.textMuted : C.textSubtle }}>{n} {tt(n === 1 ? "vendor" : "vendors", "vendor")}</span>;
    } },
    { key: "_a", label: "", align: "right", width: 56, render: (d) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="pencil" label={tt("Edit", "Ubah")} onClick={() => setModal({ mode: "edit", doc: d })} />
          <MenuDivider />
          <MenuItem icon="trash-2" label={tt("Delete", "Hapus")} danger onClick={() => setDel(d)} />
        </Menu>
      </div>) },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Document Requirement", "Persyaratan Dokumen")}
        subtitle={tt("The legal, tax and certification documents a vendor must submit to onboard. Mandatory items gate registration; dated items are tracked for renewal.",
          "Dokumen legalitas, pajak, dan sertifikasi yang harus dilengkapi vendor saat onboarding. Item wajib menjadi syarat registrasi; item bermasa berlaku dipantau untuk perpanjangan.")}
        compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <OpsHeroButton variant="secondary" iconLeft="rotate-ccw" onClick={() => { vm.resetVendorMaster(); toast.push({ title: tt("Reset to defaults", "Dikembalikan ke awal"), tone: "info" }); }}>{tt("Reset defaults", "Reset default")}</OpsHeroButton>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", doc: null })}>{tt("Add document", "Tambah dokumen")}</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="files" label={tt("Document types", "Jenis dokumen")} value={vm.docs.length} iconTone="brand" />
        <OpsStatCard icon="shield-check" label={tt("Mandatory", "Wajib")} value={mandatoryCount} iconTone="orange" />
        <OpsStatCard icon="timer-reset" label={tt("Expiry-tracked", "Dipantau berlaku")} value={expiryCount} iconTone="blue" />
      </OpsStatGrid>

      <Card pad={0}>
        <DataTable columns={columns} data={filtered} dense rowKey="id" onRowClick={(d) => setModal({ mode: "edit", doc: d })}
          emptyTitle={tt("No documents", "Tidak ada dokumen")} emptyDesc={tt("No document requirements yet.", "Belum ada persyaratan dokumen.")} />
      </Card>

      <DocModal open={!!modal} mode={modal && modal.mode} doc={modal && modal.doc} onClose={() => setModal(null)} onSave={save} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title={tt("Delete document", "Hapus dokumen")} subtitle={tt("This action cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete", "Hapus")}</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>{tt("Remove the", "Hapus dokumen")} <b>{del && del.name}</b> {tt("document requirement?", "dari daftar persyaratan?")}</p>
      </Modal>
    </OpsPage>
  );
}

function DocModal({ open, mode, doc, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const isEdit = mode === "edit";
  const blank = { name: "", code: "", mandatory: false, hasExpiry: false, validityMonths: 12, note: "" };
  const [form, setForm] = React.useState(blank);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { if (open) { setForm(doc ? { ...blank, ...doc } : blank); setErr(""); } }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return setErr(tt("Enter the document name.", "Masukkan nama dokumen."));
    onSave({ ...form, id: doc && doc.id, name: form.name.trim(), code: (form.code || "").trim().toUpperCase(), note: (form.note || "").trim() });
  };
  return (
    <Modal open={open} onClose={onClose} width={560} icon={isEdit ? "pencil" : "file-check"}
      title={isEdit ? tt("Edit document requirement", "Ubah persyaratan dokumen") : tt("Add document requirement", "Tambah persyaratan dokumen")}
      subtitle={isEdit ? tt("Update this onboarding document", "Perbarui dokumen onboarding ini") : tt("Create a new onboarding document", "Buat dokumen onboarding baru")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" onClick={submit}>{isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add document", "Tambah dokumen")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14 }}>
          <Field label={tt("Document name", "Nama dokumen")} required>
            <TextInput value={form.name} onChange={(e) => { set("name", e.target.value); if (err) setErr(""); }} placeholder={tt("e.g. Nomor Induk Berusaha (NIB)", "mis. Nomor Induk Berusaha (NIB)")} iconLeft="file-check" />
          </Field>
          <Field label={tt("Code", "Kode")}>
            <TextInput value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. NIB" />
          </Field>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tt("Mandatory", "Wajib")}</div>
            <div style={{ fontSize: 11.5, color: C.textMuted }}>{tt("Required to complete registration.", "Wajib untuk menyelesaikan registrasi.")}</div>
          </div>
          <Toggle checked={form.mandatory} onChange={(on) => set("mandatory", on)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 14px", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tt("Has expiry", "Punya masa berlaku")}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted }}>{tt("Track this document for renewal.", "Pantau dokumen ini untuk perpanjangan.")}</div>
            </div>
            <Toggle checked={form.hasExpiry} onChange={(on) => set("hasExpiry", on)} />
          </div>
          {form.hasExpiry && (
            <Field label={tt("Valid for", "Berlaku selama")}>
              <Select value={String(form.validityMonths)} onChange={(e) => set("validityMonths", e.target.value)}
                options={[{ value: "12", label: "12 " + tt("months", "bulan") }, { value: "24", label: "24 " + tt("months", "bulan") }, { value: "36", label: "36 " + tt("months", "bulan") }, { value: "60", label: "60 " + tt("months", "bulan") }]} />
            </Field>
          )}
        </div>

        <Field label={tt("Description", "Deskripsi")} helper={tt("Optional — what this document covers.", "Opsional — cakupan dokumen ini.")}>
          <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} placeholder={tt("Short description of the document", "Deskripsi singkat dokumen")} />
        </Field>
        {err && <Alert tone="error" title={err} />}
      </div>
    </Modal>
  );
}

Object.assign(window, { VendorRelationshipMaster, VendorDocRequirementMaster });
export { VendorRelationshipMaster, VendorDocRequirementMaster };
