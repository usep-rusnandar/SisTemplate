/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ Province.
   Mirrors VendorConnect MSTR_PROVINCE_T: ProvinceId varchar(2) PK, ProvinceName varchar(50). */

const PROVINCE_MASTER_KEY = "ag_province_master_v1";
const PROVINCE_ID_MAX = 2;
const PROVINCE_NAME_MAX = 50;
const PROVINCE_MASTER_API = "/api/v1/master-data/sets/province";
const PROVINCE_SET_NAME = "Province";
const PROVINCE_TABLE_NAME = "MSTR_PROVINCE_T";
const PROVINCE_OWNER = "Vendor";

const ProvinceMasterCtx = React.createContext(null);

function _cloneProvinceSeed() {
  const seed = [];
  return seed.map((r) => ({ ProvinceId: r.ProvinceId, ProvinceName: r.ProvinceName }));
}

function _normProvinceId(id) {
  return String(id || "").trim().replace(/\D/g, "").slice(0, PROVINCE_ID_MAX);
}

function _normProvinceName(name) {
  return String(name || "").trim().slice(0, PROVINCE_NAME_MAX);
}

function _readProvinceMasterCache() {
  try {
    const value = window.__procurementStorage.getItem(PROVINCE_MASTER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {}
  return null;
}

function _writeProvinceMasterCache(rows) {
  try { window.__procurementStorage.setItem(PROVINCE_MASTER_KEY, JSON.stringify(rows)); } catch (e) {}
}

function _sortProvinceRows(rows) {
  return [...rows].sort((a, b) => a.ProvinceId.localeCompare(b.ProvinceId, undefined, { numeric: true }));
}

function _mapProvinceMasterRecords(records) {
  return _sortProvinceRows(
    (Array.isArray(records) ? records : [])
      .map((record) => ({
        ProvinceId: _normProvinceId(record.code),
        ProvinceName: _normProvinceName(record.name),
      }))
      .filter((record) => !!record.ProvinceId && !!record.ProvinceName)
  );
}

async function _fetchProvinceMasterSet() {
  const response = await fetch(PROVINCE_MASTER_API, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return response.json();
}

async function _replaceProvinceMasterRows(rows) {
  const response = await fetch(`${PROVINCE_MASTER_API}/records:replace`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: PROVINCE_SET_NAME,
      tableName: PROVINCE_TABLE_NAME,
      owner: PROVINCE_OWNER,
      records: rows.map((row) => ({
        code: row.ProvinceId,
        name: row.ProvinceName,
        status: "Active",
        description: "",
        payloadJson: null,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Province master sync failed with status ${response.status}.`);
  }
}

function ProvinceMasterProvider({ children }) {
  const [rows, setRows] = React.useState(() => {
    const cached = _readProvinceMasterCache();
    return _sortProvinceRows(cached && cached.length ? cached : _cloneProvinceSeed());
  });
  const syncReadyRef = React.useRef(false);
  const lastSyncedRef = React.useRef("");

  React.useEffect(() => {
    _writeProvinceMasterCache(rows);
  }, [rows]);

  React.useEffect(() => {
    let cancelled = false;
    const cached = _readProvinceMasterCache();
    const fallbackRows = _sortProvinceRows(cached && cached.length ? cached : _cloneProvinceSeed());

    async function hydrate() {
      try {
        const payload = await _fetchProvinceMasterSet();
        if (cancelled || !payload) return;

        if (payload.hasData) {
          const nextRows = _mapProvinceMasterRecords(payload.records);
          if (!cancelled) {
            setRows(nextRows);
            lastSyncedRef.current = JSON.stringify(nextRows);
          }
          return;
        }

        if (!cancelled) {
          setRows(fallbackRows);
        }

        await _replaceProvinceMasterRows(fallbackRows);
        if (!cancelled) {
          lastSyncedRef.current = JSON.stringify(fallbackRows);
        }
      } catch (error) {
        console.warn("Province master data API is unavailable; using cached/default rows.", error);
      } finally {
        syncReadyRef.current = true;
      }
    }

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!syncReadyRef.current) return;
    const signature = JSON.stringify(rows);
    if (signature === lastSyncedRef.current) return;

    void _replaceProvinceMasterRows(rows)
      .then(() => { lastSyncedRef.current = signature; })
      .catch((error) => {
        console.warn("Province master data sync failed; cached state remains active.", error);
      });
  }, [rows]);

  const api = React.useMemo(() => ({
    rows,
    provinceMap: Object.fromEntries(rows.map((r) => [r.ProvinceId, r.ProvinceName])),
    addProvince: (ProvinceId, ProvinceName) => {
      const id = _normProvinceId(ProvinceId);
      const name = _normProvinceName(ProvinceName);
      if (!id) return { ok: false, error: "Province Id is required." };
      if (!name) return { ok: false, error: "Province name is required." };
      if (rows.some((r) => r.ProvinceId === id)) return { ok: false, error: "Province Id already exists." };
      setRows((list) => [...list, { ProvinceId: id, ProvinceName: name }].sort((a, b) => a.ProvinceId.localeCompare(b.ProvinceId, undefined, { numeric: true })));
      return { ok: true, ProvinceId: id, ProvinceName: name };
    },
    updateProvince: (ProvinceId, ProvinceName) => {
      const name = _normProvinceName(ProvinceName);
      if (!name) return { ok: false, error: "Province name is required." };
      if (!rows.some((r) => r.ProvinceId === ProvinceId)) return { ok: false, error: "Province record not found." };
      setRows((list) => list.map((r) => (r.ProvinceId === ProvinceId ? { ...r, ProvinceName: name } : r)));
      return { ok: true, ProvinceId, ProvinceName: name };
    },
    removeProvince: (ProvinceId) => {
      setRows((list) => list.filter((r) => r.ProvinceId !== ProvinceId));
      return { ok: true };
    },
    resetProvince: () => setRows(_sortProvinceRows(_cloneProvinceSeed())),
  }), [rows]);

  return <ProvinceMasterCtx.Provider value={api}>{children}</ProvinceMasterCtx.Provider>;
}

function useProvinceMaster() { return React.useContext(ProvinceMasterCtx); }

Object.assign(window, { PROVINCE_MASTER_KEY, PROVINCE_ID_MAX, PROVINCE_NAME_MAX, ProvinceMasterProvider, useProvinceMaster });
export { PROVINCE_MASTER_KEY, PROVINCE_ID_MAX, PROVINCE_NAME_MAX, ProvinceMasterProvider, useProvinceMaster };
