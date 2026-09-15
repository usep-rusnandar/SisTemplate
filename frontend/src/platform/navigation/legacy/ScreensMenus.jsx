/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, Badge, DetailCard, TextInput, Field, Select, Checkbox, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { Alert, EmptyState, Menu, useToast, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard } from "../../../shared/legacy/PrimitivesX.jsx";
import { allPermissionKeys } from "../../data/legacy/Data.jsx";
import { MenuProvider, useMenus, menuLabel, findMenuNode, menuParentOf } from "./MenuData.jsx";
import { SideNav } from "../../../app/shell/legacy/Shell.jsx";
/* Alamtri Geo Admin — Menus: tree + detail panel editor that controls the live sidebar.
   Edits here update the menu structure in MenuProvider, which the SideNav reads from. */

const MENU_ICON_CHOICES = [
  "layout-grid", "list", "users-round", "shield", "shield-check", "key-round", "crown",
  "sliders-horizontal", "settings", "mail", "send", "globe", "languages", "scroll-text",
  "bell", "file-text", "folder", "database", "bar-chart-3", "calendar", "map-pin",
  "package", "truck", "wallet", "receipt", "building-2", "clipboard-list", "lock", "user", "home",
];

function genMenuId() { return "mx-" + Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36); }

/* ---------- one row in the tree ---------- */
function MenuTreeRow({ node, depth, selectedId, onSelect, onMove, isFirst, isLast }) {
  const C = useC();
  const { t } = useI18n();
  const [hover, setHover] = React.useState(false);
  const selected = selectedId === node.id;
  const isGroup = node.type === "group";
  return (
    <div onClick={() => onSelect(node.id)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...FONT, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderRadius: RADIUS.md,
        padding: "8px 8px 8px " + (12 + depth * 18) + "px", marginBottom: 2,
        backgroundColor: selected ? C.active : hover ? C.hover : "transparent",
        opacity: node.enabled ? 1 : 0.55, transition: "background-color 0.12s" }}>
      <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: RADIUS.sm, display: "inline-flex", alignItems: "center", justifyContent: "center",
        backgroundColor: isGroup ? "transparent" : C.brandBg, color: selected ? C.ocean : C.textMuted }}>
        <Icon name={node.icon || (isGroup ? "folder" : "circle")} size={isGroup ? 16 : 15} /></span>
      <span style={{ flex: 1, minWidth: 0, fontSize: isGroup ? 13 : 12.5, fontWeight: isGroup ? 700 : selected ? 700 : 500,
        color: C.text, letterSpacing: isGroup ? "0.01em" : 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        textTransform: isGroup ? "uppercase" : "none" }}>{menuLabel(node, t)}</span>
      {!node.enabled && <Badge tone="neutral" size="sm">Off</Badge>}
      {!isGroup && <span style={{ fontSize: 11, fontWeight: 600, color: C.textSubtle, display: "inline-flex", alignItems: "center", gap: 3 }}>
        <Icon name="eye" size={12} />{(node.requiredPermissions || []).length}</span>}
      <span style={{ display: "inline-flex", gap: 1, opacity: hover || selected ? 1 : 0, transition: "opacity 0.12s" }}>
        <button title="Move up" disabled={isFirst} onClick={(e) => { e.stopPropagation(); onMove(node.id, -1); }}
          style={{ ...FONT, border: "none", background: "transparent", cursor: isFirst ? "default" : "pointer", color: isFirst ? C.textSubtle : C.textMuted, padding: 2, display: "inline-flex", opacity: isFirst ? 0.4 : 1 }}><Icon name="chevron-up" size={15} /></button>
        <button title="Move down" disabled={isLast} onClick={(e) => { e.stopPropagation(); onMove(node.id, 1); }}
          style={{ ...FONT, border: "none", background: "transparent", cursor: isLast ? "default" : "pointer", color: isLast ? C.textSubtle : C.textMuted, padding: 2, display: "inline-flex", opacity: isLast ? 0.4 : 1 }}><Icon name="chevron-down" size={15} /></button>
      </span>
    </div>
  );
}

/* ---------- the tree ---------- */
function MenuTree({ menu, selectedId, onSelect, onMove }) {
  const C = useC();
  return (
    <div style={{ padding: 8 }}>
      {menu.map((node, i) => (
        <div key={node.id}>
          <MenuTreeRow node={node} depth={0} selectedId={selectedId} onSelect={onSelect} onMove={onMove}
            isFirst={i === 0} isLast={i === menu.length - 1} />
          {node.type === "group" && (node.children || []).map((c, ci) => (
            <MenuTreeRow key={c.id} node={c} depth={1} selectedId={selectedId} onSelect={onSelect} onMove={onMove}
              isFirst={ci === 0} isLast={ci === (node.children.length - 1)} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- icon picker ---------- */
function IconPicker({ value, onChange }) {
  const C = useC();
  return (
    <div>
      <div style={{ marginBottom: 8 }}><TextInput value={value} iconLeft={value || "circle"} onChange={(e) => onChange(e.target.value)} placeholder="lucide-icon-name" /></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {MENU_ICON_CHOICES.map((ic) => {
          const on = ic === value;
          return (
            <button key={ic} title={ic} onClick={() => onChange(ic)}
              style={{ ...FONT, width: 34, height: 34, borderRadius: RADIUS.md, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${on ? C.ocean : C.border}`, backgroundColor: on ? C.brandBg : C.inputBg, color: on ? C.ocean : C.textMuted }}>
              <Icon name={ic} size={16} /></button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- detail / editor panel ---------- */
function MenuDetail({ node, menu, api, onSelect }) {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const [confirming, setConfirming] = React.useState(false);
  React.useEffect(() => { setConfirming(false); }, [node && node.id]);

  if (!node) {
    return <div style={{ padding: "56px 24px" }}><EmptyState icon="mouse-pointer-click" title="No menu selected"
      description="Select an item from the tree to edit its label, icon, route, and required permissions — or add a new one." /></div>;
  }

  const isGroup = node.type === "group";
  const groups = menu.filter((n) => n.type === "group");
  const parent = menuParentOf(menu, node.id);
  const permCatalog = typeof allPermissionKeys === "function" ? allPermissionKeys() : [];
  const reqPerms = node.requiredPermissions || [];
  const allOn = permCatalog.length > 0 && reqPerms.length === permCatalog.length;

  const parentOptions = [{ value: "", label: "Top level" }, ...groups.map((g) => ({ value: g.id, label: menuLabel(g, t) }))];

  return (
    <div style={{ ...FONT, display: "flex", flexDirection: "column" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
        <span style={{ width: 40, height: 40, borderRadius: RADIUS.md, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
          backgroundColor: C.brandBg, color: C.ocean }}><Icon name={node.icon || (isGroup ? "folder" : "circle")} size={20} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{menuLabel(node, t)}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{node.key}</div>
        </div>
        <Badge tone={isGroup ? "brand" : "neutral"} size="md">{isGroup ? "Group" : "Menu item"}</Badge>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Label" helper="Shown in the sidebar."><TextInput value={node.label} placeholder={t(node.labelKey) || node.key} onChange={(e) => api.updateNode(node.id, { label: e.target.value })} /></Field>
          <Field label="Menu key" helper="Internal identifier."><TextInput value={node.key} onChange={(e) => api.updateNode(node.id, { key: e.target.value })} /></Field>
        </div>

        {!isGroup && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Route" helper="Screen this item opens."><TextInput value={node.route || ""} placeholder="e.g. users" onChange={(e) => api.updateNode(node.id, { route: e.target.value })} /></Field>
            <Field label="Parent group">
              <Select value={parent ? parent.id : ""} options={parentOptions} onChange={(e) => api.moveToParent(node.id, e.target.value || null)} />
            </Field>
          </div>
        )}

        <Field label="Icon"><IconPicker value={node.icon || ""} onChange={(v) => api.updateNode(node.id, { icon: v })} /></Field>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Enabled</div>
            <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>Disabled items are hidden from the sidebar for everyone.</div>
          </div>
          <Toggle checked={node.enabled} onChange={(v) => api.updateNode(node.id, { enabled: v })} />
        </div>

        {/* permission visibility — a node shows for a user who holds ANY of these permissions */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>Required permissions <span style={{ fontWeight: 500, color: C.textMuted }}>(visible if the user has any)</span></div>
            <button onClick={() => api.updateNode(node.id, { requiredPermissions: allOn ? [] : [...permCatalog] })}
              style={{ ...FONT, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.ocean }}>{allOn ? "Clear all" : "Select all"}</button>
          </div>
          {reqPerms.length === 0 && <div style={{ fontSize: 11.5, color: C.textMuted, padding: "8px 14px 0" }}>No permissions selected — visible to any signed-in user (subject to edition).</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", padding: "14px" }}>
            {permCatalog.map((p) => (
              <Checkbox key={p} checked={reqPerms.includes(p)} onChange={() => api.toggleRequiredPermission(node.id, p)} label={p} />
            ))}
          </div>
        </div>
        {isGroup && <Alert tone="info" title="Group visibility" description="A group appears only when the user has at least one visible child item; a group's own required permissions are optional." />}

        {/* footer actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
          <Button variant="secondary" size="sm" iconLeft="chevron-up" onClick={() => api.moveNode(node.id, -1)}>Move up</Button>
          <Button variant="secondary" size="sm" iconLeft="chevron-down" onClick={() => api.moveNode(node.id, 1)}>Move down</Button>
          <div style={{ flex: 1 }} />
          {!confirming ? (
            <Button variant="secondary" size="sm" iconLeft="trash-2" onClick={() => setConfirming(true)}>Delete</Button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>Delete{isGroup ? " group + items" : ""}?</span>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => { api.removeNode(node.id); onSelect(null); toast.push({ title: "Menu removed", description: `${menuLabel(node, t)} was deleted.` }); }}>Delete</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */
function Menus() {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const api = useMenus();
  const { menu } = api;
  const [selectedId, setSelectedId] = React.useState("m-menus");

  const selected = findMenuNode(menu, selectedId);
  const counts = React.useMemo(() => {
    let groups = 0, items = 0;
    menu.forEach((n) => { if (n.type === "group") { groups++; (n.children || []).forEach(() => items++); } else items++; });
    return { groups, items };
  }, [menu]);

  const addGroup = () => {
    const id = genMenuId();
    api.addNode(null, { id, type: "group", key: "group_" + id.slice(-4), label: "New group", icon: "folder", enabled: true, requiredPermissions: [], children: [] });
    setSelectedId(id);
    toast.push({ title: "Group added", description: "Configure it in the detail panel." });
  };
  const addItem = () => {
    const id = genMenuId();
    const parentId = selected ? (selected.type === "group" ? selected.id : (menuParentOf(menu, selected.id) || {}).id || null) : null;
    api.addNode(parentId, { id, type: "item", key: "item_" + id.slice(-4), label: "New item", icon: "circle", route: "", enabled: true, requiredPermissions: [] });
    setSelectedId(id);
    toast.push({ title: "Menu item added", description: parentId ? "Added inside the selected group." : "Added at the top level." });
  };

  return (
    <OpsPage>
      <OpsHero kicker="Super Admin" kickerIcon="crown" title={t("nav.menus")} subtitle="Configure the application's navigation structure, ordering, and per-permission visibility. Changes apply to the sidebar instantly." compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <OpsHeroButton variant="secondary" iconLeft="rotate-ccw" onClick={() => { api.resetMenu(); setSelectedId("m-menus"); toast.push({ title: "Menu reset", description: "Restored the default navigation." }); }}>Reset to default</OpsHeroButton>
          <OpsHeroButton variant="secondary" iconLeft="folder-plus" onClick={addGroup}>Add group</OpsHeroButton>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={addItem}>Add menu item</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="folder" label="Groups" value={counts.groups} iconTone="brand" />
        <OpsStatCard icon="list" label="Menu items" value={counts.items} iconTone="blue" />
        <OpsStatCard icon="eye" label="Live sidebar" value="On" sub="changes apply instantly" iconTone="forest" />
      </OpsStatGrid>

      <div className="ag-menus-grid" style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18, alignItems: "start" }}>
        <DetailCard title="Menu structure" subtitle="Live sidebar order — use the arrows to reorder." pad={0}
          action={<span style={{ fontSize: 11, color: C.ocean, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: C.success }} />Live</span>}>
          <MenuTree menu={menu} selectedId={selectedId} onSelect={setSelectedId} onMove={api.moveNode} />
        </DetailCard>

        <DetailCard pad={0} style={{ minHeight: 360 }}>
          <MenuDetail node={selected} menu={menu} api={api} onSelect={setSelectedId} />
        </DetailCard>
      </div>
    </OpsPage>
  );
}

Object.assign(window, { Menus });
export { Menus };
