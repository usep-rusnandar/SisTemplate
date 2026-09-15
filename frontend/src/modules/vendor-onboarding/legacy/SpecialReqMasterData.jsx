/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ Special Requirement.
   Mirrors VendorConnect MSTR_SPECIAL_REQUIREMENT_T. */

const SPECIAL_REQ_MASTER_KEY = "ag_special_req_master_v1";
const SPECIAL_REQ_ID_MAX = 10;
const SPECIAL_REQ_DESC_MAX = 100;
const SPECIAL_REQ_MASTER_API = "/api/v1/master-data/sets/special-requirement";
const SPECIAL_REQ_SET_NAME = "Special Requirement";
const SPECIAL_REQ_TABLE_NAME = "MSTR_SPECIAL_REQUIREMENT_T";
const SPECIAL_REQ_OWNER = "Vendor";

const SpecialReqMasterCtx = React.createContext(null);

function _cloneSpecialReqSeed() {
  const seed = [];
  return seed.map((r) => ({
    SpecialReqId: r.SpecialReqId,
    SpecialReqDesc: r.SpecialReqDesc,
    SpecialReqIsActive: !!r.SpecialReqIsActive,
    SpecialReqOrder: r.SpecialReqOrder != null ? Number(r.SpecialReqOrder) : 0,
  }));
}

function _normSpecialReqId(id) {
  return String(id || "").trim().slice(0, SPECIAL_REQ_ID_MAX);
}

function _normSpecialReqDesc(desc) {
  return String(desc || "").trim().slice(0, SPECIAL_REQ_DESC_MAX);
}

function _normSpecialReqOrder(order) {
  const n = parseInt(String(order ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

function _readSpecialReqMasterCache() {
  try {
    const value = window.__procurementStorage.getItem(SPECIAL_REQ_MASTER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {}
  return null;
}

function _writeSpecialReqMasterCache(rows) {
  try { window.__procurementStorage.setItem(SPECIAL_REQ_MASTER_KEY, JSON.stringify(rows)); } catch (e) {}
}

function _sortSpecialReqRows(rows) {
  return [...rows].sort((a, b) => (a.SpecialReqOrder - b.SpecialReqOrder) || a.SpecialReqId.localeCompare(b.SpecialReqId));
}

function _parseSpecialReqPayloadJson(payloadJson) {
  if (!payloadJson) return null;
  try { return JSON.parse(payloadJson); } catch (e) {}
  return null;
}

function _mapSpecialReqMasterRecords(records) {
  return _sortSpecialReqRows(
    (Array.isArray(records) ? records : [])
      .map((record) => {
        const payload = _parseSpecialReqPayloadJson(record.payloadJson);
        // Payload keys arrive camelCase from the backend seeder (Web JSON defaults); accept either case.
        const rawActive = payload ? (payload.SpecialReqIsActive != null ? payload.SpecialReqIsActive : payload.specialReqIsActive) : undefined;
        const rawOrder = payload ? (payload.SpecialReqOrder != null ? payload.SpecialReqOrder : payload.specialReqOrder) : undefined;
        return {
          SpecialReqId: _normSpecialReqId(record.code),
          SpecialReqDesc: _normSpecialReqDesc(record.name),
          SpecialReqIsActive: rawActive != null ? !!rawActive : record.status !== "Inactive",
          SpecialReqOrder: rawOrder != null ? _normSpecialReqOrder(rawOrder) : 0,
        };
      })
      .filter((record) => !!record.SpecialReqId && !!record.SpecialReqDesc)
  );
}

async function _fetchSpecialReqMasterSet() {
  const response = await fetch(SPECIAL_REQ_MASTER_API, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return response.json();
}

async function _replaceSpecialReqMasterRows(rows) {
  const response = await fetch(`${SPECIAL_REQ_MASTER_API}/records:replace`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: SPECIAL_REQ_SET_NAME,
      tableName: SPECIAL_REQ_TABLE_NAME,
      owner: SPECIAL_REQ_OWNER,
      records: rows.map((row) => ({
        code: row.SpecialReqId,
        name: row.SpecialReqDesc,
        status: row.SpecialReqIsActive ? "Active" : "Inactive",
        description: "",
        payloadJson: JSON.stringify({
          SpecialReqIsActive: !!row.SpecialReqIsActive,
          SpecialReqOrder: _normSpecialReqOrder(row.SpecialReqOrder),
        }),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Special requirement master sync failed with status ${response.status}.`);
  }
}

function SpecialReqMasterProvider({ children }) {
  const [rows, setRows] = React.useState(() => {
    const cached = _readSpecialReqMasterCache();
    return _sortSpecialReqRows(cached && cached.length ? cached : _cloneSpecialReqSeed());
  });
  const syncReadyRef = React.useRef(false);
  const lastSyncedRef = React.useRef("");

  React.useEffect(() => {
    _writeSpecialReqMasterCache(rows);
  }, [rows]);

  React.useEffect(() => {
    let cancelled = false;
    const cached = _readSpecialReqMasterCache();
    const fallbackRows = _sortSpecialReqRows(cached && cached.length ? cached : _cloneSpecialReqSeed());

    async function hydrate() {
      try {
        const payload = await _fetchSpecialReqMasterSet();
        if (cancelled || !payload) return;

        if (payload.hasData) {
          const nextRows = _mapSpecialReqMasterRecords(payload.records);
          if (!cancelled) {
            setRows(nextRows);
            lastSyncedRef.current = JSON.stringify(nextRows);
          }
          return;
        }

        if (!cancelled) {
          setRows(fallbackRows);
        }

        await _replaceSpecialReqMasterRows(fallbackRows);
        if (!cancelled) {
          lastSyncedRef.current = JSON.stringify(fallbackRows);
        }
      } catch (error) {
        console.warn("Special requirement master data API is unavailable; using cached/default rows.", error);
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

    void _replaceSpecialReqMasterRows(rows)
      .then(() => { lastSyncedRef.current = signature; })
      .catch((error) => {
        console.warn("Special requirement master data sync failed; cached state remains active.", error);
      });
  }, [rows]);

  const api = React.useMemo(() => ({
    rows,
    addSpecialReq: (SpecialReqId, SpecialReqDesc, SpecialReqIsActive, SpecialReqOrder) => {
      const id = _normSpecialReqId(SpecialReqId);
      const desc = _normSpecialReqDesc(SpecialReqDesc);
      const order = _normSpecialReqOrder(SpecialReqOrder);
      if (!id) return { ok: false, error: "Special Requirement Id is required." };
      if (!desc) return { ok: false, error: "Description is required." };
      if (rows.some((r) => r.SpecialReqId === id)) return { ok: false, error: "Special Requirement Id already exists." };
      setRows((list) => _sortSpecialReqRows([...list, { SpecialReqId: id, SpecialReqDesc: desc, SpecialReqIsActive: !!SpecialReqIsActive, SpecialReqOrder: order }]));
      return { ok: true, SpecialReqId: id, SpecialReqDesc: desc, SpecialReqIsActive: !!SpecialReqIsActive, SpecialReqOrder: order };
    },
    updateSpecialReq: (SpecialReqId, SpecialReqDesc, SpecialReqIsActive, SpecialReqOrder) => {
      const desc = _normSpecialReqDesc(SpecialReqDesc);
      const order = _normSpecialReqOrder(SpecialReqOrder);
      if (!desc) return { ok: false, error: "Description is required." };
      if (!rows.some((r) => r.SpecialReqId === SpecialReqId)) return { ok: false, error: "Special Requirement record not found." };
      setRows((list) => list.map((r) => (r.SpecialReqId === SpecialReqId
        ? { ...r, SpecialReqDesc: desc, SpecialReqIsActive: !!SpecialReqIsActive, SpecialReqOrder: order }
        : r)));
      return { ok: true, SpecialReqId, SpecialReqDesc: desc, SpecialReqIsActive: !!SpecialReqIsActive, SpecialReqOrder: order };
    },
    removeSpecialReq: (SpecialReqId) => {
      setRows((list) => list.filter((r) => r.SpecialReqId !== SpecialReqId));
      return { ok: true };
    },
    resetSpecialReq: () => setRows(_sortSpecialReqRows(_cloneSpecialReqSeed())),
  }), [rows]);

  return <SpecialReqMasterCtx.Provider value={api}>{children}</SpecialReqMasterCtx.Provider>;
}

function useSpecialReqMaster() { return React.useContext(SpecialReqMasterCtx); }

Object.assign(window, { SPECIAL_REQ_MASTER_KEY, SPECIAL_REQ_ID_MAX, SPECIAL_REQ_DESC_MAX, SpecialReqMasterProvider, useSpecialReqMaster });
export { SPECIAL_REQ_MASTER_KEY, SPECIAL_REQ_ID_MAX, SPECIAL_REQ_DESC_MAX, SpecialReqMasterProvider, useSpecialReqMaster };
