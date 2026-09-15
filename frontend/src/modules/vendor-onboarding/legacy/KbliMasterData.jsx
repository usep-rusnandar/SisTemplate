/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ KBLI.
   Mirrors VendorConnect MSTR_KBLI_T: KbliId varchar(5) PK, KbliDesc varchar(200).
   Seed sourced from VendorConnect SeedMstrKbliT.cs (KBLI_SEED). Persisted through backend state API. */

const KBLI_MASTER_KEY = "ag_kbli_master_v1";
const KBLI_ID_MAX = 5;
const KBLI_DESC_MAX = 200;
const KBLI_MASTER_API = "/api/v1/master-data/sets/kbli";
const KBLI_SET_NAME = "KBLI";
const KBLI_TABLE_NAME = "MSTR_KBLI_T";
const KBLI_OWNER = "Vendor";

const KbliMasterCtx = React.createContext(null);

function _cloneKbliSeed() {
  const seed = [];
  return seed.map((r) => ({ KbliId: r.KbliId, KbliDesc: r.KbliDesc }));
}

function _normKbliId(id) {
  return String(id || "").trim().replace(/\D/g, "").slice(0, KBLI_ID_MAX);
}

function _normKbliDesc(desc) {
  return String(desc || "").trim().slice(0, KBLI_DESC_MAX);
}

function _readKbliMasterCache() {
  try {
    const value = window.__procurementStorage.getItem(KBLI_MASTER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {}
  return null;
}

function _writeKbliMasterCache(rows) {
  try { window.__procurementStorage.setItem(KBLI_MASTER_KEY, JSON.stringify(rows)); } catch (e) {}
}

function _sortKbliRows(rows) {
  return [...rows].sort((a, b) => a.KbliId.localeCompare(b.KbliId, undefined, { numeric: true }));
}

function _mapKbliMasterRecords(records) {
  return _sortKbliRows(
    (Array.isArray(records) ? records : [])
      .map((record) => ({
        KbliId: _normKbliId(record.code),
        KbliDesc: _normKbliDesc(record.name),
      }))
      .filter((record) => !!record.KbliId && !!record.KbliDesc)
  );
}

async function _fetchKbliMasterSet() {
  const response = await fetch(KBLI_MASTER_API, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function _seedKbliMasterRows(rows) {
  const response = await fetch(`${KBLI_MASTER_API}/records`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: KBLI_SET_NAME,
      tableName: KBLI_TABLE_NAME,
      owner: KBLI_OWNER,
      records: rows.map((row) => ({
        code: row.KbliId,
        name: row.KbliDesc,
        status: "Active",
        description: "",
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`KBLI master seed failed with status ${response.status}.`);
  }
}

async function _upsertKbliMasterRow(KbliId, KbliDesc) {
  const response = await fetch(`${KBLI_MASTER_API}/records/${encodeURIComponent(KbliId)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: KBLI_SET_NAME,
      tableName: KBLI_TABLE_NAME,
      owner: KBLI_OWNER,
      name: KbliDesc,
      status: "Active",
      description: "",
    }),
  });

  if (!response.ok) {
    throw new Error(`KBLI master upsert failed with status ${response.status}.`);
  }
}

async function _deleteKbliMasterRow(KbliId) {
  const response = await fetch(`${KBLI_MASTER_API}/records/${encodeURIComponent(KbliId)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`KBLI master delete failed with status ${response.status}.`);
  }
}

function KbliMasterProvider({ children }) {
  const [rows, setRows] = React.useState(() => {
    const cached = _readKbliMasterCache();
    return _sortKbliRows(cached && cached.length ? cached : _cloneKbliSeed());
  });

  React.useEffect(() => {
    _writeKbliMasterCache(rows);
  }, [rows]);

  React.useEffect(() => {
    let cancelled = false;
    const cached = _readKbliMasterCache();
    const fallbackRows = _sortKbliRows(cached && cached.length ? cached : _cloneKbliSeed());

    async function hydrate() {
      try {
        const payload = await _fetchKbliMasterSet();
        if (cancelled || !payload) {
          return;
        }

        if (payload.hasData) {
          const nextRows = _mapKbliMasterRecords(payload.records);
          if (!cancelled) {
            setRows(nextRows);
          }
          return;
        }

        if (!cancelled) {
          setRows(fallbackRows);
        }

        await _seedKbliMasterRows(fallbackRows);
        if (cancelled) {
          return;
        }

        const refreshed = await _fetchKbliMasterSet();
        if (cancelled || !refreshed || !refreshed.hasData) {
          return;
        }

        setRows(_mapKbliMasterRecords(refreshed.records));
      } catch (error) {
        console.warn("KBLI master data API is unavailable; using cached/default rows.", error);
      }
    }

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  const api = React.useMemo(() => ({
    rows,
    addKbli: (KbliId, KbliDesc) => {
      const id = _normKbliId(KbliId);
      const desc = _normKbliDesc(KbliDesc);
      if (!id) return { ok: false, error: "KBLI Id is required." };
      if (!desc) return { ok: false, error: "Description is required." };
      if (rows.some((r) => r.KbliId === id)) return { ok: false, error: "KBLI Id already exists." };
      setRows((list) => _sortKbliRows([...list, { KbliId: id, KbliDesc: desc }]));
      void _upsertKbliMasterRow(id, desc).catch((error) => {
        console.warn("KBLI master data save failed; cached state remains active.", error);
      });
      return { ok: true, KbliId: id, KbliDesc: desc };
    },
    updateKbli: (KbliId, KbliDesc) => {
      const desc = _normKbliDesc(KbliDesc);
      if (!desc) return { ok: false, error: "Description is required." };
      if (!rows.some((r) => r.KbliId === KbliId)) return { ok: false, error: "KBLI record not found." };
      setRows((list) => list.map((r) => (r.KbliId === KbliId ? { ...r, KbliDesc: desc } : r)));
      void _upsertKbliMasterRow(KbliId, desc).catch((error) => {
        console.warn("KBLI master data update failed; cached state remains active.", error);
      });
      return { ok: true, KbliId, KbliDesc: desc };
    },
    removeKbli: (KbliId) => {
      setRows((list) => list.filter((r) => r.KbliId !== KbliId));
      void _deleteKbliMasterRow(KbliId).catch((error) => {
        console.warn("KBLI master data delete failed; cached state remains active.", error);
      });
      return { ok: true };
    },
    resetKbli: () => {
      const seedRows = _sortKbliRows(_cloneKbliSeed());
      setRows(seedRows);
      void _seedKbliMasterRows(seedRows).catch((error) => {
        console.warn("KBLI master data reset seed failed; cached state remains active.", error);
      });
    },
  }), [rows]);

  return <KbliMasterCtx.Provider value={api}>{children}</KbliMasterCtx.Provider>;
}

function useKbliMaster() { return React.useContext(KbliMasterCtx); }

Object.assign(window, { KBLI_MASTER_KEY, KBLI_ID_MAX, KBLI_DESC_MAX, KbliMasterProvider, useKbliMaster });
export { KBLI_MASTER_KEY, KBLI_ID_MAX, KBLI_DESC_MAX, KbliMasterProvider, useKbliMaster };
