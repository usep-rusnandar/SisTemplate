/* fm3-converted */
import React from "react";
/* Alamtri Geo Admin — Master Data ▸ Village (read-only reference, lazy cascade).
   Mirrors MSTR_VILLAGE_T (VillageId, VillageName, DistrictId). ~82k rows, so this provider does NOT
   load-all: it fetches villages for a selected district on demand via /sets/village?parent={districtId}
   and caches per district. */

const VILLAGE_ID_MAX = 13;
const VILLAGE_NAME_MAX = 50;
const VILLAGE_MASTER_API = "/api/v1/master-data/sets/village";

const VillageMasterCtx = React.createContext(null);

function _mapVillageRecords(records) {
  return (Array.isArray(records) ? records : [])
    .map((record) => {
      let payload = null;
      try { payload = record.payloadJson ? JSON.parse(record.payloadJson) : null; } catch (e) {}
      return {
        VillageId: String(record.code || "").trim(),
        VillageName: String(record.name || "").trim(),
        DistrictId: String((payload && (payload.DistrictId || payload.districtId)) || record.parentCode || "").trim(),
      };
    })
    .filter((r) => r.VillageId && r.VillageName)
    .sort((a, b) => a.VillageId.localeCompare(b.VillageId, undefined, { numeric: true }));
}

function VillageMasterProvider({ children }) {
  const [byDistrict, setByDistrict] = React.useState({});   // districtId -> villages[] (cache)
  const [loadingFor, setLoadingFor] = React.useState("");

  const loadForDistrict = React.useCallback(async (districtId) => {
    const id = String(districtId || "").trim();
    if (!id) return [];
    if (byDistrict[id]) return byDistrict[id];
    setLoadingFor(id);
    try {
      const res = await fetch(`${VILLAGE_MASTER_API}?parent=${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return [];
      const payload = await res.json();
      const rows = _mapVillageRecords(payload.records);
      setByDistrict((prev) => ({ ...prev, [id]: rows }));
      return rows;
    } catch (error) {
      console.warn("Village master fetch failed.", error);
      return [];
    } finally {
      setLoadingFor("");
    }
  }, [byDistrict]);

  const api = React.useMemo(() => ({
    loadForDistrict,
    getForDistrict: (districtId) => byDistrict[String(districtId || "").trim()] || [],
    isLoading: (districtId) => loadingFor === String(districtId || "").trim(),
  }), [loadForDistrict, byDistrict, loadingFor]);

  return <VillageMasterCtx.Provider value={api}>{children}</VillageMasterCtx.Provider>;
}

function useVillageMaster() { return React.useContext(VillageMasterCtx); }

Object.assign(window, { VILLAGE_ID_MAX, VILLAGE_NAME_MAX, VillageMasterProvider, useVillageMaster });
export { VILLAGE_ID_MAX, VILLAGE_NAME_MAX, VillageMasterProvider, useVillageMaster };
