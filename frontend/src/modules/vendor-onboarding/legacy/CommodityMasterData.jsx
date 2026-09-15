/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ Commodity (Category / Classification / Sub-classification). */

const COMMODITY_MASTER_KEY = "ag_commodity_master_v2";
const CATEGORY_ID_MAX = 2;
const CATEGORY_DESC_MAX = 30;
const CLASSIFICATION_ID_MAX = 4;
const CLASSIFICATION_DESC_MAX = 100;
const SUBCLASSIFICATION_ID_MAX = 10;
const SUBCLASSIFICATION_DESC_MAX = 150;
const COMMODITY_CATEGORY_API = "/api/v1/master-data/sets/commodity-category";
const COMMODITY_CLASSIFICATION_API = "/api/v1/master-data/sets/commodity-classification";
const COMMODITY_SUBCLASSIFICATION_API = "/api/v1/master-data/sets/commodity-subclassification";
const COMMODITY_SUBCLASSIFICATION_KBLI_API = "/api/v1/master-data/sets/commodity-subclassification-kbli";
const COMMODITY_SUBCLASSIFICATION_SPECIAL_REQ_API = "/api/v1/master-data/sets/commodity-subclassification-special-requirement";

const CommodityMasterCtx = React.createContext(null);

function _cloneCommoditySeed() {
  const cat = [];
  const cls = [];
  const sub = [];
  const kbli = [];
  const spec = [];
  return {
    categories: cat.map((r) => ({ CategoryId: r.CategoryId, CategoryDesc: r.CategoryDesc })),
    classifications: cls.map((r) => ({ ClassificationId: r.ClassificationId, ClassificationDesc: r.ClassificationDesc, CategoryId: r.CategoryId })),
    subClassifications: sub.map((r) => ({ SubClassificationId: r.SubClassificationId, SubClassificationDesc: r.SubClassificationDesc, ClassificationId: r.ClassificationId })),
    // KBLI requirement per sub-classification as a boolean rule in DNF (sum-of-products): a list of
    // AND-groups that are OR'd together. `[["A","B"],["C"]]` means (A AND B) OR C. A flat OR list is
    // just singleton groups `[["A"],["B"]]`. Empty groups → no KBLI requirement for that sub.
    subClassificationKbliRule: kbli.map((r) => ({ SubClassificationId: r.SubClassificationId, groups: r.groups || [] })),
    subClassificationSpecialReq: spec.map((r) => ({ SubClassificationId: r.SubClassificationId, SpecialReqId: r.SpecialReqId })),
  };
}

function _loadCommodityData() {
  try {
    const v = window.__procurementStorage.getItem(COMMODITY_MASTER_KEY);
    if (v) return JSON.parse(v);
    const legacy = window.__procurementStorage.getItem("ag_commodity_master_v1");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const seed = _cloneCommoditySeed();
      return {
        ...parsed,
        subClassificationKbliRule: (parsed.subClassificationKbliRule && parsed.subClassificationKbliRule.length) ? parsed.subClassificationKbliRule : seed.subClassificationKbliRule,
        subClassificationSpecialReq: (parsed.subClassificationSpecialReq && parsed.subClassificationSpecialReq.length) ? parsed.subClassificationSpecialReq : seed.subClassificationSpecialReq,
      };
    }
  } catch (e) {}
  return _cloneCommoditySeed();
}

function _writeCommodityData(data) {
  try { window.__procurementStorage.setItem(COMMODITY_MASTER_KEY, JSON.stringify(data)); } catch (e) {}
}

function _normCategoryId(id) { return String(id || "").trim().slice(0, CATEGORY_ID_MAX); }
function _normCategoryDesc(desc) { return String(desc || "").trim().slice(0, CATEGORY_DESC_MAX); }
function _normClassificationId(id) { return String(id || "").trim().slice(0, CLASSIFICATION_ID_MAX); }
function _normClassificationDesc(desc) { return String(desc || "").trim().slice(0, CLASSIFICATION_DESC_MAX); }
function _normSubClassificationId(id) { return String(id || "").trim().slice(0, SUBCLASSIFICATION_ID_MAX); }
function _normSubClassificationDesc(desc) { return String(desc || "").trim().slice(0, SUBCLASSIFICATION_DESC_MAX); }
function _normKbliId(id) { return String(id || "").trim().replace(/\D/g, "").slice(0, 5); }
function _normSpecialReqId(id) { return String(id || "").trim().slice(0, 10); }

function _uniqSorted(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/* Normalize a DNF rule: array of AND-groups (each an array of KBLI ids). Cleans each group (normalize +
   uniq-sort + drop blanks), drops empty groups, and de-dupes identical groups while preserving order. */
function _normKbliGroups(groups) {
  if (!Array.isArray(groups)) return [];
  const out = [];
  const seen = new Set();
  groups.forEach((group) => {
    const arr = Array.isArray(group) ? group : [group];
    const norm = _uniqSorted(arr.map(_normKbliId).filter(Boolean));
    if (!norm.length) return;
    const sig = norm.join("+");
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(norm);
  });
  return out;
}

/* Flatten a DNF rule to the unique set of KBLI ids it references (for display/search only). */
function _flattenKbliGroups(groups) {
  return _uniqSorted((groups || []).flat());
}

/* Human-readable rule preview, e.g. "(27201 AND 27202) OR 29300". Single group with one id → "27201". */
function _kbliRulePreview(groups, andWord, orWord) {
  const norm = _normKbliGroups(groups);
  if (!norm.length) return "";
  const parts = norm.map((g) => (g.length > 1 ? `(${g.join(` ${andWord} `)})` : g[0]));
  return parts.join(` ${orWord} `);
}

/* Build the per-sub DNF rules from the raw master-data records. Tolerant of BOTH shapes so old data is
   grandfathered without a DB migration:
   - NEW: one record per sub whose payloadJson carries `groups` (the DNF rule) → used as-is.
   - OLD: one record per (sub, kbli) pair (payload {SubClassificationId, KbliId}, code "sub|kbli") →
     accumulated into singleton OR-groups (preserving the legacy "at least one of" semantics). */
function _mapSubKbliRulesFromRecords(records) {
  const bySub = {};
  const ruleDefined = new Set();
  (records || []).forEach((record) => {
    const payload = _parseCommodityPayloadJson(record.payloadJson);
    const codeHead = String(record.code || "").split("|")[0];
    const subId = _normSubClassificationId(_pget(payload, "SubClassificationId") || codeHead);
    if (!subId) return;
    const rawGroups = _pget(payload, "Groups");
    if (Array.isArray(rawGroups)) {
      bySub[subId] = _normKbliGroups(rawGroups);
      ruleDefined.add(subId);
      return;
    }
    if (ruleDefined.has(subId)) return; // a real rule record wins over stray legacy pairs
    const kbli = _normKbliId(_pget(payload, "KbliId") || record.name);
    if (!kbli) return;
    if (!bySub[subId]) bySub[subId] = [];
    if (!bySub[subId].some((g) => g.length === 1 && g[0] === kbli)) bySub[subId].push([kbli]);
  });
  return Object.keys(bySub).map((SubClassificationId) => ({ SubClassificationId, groups: _normKbliGroups(bySub[SubClassificationId]) }));
}

function _sortCommodityData(data) {
  return {
    categories: [...data.categories].sort((a, b) => a.CategoryId.localeCompare(b.CategoryId)),
    classifications: [...data.classifications].sort((a, b) => a.ClassificationId.localeCompare(b.ClassificationId, undefined, { numeric: true })),
    subClassifications: [...data.subClassifications].sort((a, b) => a.SubClassificationId.localeCompare(b.SubClassificationId, undefined, { numeric: true })),
    subClassificationKbliRule: [...(data.subClassificationKbliRule || [])]
      .map((r) => ({ SubClassificationId: r.SubClassificationId, groups: _normKbliGroups(r.groups) }))
      .sort((a, b) => a.SubClassificationId.localeCompare(b.SubClassificationId, undefined, { numeric: true })),
    subClassificationSpecialReq: [...data.subClassificationSpecialReq].sort((a, b) => `${a.SubClassificationId}|${a.SpecialReqId}`.localeCompare(`${b.SubClassificationId}|${b.SpecialReqId}`, undefined, { numeric: true })),
  };
}

function _parseCommodityPayloadJson(payloadJson) {
  if (!payloadJson) return null;
  try { return JSON.parse(payloadJson); } catch (e) {}
  return null;
}

// Parent keys in payloadJson may be PascalCase (frontend-written) or camelCase (backend seed uses a
// camelCase serializer). Read both so seeded records aren't silently filtered out.
function _pget(payload, pascalKey) {
  if (!payload) return undefined;
  const camel = pascalKey.charAt(0).toLowerCase() + pascalKey.slice(1);
  return payload[pascalKey] !== undefined ? payload[pascalKey] : payload[camel];
}

function _mapCommodityDataFromApi(categoryPayload, classificationPayload, subClassificationPayload, subClassificationKbliPayload, subClassificationSpecialReqPayload) {
  return _sortCommodityData({
    categories: (categoryPayload.records || [])
      .map((record) => ({ CategoryId: _normCategoryId(record.code), CategoryDesc: _normCategoryDesc(record.name) }))
      .filter((record) => !!record.CategoryId && !!record.CategoryDesc),
    classifications: (classificationPayload.records || [])
      .map((record) => {
        const payload = _parseCommodityPayloadJson(record.payloadJson);
        return {
          ClassificationId: _normClassificationId(record.code),
          ClassificationDesc: _normClassificationDesc(record.name),
          CategoryId: _normCategoryId(_pget(payload, "CategoryId")),
        };
      })
      .filter((record) => !!record.ClassificationId && !!record.ClassificationDesc && !!record.CategoryId),
    subClassifications: (subClassificationPayload.records || [])
      .map((record) => {
        const payload = _parseCommodityPayloadJson(record.payloadJson);
        return {
          SubClassificationId: _normSubClassificationId(record.code),
          SubClassificationDesc: _normSubClassificationDesc(record.name),
          ClassificationId: _normClassificationId(_pget(payload, "ClassificationId")),
        };
      })
      .filter((record) => !!record.SubClassificationId && !!record.SubClassificationDesc && !!record.ClassificationId),
    subClassificationKbliRule: _mapSubKbliRulesFromRecords(subClassificationKbliPayload.records || []),
    subClassificationSpecialReq: (subClassificationSpecialReqPayload.records || [])
      .map((record) => {
        const payload = _parseCommodityPayloadJson(record.payloadJson);
        return {
          SubClassificationId: _normSubClassificationId(_pget(payload, "SubClassificationId")),
          SpecialReqId: _normSpecialReqId(_pget(payload, "SpecialReqId") || record.name),
        };
      })
      .filter((record) => !!record.SubClassificationId && !!record.SpecialReqId),
  });
}

async function _fetchCommoditySet(endpoint) {
  const response = await fetch(endpoint, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return response.json();
}

async function _replaceCommoditySet(endpoint, setName, tableName, records) {
  const response = await fetch(`${endpoint}/records:replace`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setName, tableName, owner: "Vendor", records }),
  });

  if (!response.ok) {
    throw new Error(`Commodity master sync failed for ${setName} with status ${response.status}.`);
  }
}

async function _replaceCommodityData(data) {
  await Promise.all([
    _replaceCommoditySet(COMMODITY_CATEGORY_API, "Commodity Category", "MSTR_COMMODITY_CATEGORY_T", data.categories.map((row) => ({
      code: row.CategoryId,
      name: row.CategoryDesc,
      status: "Active",
      description: "",
      payloadJson: null,
    }))),
    _replaceCommoditySet(COMMODITY_CLASSIFICATION_API, "Commodity Classification", "MSTR_COMMODITY_CLASSIFICATION_T", data.classifications.map((row) => ({
      code: row.ClassificationId,
      name: row.ClassificationDesc,
      status: "Active",
      description: "",
      payloadJson: JSON.stringify({ CategoryId: row.CategoryId }),
    }))),
    _replaceCommoditySet(COMMODITY_SUBCLASSIFICATION_API, "Commodity Sub-classification", "MSTR_COMMODITY_SUBCLASSIFICATION_T", data.subClassifications.map((row) => ({
      code: row.SubClassificationId,
      name: row.SubClassificationDesc,
      status: "Active",
      description: "",
      payloadJson: JSON.stringify({ ClassificationId: row.ClassificationId }),
    }))),
    // One record per sub-classification holding the DNF rule (groups). Replaces the legacy one-row-per-pair
    // shape; the reader (_mapSubKbliRulesFromRecords) still understands old rows for already-seeded DBs.
    _replaceCommoditySet(COMMODITY_SUBCLASSIFICATION_KBLI_API, "Commodity Sub-classification KBLI", "MSTR_COMMODITY_SUBCLASSIFICATION_KBLI_T", (data.subClassificationKbliRule || [])
      .map((row) => ({ SubClassificationId: row.SubClassificationId, groups: _normKbliGroups(row.groups) }))
      .filter((row) => !!row.SubClassificationId && row.groups.length)
      .map((row) => ({
        code: row.SubClassificationId,
        name: row.SubClassificationId,
        status: "Active",
        description: "",
        payloadJson: JSON.stringify({ SubClassificationId: row.SubClassificationId, mode: "dnf", groups: row.groups }),
      }))),
    _replaceCommoditySet(COMMODITY_SUBCLASSIFICATION_SPECIAL_REQ_API, "Commodity Sub-classification Special Requirement", "MSTR_COMMODITY_SUBCLASSIFICATION_SPECIAL_REQ_T", data.subClassificationSpecialReq.map((row) => ({
      code: `${row.SubClassificationId}|${row.SpecialReqId}`,
      name: row.SpecialReqId,
      status: "Active",
      description: "",
      payloadJson: JSON.stringify({ SubClassificationId: row.SubClassificationId, SpecialReqId: row.SpecialReqId }),
    }))),
  ]);
}

function _buildSubMaps(data) {
  const kbliGroupsBySubId = {};
  const kbliBySubId = {};
  const specialReqBySubId = {};
  (data.subClassificationKbliRule || []).forEach((r) => {
    const groups = _normKbliGroups(r.groups);
    kbliGroupsBySubId[r.SubClassificationId] = groups;
    kbliBySubId[r.SubClassificationId] = _flattenKbliGroups(groups);
  });
  data.subClassificationSpecialReq.forEach((r) => {
    if (!specialReqBySubId[r.SubClassificationId]) specialReqBySubId[r.SubClassificationId] = new Set();
    specialReqBySubId[r.SubClassificationId].add(r.SpecialReqId);
  });
  return { kbliGroupsBySubId, kbliBySubId, specialReqBySubId };
}

function CommodityMasterProvider({ children }) {
  const [data, setData] = React.useState(() => _sortCommodityData(_cloneCommoditySeed()));
  const [loading, setLoading] = React.useState(true);
  const skipNextPutRef = React.useRef(true);

  React.useEffect(() => {
    if (loading) return;
    _writeCommodityData(data);
  }, [data, loading]);

  React.useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [categoryPayload, classificationPayload, subClassificationPayload, subClassificationKbliPayload, subClassificationSpecialReqPayload] = await Promise.all([
          _fetchCommoditySet(COMMODITY_CATEGORY_API),
          _fetchCommoditySet(COMMODITY_CLASSIFICATION_API),
          _fetchCommoditySet(COMMODITY_SUBCLASSIFICATION_API),
          _fetchCommoditySet(COMMODITY_SUBCLASSIFICATION_KBLI_API),
          _fetchCommoditySet(COMMODITY_SUBCLASSIFICATION_SPECIAL_REQ_API),
        ]);

        if (cancelled) return;

        if (!categoryPayload || !classificationPayload || !subClassificationPayload || !subClassificationKbliPayload || !subClassificationSpecialReqPayload) {
          skipNextPutRef.current = true;
          setData(_sortCommodityData(_loadCommodityData()));
          return;
        }

        const hasData = categoryPayload.hasData
          || classificationPayload.hasData
          || subClassificationPayload.hasData
          || subClassificationKbliPayload.hasData
          || subClassificationSpecialReqPayload.hasData;

        if (hasData) {
          skipNextPutRef.current = true;
          setData(_mapCommodityDataFromApi(
            categoryPayload,
            classificationPayload,
            subClassificationPayload,
            subClassificationKbliPayload,
            subClassificationSpecialReqPayload
          ));
          return;
        }

        const fallbackData = _sortCommodityData(_loadCommodityData());
        skipNextPutRef.current = true;
        setData(fallbackData);
        await _replaceCommodityData(fallbackData);
      } catch (error) {
        console.warn("Commodity master data API is unavailable; using cached/default rows.", error);
        if (!cancelled) {
          skipNextPutRef.current = true;
          setData(_sortCommodityData(_loadCommodityData()));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (loading) return;
    if (skipNextPutRef.current) {
      skipNextPutRef.current = false;
      return;
    }

    void _replaceCommodityData(data)
      .catch((error) => {
        console.warn("Commodity master data sync failed; cached state remains active.", error);
      });
  }, [data, loading]);

  const api = React.useMemo(() => {
    const categoryMap = Object.fromEntries(data.categories.map((r) => [r.CategoryId, r.CategoryDesc]));
    const classificationMap = Object.fromEntries(data.classifications.map((r) => [r.ClassificationId, r.ClassificationDesc]));
    const classificationById = Object.fromEntries(data.classifications.map((r) => [r.ClassificationId, r]));
    const { kbliGroupsBySubId, kbliBySubId, specialReqBySubId } = _buildSubMaps(data);

    const _applySubJunctions = (d, subId, kbliGroups, specialReqIds) => {
      const kid = _normSubClassificationId(subId);
      const groups = _normKbliGroups(kbliGroups);
      const spec = _uniqSorted((specialReqIds || []).map(_normSpecialReqId).filter(Boolean));
      return {
        ...d,
        subClassificationKbliRule: [...(d.subClassificationKbliRule || []).filter((r) => r.SubClassificationId !== kid), ...(groups.length ? [{ SubClassificationId: kid, groups }] : [])],
        subClassificationSpecialReq: [...d.subClassificationSpecialReq.filter((r) => r.SubClassificationId !== kid), ...spec.map((SpecialReqId) => ({ SubClassificationId: kid, SpecialReqId }))],
      };
    };

    return {
      loading,
      categories: data.categories,
      classifications: data.classifications,
      subClassifications: data.subClassifications,
      subClassificationKbliRule: data.subClassificationKbliRule,
      subClassificationSpecialReq: data.subClassificationSpecialReq,
      categoryMap,
      classificationMap,
      classificationById,
      kbliGroupsBySubId,
      kbliBySubId,
      specialReqBySubId,
      getSubKbliIds: (subId) => kbliBySubId[subId] || [],
      getSubKbliRule: (subId) => kbliGroupsBySubId[subId] || [],
      getSubSpecialReqIds: (subId) => _uniqSorted([...(specialReqBySubId[subId] || [])]),
      hasSubSpecialReq: (subId, specialReqId) => !!(specialReqBySubId[subId] && specialReqBySubId[subId].has(specialReqId)),
      addCategory: (CategoryId, CategoryDesc) => {
        const id = _normCategoryId(CategoryId);
        const desc = _normCategoryDesc(CategoryDesc);
        if (!id) return { ok: false, error: "Category Id is required." };
        if (!desc) return { ok: false, error: "Description is required." };
        if (data.categories.some((r) => r.CategoryId === id)) return { ok: false, error: "Category Id already exists." };
        setData((d) => _sortCommodityData({ ...d, categories: [...d.categories, { CategoryId: id, CategoryDesc: desc }] }));
        return { ok: true, CategoryId: id, CategoryDesc: desc };
      },
      updateCategory: (CategoryId, CategoryDesc) => {
        const desc = _normCategoryDesc(CategoryDesc);
        if (!desc) return { ok: false, error: "Description is required." };
        if (!data.categories.some((r) => r.CategoryId === CategoryId)) return { ok: false, error: "Category not found." };
        setData((d) => _sortCommodityData({ ...d, categories: d.categories.map((r) => (r.CategoryId === CategoryId ? { ...r, CategoryDesc: desc } : r)) }));
        return { ok: true, CategoryId, CategoryDesc: desc };
      },
      removeCategory: (CategoryId) => {
        if (data.classifications.some((r) => r.CategoryId === CategoryId)) return { ok: false, error: "Cannot delete — classifications still reference this category." };
        setData((d) => _sortCommodityData({ ...d, categories: d.categories.filter((r) => r.CategoryId !== CategoryId) }));
        return { ok: true };
      },
      addClassification: (ClassificationId, ClassificationDesc, CategoryId) => {
        const id = _normClassificationId(ClassificationId);
        const desc = _normClassificationDesc(ClassificationDesc);
        const cid = _normCategoryId(CategoryId);
        if (!id) return { ok: false, error: "Classification Id is required." };
        if (!desc) return { ok: false, error: "Description is required." };
        if (!cid) return { ok: false, error: "Category is required." };
        if (!data.categories.some((r) => r.CategoryId === cid)) return { ok: false, error: "Category not found." };
        if (data.classifications.some((r) => r.ClassificationId === id)) return { ok: false, error: "Classification Id already exists." };
        setData((d) => _sortCommodityData({ ...d, classifications: [...d.classifications, { ClassificationId: id, ClassificationDesc: desc, CategoryId: cid }] }));
        return { ok: true, ClassificationId: id, ClassificationDesc: desc, CategoryId: cid };
      },
      updateClassification: (ClassificationId, ClassificationDesc, CategoryId) => {
        const desc = _normClassificationDesc(ClassificationDesc);
        const cid = _normCategoryId(CategoryId);
        if (!desc) return { ok: false, error: "Description is required." };
        if (!cid) return { ok: false, error: "Category is required." };
        if (!data.classifications.some((r) => r.ClassificationId === ClassificationId)) return { ok: false, error: "Classification not found." };
        setData((d) => _sortCommodityData({ ...d, classifications: d.classifications.map((r) => (r.ClassificationId === ClassificationId ? { ...r, ClassificationDesc: desc, CategoryId: cid } : r)) }));
        return { ok: true, ClassificationId, ClassificationDesc: desc, CategoryId: cid };
      },
      removeClassification: (ClassificationId) => {
        if (data.subClassifications.some((r) => r.ClassificationId === ClassificationId)) return { ok: false, error: "Cannot delete — sub-classifications still reference this classification." };
        setData((d) => _sortCommodityData({ ...d, classifications: d.classifications.filter((r) => r.ClassificationId !== ClassificationId) }));
        return { ok: true };
      },
      addSubClassification: (SubClassificationId, SubClassificationDesc, ClassificationId, KbliGroups, SpecialReqIds) => {
        const id = _normSubClassificationId(SubClassificationId);
        const desc = _normSubClassificationDesc(SubClassificationDesc);
        const clid = _normClassificationId(ClassificationId);
        if (!id) return { ok: false, error: "Sub-classification Id is required." };
        if (!desc) return { ok: false, error: "Description is required." };
        if (!clid) return { ok: false, error: "Classification is required." };
        if (!data.classifications.some((r) => r.ClassificationId === clid)) return { ok: false, error: "Classification not found." };
        if (data.subClassifications.some((r) => r.SubClassificationId === id)) return { ok: false, error: "Sub-classification Id already exists." };
        setData((d) => _sortCommodityData(_applySubJunctions({
          ...d,
          subClassifications: [...d.subClassifications, { SubClassificationId: id, SubClassificationDesc: desc, ClassificationId: clid }],
        }, id, KbliGroups, SpecialReqIds)));
        return { ok: true, SubClassificationId: id, SubClassificationDesc: desc, ClassificationId: clid };
      },
      updateSubClassification: (SubClassificationId, SubClassificationDesc, ClassificationId, KbliGroups, SpecialReqIds) => {
        const desc = _normSubClassificationDesc(SubClassificationDesc);
        const clid = _normClassificationId(ClassificationId);
        if (!desc) return { ok: false, error: "Description is required." };
        if (!clid) return { ok: false, error: "Classification is required." };
        if (!data.subClassifications.some((r) => r.SubClassificationId === SubClassificationId)) return { ok: false, error: "Sub-classification not found." };
        setData((d) => _sortCommodityData(_applySubJunctions({
          ...d,
          subClassifications: d.subClassifications.map((r) => (r.SubClassificationId === SubClassificationId ? { ...r, SubClassificationDesc: desc, ClassificationId: clid } : r)),
        }, SubClassificationId, KbliGroups, SpecialReqIds)));
        return { ok: true, SubClassificationId, SubClassificationDesc: desc, ClassificationId: clid };
      },
      removeSubClassification: (SubClassificationId) => {
        setData((d) => _sortCommodityData({
          ...d,
          subClassifications: d.subClassifications.filter((r) => r.SubClassificationId !== SubClassificationId),
          subClassificationKbliRule: (d.subClassificationKbliRule || []).filter((r) => r.SubClassificationId !== SubClassificationId),
          subClassificationSpecialReq: d.subClassificationSpecialReq.filter((r) => r.SubClassificationId !== SubClassificationId),
        }));
        return { ok: true };
      },
      resetCommodity: () => setData(_sortCommodityData(_cloneCommoditySeed())),
    };
  }, [data, loading]);

  return <CommodityMasterCtx.Provider value={api}>{children}</CommodityMasterCtx.Provider>;
}

function useCommodityMaster() { return React.useContext(CommodityMasterCtx); }

Object.assign(window, {
  COMMODITY_MASTER_KEY, CATEGORY_ID_MAX, CATEGORY_DESC_MAX,
  CLASSIFICATION_ID_MAX, CLASSIFICATION_DESC_MAX,
  SUBCLASSIFICATION_ID_MAX, SUBCLASSIFICATION_DESC_MAX,
  CommodityMasterProvider, useCommodityMaster,
  _normKbliGroups, _flattenKbliGroups, _kbliRulePreview,
});
export { COMMODITY_MASTER_KEY, CATEGORY_ID_MAX, CATEGORY_DESC_MAX, CLASSIFICATION_ID_MAX, CLASSIFICATION_DESC_MAX, SUBCLASSIFICATION_ID_MAX, SUBCLASSIFICATION_DESC_MAX, CommodityMasterProvider, useCommodityMaster, _normKbliGroups, _flattenKbliGroups, _kbliRulePreview };
