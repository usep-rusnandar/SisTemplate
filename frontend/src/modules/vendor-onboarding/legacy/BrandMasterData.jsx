/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ Brand.
   Mirrors VendorConnect MSTR_BRAND_T: BrandName varchar(50) PK.
   Seed sourced from VendorConnect SeedMstrBrandT.cs (BRAND_SEED). Persisted through backend state API. */

const BRAND_MASTER_KEY = "ag_brand_master_v1";
const BRAND_NAME_MAX = 50;
const BRAND_MASTER_API = "/api/v1/master-data/sets/brand";
const BRAND_SET_NAME = "Brand";
const BRAND_TABLE_NAME = "MSTR_BRAND_T";
const BRAND_OWNER = "Vendor";

const BrandMasterCtx = React.createContext(null);

function _cloneBrandSeed() {
  const seed = [];
  return seed.map((BrandName) => ({ BrandName }));
}

function _normBrandName(name) {
  return String(name || "").trim().slice(0, BRAND_NAME_MAX);
}

function _readBrandMasterCache() {
  try {
    const value = window.__procurementStorage.getItem(BRAND_MASTER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {}
  return null;
}

function _writeBrandMasterCache(rows) {
  try { window.__procurementStorage.setItem(BRAND_MASTER_KEY, JSON.stringify(rows)); } catch (e) {}
}

function _sortBrandRows(rows) {
  return [...rows].sort((a, b) => a.BrandName.localeCompare(b.BrandName));
}

function _mapBrandMasterRecords(records) {
  return _sortBrandRows(
    (Array.isArray(records) ? records : [])
      .map((record) => ({ BrandName: _normBrandName(record.name || record.code) }))
      .filter((record) => !!record.BrandName)
  );
}

async function _fetchBrandMasterSet() {
  const response = await fetch(BRAND_MASTER_API, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function _seedBrandMasterRows(rows) {
  const response = await fetch(`${BRAND_MASTER_API}/records`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: BRAND_SET_NAME,
      tableName: BRAND_TABLE_NAME,
      owner: BRAND_OWNER,
      records: rows.map((row) => ({
        code: row.BrandName,
        name: row.BrandName,
        status: "Active",
        description: "",
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Brand master seed failed with status ${response.status}.`);
  }
}

async function _upsertBrandMasterRow(BrandName) {
  const response = await fetch(`${BRAND_MASTER_API}/records/${encodeURIComponent(BrandName)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: BRAND_SET_NAME,
      tableName: BRAND_TABLE_NAME,
      owner: BRAND_OWNER,
      name: BrandName,
      status: "Active",
      description: "",
    }),
  });

  if (!response.ok) {
    throw new Error(`Brand master upsert failed with status ${response.status}.`);
  }
}

async function _deleteBrandMasterRow(BrandName) {
  const response = await fetch(`${BRAND_MASTER_API}/records/${encodeURIComponent(BrandName)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Brand master delete failed with status ${response.status}.`);
  }
}

async function _importBrandMasterFile(file, commit) {
  const body = new FormData();
  body.append("file", file);
  body.append("commit", commit ? "true" : "false");
  const response = await fetch(`${BRAND_MASTER_API}/import`, {
    method: "POST",
    credentials: "include",
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((payload && (payload.message || payload.code)) || `Brand import failed with status ${response.status}.`);
  }
  return payload;
}

async function _downloadBrandImportTemplate() {
  const response = await fetch(`${BRAND_MASTER_API}/import/template`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Brand import template download failed with status ${response.status}.`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "Brand-Import-Template.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BrandMasterProvider({ children }) {
  const [brands, setBrands] = React.useState(() => {
    const cached = _readBrandMasterCache();
    return _sortBrandRows(cached && cached.length ? cached : _cloneBrandSeed());
  });

  React.useEffect(() => {
    _writeBrandMasterCache(brands);
  }, [brands]);

  React.useEffect(() => {
    let cancelled = false;
    const cached = _readBrandMasterCache();
    const fallbackRows = _sortBrandRows(cached && cached.length ? cached : _cloneBrandSeed());

    async function hydrate() {
      try {
        const payload = await _fetchBrandMasterSet();
        if (cancelled || !payload) {
          return;
        }

        if (payload.hasData) {
          const nextRows = _mapBrandMasterRecords(payload.records);
          if (!cancelled) {
            setBrands(nextRows);
          }
          return;
        }

        if (!cancelled) {
          setBrands(fallbackRows);
        }

        await _seedBrandMasterRows(fallbackRows);
        if (cancelled) {
          return;
        }

        const refreshed = await _fetchBrandMasterSet();
        if (cancelled || !refreshed || !refreshed.hasData) {
          return;
        }

        setBrands(_mapBrandMasterRecords(refreshed.records));
      } catch (error) {
        console.warn("Brand master data API is unavailable; using cached/default rows.", error);
      }
    }

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  const api = React.useMemo(() => ({
    brands,
    addBrand: (name) => {
      const BrandName = _normBrandName(name);
      if (!BrandName) return { ok: false, error: "Brand name is required." };
      if (brands.some((b) => b.BrandName.toLowerCase() === BrandName.toLowerCase())) {
        return { ok: false, error: "Brand already exists." };
      }
      setBrands((rows) => _sortBrandRows([...rows, { BrandName }]));
      void _upsertBrandMasterRow(BrandName).catch((error) => {
        console.warn("Brand master data save failed; cached state remains active.", error);
      });
      return { ok: true, BrandName };
    },
    removeBrand: (BrandName) => {
      setBrands((rows) => rows.filter((b) => b.BrandName !== BrandName));
      void _deleteBrandMasterRow(BrandName).catch((error) => {
        console.warn("Brand master data delete failed; cached state remains active.", error);
      });
      return { ok: true };
    },
    resetBrands: () => {
      const seedRows = _sortBrandRows(_cloneBrandSeed());
      setBrands(seedRows);
      void _seedBrandMasterRows(seedRows).catch((error) => {
        console.warn("Brand master data reset seed failed; cached state remains active.", error);
      });
    },
    previewBrandImport: (file) => _importBrandMasterFile(file, false),
    commitBrandImport: async (file) => {
      const result = await _importBrandMasterFile(file, true);
      try {
        const payload = await _fetchBrandMasterSet();
        if (payload && payload.hasData) {
          setBrands(_mapBrandMasterRecords(payload.records));
        }
      } catch (error) {
        console.warn("Brand master data reload after import failed; cached state remains active.", error);
      }
      return result;
    },
    downloadImportTemplate: () => _downloadBrandImportTemplate(),
  }), [brands]);

  return <BrandMasterCtx.Provider value={api}>{children}</BrandMasterCtx.Provider>;
}

function useBrandMaster() { return React.useContext(BrandMasterCtx); }

Object.assign(window, { BRAND_MASTER_KEY, BRAND_NAME_MAX, BrandMasterProvider, useBrandMaster });
export { BRAND_MASTER_KEY, BRAND_NAME_MAX, BrandMasterProvider, useBrandMaster };
