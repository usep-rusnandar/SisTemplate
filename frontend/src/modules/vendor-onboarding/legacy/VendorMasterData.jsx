/* fm3-converted */
import React from "react";
import { VENDORS } from "./VendorData.jsx";
import { VwApiMasterSet } from "../../vendor-workspace/legacy/VendorOnboardingData.jsx";
/* Alamtri Geo Admin — Master Data ▸ Vendor Onboarding.
   Shared, editable source of truth for two vendor reference lists:
   - RELATIONSHIPS : how a vendor relates to the brands it supplies
                     (Brand Owner, Authorized Distributor, Reseller/Agen, Manufacturer).
                     Mirrors the free-text `relationships` field on every vendor.
   - DOC REQUIREMENTS : the legal / tax / certification documents a vendor must
                        provide to onboard, with mandatory + expiry rules.
   Both are backend master-data sets (vendor-relationship / vendor-document-requirement);
   each record stores the whole object in payloadJson. No frontend seed arrays remain.
   Derived "used by" / "on file" counts are read live from the VENDORS registry. */

/* Tone of a document category's badge */
const VENDOR_DOC_CATEGORIES = [
  { key: "Legal",         en: "Legal",         id: "Legalitas",  tone: "brand"  },
  { key: "Tax",           en: "Tax",           id: "Perpajakan", tone: "blue"   },
  { key: "Certification", en: "Certification", id: "Sertifikasi", tone: "forest" },
  { key: "Financial",     en: "Financial",     id: "Keuangan",   tone: "orange" },
  { key: "Other",         en: "Other",         id: "Lainnya",    tone: "neutral" },
];
function vendorDocCat(key) { return VENDOR_DOC_CATEGORIES.find((c) => c.key === key) || VENDOR_DOC_CATEGORIES[4]; }

const VENDOR_TONES = ["brand", "blue", "orange", "forest", "danger"];
const VENDOR_MASTER_KEY = "ag_vendor_master_v1";

/* Backend master-data sets. Records are keyed by the business `code` (e.g. PRIN, NIB) and keep the
   whole object in payloadJson (id/name/code/… + relationship match keywords / doc rules), matching
   the InitialPlatformDataSeeder seed shape. `distributor-type` is the SAME set the vendor portal
   reads (VwApiMasterSet) and the one VendorBrand.DistributorTypeCode points at. */
const DISTRIBUTOR_TYPE_API = "/api/v1/master-data/sets/distributor-type";
const DISTRIBUTOR_TYPE_SET = { setName: "Distributor Type", tableName: "MSTR_DISTRIBUTOR_TYPE_T", owner: "VendorOnboarding" };
const VENDOR_DOC_API = "/api/v1/master-data/sets/vendor-document-requirement";
const VENDOR_DOC_SET = { setName: "Vendor Document Requirement", tableName: "MSTR_VENDOR_DOC_REQUIREMENT_T", owner: "VendorOnboarding" };

function _vmParseRecords(records) {
  return (Array.isArray(records) ? records : [])
    .map((rec) => { try { return rec && rec.payloadJson ? JSON.parse(rec.payloadJson) : null; } catch (e) { return null; } })
    .filter(Boolean);
}
function _mapRelationships(records) {
  const list = _vmParseRecords(records).map((o, i) => ({
    id: o.id || o.code, code: o.code || o.id, name: o.name, desc: o.desc || "",
    tone: o.tone || "brand", match: Array.isArray(o.match) && o.match.length ? o.match : [o.name],
    order: typeof o.order === "number" ? o.order : i,
  }));
  return list.sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name)));
}
function _mapDocs(records) {
  return _vmParseRecords(records).map((o) => ({
    id: o.id || o.code, code: o.code || o.id, name: o.name, category: o.category || "Other",
    mandatory: !!o.mandatory, hasExpiry: !!o.hasExpiry, validityMonths: Number(o.validityMonths) || 0,
    field: o.field != null ? o.field : null, note: o.note || "",
  }));
}
async function _vmFetchSet(api) {
  const res = await fetch(api, { credentials: "include", headers: { Accept: "application/json" } });
  return res.ok ? res.json() : null;
}
async function _vmUpsertRecord(api, set, obj) {
  const code = obj.code || obj.id;
  const res = await fetch(`${api}/records/${encodeURIComponent(code)}`, {
    method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setName: set.setName, tableName: set.tableName, owner: set.owner,
      name: obj.name, status: "Active", description: obj.desc || obj.note || "",
      payloadJson: JSON.stringify(obj),
    }),
  });
  if (!res.ok) throw new Error(`${set.setName} save failed (${res.status})`);
}
async function _vmDeleteRecord(api, set, code) {
  const res = await fetch(`${api}/records/${encodeURIComponent(code)}`, { method: "DELETE", credentials: "include" });
  if (!res.ok && res.status !== 204) throw new Error(`${set.setName} delete failed (${res.status})`);
}

const VendorMasterCtx = React.createContext(null);

function VendorMasterProvider({ children }) {
  const [state, setState] = React.useState(() => {
    try { const v = window.__procurementStorage.getItem(VENDOR_MASTER_KEY); if (v) return JSON.parse(v); } catch (e) {}
    return { relationships: [], docs: [] };
  });
  React.useEffect(() => { try { window.__procurementStorage.setItem(VENDOR_MASTER_KEY, JSON.stringify(state)); } catch (e) {} }, [state]);

  // Hydrate both lists from the backend master sets. Backend is authoritative when it has data;
  // local edits are persisted back to the same sets so they survive the next hydration.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rel, doc] = await Promise.all([_vmFetchSet(DISTRIBUTOR_TYPE_API), _vmFetchSet(VENDOR_DOC_API)]);
        if (cancelled) return;
        setState((s) => ({
          relationships: rel && rel.hasData ? _mapRelationships(rel.records) : s.relationships,
          docs: doc && doc.hasData ? _mapDocs(doc.records) : s.docs,
        }));
      } catch (e) { console.warn("Vendor master data API unavailable; using cached lists.", e); }
    })();
    return () => { cancelled = true; };
  }, []);

  const api = React.useMemo(() => {
    const vendors = (typeof window !== "undefined" && window.VENDORS) || [];
    // count vendors whose free-text relationships match this type's keywords
    const relationshipUseCount = (rel) => {
      const keys = (rel.match && rel.match.length ? rel.match : [rel.name]).map((s) => String(s).toLowerCase());
      return vendors.filter((v) => (v.relationships || []).some((r) => {
        const x = String(r).toLowerCase();
        return keys.some((k) => x.includes(k));
      })).length;
    };
    // how many vendors already have this document on file (null = not auto-tracked)
    const docOnFileCount = (doc) => {
      if (doc.field === "npwp") return vendors.filter((v) => v.npwp && String(v.npwp).trim()).length;
      if (doc.field === "nib")  return vendors.filter((v) => v.nib && String(v.nib).trim()).length;
      if (doc.field === "pkp")  return vendors.filter((v) => v.pkp && String(v.pkp).trim()).length;
      if (doc.field === "cert") return vendors.filter((v) => (v.certNames || []).length > 0).length;
      return null;
    };
    const vendorsWithRelationship = vendors.filter((v) => (v.relationships || []).length > 0).length;

    return {
      relationships: state.relationships,
      docs: state.docs,
      vendorCount: vendors.length,
      vendorsWithRelationship,
      relationshipUseCount,
      docOnFileCount,

      // ----- relationships (persisted to the backend distributor-type master set) -----
      addRelationship: (rel) => {
        const code = String(rel.code || rel.name || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
        if (!code) return;
        const item = { id: code, code, name: rel.name, desc: rel.desc || "", tone: rel.tone || "brand", match: (rel.match && rel.match.length) ? rel.match : [rel.name], order: state.relationships.length };
        setState((s) => (s.relationships.some((x) => x.code === code) ? s : { ...s, relationships: [...s.relationships, item] }));
        void _vmUpsertRecord(DISTRIBUTOR_TYPE_API, DISTRIBUTOR_TYPE_SET, item).catch((e) => console.warn("Relationship save failed; local state remains.", e));
      },
      updateRelationship: (id, patch) => {
        const cur = state.relationships.find((x) => x.id === id) || { id, code: id };
        const merged = { ...cur, ...patch, id: cur.id, code: cur.code };
        setState((s) => ({ ...s, relationships: s.relationships.map((x) => (x.id === id ? merged : x)) }));
        void _vmUpsertRecord(DISTRIBUTOR_TYPE_API, DISTRIBUTOR_TYPE_SET, merged).catch((e) => console.warn("Relationship update failed; local state remains.", e));
      },
      removeRelationship: (id) => {
        const cur = state.relationships.find((x) => x.id === id);
        setState((s) => ({ ...s, relationships: s.relationships.filter((x) => x.id !== id) }));
        void _vmDeleteRecord(DISTRIBUTOR_TYPE_API, DISTRIBUTOR_TYPE_SET, (cur && cur.code) || id).catch((e) => console.warn("Relationship delete failed; local state remains.", e));
      },
      moveRelationship: (id, dir) => setState((s) => {
        const idx = s.relationships.findIndex((x) => x.id === id);
        const ni = idx + dir;
        if (idx === -1 || ni < 0 || ni >= s.relationships.length) return s;
        const arr = [...s.relationships];
        const [it] = arr.splice(idx, 1);
        arr.splice(ni, 0, it);
        const ordered = arr.map((x, i) => ({ ...x, order: i }));
        // Persist the new order to the backend for the affected rows.
        for (let i = Math.min(idx, ni); i <= Math.max(idx, ni); i++) {
          void _vmUpsertRecord(DISTRIBUTOR_TYPE_API, DISTRIBUTOR_TYPE_SET, ordered[i]).catch((e) => console.warn("Relationship reorder save failed.", e));
        }
        return { ...s, relationships: ordered };
      }),

      // ----- document requirements (persisted to the backend vendor-document-requirement set) -----
      addDoc: (doc) => {
        const id = "VD-" + Date.now().toString(36);
        const code = String(doc.code || id).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) || id;
        const item = { ...doc, id, code };
        setState((s) => ({ ...s, docs: [...s.docs, item] }));
        void _vmUpsertRecord(VENDOR_DOC_API, VENDOR_DOC_SET, item).catch((e) => console.warn("Document requirement save failed; local state remains.", e));
      },
      updateDoc: (id, patch) => {
        const cur = state.docs.find((d) => d.id === id) || { id, code: id };
        const merged = { ...cur, ...patch, id: cur.id, code: cur.code || cur.id };
        setState((s) => ({ ...s, docs: s.docs.map((d) => (d.id === id ? merged : d)) }));
        void _vmUpsertRecord(VENDOR_DOC_API, VENDOR_DOC_SET, merged).catch((e) => console.warn("Document requirement update failed; local state remains.", e));
      },
      removeDoc: (id) => {
        const cur = state.docs.find((d) => d.id === id);
        setState((s) => ({ ...s, docs: s.docs.filter((d) => d.id !== id) }));
        void _vmDeleteRecord(VENDOR_DOC_API, VENDOR_DOC_SET, (cur && cur.code) || id).catch((e) => console.warn("Document requirement delete failed; local state remains.", e));
      },

      resetVendorMaster: () => {
        Promise.all([_vmFetchSet(DISTRIBUTOR_TYPE_API), _vmFetchSet(VENDOR_DOC_API)]).then(([rel, doc]) => setState({
          relationships: rel && rel.hasData ? _mapRelationships(rel.records) : [],
          docs: doc && doc.hasData ? _mapDocs(doc.records) : [],
        })).catch((e) => console.warn("Vendor master reset failed.", e));
      },
    };
  }, [state]);

  return <VendorMasterCtx.Provider value={api}>{children}</VendorMasterCtx.Provider>;
}
function useVendorMaster() { return React.useContext(VendorMasterCtx); }

Object.assign(window, {
  VENDOR_DOC_CATEGORIES, VENDOR_TONES,
  vendorDocCat, VendorMasterProvider, useVendorMaster,
});
export { VENDOR_DOC_CATEGORIES, VENDOR_TONES, vendorDocCat, VendorMasterProvider, useVendorMaster };
