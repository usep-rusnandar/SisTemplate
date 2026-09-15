/* fm3-converted */
import React from "react";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { TRK_METHODS, TRK_STAGE_MASTER, trkRebuildProcessModel } from "./TrackerData.jsx";
/* Alamtri Geo Admin — Master Data ▸ Tracker Step & Tracker Method.
   Shared, editable source of truth for the procurement process model:
   - STEPS  : the ordered stages a proposal moves through (Proposal Received → Contract).
   - METHODS: procurement methods (Tender, Pemilihan Langsung, Penunjukan Langsung),
              each carrying an SLA profile that maps a subset of steps → working days.
   The Method SLA editor reads STEPS live, so the two screens stay in sync: add or
   remove a step here and every method's SLA matrix reflects it. Persisted through backend state API. */

/* The Tracker process model (steps + methods) lives in the backend master-data sets
   `tracker-step` / `tracker-method` — each record stores the full object in payloadJson.
   The former TRACKER_STEPS_SEED / TRACKER_METHODS_SEED frontend arrays are gone. This runtime
   cache is hydrated from the backend and kept on window (__trackerStepCache / __trackerMethodCache)
   so the Tracker workflow engine (TrackerData.jsx) can build TRK_STAGE_MASTER / TRK_METHODS. */
const TRACKER_STEP_API = "/api/v1/master-data/sets/tracker-step";
const TRACKER_METHOD_API = "/api/v1/master-data/sets/tracker-method";

function _trkParseMasterRecords(records) {
  const rows = (Array.isArray(records) ? records : [])
    .map((rec) => {
      try {
        const raw = rec && (rec.payloadJson || rec.PayloadJson || rec.payload || rec.Payload);
        return raw ? JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) : null;
      } catch (e) { return null; }
    })
    .filter(Boolean);
  // Prefer explicit sortOrder (PROP→TIA→…→TERM→LOA→CTR); fall back to id.
  return rows.sort((a, b) => {
    const ao = Number(a && a.sortOrder);
    const bo = Number(b && b.sortOrder);
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
  });
}
function trkProcessModelReady(steps, methods) {
  return Array.isArray(steps) && steps.length > 0 && Array.isArray(methods) && methods.length > 0;
}
let _trackerModelPromise = null;
// fetch (and cache) the tracker step + method master; deduped via _trackerModelPromise / window cache.
// IMPORTANT: empty arrays are truthy in JS — never treat [] as a hydrated cache (that stuck the matrix on "Loading…").
function loadTrackerProcessModel(force) {
  if (!force && trkProcessModelReady(window.__trackerStepCache, window.__trackerMethodCache)) {
    return Promise.resolve({ steps: window.__trackerStepCache, methods: window.__trackerMethodCache });
  }
  if (_trackerModelPromise && !force) return _trackerModelPromise;
  const get = (url) => fetch(url, { credentials: "include", headers: { Accept: "application/json" } })
    .then((r) => {
      if (!r.ok) throw new Error(`tracker master ${url} → HTTP ${r.status}`);
      return r.json();
    })
    .then((p) => {
      const records = (p && (p.records || p.Records)) || [];
      const hasData = p && (p.hasData === true || p.HasData === true || (Array.isArray(records) && records.length > 0));
      return hasData ? _trkParseMasterRecords(records) : [];
    });
  _trackerModelPromise = Promise.all([get(TRACKER_STEP_API), get(TRACKER_METHOD_API)])
    .then(([steps, methods]) => {
      if (trkProcessModelReady(steps, methods)) {
        window.__trackerStepCache = steps;
        window.__trackerMethodCache = methods;
      } else {
        // Do not sticky-cache empties — allows retry on next call.
        window.__trackerStepCache = null;
        window.__trackerMethodCache = null;
        console.warn("Tracker process model empty after fetch.", { steps: (steps || []).length, methods: (methods || []).length });
      }
      try { if (typeof trkRebuildProcessModel === "function") trkRebuildProcessModel(); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent("ag:tracker-master-loaded")); } catch (e) {}
      return { steps: steps || [], methods: methods || [] };
    })
    .catch((err) => {
      console.warn("Tracker process model load failed.", err);
      window.__trackerStepCache = null;
      window.__trackerMethodCache = null;
      try { window.dispatchEvent(new CustomEvent("ag:tracker-master-loaded")); } catch (e) {}
      return { steps: [], methods: [], error: err };
    })
    .finally(() => { _trackerModelPromise = null; });
  return _trackerModelPromise;
}

const METHOD_TONES = ["brand", "blue", "orange", "forest", "danger"];
const TRACKER_MASTER_KEY = "ag_tracker_master_v5";
const TRACKER_LEGACY_MASTER_KEYS = ["ag_tracker_master_v4", "ag_tracker_master_v3", "ag_tracker_master_v2", "ag_tracker_master_v1"];

function canReadTrackerProcessModel(can) {
  return can("proposalTracker.view")
    || can("contractInitiationPlatform.view")
    || can("masterData.trackerStep.view")
    || can("masterData.trackerMethod.view")
    || can("masterData.proposalTracker.view");
}

const TrackerMasterCtx = React.createContext(null);

// snapshot of the backend-hydrated cache (empty until hydration completes)
function _cloneSeed() {
  return {
    steps: (window.__trackerStepCache || []).map((s) => ({ ...s })),
    methods: (window.__trackerMethodCache || []).map((m) => ({ ...m, sla: { ...(m.sla || {}) } })),
  };
}

function TrackerMasterProvider({ children }) {
  const session = useSession();
  const canRead = canReadTrackerProcessModel((key) => !!(session && session.can && session.can(key)));
  const canWriteStorage = !!(session && session.can && session.can("proposalTracker.view"));
  const [state, setState] = React.useState(() => {
    try { const v = window.__procurementStorage.getItem(TRACKER_MASTER_KEY); if (v) return JSON.parse(v); } catch (e) {}
    return _cloneSeed();
  });
  React.useEffect(() => {
    if (!canWriteStorage) return;
    try { TRACKER_LEGACY_MASTER_KEYS.forEach((key) => window.__procurementStorage.removeItem(key)); } catch (e) {}
  }, [canWriteStorage]);
  React.useEffect(() => {
    if (!canWriteStorage) return;
    try { window.__procurementStorage.setItem(TRACKER_MASTER_KEY, JSON.stringify(state)); } catch (e) {}
  }, [state, canWriteStorage]);

  // Process model is backend SoT (sortOrder, TIA, TERM-before-LOA). Refresh only when the principal
  // can read tracker-step / tracker-method — VO-only sessions must not hit those endpoints (HTTP 403).
  React.useEffect(() => {
    if (!canRead) return undefined;
    let cancelled = false;
    loadTrackerProcessModel(true).then(({ steps, methods }) => {
      if (cancelled) return;
      setState({
        steps: (steps || []).map((s) => ({ ...s })),
        methods: (methods || []).map((m) => ({ ...m, sla: { ...(m.sla || {}) } })),
      });
    });
    return () => { cancelled = true; };
  }, [canRead]);

  const api = React.useMemo(() => {
    const slaTotal = (m) => Object.keys(m.sla || {}).reduce((sum, k) => sum + (Number(m.sla[k]) || 0), 0);
    const stepUseCount = (stepId) => state.methods.filter((m) => m.sla && m.sla[stepId] != null).length;
    return {
      steps: state.steps,
      methods: state.methods,
      slaTotal,
      stepUseCount,

      // ----- steps -----
      addStep: (step) => setState((s) => ({ ...s, steps: [...s.steps, { ...step, id: "TS-" + Date.now().toString(36) }] })),
      updateStep: (id, patch) => setState((s) => ({ ...s, steps: s.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      removeStep: (id) => setState((s) => ({
        ...s,
        steps: s.steps.filter((x) => x.id !== id),
        // cascade: drop the deleted step from every method's SLA profile
        methods: s.methods.map((m) => { const sla = { ...m.sla }; delete sla[id]; return { ...m, sla }; }),
      })),
      moveStep: (id, dir) => setState((s) => {
        const idx = s.steps.findIndex((x) => x.id === id);
        const ni = idx + dir;
        if (idx === -1 || ni < 0 || ni >= s.steps.length) return s;
        const steps = [...s.steps];
        const [it] = steps.splice(idx, 1);
        steps.splice(ni, 0, it);
        return { ...s, steps };
      }),

      // ----- methods -----
      addMethod: (method) => setState((s) => ({ ...s, methods: [...s.methods, { ...method, id: "TM-" + Date.now().toString(36), sla: method.sla || {} }] })),
      updateMethod: (id, patch) => setState((s) => ({ ...s, methods: s.methods.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      removeMethod: (id) => setState((s) => ({ ...s, methods: s.methods.filter((m) => m.id !== id) })),
      // set a single step's SLA on a method; pass null/undefined to mark Not applicable
      setMethodStep: (methodId, stepId, days) => setState((s) => ({
        ...s,
        methods: s.methods.map((m) => {
          if (m.id !== methodId) return m;
          const sla = { ...m.sla };
          if (days == null) delete sla[stepId];
          else sla[stepId] = Math.max(0, Math.round(Number(days) || 0));
          return { ...m, sla };
        }),
      })),
      resetTrackerMaster: () => loadTrackerProcessModel(true).then(({ steps, methods }) => setState({
        steps: (steps || []).map((s) => ({ ...s })),
        methods: (methods || []).map((m) => ({ ...m, sla: { ...(m.sla || {}) } })),
      })),
    };
  }, [state]);

  return <TrackerMasterCtx.Provider value={api}>{children}</TrackerMasterCtx.Provider>;
}
function useTrackerMaster() { return React.useContext(TrackerMasterCtx); }

Object.assign(window, { METHOD_TONES, TrackerMasterProvider, useTrackerMaster, loadTrackerProcessModel, trkProcessModelReady });
export { METHOD_TONES, TrackerMasterProvider, useTrackerMaster, loadTrackerProcessModel, trkProcessModelReady };
