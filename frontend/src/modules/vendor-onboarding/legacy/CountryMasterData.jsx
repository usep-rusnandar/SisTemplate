/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ Country.
   Mirrors VendorConnect MSTR_COUNTRY_T: CountryCode varchar(6) PK, CountryName varchar(50).
   Seed sourced from VendorConnect SeedMstrCountryT.cs (COUNTRY_SEED). Persisted through backend state API. */

const COUNTRY_MASTER_KEY = "ag_country_master_v1";
const COUNTRY_CODE_MAX = 6;
const COUNTRY_NAME_MAX = 50;
const COUNTRY_MASTER_API = "/api/v1/master-data/sets/country";
const COUNTRY_SET_NAME = "Country";
const COUNTRY_TABLE_NAME = "MSTR_COUNTRY_T";
const COUNTRY_OWNER = "Vendor";

const CountryMasterCtx = React.createContext(null);

function _cloneCountrySeed() {
  const seed = [];
  return seed.map((r) => ({ CountryCode: r.CountryCode, CountryName: r.CountryName }));
}

function _normCountryCode(code) {
  return String(code || "").trim().replace(/[^+0-9-]/g, "").slice(0, COUNTRY_CODE_MAX);
}

function _normCountryName(name) {
  return String(name || "").trim().slice(0, COUNTRY_NAME_MAX);
}

function _readCountryMasterCache() {
  try {
    const value = window.__procurementStorage.getItem(COUNTRY_MASTER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {}
  return null;
}

function _writeCountryMasterCache(rows) {
  try { window.__procurementStorage.setItem(COUNTRY_MASTER_KEY, JSON.stringify(rows)); } catch (e) {}
}

function _sortCountryRows(rows) {
  return [...rows].sort((a, b) => a.CountryName.localeCompare(b.CountryName));
}

function _mapCountryMasterRecords(records) {
  return _sortCountryRows(
    (Array.isArray(records) ? records : [])
      .map((record) => ({
        CountryCode: _normCountryCode(record.code),
        CountryName: _normCountryName(record.name),
      }))
      .filter((record) => !!record.CountryCode && !!record.CountryName)
  );
}

async function _fetchCountryMasterSet() {
  const response = await fetch(COUNTRY_MASTER_API, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function _seedCountryMasterRows(rows) {
  const response = await fetch(`${COUNTRY_MASTER_API}/records`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: COUNTRY_SET_NAME,
      tableName: COUNTRY_TABLE_NAME,
      owner: COUNTRY_OWNER,
      records: rows.map((row) => ({
        code: row.CountryCode,
        name: row.CountryName,
        status: "Active",
        description: "",
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Country master seed failed with status ${response.status}.`);
  }
}

async function _upsertCountryMasterRow(CountryCode, CountryName) {
  const response = await fetch(`${COUNTRY_MASTER_API}/records/${encodeURIComponent(CountryCode)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: COUNTRY_SET_NAME,
      tableName: COUNTRY_TABLE_NAME,
      owner: COUNTRY_OWNER,
      name: CountryName,
      status: "Active",
      description: "",
    }),
  });

  if (!response.ok) {
    throw new Error(`Country master upsert failed with status ${response.status}.`);
  }
}

async function _deleteCountryMasterRow(CountryCode) {
  const response = await fetch(`${COUNTRY_MASTER_API}/records/${encodeURIComponent(CountryCode)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Country master delete failed with status ${response.status}.`);
  }
}

function CountryMasterProvider({ children }) {
  const [rows, setRows] = React.useState(() => {
    const cached = _readCountryMasterCache();
    return _sortCountryRows(cached && cached.length ? cached : _cloneCountrySeed());
  });

  React.useEffect(() => {
    _writeCountryMasterCache(rows);
  }, [rows]);

  React.useEffect(() => {
    let cancelled = false;
    const cached = _readCountryMasterCache();
    const fallbackRows = _sortCountryRows(cached && cached.length ? cached : _cloneCountrySeed());

    async function hydrate() {
      try {
        const payload = await _fetchCountryMasterSet();
        if (cancelled || !payload) {
          return;
        }

        if (payload.hasData) {
          const nextRows = _mapCountryMasterRecords(payload.records);
          if (!cancelled) {
            setRows(nextRows);
          }
          return;
        }

        if (!cancelled) {
          setRows(fallbackRows);
        }

        await _seedCountryMasterRows(fallbackRows);
        if (cancelled) {
          return;
        }

        const refreshed = await _fetchCountryMasterSet();
        if (cancelled || !refreshed || !refreshed.hasData) {
          return;
        }

        setRows(_mapCountryMasterRecords(refreshed.records));
      } catch (error) {
        console.warn("Country master data API is unavailable; using cached/default rows.", error);
      }
    }

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  const api = React.useMemo(() => ({
    rows,
    addCountry: (CountryCode, CountryName) => {
      const code = _normCountryCode(CountryCode);
      const name = _normCountryName(CountryName);
      if (!code) return { ok: false, error: "Country code is required." };
      if (!name) return { ok: false, error: "Country name is required." };
      if (rows.some((r) => r.CountryCode === code)) return { ok: false, error: "Country code already exists." };
      setRows((list) => _sortCountryRows([...list, { CountryCode: code, CountryName: name }]));
      void _upsertCountryMasterRow(code, name).catch((error) => {
        console.warn("Country master data save failed; cached state remains active.", error);
      });
      return { ok: true, CountryCode: code, CountryName: name };
    },
    updateCountry: (CountryCode, CountryName) => {
      const name = _normCountryName(CountryName);
      if (!name) return { ok: false, error: "Country name is required." };
      if (!rows.some((r) => r.CountryCode === CountryCode)) return { ok: false, error: "Country record not found." };
      setRows((list) => list.map((r) => (r.CountryCode === CountryCode ? { ...r, CountryName: name } : r)));
      void _upsertCountryMasterRow(CountryCode, name).catch((error) => {
        console.warn("Country master data update failed; cached state remains active.", error);
      });
      return { ok: true, CountryCode, CountryName: name };
    },
    removeCountry: (CountryCode) => {
      setRows((list) => list.filter((r) => r.CountryCode !== CountryCode));
      void _deleteCountryMasterRow(CountryCode).catch((error) => {
        console.warn("Country master data delete failed; cached state remains active.", error);
      });
      return { ok: true };
    },
    resetCountry: () => {
      const seedRows = _sortCountryRows(_cloneCountrySeed());
      setRows(seedRows);
      void _seedCountryMasterRows(seedRows).catch((error) => {
        console.warn("Country master data reset seed failed; cached state remains active.", error);
      });
    },
  }), [rows]);

  return <CountryMasterCtx.Provider value={api}>{children}</CountryMasterCtx.Provider>;
}

function useCountryMaster() { return React.useContext(CountryMasterCtx); }

Object.assign(window, { COUNTRY_MASTER_KEY, COUNTRY_CODE_MAX, COUNTRY_NAME_MAX, CountryMasterProvider, useCountryMaster });
export { COUNTRY_MASTER_KEY, COUNTRY_CODE_MAX, COUNTRY_NAME_MAX, CountryMasterProvider, useCountryMaster };
