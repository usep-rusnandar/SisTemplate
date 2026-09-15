/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, IconButton, TableRefreshButton, Badge, StatusBadge, Avatar, Card, TextInput, Field, Select, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { Alert, Spinner, Menu, MenuItem, MenuDivider, Modal, DataTable, Pagination, useToast, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard } from "../../../shared/legacy/PrimitivesX.jsx";
import { PasswordField } from "../../account/legacy/AccountModals.jsx";
import { useSession } from "../../session/legacy/Session.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
/* Alamtri Geo Admin — Vendor Contacts: people linked to each vendor company.
   Only the PIC Vendor holds the Vendor Workspace login key; everyone else is a backup contact. */

function vendorContactsApiPart(value) { return encodeURIComponent(String(value || "")); }
function vendorContactFromApi(row) {
  return {
    id: row.id,
    vendorId: row.vendorId || "",
    vendorName: row.vendorName || "",
    identityUserId: row.identityUserId || "",
    name: String(row.name || "").toUpperCase(),
    email: row.email || "",
    phone: row.phone || "",
    position: row.position || "",
    status: row.status === "Active" ? "Active" : "Inactive",
    isActive: row.isActive !== false,
    hasLogin: !!row.hasLogin,
    isWorkspacePic: !!row.isWorkspacePic,
  };
}
async function vendorContactsJson(path, options) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...((options && options.headers) || {}) },
    ...(options || {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error((data && (data.message || data.title)) || `Vendor contacts API failed: ${response.status}`);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return response.status === 204 ? null : data;
}

const VENDOR_CONTACT_PWD_DEFAULT = { minLength: 12, requireDigit: true, requireLowercase: true, requireUppercase: true, requireNonAlphanumeric: true };
function vendorContactPwdChecks(password, policy, tt) {
  const p = policy || VENDOR_CONTACT_PWD_DEFAULT;
  const pwd = password || "";
  const rows = [{ ok: pwd.length >= p.minLength, label: tt(`At least ${p.minLength} characters`, `Minimal ${p.minLength} karakter`) }];
  if (p.requireUppercase) rows.push({ ok: /[A-Z]/.test(pwd), label: tt("Contains an uppercase letter", "Mengandung huruf besar") });
  if (p.requireLowercase) rows.push({ ok: /[a-z]/.test(pwd), label: tt("Contains a lowercase letter", "Mengandung huruf kecil") });
  if (p.requireDigit) rows.push({ ok: /[0-9]/.test(pwd), label: tt("Contains a number", "Mengandung angka") });
  if (p.requireNonAlphanumeric) rows.push({ ok: /[^a-zA-Z0-9]/.test(pwd), label: tt("Contains a symbol", "Mengandung simbol") });
  return rows;
}

function WorkspaceKeyMark({ pic, size = 28 }) {
  const C = useC();
  const fill = pic ? C.ocean : (C.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(1,59,82,0.06)");
  const stroke = pic ? C.ocean : C.border;
  const icon = pic ? "#fff" : C.textSubtle;
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: 9, flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      backgroundColor: fill, border: `1.5px solid ${stroke}`,
      boxShadow: pic ? "0 0 0 3px rgba(1,59,82,0.12)" : "none",
    }}>
      <Icon name="key-round" size={Math.round(size * 0.46)} color={icon} />
    </span>
  );
}

function VendorContactModal({ open, mode, contact, vendors, onClose, onSave }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const blank = { vendorId: "", name: "", email: "", phone: "", position: "", status: "Active", isWorkspacePic: false };
  const [form, setForm] = React.useState(blank);
  const [vendorQ, setVendorQ] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setForm(contact ? {
      vendorId: contact.vendorId || "",
      name: String(contact.name || "").toUpperCase(),
      email: contact.email || "",
      phone: contact.phone || "",
      position: contact.position || "",
      status: contact.status === "Active" ? "Active" : "Inactive",
      isWorkspacePic: !!contact.isWorkspacePic,
    } : { ...blank });
    setVendorQ("");
    setErr("");
    setBusy(false);
  }, [open, contact]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: k === "name" && typeof v === "string" ? v.toUpperCase() : v }));
  const isEdit = mode === "edit";
  const selectedVendor = (vendors || []).find((v) => v.id === form.vendorId);
  const vendorMatches = React.useMemo(() => {
    const q = vendorQ.trim().toLowerCase();
    const list = vendors || [];
    if (!q) return list.slice(0, 40);
    return list.filter((v) => (v.name || "").toLowerCase().includes(q) || (v.id || "").toLowerCase().includes(q)).slice(0, 40);
  }, [vendors, vendorQ]);
  const fail = (msg) => {
    setErr(msg);
    toast.push({ title: tt("Could not save", "Tidak dapat menyimpan"), description: msg, tone: "error" });
  };
  const submit = async () => {
    if (!isEdit && !form.vendorId) { fail(tt("Choose a vendor.", "Pilih vendor.")); return; }
    if (!String(form.name || "").trim()) { fail(tt("Name is required.", "Nama wajib diisi.")); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(form.email || "").trim())) { fail(tt("Enter a valid email address.", "Masukkan alamat email yang valid.")); return; }
    setBusy(true); setErr("");
    try {
      await onSave({ ...form, name: String(form.name || "").trim().toUpperCase(), status: form.status === "Active" ? "Active" : "Inactive" }, mode);
    } catch (e) {
      fail(e.message || tt("Could not save the contact.", "Tidak dapat menyimpan kontak."));
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} width={560} icon={isEdit ? "user-cog" : "user-plus"}
      title={isEdit ? tt("Edit contact", "Ubah kontak") : tt("Add contact", "Tambah kontak")}
      subtitle={isEdit
        ? (contact && contact.vendorName) || ""
        : tt("A backup contact unless you give them the Vendor Workspace key.", "Kontak cadangan, kecuali Anda berikan kunci Vendor Workspace.")}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="check" disabled={busy} onClick={submit}>{busy ? <Spinner size={14} /> : (isEdit ? tt("Save changes", "Simpan perubahan") : tt("Add contact", "Tambah kontak"))}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!isEdit && (
          <Field label={tt("Vendor", "Vendor")} required helper={selectedVendor ? `${selectedVendor.name} · ${selectedVendor.id}` : tt("Search by company name or vendor id.", "Cari nama perusahaan atau id vendor.")}>
            <TextInput iconLeft="building-2" value={selectedVendor && !vendorQ ? selectedVendor.name : vendorQ}
              onChange={(e) => { setVendorQ(e.target.value); if (form.vendorId) set("vendorId", ""); }}
              placeholder={tt("Search vendor…", "Cari vendor…")} />
            <div style={{ marginTop: 8, maxHeight: 168, overflowY: "auto", border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md }}>
              {vendorMatches.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12.5, color: C.textMuted }}>{tt("No vendors match.", "Tidak ada vendor yang cocok.")}</div>}
              {vendorMatches.map((v) => {
                const on = v.id === form.vendorId;
                return (
                  <button key={v.id} type="button" onClick={() => { set("vendorId", v.id); setVendorQ(""); }}
                    style={{ ...FONT, display: "flex", width: "100%", textAlign: "left", gap: 10, alignItems: "center", padding: "8px 12px", border: "none",
                      backgroundColor: on ? C.brandBg : "transparent", cursor: "pointer", color: C.text }}>
                    <Icon name={on ? "check" : "building-2"} size={14} color={on ? C.ocean : C.textMuted} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 650 }}>{v.name}</span>
                      <span style={{ display: "block", fontSize: 11, color: C.textMuted }}>{v.id} · {v.status}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={tt("Full name", "Nama lengkap")} required><TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={tt("e.g. SITI RAHMA", "mis. SITI RAHMA")} /></Field>
          <Field label={tt("Email", "Email")} required><TextInput value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@vendor.co.id" iconLeft="mail" /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={tt("Position", "Jabatan")}><TextInput value={form.position} onChange={(e) => set("position", e.target.value)} placeholder={tt("e.g. Sales Manager", "mis. Sales Manager")} /></Field>
          <Field label={tt("Mobile Phone", "Telepon Seluler")}><TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0812 0000 0000" iconLeft="phone" /></Field>
        </div>
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
          borderRadius: RADIUS.md, border: `1px solid ${form.status === "Active" ? C.ocean : C.border}`,
          backgroundColor: form.status === "Active" ? C.brandBg : C.surfaceAlt,
        }}>
          <span aria-hidden="true" style={{
            width: 28, height: 28, borderRadius: 9, flexShrink: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            backgroundColor: form.status === "Active" ? C.ocean : (C.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(1,59,82,0.06)"),
            border: `1.5px solid ${form.status === "Active" ? C.ocean : C.border}`,
          }}>
            <Icon name={form.status === "Active" ? "user-check" : "user-x"} size={13} color={form.status === "Active" ? "#fff" : C.textSubtle} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{form.status === "Active" ? tt("Active", "Aktif") : tt("Inactive", "Tidak aktif")}</div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginTop: 3 }}>
              {form.status === "Active"
                ? tt("This contact is in use. Turn off to deactivate the account.", "Kontak ini dipakai. Matikan untuk menonaktifkan akun.")
                : tt("This contact is inactive.", "Kontak ini tidak aktif.")}
            </div>
          </div>
          <Toggle checked={form.status === "Active"} onChange={(v) => set("status", v ? "Active" : "Inactive")} />
        </div>
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
          borderRadius: RADIUS.md, border: `1px solid ${form.isWorkspacePic ? C.ocean : C.border}`,
          backgroundColor: form.isWorkspacePic ? C.brandBg : C.surfaceAlt,
        }}>
          <WorkspaceKeyMark pic={form.isWorkspacePic} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{tt("PIC Vendor", "PIC Vendor")}</div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginTop: 3 }}>
              {form.isWorkspacePic
                ? tt("This person is the only one who can sign in to Vendor Workspace. Another PIC on the same vendor becomes a backup contact.",
                  "Hanya orang ini yang dapat masuk ke Vendor Workspace. PIC lain pada vendor yang sama menjadi kontak cadangan.")
                : tt("Backup contact. They can be used in other applications, but they cannot sign in to Vendor Workspace.",
                  "Kontak cadangan. Bisa dipakai di aplikasi lain, tetapi tidak dapat masuk ke Vendor Workspace.")}
            </div>
          </div>
          <Toggle checked={form.isWorkspacePic} onChange={(v) => set("isWorkspacePic", v)} disabled={isEdit && contact && contact.isWorkspacePic} />
        </div>
        {err && <Alert tone="danger" title={tt("Could not save", "Tidak dapat menyimpan")} description={err} />}
      </div>
    </Modal>
  );
}

function VendorContactPasswordModal({ open, contact, onClose, onSaved }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const [next, setNext] = React.useState("");
  const [conf, setConf] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [policy, setPolicy] = React.useState(VENDOR_CONTACT_PWD_DEFAULT);
  React.useEffect(() => {
    if (!open) return;
    setNext(""); setConf(""); setErr(""); setBusy(false);
    vendorContactsJson("/api/v1/vendor-onboarding/contacts/password-policy")
      .then((d) => setPolicy({
        minLength: Number(d && d.minLength) || VENDOR_CONTACT_PWD_DEFAULT.minLength,
        requireDigit: !!(d && d.requireDigit),
        requireLowercase: !!(d && d.requireLowercase),
        requireUppercase: !!(d && d.requireUppercase),
        requireNonAlphanumeric: !!(d && d.requireNonAlphanumeric),
      }))
      .catch(() => setPolicy(VENDOR_CONTACT_PWD_DEFAULT));
  }, [open, contact]);
  const checks = vendorContactPwdChecks(next, policy, tt);
  const fail = (msg) => {
    setErr(msg);
    toast.push({ title: tt("Could not change password", "Tidak dapat mengubah kata sandi"), description: msg, tone: "error" });
  };
  const submit = async () => {
    if (!checks.every((c) => c.ok)) { fail(tt("New password does not meet the requirements.", "Kata sandi baru tidak memenuhi persyaratan.")); return; }
    if (next !== conf) { fail(tt("New password and confirmation do not match.", "Kata sandi baru dan konfirmasi tidak sama.")); return; }
    setBusy(true); setErr("");
    try {
      await vendorContactsJson(`/api/v1/vendor-onboarding/contacts/${vendorContactsApiPart(contact.id)}/password`, {
        method: "POST", body: JSON.stringify({ newPassword: next }),
      });
      toast.push({ title: tt("Password updated", "Kata sandi diperbarui"), description: contact.name });
      onSaved();
    } catch (e) {
      fail(e.message || tt("Could not change the password.", "Tidak dapat mengubah kata sandi."));
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} width={480} icon="lock"
      title={tt("Change password", "Ubah kata sandi")}
      subtitle={contact ? `${contact.name} · ${contact.email || ""}` : ""}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="check" disabled={busy || !contact} onClick={submit}>{busy ? <Spinner size={14} /> : tt("Update password", "Perbarui kata sandi")}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5, margin: 0 }}>
          {contact && contact.isWorkspacePic
            ? tt("They can sign in to Vendor Workspace with this password immediately.", "Mereka dapat masuk ke Vendor Workspace dengan kata sandi ini sekarang.")
            : tt("This password is stored on their account. They can sign in only after they become PIC Vendor.", "Kata sandi disimpan di akun mereka. Mereka baru dapat masuk setelah menjadi PIC Vendor.")}
        </p>
        <PasswordField label={tt("New password", "Kata sandi baru")} required value={next} onChange={(e) => { setNext(e.target.value); if (err) setErr(""); }} placeholder={tt("Enter new password", "Masukkan kata sandi baru")} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          {checks.map((c) => (
            <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: c.ok ? C.success : C.textMuted }}>
              <Icon name={c.ok ? "check-circle-2" : "circle"} size={13} />{c.label}
            </span>
          ))}
        </div>
        <PasswordField label={tt("Confirm new password", "Konfirmasi kata sandi baru")} required value={conf} onChange={(e) => { setConf(e.target.value); if (err) setErr(""); }} placeholder={tt("Re-enter new password", "Masukkan ulang kata sandi baru")}
          status={conf && next !== conf ? "error" : "default"} />
        {err && <Alert tone="danger" title={tt("Could not change password", "Tidak dapat mengubah kata sandi")} description={err} />}
      </div>
    </Modal>
  );
}

function VendorContacts() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const canManage = session.can("vendorOnboarding.contacts");
  const [rows, setRows] = React.useState([]);
  const [vendors, setVendors] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [roleF, setRoleF] = React.useState("all");
  const [vendorF, setVendorF] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("vendorName");
  const [sortDir, setSortDir] = React.useState("asc");
  const [modal, setModal] = React.useState({ open: false, mode: "create", contact: null });
  const [picTarget, setPicTarget] = React.useState(null);
  const [pwdTarget, setPwdTarget] = React.useState(null);
  const [del, setDel] = React.useState(null);
  const ps = usePageSearch(tt("Search name, email, vendor…", "Cari nama, email, vendor…"));
  const q = ps.query, setQ = ps.setQuery;

  const load = React.useCallback(async (showToast) => {
    setLoading(true);
    try {
      const [list, vendorList] = await Promise.all([
        vendorContactsJson("/api/v1/vendor-onboarding/contacts"),
        vendorContactsJson("/api/v1/vendor-onboarding/contacts/vendors"),
      ]);
      setRows((Array.isArray(list) ? list : []).map(vendorContactFromApi));
      setVendors(Array.isArray(vendorList) ? vendorList : []);
      if (showToast) toast.push({ title: tt("Refreshed", "Diperbarui"), description: tt("Contact list is up to date.", "Daftar kontak sudah mutakhir.") });
    } catch (e) {
      console.warn("Vendor contacts API unavailable.", e);
      toast.push({ title: tt("Could not load contacts", "Tidak dapat memuat kontak"), description: e.message || "", tone: "error" });
    } finally { setLoading(false); }
  }, [toast, tt]);
  React.useEffect(() => { load(false); }, [load]);

  const vendorOptions = React.useMemo(() => {
    const seen = new Map();
    rows.forEach((r) => { if (r.vendorId && !seen.has(r.vendorId)) seen.set(r.vendorId, r.vendorName || r.vendorId); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = rows.filter((r) =>
      (roleF === "all" || (roleF === "pic" ? r.isWorkspacePic : !r.isWorkspacePic)) &&
      (vendorF === "all" || r.vendorId === vendorF) &&
      (term === "" || [r.name, r.email, r.phone, r.position, r.vendorName, r.vendorId].filter(Boolean).some((s) => String(s).toLowerCase().includes(term))));
    list = [...list].sort((a, b) => {
      if (sortKey === "isWorkspacePic") {
        const c = (a.isWorkspacePic === b.isWorkspacePic) ? 0 : (a.isWorkspacePic ? -1 : 1);
        return sortDir === "asc" ? c : -c;
      }
      const av = a[sortKey], bv = b[sortKey];
      const c = typeof av === "string" ? av.localeCompare(bv || "") : (av || 0) - (bv || 0);
      return sortDir === "asc" ? c : -c;
    });
    return list;
  }, [rows, q, roleF, vendorF, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount]);
  const doSort = (k) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } };

  const picCount = rows.filter((r) => r.isWorkspacePic).length;
  const backupCount = rows.length - picCount;
  const currentPicFor = (vendorId) => rows.find((r) => r.vendorId === vendorId && r.isWorkspacePic);

  const save = async (form, mode) => {
    const payload = {
      vendorId: form.vendorId,
      name: form.name,
      email: form.email,
      phone: form.phone || "",
      position: form.position || "",
      status: form.status,
      isWorkspacePic: !!form.isWorkspacePic,
    };
    if (mode === "edit") {
      await vendorContactsJson(`/api/v1/vendor-onboarding/contacts/${vendorContactsApiPart(modal.contact.id)}`, {
        method: "PUT", body: JSON.stringify(payload),
      });
      toast.push({ title: tt("Contact updated", "Kontak diperbarui"), description: form.name });
    } else {
      await vendorContactsJson("/api/v1/vendor-onboarding/contacts", {
        method: "POST", body: JSON.stringify(payload),
      });
      toast.push({ title: tt("Contact added", "Kontak ditambahkan"), description: form.name });
    }
    setModal({ open: false, mode: "create", contact: null });
    await load(false);
  };

  const confirmPic = async () => {
    const target = picTarget;
    if (!target) return;
    try {
      await vendorContactsJson(`/api/v1/vendor-onboarding/contacts/${vendorContactsApiPart(target.id)}/workspace-pic`, { method: "POST" });
      toast.push({ title: tt("PIC Vendor updated", "PIC Vendor diperbarui"), description: tt(`${target.name} can now sign in to Vendor Workspace.`, `${target.name} kini dapat masuk ke Vendor Workspace.`) });
      setPicTarget(null);
      await load(false);
    } catch (e) {
      toast.push({ title: tt("Could not change PIC", "Tidak dapat mengubah PIC"), description: e.message || "", tone: "error" });
    }
  };

  const confirmDelete = async () => {
    const target = del;
    if (!target) return;
    try {
      await vendorContactsJson(`/api/v1/vendor-onboarding/contacts/${vendorContactsApiPart(target.id)}`, { method: "DELETE" });
      toast.push({ title: tt("Contact deleted", "Kontak dihapus"), description: target.name });
      setDel(null);
      await load(false);
    } catch (e) {
      toast.push({ title: tt("Could not delete", "Tidak dapat menghapus"), description: e.message || "", tone: "error" });
    }
  };

  const columns = [
    { key: "name", label: tt("Contact", "Kontak"), sortable: true, nowrap: true, render: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 11, borderLeft: r.isWorkspacePic ? `3px solid ${C.ocean}` : "3px solid transparent", marginLeft: -10, paddingLeft: 7 }}>
        <Avatar name={r.name} size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>{r.name}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, whiteSpace: "nowrap" }}>{r.email || "—"}</div>
        </div>
      </div>) },
    { key: "position", label: tt("Position", "Jabatan"), sortable: true, width: 180, render: (r) => (
      <span style={{ fontSize: 12.5, color: C.text }}>{r.position || "—"}</span>) },
    { key: "phone", label: tt("Mobile Phone", "Telepon Seluler"), sortable: true, width: 160, render: (r) => (
      <span style={{ fontSize: 12.5, color: C.text }}>{r.phone || "—"}</span>) },
    { key: "vendorName", label: tt("Vendor", "Vendor"), sortable: true, nowrap: true, render: (r) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: C.text }}>{r.vendorName}</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{r.vendorId}</div>
      </div>) },
    { key: "isWorkspacePic", label: tt("Workspace key", "Kunci workspace"), sortable: true, width: 188, render: (r) => (
      r.isWorkspacePic
        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <WorkspaceKeyMark pic size={22} />
            <Badge tone="brand">{tt("PIC Vendor", "PIC Vendor")}</Badge>
          </span>
        : <button type="button" onClick={(e) => { e.stopPropagation(); if (canManage) setPicTarget(r); }}
            title={tt("Give this person the Vendor Workspace key", "Berikan kunci Vendor Workspace kepada orang ini")}
            style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 8, border: `1px dashed ${C.border}`, background: "transparent",
              borderRadius: RADIUS.pill, padding: "3px 10px 3px 4px", cursor: canManage ? "pointer" : "default", color: C.textMuted }}>
            <WorkspaceKeyMark pic={false} size={22} />
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>{tt("Cadangan", "Cadangan")}</span>
          </button>) },
    { key: "hasLogin", label: tt("Workspace login", "Login workspace"), sortable: true, width: 150, render: (r) => (
      r.isWorkspacePic
        ? <Badge tone={r.hasLogin ? "success" : "warning"}>{r.hasLogin ? tt("Activated", "Sudah aktivasi") : tt("Needs activation", "Perlu aktivasi")}</Badge>
        : <span style={{ fontSize: 12, color: C.textSubtle }}>{tt("No workspace access", "Tanpa akses workspace")}</span>
    ) },
    { key: "status", label: t("common.status"), sortable: true, width: 130, render: (r) => (
      <StatusBadge status={r.status === "Active" ? "Active" : "Inactive"} />
    ) },
    { key: "_a", label: t("common.actions"), align: "right", width: 60, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={240} trigger={<IconButton name="more-horizontal" size="sm" />}>
          {canManage && <MenuItem icon="pencil" label={t("act.edit")} onClick={() => setModal({ open: true, mode: "edit", contact: r })} />}
          {canManage && <MenuItem icon="lock" label={tt("Change password", "Ubah kata sandi")} onClick={() => setPwdTarget(r)} />}
          {canManage && !r.isWorkspacePic && <MenuItem icon="key-round" label={tt("Make PIC Vendor", "Jadikan PIC Vendor")} onClick={() => setPicTarget(r)} />}
          {canManage && !r.isWorkspacePic && <><MenuDivider /><MenuItem icon="trash-2" label={t("act.delete")} danger onClick={() => setDel(r)} /></>}
        </Menu>
      </div>) },
  ];

  const outgoingPic = picTarget ? currentPicFor(picTarget.vendorId) : null;

  return (
    <OpsPage>
      <OpsHero kicker={t("nav.vendor")} kickerIcon="building-2" title={t("nav.vendorContacts")}
        subtitle={tt("People linked to each vendor. Only the PIC Vendor can sign in to Vendor Workspace.",
          "Orang yang terhubung ke setiap vendor. Hanya PIC Vendor yang dapat masuk ke Vendor Workspace.")}
        compact
        right={canManage ? <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ open: true, mode: "create", contact: null })}>{tt("Add contact", "Tambah kontak")}</OpsHeroButton> : null} />
      <OpsStatGrid cols={4}>
        <OpsStatCard icon="users-round" label={tt("Contacts", "Kontak")} value={rows.length} iconTone="brand" />
        <OpsStatCard icon="key-round" label={tt("PIC Vendor", "PIC Vendor")} value={picCount} iconTone="forest" />
        <OpsStatCard icon="user-round" label={tt("Cadangan", "Cadangan")} value={backupCount} iconTone="blue" />
        <OpsStatCard icon="filter" label={tt("Filtered", "Terfilter")} value={filtered.length} sub={filtered.length !== rows.length ? tt("matching filters", "sesuai filter") : tt("all contacts", "semua kontak")} iconTone="orange" />
      </OpsStatGrid>

      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 260 }}><TextInput iconLeft="search" placeholder={tt("Search name, email, vendor…", "Cari nama, email, vendor…")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              <div style={{ width: 168 }}><Select value={roleF} onChange={(e) => { setRoleF(e.target.value); setPage(1); }} options={[
                { value: "all", label: tt("All roles", "Semua peran") },
                { value: "pic", label: tt("PIC Vendor", "PIC Vendor") },
                { value: "backup", label: tt("Cadangan", "Cadangan") },
              ]} /></div>
              <div style={{ width: 220 }}><Select value={vendorF} onChange={(e) => { setVendorF(e.target.value); setPage(1); }} options={[{ value: "all", label: tt("All vendors", "Semua vendor") }, ...vendorOptions]} /></div>
              {(q || roleF !== "all" || vendorF !== "all") && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setRoleF("all"); setVendorF("all"); }}>{t("act.clear")}</Button>}
            </>}
            right={<TableRefreshButton onClick={() => load(true)} />} />
        </div>

        <DataTable columns={columns} data={pageRows} loading={loading} dense
          sortKey={sortKey} sortDir={sortDir} onSort={doSort}
          onRowClick={canManage ? (r) => setModal({ open: true, mode: "edit", contact: r }) : undefined}
          emptyTitle={tt("No vendor contacts yet", "Belum ada kontak vendor")}
          emptyDesc={tt("Add a backup contact, or set who holds the Vendor Workspace key.", "Tambah kontak cadangan, atau tentukan siapa yang memegang kunci Vendor Workspace.")} />

        <div style={{ padding: "4px 16px 12px" }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>

      <VendorContactModal open={modal.open} mode={modal.mode} contact={modal.contact} vendors={vendors}
        onClose={() => setModal({ ...modal, open: false })} onSave={save} />

      <VendorContactPasswordModal open={!!pwdTarget} contact={pwdTarget}
        onClose={() => setPwdTarget(null)}
        onSaved={() => { setPwdTarget(null); load(false); }} />

      <Modal open={!!picTarget} onClose={() => setPicTarget(null)} width={460} icon="key-round"
        title={tt("Give the workspace key", "Serahkan kunci workspace")}
        subtitle={picTarget && picTarget.vendorName}
        footer={<>
          <Button variant="secondary" onClick={() => setPicTarget(null)}>{tt("Cancel", "Batal")}</Button>
          <Button iconLeft="key-round" onClick={confirmPic}>{tt("Make PIC Vendor", "Jadikan PIC Vendor")}</Button>
        </>}>
        {picTarget && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>
              {tt("Only one person per vendor can sign in to Vendor Workspace.", "Hanya satu orang per vendor yang dapat masuk ke Vendor Workspace.")}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${C.ocean}33`, borderRadius: RADIUS.md, backgroundColor: C.brandBg }}>
              <WorkspaceKeyMark pic />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{picTarget.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{picTarget.email}</div>
              </div>
            </div>
            {outgoingPic && outgoingPic.id !== picTarget.id && (
              <Alert tone="info" title={tt("Current PIC becomes a backup", "PIC saat ini menjadi cadangan")}
                description={tt(`${outgoingPic.name} will no longer be able to sign in.`, `${outgoingPic.name} tidak lagi dapat masuk.`)} />
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} width={420} icon="trash-2"
        title={tt("Delete contact", "Hapus kontak")}
        subtitle={tt("This cannot be undone.", "Tindakan ini tidak dapat dibatalkan.")}
        footer={<>
          <Button variant="secondary" onClick={() => setDel(null)}>{tt("Cancel", "Batal")}</Button>
          <Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>{tt("Delete contact", "Hapus kontak")}</Button>
        </>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>
          {tt("Remove ", "Hapus ")}<b>{del && del.name}</b>{tt(" from ", " dari ")}<b>{del && del.vendorName}</b>?
          {tt(" They will no longer appear as a vendor contact.", " Mereka tidak lagi tampil sebagai kontak vendor.")}
        </p>
      </Modal>
    </OpsPage>
  );
}

Object.assign(window, { VendorContacts, vendorContactsJson, vendorContactFromApi });
export { VendorContacts, vendorContactsJson, vendorContactFromApi };
