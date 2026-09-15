/* fm3-converted */
import React from "react";
import { trkCumulativeTargetDates } from "./TrackerCalendar.jsx";
import { loadTrackerProcessModel } from "./TrackerMasterData.jsx";
import { fmtAppDate } from "../../../shared/legacy/PrimitivesX.jsx";
import { useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin - Tracker module domain, seed, workflow mutations and PDF helpers.
   Rebuilt from src-old tracker concepts: proposal readiness, distribution,
   activity timeline, direct Section Head recycle/cancel actions, SLA variance,
   sample PDF attachments, and LOA generation. */

/* useTT now lives in i18n.jsx (shared by internal & external bundles). */
function trkText(lang, o) { return lang === "id" ? (o.id || o.en) : o.en; }

/* "Today" reference for SLA/aging/timeline math — uses the real current (local) date so the
   tracker reflects real time. (Was previously hardcoded to a fixed demo date.) */
const TRK_TODAY = (function () {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const TRK_AS_OF = (function () {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
})();
const TRACKER_STORE_KEY = "ag_tracker_rebuild_v14";
const TRACKER_LEGACY_STORE_KEYS = ["ag_tracker_rebuild_v1", "ag_tracker_rebuild_v2", "ag_tracker_rebuild_v3", "ag_tracker_rebuild_v4", "ag_tracker_rebuild_v5", "ag_tracker_rebuild_v6", "ag_tracker_rebuild_v7", "ag_tracker_rebuild_v8", "ag_tracker_rebuild_v9", "ag_tracker_rebuild_v10", "ag_tracker_rebuild_v11", "ag_tracker_rebuild_v12", "ag_tracker_rebuild_v13"];
const TRACKER_AUXILIARY_STORE_PREFIXES = ["ag_tracker_step_vendor_docs_v1:", "ag_tracker_bid_eval_v1:", "ag_tracker_activity_notes_v1:"];
const TRACKER_EVENT = "ag-tracker-store";
const TRACKER_ASSIGNABLE_EVENT = "ag:tracker-assignable-loaded";

function trkStepOwner(step) {
  // EVAL = requester/user evaluation; TERM/CTR = CIP officer handoff; LOA = Tracker Proc officer.
  return ["EVAL", "TERM", "CTR"].includes(step.code) ? "User" : "Proc";
}
function trkSortSteps(steps) {
  return (Array.isArray(steps) ? steps.slice() : []).sort((a, b) => {
    const ao = Number(a && a.sortOrder);
    const bo = Number(b && b.sortOrder);
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
  });
}
function trkActivityCode(activity) {
  if (!activity) return "";
  const stage = activity.stageId ? trkStageById(activity.stageId) : null;
  return (stage && stage.code) || "";
}
/** Recycle of LOA/CTR keeps CIP Term Sheet cases. Recycle of EVAL/TERM or any earlier award step drops them. */
function trkRecycleInvalidatesCip(proposal, activity) {
  const code = trkActivityCode(activity);
  if (code === "LOA" || code === "CTR") return false;
  if (code === "TERM" || code === "EVAL") return true;
  const acts = (proposal && proposal.activities) || [];
  const hasEval = acts.some((item) => trkActivityCode(item) === "EVAL");
  if (!hasEval && code === "NEGO") return true;
  const awardCode = hasEval ? "EVAL" : "NEGO";
  const recycledIndex = acts.findIndex((item) => item.id === activity.id);
  const awardIndex = acts.findIndex((item) => trkActivityCode(item) === awardCode);
  return recycledIndex >= 0 && awardIndex >= 0 && recycledIndex <= awardIndex;
}
function trkNotifyCipCasesDropped(proposalId) {
  try { window.dispatchEvent(new CustomEvent("ag-cip-drop-proposal", { detail: { proposalId } })); } catch (e) {}
}
/** After Term Sheet completes, LOA (Tracker) and CTR (CIP) open together. */
function trkIsParallelPostTermCode(code) {
  return code === "LOA" || code === "CTR";
}

/* The process model (steps + methods) is hydrated from the backend master-data sets by
   TrackerMasterData.loadTrackerProcessModel (cached on window.__trackerStepCache /
   __trackerMethodCache). These are `let` bindings rebuilt when hydration completes — the
   runtime workflow helpers below and the tracker screens read them live. */
function trkBuildStageMaster(steps) {
  return trkSortSteps(steps).map((step) => ({ ...step, owner: trkStepOwner(step) }));
}
function trkBuildMethods(methods, stageMaster) {
  return (Array.isArray(methods) ? methods : []).map((method) => {
    const stages = stageMaster
      .filter((step) => method.sla && method.sla[step.id] != null)
      .map((step) => [step.id, Number(method.sla[step.id]) || 0]);
    return { ...method, stages, slaDays: stages.reduce((sum, row) => sum + row[1], 0) };
  });
}
let TRK_STAGE_MASTER = [];
let TRK_METHODS = [];
function trkRebuildProcessModel() {
  TRK_STAGE_MASTER = trkBuildStageMaster((typeof window !== "undefined" && window.__trackerStepCache) || []);
  TRK_METHODS = trkBuildMethods((typeof window !== "undefined" && window.__trackerMethodCache) || [], TRK_STAGE_MASTER);
  try { Object.assign(window, { TRK_STAGE_MASTER, TRK_METHODS }); } catch (e) {}
}
trkRebuildProcessModel(); // build from cache if already hydrated (empty until then)
try {
  window.addEventListener("ag:tracker-master-loaded", () => {
    trkRebuildProcessModel();
    // nudge tracker screens (useTrackerStore listeners) to re-render with the hydrated model
    try { window.dispatchEvent(new CustomEvent(TRACKER_EVENT, { detail: trkReadStore() })); } catch (e) {}
  });
} catch (e) {}

const TRK_JOBSITES = ["ADMO", "MACO", "SERA", "JAHO", "NARO", "BIB", "KIDE"];
/* Assignable owners (Section Head Proposal Tracker) + officers (Officer Proposal Tracker) come from the backend
   (/api/v1/proposal-tracker/assignable-users), cached on window and rebuilt on hydration. `let`
   so the distribution/reassignment dropdowns pick up the real users once loaded. */
let TRK_OWNERS = (window.__trackerAssignable && window.__trackerAssignable.sectionHeads) || [];
let TRK_OFFICERS = (window.__trackerAssignable && window.__trackerAssignable.officers) || [];
function trkAssignableScopeKey(forPersonnelNo) {
  return String(forPersonnelNo || "").trim();
}
function trkActingPersonnelNo(sessionOrUser) {
  const user = sessionOrUser && sessionOrUser.actingUser ? sessionOrUser.actingUser : sessionOrUser;
  return String((user && (user.personnelNo || user.username)) || "").trim();
}
function trkApplyAssignableUsers(next) {
  window.__trackerAssignable = next;
  window.__trackerVisibility = { mode: next.visibilityMode, ownerNamesUnder: next.ownerNamesUnder };
  TRK_OWNERS = next.sectionHeads;
  TRK_OFFICERS = next.officers;
  try { Object.assign(window, { TRK_OWNERS, TRK_OFFICERS }); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent(TRACKER_ASSIGNABLE_EVENT, { detail: next })); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent(TRACKER_EVENT, { detail: trkReadStore() })); } catch (e) {}
  return next;
}
let _trkAssignableSeq = 0;
function loadTrackerAssignableUsers(force, forPersonnelNo, options) {
  const scopeKey = trkAssignableScopeKey(forPersonnelNo);
  if (!force && window.__trackerAssignable && window.__trackerAssignable.forPersonnelNo === scopeKey) {
    return Promise.resolve(window.__trackerAssignable);
  }
  const seq = ++_trkAssignableSeq;
  if (options && options.failClosed) {
    return Promise.resolve(trkApplyAssignableUsers({
      sectionHeads: [],
      officers: [],
      visibilityMode: "none",
      ownerNamesUnder: [],
      forPersonnelNo: scopeKey,
    }));
  }
  const qs = scopeKey ? `?forPersonnelNo=${encodeURIComponent(scopeKey)}` : "";
  return fetch(`/api/v1/proposal-tracker/assignable-users${qs}`, { credentials: "include", headers: { Accept: "application/json" } })
    .then((r) => {
      if (!r.ok) throw new Error(`assignable-users ${r.status}`);
      return r.json();
    })
    .then((data) => {
      if (seq !== _trkAssignableSeq) return window.__trackerAssignable;
      return trkApplyAssignableUsers({
        sectionHeads: (data && data.sectionHeads) || [],
        officers: (data && data.officers) || [],
        visibilityMode: (data && data.visibilityMode) || "none",
        ownerNamesUnder: (data && data.ownerNamesUnder) || [],
        forPersonnelNo: scopeKey,
      });
    })
    .catch(() => {
      if (seq !== _trkAssignableSeq) return window.__trackerAssignable;
      const cached = window.__trackerAssignable;
      if (cached && cached.forPersonnelNo === scopeKey) return cached;
      return trkApplyAssignableUsers({
        sectionHeads: [],
        officers: [],
        visibilityMode: "none",
        ownerNamesUnder: [],
        forPersonnelNo: scopeKey,
      });
    });
}
function useTrackerAssignableOfficers(personnelNo, enabled, options) {
  const scopeKey = trkAssignableScopeKey(personnelNo);
  const failClosed = !!(options && options.failClosed);
  const [officers, setOfficers] = React.useState(() => {
    const cached = typeof window !== "undefined" ? window.__trackerAssignable : null;
    if (!failClosed && cached && cached.forPersonnelNo === scopeKey && Array.isArray(cached.officers)) {
      return cached.officers.slice();
    }
    return [];
  });
  React.useEffect(() => {
    if (enabled === false) return undefined;
    let cancelled = false;
    const apply = (payload) => {
      if (cancelled || !payload) return;
      if (String(payload.forPersonnelNo || "") !== scopeKey) return;
      setOfficers(Array.isArray(payload.officers) ? payload.officers.slice() : []);
    };
    const onLoaded = (event) => apply(event && event.detail);
    window.addEventListener(TRACKER_ASSIGNABLE_EVENT, onLoaded);
    loadTrackerAssignableUsers(true, scopeKey, failClosed ? { failClosed: true } : undefined).then(apply);
    return () => {
      cancelled = true;
      window.removeEventListener(TRACKER_ASSIGNABLE_EVENT, onLoaded);
    };
  }, [scopeKey, enabled, failClosed]);
  return officers;
}
function trkNormalizeAwardPercentages(count, percentages) {
  const safeCount = Math.max(1, Number(count) || 1);
  const fallback = safeCount === 3 ? [45, 35, 20] : [60, 40];
  const source = Array.isArray(percentages) && percentages.length ? percentages : fallback;
  const rows = [];
  let used = 0;
  for (let i = 0; i < safeCount; i += 1) {
    const raw = Number(source[i]);
    const pct = Number.isFinite(raw) && raw > 0 ? raw : Math.max(5, Math.round((100 - used) / (safeCount - i)));
    rows.push(pct);
    used += pct;
  }
  const total = rows.reduce((sum, pct) => sum + pct, 0) || 100;
  return rows.map((pct, i) => i === rows.length - 1
    ? Math.max(1, 100 - rows.slice(0, -1).reduce((sum, item) => sum + item, 0))
    : Math.round((pct / total) * 100));
}

const TRK_STATUS_META = {
  ReadyToDistribute: { en: "Ready to distribute", id: "Siap distribusi", tone: "warning", icon: "send" },
  OnProgress: { en: "On progress", id: "Sedang berjalan", tone: "info", icon: "activity" },
  Completed: { en: "Completed", id: "Selesai", tone: "success", icon: "check-circle-2" },
  Canceled: { en: "Canceled", id: "Dibatalkan", tone: "danger", icon: "x-circle" },
};
const TRK_ACTIVITY_META = {
  Completed: { en: "Completed", id: "Selesai", tone: "success", icon: "check" },
  Pending: { en: "Active", id: "Aktif", tone: "info", icon: "play" },
  Locked: { en: "Locked", id: "Terkunci", tone: "neutral", icon: "lock" },
  Canceled: { en: "Canceled", id: "Dibatalkan", tone: "danger", icon: "ban" },
};

function trkClone(v) { return JSON.parse(JSON.stringify(v)); }
function trkPad(n) { return String(n).padStart(2, "0"); }
function trkParse(iso) { if (!iso) return null; const s = String(iso).split("T")[0].split(" ")[0]; const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function trkIso(d) { return `${d.getFullYear()}-${trkPad(d.getMonth() + 1)}-${trkPad(d.getDate())}`; }
function trkAddDays(iso, days) { const d = trkParse(iso); d.setDate(d.getDate() + days); return trkIso(d); }
function trkDaysBetween(a, b) { return Math.round((trkParse(b) - trkParse(a)) / 86400000); }
function trkTimestamp(iso, hour) { return `${iso} ${trkPad(hour || 9)}:20:00`; }
function trkDatePart(value) { return String(value || "").split("T")[0].split(" ")[0]; }
function trkRp(n) { return "Rp " + Math.round(n || 0).toLocaleString("id-ID"); }
function trkRpM(n, lang) {
  const value = (n || 0) / 1000000000;
  return `Rp ${value.toLocaleString(lang === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
}
function trkCurrencyCode(value) {
  const code = String(value || "IDR").trim().toUpperCase();
  return code || "IDR";
}
function trkMoney(n, currency, lang) {
  const code = trkCurrencyCode(currency);
  const amount = Number(n) || 0;
  if (code === "IDR") return trkRp(amount);
  return `${code} ${amount.toLocaleString(lang === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function trkMoneyCompact(n, currency, lang) {
  const amount = Number(n) || 0;
  if (Math.abs(amount) < 1000000000) return trkMoney(amount, currency, lang);
  const code = trkCurrencyCode(currency);
  if (code === "IDR") return trkRpM(amount, lang);
  const value = amount / 1000000000;
  return `${code} ${value.toLocaleString(lang === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} B`;
}
const TRK_MONTHS = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] };
function trkFmtDate(iso, lang) { return fmtAppDate(iso); }
function trkNow() { return `${TRK_TODAY} ${trkPad(new Date().getHours())}:${trkPad(new Date().getMinutes())}:00`; }
function trkUid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function trkClearLegacyStoreKeys() { try { TRACKER_LEGACY_STORE_KEYS.forEach((key) => window.__procurementStorage.removeItem(key)); } catch (e) {} }
function trkClearAuxiliaryStoreKeys() {
  try {
    const keys = [];
    for (let i = 0; i < window.__procurementStorage.length; i += 1) {
      const key = window.__procurementStorage.key(i);
      if (key && TRACKER_AUXILIARY_STORE_PREFIXES.some((prefix) => key.indexOf(prefix) === 0)) keys.push(key);
    }
    keys.forEach((key) => window.__procurementStorage.removeItem(key));
  } catch (e) {}
}
function trkMethodById(id) {
  const found = TRK_METHODS.find((m) => m.id === id);
  if (found) return found;
  if (TRK_METHODS[0]) return TRK_METHODS[0];
  // Masters not hydrated yet (or unknown id) — never return undefined (matrix reads .name/.stages).
  return { id: id || "", name: id || "—", code: "", tone: "neutral", desc: "", sla: {}, stages: [], slaDays: 0 };
}
function trkStageById(id) { return TRK_STAGE_MASTER.find((s) => s.id === id) || { id, name: id, code: id, owner: "Proc" }; }
/** Short stage label for dense tables: "Request for Quotation (RFQ)" → "RFQ". */
function trkStageShortLabel(stageOrName) {
  if (!stageOrName) return "";
  if (typeof stageOrName === "object") {
    if (stageOrName.code) return stageOrName.code;
    stageOrName = stageOrName.name || "";
  }
  const name = String(stageOrName).trim();
  if (!name) return "";
  const paren = name.match(/\(([^)]+)\)\s*$/);
  if (paren && paren[1]) return paren[1].trim();
  const found = TRK_STAGE_MASTER.find((s) => s.name === name || s.code === name || s.id === name);
  return (found && found.code) || name;
}
function trkStageRows(methodId) { return trkMethodById(methodId).stages.map((row) => ({ ...trkStageById(row[0]), slaDays: row[1] })); }
// Whether a proposal's procurement method includes a Bid Evaluation (EVAL) stage. Tender and Pemilihan
// Langsung do; Penunjukan Langsung (direct appointment) does not — for it the commercial outcome is
// decided at Negotiation, so the award result is sourced from there instead of from Bid Evaluation.
function trkMethodHasBidEvaluation(proposal) {
  return trkStageRows(proposal && proposal.trackerMethod).some((stage) => stage.code === "EVAL");
}
// The directly-appointed winner(s) for a Penunjukan Langsung proposal: the single appointed vendor.
// (Direct appointment has no Bid Evaluation winner selection — the invited vendor is the winner.)
function trkDirectAppointmentWinnerIds(proposal) {
  const vendors = proposal && proposal.id ? trkVendorsForProposal(proposal.id) : [];
  return vendors.length ? [vendors[0].vendorId] : [];
}
function trkHash(value) { return String(value).split("").reduce((s, c) => ((s * 31) + c.charCodeAt(0)) >>> 0, 7); }
function trkStageIdByCode(code) {
  const found = TRK_STAGE_MASTER.find((stage) => stage.code === code);
  return found ? found.id : "";
}
function trkStageNameByCode(code) {
  const found = TRK_STAGE_MASTER.find((stage) => stage.code === code);
  return found ? found.name : code;
}
function trkContractActivity(proposal) {
  const activities = (proposal && proposal.activities) || [];
  const contractStageId = trkStageIdByCode("CTR");
  const contractName = trkStageNameByCode("CTR");
  return activities.find((activity) => activity.stageId === contractStageId || activity.title === contractName) || null;
}
function trkIsContractCompleted(proposal) {
  const activities = (proposal && proposal.activities) || [];
  if (!activities.length) return false;
  // Completed when every workflow activity is done — LOA and CTR may finish in either order.
  return activities.every((activity) => activity.status === "Completed" || activity.status === "Canceled")
    && activities.some((activity) => activity.status === "Completed");
}
function trkLifecycleStatusForProposal(proposal) {
  if (!proposal) return "OnProgress";
  if (proposal.lifecycleStatus === "Canceled") return "Canceled";
  if (proposal.lifecycleStatus === "ReadyToDistribute" && !((proposal.activities || []).length)) return "ReadyToDistribute";
  return trkIsContractCompleted(proposal) ? "Completed" : "OnProgress";
}
function trkCurrentStageForLifecycle(proposal, lifecycleStatus) {
  if (!proposal) return "";
  if (lifecycleStatus === "Completed") {
    const contract = trkContractActivity(proposal);
    return (contract && contract.title) || trkStageNameByCode("CTR");
  }
  if (lifecycleStatus === "OnProgress") {
    const activities = proposal.activities || [];
    const pending = activities.filter((activity) => activity.status === "Pending");
    if (pending.length > 1) {
      return pending.map((activity) => trkStageShortLabel(trkStageById(activity.stageId)) || activity.title).join(" · ");
    }
    if (pending.length === 1) return pending[0].title;
    const next = activities.find((activity) => activity.status !== "Completed" && activity.status !== "Canceled");
    if (next) return next.title;
    const contract = trkContractActivity(proposal);
    return (contract && contract.title) || proposal.currentStage || trkStageNameByCode("CTR");
  }
  return proposal.currentStage;
}
/** True when a Pending (Open) activity matches the Current Step filter value. Parallel TERM/LOA/CTR all match. */
function trkProposalHasOpenStep(proposal, stepName) {
  if (!proposal || !stepName || stepName === "all") return true;
  const wanted = TRK_STAGE_MASTER.find((s) => s.name === stepName || s.code === stepName || s.id === stepName) || null;
  return (proposal.activities || []).some((activity) => {
    if (!activity || activity.status !== "Pending") return false;
    if (activity.title === stepName) return true;
    const stage = activity.stageId ? trkStageById(activity.stageId) : null;
    if (wanted && (activity.stageId === wanted.id || (stage && (stage.id === wanted.id || stage.name === wanted.name || stage.code === wanted.code)))) return true;
    if (stage && (stage.name === stepName || stage.code === stepName)) return true;
    const shortTitle = trkStageShortLabel(activity.title);
    if (shortTitle && (shortTitle === stepName || (wanted && shortTitle === wanted.code))) return true;
    return false;
  });
}
/** Reorder activities to current method/master order (TERM before LOA) while keeping status/dates. */
function trkReconcileActivitiesToMasterOrder(proposal) {
  if (!proposal || !Array.isArray(proposal.activities) || !proposal.activities.length) return proposal;
  const order = trkStageRows(proposal.trackerMethod).map((stage) => stage.id);
  if (!order.length) return proposal;
  const byStage = {};
  proposal.activities.forEach((activity) => {
    if (activity && activity.stageId) byStage[activity.stageId] = activity;
  });
  const reordered = order.map((stageId, index) => {
    const existing = byStage[stageId];
    if (existing) return existing;
    const stage = trkStageById(stageId);
    return {
      id: `${proposal.id}-a-${index + 1}`,
      stageId,
      title: stage.name,
      owner: stage.owner,
      masterLeadDays: stage.slaDays,
      targetLeadDays: stage.slaDays,
      targetDate: proposal.distribution && proposal.distribution.estimatedDate,
      status: "Locked",
      evidenceCount: 0,
      evidenceNames: [],
      lockedReason: "Complete the previous stage to unlock this activity.",
      history: [],
    };
  });
  const same = reordered.length === proposal.activities.length
    && reordered.every((activity, index) => proposal.activities[index] && proposal.activities[index].stageId === activity.stageId);
  return same ? proposal : { ...proposal, activities: reordered };
}
// Intake readiness: TOR/TER are not sourced from E-Proposal yet; vendor list comes from ingest.
function trkBuildReadinessChecklist(proposal) {
  const vendorSource = Array.isArray(proposal && proposal.recommendedVendors) ? proposal.recommendedVendors : [];
  const vendors = vendorSource
    .map((v, index) => ({
      vendorId: (v && (v.vendorId || v.VendorId)) || `MANUAL-${index + 1}`,
      vendorName: (v && (v.vendorName || v.VendorName)) || "Vendor",
    }))
    .filter((v) => v.vendorName);
  return [
    { id: "scope-confirmed", label: "Term of Reference (TOR)", isReady: false, document: null },
    { id: "technical-spec-complete", label: "Technical Evaluation Report (TER)", isReady: false, document: null },
    { id: "vendor-list-available", label: "Vendor List", isReady: vendors.length > 0, vendors },
  ];
}
function trkNormalizeProposalLifecycle(proposal) {
  if (!proposal) return proposal;
  const reconciled = trkReconcileActivitiesToMasterOrder(proposal);
  const legacyContractType = reconciled.contractType || reconciled.trackerContractType || reconciled.proposalType || "";
  const method = trkMethodById(reconciled.trackerMethod);
  const isLegacySampleContractType = String(reconciled.id || "").startsWith("SMP-")
    && method && String(legacyContractType).trim().toLowerCase() === String(method.name).trim().toLowerCase();
  const contractType = isLegacySampleContractType
    ? (/works|services/i.test(String(reconciled.commodity || "")) ? "Contractual" : "Non Contractual")
    : legacyContractType;
  const contractualType = reconciled.contractualType || reconciled.cipContractType
    || (isLegacySampleContractType && contractType === "Contractual" ? "Service Agreement" : "");
  const lifecycleStatus = trkLifecycleStatusForProposal(reconciled);
  const currentStage = trkCurrentStageForLifecycle(reconciled, lifecycleStatus);
  let actionPlan = reconciled.actionPlan;
  if (lifecycleStatus === "Completed") {
    actionPlan = "All tracker activities completed (LOA and Contract).";
  } else if (reconciled.lifecycleStatus === "Completed" && lifecycleStatus === "OnProgress") {
    actionPlan = currentStage ? `Continue the workflow from ${currentStage}.` : "Continue workflow through LOA and Contract.";
  }
  return {
    ...reconciled,
    proposalType: undefined,
    trackerContractType: undefined,
    cipContractType: undefined,
    contractType,
    contractualType,
    currency: reconciled.currency || reconciled.currencyCode || "IDR",
    lifecycleStatus,
    currentStage,
    actionPlan,
    readinessChecklist: trkBuildReadinessChecklist(reconciled),
  };
}
function trkNormalizeStore(store) {
  if (!store || !Array.isArray(store.proposals)) return store;
  return { ...store, proposals: store.proposals.map(trkNormalizeProposalLifecycle) };
}

function trkPdfEscape(value) { return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function trkBuildPdfDataUri(title, lines) {
  const commands = ["BT", "/F1 18 Tf", "48 760 Td", `(${trkPdfEscape(title)}) Tj`, "/F1 11 Tf"].concat(
    lines.flatMap((line) => ["0 -22 Td", `(${trkPdfEscape(line)}) Tj`]),
  ).concat(["ET"]).join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${commands.length} >>\nstream\n${commands}\nendstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o) => { offsets.push(pdf.length); pdf += o; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { pdf += `${String(off).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(unescape(encodeURIComponent(pdf)))}`;
}
function trkPdfTextWidth(text, size) {
  return String(text || "").split("").reduce((sum, char) => sum + (char === " " ? size * 0.28 : /[A-Z0-9]/.test(char) ? size * 0.62 : size * 0.5), 0);
}
function trkPdfWrapText(text, size, maxWidth) {
  const rows = [];
  String(text || "").replace(/\r/g, "").split("\n").forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      rows.push("");
      return;
    }
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (trkPdfTextWidth(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) rows.push(line);
        line = word;
      }
    });
    if (line) rows.push(line);
  });
  return rows.length ? rows : [""];
}
function trkBuildTemplatePdfDataUri(draw) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const commands = [];
  let y = pageHeight - margin;
  const text = (value, options) => {
    const opts = options || {};
    const size = opts.size || 9;
    const lineHeight = opts.lineHeight || 11;
    const maxWidth = opts.maxWidth || contentWidth;
    const font = opts.bold ? "F2" : "F1";
    const lines = trkPdfWrapText(value, size, maxWidth);
    lines.forEach((line) => {
      commands.push(`BT /${font} ${size} Tf 1 0 0 1 ${Number(opts.x == null ? margin : opts.x).toFixed(2)} ${Number(y - size).toFixed(2)} Tm (${trkPdfEscape(line)}) Tj ET`);
      y -= lineHeight;
    });
  };
  const spacer = (height) => { y -= height || 12; };
  const centered = (value, options) => {
    const opts = options || {};
    const size = opts.size || 15;
    const width = trkPdfTextWidth(value, size);
    text(value, { ...opts, x: (pageWidth - width) / 2, size, bold: opts.bold !== false, maxWidth: width + 4, lineHeight: opts.lineHeight || 18 });
  };
  const table = (rows, options) => {
    const labelWidth = (options && options.labelWidth) || 150;
    const colonWidth = 10;
    const valueWidth = contentWidth - labelWidth - colonWidth;
    rows.forEach((row) => {
      const labelLines = trkPdfWrapText(row.label, 9, labelWidth);
      const valueLines = trkPdfWrapText(row.value, 9, valueWidth);
      const count = Math.max(labelLines.length, valueLines.length, 1);
      for (let i = 0; i < count; i += 1) {
        if (labelLines[i]) commands.push(`BT /F1 9 Tf 1 0 0 1 ${margin.toFixed(2)} ${(y - 9).toFixed(2)} Tm (${trkPdfEscape(labelLines[i])}) Tj ET`);
        if (i === 0) commands.push(`BT /F1 9 Tf 1 0 0 1 ${(margin + labelWidth).toFixed(2)} ${(y - 9).toFixed(2)} Tm (:) Tj ET`);
        if (valueLines[i]) commands.push(`BT /F1 9 Tf 1 0 0 1 ${(margin + labelWidth + colonWidth).toFixed(2)} ${(y - 9).toFixed(2)} Tm (${trkPdfEscape(valueLines[i])}) Tj ET`);
        y -= 11;
      }
      y -= 2;
    });
  };
  draw({ text, spacer, centered, table, margin, contentWidth, pageWidth, get y() { return y; }, set y(value) { y = value; } });
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    `6 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object) => { offsets.push(pdf.length); pdf += object; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(unescape(encodeURIComponent(pdf)))}`;
}
function trkIndonesianLongDate(value) {
  const date = trkParse(value);
  if (!date) return value || "";
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function trkNormalizeRecommendedVendor(v, index, proposalId) {
  return {
    vendorId: (v && (v.vendorId || v.VendorId)) || (proposalId ? `MANUAL-${proposalId}-${index + 1}` : null),
    vendorName: (v && (v.vendorName || v.VendorName)) || "Vendor",
    director: (v && (v.director || v.Director)) || "",
    address: (v && (v.address || v.Address)) || "",
  };
}

function trkVendorsForProposal(proposalId) {
  // Vendors come from the proposal payload (E-Proposal ingest or Generate Sample Data → Vendor Database RGSTD).
  try {
    const store = trkReadStore();
    const proposal = (store.proposals || []).find((p) => p && p.id === proposalId);
    const fromSource = proposal && Array.isArray(proposal.recommendedVendors) ? proposal.recommendedVendors : null;
    if (fromSource && fromSource.length) {
      return fromSource.map((v, index) => trkNormalizeRecommendedVendor(v, index, proposalId));
    }
  } catch (e) {}
  return [];
}
function trkEvent(type, actorName, message, at) {
  return { id: trkUid("evt"), type, at: at || trkNow(), actorName, message };
}
function trkBuildActivities(proposal, startDate, timestamp, adjustedSla) {
  const stages = trkStageRows(proposal.trackerMethod);
  const adjustedDays = stages.map((stage) => {
    const value = adjustedSla && adjustedSla[stage.id] != null ? Number(adjustedSla[stage.id]) : stage.slaDays;
    return Math.max(0, Math.floor(Number.isFinite(value) ? value : stage.slaDays));
  });
  const targetDates = typeof trkCumulativeTargetDates === "function"
    ? trkCumulativeTargetDates(startDate, adjustedDays)
    : adjustedDays.reduce((rows, days, index) => {
      const prev = index === 0 ? startDate : rows[index - 1];
      rows.push(trkAddDays(prev, days));
      return rows;
    }, []);
  return stages.map((stage, index) => {
    const targetDate = targetDates[index];
    return {
      id: `${proposal.id}-a-${index + 1}`,
      stageId: stage.id,
      title: stage.name,
      owner: stage.owner,
      masterLeadDays: stage.slaDays,
      targetLeadDays: adjustedDays[index],
      targetDate,
      status: index === 0 ? "Pending" : "Locked",
      startedAt: index === 0 ? timestamp : undefined,
      evidenceCount: 0,
      evidenceNames: [],
      lockedReason: index === 0 ? undefined : "Complete the previous stage to unlock this activity.",
      history: [
        trkEvent("Created", proposal.ownerName, "Timeline created when proposal was distributed.", timestamp),
        ...(index === 0 ? [trkEvent("Started", proposal.assignedOfficerName || proposal.ownerName, "Stage started on distribution.", timestamp)] : []),
      ],
    };
  });
}
function trkTargetDatesFrom(anchorDate, leadDays) {
  const start = trkDatePart(anchorDate || TRK_TODAY);
  return typeof trkCumulativeTargetDates === "function"
    ? trkCumulativeTargetDates(start, leadDays)
    : leadDays.reduce((rows, days, index) => {
      const prev = index === 0 ? start : rows[index - 1];
      rows.push(trkAddDays(prev, days));
      return rows;
    }, []);
}
function trkDynamicEstimatedDate(proposal) {
  if (!proposal) return undefined;
  const activities = proposal.activities || [];
  let lastCompletedIndex = -1;
  activities.forEach((activity, index) => {
    if (activity.status === "Completed" && activity.completedAt) lastCompletedIndex = index;
  });
  if (lastCompletedIndex >= 0) {
    const remaining = activities.slice(lastCompletedIndex + 1);
    if (!remaining.length) return trkDatePart(activities[lastCompletedIndex].completedAt);
    const targets = trkTargetDatesFrom(activities[lastCompletedIndex].completedAt, remaining.map((activity) => activity.targetLeadDays || 0));
    if (targets.length) return targets[targets.length - 1];
  }
  const last = activities.filter((activity) => activity.targetDate).slice(-1)[0];
  return (last && last.targetDate) || (proposal.distribution && proposal.distribution.estimatedDate);
}
function trkDistributionApplied(proposal, params) {
  const startDate = params.startActivityDate || TRK_TODAY;
  const timestamp = params.timestamp || trkTimestamp(startDate, 9);
  const assignedOfficerName = params.assignedOfficerName || TRK_OFFICERS[0];
  const distributedByName = params.distributedByName || proposal.ownerName;
  const trackerMethod = params.trackerMethod || proposal.trackerMethod;
  const withOfficer = { ...proposal, assignedOfficerName, trackerMethod };
  const firstStage = trkStageRows(withOfficer.trackerMethod)[0] || { name: "Distributed" };
  const activities = trkBuildActivities(withOfficer, startDate, timestamp, params.adjustedSla || params.adjustedSlaDays);
  return {
    ...withOfficer,
    lifecycleStatus: "OnProgress",
    currentStage: firstStage.name,
    updatedAt: timestamp,
    agingDays: Math.max(1, trkDaysBetween(startDate, TRK_TODAY)),
    actionPlan: `Continue workflow from ${firstStage.name}.`,
    distribution: {
      distributedByName,
      distributedAt: timestamp,
      assignedOfficerName,
      startActivityDate: startDate,
      estimatedDate: activities.length ? activities[activities.length - 1].targetDate : startDate,
      adjustedSla: params.adjustedSla || params.adjustedSlaDays || null,
      strategy: params.strategy || "Assigned based on workload and category familiarity.",
    },
    activities,
  };
}
function trkCompleteActivityApplied(proposal, activityId, options) {
  const timestamp = options && options.at ? options.at : trkNow();
  const actor = (options && options.actorName) || proposal.assignedOfficerName || proposal.ownerName;
  const targetIndex = proposal.activities.findIndex((a) => a.id === activityId);
  if (targetIndex < 0) return proposal;
  const completedCode = trkActivityCode(proposal.activities[targetIndex]);
  const unlockParallel = completedCode === "TERM";
  const updatedActivities = proposal.activities.map((a, index) => {
    if (index === targetIndex && a.status === "Pending") {
      const evidenceNames = (options && options.evidenceNames) || [];
      const remarkText = options && Object.prototype.hasOwnProperty.call(options, "remark")
        ? String(options.remark || "")
        : `Completed ${a.title}.`;
      return {
        ...a,
        status: "Completed",
        startedAt: a.startedAt || timestamp,
        completedAt: timestamp,
        remark: remarkText || undefined,
        evidenceNames: evidenceNames,
        evidenceCount: evidenceNames.length,
        lockedReason: undefined,
        history: (a.history || []).concat([trkEvent("Completed", actor, remarkText.trim() || "Activity completed.", timestamp)]),
      };
    }
    if (unlockParallel && a.status === "Locked" && trkIsParallelPostTermCode(trkActivityCode(a))) {
      return {
        ...a,
        status: "Pending",
        startedAt: timestamp,
        lockedReason: undefined,
        history: (a.history || []).concat([trkEvent("Started", actor, "Opened in parallel after Term Sheet completion.", timestamp)]),
      };
    }
    if (!unlockParallel && index === targetIndex + 1 && a.status === "Locked") {
      return {
        ...a,
        status: "Pending",
        startedAt: timestamp,
        lockedReason: undefined,
        history: (a.history || []).concat([trkEvent("Started", actor, "Stage started after previous stage completion.", timestamp)]),
      };
    }
    return a;
  });
  // Plan dates (targetDate) are fixed at distribution and must NOT change when an activity is
  // updated/completed. Only the Estimated date is recomputed dynamically (see trkDynamicEstimatedDate).
  const activities = updatedActivities;
  const pendingRows = activities.filter((a) => a.status === "Pending");
  const stillOpen = activities.some((a) => a.status === "Pending" || a.status === "Locked");
  const estimatedDate = trkDynamicEstimatedDate({ ...proposal, activities });
  const currentLabel = pendingRows.length > 1
    ? pendingRows.map((a) => trkStageShortLabel(trkStageById(a.stageId)) || a.title).join(" · ")
    : (pendingRows[0] ? pendingRows[0].title : trkStageNameByCode("CTR"));
  return trkNormalizeProposalLifecycle({
    ...proposal,
    lifecycleStatus: stillOpen ? "OnProgress" : "Completed",
    currentStage: currentLabel,
    updatedAt: timestamp,
    activities,
    distribution: proposal.distribution ? { ...proposal.distribution, estimatedDate } : proposal.distribution,
    actionPlan: stillOpen
      ? (unlockParallel
        ? "Term Sheet done — LOA and Contract are open in parallel."
        : `Continue the workflow from ${currentLabel}.`)
      : "All tracker activities completed (LOA and Contract).",
  });
}
function trkLoaNumberForVendor(proposal, vendor) {
  const proposalSeq = parseInt(String((proposal && proposal.proposalNumber) || "").split("-").pop(), 10) || (trkHash(proposal && proposal.id) % 900);
  const vendors = trkSeedWinnerVendorsForProposal(proposal || {});
  const fallbackVendors = proposal && proposal.id ? trkVendorsForProposal(proposal.id) : [];
  const vendorPool = vendors.length ? vendors : fallbackVendors;
  const vendorIndex = Math.max(0, vendorPool.findIndex((row) => row.vendorId === (vendor && vendor.vendorId)));
  return `${100 + proposalSeq}-${trkPad(vendorIndex + 1)}/LOA/SIS-${proposal.jobsite}/PROC/VI/2026`;
}
function trkAwardSplitsForProposal(proposal) {
  const winners = trkSeedWinnerVendorsForProposal(proposal || {});
  if (!winners.length) return [];
  const percentages = trkNormalizeAwardPercentages(winners.length, proposal && proposal.multiWinnerPercentages);
  let allocated = 0;
  return winners.map((vendor, index) => {
    const percent = winners.length === 1 ? 100 : percentages[index];
    const value = index === winners.length - 1 ? Math.max(0, Math.round((proposal.amount || 0) - allocated)) : Math.round(((proposal.amount || 0) * percent) / 100);
    allocated += value;
    return { vendorId: vendor.vendorId, vendorName: vendor.vendorName, percent, value };
  });
}
function trkAwardSplitForVendor(proposal, vendor) {
  const split = trkAwardSplitsForProposal(proposal).find((row) => row.vendorId === (vendor && vendor.vendorId));
  return split || { vendorId: vendor && vendor.vendorId, vendorName: vendor && vendor.vendorName, percent: 100, value: proposal && proposal.amount ? proposal.amount : 0 };
}
function trkAwardSplitSummary(proposal) {
  return trkAwardSplitsForProposal(proposal).map((row) => `${row.vendorName} ${row.percent}% (${trkRp(row.value)})`).join("; ");
}
// Award splits over the ACTUAL bid-evaluation winners (winnerVendorIds), not the count-based seed
// winners trkAwardSplitsForProposal derives. Explicit winner VALUE (> 0) wins for one or many
// winners so a negotiated amount can differ from the proposal VALUE. Fallback still uses the
// proposal amount when a winner VALUE is missing. Same percentage/rounding rule (remainder on the last).
function trkAwardSplitsForWinners(proposal, winnerVendorIds, winnerValues) {
  const pool = proposal && proposal.id ? trkVendorsForProposal(proposal.id) : [];
  const winners = (winnerVendorIds || []).map((id) => pool.find((v) => v.vendorId === id)).filter(Boolean);
  if (!winners.length) return [];
  const explicit = winnerValues && winners.every((vendor) => Number(winnerValues[vendor.vendorId]) > 0);
  if (explicit) {
    const values = winners.map((vendor) => Math.max(0, Math.round(Number(winnerValues[vendor.vendorId]) || 0)));
    const sum = values.reduce((total, value) => total + value, 0);
    let usedPercent = 0;
    return winners.map((vendor, index) => {
      const value = values[index];
      const percent = sum <= 0
        ? 0
        : (index === winners.length - 1 ? Math.max(0, 100 - usedPercent) : Math.round((value / sum) * 100));
      if (index < winners.length - 1) usedPercent += percent;
      return { vendorId: vendor.vendorId, vendorName: vendor.vendorName, address: vendor.address, percent, value };
    });
  }
  const percentages = trkNormalizeAwardPercentages(winners.length, proposal && proposal.multiWinnerPercentages);
  let allocated = 0;
  return winners.map((vendor, index) => {
    const percent = winners.length === 1 ? 100 : percentages[index];
    const value = index === winners.length - 1
      ? Math.max(0, Math.round((proposal.amount || 0) - allocated))
      : Math.round(((proposal.amount || 0) * percent) / 100);
    allocated += value;
    return { vendorId: vendor.vendorId, vendorName: vendor.vendorName, address: vendor.address, percent, value };
  });
}
// Build the PUT /award-result body from the commercial outcome. This is the domain hand-off that
// lets CIP read the award result via ITrackerBidEvaluationReadPort — winners only; scores/bid prices
// are not captured in the tracker UI so they stay null. `source` tags where the outcome was decided:
// "BidEvaluation" (Tender / Pemilihan Langsung, on completing the Bid Evaluation activity) or
// "Negotiation" (Penunjukan Langsung, which has no Bid Evaluation — decided at Negotiation).
function trkBuildAwardResultRequest(proposal, winnerVendorIds, actorName, source, evaluationRows, winnerValues) {
  const method = trkMethodById(proposal && proposal.trackerMethod);
  const splits = trkAwardSplitsForWinners(proposal, winnerVendorIds, winnerValues);
  const splitById = Object.fromEntries(splits.map((row) => [row.vendorId, row]));
  const evalById = Object.fromEntries((evaluationRows || []).map((row) => [row.vendorId, row]));
  const pool = evaluationRows && evaluationRows.length
    ? evaluationRows
    : splits;
  const vendors = pool.map((row) => {
    const split = splitById[row.vendorId] || {};
    const extra = evalById[row.vendorId] || {};
    const isWinner = (winnerVendorIds || []).some((id) => String(id) === String(row.vendorId)) || extra.isWinner === true;
    const awardValue = isWinner
      ? (Number(split.value) || Number(extra.negotiatedValue) || Number(extra.bidPrice) || Number(proposal && proposal.amount) || 0)
      : 0;
    const awardPercent = isWinner ? (Number(split.percent) || 100) : 0;
    return {
      vendorId: row.vendorId,
      vendorName: row.vendorName || extra.vendorName,
      bidPrice: extra.bidPrice != null ? extra.bidPrice : null,
      technicalScore: extra.technicalScore != null ? extra.technicalScore : null,
      commercialScore: extra.commercialScore != null ? extra.commercialScore : null,
      totalScore: extra.totalScore != null ? extra.totalScore : null,
      rank: extra.rank != null ? extra.rank : null,
      negotiatedValue: extra.negotiatedValue != null ? extra.negotiatedValue : (isWinner ? awardValue : null),
      awardValue,
      awardPercent,
      isWinner,
      payloadJson: JSON.stringify({
        awardPercent,
        awardValue,
        vendorName: row.vendorName || extra.vendorName,
        vendorAddress: extra.address || split.address || "",
        procurementSubject: (proposal && proposal.title) || "",
        jobsite: (proposal && proposal.jobsite) || "",
        proposalNumber: (proposal && proposal.proposalNumber) || "",
      }),
    };
  });
  return {
    source: source || "BidEvaluation",
    method: (method && method.name) || null,
    evaluatedBy: actorName || null,
    notes: null,
    vendors,
    payloadJson: JSON.stringify({
      proposalNumber: (proposal && proposal.proposalNumber) || "",
      title: (proposal && proposal.title) || "",
      amount: (proposal && proposal.amount) || 0,
      winnerCount: vendors.length,
    }),
  };
}
// PUT the award result to the domain. Unlike the fire-and-forget trkDomainPost mirrors, this is
// awaited and returns a status so the caller can surface a non-fatal warning: the KV write already
// succeeded, but CIP depends on this row landing in trk.AWARD_RESULT_*.
async function trkSaveAwardResult(proposalId, body) {
  try {
    const res = await fetch(`/api/v1/proposal-tracker/award-result?proposalId=${encodeURIComponent(proposalId)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.warn("Tracker award-result save failed.", e);
    return { ok: false, status: 0 };
  }
}
/** Match a Term Sheet / Contract case for a proposal (optional winner). */
async function trkResolveTermSheetCaseId(proposalId, vendorId) {
  try {
    const res = await fetch("/api/v1/contract-initiation-platform/cases", { credentials: "include" });
    if (!res.ok) return null;
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : [];
    const pid = String(proposalId || "").toLowerCase();
    const vid = vendorId != null && vendorId !== "" ? String(vendorId).toLowerCase() : "";
    const matches = list.filter((row) => String(row.proposalKey || row.ProposalKey || "").toLowerCase() === pid);
    const picked = vid
      ? (matches.find((row) => String(row.vendorId || row.VendorId || "").toLowerCase() === vid) || matches[0])
      : matches[0];
    if (!picked) return null;
    return picked.caseKey || picked.CaseKey || picked.id || null;
  } catch (e) {
    console.warn("Term Sheet case resolve failed.", e);
    return null;
  }
}
function trkIsCipCaseKey(value) {
  return /^CIP-/i.test(String(value || "").trim());
}
/** Open Term Sheet / Contract on the Proposals workspace. Warns when the award has not created a case yet. */
async function trkOpenTermSheetWorkflow(onNavigate, toast, tt, proposalId, vendorId, onOpenCipCase) {
  const options = onNavigate && typeof onNavigate === "object" && !Array.isArray(onNavigate)
    ? onNavigate
    : { onNavigate, toast, tt, proposalId, vendorId, onOpenCipCase };
  const navigate = options.onNavigate;
  const openCase = options.onOpenCipCase;
  const notify = options.toast;
  const text = options.tt;
  const caseId = await trkResolveTermSheetCaseId(options.proposalId, options.vendorId);
  if (caseId) {
    if (typeof openCase === "function") {
      openCase(caseId, options.proposalId);
      return true;
    }
    if (typeof navigate === "function") {
      navigate("trackerProposals", caseId);
      return true;
    }
  }
  if (notify && notify.push) {
    notify.push({
      title: text ? text("Term Sheet not ready", "Term Sheet belum siap") : "Term Sheet not ready",
      description: text
        ? text("Complete Bid Evaluation or Negotiation first so a Term Sheet case can be opened.", "Selesaikan Bid Evaluation atau Negotiation dulu agar kasus Term Sheet bisa dibuka.")
        : "Complete Bid Evaluation or Negotiation first so a Term Sheet case can be opened.",
      tone: "warning",
    });
  }
  return false;
}
/** Create CIP Term Sheet case(s) from the persisted award (BidEvaluation or Negotiation). */
async function trkCreateCipCasesFromAward(proposalId, actorName, type) {
  try {
    const res = await fetch(`/api/v1/proposal-tracker/finalize-award?proposalId=${encodeURIComponent(proposalId)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorName: actorName || null, type: type || null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, status: res.status, code: err && err.code, data: null };
    }
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (e) {
    console.warn("CIP create-from-award failed.", e);
    return { ok: false, status: 0, data: null };
  }
}
function trkBuildLoaDocument(proposal, vendor, generatedAt, payload) {
  const data = payload || {};
  const award = trkAwardSplitForVendor(proposal, vendor);
  const loaNumber = data.loaNumber || trkLoaNumberForVendor(proposal, vendor);
  const letterDate = data.letterDate ? trkIndonesianLongDate(data.letterDate) : trkIndonesianLongDate(generatedAt);
  const vendorName = data.vendorName || vendor.vendorName;
  const vendorAddress = data.vendorAddress || vendor.address || "-";
  const procurementSubject = data.procurementSubject || proposal.title;
  const letterSubject = data.letterSubject || `Surat Penetapan Kerja Sama ${procurementSubject}`;
  const attachmentDescription = data.attachmentDescription || "1 (satu) set";
  const sisSignatoryName = data.sisSignatoryName || proposal.ownerName;
  const sisSignatoryTitle = data.sisSignatoryTitle || "Section Head Procurement";
  const vendorDirectorName = data.vendorDirectorName || vendor.director;
  const vendorDirectorTitle = data.vendorDirectorTitle || "Direktur";
  const vendorRecipientTitle = data.vendorRecipientTitle || "Direktur";
  const awardPercent = data.awardPercent != null ? Number(data.awardPercent) : award.percent;
  const awardValue = data.awardValue != null ? Number(data.awardValue) : award.value;
  const attachmentFiles = (data.attachmentFiles || []).map((file) => file.name || file.fileName || String(file)).filter(Boolean);
  const termsheetNumber = data.termsheetNumber || "";
  const scope = data.scope || procurementSubject;
  const periodText = data.periodText || "Mengacu pada Term Sheet yang telah disetujui.";
  const paymentTerms = [data.termOfPayment, data.paymentMethod].filter(Boolean).join(" - ") || "Mengacu pada Term Sheet yang telah disetujui.";
  const title = `LOA_${proposal.proposalNumber}_${vendor.vendorId}.pdf`;
  return {
    fileName: title,
    vendorName,
    awardPercent,
    awardValue,
    loaNumber,
    letterDate,
    payload: {
      loaNumber,
      letterDate: data.letterDate || generatedAt,
      awardPercent,
      awardValue,
      vendorName,
      vendorAddress,
      procurementSubject,
      letterSubject,
      attachmentDescription,
      sisSignatoryName,
      sisSignatoryTitle,
      vendorRecipientTitle,
      vendorDirectorName,
      vendorDirectorTitle,
      termsheetCaseKey: data.termsheetCaseKey || "",
      termsheetNumber,
      termsheetCompletedAt: data.termsheetCompletedAt || "",
      termsheetDocument: data.termsheetDocument || null,
      scope,
      periodText,
      termOfPayment: data.termOfPayment || "",
      paymentMethod: data.paymentMethod || "",
      attachmentFiles,
    },
    generatedAt,
    dataUri: trkBuildTemplatePdfDataUri(({ text, spacer, centered, table, margin, contentWidth }) => {
      centered("LETTER OF AWARD", { size: 15 });
      spacer(12);
      table([
        { label: "No", value: loaNumber },
        { label: "Tanggal", value: letterDate },
        { label: "Kepada", value: vendorName },
        { label: "Dari", value: "PT Saptaindra Sejati" },
        { label: "Perihal", value: letterSubject },
        { label: "Lampiran", value: attachmentDescription },
        { label: "Referensi Term Sheet", value: termsheetNumber || "Term Sheet selesai di CIP" },
      ], { labelWidth: 60 });
      spacer(10);
      text("Kepada Yth,", { x: margin });
      text(vendorRecipientTitle.trim() || "Direktur", { x: margin });
      text(vendorName, { x: margin });
      text(vendorAddress, { x: margin, maxWidth: contentWidth });
      spacer(10);
      text("Dengan Hormat,", { x: margin });
      spacer(4);
      text(`Sehubungan dengan telah dilaksanakannya proses pengadaan ${procurementSubject}, bersama ini kami sampaikan bahwa PT Saptaindra Sejati telah melakukan evaluasi terhadap dokumen penawaran dari ${vendorName}.`, { x: margin, maxWidth: contentWidth });
      spacer(8);
      text(`Berdasarkan hasil evaluasi tersebut, dengan ini kami umumkan pemenang ${procurementSubject} sebagai berikut:`, { x: margin, maxWidth: contentWidth });
      spacer(10);
      centered("PEMENANG", { size: 10 });
      spacer(6);
      table([
        { label: "Nama Penyedia Barang dan/atau Jasa", value: vendorName },
        { label: "Alamat", value: vendorAddress },
        { label: "Jenis Pengadaan/Jasa", value: procurementSubject },
        { label: "Ruang Lingkup Jasa", value: scope },
        { label: "Porsi Pekerjaan", value: `${awardPercent}% dari nilai rekomendasi pemenang` },
        { label: "Periode/Jangka Waktu", value: periodText },
        { label: "Daftar Barang dan Harga (IDR)", value: `Mengacu pada lampiran PDF yang diikutsertakan. Nilai referensi vendor ini: ${trkRp(awardValue)}.` },
        { label: "Syarat dan Ketentuan Lain", value: paymentTerms },
      ], { labelWidth: 170 });
      spacer(6);
      text("Dokumen ini kami terbitkan dan berlakukan setelah mendapatkan persetujuan dari kedua belah pihak yang akan mengikuti sebagai sebuah kesepakatan dan akan menjadi kesatuan setelah diterbitkan Kontrak dan Purchase Order (PO).", { x: margin, maxWidth: contentWidth });
      spacer(8);
      text("Demikian surat ini kami sampaikan untuk dapat dipergunakan sebagaimana mestinya. Terima kasih atas partisipasi dan kerjasamanya selama proses pengadaan berlangsung.", { x: margin, maxWidth: contentWidth });
      spacer(20);
      text("Hormat kami,", { x: margin });
      text("PT SAPTAINDRA SEJATI", { x: margin, bold: true });
      spacer(50);
      text(sisSignatoryName, { x: margin, bold: true });
      text(sisSignatoryTitle, { x: margin });
      spacer(18);
      text("Tanda Terima:", { x: margin });
      text(String(vendorName).toUpperCase(), { x: margin, bold: true });
      spacer(42);
      text(vendorDirectorName, { x: margin, bold: true });
      text(vendorDirectorTitle, { x: margin });
    }),
  };
}

function trkSeedWinnerVendorsForProposal(proposal) {
  const vendors = trkVendorsForProposal(proposal.id);
  const count = Math.max(1, Math.min(vendors.length, Number(proposal.multiWinnerVendorCount || 1)));
  return vendors.slice(0, count);
}

function trkReadStore() {
  trkClearLegacyStoreKeys();
  try {
    const raw = window.__procurementStorage.getItem(TRACKER_STORE_KEY);
    if (raw) return trkNormalizeStore(JSON.parse(raw));
  } catch (e) {}
  // No mockup seed: the Tracker is backend-driven. When the backend has no proposals yet,
  // start from an empty store. Data is created only by real actions (which persist to the DB).
  return trkNormalizeStore({ proposals: [], loaDocuments: {} });
}
function trkWriteStore(store) {
  const normalized = trkNormalizeStore(store);
  try { window.__procurementStorage.setItem(TRACKER_STORE_KEY, JSON.stringify(normalized)); } catch (e) {}
  window.dispatchEvent(new CustomEvent(TRACKER_EVENT, { detail: normalized }));
  return normalized;
}
async function trkFlushProcurementStorage() {
  const storage = typeof window !== "undefined" ? window.__procurementStorage : null;
  if (storage && typeof storage.flushPendingWrites === "function") {
    await storage.flushPendingWrites();
  }
}
function trkApiPart(value) { return encodeURIComponent(String(value || "")); }
function trkProposalCommandPath(command, proposalId, forPersonnelNo) {
  const scope = trkAssignableScopeKey(forPersonnelNo);
  const qs = scope ? `&forPersonnelNo=${encodeURIComponent(scope)}` : "";
  return `/api/v1/proposal-tracker/${command}?proposalId=${trkApiPart(proposalId)}${qs}`;
}
function trkActivityCommandPath(proposalId, activityId, command) {
  return `/api/v1/proposal-tracker/activities/${command}?proposalId=${trkApiPart(proposalId)}&activityId=${trkApiPart(activityId)}`;
}
function trkNormalizeApiTimestamps(body) {
  if (!body || typeof body !== "object") return body;
  const next = { ...body };
  ["completedAt", "generatedAt", "occurredAt", "startedAt"].forEach((key) => {
    if (next[key] == null || next[key] === "") return;
    const parsed = new Date(String(next[key]).replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) next[key] = parsed.toISOString();
  });
  return next;
}
function trkDomainPost(path, body) {
  try {
    const requestBody = body ? trkNormalizeApiTimestamps(body) : body;
    fetch(path, {
      method: "POST",
      credentials: "include",
      headers: requestBody ? { "Content-Type": "application/json" } : undefined,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    }).catch((e) => console.warn("Tracker domain API command failed.", e));
  } catch (e) {}
}
function trkUpdateStore(mutator) {
  const store = trkReadStore();
  const next = mutator(trkClone(store)) || store;
  return trkWriteStore(next);
}
function useTrackerStore() {
  const [store, setStore] = React.useState(() => trkReadStore());
  React.useEffect(() => {
    const h = (e) => setStore(e.detail || trkReadStore());
    window.addEventListener(TRACKER_EVENT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(TRACKER_EVENT, h); window.removeEventListener("storage", h); };
  }, []);
  return store;
}
function trkResetStore() {
  trkClearAuxiliaryStoreKeys();
  // Reset clears tracker data back to empty (no mockup seed); real data is rebuilt from actions.
  return trkWriteStore({ proposals: [], loaDocuments: {} });
}

// Map a domain proposal summary (GET /proposals) into the KV store shape. Ingested E-Proposal rows
// arrive as ReadyToDistribute with no activities (built at distribution). proposalKey → id.
function trkProposalFromDomain(r) {
  const vendors = Array.isArray(r.recommendedVendors) ? r.recommendedVendors : [];
  const activities = Array.isArray(r.activities) ? r.activities.map((activity) => trkActivityFromDomain(activity)) : [];
  const estimatedActivity = activities.filter((activity) => activity.targetDate).slice(-1)[0];
  return {
    id: r.proposalKey,
    proposalNumber: r.proposalNumber,
    title: r.title || r.proposalNumber,
    aribaId: r.aribaId || "",
    commodity: r.commodity || "",
    jobsite: r.jobsite || "",
    department: r.department || "",
    contractType: r.contractType || r.trackerContractType || r.proposalType || "",
    contractualType: r.contractualType || r.cipContractType || "",
    sourceProposalId: r.sourceProposalId || r.eproposalId || "",
    currency: r.currency || r.currencyCode || "IDR",
    amount: r.amount || 0,
    trackerMethod: r.trackerMethod || (TRK_METHODS[0] && TRK_METHODS[0].id) || "TM-1",
    lifecycleStatus: r.lifecycleStatus || "ReadyToDistribute",
    currentStage: r.currentStage || "",
    priority: r.priority || "Normal",
    ownerName: r.ownerName || "",
    assignedOfficerName: r.assignedOfficerName || "",
    requirementDate: r.requirementDate || "",
    agingDays: r.agingDays || 0,
    slaDays: r.slaDays || 0,
    overdueDays: r.overdueDays || 0,
    recommendedVendors: vendors.map((v) => ({
      vendorId: (v && (v.vendorId || v.VendorId)) || null,
      vendorName: (v && (v.vendorName || v.VendorName)) || "",
      director: (v && (v.director || v.Director)) || "",
      address: (v && (v.address || v.Address)) || "",
    })),
    source: r.source || (String(r.proposalKey || "").indexOf("/SMP") >= 0 ? "sample" : ""),
    sampleMaterials: Array.isArray(r.sampleMaterials) ? r.sampleMaterials : [],
    distribution: activities.length ? { estimatedDate: (estimatedActivity && estimatedActivity.targetDate) || "" } : undefined,
    activities,
  };
}
function trkActivityFromDomain(activity, existing) {
  const current = existing || {};
  return {
    ...current,
    id: activity.activityKey,
    stageId: activity.stageId,
    title: activity.title,
    owner: activity.owner,
    status: activity.status,
    masterLeadDays: activity.masterLeadDays,
    targetLeadDays: activity.targetLeadDays,
    targetDate: activity.targetDate || undefined,
    startedAt: activity.startedAt || undefined,
    completedAt: activity.completedAt || undefined,
    evidenceCount: activity.evidenceCount || 0,
    lockedReason: activity.lockedReason || undefined,
    evidenceNames: Array.isArray(current.evidenceNames) ? current.evidenceNames : [],
    history: Array.isArray(current.history) ? current.history : [],
  };
}
function trkLoaDocumentFromDomain(document) {
  let envelope = {};
  try { envelope = document && document.payloadJson ? JSON.parse(document.payloadJson) : {}; } catch (e) {}
  const payload = envelope.payload || envelope.Payload || {};
  return {
    id: `${document.activityKey}-${document.vendorId}`,
    fileName: document.fileName,
    vendorName: document.vendorName,
    vendorId: document.vendorId,
    loaNumber: document.loaNumber,
    awardValue: Number(document.awardValue) || 0,
    awardPercent: Number(document.awardPercent) || 0,
    generatedAt: document.generatedAt || envelope.generatedAt || envelope.GeneratedAt,
    completedAt: envelope.completedAt || envelope.CompletedAt || payload.completedAt || payload.CompletedAt || null,
    completedRemark: envelope.completedRemark || envelope.CompletedRemark || payload.completedRemark || null,
    container: envelope.container || envelope.Container || null,
    blobKey: envelope.blobKey || envelope.BlobKey || null,
    payload,
  };
}
async function trkDomainWorkflowForProposal(proposalId) {
  try {
    const res = await fetch(`/api/v1/proposal-tracker/proposal-detail?proposalId=${encodeURIComponent(proposalId)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const detail = await res.json();
    return detail && Array.isArray(detail.activities) ? detail : null;
  } catch (e) {
    console.warn("Tracker workflow reconciliation failed.", e);
    return null;
  }
}
let __trkDomainHydrated = false;
// Merge domain proposals (e.g. ingested from E-Proposal) into the KV store, adding only those not
// already present by id — KV workflow progress always wins. Persisting the merge also lands them
// in the KV blob so backend projection keeps them.
async function trkHydrateFromDomain(force) {
  if (__trkDomainHydrated && !force) return { added: 0 };
  __trkDomainHydrated = true;
  try {
    const res = await fetch("/api/v1/proposal-tracker/proposals", { credentials: "include", headers: { Accept: "application/json" } });
    if (!res.ok) return { added: 0 };
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return { added: 0 };
    const current = trkReadStore();
    const byId = new Set((current.proposals || []).map((p) => p.id));
    const byKey = Object.fromEntries(rows.filter((r) => r && r.proposalKey).map((r) => [r.proposalKey, r]));
    const additions = rows.filter((r) => r && r.proposalKey && !byId.has(r.proposalKey)).map(trkProposalFromDomain);
    // Fetch detail only when the domain workflow disagrees with the cached list state. This keeps
    // normal hydration cheap while making CIP-originated completions durable across browsers.
    const staleIds = (current.proposals || []).filter((p) => {
      const domain = p && byKey[p.id];
      if (!domain || Array.isArray(domain.activities) || !(p.activities || []).length) return false;
      return String(domain.lifecycleStatus || "") !== String(p.lifecycleStatus || "")
        || String(domain.currentStage || "") !== String(p.currentStage || "");
    }).map((p) => p.id);
    const workflowDetails = await Promise.all(staleIds.map(trkDomainWorkflowForProposal));
    const workflowById = Object.fromEntries(workflowDetails.filter(Boolean).map((detail) => [detail.proposal.proposalKey, detail]));
    trkUpdateStore((store) => {
      store.proposals = (store.proposals || []).map((p) => {
        // Refresh source fields for ReadyToDistribute only — never clobber in-progress workflow state.
        if (p && p.lifecycleStatus === "ReadyToDistribute" && byKey[p.id]) {
          const mapped = trkProposalFromDomain(byKey[p.id]);
          return { ...p, ...mapped, activities: mapped.activities.length ? mapped.activities : (Array.isArray(p.activities) ? p.activities : []) };
        }
        if (p && byKey[p.id]) {
          const mapped = trkProposalFromDomain(byKey[p.id]);
          const workflow = workflowById[p.id];
          const currentActivities = Array.isArray(p.activities) ? p.activities : [];
          const currentById = Object.fromEntries(currentActivities.filter(Boolean).map((activity) => [activity.id, activity]));
          const domainActivities = mapped.activities.length
            ? mapped.activities.map((activity) => ({ ...currentById[activity.id], ...activity, history: (currentById[activity.id] && currentById[activity.id].history) || activity.history || [] }))
            : null;
          return {
            ...p,
            trackerMethod: mapped.trackerMethod || p.trackerMethod,
            sourceProposalId: mapped.sourceProposalId || p.sourceProposalId || "",
            currency: mapped.currency || p.currency || "IDR",
            source: mapped.source || p.source || "",
            sampleMaterials: (mapped.sampleMaterials && mapped.sampleMaterials.length)
              ? mapped.sampleMaterials
              : (p.sampleMaterials || []),
            lifecycleStatus: workflow || domainActivities ? mapped.lifecycleStatus : p.lifecycleStatus,
            currentStage: workflow || domainActivities ? mapped.currentStage : p.currentStage,
            distribution: mapped.distribution ? { ...(p.distribution || {}), ...mapped.distribution } : p.distribution,
            activities: domainActivities || (workflow
              ? workflow.activities.map((activity) => trkActivityFromDomain(activity, currentById[activity.activityKey]))
              : currentActivities),
          };
        }
        return p;
      }).concat(additions);
      rows.forEach((row) => {
        if (!row || !row.proposalKey || !Array.isArray(row.loaDocuments)) return;
        row.loaDocuments.forEach((document) => {
          const mapped = trkLoaDocumentFromDomain(document);
          store.loaDocuments[row.proposalKey] = store.loaDocuments[row.proposalKey] || {};
          store.loaDocuments[row.proposalKey][document.activityKey] = store.loaDocuments[row.proposalKey][document.activityKey] || {};
          store.loaDocuments[row.proposalKey][document.activityKey][document.vendorId] = mapped;
        });
      });
      return store;
    });
    return { added: additions.length };
  } catch (e) {
    console.warn("Tracker domain hydration failed.", e);
    return { added: 0 };
  }
}
/** Replace the in-memory tracker store with the shared server KV. Table refresh must not merge
 *  GET /proposals into a stale login snapshot — that keeps Officer activities unchanged (and can
 *  overwrite a Section Head recycle). Full page reload works because hydrate() re-GETs this key. */
async function trkReloadStoreFromServer() {
  const storage = typeof window !== "undefined" ? window.__procurementStorage : null;
  if (storage && typeof storage.refreshItem === "function") {
    await storage.refreshItem(TRACKER_STORE_KEY);
  }
  const next = trkReadStore();
  window.dispatchEvent(new CustomEvent(TRACKER_EVENT, { detail: next }));
  return next;
}
async function trkSyncEproposal() {
  try {
    const res = await fetch("/api/v1/proposal-tracker/ingest/eproposal", { method: "POST", credentials: "include" });
    const body = res.ok ? await res.json().catch(() => null) : null;
    const hydrated = await trkHydrateFromDomain(true);
    return { ok: res.ok, status: res.status, result: body, added: hydrated.added };
  } catch (e) {
    console.warn("E-Proposal sync failed.", e);
    return { ok: false, status: 0, result: null, added: 0 };
  }
}
async function trkGenerateSampleData(items, forPersonnelNo) {
  try {
    const qs = forPersonnelNo ? `?forPersonnelNo=${encodeURIComponent(forPersonnelNo)}` : "";
    const res = await fetch(`/api/v1/proposal-tracker/sample-data${qs}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined,
      body: JSON.stringify({
        items: (items || []).map((row) => ({
          trackerMethod: row.trackerMethod,
          requirementDate: row.requirementDate,
          totalVendor: Number(row.totalVendor) || 0,
          amount: Number(row.amount) > 0 ? Number(row.amount) : null,
          assignedOfficerName: row.assignedOfficerName || null,
          lastStepCode: row.lastStepCode || null,
        })),
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, result: body, added: 0, proposals: [] };
    }
    const hydrated = await trkHydrateFromDomain(true);
    return {
      ok: true,
      status: res.status,
      result: body,
      added: (body && body.created) || hydrated.added || 0,
      proposals: (body && body.proposals) || [],
    };
  } catch (e) {
    console.warn("Sample data generate failed.", e);
    return { ok: false, status: 0, result: null, added: 0, proposals: [] };
  }
}

function trkMutateProposal(proposalId, fn) {
  return trkUpdateStore((store) => {
    store.proposals = store.proposals.map((p) => p.id === proposalId ? fn(p, store) : p);
    return store;
  });
}
function trkDistributeProposal(proposalId, params) {
  const result = trkMutateProposal(proposalId, (p) => p.lifecycleStatus === "ReadyToDistribute" ? trkDistributionApplied(p, params || {}) : p);
  trkDomainPost(trkProposalCommandPath("distribute", proposalId, params && params.forPersonnelNo), params || {});
  return result;
}
function trkUpdateProposalAribaId(proposalId, aribaId) {
  const nextAriba = String(aribaId || "").trim();
  const result = trkMutateProposal(proposalId, (p) => ({ ...p, aribaId: nextAriba }));
  try {
    fetch(trkProposalCommandPath("ariba-id", proposalId), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aribaId: nextAriba || null }),
    }).catch((e) => console.warn("Tracker Ariba ID update failed.", e));
  } catch (e) {}
  return result;
}
function trkReassignProposalOfficer(proposalId, assignedOfficerName, actorName, reason, forPersonnelNo) {
  const result = trkMutateProposal(proposalId, (p) => {
    const lifecycleStatus = trkLifecycleStatusForProposal(p);
    const nextOfficer = String(assignedOfficerName || "").trim();
    if (lifecycleStatus !== "OnProgress" || !nextOfficer || nextOfficer === p.assignedOfficerName) return p;
    const at = trkNow();
    const actor = actorName || p.ownerName || p.assignedOfficerName;
    const previousOfficer = p.assignedOfficerName || "-";
    const message = reason
      ? `Responsibility moved from ${previousOfficer} to ${nextOfficer}. Reason: ${reason}`
      : `Responsibility moved from ${previousOfficer} to ${nextOfficer}.`;
    let eventPlaced = false;
    const activities = (p.activities || []).map((activity) => {
      if (!eventPlaced && activity.status === "Pending") {
        eventPlaced = true;
        return { ...activity, history: (activity.history || []).concat([trkEvent("Reassigned", actor, message, at)]) };
      }
      return activity;
    });
    const finalActivities = eventPlaced || !activities.length
      ? activities
      : activities.map((activity, index) => index === activities.length - 1 ? { ...activity, history: (activity.history || []).concat([trkEvent("Reassigned", actor, message, at)]) } : activity);
    return {
      ...p,
      assignedOfficerName: nextOfficer,
      distribution: p.distribution ? { ...p.distribution, assignedOfficerName: nextOfficer } : p.distribution,
      updatedAt: at,
      actionPlan: `Responsibility reassigned to ${nextOfficer}. Continue workflow from ${p.currentStage}.`,
      activities: finalActivities,
    };
  });
  trkDomainPost(trkProposalCommandPath("reassign-officer", proposalId, forPersonnelNo), { assignedOfficerName, actorName, reason });
  return result;
}
function trkClockInActivity(proposalId, activityId, actorName, at) {
  const timestamp = at || trkNow();
  const result = trkMutateProposal(proposalId, (p) => ({
    ...p,
    updatedAt: timestamp,
    activities: p.activities.map((a) => a.id === activityId && a.status === "Pending"
      ? { ...a, startedAt: a.startedAt && !at ? a.startedAt : timestamp, history: (a.history || []).concat([trkEvent("Started", actorName || p.assignedOfficerName || p.ownerName, "Activity clock-in captured.", timestamp)]) }
      : a),
  }));
  trkDomainPost(trkActivityCommandPath(proposalId, activityId, "clock-in"), { actorName });
  return result;
}
function trkCompleteActivityLocal(proposalId, activityId, payload) {
  return trkMutateProposal(proposalId, (p, store) => trkCompleteActivityApplied(p, activityId, payload || {}));
}
function trkUnlockParallelAfterTerm(proposalId, actorName, at) {
  const timestamp = at || trkNow();
  return trkMutateProposal(proposalId, (p) => {
    const actor = actorName || p.assignedOfficerName || p.ownerName;
    const updatedActivities = (p.activities || []).map((a) => {
      if (a.status === "Locked" && trkIsParallelPostTermCode(trkActivityCode(a))) {
        return {
          ...a,
          status: "Pending",
          startedAt: a.startedAt || timestamp,
          lockedReason: undefined,
          history: (a.history || []).concat([trkEvent("Started", actor, "Opened in parallel after Term Sheet progress.", timestamp)]),
        };
      }
      return a;
    });
    const pendingRows = updatedActivities.filter((a) => a.status === "Pending");
    const stillOpen = updatedActivities.some((a) => a.status === "Pending" || a.status === "Locked");
    const estimatedDate = trkDynamicEstimatedDate({ ...p, activities: updatedActivities });
    const currentLabel = pendingRows.length > 1
      ? pendingRows.map((a) => trkStageShortLabel(trkStageById(a.stageId)) || a.title).join(" · ")
      : (pendingRows[0] ? pendingRows[0].title : trkStageNameByCode("CTR"));
    return trkNormalizeProposalLifecycle({
      ...p,
      lifecycleStatus: stillOpen ? "OnProgress" : "Completed",
      currentStage: currentLabel,
      updatedAt: timestamp,
      activities: updatedActivities,
      distribution: p.distribution ? { ...p.distribution, estimatedDate } : p.distribution,
      actionPlan: "Term Sheet in progress — LOA and Contract are open for winners who completed Term Sheet.",
    });
  });
}
async function trkCompleteActivity(proposalId, activityId, payload) {
  const requestBody = trkNormalizeApiTimestamps({ ...(payload || {}) });
  const response = await fetch(trkActivityCommandPath(proposalId, activityId, "complete"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.code || `Activity completion failed (${response.status}).`);
  }
  return trkCompleteActivityLocal(proposalId, activityId, payload);
}
async function trkUploadDocument(file, opts) {
  const form = new FormData();
  form.append("file", file);
  if (opts && opts.entityId) form.append("entityId", String(opts.entityId));
  if (opts && opts.docType) form.append("docType", String(opts.docType));
  const res = await fetch("/api/v1/documents/proposal-tracker/upload", { method: "POST", credentials: "include", body: form });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error((payload && (payload.title || payload.code)) || `Upload failed (${res.status})`);
  }
  return res.json();
}
async function trkUploadDataUri(dataUri, fileName, opts) {
  const blob = await (await fetch(dataUri)).blob();
  const file = new File([blob], fileName || "document.pdf", { type: blob.type || "application/pdf" });
  return trkUploadDocument(file, opts);
}
async function trkGenerateLoaDocument(proposalId, activityId, vendorId, actorName, payload) {
  const snapshot = trkReadStore();
  const sp = snapshot.proposals.find((x) => x.id === proposalId);
  const sa = sp && (sp.activities || []).find((x) => x.id === activityId);
  const sVendor = sp && trkVendorsForProposal(sp.id).find((x) => x.vendorId === vendorId);
  if (!sp || !sa || !sVendor || sa.stageId !== trkStageIdByCode("LOA")) return snapshot;
  const at = trkNow();
  const built = trkBuildLoaDocument(sp, sVendor, at, payload);
  // Upload the generated LOA PDF to Blob; store only the reference (no base64 in the DB).
  let generatedDoc = built;
  try {
    const meta = await trkUploadDataUri(built.dataUri, built.fileName, { entityId: sp.id, docType: "loa" });
    generatedDoc = { ...built, dataUri: undefined, container: meta.container, blobKey: meta.blobKey, size: meta.size || built.size };
  } catch (e) {
    console.warn("LOA upload to Blob failed; keeping generated copy.", e);
  }
  const domainResponse = await fetch(trkActivityCommandPath(proposalId, activityId, "loa-documents"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      vendorId,
      vendorName: generatedDoc.vendorName,
      loaNumber: generatedDoc.loaNumber,
      awardValue: generatedDoc.awardValue,
      awardPercent: generatedDoc.awardPercent,
      fileName: generatedDoc.fileName,
      generatedAt: new Date(String(generatedDoc.generatedAt || "").replace(" ", "T")).toISOString(),
      container: generatedDoc.container,
      blobKey: generatedDoc.blobKey,
      payload: generatedDoc.payload,
      actorName,
    }),
  });
  if (!domainResponse.ok) {
    const errorBody = await domainResponse.json().catch(() => ({}));
    throw new Error(errorBody.code || `LOA persistence failed (${domainResponse.status}).`);
  }
  const result = trkUpdateStore((store) => {
    const p = store.proposals.find((x) => x.id === proposalId);
    const a = p && (p.activities || []).find((x) => x.id === activityId);
    const vendor = p && trkVendorsForProposal(p.id).find((x) => x.vendorId === vendorId);
    if (!p || !a || !vendor || a.stageId !== trkStageIdByCode("LOA")) return store;
    const existing = (((store.loaDocuments || {})[p.id] || {})[a.id] || {})[vendor.vendorId] || {};
    const doc = { ...generatedDoc, completedAt: existing.completedAt || generatedDoc.completedAt || null, completedRemark: existing.completedRemark || generatedDoc.completedRemark || null };
    store.loaDocuments[p.id] = store.loaDocuments[p.id] || {};
    store.loaDocuments[p.id][a.id] = store.loaDocuments[p.id][a.id] || {};
    store.loaDocuments[p.id][a.id][vendor.vendorId] = doc;
    store.proposals = store.proposals.map((x) => x.id === p.id ? {
      ...x,
      updatedAt: at,
      activities: (x.activities || []).map((act) => act.id === a.id ? {
        ...act,
        history: (act.history || []).concat([trkEvent("LoaGenerated", actorName || p.assignedOfficerName || p.ownerName, `Generated ${doc.fileName} for ${vendor.vendorName}.`, at)]),
      } : act),
    } : x);
    return store;
  });
  return result;
}
async function trkCompleteLoaVendor(proposalId, activityId, vendorId, payload) {
  const at = (payload && (payload.completedAt || payload.at)) || trkNow();
  const remark = (payload && payload.remark) || "";
  const actorName = (payload && payload.actorName) || "";
  const winnerVendorIds = (payload && payload.winnerVendorIds) || [];
  const response = await fetch(trkActivityCommandPath(proposalId, activityId, "loa-complete"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(trkNormalizeApiTimestamps({ vendorId, completedAt: at, remark })),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.code || `LOA completion failed (${response.status}).`);
  }
  let nextStore = trkUpdateStore((store) => {
    const p = store.proposals.find((x) => x.id === proposalId);
    const a = p && (p.activities || []).find((x) => x.id === activityId);
    if (!p || !a) return store;
    store.loaDocuments[p.id] = store.loaDocuments[p.id] || {};
    store.loaDocuments[p.id][a.id] = store.loaDocuments[p.id][a.id] || {};
    const current = store.loaDocuments[p.id][a.id][vendorId] || {};
    store.loaDocuments[p.id][a.id][vendorId] = { ...current, completedAt: at, completedRemark: remark };
    store.proposals = store.proposals.map((x) => x.id === p.id ? {
      ...x,
      updatedAt: at,
      activities: (x.activities || []).map((act) => act.id === a.id ? {
        ...act,
        history: (act.history || []).concat([trkEvent("Completed", actorName || p.assignedOfficerName || p.ownerName, remark || `Completed LOA for ${vendorId}.`, at)]),
      } : act),
    } : x);
    return store;
  });
  const docs = (((nextStore.loaDocuments || {})[proposalId] || {})[activityId] || {});
  const ids = winnerVendorIds.length ? winnerVendorIds : Object.keys(docs);
  const allDone = ids.length > 0 && ids.every((id) => docs[id] && docs[id].completedAt);
  if (allDone) {
    const proposal = (nextStore.proposals || []).find((p) => p.id === proposalId);
    const activity = proposal && (proposal.activities || []).find((a) => a.id === activityId);
    if (activity && activity.status === "Pending") {
      nextStore = trkCompleteActivityLocal(proposalId, activityId, {
        actorName,
        remark: remark || "Letter of Award completed for every winner.",
        evidenceNames: ids.map((id) => `loa::${id}`),
        at,
        completedAt: at,
      });
    }
  }
  return nextStore;
}
function trkRecycleActivity(proposalId, activityId, reason, actorName) {
  let dropCip = false;
  const result = trkUpdateStore((store) => {
    const p = store.proposals.find((x) => x.id === proposalId);
    const a = p && p.activities.find((x) => x.id === activityId);
    if (!p || !a || a.status !== "Completed") return store;
    dropCip = trkRecycleInvalidatesCip(p, a);
    const at = trkNow();
    const actor = actorName || p.ownerName || p.assignedOfficerName;
    const recycledCode = trkActivityCode(a);
    store.proposals = store.proposals.map((x) => {
      if (x.id !== p.id) return x;
      let reopen = false;
      const activities = x.activities.map((act) => {
        if (act.id === a.id) {
          reopen = true;
          return {
            ...act,
            status: "Pending",
            startedAt: at,
            completedAt: undefined,
            remark: undefined,
            evidenceCount: 0,
            evidenceNames: [],
            lockedReason: undefined,
            history: (act.history || []).concat([
              trkEvent("Recycle", actor, reason || `Recycle executed for ${a.title}.`, at),
              trkEvent("Reset", actor, "Activity reset for rework.", at),
            ]),
          };
        }
        if (reopen) {
          const actCode = trkActivityCode(act);
          // LOA ∥ CTR: recycling one parallel stage must not lock the sibling.
          if ((recycledCode === "LOA" && actCode === "CTR") || (recycledCode === "CTR" && actCode === "LOA")) {
            return act;
          }
          return {
            ...act,
            status: "Locked",
            startedAt: undefined,
            completedAt: undefined,
            remark: undefined,
            evidenceCount: 0,
            evidenceNames: [],
            lockedReason: `Recycle executed. Re-complete ${a.title} first.`,
            history: (act.history || []).concat([trkEvent("Recycle", actor, `Locked after recycle of ${a.title}.`, at)]),
          };
        }
        return act;
      });
      return {
        ...x,
        lifecycleStatus: "OnProgress",
        currentStage: a.title,
        updatedAt: at,
        actionPlan: `Recycle executed by Section Head. Resume from ${a.title}.`,
        activities,
      };
    });
    return store;
  });
  trkDomainPost(trkActivityCommandPath(proposalId, activityId, "recycle"), { reason, actorName });
  if (dropCip) trkNotifyCipCasesDropped(proposalId);
  return result;
}
function trkCancelProposal(proposalId, activityId, reason, actorName) {
  const result = trkUpdateStore((store) => {
    const p = store.proposals.find((x) => x.id === proposalId);
    const a = p && p.activities.find((x) => x.id === activityId);
    if (!p || !a || a.status !== "Pending") return store;
    const at = trkNow();
    const actor = actorName || p.ownerName || p.assignedOfficerName;
    store.proposals = store.proposals.map((x) => x.id === p.id ? {
      ...x,
      lifecycleStatus: "Canceled",
      currentStage: "Canceled",
      updatedAt: at,
      actionPlan: `Cancel proposal executed at ${a.title}. Workflow stopped.`,
      activities: x.activities.map((act) => {
        if (act.id === a.id) return { ...act, status: "Canceled", completedAt: at, lockedReason: undefined, history: (act.history || []).concat([trkEvent("CancelProposal", actor, reason || "Cancel proposal executed by Section Head.", at)]) };
        if (act.status === "Pending" || act.status === "Locked") return { ...act, status: "Locked", lockedReason: "Proposal canceled. No further activity is required.", history: (act.history || []).concat([trkEvent("CancelProposal", actor, "Locked because proposal was canceled.", at)]) };
        return act;
      }),
    } : x);
    return store;
  });
  trkDomainPost(trkActivityCommandPath(proposalId, activityId, "cancel"), { reason, actorName });
  trkNotifyCipCasesDropped(proposalId);
  return result;
}

function trkDashboardMetrics(proposals) {
  const totalValue = proposals.reduce((s, p) => s + (p.amount || 0), 0);
  const onProgress = proposals.filter((p) => trkLifecycleStatusForProposal(p) === "OnProgress").length;
  const completed = proposals.filter((p) => trkLifecycleStatusForProposal(p) === "Completed").length;
  const overdue = proposals.filter((p) => p.overdueDays > 0 && trkLifecycleStatusForProposal(p) === "OnProgress").length;
  const canceled = proposals.filter((p) => p.lifecycleStatus === "Canceled").length;
  return {
    total: proposals.length, totalValue, onProgress, completed, overdue, canceled,
    ready: proposals.filter((p) => p.lifecycleStatus === "ReadyToDistribute").length,
    avgLeadTime: proposals.length ? Math.round(proposals.reduce((s, p) => s + (p.agingDays || 0), 0) / proposals.length) : 0,
    maxDelay: proposals.reduce((m, p) => Math.max(m, p.overdueDays || 0), 0),
  };
}
function trkSlaVarianceRows(proposals) {
  return proposals.map((p) => ({
    proposalId: p.id,
    proposalNumber: p.proposalNumber,
    title: p.title,
    currentStage: p.currentStage,
    ownerName: p.ownerName,
    targetLeadDays: p.slaDays,
    actualLeadDays: p.agingDays,
    varianceDays: (p.agingDays || 0) - (p.slaDays || 0),
    overdueDays: p.overdueDays || 0,
    requirementDate: p.requirementDate,
    slaComplianceStatus: (p.agingDays || 0) - (p.slaDays || 0) > 0 ? "NotMet" : "Met",
  })).sort((a, b) => b.varianceDays - a.varianceDays);
}

// Proposal visibility follows org hierarchy (not platform admin roles):
// - Super Admin / Admin Tracker → no portfolio (impersonate or hold an ops role)
// - Division Head → all (top of hierarchy)
// - Department Head → ownership under their report-to tree
// - Section Head → ownership = self
// - Officer → assigned to self
function trkNameEquals(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}
function trkIsActorProposal(proposal, session) {
  if (!proposal) return false;
  const roles = (session && session.effectiveRoles) || [];
  const actorName = session && session.actingUser && session.actingUser.name;
  const vis = (typeof window !== "undefined" && window.__trackerVisibility) || {};
  const mode = vis.mode;

  if (roles.includes("Division Head")) return true;
  if (roles.includes("Department Head Proposal Tracker")) {
    const owners = Array.isArray(vis.ownerNamesUnder) ? vis.ownerNamesUnder : [];
    if (mode === "ownersUnder" || owners.length) {
      return owners.some((name) => trkNameEquals(name, proposal.ownerName));
    }
    // Visibility payload not loaded yet — hide until assignable-users returns.
    return false;
  }
  if (roles.includes("Section Head Proposal Tracker")) {
    return !!actorName && trkNameEquals(proposal.ownerName, actorName);
  }
  if (roles.includes("Officer Proposal Tracker")) {
    return !!actorName && trkNameEquals(proposal.assignedOfficerName, actorName);
  }
  return false;
}

Object.assign(window, {
  useTT, trkText, TRK_TODAY, TRK_AS_OF, TRK_STAGE_MASTER, TRK_METHODS, trkRebuildProcessModel, TRK_JOBSITES,
  TRK_OWNERS, TRK_OFFICERS, TRK_STATUS_META,
  TRK_ACTIVITY_META, trkClone, trkParse, trkAddDays, trkDaysBetween, trkTimestamp, trkDatePart, trkRp, trkRpM, trkCurrencyCode, trkMoney, trkMoneyCompact, trkFmtDate,
  trkMethodById, trkStageById, trkStageShortLabel, trkStageRows, trkMethodHasBidEvaluation, trkDirectAppointmentWinnerIds,
  trkBuildPdfDataUri, trkVendorsForProposal, trkLoaNumberForVendor,
  trkAwardSplitsForProposal, trkAwardSplitForVendor, trkAwardSplitSummary,
  trkAwardSplitsForWinners, trkBuildAwardResultRequest, trkSaveAwardResult, trkCreateCipCasesFromAward, trkResolveTermSheetCaseId, trkIsCipCaseKey, trkOpenTermSheetWorkflow, trkReadStore,
  trkSortSteps, trkActivityCode, trkReconcileActivitiesToMasterOrder,
  trkWriteStore, trkFlushProcurementStorage, trkResetStore, trkHydrateFromDomain, trkReloadStoreFromServer, trkSyncEproposal, trkGenerateSampleData, useTrackerStore, trkDistributeProposal, trkClockInActivity, trkCompleteActivity, trkCompleteActivityLocal,
  trkUnlockParallelAfterTerm, trkGenerateLoaDocument, trkCompleteLoaVendor, trkRecycleActivity, trkCancelProposal, trkReassignProposalOfficer, trkUpdateProposalAribaId,
  trkContractActivity, trkIsContractCompleted, trkLifecycleStatusForProposal, trkProposalHasOpenStep, trkNormalizeProposalLifecycle, trkBuildReadinessChecklist,
  trkDynamicEstimatedDate, trkDashboardMetrics, trkSlaVarianceRows, loadTrackerAssignableUsers, useTrackerAssignableOfficers, trkActingPersonnelNo,
  trkNow, trkHash, trkPad, trkUid, trkUpdateStore, trkStageIdByCode, trkIsActorProposal, trkUploadDocument, trkUploadDataUri,
});
export { TRK_STAGE_MASTER, TRK_METHODS, TRK_OWNERS, TRK_OFFICERS, useTT, trkText, TRK_TODAY, TRK_AS_OF, trkRebuildProcessModel, TRK_JOBSITES, TRK_STATUS_META, TRK_ACTIVITY_META, trkClone, trkParse, trkAddDays, trkDaysBetween, trkTimestamp, trkDatePart, trkRp, trkRpM, trkCurrencyCode, trkMoney, trkMoneyCompact, trkFmtDate, trkMethodById, trkStageById, trkStageShortLabel, trkStageRows, trkMethodHasBidEvaluation, trkDirectAppointmentWinnerIds, trkBuildPdfDataUri, trkVendorsForProposal, trkLoaNumberForVendor, trkAwardSplitsForProposal, trkAwardSplitForVendor, trkAwardSplitSummary, trkAwardSplitsForWinners, trkBuildAwardResultRequest, trkSaveAwardResult, trkCreateCipCasesFromAward, trkResolveTermSheetCaseId, trkIsCipCaseKey, trkOpenTermSheetWorkflow, trkReadStore, trkSortSteps, trkActivityCode, trkReconcileActivitiesToMasterOrder, trkWriteStore, trkFlushProcurementStorage, trkResetStore, trkHydrateFromDomain, trkReloadStoreFromServer, trkSyncEproposal, trkGenerateSampleData, useTrackerStore, trkDistributeProposal, trkClockInActivity, trkCompleteActivity, trkCompleteActivityLocal, trkUnlockParallelAfterTerm, trkGenerateLoaDocument, trkCompleteLoaVendor, trkRecycleActivity, trkCancelProposal, trkReassignProposalOfficer, trkUpdateProposalAribaId, trkContractActivity, trkIsContractCompleted, trkLifecycleStatusForProposal, trkProposalHasOpenStep, trkNormalizeProposalLifecycle, trkBuildReadinessChecklist, trkDynamicEstimatedDate, trkDashboardMetrics, trkSlaVarianceRows, loadTrackerAssignableUsers, useTrackerAssignableOfficers, trkActingPersonnelNo, trkNow, trkHash, trkPad, trkUid, trkUpdateStore, trkStageIdByCode, trkIsActorProposal, trkUploadDocument, trkUploadDataUri };
