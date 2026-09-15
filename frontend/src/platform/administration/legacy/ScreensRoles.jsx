/* fm2-converted */
import React from "react";
import { RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, IconButton, TableRefreshButton, Badge, Card, TextInput, Field, Select, Textarea } from "../../../shared/legacy/Primitives.jsx";
import { Alert, Tabs, Menu, MenuItem, MenuDivider, Modal, DataTable, Pagination, useToast, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard, Tooltip } from "../../../shared/legacy/PrimitivesX.jsx";
import { APP_MODULES, modulesForRoleName, adminModuleScopeForRoles, moduleLabelsForRole, setPermissionCatalog, getPermissionCatalog } from "../../data/legacy/Data.jsx";
import { useSession, SUPER_ADMIN_ROLE } from "../../session/legacy/Session.jsx";
import { usePageSearch } from "../../search/legacy/Search.jsx";
/* Alamtri Geo Admin — Roles: table + create/edit modal (Role detail tab + Permissions matrix tab).

   The permission catalog and every role's assigned keys come from the backend
   (GET /api/v1/administration/role-permissions, gated on roles.view). Never fabricate a permission
   set here: this screen can WRITE permissions, so a wrong set silently rewrites the role's access. */

function adminRolesApiPart(value) { return encodeURIComponent(String(value || "")); }
async function adminRolesJson(path, options) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...((options && options.headers) || {}) },
    ...(options || {}),
  });
  if (!response.ok) {
    let message = `Administration API failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body && body.message) message = body.message;
      const err = new Error(message);
      err.code = body && body.code;
      err.status = response.status;
      throw err;
    } catch (e) {
      if (e && e.status) throw e;
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
  }
  return response.status === 204 ? null : response.json();
}
function adminRoleFromApi(row) {
  return {
    id: row.roleId || row.id,
    name: row.name || "",
    description: row.description || "",
    users: row.users || 0,
    perms: row.permissions || row.perms || 0,
    system: !!(row.isSystem || row.system),
    isDefault: !!row.isDefault,
    modules: Array.isArray(row.modules) ? row.modules : [],
    createdAt: row.createdAt || "",
  };
}
/* Role DETAIL payload only. Permissions are deliberately NOT included: they go through the dedicated
   PUT /roles/{code}/permissions endpoint, which is gated on permissions.assign (roles.update alone
   must not be able to rewrite access). `moduleKey`/`isSystem` are omitted when unknown so the backend
   keeps what is stored instead of clearing it. */
function adminRoleDetailPayload(form) {
  const payload = { roleId: form.id, name: form.name };
  if (form.moduleKey !== undefined) payload.moduleKey = form.moduleKey;
  if (form.system !== undefined) payload.isSystem = !!form.system;
  return payload;
}
function samePermissionSet(a, b) {
  const x = [...new Set(a || [])].sort(), y = [...new Set(b || [])].sort();
  return x.length === y.length && x.every((k, i) => k === y[i]);
}

function PermissionMatrix({ selected, onChange, compact, groups, readOnly }) {
  const C = useC();
  const catalog = groups && groups.length ? groups : getPermissionCatalog();
  const toggle = (key) => { if (!readOnly) onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]); };
  const toggleModule = (mod, on) => {
    if (readOnly) return;
    const keys = mod.perms.map((p) => p.key);
    onChange(on ? Array.from(new Set([...selected, ...keys])) : selected.filter((k) => !keys.includes(k)));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {catalog.map((mod) => {
        const keys = mod.perms.map((p) => p.key);
        const on = keys.filter((k) => selected.includes(k));
        const all = on.length === keys.length, some = on.length > 0 && !all;
        return (
          <div key={mod.module} style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={mod.icon} size={15} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{mod.module}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{on.length} of {keys.length} permissions</div>
              </div>
              {!readOnly && (
              <span onClick={() => toggleModule(mod, !all)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: all ? C.ocean : C.textMuted }}>
                <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${all || some ? C.primary : C.border}`, backgroundColor: all ? C.primary : some ? C.brandBg : C.inputBg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {all ? <Icon name="check" size={11} color="#fff" strokeWidth={3} /> : some ? <span style={{ width: 8, height: 2, backgroundColor: C.ocean, borderRadius: 2 }} /> : null}</span>
                Select all
              </span>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "1fr", gap: 0 }}>
              {mod.perms.map((p, i) => {
                const checked = selected.includes(p.key);
                return (
                  <div key={p.key} onClick={() => toggle(p.key)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", cursor: readOnly ? "default" : "pointer", borderTop: i > (compact ? 1 : 0) ? `1px solid ${C.borderSoft}` : "none", backgroundColor: checked ? C.hover : "transparent" }}>
                    <span style={{ width: 17, height: 17, borderRadius: 5, marginTop: 1, flexShrink: 0, border: `1.5px solid ${checked ? C.primary : C.border}`, backgroundColor: checked ? C.primary : C.inputBg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{checked && <Icon name="check" size={11} color="#fff" strokeWidth={3} />}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.textSubtle, fontFamily: "monospace", marginTop: 1 }}>{p.key}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoleModal({ open, mode, role, onClose, onSave, groups, assignedPerms, permsLoaded, canAssignPerms, nextRoleId }) {
  const C = useC();
  const [tab, setTab] = React.useState("role");
  const [form, setForm] = React.useState({ id: "", name: "", description: "" });
  const [perms, setPerms] = React.useState([]);
  const catalog = groups && groups.length ? groups : getPermissionCatalog();
  const allKeys = React.useMemo(() => catalog.flatMap((m) => m.perms.map((p) => p.key)), [catalog]);
  const assignedKey = (assignedPerms || []).join("|");
  React.useEffect(() => {
    if (!open) return;
    setTab("role");
    if (role) {
      // Carry the role's real metadata through, so saving detail never clears isSystem or rewrites
      // moduleKey (this used to send isSystem:false + modules[0], which un-systemed Super Admin).
      setForm({ id: role.id, name: role.name, description: role.description, system: role.system, moduleKey: role.modules && role.modules.length === 1 ? role.modules[0] : undefined });
      setPerms(Array.isArray(assignedPerms) ? [...assignedPerms] : []);
    } else { setForm({ id: nextRoleId || "", name: "", description: "" }); setPerms(["dashboard.view"]); }
    // Keyed by VALUE (assignedKey), not by the array's identity: the parent rebuilds `assignedPerms`
    // on every render, so depending on the array itself re-ran this effect and threw away the
    // operator's in-progress tick marks before they could be saved.
  }, [open, role && role.id, assignedKey, nextRoleId]);
  const isEdit = mode === "edit";
  // Only offer the Permissions tab as editable when we know the real set AND the user may assign.
  const permsReadOnly = isEdit && (!permsLoaded || !canAssignPerms);
  return (
    <Modal open={open} onClose={onClose} width={680} icon={isEdit ? "shield-check" : "shield-plus"}
      title={isEdit ? "Edit role" : "Create new role"} subtitle={isEdit ? `${form.id} · ${perms.length} permissions` : "Define a role and assign its permissions"}
      footer={<>
        <span style={{ marginRight: "auto", fontSize: 12.5, color: C.textMuted, alignSelf: "center" }}><b style={{ color: C.text }}>{perms.length}</b> of {allKeys.length} permissions selected</span>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button iconLeft="check" disabled={!String(form.name || "").trim() || (!isEdit && !String(form.id || "").trim())}
          onClick={() => onSave({ ...form, perms: perms.length, permissionKeys: perms, permsEditable: !permsReadOnly }, mode)}>{isEdit ? "Save changes" : "Create role"}</Button>
      </>}>
      <Tabs active={tab} onChange={setTab} style={{ marginBottom: 18 }} tabs={[{ id: "role", label: "Role", icon: "info" }, { id: "perms", label: "Permissions", icon: "key-round", badge: perms.length }]} />
      {tab === "role" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 14 }}>
            <Field label="Role ID" required={!isEdit} helper={isEdit ? undefined : "Unique code, e.g. ADM-TRK."}>
              <TextInput value={form.id} disabled={isEdit}
                onChange={isEdit ? undefined : (e) => setForm((f) => ({ ...f, id: e.target.value.toUpperCase() }))} />
            </Field>
            <Field label="Role name" required><TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Operations Manager" /></Field>
          </div>
          <Field label="Description" helper="Briefly describe what this role is responsible for.">
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the role's scope and responsibilities…" rows={4} />
          </Field>
          {role && role.system && <Alert tone="warning" title="System role" description="This is a built-in role. Some attributes are protected and cannot be removed." />}
        </div>
      )}
      {tab === "perms" && (
        <div>
          {isEdit && !permsLoaded && <Alert tone="warning" title="Permissions unavailable" description="The assigned permissions could not be loaded from the backend, so they are shown read-only. Saving will leave this role's permissions untouched." style={{ marginBottom: 14 }} />}
          {isEdit && permsLoaded && !canAssignPerms && <Alert tone="info" title="Read-only" description="Changing a role's permissions requires the permissions.assign permission. Saving will leave them untouched." style={{ marginBottom: 14 }} />}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ fontSize: 12.5, color: C.textMuted, margin: 0 }}>{permsReadOnly ? "Permissions granted by this role, grouped by module." : "Select the permissions granted by this role, grouped by module."}</p>
            {!permsReadOnly && (
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="link" size="sm" onClick={() => setPerms(allKeys)}>Select all</Button>
              <Button variant="link" size="sm" onClick={() => setPerms([])}>Clear all</Button>
            </div>)}
          </div>
          <PermissionMatrix selected={perms} onChange={setPerms} groups={catalog} readOnly={permsReadOnly} />
        </div>
      )}
    </Modal>
  );
}

function Roles({ onNavigate }) {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const session = useSession();
  const [rows, setRows] = React.useState([]); // hydrated from /api/v1/administration/roles on mount
  const ps = usePageSearch("Search roles…");
  const q = ps.query, setQ = ps.setQuery;
  const [moduleF, setModuleF] = React.useState("all");
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [loading, setLoading] = React.useState(false);
  const [modal, setModal] = React.useState({ open: false, mode: "create", role: null });
  const adminScope = adminModuleScopeForRoles(session.effectiveRoles);
  const roleModuleKeys = (r) => (r.modules && r.modules.length ? r.modules : modulesForRoleName(r.name));
  const roleAllowedForScope = (r) => !adminScope || roleModuleKeys(r).some((k) => adminScope.includes(k));
  const canManageRoles = session.canSeeSuperAdminRole;
  const canCreateRoles = session.can("roles.create");
  const canDeleteRoles = session.can("roles.delete");
  const canAssignPerms = session.can("permissions.assign");
  // Real permission catalog + per-role assigned keys, both from the backend. `permsLoaded` gates every
  // write: without it we must never send a permission set (that is how the old fabricated set got saved).
  const [permGroups, setPermGroups] = React.useState(() => getPermissionCatalog());
  const [assignments, setAssignments] = React.useState({});
  const [permsLoaded, setPermsLoaded] = React.useState(false);
  // `toast` comes from context and is read through a ref so these loaders keep a stable identity —
  // depending on it made the mount effect below refetch on every render.
  const toastRef = React.useRef(toast);
  toastRef.current = toast;
  const loadRoles = React.useCallback(async (showToast) => {
    setLoading(true);
    try {
      const data = await adminRolesJson("/api/v1/administration/roles");
      setRows((Array.isArray(data) ? data : []).map(adminRoleFromApi));
      if (showToast) toastRef.current.push({ title: "Refreshed", description: "Role list is up to date." });
    } catch (e) {
      console.warn("Administration roles API unavailable; using local seed.", e);
      if (showToast) toastRef.current.push({ title: "Backend unavailable", description: "Using local role data.", tone: "warning" });
    } finally {
      setLoading(false);
    }
  }, []);
  const loadPermissionMatrix = React.useCallback(async () => {
    try {
      const data = await adminRolesJson("/api/v1/administration/role-permissions");
      const groups = setPermissionCatalog(data && data.permissionGroups);
      setPermGroups(groups);
      setAssignments((data && data.assignments) || {});
      setPermsLoaded(true);
    } catch (e) {
      console.warn("Role-permission matrix unavailable; permissions shown read-only.", e);
      setPermsLoaded(false);
    }
  }, []);
  React.useEffect(() => { loadRoles(false); loadPermissionMatrix(); }, [loadRoles, loadPermissionMatrix]);

  const visibleRoles = rows.filter((x) => roleAllowedForScope(x) && (session.canSeeSuperAdminRole || x.name !== SUPER_ADMIN_ROLE));
  const usersWithRoles = visibleRoles.reduce((s, r) => s + r.users, 0);
  // Offer only the modules actually carried by the roles this admin can see, in APP_MODULES order.
  const moduleOptions = React.useMemo(() => {
    const present = new Set(visibleRoles.flatMap(roleModuleKeys));
    return APP_MODULES.filter((m) => present.has(m.key) && m.status !== "Retired").map((m) => ({ value: m.key, label: m.name }));
  }, [rows, session.canSeeSuperAdminRole, session.effectiveRoles]);

  // A reload (or a scope change) can drop the selected module from the list — fall back to "all".
  React.useEffect(() => {
    if (moduleF !== "all" && !moduleOptions.some((o) => o.value === moduleF)) setModuleF("all");
  }, [moduleOptions, moduleF]);

  const filtered = React.useMemo(() => {
    let r = rows.filter((x) => {
      const modules = moduleLabelsForRole(x).join(" ");
      return roleAllowedForScope(x) && (session.canSeeSuperAdminRole || x.name !== SUPER_ADMIN_ROLE)
        && (moduleF === "all" || roleModuleKeys(x).includes(moduleF))
        && (q === "" || [x.name, x.description, x.id, modules].some((s) => s.toLowerCase().includes(q.toLowerCase())));
    });
    r = [...r].sort((a, b) => { const av = a[sortKey], bv = b[sortKey]; const c = typeof av === "string" ? av.localeCompare(bv) : av - bv; return sortDir === "asc" ? c : -c; });
    return r;
  }, [rows, q, moduleF, sortKey, sortDir, session.canSeeSuperAdminRole, session.effectiveRoles]);
  // Role ID is the backend role CODE and must be unique — the modal used to send a hardcoded "R-009"
  // through a disabled field, so the second create always collided. Suggest a free code, let it be typed.
  const nextRoleId = React.useMemo(() => {
    const taken = new Set(rows.map((r) => String(r.id).toUpperCase()));
    for (let i = rows.length + 1; i < rows.length + 200; i += 1) {
      const candidate = `ROLE-${String(i).padStart(3, "0")}`;
      if (!taken.has(candidate)) return candidate;
    }
    return "";
  }, [rows]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const doSort = (k) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } };
  /* Detail and permissions are saved through SEPARATE endpoints, on purpose:
       PUT  /roles/{code}              → name/moduleKey/isSystem   (permission: roles.update)
       PUT  /roles/{code}/permissions  → the permission set        (permission: permissions.assign)
     Sending permissions on the detail call would let roles.update alone rewrite access, and any
     inaccuracy in the checked set silently replaces the role's real permissions. So the permission
     call is made ONLY when the real set was loaded, the user may assign, and the set actually changed. */
  const save = async (form, mode) => {
    const previous = mode === "edit" ? (assignments[form.id] || []) : [];
    const permsChanged = !!form.permsEditable && !samePermissionSet(previous, form.permissionKeys);
    try {
      if (mode === "edit") {
        const saved = await adminRolesJson(`/api/v1/administration/roles/${adminRolesApiPart(form.id)}`, {
          method: "PUT", body: JSON.stringify(adminRoleDetailPayload(form)),
        });
        if (permsChanged) {
          await adminRolesJson(`/api/v1/administration/roles/${adminRolesApiPart(form.id)}/permissions`, {
            method: "PUT", body: JSON.stringify({ permissions: form.permissionKeys }),
          });
          setAssignments((a) => ({ ...a, [form.id]: [...form.permissionKeys] }));
        }
        const savedRole = adminRoleFromApi(saved);
        setRows((rs) => rs.map((r) => (r.id === savedRole.id
          ? { ...r, ...savedRole, perms: permsChanged ? form.permissionKeys.length : r.perms }
          : r)));
      } else {
        const saved = await adminRolesJson("/api/v1/administration/roles", {
          method: "POST",
          body: JSON.stringify({ ...adminRoleDetailPayload(form), permissions: form.permissionKeys }),
        });
        const savedRole = adminRoleFromApi(saved);
        setRows((rs) => [...rs, savedRole]);
        setAssignments((a) => ({ ...a, [savedRole.id]: [...form.permissionKeys] }));
      }
      session.record({ action: mode === "edit" ? "Update" : "Create", module: "Roles", desc: `${mode === "edit" ? "Updated" : "Created"} role ${form.name}${permsChanged ? ` (${form.permissionKeys.length} permissions)` : ""}`, tone: mode === "edit" ? "brand" : "success" });
      toast.push({ title: mode === "edit" ? "Role updated" : "Role created", description: mode === "edit" ? `${form.name} has been saved.` : `${form.name} is ready to assign.` });
    } catch (e) {
      // No optimistic local mutation: a role is an authorization record, so showing it as saved when
      // the backend rejected it is worse than surfacing the failure.
      console.warn("Administration role save failed.", e);
      toast.push({ title: mode === "edit" ? "Save failed" : "Create failed", description: "The backend rejected the change; nothing was saved. Refresh and try again.", tone: "error" });
      loadRoles(false); loadPermissionMatrix();
    }
    setModal({ open: false, mode: "create", role: null });
  };

  const duplicate = async (r) => {
    try {
      const saved = await adminRolesJson(`/api/v1/administration/roles/${adminRolesApiPart(r.id)}/duplicate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const savedRole = adminRoleFromApi(saved);
      setRows((rs) => [...rs, savedRole]);
      await loadPermissionMatrix();
      session.record({ action: "Create", module: "Roles", desc: `Duplicated role ${r.name} as ${savedRole.id}`, tone: "success" });
      toast.push({ title: "Role duplicated", description: `${savedRole.name} (${savedRole.id}) was created.` });
    } catch (e) {
      console.warn("Administration role duplicate failed.", e);
      toast.push({ title: "Duplicate failed", description: e.message || "The backend rejected the copy; nothing was saved.", tone: "error" });
      loadRoles(false); loadPermissionMatrix();
    }
  };
  const remove = async (r) => {
    if (r.system) { toast.push({ title: "System roles can't be deleted", tone: "error" }); return; }
    if (r.users > 0) {
      toast.push({ title: "Role is in use", description: `Unassign this role from ${r.users} user(s) before deleting it.`, tone: "error" });
      return;
    }
    if (!window.confirm(`Delete role "${r.name}"? This cannot be undone.`)) return;
    try {
      await adminRolesJson(`/api/v1/administration/roles/${adminRolesApiPart(r.id)}`, { method: "DELETE" });
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      setAssignments((a) => {
        const next = { ...a };
        delete next[r.id];
        return next;
      });
      session.record({ action: "Delete", module: "Roles", desc: `Deleted role ${r.name}`, tone: "danger" });
      toast.push({ title: "Role deleted", description: `${r.name} was removed.`, tone: "error" });
    } catch (e) {
      console.warn("Administration role delete failed.", e);
      toast.push({ title: "Delete failed", description: e.message || "The backend rejected the delete; nothing was removed.", tone: "error" });
      loadRoles(false); loadPermissionMatrix();
    }
  };

  const renderModules = (r) => {
    const labels = moduleLabelsForRole(r);
    if (r.name === SUPER_ADMIN_ROLE) return (
      <Tooltip label={labels.join(", ")}>
        <span><Badge tone="brand">All modules</Badge></span>
      </Tooltip>
    );
    return (
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
        {labels.map((label) => <Badge key={label} tone="neutral" size="sm">{label}</Badge>)}
        {labels.length === 0 && <span style={{ fontSize: 12.5, color: C.textSubtle }}>No modules</span>}
      </div>
    );
  };

  const columns = [
    { key: "id", label: "Role ID", sortable: true, width: 92, render: (r) => <span style={{ fontFamily: "monospace", fontSize: 12.5, color: C.textMuted, fontWeight: 600 }}>{r.id}</span> },
    { key: "name", label: "Role name", sortable: true, render: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.name}</span>
        {r.system && <Badge tone="brand" size="sm">System</Badge>}
        {r.isDefault && <Badge tone="neutral" size="sm">Default</Badge>}
      </div>) },
    { key: "description", label: "Description", width: 420, render: (r) => <span style={{ color: C.textMuted, fontSize: 12.5 }}>{r.description}</span> },
    { key: "modules", label: "Modules", width: 230, render: renderModules },
    { key: "users", label: "Users", sortable: true, align: "right", width: 80, render: (r) => <span style={{ fontWeight: 600, color: C.text }}>{r.users}</span> },
    { key: "perms", label: "Permissions", sortable: true, align: "right", width: 110, render: (r) => <Badge tone="neutral">{r.perms}</Badge> },
    { key: "_a", label: t("common.actions"), align: "right", width: 70, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={196} trigger={<IconButton name="more-horizontal" size="sm" />}>
          {canManageRoles ? (
            <>
              <MenuItem icon="pencil" label={t("act.edit")} onClick={() => setModal({ open: true, mode: "edit", role: r })} />
              <MenuItem icon="key-round" label={t("act.permissions")} onClick={() => onNavigate && onNavigate("rolePermissions")} />
              {canCreateRoles && <MenuItem icon="copy" label="Duplicate" onClick={() => duplicate(r)} />}
              {canDeleteRoles && (
                <>
                  <MenuDivider />
                  <MenuItem icon="trash-2" label={t("act.delete")} danger disabled={r.system || r.users > 0} onClick={() => remove(r)} />
                </>
              )}
            </>
          ) : (
            <MenuItem icon="eye" label="View only" disabled />
          )}
        </Menu>
      </div>) },
  ];
  return (
    <OpsPage>
      <OpsHero kicker="Administration" kickerIcon="shield" title={t("nav.roles")} subtitle={t("roles.desc")} compact
        right={canManageRoles ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <OpsHeroButton variant="secondary" iconLeft="key-round" onClick={() => onNavigate && onNavigate("rolePermissions")}>Manage permissions</OpsHeroButton>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ open: true, mode: "create", role: null })}>{t("act.createRole")}</OpsHeroButton>
        </div> : null} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="shield" label="Total roles" value={visibleRoles.length} iconTone="brand" />
        <OpsStatCard icon="users-round" label="Users with roles" value={usersWithRoles} iconTone="blue" />
        <OpsStatCard icon="key-round" label="Permission keys" value={permGroups.reduce((n, m) => n + m.perms.length, 0)} iconTone="forest" />
      </OpsStatGrid>
      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<>
              <div ref={ps.ref} style={{ width: 300 }}><TextInput iconLeft="search" placeholder="Search roles…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
              <div style={{ width: 210 }}><Select value={moduleF} onChange={(e) => { setModuleF(e.target.value); setPage(1); }} options={[{ value: "all", label: "All modules" }, ...moduleOptions]} /></div>
              {(q || moduleF !== "all") && <Button variant="link" size="sm" iconLeft="x" onClick={() => { setQ(""); setModuleF("all"); setPage(1); }}>{t("act.clear")}</Button>}
            </>}
            right={<TableRefreshButton onClick={() => loadRoles(true)} />} />
        </div>
        <DataTable columns={columns} data={pageRows} loading={loading} dense sortKey={sortKey} sortDir={sortDir} onSort={doSort}
          onRowClick={canManageRoles ? (r) => setModal({ open: true, mode: "edit", role: r }) : undefined} emptyTitle="No roles found" />
        <div style={{ padding: "4px 16px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} /></div>
      </Card>
      <RoleModal open={modal.open} mode={modal.mode} role={modal.role} onClose={() => setModal({ ...modal, open: false })} onSave={save}
        groups={permGroups} assignedPerms={modal.role ? (assignments[modal.role.id] || []) : []}
        permsLoaded={permsLoaded} canAssignPerms={canAssignPerms} nextRoleId={nextRoleId} />
    </OpsPage>
  );
}

Object.assign(window, { Roles, RoleModal, PermissionMatrix });
export { Roles, RoleModal, PermissionMatrix };
