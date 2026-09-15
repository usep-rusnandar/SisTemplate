/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ City.
   Mirrors VendorConnect MSTR_CITY_T: CityId varchar(5) PK, CityName varchar(50), ProvinceId varchar(2) FK. */

const CITY_MASTER_KEY = "ag_city_master_v1";
const CITY_ID_MAX = 5;
const CITY_NAME_MAX = 50;
const CITY_MASTER_API = "/api/v1/master-data/sets/city";
const CITY_SET_NAME = "City";
const CITY_TABLE_NAME = "MSTR_CITY_T";
const CITY_OWNER = "Vendor";

const CityMasterCtx = React.createContext(null);

function _cloneCitySeed() {
  const seed = [];
  return seed.map((r) => ({ CityId: r.CityId, CityName: r.CityName, ProvinceId: r.ProvinceId }));
}

function _normCityId(id) {
  return String(id || "").trim().replace(/[^0-9.]/g, "").slice(0, CITY_ID_MAX);
}

function _normProvinceIdFk(id) {
  return String(id || "").trim().replace(/\D/g, "").slice(0, 2);
}

function _normCityName(name) {
  return String(name || "").trim().slice(0, CITY_NAME_MAX);
}

function _readCityMasterCache() {
  try {
    const value = window.__procurementStorage.getItem(CITY_MASTER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {}
  return null;
}

function _writeCityMasterCache(rows) {
  try { window.__procurementStorage.setItem(CITY_MASTER_KEY, JSON.stringify(rows)); } catch (e) {}
}

function _sortCityRows(rows) {
  return [...rows].sort((a, b) => a.CityId.localeCompare(b.CityId, undefined, { numeric: true }));
}

function _parseCityPayloadJson(payloadJson) {
  if (!payloadJson) return null;
  try { return JSON.parse(payloadJson); } catch (e) {}
  return null;
}

function _mapCityMasterRecords(records) {
  return _sortCityRows(
    (Array.isArray(records) ? records : [])
      .map((record) => {
        const payload = _parseCityPayloadJson(record.payloadJson);
        return {
          CityId: _normCityId(record.code),
          CityName: _normCityName(record.name),
          ProvinceId: _normProvinceIdFk(payload && (payload.ProvinceId || payload.provinceId)),
        };
      })
      .filter((record) => !!record.CityId && !!record.CityName && !!record.ProvinceId)
  );
}

async function _fetchCityMasterSet() {
  const response = await fetch(CITY_MASTER_API, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return response.json();
}

async function _replaceCityMasterRows(rows) {
  const response = await fetch(`${CITY_MASTER_API}/records:replace`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: CITY_SET_NAME,
      tableName: CITY_TABLE_NAME,
      owner: CITY_OWNER,
      records: rows.map((row) => ({
        code: row.CityId,
        name: row.CityName,
        status: "Active",
        description: "",
        payloadJson: JSON.stringify({ ProvinceId: row.ProvinceId }),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`City master sync failed with status ${response.status}.`);
  }
}

function CityMasterProvider({ children }) {
  const [rows, setRows] = React.useState(() => {
    const cached = _readCityMasterCache();
    return _sortCityRows(cached && cached.length ? cached : _cloneCitySeed());
  });
  const syncReadyRef = React.useRef(false);
  const lastSyncedRef = React.useRef("");

  React.useEffect(() => {
    _writeCityMasterCache(rows);
  }, [rows]);

  React.useEffect(() => {
    let cancelled = false;
    const cached = _readCityMasterCache();
    const fallbackRows = _sortCityRows(cached && cached.length ? cached : _cloneCitySeed());

    async function hydrate() {
      try {
        const payload = await _fetchCityMasterSet();
        if (cancelled || !payload) return;

        if (payload.hasData) {
          const nextRows = _mapCityMasterRecords(payload.records);
          if (!cancelled) {
            setRows(nextRows);
            lastSyncedRef.current = JSON.stringify(nextRows);
          }
          return;
        }

        if (!cancelled) {
          setRows(fallbackRows);
        }

        await _replaceCityMasterRows(fallbackRows);
        if (!cancelled) {
          lastSyncedRef.current = JSON.stringify(fallbackRows);
        }
      } catch (error) {
        console.warn("City master data API is unavailable; using cached/default rows.", error);
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

    void _replaceCityMasterRows(rows)
      .then(() => { lastSyncedRef.current = signature; })
      .catch((error) => {
        console.warn("City master data sync failed; cached state remains active.", error);
      });
  }, [rows]);

  const api = React.useMemo(() => ({
    rows,
    cityMap: Object.fromEntries(rows.map((r) => [r.CityId, r.CityName])),
    addCity: (CityId, CityName, ProvinceId) => {
      const id = _normCityId(CityId);
      const name = _normCityName(CityName);
      const pid = _normProvinceIdFk(ProvinceId);
      if (!id) return { ok: false, error: "City Id is required." };
      if (!name) return { ok: false, error: "City name is required." };
      if (!pid) return { ok: false, error: "Province is required." };
      if (rows.some((r) => r.CityId === id)) return { ok: false, error: "City Id already exists." };
      setRows((list) => [...list, { CityId: id, CityName: name, ProvinceId: pid }].sort((a, b) => a.CityId.localeCompare(b.CityId, undefined, { numeric: true })));
      return { ok: true, CityId: id, CityName: name, ProvinceId: pid };
    },
    updateCity: (CityId, CityName, ProvinceId) => {
      const name = _normCityName(CityName);
      const pid = _normProvinceIdFk(ProvinceId);
      if (!name) return { ok: false, error: "City name is required." };
      if (!pid) return { ok: false, error: "Province is required." };
      if (!rows.some((r) => r.CityId === CityId)) return { ok: false, error: "City record not found." };
      setRows((list) => list.map((r) => (r.CityId === CityId ? { ...r, CityName: name, ProvinceId: pid } : r)));
      return { ok: true, CityId, CityName: name, ProvinceId: pid };
    },
    removeCity: (CityId) => {
      setRows((list) => list.filter((r) => r.CityId !== CityId));
      return { ok: true };
    },
    resetCity: () => setRows(_sortCityRows(_cloneCitySeed())),
  }), [rows]);

  return <CityMasterCtx.Provider value={api}>{children}</CityMasterCtx.Provider>;
}

function useCityMaster() { return React.useContext(CityMasterCtx); }

Object.assign(window, { CITY_MASTER_KEY, CITY_ID_MAX, CITY_NAME_MAX, CityMasterProvider, useCityMaster });
export { CITY_MASTER_KEY, CITY_ID_MAX, CITY_NAME_MAX, CityMasterProvider, useCityMaster };
