/* fm2-converted */
import React from "react";
import { RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, Badge, StatusBadge, Card } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, fmtAppDateTime, useToast, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard } from "../../../shared/legacy/PrimitivesX.jsx";
import { useSession } from "../../session/legacy/Session.jsx";

const API = "/api/v1/super-admin/background-processes";

const KIND_LABEL = {
  scheduled: ["Scheduled", "Terjadwal"],
  interval: ["Interval", "Interval"],
  queue: ["Queue", "Antrean"],
  onDemand: ["On demand", "Sesuai permintaan"],
};

const NAME_LABEL = {
  wilayahSync: ["Administrative Regions sync", "Sinkronisasi Wilayah Administrasi"],
  retention: ["Data retention cleanup", "Pembersihan retensi data"],
  eproposalIngestion: ["E-Proposal ingestion", "Ingest E-Proposal"],
  contractImportQueue: ["Contract document import queue", "Antrean impor dokumen kontrak"],
  contractReminderScan: ["Contract expiry reminder scan", "Pemindaian pengingat berakhir kontrak"],
};

function kindTone(kind) {
  if (kind === "scheduled") return "brand";
  if (kind === "interval") return "info";
  if (kind === "queue") return "neutral";
  return "orange";
}

function statusOf(row) {
  if (row.running) return "Running";
  if (!row.enabled) return "Disabled";
  if (row.lastError) return "Error";
  if (row.idle && row.idleReason) return "Idle";
  return "Ready";
}

function BackgroundProcesses({ onNavigate }) {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const canRun = !!(session && session.can && session.can("settings.update"));
  const [items, setItems] = React.useState([]);
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busyKey, setBusyKey] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const response = await fetch(API, { credentials: "include", headers: { Accept: "application/json" } });
      if (!response.ok) {
        setError(tt("Could not load background processes.", "Tidak bisa memuat proses latar."));
        return;
      }
      const payload = await response.json();
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setNote(payload.architectureNote || "");
      setError("");
    } catch (e) {
      setError(tt("Backend unavailable.", "Backend tidak tersedia."));
    } finally {
      setLoading(false);
    }
  }, [tt]);

  React.useEffect(() => { load(); }, [load]);

  const anyRunning = items.some((row) => row.running);
  React.useEffect(() => {
    const ms = anyRunning ? 2000 : 15000;
    const id = window.setInterval(load, ms);
    return () => window.clearInterval(id);
  }, [anyRunning, load]);

  const runNow = async (row) => {
    if (!canRun || !row.canRunNow || busyKey) return;
    if (row.key === "wilayahSync") {
      const ok = window.confirm(tt(
        "Start Administrative Regions sync from wilayah.id now? This can take several minutes and must not overlap another run.",
        "Jalankan sinkronisasi Wilayah Administrasi dari wilayah.id sekarang? Ini bisa berlangsung beberapa menit dan tidak boleh tumpang tindih dengan proses lain.",
      ));
      if (!ok) return;
    }
    setBusyKey(row.key);
    try {
      const response = await fetch(`${API}/${encodeURIComponent(row.key)}/run`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 202 || response.ok) {
        toast.push({
          title: tt("Run requested", "Proses diminta"),
          description: payload && payload.message ? String(payload.message) : row.key,
        });
        if (payload && payload.process) {
          setItems((current) => current.map((item) => item.key === payload.process.key ? payload.process : item));
        } else {
          await load();
        }
      } else {
        toast.push({
          tone: "error",
          title: tt("Could not run", "Tidak bisa dijalankan"),
          description: (payload && payload.code) || tt("The process declined the request.", "Proses menolak permintaan."),
        });
      }
    } catch (e) {
      toast.push({ tone: "error", title: tt("Could not run", "Tidak bisa dijalankan"), description: tt("Backend unavailable.", "Backend tidak tersedia.") });
    } finally {
      setBusyKey("");
    }
  };

  const runningCount = items.filter((row) => row.running).length;
  const idleCount = items.filter((row) => row.idle && !row.running).length;
  const errorCount = items.filter((row) => row.lastError).length;

  const columns = [
    { key: "name", label: tt("Process", "Proses"), render: (row) => (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={row.kind === "queue" ? "list" : row.kind === "onDemand" ? "hand" : "timer"} size={17} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{(NAME_LABEL[row.key] && tt(NAME_LABEL[row.key][0], NAME_LABEL[row.key][1])) || row.name}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted }}>{row.moduleKey}</div>
        </div>
      </div>
    ) },
    { key: "kind", label: tt("Kind", "Jenis"), width: 120, render: (row) => (
      <Badge tone={kindTone(row.kind)}>{(KIND_LABEL[row.kind] && tt(KIND_LABEL[row.kind][0], KIND_LABEL[row.kind][1])) || row.kind}</Badge>
    ) },
    { key: "status", label: t("common.status"), width: 110, render: (row) => <StatusBadge status={statusOf(row)} /> },
    { key: "schedule", label: tt("Schedule", "Jadwal"), render: (row) => (
      <div>
        <div style={{ fontSize: 12.5, color: C.text }}>{row.scheduleSummary || "—"}</div>
        {row.idleReason && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3, lineHeight: 1.4 }}>{row.idleReason}</div>}
        {(row.queueDepth != null || row.inFlightCount != null) && (
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
            {tt("Queued", "Antre")} {row.queueDepth ?? 0} · {tt("In flight", "Berjalan")} {row.inFlightCount ?? 0}
          </div>
        )}
      </div>
    ) },
    { key: "lastRunAt", label: tt("Last run", "Terakhir"), nowrap: true, width: 168, render: (row) => (
      <span style={{ color: C.textMuted, fontSize: 12.5 }}>{row.lastRunAt ? fmtAppDateTime(row.lastRunAt) : "—"}</span>
    ) },
    { key: "nextRunAt", label: tt("Next run", "Berikutnya"), nowrap: true, width: 168, render: (row) => (
      <span style={{ color: C.textMuted, fontSize: 12.5 }}>{row.nextRunAt ? fmtAppDateTime(row.nextRunAt) : "—"}</span>
    ) },
    { key: "lastResult", label: tt("Result", "Hasil"), render: (row) => (
      <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
        <div style={{ color: C.textMuted }}>{row.lastResult || "—"}</div>
        {row.lastError && <div style={{ color: C.danger, marginTop: 3 }}>{row.lastError}</div>}
      </div>
    ) },
    { key: "actions", label: t("common.actions"), nowrap: true, width: 188, render: (row) => (
      <div style={{ display: "flex", gap: 6 }}>
        {canRun && row.canRunNow && (
          <Button size="sm" variant="secondary" iconLeft="play" disabled={busyKey === row.key} onClick={() => runNow(row)}>
            {tt("Run now", "Jalankan")}
          </Button>
        )}
        {row.operationalRoute && (
          <Button size="sm" variant="ghost" iconLeft="arrow-up-right" onClick={() => onNavigate && onNavigate(row.operationalRoute)}>
            {tt("Open", "Buka")}
          </Button>
        )}
      </div>
    ) },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Super Admin" kickerIcon="crown" title={t("nav.backgroundProcesses")} subtitle={tt(
        "Status of scheduled, interval, and queue processes that run inside this AppHost. Module screens still own day-to-day operations.",
        "Status proses terjadwal, interval, dan antrean yang berjalan di AppHost ini. Layar modul tetap menjadi tempat kerja harian.",
      )} compact
        right={<OpsHeroButton variant="secondary" iconLeft="rotate-ccw" onClick={load}>{t("act.refresh")}</OpsHeroButton>} />

      {note && <Alert tone="info" title={tt("In-process host", "Host in-process")} description={note} style={{ marginBottom: 16 }} />}
      {error && <Alert tone="danger" title={tt("Could not load", "Gagal memuat")} description={error} style={{ marginBottom: 16 }} />}

      <OpsStatGrid cols={4}>
        <OpsStatCard icon="timer" label={tt("Processes", "Proses")} value={items.length} iconTone="brand" />
        <OpsStatCard icon="play" label={tt("Running", "Berjalan")} value={runningCount} iconTone="forest" />
        <OpsStatCard icon="pause" label={tt("Idle", "Idle")} value={idleCount} iconTone="blue" />
        <OpsStatCard icon="alert-triangle" label={tt("With errors", "Ada error")} value={errorCount} iconTone="orange" />
      </OpsStatGrid>

      <Card pad={0}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<Badge tone="brand">{items.length} {tt("processes", "proses")}</Badge>}
            right={loading ? <span style={{ fontSize: 12, color: C.textMuted }}>{tt("Loading…", "Memuat…")}</span> : null} />
        </div>
        <DataTable columns={columns} data={items} dense rowKey="key" emptyTitle={tt("No processes registered", "Tidak ada proses terdaftar")} emptyDesc={tt("The host has not published a catalog yet.", "Host belum memublikasikan katalog.")} />
      </Card>
    </OpsPage>
  );
}

Object.assign(window, { BackgroundProcesses });
export { BackgroundProcesses };
