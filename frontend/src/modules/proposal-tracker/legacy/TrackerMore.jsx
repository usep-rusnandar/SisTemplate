/* fm3-converted */
import React from "react";
import { TrkStatCard } from "../../../shared/legacy/TrkStatCard.jsx";
import { TRK_TODAY, trkDaysBetween, trkRp, trkRpM, useTrackerStore } from "./TrackerData.jsx";
import { Avatar, Badge, Button, Card, Icon } from "../../../shared/legacy/Primitives.jsx";
import { DataTable, PageHeader, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin - Tracker overdue monitor. */

function TrackerOverdue() {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const toast = useToast();
  const store = useTrackerStore();
  const [reminded, setReminded] = React.useState({});
  const rows = (store.proposals || [])
    .filter((p) => p.lifecycleStatus === "OnProgress" && (p.overdueDays || 0) > 0)
    .map((p) => {
      const current = (p.activities || []).find((a) => a.status === "Pending") || {};
      const elapsed = current.startedAt ? trkDaysBetween(current.startedAt, TRK_TODAY) : p.agingDays;
      return { ...p, currentActivity: current.title || p.currentStage, elapsed, target: current.targetLeadDays || p.slaDays, valueAtRisk: p.amount };
    })
    .sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0));
  const totalValue = rows.reduce((s, p) => s + p.valueAtRisk, 0);
  const avg = rows.length ? Math.round(rows.reduce((s, p) => s + p.overdueDays, 0) / rows.length) : 0;
  const remind = (p) => {
    setReminded((m) => ({ ...m, [p.id]: true }));
    toast.push({ title: tt("Reminder sent", "Reminder dikirim"), description: `${p.proposalNumber} - ${p.assignedOfficerName || p.ownerName}` });
  };
  return (
    <div>
      <PageHeader title={tt("Overdue Monitoring", "Monitoring Overdue")} description={tt("Active proposals whose current stage has passed SLA target.", "Proposal aktif yang current stage-nya melewati target SLA.")} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }} className="ag-trk-kpis">
        <TrkStatCard icon="alarm-clock" tone="danger" label={tt("Overdue proposals", "Proposal overdue")} value={rows.length} sub={tt("Need follow-up", "Perlu follow-up")} />
        <TrkStatCard icon="trending-up" tone="orange" label={tt("Avg days overdue", "Rata-rata hari overdue")} value={`${avg}d`} sub={tt("Across active overdue", "Dari proposal aktif overdue")} />
        <TrkStatCard icon="banknote" tone="blue" label={tt("Value at risk", "Nilai berisiko")} value={trkRpM(totalValue, lang)} sub="HPS" />
      </div>

      <Card pad={0}>
        <DataTable dense rowKey="id" data={rows} emptyTitle={tt("No overdue proposals", "Tidak ada proposal overdue")} emptyDesc={tt("All active proposals are within SLA.", "Semua proposal aktif masih dalam SLA.")}
          columns={[
            { key: "proposal", label: "Proposal", width: 340, render: (p) => <div><b style={{ color: C.ocean, fontFamily: "monospace", fontSize: 11.5 }}>{p.proposalNumber}</b><div style={{ fontWeight: 800, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div><div style={{ fontSize: 11.5, color: C.textSubtle }}>{p.jobsite} - {p.department}</div></div> },
            { key: "stage", label: tt("Stuck at", "Tertahan di"), width: 230, render: (p) => <Badge tone="danger"><Icon name="alert-triangle" size={12} />{p.currentActivity}</Badge> },
            { key: "owner", label: "Officer", width: 170, render: (p) => <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={p.assignedOfficerName || p.ownerName} size={26} /><span style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>{p.assignedOfficerName || p.ownerName}</span></div> },
            { key: "sla", label: "Elapsed / SLA", width: 130, align: "center", render: (p) => <span style={{ color: C.text }}>{p.elapsed} / {p.target}d</span> },
            { key: "over", label: "Over SLA", width: 110, align: "right", render: (p) => <b style={{ color: C.danger }}>+{p.overdueDays}d</b> },
            { key: "value", label: tt("Value", "Nilai"), width: 150, align: "right", render: (p) => <b>{trkRp(p.amount)}</b> },
            { key: "action", label: "", width: 140, align: "right", render: (p) => reminded[p.id] ? <Badge tone="success"><Icon name="check" size={11} />{tt("Reminded", "Terkirim")}</Badge> : <Button size="sm" variant="secondary" iconLeft="bell" onClick={(e) => { e.stopPropagation(); remind(p); }}>{tt("Remind", "Ingatkan")}</Button> },
          ]} />
      </Card>
    </div>
  );
}

Object.assign(window, { TrackerOverdue });
export { TrackerOverdue };
