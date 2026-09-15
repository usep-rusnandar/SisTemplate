/* fm3-converted */
import React from "react";
import { TRK_AS_OF, TRK_JOBSITES, TRK_METHODS, TRK_STAGE_MASTER, TRK_STATUS_META, trkDashboardMetrics, trkFmtDate, trkHydrateFromDomain, trkIsActorProposal, trkLifecycleStatusForProposal, trkNormalizeProposalLifecycle, trkRp, trkRpM, trkSlaVarianceRows, trkStageShortLabel, trkText, useTrackerStore } from "./TrackerData.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, DetailCard, Icon } from "../../../shared/legacy/Primitives.jsx";
import { EmptyState, PageHeader } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { TrkStatCard } from "../../../shared/legacy/TrkStatCard.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin - Tracker dashboard rebuilt as a procurement control room. */

function TrkMiniBar({ label, value, max, color, trailing }) {
  const C = useC();
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 5, fontSize: 12 }}>
        <span style={{ color: C.text, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        <span style={{ color: C.textMuted, flexShrink: 0 }}>{trailing || value}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, backgroundColor: C.surfaceAlt, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function TrkPipelineRail({ proposals }) {
  const C = useC();
  const active = proposals.filter((p) => p.activities && p.activities.length);
  const counts = TRK_STAGE_MASTER.map((stage) => ({
    stage,
    count: active.filter((p) => p.currentStage === stage.name || p.activities.some((a) => a.stageId === stage.id && a.status === "Pending")).length,
    completed: active.filter((p) => p.activities.some((a) => a.stageId === stage.id && a.status === "Completed")).length,
  }));
  const max = Math.max(1, ...counts.map((r) => r.count + r.completed));
  const palette = [C.blue, C.ocean, C.success, C.orange, C.danger];
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, TRK_STAGE_MASTER.length)}, minmax(90px, 1fr))`, gap: 8, overflowX: "auto", paddingBottom: 4 }}>
      {counts.map((row, index) => {
        const color = palette[index % palette.length];
        const height = 34 + Math.round(((row.count + row.completed) / max) * 84);
        return (
          <div key={row.stage.id} style={{ minWidth: 92, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <div style={{ height: 128, display: "flex", alignItems: "flex-end", width: "100%" }}>
              <div style={{ width: "100%", height, borderRadius: "6px 6px 3px 3px", background: `linear-gradient(180deg, ${color}, ${color}aa)`, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 7, color: "#fff", fontWeight: 800, fontSize: 12 }}>
                {row.count + row.completed}
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: 10.5, color: C.textMuted, fontWeight: 700, lineHeight: 1.25, minHeight: 40 }}>{row.stage.code}<br /><span style={{ fontWeight: 500 }}>{row.stage.name}</span></div>
          </div>
        );
      })}
    </div>
  );
}

function TrkDirectActionList({ store, onNavigate }) {
  const C = useC();
  const tt = useTT();
  const rows = (store.proposals || [])
    .map(trkNormalizeProposalLifecycle)
    .filter((p) => trkLifecycleStatusForProposal(p) === "OnProgress")
    .map((p) => ({
      ...p,
      activeActivity: ((p.activities || []).find((a) => a.status === "Pending") || {}).title || p.currentStage,
      completedCount: (p.activities || []).filter((a) => a.status === "Completed").length,
    }))
    .sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0))
    .slice(0, 6);
  return (
    <DetailCard title={tt("Section Head actions", "Aksi Section Head")} subtitle={tt("Active proposals with direct recycle or cancel scope.", "Proposal aktif dengan ruang aksi recycle atau cancel langsung.")}
      action={<Button variant="link" size="sm" iconRight="arrow-right" onClick={() => onNavigate("trackerProposals")}>{tt("Open", "Buka")}</Button>}>
      {rows.length === 0 ? <EmptyState icon="check-check" title={tt("No active proposal", "Tidak ada proposal aktif")} description={tt("Workflow queue is clear.", "Antrian workflow bersih.")} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: (r.overdueDays || 0) > 0 ? C.dangerBg : C.brandBg, color: (r.overdueDays || 0) > 0 ? C.danger : C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={(r.overdueDays || 0) > 0 ? "alarm-clock" : "route"} size={16} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: C.ocean, fontWeight: 800 }}>{r.proposalNumber}</span>
                  <Badge tone={(r.overdueDays || 0) > 0 ? "danger" : "info"} size="sm">{r.completedCount} done</Badge>
                </div>
                <div style={{ fontSize: 12.5, color: C.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.activeActivity}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.assignedOfficerName || r.ownerName}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DetailCard>
  );
}

function TrackerDashboard({ onNavigate }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const store = useTrackerStore();
  // Hydrate from domain so ingested E-Proposal proposals appear regardless of entry point.
  React.useEffect(() => { trkHydrateFromDomain(); }, []);
  // Scope dashboard numbers to the proposals visible to the current user (same rule as the
  // proposal list): owner, assigned officer, or their manager. So each user's totals match their list.
  const proposals = (store.proposals || []).map(trkNormalizeProposalLifecycle).filter((p) => trkIsActorProposal(p, session));
  const scopedStore = { ...store, proposals };
  const metrics = trkDashboardMetrics(proposals);
  const byJobsite = TRK_JOBSITES.map((site) => ({
    site,
    count: proposals.filter((p) => p.jobsite === site).length,
    value: proposals.filter((p) => p.jobsite === site).reduce((s, p) => s + p.amount, 0),
  })).sort((a, b) => b.value - a.value);
  const maxSiteValue = Math.max(1, ...byJobsite.map((r) => r.value));
  const lifecycleRows = Object.keys(TRK_STATUS_META).map((key) => ({ key, meta: TRK_STATUS_META[key], count: proposals.filter((p) => trkLifecycleStatusForProposal(p) === key).length }));
  const maxLifecycle = Math.max(1, ...lifecycleRows.map((r) => r.count));
  const topVariance = trkSlaVarianceRows(proposals).slice(0, 6);
  const topValue = proposals.slice().sort((a, b) => b.amount - a.amount).slice(0, 8);
  const methodCounts = TRK_METHODS.map((m) => ({ method: m, count: proposals.filter((p) => p.trackerMethod === m.id).length }));

  return (
    <div>
      <PageHeader
        title={tt("Tracker Control Room", "Control Room Tracker")}
        description={tt("Live procurement tracker portfolio: distribution, SLA, award to Term Sheet, then LOA in parallel with Contract.", "Portfolio tracker pengadaan: distribusi, SLA, award ke Term Sheet, lalu LOA paralel dengan Contract.")}
        actions={<>
          <Button iconLeft="list-checks" onClick={() => onNavigate("trackerProposals")}>{tt("Open proposals", "Buka proposal")}</Button>
        </>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.55fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }} className="ag-trk-kpis">
        <TrkStatCard icon="folder-kanban" tone="blue" label={tt("Total proposals", "Total proposal")} value={metrics.total} sub={tt(`${metrics.ready} ready to distribute`, `${metrics.ready} siap distribusi`)} />
        <TrkStatCard
          icon="banknote"
          tone="forest"
          label={tt("Total value", "Total nilai")}
          value={trkRpM(metrics.totalValue, lang)}
          valueTitle={trkRp(metrics.totalValue)}
          valueStyle={{ fontSize: 20, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          sub="HPS portfolio"
        />
        <TrkStatCard icon="activity" tone="brand" label={tt("On progress", "Sedang berjalan")} value={metrics.onProgress} sub={`${metrics.avgLeadTime} avg aging days`} />
        <TrkStatCard icon="alarm-clock" tone="danger" label="Overdue" value={metrics.overdue} sub={`${metrics.maxDelay} max delay days`} />
        <TrkStatCard icon="check-circle-2" tone="forest" label="Completed" value={metrics.completed} sub={tt("Contract completed", "Contract selesai")} />
        <TrkStatCard icon="ban" tone={metrics.canceled ? "danger" : "neutral"} label="Canceled" value={metrics.canceled} sub={tt("Direct Section Head closure", "Closure langsung Section Head")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, marginBottom: 16 }} className="ag-trk-row3">
        <DetailCard title={tt("Stage pressure map", "Peta tekanan stage")} subtitle={tt("Active and completed volume across tracker stages.", "Volume aktif dan selesai di setiap stage tracker.")}>
          <TrkPipelineRail proposals={proposals} />
        </DetailCard>
        <DetailCard title={tt("Lifecycle composition", "Komposisi lifecycle")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lifecycleRows.map((row) => (
              <TrkMiniBar key={row.key} label={trkText(lang, row.meta)} value={row.count} max={maxLifecycle} color={
                row.meta.tone === "danger" ? C.danger : row.meta.tone === "success" ? C.success : row.meta.tone === "orange" ? C.orange : row.meta.tone === "warning" ? C.warningText : C.ocean
              } trailing={`${row.count} / ${metrics.total}`} />
            ))}
          </div>
        </DetailCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }} className="ag-trk-row3">
        <DetailCard title={tt("Value by jobsite", "Nilai per jobsite")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {byJobsite.map((row) => <TrkMiniBar key={row.site} label={row.site} value={row.value} max={maxSiteValue} color={C.blue} trailing={`${trkRpM(row.value, lang)} - ${row.count}`} />)}
          </div>
        </DetailCard>
        <DetailCard title={tt("Method mix", "Komposisi metode")}>
          <div style={{ display: "grid", gap: 10 }}>
            {methodCounts.map((row) => (
              <div key={row.method.id} style={{ padding: 12, border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, backgroundColor: C.surfaceInset }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{row.method.name}</div>
                    <div style={{ fontSize: 11.5, color: C.textMuted }}>{row.method.slaDays} SLA days - {row.method.stages.length} stages</div>
                  </div>
                  <Badge tone={row.method.tone}>{row.count}</Badge>
                </div>
              </div>
            ))}
          </div>
        </DetailCard>
        <TrkDirectActionList store={scopedStore} onNavigate={onNavigate} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="ag-trk-row3">
        <DetailCard title={tt("SLA variance watchlist", "Watchlist deviasi SLA")} pad={0}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...FONT, width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: C.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, width: "46%" }}>Proposal</th>
                  <th style={{ textAlign: "left", padding: "10px 10px", color: C.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, width: "14%" }}>Stage</th>
                  <th style={{ textAlign: "right", padding: "10px 10px", color: C.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, width: "16%" }}>Variance</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: C.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, width: "24%" }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {topVariance.map((r) => (
                  <tr key={r.proposalId}>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}`, minWidth: 0 }}><b style={{ color: C.ocean, fontFamily: "monospace" }}>{r.proposalNumber}</b><div style={{ color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div></td>
                    <td style={{ padding: "10px 10px", borderBottom: `1px solid ${C.borderSoft}`, color: C.textMuted, whiteSpace: "nowrap" }}>{trkStageShortLabel(r.currentStage)}</td>
                    <td style={{ padding: "10px 10px", borderBottom: `1px solid ${C.borderSoft}`, textAlign: "right" }}><Badge tone={r.varianceDays > 0 ? "danger" : "success"}>{r.varianceDays > 0 ? "+" : ""}{r.varianceDays}d</Badge></td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}`, color: C.textMuted, whiteSpace: "nowrap" }}>{trkFmtDate(r.requirementDate, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailCard>

        <DetailCard title={tt("Top value proposals", "Proposal nilai terbesar")} pad={0}
          action={<Button variant="link" size="sm" iconRight="arrow-right" onClick={() => onNavigate("trackerProposals")}>{tt("Detail", "Detail")}</Button>}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...FONT, width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: C.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, width: "42%" }}>Proposal</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", color: C.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, width: "14%" }}>Site</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", color: C.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, width: "12%" }}>Stage</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", color: C.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, width: "32%" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {topValue.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}`, minWidth: 0 }}>
                      <b style={{ color: C.ocean, fontFamily: "monospace", fontSize: 11.5 }}>{p.proposalNumber}</b>
                      <div style={{ color: C.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${C.borderSoft}` }}><Badge tone="neutral">{p.jobsite}</Badge></td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${C.borderSoft}`, color: C.textMuted, whiteSpace: "nowrap" }}>{trkStageShortLabel(p.currentStage)}</td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}`, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700 }}>{trkRp(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailCard>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12, color: C.textSubtle }}>
        <Icon name="database" size={14} />{tt("Source: rebuilt in-memory tracker seed with backend API persistence.", "Sumber: seed tracker baru dengan persistensi API backend.")} {tt("Last updated", "Terakhir diperbarui")}: <b style={{ color: C.text }}>{TRK_AS_OF} WIB</b>
      </div>
    </div>
  );
}

Object.assign(window, { TrkStatCard, TrackerDashboard });
export { TrkStatCard, TrackerDashboard };
