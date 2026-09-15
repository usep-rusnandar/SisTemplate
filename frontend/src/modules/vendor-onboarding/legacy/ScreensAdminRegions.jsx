/* fm3-converted */
import React from "react";
import { useCityMaster } from "./CityMasterData.jsx";
import { useDistrictMaster } from "./DistrictMasterData.jsx";
import { useProvinceMaster } from "./ProvinceMasterData.jsx";
import { useVillageMaster } from "./VillageMasterData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Badge, Button, Card, Icon, Select, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { DataTable, MasterDataTabsCard, fmtAppDate, OpsHero, OpsHeroButton, OpsPage, Pagination, Toolbar, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — Master Data ▸ Administrative Regions (Wilayah Administrasi).
   Four-level Indonesian address hierarchy — Province → City → District → Village —
   presented as a dedicated reference page. Data is maintained via external sync (mocked
   here); tables are read-only in the UI. Source tables: MSTR_PROVINCE_T … MSTR_VILLAGE_T. */

const ADMIN_REGIONS_SYNC_KEY = "ag_admin_regions_sync_v1";
const ADMIN_REGIONS_SYNC_API = "/api/v1/master-data/regions/sync";
// Provider caches to clear after a sync so the read-only tables re-hydrate from the refreshed API.
const ADMIN_REGIONS_CACHE_KEYS = ["ag_province_master_v1", "ag_city_master_v1", "ag_district_master_v1"];

async function _fetchSyncStatus() {
  try {
    const res = await fetch(ADMIN_REGIONS_SYNC_API, { credentials: "include", headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function _startSync() {
  const res = await fetch(ADMIN_REGIONS_SYNC_API, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok && res.status !== 202) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.message || body.code || "";
    } catch (e) {}
    throw new Error(detail || `Sync request failed (${res.status}).`);
  }
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

function _clearRegionCaches() {
  ADMIN_REGIONS_CACHE_KEYS.forEach((key) => {
    try { window.__procurementStorage.removeItem(key); } catch (e) {}
  });
}

function _geoIdChip(children) {
  const C = useC();
  return (
    <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: C.ocean, backgroundColor: C.brandBg, padding: "3px 8px", borderRadius: 6, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{children}</span>
  );
}

function _syncStepLabel(status, tt) {
  const key = status && (status.stepKey || status.StepKey);
  const labels = {
    "fetch-province": tt("Fetching provinces…", "Mengunduh provinsi…"),
    "write-province": tt("Saving provinces…", "Menyimpan provinsi…"),
    "fetch-city": tt("Fetching cities / regencies…", "Mengunduh kota / kabupaten…"),
    "write-city": tt("Saving cities / regencies…", "Menyimpan kota / kabupaten…"),
    "fetch-district": tt("Fetching districts…", "Mengunduh kecamatan…"),
    "write-district": tt("Saving districts…", "Menyimpan kecamatan…"),
    "fetch-village": tt("Fetching villages…", "Mengunduh kelurahan / desa…"),
    "write-village": tt("Saving villages…", "Menyimpan kelurahan / desa…"),
    "skip-unchanged": tt("Source dataset unchanged — skipped refresh.", "Dataset sumber belum berubah — refresh dilewati."),
  };
  if (key && labels[key]) return labels[key];
  return (status && (status.currentStep || status.error)) || tt("Working…", "Memproses…");
}

function _syncProgress(status) {
  const percent = Math.max(0, Math.min(100, Number(status && status.progressPercent) || 0));
  const done = Math.max(0, Number(status && status.progressDone) || 0);
  const total = Math.max(0, Number(status && status.progressTotal) || 0);
  return { percent, done, total };
}

function GeoSyncPanel({ lastSync, syncing, onSync, statusText, failed, percent, done, total, sourceUpdatedAt }) {
  const C = useC();
  const tt = useTT();
  const when = lastSync ? `${new Date(lastSync).toLocaleString(undefined, { timeZone: "Asia/Jakarta" })} WIB` : tt("Never", "Belum pernah");
  const dataset = sourceUpdatedAt ? fmtAppDate(sourceUpdatedAt) : null;
  const showBar = syncing && Number.isFinite(percent);
  const countLabel = total > 0
    ? `${done.toLocaleString("id-ID")} / ${total.toLocaleString("id-ID")}`
    : null;
  return (
    <Card style={{ marginBottom: 16, padding: "14px 18px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.brandBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="globe" size={20} color={C.ocean} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{tt("External data source", "Sumber data eksternal")}</div>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>
              {tt("Records are refreshed from an official wilayah API — not edited manually in this screen.", "Data diperbarui dari API wilayah resmi — tidak diubah manual di layar ini.")}
            </div>
            <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 6 }}>
              {tt("Last sync", "Sinkron terakhir")}: <span style={{ fontWeight: 600, color: C.textMuted }}>{when}</span>
              {dataset ? (
                <>
                  <span style={{ margin: "0 8px" }}>·</span>
                  {tt("Dataset", "Dataset")}: <span style={{ fontWeight: 600, color: C.textMuted }}>{dataset}</span>
                </>
              ) : null}
              <span style={{ margin: "0 8px" }}>·</span>
              <span style={{ fontFamily: "monospace" }}>wilayah.id</span>
            </div>
            {(syncing || failed) && statusText ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, marginTop: 8, color: failed ? C.danger : C.ocean }}>
                {syncing && <Icon name="loader" size={12} color={C.ocean} />}
                <span style={{ fontWeight: 600 }}>{statusText}</span>
                {showBar && countLabel ? (
                  <span style={{ fontWeight: 600, color: C.textMuted }}>{countLabel}</span>
                ) : null}
              </div>
            ) : null}
            {showBar ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, maxWidth: 420 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: C.surfaceAlt, overflow: "hidden" }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                  <div style={{ height: "100%", width: `${percent}%`, borderRadius: 999, backgroundColor: percent >= 100 ? C.success : C.ocean, transition: "width 0.25s ease" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ocean, width: 40, textAlign: "right", flexShrink: 0 }}>{percent}%</span>
              </div>
            ) : null}
          </div>
        </div>
        {/* Regular Button (not OpsHeroButton) — this sits on a white Card, not the dark hero;
            OpsHeroButton renders white-on-white here and is effectively invisible. */}
        <Button variant="primary" iconLeft="refresh-cw" onClick={onSync} disabled={syncing}>
          {syncing ? tt("Syncing…", "Menyinkronkan…") : tt("Sync from source", "Sinkron dari sumber")}
        </Button>
      </div>
    </Card>
  );
}

function AdminRegionsTabToolbar({ ps, searchPlaceholder, hasFilter, onClear, sortKey, sortDir, onSortKey, onSortDir, sortLabel, sortDirLabel, filtered, total, clearLabel, leftExtra }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Toolbar style={{ margin: 0 }} left={<>
        <div ref={ps.ref} style={{ width: 240 }}>
          <TextInput iconLeft="search" placeholder={searchPlaceholder} value={ps.query} onChange={(e) => ps.setQuery(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} />
        </div>
        {leftExtra}
        <Button variant={sortKey === "id" ? "secondary" : "ghost"} size="sm" iconLeft="hash" onClick={onSortKey}>{sortLabel}</Button>
        <Button variant={sortDir === "asc" ? "secondary" : "ghost"} size="sm" iconLeft={sortDir === "asc" ? "arrow-down" : "arrow-up"} onClick={onSortDir}>{sortDirLabel}</Button>
        {hasFilter && <Button variant="link" size="sm" iconLeft="x" onClick={onClear}>{clearLabel}</Button>}
      </>} right={<Badge tone="neutral">{filtered} / {total}</Badge>} />
    </div>
  );
}

function GeoReadOnlyTable({ columns, rows, rowKey, source, page, pageCount, pageSize, total, onPage, onPageSize, emptyTitle, emptyDesc }) {
  const C = useC();
  const tt = useTT();
  return (
    <Card pad={0}>
      <DataTable columns={columns} data={rows} dense rowKey={rowKey} emptyTitle={emptyTitle} emptyDesc={emptyDesc} />
      <div style={{ padding: "4px 16px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
        <Pagination page={page} pageCount={pageCount} onPage={onPage} total={total} pageSize={pageSize} onPageSize={onPageSize} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderTop: `1px solid ${C.borderSoft}`, color: C.textSubtle }}>
        <Icon name="lock" size={12} color={C.textSubtle} />
        <span style={{ fontSize: 11.5 }}>{tt("Read-only · synced reference", "Hanya-baca · referensi tersinkron")} · <span style={{ fontFamily: "monospace" }}>{source}</span></span>
      </div>
    </Card>
  );
}

function useGeoPagedList({ rows, rowKey, nameKey, ps, extraFilter, deps = [] }) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sortKey, setSortKey] = React.useState("id");
  const [sortDir, setSortDir] = React.useState("asc");

  React.useEffect(() => { setPage(1); }, [ps.query, pageSize, sortKey, sortDir, ...deps]);

  const sorted = React.useMemo(() => [...rows].sort((a, b) => {
    const cmp = sortKey === "id"
      ? String(a[rowKey]).localeCompare(String(b[rowKey]), undefined, { numeric: true })
      : String(a[nameKey]).localeCompare(String(b[nameKey]));
    return sortDir === "asc" ? cmp : -cmp;
  }), [rows, sortKey, sortDir, rowKey, nameKey]);

  const filtered = React.useMemo(() => {
    let list = sorted;
    if (extraFilter) list = list.filter(extraFilter);
    const qq = ps.query.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((r) => String(r[rowKey]).toLowerCase().includes(qq) || String(r[nameKey]).toLowerCase().includes(qq));
  }, [sorted, ps.query, extraFilter, rowKey, nameKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  return { page, setPage, pageSize, setPageSize, sortKey, setSortKey, sortDir, setSortDir, filtered, pageRows, pageCount };
}

function AdminRegionsMasterData() {
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const pm = useProvinceMaster();
  const cm = useCityMaster();
  const dm = useDistrictMaster();
  const vm = useVillageMaster();
  const [tab, setTab] = React.useState("province");
  const [syncStatus, setSyncStatus] = React.useState(null);
  const [syncing, setSyncing] = React.useState(false);
  const pollRef = React.useRef(null);

  const lastSync = syncStatus ? syncStatus.lastSyncAt : null;

  // Village is lazy (fetched by district), so its total comes from the set-overview count, not rows.
  const [villageCount, setVillageCount] = React.useState(null);
  const refreshVillageCount = React.useCallback(() => {
    let alive = true;
    fetch("/api/v1/master-data/sets", { credentials: "include", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : []))
      .then((sets) => {
        const v = (Array.isArray(sets) ? sets : []).find((s) => s.key === "village");
        const rec = v && v.records && v.records[0];
        if (alive && rec) setVillageCount(Number(rec.name) || 0);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  React.useEffect(() => refreshVillageCount(), [refreshVillageCount]);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const finishSync = React.useCallback((status) => {
    stopPolling();
    setSyncing(false);
    // Data changed at scale: drop the read-only table caches so tabs re-hydrate from the refreshed API.
    _clearRegionCaches();
    refreshVillageCount();
    if (status && status.phase === "Failed") {
      toast.push({
        title: tt("Sync failed", "Sinkronisasi gagal"),
        description: (status && status.error) || tt("The wilayah.id sync did not complete.", "Sinkronisasi wilayah.id tidak selesai."),
        tone: "danger",
      });
      return;
    }
    session.record({ action: "Sync", module: "Administrative Regions", desc: "Refreshed wilayah reference data from wilayah.id", tone: "brand" });
    const summary = status
      ? tt(
          `Updated ${status.provinces} provinces, ${status.regencies} cities, ${status.districts} districts, ${status.villages} villages. Reload to view the refreshed tables.`,
          `Diperbarui ${status.provinces} provinsi, ${status.regencies} kota/kab, ${status.districts} kecamatan, ${status.villages} kel/desa. Muat ulang untuk melihat tabel terbaru.`
        )
      : tt("Reference tables updated from wilayah.id.", "Tabel referensi diperbarui dari wilayah.id.");
    toast.push({ title: tt("Sync complete", "Sinkronisasi selesai"), description: summary });
  }, [stopPolling, refreshVillageCount, toast, session, tt]);

  const startPolling = React.useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const status = await _fetchSyncStatus();
      if (!status) return;
      setSyncStatus(status);
      if (!status.running) {
        finishSync(status);
      }
    }, 1000);
  }, [stopPolling, finishSync]);

  // Initial load: reflect any run already in progress (e.g. scheduled or triggered elsewhere) and resume polling.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const status = await _fetchSyncStatus();
      if (!alive || !status) return;
      setSyncStatus(status);
      if (status.running) { setSyncing(true); startPolling(); }
    })();
    return () => { alive = false; stopPolling(); };
  }, [startPolling, stopPolling]);

  const counts = { province: pm.rows.length, city: cm.rows.length, district: dm.rows.length, village: villageCount == null ? "…" : villageCount };

  const tabs = [
    { id: "province", label: tt("Province", "Provinsi"), icon: "map", badge: counts.province },
    { id: "city", label: tt("City / Regency", "Kota / Kabupaten"), icon: "building-2", badge: counts.city },
    { id: "district", label: tt("District", "Kecamatan"), icon: "landmark", badge: counts.district },
    { id: "village", label: tt("Village", "Kelurahan / Desa"), icon: "home", badge: counts.village },
  ];

  const runSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const status = await _startSync();
      if (status) setSyncStatus(status);
      startPolling();
    } catch (e) {
      setSyncing(false);
      toast.push({
        title: tt("Sync failed to start", "Gagal memulai sinkronisasi"),
        description: (e && e.message) || String(e),
        tone: "danger",
      });
    }
  };

  const failed = !!(syncStatus && syncStatus.phase === "Failed");
  const progress = _syncProgress(syncStatus);
  const statusText = syncing
    ? _syncStepLabel(syncStatus, tt)
    : (failed ? ((syncStatus && (syncStatus.error || syncStatus.currentStep)) || null) : null);

  return (
    <OpsPage>
      <OpsHero kicker="Master data" kickerIcon="database" title={tt("Administrative Regions", "Wilayah Administrasi")}
        subtitle={tt(
          "Indonesian address hierarchy for vendor profiles — province through village. Maintained by periodic sync from an external wilayah service; browse and verify here.",
          "Hierarki alamat Indonesia untuk profil vendor — provinsi hingga kelurahan/desa. Dikelola lewat sinkronisasi berkala dari layanan wilayah eksternal; telusuri dan verifikasi di sini."
        )}
        compact
        right={<Badge tone="info" dot>{tt("Sync-managed", "Dikelola sinkron")}</Badge>} />

      <GeoSyncPanel lastSync={lastSync} syncing={syncing} onSync={runSync} statusText={statusText} failed={failed} percent={progress.percent} done={progress.done} total={progress.total} sourceUpdatedAt={(syncStatus && (syncStatus.sourceUpdatedAt || syncStatus.SourceUpdatedAt)) || null} />

      <MasterDataTabsCard tabs={tabs} active={tab} onChange={setTab}>
        {tab === "province" && <AdminRegionsProvinceTab />}
        {tab === "city" && <AdminRegionsCityTab />}
        {tab === "district" && <AdminRegionsDistrictTab />}
        {tab === "village" && <AdminRegionsVillageTab />}
      </MasterDataTabsCard>
    </OpsPage>
  );
}

function AdminRegionsProvinceTab() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const pm = useProvinceMaster();
  const ps = usePageSearch(tt("Search province id or name…", "Cari id atau nama provinsi…"));
  const geo = useGeoPagedList({ rows: pm.rows, rowKey: "ProvinceId", nameKey: "ProvinceName", ps });
  const hasFilter = !!ps.query.trim();

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = geo.filtered.findIndex((x) => x.ProvinceId === r.ProvinceId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("Province Id", "Id Provinsi"), width: 110, render: (r) => _geoIdChip(r.ProvinceId) },
    { key: "name", label: tt("Province Name", "Nama Provinsi"), render: (r) => <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.ProvinceName}</span> },
  ];

  return (
    <>
      <AdminRegionsTabToolbar ps={ps} searchPlaceholder={tt("Search province id or name…", "Cari id atau nama provinsi…")} hasFilter={hasFilter} onClear={() => ps.setQuery("")}
        sortKey={geo.sortKey} sortDir={geo.sortDir} onSortKey={() => geo.setSortKey((k) => (k === "id" ? "name" : "id"))} onSortDir={() => geo.setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        sortLabel={geo.sortKey === "id" ? tt("Province Id", "Id Provinsi") : tt("Province Name", "Nama Provinsi")}
        sortDirLabel={geo.sortKey === "id" ? (geo.sortDir === "asc" ? "0 → 9" : "9 → 0") : (geo.sortDir === "asc" ? "A → Z" : "Z → A")}
        filtered={geo.filtered.length} total={pm.rows.length} clearLabel={t("act.clear")} />
      <GeoReadOnlyTable columns={columns} rows={geo.pageRows} rowKey="ProvinceId" source="MSTR_PROVINCE_T"
        page={geo.page} pageCount={geo.pageCount} pageSize={geo.pageSize} total={geo.filtered.length} onPage={geo.setPage} onPageSize={(n) => { geo.setPageSize(n); geo.setPage(1); }}
        emptyTitle={hasFilter ? tt("No provinces match", "Tidak ada provinsi yang cocok") : tt("No province data", "Tidak ada data provinsi")}
        emptyDesc={tt("Run a sync to load wilayah reference data.", "Jalankan sinkronisasi untuk memuat data referensi wilayah.")} />
    </>
  );
}

function AdminRegionsCityTab() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const pm = useProvinceMaster();
  const cm = useCityMaster();
  const ps = usePageSearch(tt("Search city id or name…", "Cari id atau nama kota/kabupaten…"));
  const [provFilter, setProvFilter] = React.useState("all");
  const provOptions = React.useMemo(() => [{ value: "all", label: tt("All provinces", "Semua provinsi") }, ...pm.rows.map((r) => ({ value: r.ProvinceId, label: `${r.ProvinceId} — ${r.ProvinceName}` }))], [pm.rows, tt]);

  const extraFilter = React.useCallback((r) => provFilter === "all" || r.ProvinceId === provFilter, [provFilter]);
  const geo = useGeoPagedList({ rows: cm.rows, rowKey: "CityId", nameKey: "CityName", ps, extraFilter, deps: [provFilter] });
  const hasFilter = !!ps.query.trim() || provFilter !== "all";

  const filteredSearch = React.useMemo(() => {
    const qq = ps.query.trim().toLowerCase();
    if (!qq) return geo.filtered;
    return geo.filtered.filter((r) => (pm.provinceMap[r.ProvinceId] || "").toLowerCase().includes(qq));
  }, [geo.filtered, ps.query, pm.provinceMap]);

  const pageCount = Math.max(1, Math.ceil(filteredSearch.length / geo.pageSize));
  const pageRows = filteredSearch.slice((geo.page - 1) * geo.pageSize, geo.page * geo.pageSize);
  React.useEffect(() => { if (geo.page > pageCount) geo.setPage(pageCount); }, [geo.page, pageCount]);

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filteredSearch.findIndex((x) => x.CityId === r.CityId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("City Id", "Id Kota/Kab."), width: 120, render: (r) => _geoIdChip(r.CityId) },
    { key: "name", label: tt("City Name", "Nama Kota/Kabupaten"), render: (r) => <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.CityName}</span> },
    { key: "prov", label: tt("Province", "Provinsi"), width: 220, render: (r) => <span style={{ fontSize: 12.5, color: C.textMuted }}>{pm.provinceMap[r.ProvinceId] || r.ProvinceId}</span> },
  ];

  return (
    <>
      <AdminRegionsTabToolbar ps={ps} searchPlaceholder={tt("Search city id or name…", "Cari id atau nama kota/kabupaten…")} hasFilter={hasFilter} onClear={() => { ps.setQuery(""); setProvFilter("all"); }}
        sortKey={geo.sortKey} sortDir={geo.sortDir} onSortKey={() => geo.setSortKey((k) => (k === "id" ? "name" : "id"))} onSortDir={() => geo.setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        sortLabel={geo.sortKey === "id" ? tt("City Id", "Id Kota/Kab.") : tt("City Name", "Nama Kota/Kabupaten")}
        sortDirLabel={geo.sortKey === "id" ? (geo.sortDir === "asc" ? "0 → 9" : "9 → 0") : (geo.sortDir === "asc" ? "A → Z" : "Z → A")}
        filtered={filteredSearch.length} total={cm.rows.length} clearLabel={t("act.clear")}
        leftExtra={<Select value={provFilter} onChange={(e) => setProvFilter(e.target.value)} options={provOptions} style={{ minWidth: 200 }} />} />
      <GeoReadOnlyTable columns={columns} rows={pageRows} rowKey="CityId" source="MSTR_CITY_T"
        page={geo.page} pageCount={pageCount} pageSize={geo.pageSize} total={filteredSearch.length} onPage={geo.setPage} onPageSize={(n) => { geo.setPageSize(n); geo.setPage(1); }}
        emptyTitle={hasFilter ? tt("No cities match", "Tidak ada kota/kabupaten yang cocok") : tt("No city data", "Tidak ada data kota/kabupaten")}
        emptyDesc={tt("Run a sync to load wilayah reference data.", "Jalankan sinkronisasi untuk memuat data referensi wilayah.")} />
    </>
  );
}

function AdminRegionsDistrictTab() {
  const C = useC();
  const { t } = useI18n();
  const tt = useTT();
  const pm = useProvinceMaster();
  const cm = useCityMaster();
  const dm = useDistrictMaster();
  const cityById = React.useMemo(() => Object.fromEntries(cm.rows.map((r) => [r.CityId, r])), [cm.rows]);
  const ps = usePageSearch(tt("Search district…", "Cari kecamatan…"));
  const [provFilter, setProvFilter] = React.useState("all");
  const provOptions = React.useMemo(() => [{ value: "all", label: tt("All provinces", "Semua provinsi") }, ...pm.rows.map((r) => ({ value: r.ProvinceId, label: `${r.ProvinceId} — ${r.ProvinceName}` }))], [pm.rows, tt]);

  const extraFilter = React.useCallback((r) => {
    if (provFilter === "all") return true;
    const city = cityById[r.CityId];
    return city && city.ProvinceId === provFilter;
  }, [provFilter, cityById]);

  const geo = useGeoPagedList({ rows: dm.rows, rowKey: "DistrictId", nameKey: "DistrictName", ps, extraFilter, deps: [provFilter] });
  const hasFilter = !!ps.query.trim() || provFilter !== "all";

  const filteredSearch = React.useMemo(() => {
    const qq = ps.query.trim().toLowerCase();
    if (!qq) return geo.filtered;
    return geo.filtered.filter((r) => {
      const city = cityById[r.CityId];
      const provName = city ? (pm.provinceMap[city.ProvinceId] || "") : "";
      return (cm.cityMap[r.CityId] || "").toLowerCase().includes(qq) || provName.toLowerCase().includes(qq);
    });
  }, [geo.filtered, ps.query, cityById, cm.cityMap, pm.provinceMap]);

  const pageCount = Math.max(1, Math.ceil(filteredSearch.length / geo.pageSize));
  const pageRows = filteredSearch.slice((geo.page - 1) * geo.pageSize, geo.page * geo.pageSize);
  React.useEffect(() => { if (geo.page > pageCount) geo.setPage(pageCount); }, [geo.page, pageCount]);

  const columns = [
    { key: "idx", label: "#", width: 56, render: (r) => {
      const i = filteredSearch.findIndex((x) => x.DistrictId === r.DistrictId);
      return <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: "50%", backgroundColor: C.surfaceAlt, color: C.textSubtle, fontWeight: 700, fontSize: 11.5, alignItems: "center", justifyContent: "center" }}>{i + 1}</span>;
    } },
    { key: "id", label: tt("District Id", "Id Kecamatan"), width: 130, render: (r) => _geoIdChip(r.DistrictId) },
    { key: "name", label: tt("District Name", "Nama Kecamatan"), render: (r) => <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.DistrictName}</span> },
    { key: "city", label: tt("City", "Kota/Kabupaten"), width: 200, render: (r) => <span style={{ fontSize: 12.5, color: C.textMuted }}>{cm.cityMap[r.CityId] || r.CityId}</span> },
    { key: "prov", label: tt("Province", "Provinsi"), width: 180, render: (r) => {
      const city = cityById[r.CityId];
      return <span style={{ fontSize: 12.5, color: C.textMuted }}>{city ? (pm.provinceMap[city.ProvinceId] || city.ProvinceId) : "—"}</span>;
    } },
  ];

  return (
    <>
      <AdminRegionsTabToolbar ps={ps} searchPlaceholder={tt("Search district…", "Cari kecamatan…")} hasFilter={hasFilter} onClear={() => { ps.setQuery(""); setProvFilter("all"); }}
        sortKey={geo.sortKey} sortDir={geo.sortDir} onSortKey={() => geo.setSortKey((k) => (k === "id" ? "name" : "id"))} onSortDir={() => geo.setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        sortLabel={geo.sortKey === "id" ? tt("District Id", "Id Kecamatan") : tt("District Name", "Nama Kecamatan")}
        sortDirLabel={geo.sortKey === "id" ? (geo.sortDir === "asc" ? "0 → 9" : "9 → 0") : (geo.sortDir === "asc" ? "A → Z" : "Z → A")}
        filtered={filteredSearch.length} total={dm.rows.length} clearLabel={t("act.clear")}
        leftExtra={<Select value={provFilter} onChange={(e) => setProvFilter(e.target.value)} options={provOptions} style={{ minWidth: 200 }} />} />
      <GeoReadOnlyTable columns={columns} rows={pageRows} rowKey="DistrictId" source="MSTR_DISTRICT_T"
        page={geo.page} pageCount={pageCount} pageSize={geo.pageSize} total={filteredSearch.length} onPage={geo.setPage} onPageSize={(n) => { geo.setPageSize(n); geo.setPage(1); }}
        emptyTitle={hasFilter ? tt("No districts match", "Tidak ada kecamatan yang cocok") : tt("No district data", "Tidak ada data kecamatan")}
        emptyDesc={tt("Run a sync to load wilayah reference data.", "Jalankan sinkronisasi untuk memuat data referensi wilayah.")} />
    </>
  );
}

// Village is ~82k rows, so this tab cascades province → city → district and lazily fetches the
// villages for the selected district (via /sets/village?parent=), rather than loading everything.
function AdminRegionsVillageTab() {
  const C = useC();
  const tt = useTT();
  const pm = useProvinceMaster();
  const cm = useCityMaster();
  const dm = useDistrictMaster();
  const vm = useVillageMaster();
  const ps = usePageSearch(tt("Search village…", "Cari kelurahan/desa…"));
  const [provFilter, setProvFilter] = React.useState("");
  const [cityFilter, setCityFilter] = React.useState("");
  const [distFilter, setDistFilter] = React.useState("");
  const [villages, setVillages] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);

  const cityOptions = React.useMemo(() => cm.rows.filter((c) => !provFilter || c.ProvinceId === provFilter).map((c) => ({ value: c.CityId, label: `${c.CityId} — ${c.CityName}` })), [cm.rows, provFilter]);
  const distOptions = React.useMemo(() => dm.rows.filter((d) => !cityFilter || d.CityId === cityFilter).map((d) => ({ value: d.DistrictId, label: `${d.DistrictId} — ${d.DistrictName}` })), [dm.rows, cityFilter]);

  React.useEffect(() => { setCityFilter(""); setDistFilter(""); setVillages([]); }, [provFilter]);
  React.useEffect(() => { setDistFilter(""); setVillages([]); }, [cityFilter]);
  React.useEffect(() => {
    let alive = true;
    if (!distFilter) { setVillages([]); return; }
    vm.loadForDistrict(distFilter).then((rows) => { if (alive) { setVillages(rows); setPage(1); } });
    return () => { alive = false; };
  }, [distFilter, vm]);

  const filtered = React.useMemo(() => {
    const qq = ps.query.trim().toLowerCase();
    if (!qq) return villages;
    return villages.filter((v) => v.VillageId.toLowerCase().includes(qq) || v.VillageName.toLowerCase().includes(qq));
  }, [villages, ps.query]);
  React.useEffect(() => { setPage(1); }, [ps.query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const loading = vm.isLoading(distFilter);

  const columns = [
    { key: "id", label: tt("Village Id", "Id Kel/Desa"), width: 160, render: (r) => _geoIdChip(r.VillageId) },
    { key: "name", label: tt("Village Name", "Nama Kelurahan/Desa"), render: (r) => <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{r.VillageName}</span> },
  ];

  const selectStyle = { minWidth: 190 };
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
        <Select value={provFilter} onChange={(e) => setProvFilter(e.target.value)} style={selectStyle}
          options={[{ value: "", label: tt("Province…", "Provinsi…") }, ...pm.rows.map((p) => ({ value: p.ProvinceId, label: `${p.ProvinceId} — ${p.ProvinceName}` }))]} />
        <Select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} disabled={!provFilter} style={selectStyle}
          options={[{ value: "", label: tt("City / Regency…", "Kota / Kab…") }, ...cityOptions]} />
        <Select value={distFilter} onChange={(e) => setDistFilter(e.target.value)} disabled={!cityFilter} style={selectStyle}
          options={[{ value: "", label: tt("District…", "Kecamatan…") }, ...distOptions]} />
        <div ref={ps.ref} style={{ width: 200 }}>
          <TextInput iconLeft="search" placeholder={tt("Search village…", "Cari kelurahan/desa…")} value={ps.query} onChange={(e) => ps.setQuery(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} disabled={!distFilter} />
        </div>
        {distFilter && !loading && <Badge tone="neutral">{filtered.length} {tt("villages", "kel/desa")}</Badge>}
      </div>
      {!distFilter ? (
        <div style={{ padding: "44px 16px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
          {tt("Select province → city → district to browse villages.", "Pilih provinsi → kota/kab → kecamatan untuk menelusuri kelurahan/desa.")}
        </div>
      ) : loading ? (
        <div style={{ padding: "44px 16px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>{tt("Loading villages…", "Memuat kelurahan/desa…")}</div>
      ) : (
        <GeoReadOnlyTable columns={columns} rows={pageRows} rowKey="VillageId" source="MSTR_VILLAGE_T"
          page={page} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }}
          emptyTitle={tt("No villages in this district", "Tidak ada kelurahan/desa di kecamatan ini")}
          emptyDesc={tt("Try another district or keyword.", "Coba kecamatan atau kata kunci lain.")} />
      )}
    </>
  );
}

Object.assign(window, { ADMIN_REGIONS_SYNC_KEY, AdminRegionsMasterData });
export { ADMIN_REGIONS_SYNC_KEY, AdminRegionsMasterData };
