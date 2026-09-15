/* fm3-converted */
import React from "react";
import { METHOD_TONES, useTrackerMaster } from "./TrackerMasterData.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, DetailCard, Field, Icon, IconButton, TextInput, Textarea, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, OpsHero, OpsHeroButton, OpsPage, OpsStatCard, OpsStatGrid, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Tracker Step & Tracker Method screens.
   TrackerStepMaster   : ordered CRUD list of process steps (reorderable).
   TrackerMethodMaster : procurement methods + an editable SLA matrix wired to the steps. */

function _methodColor(C, tone) {
  return ({ brand: C.ocean, blue: C.blue, orange: C.orange, forest: C.forest, danger: C.danger })[tone] || C.ocean;
}

/* compact − value + day stepper */
function DayStepper({ value, onChange, disabled, min = 0, max = 365 }) {
  const C = useC();
  const v = Number(value) || 0;
  const set = (nv) => onChange(Math.max(min, Math.min(max, nv)));
  const btn = (icon, d) => (
    <button type="button" disabled={disabled} onClick={() => set(v + d)}
      style={{ ...FONT, width: 30, height: 34, border: "none", background: "transparent", color: disabled ? C.textSubtle : C.textMuted,
        cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={15} />
    </button>
  );
  return (
    <div style={{ display: "inline-flex", alignItems: "center", height: 34, borderRadius: RADIUS.md, overflow: "hidden",
      border: `1px solid ${C.border}`, backgroundColor: disabled ? C.surfaceAlt : C.inputBg, opacity: disabled ? 0.55 : 1 }}>
      {btn("minus", -1)}
      <input value={disabled ? "" : v} disabled={disabled} inputMode="numeric"
        onChange={(e) => set(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
        style={{ ...FONT, width: 40, height: "100%", textAlign: "center", border: "none", borderLeft: `1px solid ${C.borderSoft}`,
          borderRight: `1px solid ${C.borderSoft}`, background: "transparent", outline: "none", fontSize: 13.5, fontWeight: 700, color: C.text }} />
      {btn("plus", 1)}
    </div>
  );
}

/* ============================================================
   TRACKER STEP — Master Data
   ============================================================ */
function TrackerStepMaster() {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const session = useSession();
  const tm = useTrackerMaster();
  const [modal, setModal] = React.useState(null); // { mode, step }
  const [del, setDel] = React.useState(null);

  const save = (form) => {
    if (modal.mode === "edit") {
      tm.updateStep(form.id, { name: form.name, code: form.code, note: form.note });
      session.record({ action: "Update", module: "Proposal Tracker Step", desc: `Updated step ${form.name}`, tone: "brand" });
      toast.push({ title: "Step updated", description: form.name });
    } else {
      tm.addStep({ name: form.name, code: form.code, note: form.note });
      session.record({ action: "Create", module: "Proposal Tracker Step", desc: `Added step ${form.name}`, tone: "success" });
      toast.push({ title: "Step added", description: form.name });
    }
    setModal(null);
  };
  const confirmDelete = () => {
    tm.removeStep(del.id);
    session.record({ action: "Delete", module: "Proposal Tracker Step", desc: `Deleted step ${del.name}`, tone: "danger" });
    toast.push({ title: "Step deleted", tone: "error" });
    setDel(null);
  };

  const columns = [
    { key: "order", label: "#", width: 60, render: (r) => {
      const i = tm.steps.findIndex((s) => s.id === r.id);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.brandBg, color: C.ocean, fontWeight: 800, fontSize: 12, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "name", label: "Step", render: (r) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{r.name}</div>
        {r.note && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>{r.note}</div>}
      </div>) },
    { key: "code", label: "Code", width: 110, render: (r) => <Badge tone="neutral">{r.code || "—"}</Badge> },
    { key: "used", label: "Used by", width: 130, render: (r) => {
      const n = tm.stepUseCount(r.id);
      return <span style={{ fontSize: 12.5, color: n ? C.textMuted : C.textSubtle }}>{n} {n === 1 ? "method" : "methods"}</span>;
    } },
    { key: "_reorder", label: "Order", width: 92, render: (r) => {
      const i = tm.steps.findIndex((s) => s.id === r.id);
      return (
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 2 }}>
          <IconButton name="chevron-up" size="sm" title="Move up" onClick={() => tm.moveStep(r.id, -1)} style={i === 0 ? { opacity: 0.3, pointerEvents: "none" } : null} />
          <IconButton name="chevron-down" size="sm" title="Move down" onClick={() => tm.moveStep(r.id, 1)} style={i === tm.steps.length - 1 ? { opacity: 0.3, pointerEvents: "none" } : null} />
        </div>);
    } },
    { key: "_a", label: "", align: "right", width: 56, render: (r) => (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="pencil" label={t("act.edit")} onClick={() => setModal({ mode: "edit", step: r })} />
          <MenuDivider />
          <MenuItem icon="trash-2" label={t("act.delete")} danger onClick={() => setDel(r)} />
        </Menu>
      </div>) },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title="Proposal Tracker Step" subtitle="The ordered stages every procurement proposal moves through. These steps feed the SLA matrix on Proposal Tracker Method." compact
        right={<OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setModal({ mode: "create", step: null })}>Add step</OpsHeroButton>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="list-ordered" label="Total steps" value={tm.steps.length} iconTone="brand" />
        <OpsStatCard icon="workflow" label="Methods using them" value={tm.methods.length} iconTone="blue" />
        <OpsStatCard icon="flag-triangle-right" label="First → last" value={tm.steps.length ? `${tm.steps[0].code} → ${tm.steps[tm.steps.length - 1].code}` : "—"} iconTone="forest" />
      </OpsStatGrid>

      <Card pad={0}>
        <DataTable columns={columns} data={tm.steps} dense rowKey="id" onRowClick={(r) => setModal({ mode: "edit", step: r })}
          emptyTitle="No steps yet" emptyDesc="Add the first process step to get started." />
      </Card>

      <StepModal open={!!modal} mode={modal && modal.mode} step={modal && modal.step} onClose={() => setModal(null)} onSave={save} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title="Delete step" subtitle="This also removes it from every method's SLA."
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>Delete step</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>Remove <b>{del && del.name}</b> from the process?
          {del && tm.stepUseCount(del.id) > 0 && <> It is currently used by <b>{tm.stepUseCount(del.id)}</b> method(s).</>}</p>
      </Modal>
    </OpsPage>
  );
}

function StepModal({ open, mode, step, onClose, onSave }) {
  const isEdit = mode === "edit";
  const blank = { name: "", code: "", note: "" };
  const [form, setForm] = React.useState(blank);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { if (open) { setForm(step ? { ...blank, ...step } : blank); setErr(""); } }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return setErr("Enter the step name.");
    onSave({ ...form, id: step && step.id, name: form.name.trim(), code: (form.code || "").trim().toUpperCase(), note: (form.note || "").trim() });
  };
  return (
    <Modal open={open} onClose={onClose} width={520} icon={isEdit ? "pencil" : "plus"}
      title={isEdit ? "Edit step" : "Add step"} subtitle={isEdit ? "Update this process step" : "Create a new process step"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button iconLeft="check" onClick={submit}>{isEdit ? "Save changes" : "Add step"}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14 }}>
          <Field label="Step name" required>
            <TextInput value={form.name} onChange={(e) => { set("name", e.target.value); if (err) setErr(""); }} placeholder="e.g. Bid Evaluation" iconLeft="git-commit-horizontal" />
          </Field>
          <Field label="Code" helper="Short tag for the matrix">
            <TextInput value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. EVAL" />
          </Field>
        </div>
        <Field label="Description" helper="Optional — what happens in this step.">
          <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={3} placeholder="Short description of the step" />
        </Field>
        {err && <Alert tone="error" title={err} />}
      </div>
    </Modal>
  );
}

/* ============================================================
   TRACKER METHOD — Master Data (with SLA matrix wired to steps)
   ============================================================ */
function TrackerMethodMaster() {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const session = useSession();
  const tm = useTrackerMaster();
  const [methodModal, setMethodModal] = React.useState(null); // { mode, method }
  const [slaModal, setSlaModal] = React.useState(null);        // method
  const [del, setDel] = React.useState(null);

  const saveMethod = (form) => {
    if (methodModal.mode === "edit") {
      tm.updateMethod(form.id, { name: form.name, code: form.code, tone: form.tone, desc: form.desc });
      session.record({ action: "Update", module: "Proposal Tracker Method", desc: `Updated method ${form.name}`, tone: "brand" });
      toast.push({ title: "Method updated", description: form.name });
    } else {
      tm.addMethod({ name: form.name, code: form.code, tone: form.tone, desc: form.desc, sla: {} });
      session.record({ action: "Create", module: "Proposal Tracker Method", desc: `Added method ${form.name}`, tone: "success" });
      toast.push({ title: "Method added", description: form.name });
    }
    setMethodModal(null);
  };
  const confirmDelete = () => {
    tm.removeMethod(del.id);
    session.record({ action: "Delete", module: "Proposal Tracker Method", desc: `Deleted method ${del.name}`, tone: "danger" });
    toast.push({ title: "Method deleted", tone: "error" });
    setDel(null);
  };

  const totalSlaDays = tm.methods.reduce((s, m) => s + tm.slaTotal(m), 0);

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title="Proposal Tracker Method" subtitle="Procurement methods and the SLA (in working days) for each process step. Steps marked “—” are not applicable to that method." compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <OpsHeroButton variant="secondary" iconLeft="rotate-ccw" onClick={() => { tm.resetTrackerMaster(); toast.push({ title: "Reset to defaults", tone: "info" }); }}>Reset defaults</OpsHeroButton>
          <OpsHeroButton variant="primary" iconLeft="plus" onClick={() => setMethodModal({ mode: "create", method: null })}>Add method</OpsHeroButton>
        </div>} />
      <OpsStatGrid cols={3}>
        <OpsStatCard icon="workflow" label="Methods" value={tm.methods.length} iconTone="brand" />
        <OpsStatCard icon="list-ordered" label="Process steps" value={tm.steps.length} iconTone="blue" />
        <OpsStatCard icon="timer" label="Combined SLA days" value={totalSlaDays} sub="across all methods" iconTone="forest" />
      </OpsStatGrid>

      {/* method summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, tm.methods.length))}, 1fr)`, gap: 14, marginBottom: 16 }} className="ag-holiday-stats">
        {tm.methods.map((m) => {
          const color = _methodColor(C, m.tone);
          const steps = Object.keys(m.sla || {}).length;
          return (
            <Card key={m.id} style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: `3px solid ${color}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{m.name}</span>
                    <Badge tone={m.tone}>{m.code}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, lineHeight: 1.45 }}>{m.desc}</div>
                </div>
                <Menu align="right" width={184} trigger={<IconButton name="more-horizontal" size="sm" />}>
                  <MenuItem icon="sliders-horizontal" label="Configure SLA" onClick={() => setSlaModal(m)} />
                  <MenuItem icon="pencil" label={t("act.edit")} onClick={() => setMethodModal({ mode: "edit", method: m })} />
                  <MenuDivider />
                  <MenuItem icon="trash-2" label={t("act.delete")} danger onClick={() => setDel(m)} />
                </Menu>
              </div>
              <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{tm.slaTotal(m)}</div>
                  <div style={{ fontSize: 11.5, color: C.textSubtle }}>total SLA days</div>
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{steps}</div>
                  <div style={{ fontSize: 11.5, color: C.textSubtle }}>applicable steps</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <Button variant="secondary" size="sm" iconLeft="sliders-horizontal" onClick={() => setSlaModal(m)}>SLA</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* SLA matrix: steps (rows) × methods (columns) */}
      <DetailCard title="SLA matrix" subtitle="Working days per step for each method. Click a cell value or “Configure SLA” to edit." pad={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ ...FONT, width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "11px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted, borderBottom: `1px solid ${C.border}`, position: "sticky", left: 0, backgroundColor: C.surface, minWidth: 240 }}>Step</th>
                {tm.methods.map((m) => (
                  <th key={m.id} style={{ textAlign: "center", padding: "11px 16px", borderBottom: `1px solid ${C.border}`, minWidth: 130 }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{m.name}</span>
                      <Badge tone={m.tone} size="sm">{m.code}</Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tm.steps.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid ${C.borderSoft}`, position: "sticky", left: 0, backgroundColor: C.surface }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textMuted, fontWeight: 700, fontSize: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontWeight: 600, color: C.text }}>{s.name}</span>
                    </div>
                  </td>
                  {tm.methods.map((m) => {
                    const v = m.sla ? m.sla[s.id] : null;
                    const applicable = v != null;
                    return (
                      <td key={m.id} onClick={() => setSlaModal(m)} title="Click to edit this method's SLA"
                        style={{ padding: "10px 16px", borderBottom: `1px solid ${C.borderSoft}`, textAlign: "center", cursor: "pointer" }}>
                        {applicable
                          ? <span style={{ display: "inline-flex", minWidth: 30, justifyContent: "center", padding: "3px 10px", borderRadius: RADIUS.pill, backgroundColor: C.brandBg, color: C.ocean, fontWeight: 700, fontSize: 12.5 }}>{v}</span>
                          : <span style={{ color: C.textSubtle, fontWeight: 600 }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ padding: "12px 16px", fontWeight: 800, color: C.text, position: "sticky", left: 0, backgroundColor: C.surfaceAlt }}>Total SLA (days)</td>
                {tm.methods.map((m) => (
                  <td key={m.id} style={{ padding: "12px 16px", textAlign: "center", fontWeight: 800, color: C.text, backgroundColor: C.surfaceAlt }}>{tm.slaTotal(m)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DetailCard>

      <MethodModal open={!!methodModal} mode={methodModal && methodModal.mode} method={methodModal && methodModal.method} onClose={() => setMethodModal(null)} onSave={saveMethod} />
      <SlaModal method={slaModal} onClose={() => setSlaModal(null)} />
      <Modal open={!!del} onClose={() => setDel(null)} width={440} icon="trash-2" title="Delete method" subtitle="This action cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button><Button variant="destructive" iconLeft="trash-2" onClick={confirmDelete}>Delete method</Button></>}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, margin: 0 }}>Remove the <b>{del && del.name}</b> method and its SLA configuration?</p>
      </Modal>
    </OpsPage>
  );
}

function MethodModal({ open, mode, method, onClose, onSave }) {
  const C = useC();
  const isEdit = mode === "edit";
  const blank = { name: "", code: "", tone: "brand", desc: "" };
  const [form, setForm] = React.useState(blank);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { if (open) { setForm(method ? { ...blank, ...method } : blank); setErr(""); } }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return setErr("Enter the method name.");
    onSave({ ...form, id: method && method.id, name: form.name.trim(), code: (form.code || "").trim().toUpperCase(), desc: (form.desc || "").trim() });
  };
  return (
    <Modal open={open} onClose={onClose} width={540} icon={isEdit ? "pencil" : "plus"}
      title={isEdit ? "Edit method" : "Add method"} subtitle={isEdit ? "Update this procurement method" : "Create a new procurement method"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button iconLeft="check" onClick={submit}>{isEdit ? "Save changes" : "Add method"}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14 }}>
          <Field label="Method name" required>
            <TextInput value={form.name} onChange={(e) => { set("name", e.target.value); if (err) setErr(""); }} placeholder="e.g. Tender" iconLeft="workflow" />
          </Field>
          <Field label="Code">
            <TextInput value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. TND" />
          </Field>
        </div>
        <Field label="Accent color">
          <div style={{ display: "flex", gap: 8 }}>
            {METHOD_TONES.map((tn) => {
              const col = _methodColor(C, tn); const active = form.tone === tn;
              return <button key={tn} type="button" onClick={() => set("tone", tn)} title={tn}
                style={{ width: 32, height: 32, borderRadius: RADIUS.md, cursor: "pointer", backgroundColor: col,
                  border: active ? `2px solid ${C.text}` : `2px solid transparent`, boxShadow: active ? C.focusRing : "none" }} />;
            })}
          </div>
        </Field>
        <Field label="Description" helper="Optional — when this method applies.">
          <Textarea value={form.desc} onChange={(e) => set("desc", e.target.value)} rows={3} placeholder="Short description of the method" />
        </Field>
        {err && <Alert tone="error" title={err} />}
      </div>
    </Modal>
  );
}

function SlaModal({ method, onClose }) {
  const C = useC();
  const tm = useTrackerMaster();
  const toast = useToast();
  // read the live method from context so edits reflect immediately
  const live = method ? tm.methods.find((m) => m.id === method.id) : null;
  if (!live) return null;
  const total = tm.slaTotal(live);
  return (
    <Modal open={!!method} onClose={onClose} width={560} icon="sliders-horizontal"
      title={`Configure SLA — ${live.name}`} subtitle="Toggle which steps apply, then set the SLA in working days."
      footer={<Button iconLeft="check" onClick={() => { toast.push({ title: "SLA saved", description: `${live.name}: ${total} days total` }); onClose(); }}>Done</Button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tm.steps.map((s, i) => {
          const v = live.sla ? live.sla[s.id] : null;
          const applicable = v != null;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: RADIUS.md,
              border: `1px solid ${applicable ? C.border : C.borderSoft}`, backgroundColor: applicable ? C.surface : C.surfaceAlt }}>
              <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textMuted, fontWeight: 700, fontSize: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: applicable ? C.text : C.textMuted }}>{s.name}</div>
                <div style={{ fontSize: 11, color: C.textSubtle }}>{s.code}</div>
              </div>
              <Toggle checked={applicable} onChange={(on) => tm.setMethodStep(live.id, s.id, on ? (v || 1) : null)} />
              <DayStepper value={v || 0} disabled={!applicable} onChange={(nv) => tm.setMethodStep(live.id, s.id, nv)} />
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", marginTop: 4,
          borderRadius: RADIUS.md, backgroundColor: C.brandBg }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total SLA</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.ocean }}>{total} working days</span>
        </div>
      </div>
    </Modal>
  );
}

Object.assign(window, { TrackerStepMaster, TrackerMethodMaster });
export { TrackerStepMaster, TrackerMethodMaster };
