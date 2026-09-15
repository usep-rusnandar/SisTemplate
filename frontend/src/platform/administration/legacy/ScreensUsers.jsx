/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, IconButton, TableRefreshButton, Badge, StatusBadge, Avatar, Card, TextInput, Field, Select, Checkbox, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDateTime, Alert, Tabs, Menu, MenuItem, MenuDivider, Modal, DataTable, Pagination, useToast, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard, Tooltip } from "../../../shared/legacy/PrimitivesX.jsx";
import { readAvatarFile, PasswordField } from "../../account/legacy/AccountModals.jsx";
import { PasswordRuleList, passwordMeetsPolicy } from "../../auth/legacy/ScreensAuth.jsx";
import { moduleKeysForRoleName, moduleKeysForUser, adminModuleScopeForRoles, setPermissionCatalog, getPermissionCatalog } from "../../data/legacy/Data.jsx";
import { useSession, SUPER_ADMIN_ROLE } from "../../session/legacy/Session.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
/* Alamtri Geo Admin — Users: filterable/sortable table, bulk select, create/edit modal, delete confirm. */

function adminUsersApiPart(value) { return encodeURIComponent(String(value || "")); }
function adminUserFromApi(row) {
  const roles = Array.isArray(row && row.roles) ? row.roles : [];
  return {
    id: row.id,
    personnelNo: row.personnelNo || row.username || "",
    username: row.username || row.personnelNo || "",
    fullName: row.fullName || "",
    email: row.email || "",
    role: roles[0] || "",
    roles,
    status: row.status || "Active",
    department: row.department || "Operations",
    position: row.position || "",
    reportTo: row.reportTo || "",
    createdAt: row.createdAt || row.lastActive || "",
    lastActive: row.lastActive || "",
    avatar: row.avatarUrl || row.avatar || null,
    hasLocalPassword: !!row.hasLocalPassword,
    mustChangePassword: !!row.mustChangePassword,
  };
}
async function adminUserUploadAvatar(personnelNo, file) {
  const fd = new FormData();
  fd.append("file", file);
  const response = await fetch(`/api/v1/administration/users/${adminUsersApiPart(personnelNo)}/avatar`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error((data && data.message) || "Could not upload the image.");
  return data.avatarUrl;
}
async function adminUserDeleteAvatar(personnelNo) {
  const response = await fetch(`/api/v1/administration/users/${adminUsersApiPart(personnelNo)}/avatar`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok && response.status !== 204) throw new Error("Could not remove the photo.");
}
async function adminUsersJson(path, options) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...((options && options.headers) || {}) },
    ...(options || {}),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error((data && (data.message || data.title || (Array.isArray(data.errors) && data.errors[0]))) || `Administration API failed: ${response.status}`);
    err.payload = data;
    throw err;
  }
  return data;
}
function adminUserPayload(form) {
  const roles = form.roles && form.roles.length ? form.roles : [form.role || "Basic"];
  return {
    personnelNo: form.personnelNo || form.username,
    fullName: form.fullName,
    email: form.email,
    department: form.department,
    position: form.position || "",
    status: form.status || "Active",
    reportTo: form.reportTo || "",
    roles,
  };
}

function adminUserProfilePayload(form) {
  const payload = adminUserPayload(form);
  delete payload.roles;
  return payload;
}

function UserModal({ open, mode, user, onClose, onSave, permGroups, roleAssignments, permsLoaded }) {
  const C = useC();
  const session = useSession();
  const toast = useToast();
  const fileRef = React.useRef(null);
  const pendingAvatarFile = React.useRef(null);
  const blank = { fullName: "", username: "", email: "", role: "Basic", roles: ["Basic"], status: "Active", phone: "", department: "Operations", reportTo: "", avatar: null };
  const [form, setForm] = React.useState(blank);
  const [tab, setTab] = React.useState("detail");
  const [imgErr, setImgErr] = React.useState("");
  const [imgBusy, setImgBusy] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [emailMsg, setEmailMsg] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pwdErr, setPwdErr] = React.useState("");
  const [pwdBusy, setPwdBusy] = React.useState(false);
  const [pwdPolicy, setPwdPolicy] = React.useState(null);
  const adminScope = adminModuleScopeForRoles(session.effectiveRoles);
  const roleAllowedForScope = (roleName) => !adminScope || moduleKeysForRoleName(roleName).some((k) => adminScope.includes(k));
  const scopedRoleOptions = (session.roles || []).map((r) => ({ value: r.name, label: r.name })).filter((o) => (session.canSeeSuperAdminRole || o.value !== SUPER_ADMIN_ROLE) && roleAllowedForScope(o.value));
  const showTrackerReportTo = !adminScope || adminScope.includes("proposalTracker");
  const canEditProfile = mode === "edit" ? session.can("users.update") : session.can("users.create");
  const canAssignRoles = session.can("users.permissions");
  React.useEffect(() => {
    if (!open) return;
    const firstRole = scopedRoleOptions[0] && scopedRoleOptions[0].value;
    setForm(user ? { ...blank, ...user } : { ...blank, role: firstRole || "Basic", roles: firstRole ? [firstRole] : ["Basic"] });
    setTab("detail"); setImgErr(""); setImgBusy(false); setNewEmail(""); setEmailMsg("");
    setNewPassword(""); setConfirmPassword(""); setPwdErr(""); setPwdBusy(false);
    pendingAvatarFile.current = null;
    const authApi = typeof window !== "undefined" ? window.__internalAuth : null;
    if (authApi && typeof authApi.passwordPolicy === "function") {
      authApi.passwordPolicy().then((data) => { if (data) setPwdPolicy(data); }).catch(() => {});
    }
  }, [open, user]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isEdit = mode === "edit";
  const pickImage = (file) => readAvatarFile(file, (url) => {
    set("avatar", url);
    setImgErr("");
    pendingAvatarFile.current = file;
    const personnelNo = (form.personnelNo || form.username || (user && user.personnelNo) || "").trim();
    if (!isEdit || !personnelNo) return;
    setImgBusy(true);
    adminUserUploadAvatar(personnelNo, file)
      .then((avatarUrl) => { set("avatar", avatarUrl); pendingAvatarFile.current = null; })
      .catch((e) => setImgErr(e.message || "Could not upload the image."))
      .finally(() => { setImgBusy(false); if (fileRef.current) fileRef.current.value = ""; });
  }, (m) => setImgErr(m));
  const removeImage = () => {
    pendingAvatarFile.current = null;
    const personnelNo = (form.personnelNo || form.username || (user && user.personnelNo) || "").trim();
    if (isEdit && personnelNo && form.avatar) {
      setImgBusy(true);
      adminUserDeleteAvatar(personnelNo)
        .then(() => { set("avatar", null); setImgErr(""); })
        .catch(() => setImgErr("Could not remove the photo."))
        .finally(() => setImgBusy(false));
      return;
    }
    set("avatar", null); setImgErr("");
  };
  const changeEmail = () => {
    const v = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast.push({ title: "Enter a valid email address", tone: "error" }); return; }
    set("email", v); setNewEmail(""); setEmailMsg(`The address was changed to ${v}. A verification link has been sent.`);
  };
  return (
    <Modal open={open} onClose={onClose} width={620} icon={isEdit ? "user-cog" : "user-plus"}
      title={isEdit ? "Edit user" : "Create new user"} subtitle={isEdit ? form.email : "Add a new account to the workspace"}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {(canEditProfile || (isEdit && canAssignRoles)) && <Button iconLeft="check" onClick={() => onSave({ ...form, avatarFile: pendingAvatarFile.current }, mode)}>{isEdit ? "Save changes" : "Create user"}</Button>}
      </>}>
      {/* Security tab: Super Admin can set/reset the local password used when SSO is unavailable. */}
      <Tabs active={tab} onChange={setTab} style={{ marginBottom: 18 }} tabs={[{ id: "detail", label: "User detail", icon: "user" }, { id: "email", label: "Email", icon: "mail" }, ...(isEdit && canEditProfile ? [{ id: "security", label: "Security", icon: "key-round" }] : []), { id: "access", label: "Access & role", icon: "shield" }]} />
      {tab === "detail" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={form.fullName || "New User"} src={form.avatar} size={56} />
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button variant="secondary" size="sm" iconLeft="upload" disabled={!canEditProfile || imgBusy} onClick={() => fileRef.current && fileRef.current.click()}>{imgBusy ? "Uploading…" : "Change image"}</Button>
                {form.avatar && <Button variant="link" size="sm" disabled={!canEditProfile || imgBusy} onClick={removeImage}>Remove</Button>}
              </div>
              <div style={{ fontSize: 11.5, color: imgErr ? C.danger : C.textMuted, marginTop: 6, fontWeight: imgErr ? 600 : 400 }}>{imgErr || "JPG, PNG, or WebP, up to 2MB"}</div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => pickImage(e.target.files && e.target.files[0])} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Full name" required><TextInput value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Budi Santoso" /></Field>
            <Field label="Username" required><TextInput value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="budi.santoso" iconLeft="at-sign" /></Field>
          </div>
          {showTrackerReportTo && (
            <Field label="ReportTo" helper="Direct manager (name, email, or personnel no). Section Heads only distribute to Officers who report to them.">
              <TextInput value={form.reportTo || ""} onChange={(e) => set("reportTo", e.target.value)} placeholder="Direct manager" iconLeft="user-round-check" disabled={(form.roles || [form.role]).includes(SUPER_ADMIN_ROLE)} />
            </Field>
          )}
        </div>
      )}
      {tab === "email" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isEdit ? <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }}>
              <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="mail" size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textSubtle }}>Current email</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{form.email || "\u2014"}</div>
              </div>
              <Badge tone="success" dot>Verified</Badge>
            </div>
            <Field label="New email address" required helper="A verification link is sent to the new address before it becomes active.">
              <TextInput value={newEmail} onChange={(e) => { setNewEmail(e.target.value); if (emailMsg) setEmailMsg(""); }} placeholder="name@saptaindra.co.id" iconLeft="mail" />
            </Field>
            <div><Button variant="secondary" size="sm" iconLeft="send" onClick={changeEmail}>Change email</Button></div>
            {emailMsg && <Alert tone="success" title="Email updated" description={emailMsg} />}
          </> : (
            <Field label="Email address" required><TextInput value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@saptaindra.co.id" iconLeft="mail" /></Field>
          )}
        </div>
      )}
      {tab === "security" && isEdit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Alert tone="info" title={form.hasLocalPassword ? "Local password is set" : "No local password yet"} description={form.hasLocalPassword ? "Setting a new password unlocks the account if it was locked and requires the user to change it at next local sign-in." : "Set a local password so this person can sign in when SSO is unavailable."} />
          <PasswordField label="New local password" required value={newPassword} onChange={(e) => { setNewPassword(e.target.value); if (pwdErr) setPwdErr(""); }} placeholder="Temporary password" />
          <PasswordRuleList password={newPassword} policy={pwdPolicy} />
          <PasswordField label="Confirm password" required value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); if (pwdErr) setPwdErr(""); }} placeholder="Re-enter password" status={confirmPassword && newPassword !== confirmPassword ? "error" : "default"} />
          {pwdErr && <Alert tone="error" title={pwdErr} />}
          <div><Button variant="secondary" size="sm" iconLeft="key-round" disabled={pwdBusy || !canEditProfile} onClick={() => {
            if (!newPassword) { setPwdErr("Enter a password."); return; }
            if (!passwordMeetsPolicy(newPassword, pwdPolicy)) { setPwdErr("New password does not meet the requirements."); return; }
            if (newPassword !== confirmPassword) { setPwdErr("Password and confirmation do not match."); return; }
            const personnelNo = (form.personnelNo || form.username || (user && user.personnelNo) || "").trim();
            setPwdBusy(true); setPwdErr("");
            adminUsersJson(`/api/v1/administration/users/${adminUsersApiPart(personnelNo)}/password`, { method: "PUT", body: JSON.stringify({ password: newPassword }) })
              .then(() => {
                set("hasLocalPassword", true);
                set("mustChangePassword", true);
                setNewPassword(""); setConfirmPassword("");
                toast.push({ title: "Local password set", description: `${form.fullName} must change this password at next local sign-in.` });
              })
              .catch((e) => {
                const list = e && e.payload && e.payload.errors;
                setPwdErr((Array.isArray(list) && list[0]) || e.message || "Could not set the password.");
              })
              .finally(() => setPwdBusy(false));
          }}>{pwdBusy ? "Saving…" : "Set password"}</Button></div>
        </div>
      )}
      {tab === "access" && (() => {
        const roleOptions = scopedRoleOptions;
        const formRoles = form.roles && form.roles.length ? form.roles : (form.role ? [form.role] : []);
        const toggleRole = (name) => {
          const has = formRoles.includes(name);
          const next = has ? formRoles.filter((r) => r !== name) : [...formRoles, name];
          set("roles", next); set("role", next[0] || "");
        };
        // Effective permissions = union of each assigned role's REAL permission set, read from
        // /administration/role-permissions. This used to fake each role's set as "the first N catalog
        // keys", which made the preview show permissions the user does not actually get.
        const roleObjs = formRoles.map((n) => (session.roles || []).find((r) => r.name === n)).filter(Boolean);
        const unionKeys = permsLoaded
          ? [...new Set(roleObjs.flatMap((r) => (roleAssignments || {})[r.id] || []))]
          : [];
        const catalog = permGroups && permGroups.length ? permGroups : getPermissionCatalog();
        const total = catalog.reduce((s2, m) => s2 + m.perms.length, 0);
        return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Roles" required helper="A user can hold multiple roles. Effective menu access and permissions are the combined (union) of every assigned role. The first role is the primary.">
            <div style={{ maxHeight: 196, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              {roleOptions.map((o) => {
                const on = formRoles.includes(o.value);
                const primary = on && formRoles[0] === o.value;
                return (
                  <label key={o.value} style={{ ...FONT, display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", borderRadius: RADIUS.sm, cursor: canAssignRoles ? "pointer" : "default", opacity: canAssignRoles ? 1 : 0.72, backgroundColor: on ? C.brandBg : "transparent" }}>
                    <Checkbox checked={on} disabled={!canAssignRoles} onChange={() => canAssignRoles && toggleRole(o.value)} />
                    <span style={{ flex: 1, fontSize: 12.5, color: C.text, fontWeight: on ? 600 : 500 }}>{o.label}</span>
                    {primary && <Badge tone="brand" size="sm">Primary</Badge>}
                  </label>
                );
              })}
              {formRoles.filter((name) => !roleOptions.some((o) => o.value === name)).map((name) => (
                <label key={name} style={{ ...FONT, display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", borderRadius: RADIUS.sm, cursor: "default", backgroundColor: C.brandBg }}>
                  <Checkbox checked disabled />
                  <span style={{ flex: 1, fontSize: 12.5, color: C.text, fontWeight: 600 }}>{name}</span>
                  {formRoles[0] === name && <Badge tone="brand" size="sm">Primary</Badge>}
                </label>
              ))}
            </div>
          </Field>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }}>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Account status</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Suspended users cannot sign in.</div></div>
            <Toggle checked={form.status === "Active"} onChange={(v) => set("status", v ? "Active" : "Suspended")} label={form.status} />
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: C.text }}><Icon name="shield-check" size={15} color={C.ocean} />Combined permissions</span>
              <span style={{ fontSize: 12.5, color: C.textMuted }}>{permsLoaded
                ? <><b style={{ color: C.text }}>{unionKeys.length}</b> / {total} · {formRoles.length} {formRoles.length === 1 ? "role" : "roles"}</>
                : "unavailable"}</span>
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ height: 7, borderRadius: 999, backgroundColor: C.surfaceAlt, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${total ? (unionKeys.length / total) * 100 : 0}%`, backgroundColor: C.ocean, borderRadius: 999, transition: "width 0.2s" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {catalog.map((m) => {
                  const keys = m.perms.map((p) => p.key); const on = keys.filter((k) => unionKeys.includes(k)).length;
                  return (
                    <div key={m.module} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                      <Icon name={m.icon} size={13} color={on ? C.ocean : C.textSubtle} />
                      <span style={{ flex: 1, color: C.textMuted }}>{m.module}</span>
                      <span style={{ fontWeight: 700, color: on === keys.length && on > 0 ? C.success : C.textMuted }}>{on}/{keys.length}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </Modal>
  );
}

function Users({ onNavigate }) {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const session = useSession();
  const [rows, setRows] = React.useState([]); // hydrated from the backend on mount (loadUsers)
  const [imp, setImp] = React.useState(null);
  // Real permission catalog + per-role assigned keys, for the modal's effective-permissions preview.
  // Requires roles.view; when unavailable the preview reports "unavailable" instead of guessing.
  const [permGroups, setPermGroups] = React.useState(() => getPermissionCatalog());
  const [roleAssignments, setRoleAssignments] = React.useState({});
  const [permsLoaded, setPermsLoaded] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/administration/role-permissions", { credentials: "include", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`role-permissions ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        setPermGroups(setPermissionCatalog(data && data.permissionGroups));
        setRoleAssignments((data && data.assignments) || {});
        setPermsLoaded(true);
      })
      .catch((e) => { if (!cancelled) { console.warn("Role-permission matrix unavailable; effective-permission preview hidden.", e); setPermsLoaded(false); } });
    return () => { cancelled = true; };
  }, []);
  const ps = usePageSearch("Search name, username, email…");
  const q = ps.query, setQ = ps.setQuery;
  const [roleF, setRoleF] = React.useState("all");
  const [statusF, setStatusF] = React.useState("all");
  const [sortKey, setSortKey] = React.useState("createdAt");
  const [sortDir, setSortDir] = React.useState("desc");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [modal, setModal] = React.useState({ open: false, mode: "create", user: null });
  const [del, setDel] = React.useState(null);
  const adminScope = adminModuleScopeForRoles(session.effectiveRoles);
  const canCreateUsers = session.can("users.create");
  const canUpdateUsers = session.can("users.update");
  const canAssignUserRoles = session.can("users.permissions");
  const roleAllowedForScope = (roleName) => !adminScope || moduleKeysForRoleName(roleName).some((k) => adminScope.includes(k));
  const userAllowedForScope = (u) => {
    if (!session.canSeeSuperAdminRole && (u.roles || [u.role]).includes(SUPER_ADMIN_ROLE)) return false;
    return !adminScope || moduleKeysForUser(u).some((k) => adminScope.includes(k));
  };
  const scopedRoleOptions = (session.roles || []).map((r) => ({ value: r.name, label: r.name })).filter((o) => (session.canSeeSuperAdminRole || o.value !== SUPER_ADMIN_ROLE) && roleAllowedForScope(o.value));
  const showTrackerReportTo = !adminScope || adminScope.includes("proposalTracker");
  const loadUsers = React.useCallback(async (showToast) => {
    setLoading(true);
    try {
      const data = await adminUsersJson("/api/v1/administration/users");
      setRows((Array.isArray(data) ? data : []).map(adminUserFromApi));
      if (showToast) toast.push({ title: "Refreshed", description: "User list is up to date." });
    } catch (e) {
      console.warn("Administration users API unavailable; using local seed.", e);
      if (showToast) toast.push({ title: "Backend unavailable", description: "Using local user data.", tone: "warning" });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  React.useEffect(() => { loadUsers(false); }, [loadUsers]);

  const filtered = React.useMemo(() => {
    let r = rows.filter((u) =>
      userAllowedForScope(u) && (roleF === "all" || (u.roles || [u.role]).includes(roleF)) && (statusF === "all" || u.status === statusF) &&
      (q === "" || [u.fullName, u.username, u.email, u.reportTo].filter(Boolean).some((s) => s.toLowerCase().includes(q.toLowerCase()))));
    r = [...r].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const c = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? c : -c;
    });
    return r;
  }, [rows, q, roleF, statusF, sortKey, sortDir, session.effectiveRoles]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount]);

  const doSort = (k) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } };
  const refresh = () => { loadUsers(true); };
  const save = async (form, mode) => {
    const roles = form.roles && form.roles.length ? form.roles : [form.role || "Basic"];
    form = { ...form, roles, role: roles[0], reportTo: roles.includes(SUPER_ADMIN_ROLE) ? "" : (form.reportTo || "") };
    try {
      let saved;
      if (mode === "edit") {
        const personnelNo = adminUsersApiPart(form.personnelNo || form.username);
        const originalRoles = (modal.user && modal.user.roles) || [];
        const rolesChanged = [...originalRoles].sort().join("\u0000") !== [...roles].sort().join("\u0000");
        if (rolesChanged && canAssignUserRoles) {
          saved = await adminUsersJson(`/api/v1/administration/users/${personnelNo}/roles`, {
            method: "PUT",
            body: JSON.stringify({ roles }),
          });
        }
        if (canUpdateUsers) {
          saved = await adminUsersJson(`/api/v1/administration/users/${personnelNo}`, {
            method: "PUT",
            body: JSON.stringify(adminUserProfilePayload(form)),
          });
        }
        if (!saved) {
          setModal({ open: false, mode: "create", user: null });
          return;
        }
      } else {
        saved = await adminUsersJson("/api/v1/administration/users", {
          method: "POST",
          body: JSON.stringify(adminUserPayload(form)),
        });
      }
      const savedUser = adminUserFromApi(saved);
      if (form.avatarFile && savedUser.personnelNo) {
        try {
          savedUser.avatar = await adminUserUploadAvatar(savedUser.personnelNo, form.avatarFile);
        } catch (e) {
          toast.push({ title: "Photo not saved", description: e.message || "The user was saved, but the image could not be uploaded.", tone: "warning" });
        }
      }
      if (mode === "edit") setRows((rs) => rs.map((u) => (u.personnelNo === savedUser.personnelNo ? { ...u, ...savedUser, avatar: savedUser.avatar || u.avatar } : u)));
      else setRows((rs) => [{ ...savedUser, avatar: savedUser.avatar || null }, ...rs]);
      session.record({ action: mode === "edit" ? "Update" : "Create", module: "Users", desc: `${mode === "edit" ? "Updated" : "Created"} user ${form.fullName} (${roles.join(", ")})`, tone: mode === "edit" ? "brand" : "success" });
      toast.push({ title: mode === "edit" ? "User updated" : "User created", description: mode === "edit" ? `${form.fullName} has been saved.` : `${form.fullName} was added to the workspace.` });
    } catch (e) {
      console.warn("Administration user save failed.", e);
      toast.push({ title: "Save failed", description: "The backend rejected the change; nothing was saved.", tone: "error" });
      return;
    }
    setModal({ open: false, mode: "create", user: null });
  };
  const confirmDelete = async () => {
    try {
      await adminUsersJson(`/api/v1/administration/users/${adminUsersApiPart(del.personnelNo || del.username)}/status`, { method: "PUT", body: JSON.stringify({ status: "Inactive" }) });
      setRows((rs) => rs.filter((u) => u.id !== del.id));
      setSelected((s) => s.filter((x) => x !== del.id));
      session.record({ action: "Delete", module: "Users", desc: `Deleted user ${del.fullName}`, tone: "danger" });
      toast.push({ title: "User deleted", tone: "error", description: `${del.fullName} has been removed.` });
      setDel(null);
    } catch (e) {
      console.warn("Administration user deactivate failed.", e);
      toast.push({ title: "Delete failed", description: "The backend rejected the change; the user remains active.", tone: "error" });
    }
  };

  const scopedUsers = React.useMemo(() => rows.filter(userAllowedForScope), [rows, session.effectiveRoles, session.canSeeSuperAdminRole]);
  const activeCount = scopedUsers.filter((u) => u.status === "Active").length;
  const suspendedCount = scopedUsers.filter((u) => u.status === "Suspended").length;

  const columns = [
    { key: "fullName", label: t("common.fullName"), sortable: true, nowrap: true, render: (u) => (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Avatar name={u.fullName} size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>{u.fullName}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, whiteSpace: "nowrap" }}>@{u.username}</div>
        </div>
      </div>) },
    { key: "role", label: t("common.role"), sortable: true, render: (u) => {
      const rs = u.roles && u.roles.length ? u.roles : [u.role];
      const tone = (r) => (r === "Super Admin" ? "brand" : r.indexOf("Administrator") === 0 ? "info" : "neutral");
      const shown = rs.slice(0, 2);
      return (
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
          {shown.map((r, i) => <Badge key={i} tone={tone(r)}>{r}</Badge>)}
          {rs.length > shown.length && <Tooltip label={rs.slice(2).join(", ")}><Badge tone="neutral">+{rs.length - shown.length}</Badge></Tooltip>}
        </div>); } },
    ...(showTrackerReportTo ? [{ key: "reportTo", label: "ReportTo", sortable: true, width: 178, render: (u) => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: u.reportTo ? C.text : C.textSubtle, fontSize: 12.5, fontWeight: u.reportTo ? 700 : 500, whiteSpace: "nowrap" }}>
        <Icon name="corner-down-right" size={13} color={u.reportTo ? C.ocean : C.textSubtle} />{u.reportTo || "-"}
      </span>
    ) }] : []),
    { key: "email", label: t("common.email"), sortable: true, nowrap: true, render: (u) => <span style={{ color: C.textMuted }}>{u.email}</span> },
    { key: "status", label: t("common.status"), sortable: true, width: 140, render: (u) => <StatusBadge status={u.status} /> },
    { key: "createdAt", label: t("common.createdAt"), sortable: true, nowrap: true, width: 180, render: (u) => <span style={{ color: C.textMuted, fontSize: 12.5 }}>{fmtAppDateTime(u.createdAt)}</span> },
    { key: "_a", label: t("common.actions"), align: "right", width: 60, render: (u) => {
      const canImp = session.canImpersonate && u.email !== session.realUser.email && !(session.isImpersonating && session.actingUser.email === u.email);
      return (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={196} trigger={<IconButton name="more-horizontal" size="sm" />}>
          {(canUpdateUsers || canAssignUserRoles) && <MenuItem icon="pencil" label={t("act.edit")} onClick={() => setModal({ open: true, mode: "edit", user: u })} />}
          {session.can("permissions.assign") && <MenuItem icon="key-round" label={t("act.permissions")} onClick={() => onNavigate("rolePermissions")} />}
          {canImp && <><MenuDivider /><MenuItem icon="venetian-mask" label="Login as this user" onClick={() => setImp(u)} /></>}
          <MenuDivider />
          {canUpdateUsers && <MenuItem icon="trash-2" label={t("act.delete")} danger onClick={() => setDel(u)} />}
        </Menu>
      </div>); } },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Administration" kickerIcon="shield" title={t("nav.users")} subtitle={t("users.desc")} compact
        right={canCreateUsers ? <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ open: true, mode: "create", user: null })}>{t("act.createUser")}</OpsHeroButton> : null} />
      <OpsStatGrid cols={4}>
        <OpsStatCard icon="users-round" label="Total users" value={scopedUsers.length} iconTone="brand" />
        <OpsStatCard icon="check-circle-2" label="Active" value={activeCount} iconTone="forest" />
        <OpsStatCard icon="ban" label="Suspended" value={suspendedCount} iconTone="danger" />
        <OpsStatCard icon="filter" label="Filtered" value={filtered.length} sub={filtered.length !== scopedUsers.length ? "matching filters" : "all users"} iconTone="blue" />
      </OpsStatGrid>

      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 260 }}><TextInput iconLeft="search" placeholder="Search name, username, email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              <div style={{ width: 168 }}><Select value={roleF} onChange={(e) => { setRoleF(e.target.value); setPage(1); }} options={[{ value: "all", label: "All roles" }, ...scopedRoleOptions]} /></div>
              <div style={{ width: 150 }}><Select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...["Active", "Inactive", "Suspended"].map((s) => ({ value: s, label: s }))]} /></div>
              {(q || roleF !== "all" || statusF !== "all") && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setRoleF("all"); setStatusF("all"); }}>{t("act.clear")}</Button>}
            </>}
            right={<TableRefreshButton onClick={refresh} />} />
        </div>

        {selected.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", backgroundColor: C.brandBg, borderBottom: `1px solid ${C.borderSoft}` }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{selected.length} selected</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="secondary" size="sm" iconLeft="download">Export</Button>
            </div>
          </div>
        )}

        <DataTable columns={columns} data={pageRows} loading={loading} dense
          sortKey={sortKey} sortDir={sortDir} onSort={doSort}
          selectable selected={selected}
          onToggleRow={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
          onToggleAll={(on) => setSelected(on ? pageRows.map((r) => r.id) : [])}
          onRowClick={(canUpdateUsers || canAssignUserRoles) ? (u) => setModal({ open: true, mode: "edit", user: u }) : undefined}
          emptyTitle="No users found" emptyDesc="Try adjusting your search or filters." />

        <div style={{ padding: "4px 16px 12px" }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>

      <UserModal open={modal.open} mode={modal.mode} user={modal.user} onClose={() => setModal({ ...modal, open: false })} onSave={save}
        permGroups={permGroups} roleAssignments={roleAssignments} permsLoaded={permsLoaded} />

      <Modal open={!!del} onClose={() => setDel(null)} width={420} icon="trash-2" title="Delete user"
        subtitle="This action cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>Delete user</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>Are you sure you want to delete <b>{del && del.fullName}</b> (@{del && del.username})? Their access will be revoked immediately and all active sessions terminated.</p>
      </Modal>

      <Modal open={!!imp} onClose={() => setImp(null)} width={460} icon="venetian-mask" title="Login as this user"
        subtitle="Impersonate for testing & diagnostics"
        footer={<><Button variant="secondary" onClick={() => setImp(null)}>Cancel</Button>
          <Button iconLeft="log-in" onClick={() => { const u = imp; const rs = (u.roles || [u.role]); session.record({ action: "Impersonate", module: "Auth", desc: `Started impersonating ${u.fullName} (${rs.join(", ")})`, tone: "brand", impersonated: false }); session.impersonate(u); setImp(null); toast.push({ title: "Impersonation started", description: `You are now viewing as ${u.fullName}.` }); onNavigate("landing"); }}>Yes, login as user</Button></>}>
        {imp && <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }}>
            <Avatar name={imp.fullName} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{imp.fullName}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>@{imp.username} · {(imp.roles || [imp.role]).join(", ")}</div>
            </div>
          </div>
          <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>You will be signed in as <b>{imp.fullName}</b> — navigation, permissions, and access will switch to the combined access of their {(imp.roles || [imp.role]).length > 1 ? <b>{(imp.roles || [imp.role]).length} roles</b> : <b>{imp.role}</b>}, exactly as if they had logged in themselves. You can return to your own account at any time.</p>
          <Alert tone="info" title="Recorded as impersonation" description="Anything you create or change while impersonating is written to the audit log as an impersonated action by your account." />
        </div>}
      </Modal>
    </OpsPage>
  );
}

// Shared with the Shell impersonation quick-switcher so it can list REAL backend users
// (single source of truth for user data — no frontend mock array).
Object.assign(window, { Users, UserModal, adminUsersJson, adminUserFromApi });
export { Users, UserModal, adminUsersJson, adminUserFromApi };
