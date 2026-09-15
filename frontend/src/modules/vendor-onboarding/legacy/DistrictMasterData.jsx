/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ District.
   Mirrors VendorConnect MSTR_DISTRICT_T: DistrictId varchar(8) PK, DistrictName varchar(50), CityId varchar(5) FK. */

const DISTRICT_MASTER_KEY = "ag_district_master_v1";
const DISTRICT_ID_MAX = 8;
const DISTRICT_NAME_MAX = 50;
const DISTRICT_MASTER_API = "/api/v1/master-data/sets/district";
const DISTRICT_SET_NAME = "District";
const DISTRICT_TABLE_NAME = "MSTR_DISTRICT_T";
const DISTRICT_OWNER = "Vendor";

const DistrictMasterCtx = React.createContext(null);

function _cloneDistrictSeed() {
  const seed = [];
  return seed.map((r) => ({ DistrictId: r.DistrictId, DistrictName: r.DistrictName, CityId: r.CityId }));
}

function _normDistrictId(id) {
  return String(id || "").trim().replace(/[^0-9.]/g, "").slice(0, DISTRICT_ID_MAX);
}

function _normCityIdFk(id) {
  return String(id || "").trim().replace(/[^0-9.]/g, "").slice(0, 5);
}

function _normDistrictName(name) {
  return String(name || "").trim().slice(0, DISTRICT_NAME_MAX);
}

function _readDistrictMasterCache() {
  try {
    const value = window.__procurementStorage.getItem(DISTRICT_MASTER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {}
  return null;
}

function _writeDistrictMasterCache(rows) {
  try { window.__procurementStorage.setItem(DISTRICT_MASTER_KEY, JSON.stringify(rows)); } catch (e) {}
}

function _sortDistrictRows(rows) {
  return [...rows].sort((a, b) => a.DistrictId.localeCompare(b.DistrictId, undefined, { numeric: true }));
}

function _parseDistrictPayloadJson(payloadJson) {
  if (!payloadJson) return null;
  try { return JSON.parse(payloadJson); } catch (e) {}
  return null;
}

function _mapDistrictMasterRecords(records) {
  return _sortDistrictRows(
    (Array.isArray(records) ? records : [])
      .map((record) => {
        const payload = _parseDistrictPayloadJson(record.payloadJson);
        return {
          DistrictId: _normDistrictId(record.code),
          DistrictName: _normDistrictName(record.name),
          CityId: _normCityIdFk(payload && (payload.CityId || payload.cityId)),
        };
      })
      .filter((record) => !!record.DistrictId && !!record.DistrictName && !!record.CityId)
  );
}

async function _fetchDistrictMasterSet() {
  const response = await fetch(DISTRICT_MASTER_API, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return response.json();
}

async function _replaceDistrictMasterRows(rows) {
  const response = await fetch(`${DISTRICT_MASTER_API}/records:replace`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: DISTRICT_SET_NAME,
      tableName: DISTRICT_TABLE_NAME,
      owner: DISTRICT_OWNER,
      records: rows.map((row) => ({
        code: row.DistrictId,
        name: row.DistrictName,
        status: "Active",
        description: "",
        payloadJson: JSON.stringify({ CityId: row.CityId }),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`District master sync failed with status ${response.status}.`);
  }
}

function DistrictMasterProvider({ children }) {
  const [rows, setRows] = React.useState(() => {
    const cached = _readDistrictMasterCache();
    return _sortDistrictRows(cached && cached.length ? cached : _cloneDistrictSeed());
  });
  const syncReadyRef = React.useRef(false);
  const lastSyncedRef = React.useRef("");

  React.useEffect(() => {
    _writeDistrictMasterCache(rows);
  }, [rows]);

  React.useEffect(() => {
    let cancelled = false;
    const cached = _readDistrictMasterCache();
    const fallbackRows = _sortDistrictRows(cached && cached.length ? cached : _cloneDistrictSeed());

    async function hydrate() {
      try {
        const payload = await _fetchDistrictMasterSet();
        if (cancelled || !payload) return;

        if (payload.hasData) {
          const nextRows = _mapDistrictMasterRecords(payload.records);
          if (!cancelled) {
            setRows(nextRows);
            lastSyncedRef.current = JSON.stringify(nextRows);
          }
          return;
        }

        if (!cancelled) {
          setRows(fallbackRows);
        }

        await _replaceDistrictMasterRows(fallbackRows);
        if (!cancelled) {
          lastSyncedRef.current = JSON.stringify(fallbackRows);
        }
      } catch (error) {
        console.warn("District master data API is unavailable; using cached/default rows.", error);
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

    void _replaceDistrictMasterRows(rows)
      .then(() => { lastSyncedRef.current = signature; })
      .catch((error) => {
        console.warn("District master data sync failed; cached state remains active.", error);
      });
  }, [rows]);

  const api = React.useMemo(() => ({
    rows,
    districtMap: Object.fromEntries(rows.map((r) => [r.DistrictId, r.DistrictName])),
    addDistrict: (DistrictId, DistrictName, CityId) => {
      const id = _normDistrictId(DistrictId);
      const name = _normDistrictName(DistrictName);
      const cid = _normCityIdFk(CityId);
      if (!id) return { ok: false, error: "District Id is required." };
      if (!name) return { ok: false, error: "District name is required." };
      if (!cid) return { ok: false, error: "City is required." };
      if (rows.some((r) => r.DistrictId === id)) return { ok: false, error: "District Id already exists." };
      setRows((list) => [...list, { DistrictId: id, DistrictName: name, CityId: cid }].sort((a, b) => a.DistrictId.localeCompare(b.DistrictId, undefined, { numeric: true })));
      return { ok: true, DistrictId: id, DistrictName: name, CityId: cid };
    },
    updateDistrict: (DistrictId, DistrictName, CityId) => {
      const name = _normDistrictName(DistrictName);
      const cid = _normCityIdFk(CityId);
      if (!name) return { ok: false, error: "District name is required." };
      if (!cid) return { ok: false, error: "City is required." };
      if (!rows.some((r) => r.DistrictId === DistrictId)) return { ok: false, error: "District record not found." };
      setRows((list) => list.map((r) => (r.DistrictId === DistrictId ? { ...r, DistrictName: name, CityId: cid } : r)));
      return { ok: true, DistrictId, DistrictName: name, CityId: cid };
    },
    removeDistrict: (DistrictId) => {
      setRows((list) => list.filter((r) => r.DistrictId !== DistrictId));
      return { ok: true };
    },
    resetDistrict: () => setRows(_sortDistrictRows(_cloneDistrictSeed())),
  }), [rows]);

  return <DistrictMasterCtx.Provider value={api}>{children}</DistrictMasterCtx.Provider>;
}

function useDistrictMaster() { return React.useContext(DistrictMasterCtx); }

Object.assign(window, { DISTRICT_MASTER_KEY, DISTRICT_ID_MAX, DISTRICT_NAME_MAX, DistrictMasterProvider, useDistrictMaster });
export { DISTRICT_MASTER_KEY, DISTRICT_ID_MAX, DISTRICT_NAME_MAX, DistrictMasterProvider, useDistrictMaster };
