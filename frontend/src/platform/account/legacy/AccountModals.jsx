import React from "react";
import { useC, FONT, RADIUS } from "../../../shared/legacy/Tokens.jsx";
import { Icon, Button, Field, TextInput, Avatar, Badge } from "../../../shared/legacy/Primitives.jsx";
import { Modal, Alert, fmtAppDate, useToast } from "../../../shared/legacy/PrimitivesX.jsx";

/* Alamtri Geo Admin — account modals for the top-right user menu:
   View profile (read-only), Change password, and Change image (size-limited,
   updates the user avatar live). */

const MAX_AVATAR_MB = 2;

/* Read an image File → data URL, validating type and size. */
function readAvatarFile(file, onOk, onErr) {
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { onErr("Use a JPG, PNG, or WebP image."); return; }
  if (file.size > MAX_AVATAR_MB * 1024 * 1024) { onErr(`Image must be ${MAX_AVATAR_MB}MB or smaller.`); return; }
  const reader = new FileReader();
  reader.onload = () => onOk(reader.result);
  reader.onerror = () => onErr("Could not read that file.");
  reader.readAsDataURL(file);
}

/* Reusable password field with a show/hide toggle. */
function PasswordField({ label, required, helper, value, onChange, status, placeholder }) {
  const C = useC();
  const [show, setShow] = React.useState(false);
  return (
    <Field label={label} required={required} helper={helper} status={status}>
      <TextInput type={show ? "text" : "password"} iconLeft="lock" value={value} onChange={onChange} placeholder={placeholder} status={status}
        iconRight={<span onMouseDown={(e) => { e.preventDefault(); setShow((v) => !v); }} style={{ cursor: "pointer", display: "inline-flex", color: C.textMuted }}><Icon name={show ? "eye-off" : "eye"} size={16} /></span>} />
    </Field>
  );
}

/* ---------- View profile (read-only) ---------- */
function ProfileModal({ open, onClose, user }) {
  const C = useC();
  // Supplementary fields come from the session user (no USERS mock); missing ones fall back below.
  const record = user || {};
  const roles = (user.roles && user.roles.length) ? user.roles : (user.role ? [user.role] : []);
  const roleTone = (r) => (r === "Super Admin" ? "brand" : String(r).indexOf("Administrator") === 0 ? "info" : "neutral");
  const rows = [
    { icon: "user", label: "Full name", value: user.name },
    { icon: "at-sign", label: "Username", value: "@" + user.username },
    { icon: "mail", label: "Email", value: user.email },
    { icon: "shield", label: roles.length > 1 ? "Roles" : "Role", value: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        {roles.map((role) => <div key={role}>{role}</div>)}
      </div>
    ) },
    { icon: "calendar", label: "Member since", value: fmtAppDate(record.createdAt || "2024-01-12 09:14") },
    { icon: "clock", label: "Last active", value: record.lastActive || "Just now" },
  ];
  return (
    <Modal open={open} onClose={onClose} width={520} icon="id-card" title="My profile" subtitle="Your account details (read-only)"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 4px 18px", borderBottom: `1px solid ${C.borderSoft}`, marginBottom: 18 }}>
        <Avatar name={user.name} src={user.avatar} size={64} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{user.name}</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{user.email}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 7, flexWrap: "wrap" }}>
            {roles.map((r) => <Badge key={r} tone={roleTone(r)}>{r}</Badge>)}
            <Badge tone={String(record.status || "Active").toLowerCase() === "active" ? "success" : "neutral"} dot>{record.status || "Active"}</Badge>
          </div>
        </div>
      </div>
      <dl style={{ ...FONT, display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 0, columnGap: 14, margin: 0 }}>
        {rows.map((r, i) => (
          <React.Fragment key={r.label}>
            <dt style={{ display: "inline-flex", alignItems: r.icon === "shield" && roles.length > 1 ? "flex-start" : "center", gap: 9, padding: "11px 0", fontSize: 12.5, color: C.textMuted, fontWeight: 500, borderTop: i ? `1px solid ${C.borderSoft}` : "none" }}>
              <span style={{ width: 26, height: 26, borderRadius: RADIUS.sm, backgroundColor: C.surfaceAlt, color: C.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={r.icon} size={14} /></span>
              {r.label}
            </dt>
            <dd style={{ margin: 0, padding: "11px 0", fontSize: 13, color: C.text, fontWeight: 600, textAlign: "right", borderTop: i ? `1px solid ${C.borderSoft}` : "none", overflow: "hidden", textOverflow: r.icon === "shield" ? "clip" : "ellipsis", whiteSpace: r.icon === "shield" ? "normal" : "nowrap" }}>{r.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Modal>
  );
}

/* ---------- Change password ---------- */
function ChangePasswordModal({ open, onClose }) {
  const C = useC();
  const toast = useToast();
  const [cur, setCur] = React.useState("");
  const [next, setNext] = React.useState("");
  const [conf, setConf] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [policy, setPolicy] = React.useState(null);
  React.useEffect(() => {
    if (open) {
      setCur(""); setNext(""); setConf(""); setErr(""); setBusy(false);
      const authApi = window.__internalAuth;
      if (authApi && typeof authApi.passwordPolicy === "function") {
        authApi.passwordPolicy().then((data) => { if (data) setPolicy(data); }).catch(() => {});
      }
    }
  }, [open]);
  const p = policy || { minLength: 12, requireDigit: true, requireLowercase: true, requireUppercase: true, requireNonAlphanumeric: true };
  const checks = [
    { ok: next.length >= p.minLength, label: `At least ${p.minLength} characters` },
  ];
  if (p.requireUppercase) checks.push({ ok: /[A-Z]/.test(next), label: "Contains an uppercase letter" });
  if (p.requireLowercase) checks.push({ ok: /[a-z]/.test(next), label: "Contains a lowercase letter" });
  if (p.requireDigit) checks.push({ ok: /[0-9]/.test(next), label: "Contains a number" });
  if (p.requireNonAlphanumeric) checks.push({ ok: /[^a-zA-Z0-9]/.test(next), label: "Contains a symbol" });
  const submit = () => {
    if (!cur) return setErr("Enter your current password.");
    if (!checks.every((c) => c.ok)) return setErr("New password does not meet the requirements.");
    if (next !== conf) return setErr("New password and confirmation do not match.");
    setErr(""); setBusy(true);
    Promise.resolve(window.__internalAuth.changePassword(cur, next))
      .then(() => { toast.push({ title: "Password changed", description: "Your local password has been updated." }); onClose(); })
      .catch((error) => {
        const list = error && error.errors;
        setErr((Array.isArray(list) && list[0]) || error.message || "Could not update the password.");
      })
      .finally(() => setBusy(false));
  };
  return (
    <Modal open={open} onClose={onClose} width={480} icon="key-round" title="Change password" subtitle="Update the password for your account"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button iconLeft="check" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Update password"}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PasswordField label="Current password" required value={cur} onChange={(e) => { setCur(e.target.value); if (err) setErr(""); }} placeholder="Enter current password" />
        <PasswordField label="New password" required value={next} onChange={(e) => { setNext(e.target.value); if (err) setErr(""); }} placeholder="Enter new password" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          {checks.map((c) => (
            <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: c.ok ? C.success : C.textMuted }}>
              <Icon name={c.ok ? "check-circle-2" : "circle"} size={13} />{c.label}
            </span>
          ))}
        </div>
        <PasswordField label="Confirm new password" required value={conf} onChange={(e) => { setConf(e.target.value); if (err) setErr(""); }} placeholder="Re-enter new password"
          status={conf && next !== conf ? "error" : "default"} />
        {err && <Alert tone="error" title={err} />}
      </div>
    </Modal>
  );
}

/* ---------- Change image (updates avatar live on upload) ---------- */
function ChangeImageModal({ open, onClose, user, onApply, onRemove }) {
  const C = useC();
  const toast = useToast();
  const fileRef = React.useRef(null);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (open) { setErr(""); setBusy(false); } }, [open]);
  // Upload the real file to Blob (per-user, backend-owned) — no base64 in browser state.
  const pick = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { setErr("Use a JPG, PNG, or WebP image."); return; }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) { setErr(`Image must be ${MAX_AVATAR_MB}MB or smaller.`); return; }
    setErr(""); setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fetch("/api/v1/internal/auth/avatar", { method: "POST", credentials: "include", body: fd })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error((data && data.message) || "Could not upload the image.");
        onApply(data.avatarUrl);
        toast.push({ title: "Photo updated", description: "Your profile image was changed." });
      })
      .catch((e) => setErr(e.message || "Could not upload the image."))
      .finally(() => { setBusy(false); if (fileRef.current) fileRef.current.value = ""; });
  };
  const removePhoto = () => {
    setErr(""); setBusy(true);
    fetch("/api/v1/internal/auth/avatar", { method: "DELETE", credentials: "include" })
      .then((r) => { if (!r.ok && r.status !== 204) throw new Error(); onRemove(); toast.push({ title: "Photo removed" }); })
      .catch(() => setErr("Could not remove the photo."))
      .finally(() => setBusy(false));
  };
  return (
    <Modal open={open} onClose={onClose} width={440} icon="image" title="Change image" subtitle="Upload a new profile photo"
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <Avatar name={user.name} src={user.avatar} size={104} />
        <div
          onClick={() => fileRef.current && fileRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files && e.dataTransfer.files[0]); }}
          style={{ width: "100%", border: `1.5px dashed ${C.border}`, borderRadius: RADIUS.md, padding: "22px 16px", textAlign: "center", cursor: "pointer", backgroundColor: C.surfaceAlt }}>
          <span style={{ display: "inline-flex", width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, alignItems: "center", justifyContent: "center", marginBottom: 8 }}><Icon name="upload-cloud" size={18} /></span>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Click to upload or drag an image here</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>JPG, PNG, or WebP · up to {MAX_AVATAR_MB}MB</div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => pick(e.target.files && e.target.files[0])} />
        </div>
        {err && <div style={{ width: "100%" }}><Alert tone="error" title={err} /></div>}
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <Button variant="secondary" iconLeft="upload" disabled={busy} style={{ flex: 1, justifyContent: "center" }} onClick={() => fileRef.current && fileRef.current.click()}>{busy ? "Uploading…" : "Upload"}</Button>
          {user.avatar && <Button variant="secondary" iconLeft="trash-2" disabled={busy} style={{ flex: 1, justifyContent: "center" }} onClick={removePhoto}>Remove photo</Button>}
        </div>
      </div>
    </Modal>
  );
}

export { ProfileModal, ChangePasswordModal, ChangeImageModal, PasswordField, readAvatarFile, MAX_AVATAR_MB };
Object.assign(window, { ProfileModal, ChangePasswordModal, ChangeImageModal, PasswordField, readAvatarFile, MAX_AVATAR_MB });
