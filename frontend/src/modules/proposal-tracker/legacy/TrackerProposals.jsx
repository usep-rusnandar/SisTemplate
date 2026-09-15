/* fm3-converted */
import React from "react";
import { trkCumulativeTargetDates, trkWorkingDaysBetween } from "./TrackerCalendar.jsx";
import { TRK_ACTIVITY_META, TRK_JOBSITES, TRK_METHODS, TRK_STAGE_MASTER, TRK_STATUS_META, TRK_TODAY, trkActingPersonnelNo, trkAddDays, trkAwardSplitForVendor, trkAwardSplitSummary, trkAwardSplitsForWinners, trkBuildAwardResultRequest, trkBuildPdfDataUri, trkBuildReadinessChecklist, trkCancelProposal, trkClockInActivity, trkClone, trkCompleteActivity, trkCompleteLoaVendor, trkCreateCipCasesFromAward, trkIsCipCaseKey, trkCurrencyCode, trkDaysBetween, trkDirectAppointmentWinnerIds, trkDistributeProposal, trkDynamicEstimatedDate, trkFmtDate, trkFlushProcurementStorage, trkGenerateLoaDocument, trkGenerateSampleData, trkHash, trkHydrateFromDomain, trkIsActorProposal, trkLifecycleStatusForProposal, trkProposalHasOpenStep, trkMethodById, trkMethodHasBidEvaluation, trkMoney, trkMoneyCompact, trkNormalizeProposalLifecycle, trkNow, trkPad, trkParse, trkReadStore, trkReassignProposalOfficer, trkRecycleActivity, trkReloadStoreFromServer, trkRpM, trkSaveAwardResult, trkStageById, trkStageRows, trkSyncEproposal, trkText, trkUid, trkUpdateProposalAribaId, trkUpdateStore, trkUploadDocument, trkVendorsForProposal, useTrackerStore, useTrackerAssignableOfficers } from "./TrackerData.jsx";
import { loadTrackerProcessModel } from "./TrackerMasterData.jsx";
import { trkAdvanceGeneratedSample } from "./TrackerSampleSeed.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Avatar, Badge, Button, Card, DetailCard, Field, Icon, IconButton, InfoList, Select, TableRefreshButton, TextInput, Textarea } from "../../../shared/legacy/Primitives.jsx";
import { Alert, EmptyState, Modal, PageHeader, Pagination, Spinner, Tooltip, fmtAppDate, fmtAppDateTime, useBodyHOverflow, useConstrainedFrameWidth, useLockstepHScroll, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
import { cipPhaseForStage, cipRefreshDomainCases, useCipStore } from "../../contract-initiation-platform/legacy/ContractCIPData.jsx";
/* Alamtri Geo Admin - Tracker proposals, detail workflow, distribution and activity actions. */

function trkCipEmbedActivityKey(activity) {
  return trkActivityStageCode(activity) === "CTR" ? "contract" : "termsheet";
}

function TrkStatusBadge({ status }) {
  const { lang } = useI18n();
  const meta = TRK_STATUS_META[status] || TRK_STATUS_META.ReadyToDistribute;
  return <Badge tone={meta.tone} dot><Icon name={meta.icon} size={11} />{trkText(lang, meta)}</Badge>;
}

function TrkInlineDistributeBadge({ proposal, onDistribute }) {
  const tt = useTT();
  return (
    <Tooltip label={tt("Distribute Proposal", "Distribusi Proposal")} side="top">
      <Button
        size="xs"
        iconLeft="send"
        onClick={(event) => {
          event.stopPropagation();
          if (onDistribute) onDistribute(proposal);
        }}
        style={{ height: 22, padding: "0 9px", fontSize: 10.5, borderRadius: RADIUS.sm, boxShadow: "none", flexShrink: 0 }}
      >
        {tt("Distribute", "Distribusi")}
      </Button>
    </Tooltip>
  );
}

function TrkSlaStepper({ value, onChange }) {
  const C = useC();
  const n = Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
  const bump = (delta) => onChange(Math.max(0, n + delta));
  const btn = (name, delta) => (
    <button
      type="button"
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); bump(delta); }}
      style={{ ...FONT, width: 26, height: 30, border: "none", background: "transparent", color: C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      aria-label={delta < 0 ? "Decrease" : "Increase"}
    >
      <Icon name={name} size={12} />
    </button>
  );
  return (
    <div style={{ display: "inline-flex", alignItems: "center", height: 30, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, backgroundColor: C.inputBg, overflow: "hidden" }}>
      {btn("minus", -1)}
      <input
        type="text"
        inputMode="numeric"
        value={String(n)}
        onChange={(event) => {
          const raw = String(event.target.value || "").replace(/[^\d]/g, "");
          onChange(raw === "" ? 0 : Math.max(0, parseInt(raw, 10) || 0));
        }}
        style={{ ...FONT, width: 36, height: 30, border: "none", outline: "none", textAlign: "center", background: "transparent", color: C.text, fontSize: 12.5, fontWeight: 600 }}
      />
      {btn("plus", 1)}
    </div>
  );
}

function TrkActivityBadge({ status }) {
  const { lang } = useI18n();
  const meta = TRK_ACTIVITY_META[status] || TRK_ACTIVITY_META.Locked;
  return <Badge tone={meta.tone} dot={status !== "Locked"}><Icon name={meta.icon} size={11} />{trkText(lang, meta)}</Badge>;
}

function trkActivityStatusTone(C, status) {
  const lockedBg = C.scheme === "dark" ? "rgba(255,255,255,0.035)" : "rgba(1,59,82,0.028)";
  const lockedHeader = C.scheme === "dark" ? "rgba(255,255,255,0.045)" : "rgba(1,59,82,0.04)";
  const tones = {
    Completed: {
      accent: C.success,
      border: C.success + "59",
      iconBg: C.successBg,
      headerBg: C.scheme === "dark" ? "rgba(79,180,119,0.12)" : "rgba(17,113,59,0.06)",
      bodyBg: C.scheme === "dark" ? "rgba(79,180,119,0.045)" : "rgba(17,113,59,0.025)",
      connector: C.success,
      muted: C.success,
    },
    Pending: {
      accent: C.ocean,
      border: C.ocean + "66",
      iconBg: C.brandBg,
      headerBg: C.scheme === "dark" ? "rgba(63,182,190,0.13)" : "rgba(15,130,138,0.07)",
      bodyBg: C.scheme === "dark" ? "rgba(63,182,190,0.045)" : "rgba(15,130,138,0.026)",
      connector: C.ocean,
      muted: C.ocean,
    },
    Locked: {
      accent: C.textSubtle,
      border: C.borderSoft,
      iconBg: lockedBg,
      headerBg: lockedHeader,
      bodyBg: C.surfaceAlt,
      connector: C.border,
      muted: C.textSubtle,
    },
    Canceled: {
      accent: C.danger,
      border: C.danger + "66",
      iconBg: C.dangerBg,
      headerBg: C.scheme === "dark" ? "rgba(236,112,89,0.13)" : "rgba(197,52,26,0.07)",
      bodyBg: C.scheme === "dark" ? "rgba(236,112,89,0.045)" : "rgba(197,52,26,0.026)",
      connector: C.danger,
      muted: C.danger,
    },
    Hold: {
      accent: C.orange,
      border: C.orange + "66",
      iconBg: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.10)",
      headerBg: C.scheme === "dark" ? "rgba(240,116,61,0.13)" : "rgba(235,102,46,0.07)",
      bodyBg: C.scheme === "dark" ? "rgba(240,116,61,0.045)" : "rgba(235,102,46,0.026)",
      connector: C.orange,
      muted: C.orange,
    },
  };
  return tones[status] || tones.Locked;
}

function trkProgressPct(p) {
  if (!p.activities || !p.activities.length) return p.lifecycleStatus === "ReadyToDistribute" ? 0 : 100;
  return Math.round((p.activities.filter((a) => a.status === "Completed" || a.status === "Canceled").length / p.activities.length) * 100);
}
function trkCanDistributeProposal(session, proposal) {
  return ((session && session.effectiveRoles) || []).includes("Section Head Proposal Tracker") && trkIsActorProposal(proposal, session);
}
function trkIsSectionHeadTracker(session) {
  const roles = (session && session.effectiveRoles) || [];
  return roles.includes("Section Head Proposal Tracker");
}
function trkCanSyncEproposal(session) {
  const roles = (session && session.effectiveRoles) || [];
  return roles.includes("Super Admin") || roles.includes("Administrator Proposal Tracker") || roles.includes("Section Head Proposal Tracker");
}
function trkSectionHeadSyncSnapshot(session) {
  const store = trkReadStore();
  const proposals = ((store && store.proposals) || [])
    .map(trkNormalizeProposalLifecycle)
    .filter((proposal) => trkIsActorProposal(proposal, session));
  return Object.fromEntries(proposals.map((proposal) => [proposal.id, JSON.stringify({
    proposalNumber: proposal.proposalNumber || "",
    title: proposal.title || "",
    jobsite: proposal.jobsite || "",
    department: proposal.department || "",
    contractType: proposal.contractType || proposal.trackerContractType || proposal.proposalType || "",
    contractualType: proposal.contractualType || proposal.cipContractType || "",
    currency: proposal.currency || proposal.currencyCode || "IDR",
    amount: Number(proposal.amount) || 0,
    trackerMethod: proposal.trackerMethod || "",
    ownerName: proposal.ownerName || "",
    requirementDate: proposal.requirementDate || "",
    recommendedVendors: (proposal.recommendedVendors || []).map((vendor) => ({
      vendorId: vendor.vendorId || "",
      vendorName: vendor.vendorName || "",
    })),
  })]));
}
function trkSectionHeadSyncDelta(before, after) {
  const beforeIds = Object.keys(before || {});
  const afterIds = Object.keys(after || {});
  const added = afterIds.filter((id) => !Object.prototype.hasOwnProperty.call(before || {}, id)).length;
  const removed = beforeIds.filter((id) => !Object.prototype.hasOwnProperty.call(after || {}, id)).length;
  const updated = afterIds.filter((id) => Object.prototype.hasOwnProperty.call(before || {}, id) && before[id] !== after[id]).length;
  return { added, updated, removed, total: added + updated + removed };
}
function trkCanCancelProposal(session, proposal) {
  return proposal && proposal.lifecycleStatus === "OnProgress" && trkIsSectionHeadTracker(session) && trkIsActorProposal(proposal, session);
}
function trkCanRecycleProposal(session, proposal) {
  return proposal && proposal.lifecycleStatus === "OnProgress" && trkIsSectionHeadTracker(session) && trkIsActorProposal(proposal, session);
}
function trkCanCompleteActivity(session, proposal) {
  return proposal && trkLifecycleStatusForProposal(proposal) === "OnProgress" && session && session.effectiveRole === "Officer Proposal Tracker";
}
function trkCanSelectBidWinner(session, proposal) {
  return trkCanCompleteActivity(session, proposal);
}
function trkCanReassignProposal(session, proposal) {
  return proposal && trkLifecycleStatusForProposal(proposal) === "OnProgress" && trkIsSectionHeadTracker(session) && trkIsActorProposal(proposal, session);
}
function trkCanEditAribaId(session, proposal) {
  return ((session && session.effectiveRoles) || []).includes("Section Head Proposal Tracker") && trkIsActorProposal(proposal, session);
}
const TRK_STEP_VENDOR_DOCS_KEY = "ag_tracker_step_vendor_docs_v1:";
const TRK_BID_EVAL_KEY = "ag_tracker_bid_eval_v1:";
const TRK_ACTIVITY_NOTES_KEY = "ag_tracker_activity_notes_v1:";

function trkStorageReadJson(key, fallback) {
  try {
    const raw = window.__procurementStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function trkStorageWriteJson(key, value) {
  try { window.__procurementStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  return value;
}
// Proposal numbers contain "/". Encode them inside the storage key so hydrate/list uses one stable
// identifier (2026%2FS.03...). Writes go through /storage/item?key= so Azure/IIS never split the path.
function trkAuxiliaryProposalKeyPart(proposalId) {
  const value = String(proposalId || "");
  try { return encodeURIComponent(decodeURIComponent(value)); } catch (e) { return encodeURIComponent(value); }
}
function trkStepVendorDocsKey(proposalId) { return `${TRK_STEP_VENDOR_DOCS_KEY}${trkAuxiliaryProposalKeyPart(proposalId)}`; }
function trkBidEvalKey(proposalId) { return `${TRK_BID_EVAL_KEY}${trkAuxiliaryProposalKeyPart(proposalId)}`; }
function trkActivityNotesKey(proposalId) { return `${TRK_ACTIVITY_NOTES_KEY}${trkAuxiliaryProposalKeyPart(proposalId)}`; }
function trkProposalSeedId(proposalOrId) { return typeof proposalOrId === "string" ? proposalOrId : proposalOrId && proposalOrId.id; }
function trkLoadStepVendorDocs(proposalOrId) {
  const proposalId = trkProposalSeedId(proposalOrId);
  // Backend-driven: return only real uploaded vendor documents (persisted to the DB), no seed.
  return trkStorageReadJson(trkStepVendorDocsKey(proposalId), {}) || {};
}
function trkSaveStepVendorDocs(proposalId, value) { return trkStorageWriteJson(trkStepVendorDocsKey(proposalId), value || {}); }
function trkLoadBidEvalState(proposalOrId) {
  const proposalId = trkProposalSeedId(proposalOrId);
  // Backend-driven: return only real bid-evaluation state (persisted to the DB), no seed.
  const stored = trkStorageReadJson(trkBidEvalKey(proposalId), {}) || {};
  if (!proposalOrId || typeof proposalOrId === "string") return stored;
  const activity = (proposalOrId.activities || []).find(trkIsBidEvaluationActivity);
  if (!activity) return stored;
  const current = trkBidEvalForActivity(stored, activity.id);
  if (current.winnerVendorIds.length) return stored;
  const winnerVendorIds = trkWinnerIdsFromActivity(activity);
  return winnerVendorIds.length
    ? { ...stored, [activity.id]: { ...current, winnerVendorIds } }
    : stored;
}
function trkSaveBidEvalState(proposalId, value) { return trkStorageWriteJson(trkBidEvalKey(proposalId), value || {}); }
function trkActivityNoteRoleForSession(session) {
  const roles = (session && session.effectiveRoles) || [];
  if (roles.includes("Department Head Proposal Tracker") || roles.includes("Division Head")) return "Department Head";
  if (roles.includes("Section Head Proposal Tracker") || roles.includes("Administrator Proposal Tracker") || roles.includes("Super Admin")) return "Section Head";
  return "Officer";
}
function trkActivityNoteRoleTone(role) {
  if (role === "Department Head") return "orange";
  if (role === "Section Head") return "brand";
  return "info";
}
function trkActivityNoteIsOfficer(role) {
  return String(role || "Officer").toLowerCase() === "officer";
}
function trkActivityNoteBubbleTone(C, role) {
  const officer = trkActivityNoteIsOfficer(role);
  return officer
    ? { bg: C.infoBg, border: C.info + "44", accent: C.info }
    : { bg: C.scheme === "dark" ? "rgba(240,116,61,0.14)" : "rgba(235,102,46,0.10)", border: C.orange + "4d", accent: C.orange };
}
function trkNormalizeActivityNotes(value) {
  const normalized = {};
  Object.entries(value || {}).forEach(([activityId, notes]) => {
    const rows = Array.isArray(notes) ? notes : [];
    const cleanRows = rows
      .filter((note) => note && note.id && note.message)
      .map((note) => ({
        id: String(note.id),
        activityId: String(note.activityId || activityId),
        authorName: String(note.authorName || "Unknown"),
        authorRole: note.authorRole === "Department Head" || note.authorRole === "Section Head" ? note.authorRole : "Officer",
        message: String(note.message || ""),
        createdAt: String(note.createdAt || note.at || trkNow()),
      }));
    if (cleanRows.length) normalized[activityId] = cleanRows;
  });
  return normalized;
}
function trkLoadActivityNotes(proposal) {
  // Backend-driven: return only real step notes (persisted to the DB), no fabricated conversation.
  return trkNormalizeActivityNotes(trkStorageReadJson(trkActivityNotesKey(proposal.id), {}));
}
function trkSaveActivityNotes(proposalId, value) {
  return trkStorageWriteJson(trkActivityNotesKey(proposalId), trkNormalizeActivityNotes(value));
}
async function trkRefreshProposalAuxiliary(proposal) {
  const proposalId = trkProposalSeedId(proposal);
  if (!proposalId) return;
  const storage = typeof window !== "undefined" ? window.__procurementStorage : null;
  if (!storage || typeof storage.refreshItem !== "function") return;
  await trkFlushProcurementStorage();
  await Promise.all([
    storage.refreshItem(trkActivityNotesKey(proposalId)),
    storage.refreshItem(trkStepVendorDocsKey(proposalId)),
    storage.refreshItem(trkBidEvalKey(proposalId)),
  ]);
}
function trkActivityStageCode(activity) {
  const stage = activity && activity.stageId ? trkStageById(activity.stageId) : null;
  return (stage && stage.code) || "";
}
function trkActivityTitleLower(activity) { return String((activity && activity.title) || "").toLowerCase(); }
function trkIsBidEvaluationActivity(activity) {
  return trkActivityStageCode(activity) === "EVAL" || trkActivityTitleLower(activity) === "bid evaluation";
}
function trkIsNegotiationActivity(activity) {
  return trkActivityStageCode(activity) === "NEGO" || trkActivityTitleLower(activity).indexOf("negotiation") >= 0;
}
function trkIsLoaActivity(activity) {
  const title = trkActivityTitleLower(activity);
  return trkActivityStageCode(activity) === "LOA" || title.indexOf("letter of award") >= 0 || title === "loa";
}
/* Stages where a single vendor document is enough to complete (not every vendor must upload):
   Invitation & Aanwijzing (TIA), RFQ, and Negotiation (NEGO). */
function trkActivityAllowsSingleVendorDoc(activity) {
  const code = trkActivityStageCode(activity);
  return code === "TIA" || code === "RFQ" || code === "NEGO";
}
/** TERM + CTR continue in Term Sheet / Contract. LOA stays on the proposal (parallel with CTR). */
function trkIsCipHandoffActivity(activity) {
  const code = trkActivityStageCode(activity);
  const title = trkActivityTitleLower(activity);
  return code === "TERM" || code === "CTR" || title === "term sheet" || title === "contract";
}
function trkMatchCipCaseForVendor(cases, proposal, vendor) {
  const pid = String((proposal && proposal.id) || "").toLowerCase();
  const pnum = String((proposal && proposal.proposalNumber) || "").toLowerCase();
  const scoped = (cases || []).filter((c) => {
    const cid = String((c && c.proposalId) || "").toLowerCase();
    const cnum = String((c && c.proposalNumber) || "").toLowerCase();
    return (pid && cid === pid) || (pnum && (cnum === pnum || cid === pnum));
  });
  const vid = String((vendor && vendor.vendorId) || "").toLowerCase();
  const vname = String((vendor && (vendor.vendorName || vendor.name)) || "").toLowerCase();
  return scoped.find((c) => vid && String(c.vendorId || "").toLowerCase() === vid)
    || scoped.find((c) => vname && String(c.vendor || "").toLowerCase() === vname)
    || null;
}
function trkVendorTermSheetComplete(caseRow) {
  if (!caseRow) return false;
  return cipPhaseForStage(caseRow.stage) === "contract" || caseRow.stage === "final";
}
function trkBidEvalForActivity(state, activityId) {
  const current = (state && state[activityId]) || {};
  return {
    winnerVendorIds: current.winnerVendorIds || [],
    winnerValues: current.winnerValues || {},
    proofDocuments: current.proofDocuments || [],
  };
}
function trkParseIdrDigits(value) {
  const digits = String(value == null ? "" : value).replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}
function trkFmtIdrDigits(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return Math.round(amount).toLocaleString("id-ID");
}
function trkPruneWinnerValues(winnerValues, winnerVendorIds) {
  const next = {};
  (winnerVendorIds || []).forEach((id) => {
    const amount = Number(winnerValues && winnerValues[id]);
    if (Number.isFinite(amount) && amount > 0) next[id] = Math.round(amount);
  });
  return next;
}
function trkBidEvalWinnerValuesReady(current, proposalAmount) {
  const ids = (current && current.winnerVendorIds) || [];
  const proposalValue = Math.round(Number(proposalAmount) || 0);
  const values = (current && current.winnerValues) || {};
  if (!ids.length) return { ok: true, reason: null, missing: [], winnerTotal: 0, proposalValue };
  const missing = ids.filter((id) => !(Number(values[id]) > 0));
  const winnerTotal = ids.reduce((sum, id) => sum + Math.round(Number(values[id]) || 0), 0);
  if (missing.length) return { ok: false, reason: "missing", missing, winnerTotal, proposalValue };
  return { ok: true, reason: null, missing: [], winnerTotal, proposalValue };
}
function trkBidEvalWinnerValuesBlock(tt, current, proposal) {
  const ready = trkBidEvalWinnerValuesReady(current, proposal && proposal.amount);
  if (ready.ok) return null;
  return {
    title: tt("Winner VALUE required", "VALUE pemenang wajib diisi"),
    description: tt("Enter VALUE greater than 0 for every selected winner before completing Bid Evaluation.", "Isi VALUE lebih dari 0 untuk setiap pemenang sebelum menyelesaikan Bid Evaluation."),
  };
}
function trkStepVendorDocsForActivity(stepDocs, activityId) {
  return (stepDocs && stepDocs[activityId]) || {};
}
function trkSlugPart(value) {
  return String(value || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}
function trkBuildVendorStepDocument(proposal, activity, vendor, kind) {
  const label = kind || "Evidence";
  const uid = trkUid("doc");
  const fileName = `${trkSlugPart(activity.title)}_${vendor.vendorId}_${uid.split("-").slice(-1)[0]}.pdf`;
  const remark = `${label} for ${activity.title} - ${vendor.vendorName}`;
  return {
    id: uid,
    fileName,
    name: fileName,
    vendorId: vendor.vendorId,
    vendorName: vendor.vendorName,
    remark,
    createdAt: trkNow(),
    src: trkBuildPdfDataUri(`${activity.title} - ${vendor.vendorName}`, [
      `Proposal: ${proposal.proposalNumber}`,
      `Vendor ID: ${vendor.vendorId}`,
      `Vendor Name: ${vendor.vendorName}`,
      `Activity: ${activity.title}`,
      `Remark: ${remark}`,
      `Generated: ${trkNow()}`,
    ]),
  };
}
function trkBuildBidEvaluationProof(proposal, activity) {
  const uid = trkUid("proof");
  const fileName = `bid-evaluation-winner-proof_${proposal.proposalNumber}_${uid.split("-").slice(-1)[0]}.pdf`;
  return {
    id: uid,
    fileName,
    name: fileName,
    remark: "Winner evidence and evaluation recommendation.",
    createdAt: trkNow(),
    src: trkBuildPdfDataUri("Bid Evaluation Winner Evidence", [
      `Proposal: ${proposal.proposalNumber}`,
      `Activity: ${activity.title}`,
      "Evidence: commercial evaluation, technical score, and winner recommendation.",
      `Generated: ${trkNow()}`,
    ]),
  };
}
function trkIsPdfFile(file) {
  if (!file) return false;
  return file.type === "application/pdf" || String(file.name || "").toLowerCase().endsWith(".pdf");
}
function trkFileSizeLabel(size) {
  const n = Number(size) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${n} B`;
}
function trkReadFileAsDataUri(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

/* Resolve a viewable URL for a document: legacy/generated docs carry an inline src;
   blob-backed docs are resolved to a short-lived SAS URL fetched from the backend. */
async function trkResolveDocumentUrl(doc) {
  if (!doc) return "";
  if (doc.src || doc.dataUri) return doc.src || doc.dataUri;
  if (doc.blobKey && doc.container) {
    const res = await fetch(`/api/v1/documents/download?container=${encodeURIComponent(doc.container)}&key=${encodeURIComponent(doc.blobKey)}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Download link failed (${res.status})`);
    const data = await res.json().catch(() => null);
    const url = (data && data.url) || "";
    if (!url) return "";
    if (/^https?:\/\/[^/]*blob\.core\.windows\.net\b/i.test(url)) return url;
    const fileRes = await fetch(url, { credentials: "include" });
    if (!fileRes.ok) throw new Error(`Download failed (${fileRes.status})`);
    return URL.createObjectURL(await fileRes.blob());
  }
  return "";
}
/* Delete the underlying blob for a document (no-op for legacy/inline docs without a blobKey). */
async function trkDeleteDocument(doc) {
  if (!doc || !doc.blobKey || !doc.container) return;
  const res = await fetch(`/api/v1/documents/proposal-tracker?container=${encodeURIComponent(doc.container)}&key=${encodeURIComponent(doc.blobKey)}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}
/* On recycle, purge from Azure Blob every vendor document, winner-proof, and generated LOA that
   belongs to an activity AFTER the recycled one, and clear those references from the aux stores.
   Returns cleaned { stepDocs, bidEvalState } for the caller to persist. Blob deletes are best-effort. */
async function trkPurgeDownstreamActivityDocs(proposal, recycledActivityId, stepDocs, bidEvalState, loaDocumentsByActivity) {
  const acts = (proposal && proposal.activities) || [];
  const recycledIndex = acts.findIndex((a) => a.id === recycledActivityId);
  const nextStepDocs = trkClone(stepDocs || {});
  const nextBidEval = trkClone(bidEvalState || {});
  if (recycledIndex < 0) return { stepDocs: nextStepDocs, bidEvalState: nextBidEval };
  const downstreamIds = acts.slice(recycledIndex + 1).map((a) => a.id);
  const blobs = [];
  downstreamIds.forEach((aid) => {
    const byVendor = nextStepDocs[aid] || {};
    Object.keys(byVendor).forEach((vid) => (byVendor[vid] || []).forEach((d) => { if (d && d.blobKey) blobs.push(d); }));
    delete nextStepDocs[aid];
    const be = nextBidEval[aid];
    if (be && Array.isArray(be.proofDocuments)) be.proofDocuments.forEach((d) => { if (d && d.blobKey) blobs.push(d); });
    delete nextBidEval[aid];
    const loaByVendor = (loaDocumentsByActivity || {})[aid] || {};
    Object.keys(loaByVendor).forEach((vid) => { const d = loaByVendor[vid]; if (d && d.blobKey) blobs.push(d); });
  });
  if (blobs.length) await Promise.allSettled(blobs.map((d) => trkDeleteDocument(d)));
  // Clear generated-LOA references for downstream activities from the main store.
  if (downstreamIds.length) {
    trkUpdateStore((store) => {
      const byProposal = (store.loaDocuments || {})[proposal.id];
      if (byProposal) downstreamIds.forEach((aid) => { delete byProposal[aid]; });
      return store;
    });
  }
  return { stepDocs: nextStepDocs, bidEvalState: nextBidEval };
}
function trkBuildUploadedVendorDocument(proposal, activity, vendor, file, upload, remark) {
  const fileName = (upload && upload.fileName) || file.name || `${trkSlugPart(activity.title)}_${vendor.vendorId}.pdf`;
  const cleanRemark = String(remark || "").trim();
  return {
    id: trkUid("doc"),
    fileName,
    name: fileName,
    vendorId: vendor.vendorId,
    vendorName: vendor.vendorName,
    remark: cleanRemark || `Uploaded document for ${activity.title} - ${vendor.vendorName}`,
    createdAt: trkNow(),
    size: (upload && upload.size) || file.size || 0,
    sizeLabel: trkFileSizeLabel((upload && upload.size) || file.size),
    type: (upload && upload.contentType) || file.type || "application/octet-stream",
    container: upload && upload.container,
    blobKey: upload && upload.blobKey,
  };
}
function trkBuildUploadedWinnerProof(proposal, activity, file, upload, remark) {
  const fileName = (upload && upload.fileName) || file.name || `bid-evaluation-winner-proof_${proposal.proposalNumber}.pdf`;
  const cleanRemark = String(remark || "").trim();
  return {
    id: trkUid("proof"),
    fileName,
    name: fileName,
    remark: cleanRemark || "Winner evidence and evaluation recommendation.",
    createdAt: trkNow(),
    size: (upload && upload.size) || file.size || 0,
    sizeLabel: trkFileSizeLabel((upload && upload.size) || file.size),
    type: (upload && upload.contentType) || file.type || "application/octet-stream",
    container: upload && upload.container,
    blobKey: upload && upload.blobKey,
  };
}
function trkRomanMonthFromDate(value) {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const date = new Date(String(value || TRK_TODAY).replace(" ", "T"));
  const month = Number.isNaN(date.getTime()) ? 0 : date.getMonth();
  return roman[month] || "I";
}
function trkInputDateFromTimestamp(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : TRK_TODAY;
}
function trkSuggestedLoaNumber(proposal, letterDate) {
  const year = String(letterDate || TRK_TODAY).slice(0, 4) || "2026";
  const deptCode = trkSlugPart(proposal.department || "GA").slice(0, 6).toUpperCase() || "GA";
  return `1/LOA/SIS-${proposal.jobsite}/${deptCode}/${trkRomanMonthFromDate(letterDate)}/${year}`;
}
async function trkLoadLoaSupport(proposalId, vendorId) {
  const response = await fetch(`/api/v1/proposal-tracker/loa-support?proposalId=${encodeURIComponent(proposalId)}&vendorId=${encodeURIComponent(vendorId)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.available) {
    const error = new Error((body && (body.code || body.reason)) || "termsheet_not_completed");
    error.code = (body && (body.code || body.reason)) || "termsheet_not_completed";
    throw error;
  }
  return body;
}
function trkLoaInitialForm(proposal, vendor, support) {
  const letterDate = TRK_TODAY;
  const sourceTerms = (support && support.sourceTerms) || {};
  const termsheet = (support && support.termsheetPayload) || {};
  const procurementSubject = termsheet.transaction || sourceTerms.procurementSubject || termsheet.scope || proposal.title || "";
  const periodText = termsheet.periodText || [termsheet.periodStart, termsheet.periodEnd].filter(Boolean).join(" - ");
  return {
    loaNumber: trkSuggestedLoaNumber(proposal, letterDate),
    letterDate,
    vendorName: (support && support.vendorName) || vendor.vendorName || "",
    vendorAddress: sourceTerms.vendorAddress || termsheet.vendorAddress || vendor.address || "",
    procurementSubject,
    letterSubject: `Surat Penetapan Kerja Sama ${procurementSubject}`.trim(),
    attachmentDescription: support && support.termsheetNumber ? `Term Sheet ${support.termsheetNumber}` : "1 (satu) set",
    sisSignatoryName: proposal.ownerName || "",
    sisSignatoryTitle: "Section Head Procurement",
    vendorRecipientTitle: "Direktur",
    vendorDirectorName: vendor.director || "",
    vendorDirectorTitle: "Direktur Utama",
    termsheetCaseKey: (support && support.caseKey) || "",
    termsheetNumber: (support && support.termsheetNumber) || "",
    termsheetCompletedAt: (support && support.completedAt) || "",
    termsheetDocument: (support && support.document) || null,
    scope: termsheet.scope || sourceTerms.scope || procurementSubject,
    periodText,
    termOfPayment: termsheet.termOfPayment || "",
    paymentMethod: termsheet.paymentMethod || "",
    awardValue: (support && support.awardValue) || undefined,
    awardPercent: (support && support.awardPercent) || undefined,
    attachmentFiles: [],
  };
}
function trkWinnerIdsFromActivity(activity) {
  return ((activity && activity.evidenceNames) || [])
    .filter((name) => String(name).indexOf("winner::") === 0)
    .map((name) => String(name).split("::")[1])
    .filter(Boolean);
}
function trkBuildProposalDocument(proposal) {
  return {
    title: "Proposal Document",
    fileName: `proposal-${proposal.proposalNumber}.pdf`,
    src: trkBuildPdfDataUri("PROCUREMENT PROPOSAL", [
      `Proposal No: ${proposal.proposalNumber}`,
      `ARIBA: ${proposal.aribaId || "-"}`,
      `Title: ${proposal.title}`,
      `Owner: ${proposal.ownerName || "-"}`,
      `Jobsite: ${proposal.jobsite || "-"}`,
      `Commodity: ${proposal.commodity || "-"}`,
      `Value: ${trkMoney(proposal.amount, proposal.currency, "id")}`,
      `Requirement Date: ${trkFmtDate(proposal.requirementDate, "id")}`,
    ]),
  };
}
function trkWinnerVendorsForProposal(proposal, bidEvalState) {
  const bidActivity = (proposal.activities || []).find(trkIsBidEvaluationActivity);
  let winnerIds = bidActivity ? trkBidEvalForActivity(bidEvalState, bidActivity.id).winnerVendorIds : [];
  if (!winnerIds.length && bidActivity) winnerIds = trkWinnerIdsFromActivity(bidActivity);
  if (!winnerIds.length && !trkMethodHasBidEvaluation(proposal)) winnerIds = trkDirectAppointmentWinnerIds(proposal);
  const vendors = trkVendorsForProposal(proposal.id);
  return winnerIds.length ? vendors.filter((vendor) => winnerIds.includes(vendor.vendorId)) : [];
}

function trkReadinessLabel(item) {
  if (!item) return "";
  if (item.id === "scope-confirmed") return "Term of Reference (TOR)";
  if (item.id === "technical-spec-complete") return "Technical Evaluation Report (TER)";
  if (item.id === "vendor-list-available") return "Vendor List";
  return item.label;
}
function trkReadinessDocumentMeta(item) {
  if (!item || !item.document) return null;
  if (item.id === "scope-confirmed") return { ...item.document, title: "Term of Reference (TOR)", fileName: "term-of-reference-tor.pdf" };
  if (item.id === "technical-spec-complete") return { ...item.document, title: "Technical Evaluation Report (TER)", fileName: "technical-evaluation-report-ter.pdf" };
  return item.document;
}
function trkPushEvidenceDoc(list, doc, stageTitle, vendorName) {
  if (!doc || !list) return;
  const fileName = doc.fileName || doc.name || "document.pdf";
  const blobKey = doc.blobKey || null;
  const container = doc.container || null;
  if (!fileName && !blobKey) return;
  list.push({
    stageTitle: stageTitle || "",
    vendorName: vendorName || doc.vendorName || "",
    fileName,
    container,
    blobKey,
    contentType: doc.contentType || "application/pdf",
  });
}
function trkCollectHistoricalEvidenceDocs(proposal, stepDocs, bidEvalState, loaDocumentsByActivity) {
  const docs = [];
  const checklist = (proposal && Array.isArray(proposal.readinessChecklist))
    ? proposal.readinessChecklist
    : (typeof trkBuildReadinessChecklist === "function" ? trkBuildReadinessChecklist(proposal) : []);
  (checklist || []).forEach((item) => {
    const meta = trkReadinessDocumentMeta(item);
    if (meta) trkPushEvidenceDoc(docs, meta, trkReadinessLabel(item), "");
  });
  ((proposal && proposal.activities) || []).forEach((activity) => {
    const byVendor = trkStepVendorDocsForActivity(stepDocs, activity.id);
    Object.keys(byVendor).forEach((vendorId) => {
      (byVendor[vendorId] || []).forEach((doc) => trkPushEvidenceDoc(docs, doc, activity.title, doc.vendorName || vendorId));
    });
    (trkBidEvalForActivity(bidEvalState, activity.id).proofDocuments || []).forEach((doc) => {
      trkPushEvidenceDoc(docs, doc, activity.title, doc.vendorName || "");
    });
    const loaByVendor = (loaDocumentsByActivity && loaDocumentsByActivity[activity.id]) || {};
    Object.keys(loaByVendor).forEach((vendorId) => {
      const loa = loaByVendor[vendorId];
      trkPushEvidenceDoc(docs, loa, activity.title, (loa && loa.vendorName) || vendorId);
    });
  });
  return docs;
}
async function trkDownloadHistoricalEvidence(proposal, extras) {
  const documents = trkCollectHistoricalEvidenceDocs(
    proposal,
    extras && extras.stepDocs,
    extras && extras.bidEvalState,
    extras && extras.loaDocumentsByActivity,
  );
  const res = await fetch(`/api/v1/proposal-tracker/historical-evidence?proposalId=${encodeURIComponent(proposal.id)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/pdf" },
    body: JSON.stringify({ documents }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.title || body.code || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historical-evidence-${String(proposal.proposalNumber || proposal.id).replace(/[^\w.-]+/g, "-")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function trkVendorTableHeaderRowStyle(C) {
  return {
    backgroundColor: C.surfaceAlt,
    borderBottom: `1px solid ${C.borderSoft}`,
  };
}
function trkVendorTableHeaderCellStyle(C, extra) {
  return {
    ...FONT,
    padding: "8px 12px",
    color: C.textMuted,
    fontSize: 9.4,
    fontWeight: 650,
    lineHeight: 1.1,
    textTransform: "uppercase",
    letterSpacing: "0.035em",
    textAlign: "left",
    ...extra,
  };
}
function TrkVendorReadinessTable({ vendors }) {
  const C = useC();
  return (
    <div style={{ marginTop: 9, border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: C.surface }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed" }}>
        <thead>
          <tr style={trkVendorTableHeaderRowStyle(C)}>
            <th style={trkVendorTableHeaderCellStyle(C, { width: 128, borderBottom: `1px solid ${C.borderSoft}` })}>Vendor ID</th>
            <th style={trkVendorTableHeaderCellStyle(C, { borderBottom: `1px solid ${C.borderSoft}` })}>Vendor Name</th>
          </tr>
        </thead>
        <tbody>
          {(vendors || []).map((vendor, index) => (
            <tr key={vendor.vendorId}>
              <td style={{ padding: "8px 10px", borderBottom: index === vendors.length - 1 ? "none" : `1px solid ${C.borderSoft}`, color: C.ocean, fontFamily: "monospace", fontSize: 11.5, fontWeight: 500, whiteSpace: "nowrap" }}>{vendor.vendorId}</td>
              <td style={{ padding: "8px 10px", borderBottom: index === vendors.length - 1 ? "none" : `1px solid ${C.borderSoft}`, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{vendor.vendorName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function TrkReadinessPanel({ proposal, onViewDocument, style }) {
  const C = useC();
  const tt = useTT();
  const checklist = (proposal.readinessChecklist && proposal.readinessChecklist.length)
    ? proposal.readinessChecklist
    : (typeof trkBuildReadinessChecklist === "function" ? trkBuildReadinessChecklist(proposal) : []);
  return (
    <DetailCard title={tt("Readiness checklist", "Checklist readiness")} subtitle={tt("Supporting documents and vendor shortlist from proposal intake.", "Dokumen pendukung dan shortlist vendor dari intake proposal.")} style={style}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {checklist.length === 0 && (
          <div style={{ padding: "18px 8px", textAlign: "center", color: C.textMuted, fontSize: 12.5 }}>
            {tt("No readiness items yet.", "Belum ada item readiness.")}
          </div>
        )}
        {checklist.map((item) => {
          const doc = trkReadinessDocumentMeta(item);
          const label = trkReadinessLabel(item);
          const isVendor = Array.isArray(item.vendors);
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 12, border: `1px solid ${item.isReady ? C.borderSoft : C.warningText + "55"}`, backgroundColor: item.isReady ? C.surface : C.warningBg, borderRadius: RADIUS.md }}>
              <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: item.isReady ? C.brandBg : C.surfaceAlt, color: item.isReady ? C.ocean : C.textSubtle, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={isVendor ? "building-2" : "file-text"} size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: C.text, minWidth: 0 }}>{label}</div>
                  {item.isReady && <Icon name="check-circle-2" size={13} color={C.success} style={{ flexShrink: 0 }} />}
                </div>
                {!item.isReady && !isVendor && (
                  <div style={{ marginTop: 3, color: C.textSubtle, fontSize: 11.5 }}>
                    {tt("Not available from E-Proposal yet.", "Belum tersedia dari E-Proposal.")}
                  </div>
                )}
                {doc && <div style={{ marginTop: 3, color: C.textSubtle, fontSize: 11.5, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.fileName}</div>}
                {isVendor && item.isReady && <TrkVendorReadinessTable vendors={item.vendors} />}
                {isVendor && !item.isReady && (
                  <div style={{ marginTop: 3, color: C.textSubtle, fontSize: 11.5 }}>
                    {tt("No recommended vendors on this proposal.", "Belum ada vendor rekomendasi pada proposal ini.")}
                  </div>
                )}
              </div>
              {doc && item.isReady ? (
                <IconButton
                  name="search"
                  title={tt("View PDF Document", "Lihat dokumen PDF")}
                  size="sm"
                  variant="secondary"
                  onClick={() => onViewDocument && onViewDocument(doc)}
                  style={{ backgroundColor: C.brandBg, color: C.ocean, borderColor: C.ocean + "33" }}
                />
              ) : !item.isReady ? (
                <Badge tone="warning" size="sm">{tt("Unavailable", "Belum tersedia")}</Badge>
              ) : null}
            </div>
          );
        })}
      </div>
    </DetailCard>
  );
}

function trkClampStartToRequirement(startDate, proposal) {
  if (!startDate || !proposal || !proposal.requirementDate) return startDate;
  return trkDaysBetween(startDate, proposal.requirementDate) < 0 ? proposal.requirementDate : startDate;
}

function trkSlaBudgetForProposal(proposal, startDate) {
  if (!proposal || !startDate || !proposal.requirementDate) return 0;
  const value = (typeof trkWorkingDaysBetween === "function")
    ? trkWorkingDaysBetween(startDate, proposal.requirementDate)
    : trkDaysBetween(startDate, proposal.requirementDate);
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function trkCleanSlaDayValue(value, fallback) {
  const n = Number(value);
  const fb = Number(fallback);
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : Number.isFinite(fb) ? fb : 0));
}

function trkMasterSlaMap(stages) {
  return (stages || []).reduce((acc, stage) => {
    acc[stage.id] = trkCleanSlaDayValue(stage.slaDays, 0);
    return acc;
  }, {});
}

// Aligned with master Proposal Tracker Method (tracker-method.json): TM-1/2/3.
function trkSampleMethodMeta(methodId) {
  const id = methodId || "TM-1";
  if (id === "TM-3") return { id: "TM-3", minVendors: 1, maxVendors: 1, defaultVendors: 1 };
  if (id === "TM-2") return { id: "TM-2", minVendors: 2, maxVendors: 6, defaultVendors: 2 };
  return { id: "TM-1", minVendors: 3, maxVendors: 6, defaultVendors: 3 };
}
function trkSampleMethodOptions() {
  const methods = (typeof TRK_METHODS !== "undefined" && TRK_METHODS.length)
    ? TRK_METHODS
    : [
      { id: "TM-1", name: "Tender" },
      { id: "TM-2", name: "Pemilihan Langsung" },
      { id: "TM-3", name: "Penunjukan Langsung" },
    ];
  return methods.map((m) => ({ value: m.id, label: m.name }));
}
function trkDefaultSampleRequirementDate() {
  return typeof trkAddDays === "function" ? trkAddDays(TRK_TODAY, 45) : TRK_TODAY;
}
function trkSampleMaxLastStepCode(methodId) {
  return methodId === "TM-3" ? "NEGO" : "EVAL";
}
function trkSampleLastStepOptions(methodId) {
  const maxCode = trkSampleMaxLastStepCode(methodId);
  const stages = typeof trkStageRows === "function" ? trkStageRows(methodId) : [];
  const options = [{ value: "READY", label: "Proposal Received (Ready to Distribute)" }];
  for (const stage of stages) {
    options.push({ value: stage.code, label: stage.name });
    if (stage.code === maxCode) break;
  }
  return options;
}
function trkBlankSampleRow(methodId, officers) {
  const meta = trkSampleMethodMeta(methodId || "TM-1");
  const names = Array.isArray(officers) ? officers.filter(Boolean) : [];
  return {
    trackerMethod: meta.id,
    requirementDate: trkDefaultSampleRequirementDate(),
    totalVendor: meta.defaultVendors,
    amount: 1386000000,
    assignedOfficerName: names[0] || "",
    lastStepCode: trkSampleMaxLastStepCode(meta.id),
  };
}
function TrkGenerateSampleDataModal({ open, onClose, onGenerated }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const personnelNo = trkActingPersonnelNo(session);
  const officers = useTrackerAssignableOfficers(personnelNo, open, {
    failClosed: !!(session && session.isImpersonating && !personnelNo),
  });
  const [count, setCount] = React.useState("");
  const [rows, setRows] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const methodOptions = trkSampleMethodOptions();
  const officerOptions = officers.map((name) => ({ value: name, label: name }));
  React.useEffect(() => {
    if (!open) return;
    setCount("");
    setRows([]);
    setBusy(false);
  }, [open]);
  React.useEffect(() => {
    if (!open || !officers.length) return;
    setRows((prev) => prev.map((row) => (
      officers.includes(row.assignedOfficerName) ? row : { ...row, assignedOfficerName: officers[0] || "" }
    )));
  }, [open, officers]);
  const applyCount = (raw) => {
    const text = String(raw || "").trim();
    const n = Number(text);
    if (!text || !Number.isFinite(n) || n < 1) {
      setCount(text);
      setRows([]);
      return;
    }
    const size = Math.min(5, Math.max(1, Math.floor(n)));
    setCount(String(size));
    setRows((prev) => {
      const next = [];
      for (let i = 0; i < size; i += 1) next.push(prev[i] ? { ...prev[i] } : trkBlankSampleRow(undefined, officers));
      return next;
    });
  };
  const updateRow = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      if (key === "trackerMethod") {
        const meta = trkSampleMethodMeta(value);
        return {
          ...row,
          trackerMethod: meta.id,
          totalVendor: meta.defaultVendors,
          lastStepCode: trkSampleMaxLastStepCode(meta.id),
        };
      }
      return { ...row, [key]: value };
    }));
  };
  const handleGenerate = async () => {
    if (!rows.length) {
      toast.push({ title: tt("Sample count required", "Jumlah sample wajib diisi"), description: tt("Enter 1–5 sample rows.", "Isi 1–5 baris sample."), tone: "warning" });
      return;
    }
    const invalid = rows.some((row) => {
      if (!row.trackerMethod || !row.requirementDate || !(Number(row.amount) > 0)) return true;
      if (row.lastStepCode && row.lastStepCode !== "READY" && !String(row.assignedOfficerName || "").trim()) return true;
      const meta = trkSampleMethodMeta(row.trackerMethod);
      const vendors = Number(row.totalVendor);
      return !(vendors >= meta.minVendors && vendors <= meta.maxVendors);
    });
    if (invalid) {
      toast.push({
        title: tt("Incomplete rows", "Baris belum lengkap"),
        description: tt("Fill method, date, vendors, value, and an officer when Last Step is beyond Ready.", "Lengkapi method, tanggal, vendor, nilai, dan officer bila Last Step di atas Ready."),
        tone: "warning",
      });
      return;
    }
    setBusy(true);
    try {
      const personnelNo = trkActingPersonnelNo(session);
      const actorName = (session.actingUser && session.actingUser.name) || "";
      const result = await trkGenerateSampleData(rows, personnelNo);
      if (!result.ok) {
        const expired = result.status === 401;
        if (expired && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ag:session-expired"));
        }
        const code = result.result && result.result.code;
        const mapped = code === "registered_vendors_insufficient"
          ? tt("Not enough Registered vendors in Vendor Database for Total Vendor.", "Vendor Database tidak punya cukup vendor berstatus Registered untuk Total Vendor.")
          : code === "total_vendor_invalid"
            ? tt("Total Vendor is outside the method min/max.", "Total Vendor di luar min/max method.")
            : (code || "");
        const detail = expired
          ? tt("Sign in again, then retry Generate Sample Data.", "Login lagi, lalu Generate Sample Data ulang.")
          : mapped
          || (result.status === 403 ? tt("Section Head role required.", "Role Section Head diperlukan.") : null)
          || (result.status === 404 ? tt("Sample-data API not found — restart the backend.", "API sample-data tidak ditemukan — restart backend.") : null)
          || (result.status ? `HTTP ${result.status}` : null)
          || tt("Could not create sample proposals.", "Tidak dapat membuat sample proposal.");
        toast.push({
          title: expired ? tt("Session expired", "Sesi berakhir") : tt("Generate failed", "Generate gagal"),
          description: detail,
          tone: "error",
        });
        return;
      }
      const created = result.proposals || [];
      const failures = [];
      for (let i = 0; i < created.length; i += 1) {
        const createdRow = created[i];
        const inputRow = rows[i] || rows[0];
        const proposalId = (createdRow && (createdRow.proposalKey || createdRow.id || createdRow.proposalNumber)) || "";
        if (!proposalId) continue;
        try {
          await trkAdvanceGeneratedSample(proposalId, inputRow, actorName);
        } catch (e) {
          const message = (e && e.message) || String(e);
          failures.push(`${proposalId}: ${message}`);
          if (/401/.test(message)) {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ag:session-expired"));
            }
            toast.push({
              title: tt("Session expired", "Sesi berakhir"),
              description: tt("Sign in again, then retry Generate Sample Data.", "Login lagi, lalu Generate Sample Data ulang."),
              tone: "error",
            });
            break;
          }
          toast.push({
            title: tt("Sample workflow failed", "Alur sample gagal"),
            description: message,
            tone: "error",
          });
        }
      }
      await trkHydrateFromDomain(true);
      const advanced = rows.some((r) => r.lastStepCode && r.lastStepCode !== "READY");
      toast.push({
        title: failures.length
          ? tt("Sample data generated with errors", "Sample data dibuat dengan error")
          : tt("Sample data generated", "Sample data dibuat"),
        description: failures.length
          ? failures.join(" · ")
          : advanced
            ? tt(`${result.added} proposal(s) generated with workflow progress and documents.`, `${result.added} proposal dibuat dengan progress workflow dan dokumen.`)
            : tt(`${result.added} proposal(s) ready to distribute.`, `${result.added} proposal siap didistribusikan.`),
        tone: failures.length ? "warning" : undefined,
      });
      onClose && onClose();
      onGenerated && onGenerated(result);
    } catch (e) {
      const message = (e && e.message) || String(e);
      const expired = /401/.test(message);
      if (expired && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ag:session-expired"));
      }
      toast.push({
        title: expired ? tt("Session expired", "Sesi berakhir") : tt("Generate failed", "Generate gagal"),
        description: expired
          ? tt("Sign in again, then retry Generate Sample Data.", "Login lagi, lalu Generate Sample Data ulang.")
          : message,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose && onClose(); }}
      width={1100}
      icon="sparkles"
      title={tt("Generate Sample Data", "Generate Sample Data")}
      subtitle={tt("Create temporary proposals owned by you while E-Proposal ingest is unavailable. Recommended vendors come from Vendor Database (Registered). Beyond Ready, samples follow the same upload and Complete Activity path as an officer.", "Buat proposal sementara milik Anda selama ingest E-Proposal belum tersedia. Recommended vendor diambil dari Vendor Database (status Registered). Di atas Ready, sample mengikuti jalur upload dan Complete Activity yang sama dengan officer.")}
      footer={<>
        <Button variant="secondary" disabled={busy} onClick={onClose}>{tt("Cancel", "Batal")}</Button>
        <Button iconLeft="sparkles" disabled={busy || !rows.length} onClick={handleGenerate}>{busy ? tt("Generating...", "Membuat...") : tt("Generate", "Generate")}</Button>
      </>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Total sample data", "Total sample data")} helper={tt("Maximum 5 proposals per generate. Recommended vendors are taken from Vendor Database (Registered).", "Maksimal 5 proposal per generate. Recommended vendor diambil dari Vendor Database (status Registered).")} required>
          <TextInput
            type="number"
            size="sm"
            value={count}
            min={1}
            max={5}
            placeholder="1–5"
            onChange={(e) => applyCount(e.target.value)}
          />
        </Field>
        {rows.length > 0 && (
          <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, overflow: "auto" }}>
            <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ backgroundColor: C.surfaceAlt }}>
                  <th style={{ ...FONT, width: 36, padding: "8px 8px", fontSize: 10, color: C.textMuted, textAlign: "left" }}>#</th>
                  <th style={{ ...FONT, width: 140, padding: "8px 8px", fontSize: 10, color: C.textMuted, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>{tt("Tracker Method", "Tracker Method")}</th>
                  <th style={{ ...FONT, width: 130, padding: "8px 8px", fontSize: 10, color: C.textMuted, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>Requirement Date</th>
                  <th style={{ ...FONT, width: 80, padding: "8px 8px", fontSize: 10, color: C.textMuted, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Vendor</th>
                  <th style={{ ...FONT, width: 120, padding: "8px 8px", fontSize: 10, color: C.textMuted, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>{tt("Value", "Nilai")}</th>
                  <th style={{ ...FONT, width: 160, padding: "8px 8px", fontSize: 10, color: C.textMuted, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>{tt("Assigned Officer", "Assigned Officer")}</th>
                  <th style={{ ...FONT, width: 220, padding: "8px 8px", fontSize: 10, color: C.textMuted, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>{tt("Last Step", "Last Step")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const meta = trkSampleMethodMeta(row.trackerMethod);
                  const vendorOptions = [];
                  for (let n = meta.minVendors; n <= meta.maxVendors; n += 1) vendorOptions.push({ value: String(n), label: String(n) });
                  const lastStepOptions = trkSampleLastStepOptions(row.trackerMethod);
                  return (
                    <tr key={index} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                      <td style={{ padding: "8px 8px", fontSize: 12, color: C.textMuted }}>{index + 1}</td>
                      <td style={{ padding: "8px 8px" }}>
                        <Select size="sm" value={row.trackerMethod} onChange={(e) => updateRow(index, "trackerMethod", e.target.value)} options={methodOptions} />
                      </td>
                      <td style={{ padding: "8px 8px" }}>
                        <TextInput size="sm" type="date" value={row.requirementDate || ""} onChange={(e) => updateRow(index, "requirementDate", e.target.value)} />
                      </td>
                      <td style={{ padding: "8px 8px" }}>
                        <Select
                          size="sm"
                          value={String(row.totalVendor)}
                          onChange={(e) => updateRow(index, "totalVendor", Number(e.target.value))}
                          options={vendorOptions}
                        />
                      </td>
                      <td style={{ padding: "8px 8px" }}>
                        <TextInput
                          size="sm"
                          type="number"
                          min={1}
                          value={row.amount == null ? "" : String(row.amount)}
                          onChange={(e) => updateRow(index, "amount", Number(e.target.value) || 0)}
                        />
                      </td>
                      <td style={{ padding: "8px 8px" }}>
                        <Select
                          size="sm"
                          value={row.assignedOfficerName || ""}
                          onChange={(e) => updateRow(index, "assignedOfficerName", e.target.value)}
                          options={officerOptions.length ? officerOptions : [{ value: "", label: tt("No officers under you", "Tidak ada officer di bawah Anda") }]}
                        />
                      </td>
                      <td style={{ padding: "8px 8px" }}>
                        <Select
                          size="sm"
                          value={row.lastStepCode || "READY"}
                          onChange={(e) => updateRow(index, "lastStepCode", e.target.value)}
                          options={lastStepOptions}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
function DistributionModal({ proposal, onClose }) {
  const C = useC();
  const { lang } = useI18n();
  const toast = useToast();
  const session = useSession();
  const personnelNo = trkActingPersonnelNo(session);
  const officers = useTrackerAssignableOfficers(personnelNo, !!proposal, {
    failClosed: !!(session && session.isImpersonating && !personnelNo),
  });
  const officerOptions = officers.map((name) => ({ value: name, label: name }));
  const [officer, setOfficer] = React.useState("");
  const [trackerMethod, setTrackerMethod] = React.useState((proposal && proposal.trackerMethod) || "");
  const [startDate, setStartDate] = React.useState(TRK_TODAY);
  const [adjustedSla, setAdjustedSla] = React.useState({});
  const strategyPlaceholder = "Assigned based on workload, site familiarity, and commodity experience.";
  const [strategy, setStrategy] = React.useState("");
  const proposalKey = proposal ? `${proposal.id}:${proposal.requirementDate}` : "";
  React.useEffect(() => {
    if (!proposal) return;
    const nextMethod = proposal.trackerMethod || ((TRK_METHODS[0] && TRK_METHODS[0].id) || "");
    const rows = trkStageRows(nextMethod);
    const nextStart = trkClampStartToRequirement(proposal.startActivityDate || TRK_TODAY, proposal);
    const preferred = proposal.assignedOfficerName && officers.includes(proposal.assignedOfficerName)
      ? proposal.assignedOfficerName
      : (officers[0] || "");
    setOfficer(preferred);
    setTrackerMethod(nextMethod);
    setStartDate(nextStart);
    setStrategy((proposal.distribution && proposal.distribution.strategy) || "");
    setAdjustedSla(trkMasterSlaMap(rows));
  }, [proposalKey]);
  React.useEffect(() => {
    if (!officers.length) return;
    setOfficer((current) => (officers.includes(current) ? current : officers[0]));
  }, [officers]);
  if (!proposal) return null;
  const methodId = trackerMethod || proposal.trackerMethod;
  const method = trkMethodById(methodId);
  const stages = trkStageRows(methodId);
  const methodOptions = (TRK_METHODS || []).map((row) => ({ value: row.id, label: row.name }));
  const canUseWorkingCalendar = typeof trkWorkingDaysBetween === "function" && typeof trkCumulativeTargetDates === "function";
  const masterTotal = stages.reduce((sum, stage) => sum + (stage.slaDays || 0), 0);
  const budgetDays = trkSlaBudgetForProposal(proposal, startDate);
  const adjustedFor = (stage) => {
    const value = adjustedSla[stage.id] != null ? Number(adjustedSla[stage.id]) : stage.slaDays;
    return Math.max(0, Math.floor(Number.isFinite(value) ? value : stage.slaDays));
  };
  const adjustedDays = stages.map(adjustedFor);
  const adjustedTotal = adjustedDays.reduce((sum, days) => sum + days, 0);
  const targetDates = canUseWorkingCalendar
    ? trkCumulativeTargetDates(startDate, adjustedDays)
    : adjustedDays.reduce((rows, days, index) => {
      const prev = index === 0 ? startDate : rows[index - 1];
      rows.push(trkAddDays(prev, days));
      return rows;
    }, []);
  const planRows = stages.map((stage, index) => ({ ...stage, adjusted: adjustedDays[index], target: targetDates[index] }));
  const budgetIsEnough = budgetDays >= masterTotal;
  const adjustedFits = adjustedTotal <= budgetDays;
  const deltaToMaster = budgetDays - masterTotal;
  const deltaToAdjusted = budgetDays - adjustedTotal;
  const finalTarget = planRows.length ? planRows[planRows.length - 1].target : startDate;
  const budgetColor = !adjustedFits ? C.danger : budgetIsEnough ? C.success : C.danger;
  const budgetBg = !adjustedFits ? C.dangerBg : budgetIsEnough ? C.successBg : C.dangerBg;
  const budgetNote = !adjustedFits
    ? `Adjusted SLA exceeds the available working-day window by ${Math.abs(deltaToAdjusted)} days. Distribute is still allowed; Adjusted SLA is not capped by the requirement date.`
    : budgetIsEnough
      ? `Window is healthy: ${Math.max(0, deltaToMaster)} spare working days remain against the master SLA.`
      : `Master SLA exceeds the available working-day window by ${Math.abs(deltaToMaster)} days. Adjusted SLA is not capped by the requirement date.`;
  const adjustedPayload = stages.reduce((acc, stage) => {
    acc[stage.id] = adjustedFor(stage);
    return acc;
  }, {});
  const setStartWithinRequirement = (value) => {
    setStartDate(trkClampStartToRequirement(value, proposal));
  };
  const setStageAdjusted = (stageId, value) => {
    setAdjustedSla((prev) => ({ ...prev, [stageId]: trkCleanSlaDayValue(value, 0) }));
  };
  const applyMethod = (nextId) => {
    setTrackerMethod(nextId);
    setAdjustedSla(trkMasterSlaMap(trkStageRows(nextId)));
  };
  const controlHeight = 34;
  const readonlyBox = (value, icon) => (
    <div style={{ ...FONT, height: controlHeight, display: "flex", alignItems: "center", gap: 9, padding: "0 12px", borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceInset, color: C.text, fontSize: 13, fontWeight: 600 }}>
      {icon && <Icon name={icon} size={14} color={C.textMuted} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
  const formRow = (label, child) => (
    <div style={{ display: "grid", gridTemplateColumns: "128px minmax(0, 1fr)", alignItems: "center", gap: 12, minWidth: 0 }}>
      <label style={{ ...FONT, fontSize: 11.5, fontWeight: 600, color: C.textMuted, letterSpacing: 0 }}>{label}</label>
      {child}
    </div>
  );
  const sectionHead = (title, icon, action) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <Icon name={icon} size={14} color={C.ocean} />
      <span style={{ ...FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textSubtle }}>{title}</span>
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
  const metric = (label, value, tone, helper) => {
    const color = tone === "success" ? C.success : tone === "danger" ? C.danger : tone === "brand" ? C.ocean : C.text;
    const bg = tone === "success" ? C.successBg : tone === "danger" ? C.dangerBg : tone === "brand" ? C.brandBg : C.surfaceInset;
    return (
      <div style={{ border: `1px solid ${tone === "neutral" ? C.borderSoft : color + "33"}`, backgroundColor: bg, borderRadius: RADIUS.md, padding: "9px 10px", minWidth: 0 }}>
        <div style={{ ...FONT, fontSize: 10, lineHeight: 1.2, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>{label}</div>
        <div style={{ ...FONT, marginTop: 5, fontSize: 16.5, lineHeight: 1, fontWeight: 700, color }}>{value}</div>
        {helper && <div style={{ ...FONT, marginTop: 6, fontSize: 11.5, lineHeight: 1.35, color: C.textMuted }}>{helper}</div>}
      </div>
    );
  };
  return (
    <Modal open={!!proposal} onClose={onClose} width={585} icon="send" title="Distribute Proposal" subtitle={<span style={{ ...FONT, display: "block", fontSize: 11.4, lineHeight: 1.35 }}>Assign the ready proposal to an officer to generate the operational timeline and start SLA monitoring.</span>}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button iconLeft="send" disabled={!officer || !startDate} onClick={() => { trkDistributeProposal(proposal.id, { assignedOfficerName: officer, distributedByName: (session.actingUser && session.actingUser.name) || proposal.ownerName, startActivityDate: startDate, trackerMethod: methodId, adjustedSla: adjustedPayload, strategy: strategy.trim() || undefined, forPersonnelNo: personnelNo }); toast.push({ title: "Proposal distributed", description: `${proposal.proposalNumber} -> ${officer}` }); onClose(); }}>Distribute</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <section style={{ border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ ...FONT, fontSize: 17.5, lineHeight: 1.15, fontWeight: 600, color: C.text, letterSpacing: 0 }}>{proposal.proposalNumber}</div>
            <div style={{ ...FONT, marginTop: 6, fontSize: 13.5, lineHeight: 1.42, color: C.textMuted, fontWeight: 500 }}>{proposal.title}</div>
          </div>
        </section>

        <section style={{ marginBottom: 0 }}>
          {sectionHead("Assignment setup", "users-round", <span style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 8px", borderRadius: RADIUS.pill, backgroundColor: budgetBg, color: budgetColor, fontSize: 10.5, fontWeight: 600 }}><Icon name={(budgetIsEnough && adjustedFits) ? "check-circle-2" : "alert-triangle"} size={11} />{(budgetIsEnough && adjustedFits) ? "Healthy" : "Over window"}</span>)}
          <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, backgroundColor: C.surface, padding: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {formRow("Assigned Officer", <Select size="sm" value={officer} onChange={(e) => setOfficer(e.target.value)} options={officerOptions.length ? officerOptions : [{ value: "", label: "No officers under you" }]} style={{ height: controlHeight }} />)}
              {formRow("Method", <Select size="sm" value={methodId} onChange={(e) => applyMethod(e.target.value)} options={methodOptions.length ? methodOptions : [{ value: methodId, label: (method && method.name) || methodId }]} style={{ height: controlHeight }} />)}
              {formRow("Start Activity", <TextInput size="sm" type="date" value={startDate} onChange={(e) => setStartWithinRequirement(e.target.value)} iconLeft="calendar" style={{ height: controlHeight }} />)}
              {formRow("Requirement Date", readonlyBox(trkFmtDate(proposal.requirementDate, lang), "calendar-check"))}
              {formRow("Estimated Finish Date", readonlyBox(trkFmtDate(finalTarget, lang), "calendar-days"))}
              <div style={{ display: "grid", gridTemplateColumns: "128px minmax(0, 1fr)", gap: 12, alignItems: "start", marginTop: 2 }}>
                <label style={{ ...FONT, fontSize: 11.5, fontWeight: 600, color: C.textMuted, paddingTop: 9 }}>Distribution Strategy</label>
                <Textarea rows={3} value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder={strategyPlaceholder} style={{ minHeight: 68, fontSize: 12.2, lineHeight: 1.45, resize: "vertical" }} />
              </div>
            </div>
          </div>
        </section>

        <section style={{ border: `1px solid ${budgetColor}33`, backgroundColor: budgetBg, borderRadius: RADIUS.md, padding: "11px 12px" }}>
          <div style={{ minWidth: 0, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Icon name="calendar-clock" size={15} color={budgetColor} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...FONT, fontSize: 13, fontWeight: 600, color: C.text }}>Working-day SLA budget</div>
              <div style={{ ...FONT, marginTop: 4, fontSize: 11.6, lineHeight: 1.42, color: C.textMuted }}>Req date minus start date using the Holiday master calendar. Weekends and holidays are excluded.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 11 }} className="ag-trk-row3">
                {metric("Req - Start", `${budgetDays}d`, budgetIsEnough ? "success" : "danger", "working days")}
                {metric("Master SLA", `${masterTotal}d`, "neutral", `${stages.length} steps`)}
                {metric("Adjusted", `${adjustedTotal}d`, adjustedFits ? "success" : "danger", `${deltaToAdjusted >= 0 ? deltaToAdjusted : Math.abs(deltaToAdjusted)}d ${deltaToAdjusted >= 0 ? "slack" : "over"}`)}
              </div>
              <div style={{ ...FONT, marginTop: 9, fontSize: 11.6, lineHeight: 1.42, color: budgetColor, fontWeight: 600 }}>{budgetNote}</div>
            </div>
          </div>
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <div>
              <h3 style={{ ...FONT, margin: 0, fontSize: 15.5, lineHeight: 1.2, color: C.text, fontWeight: 600 }}>SLA plan - adjustable per step</h3>
              <div style={{ ...FONT, marginTop: 3, fontSize: 11.4, color: C.textMuted }}>Target dates are recalculated from the start date with working days only.</div>
            </div>
            <div style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>
              <span>Master <b style={{ color: C.text, fontWeight: 600 }}>{masterTotal}d</b></span>
              <span style={{ color: C.textSubtle }}>-</span>
              <span>Adjusted <b style={{ color: adjustedFits ? C.success : C.danger, fontWeight: 600 }}>{adjustedTotal}d</b></span>
            </div>
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: C.surface, boxShadow: C.shadowSm }}>
            <table style={{ ...FONT, width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Step", "Master SLA", "Adjusted", "Target"].map((h) => <th key={h} style={{ textAlign: h === "Step" ? "left" : "center", padding: "10px 10px", backgroundColor: C.surfaceAlt, color: C.textMuted, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{h === "Target" ? <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1, lineHeight: 1.1 }}><span>Target</span><span style={{ fontSize: 9.5, fontWeight: 500, textTransform: "none" }}>(Plan)</span></span> : h}</th>)}
                </tr>
              </thead>
              <tbody>
                {planRows.map((row, index) => (
                  <tr key={row.id} style={{ backgroundColor: index % 2 ? C.surfaceInset : C.surface }}>
                    <td style={{ padding: "9px 10px", borderBottom: index === planRows.length - 1 ? "none" : `1px solid ${C.borderSoft}`, fontWeight: 500, color: C.text }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 21, marginRight: 7, color: C.textSubtle, fontFamily: "monospace", fontSize: 11, fontWeight: 500 }}>{String(index + 1).padStart(2, "0")}</span>
                      <span style={{ color: C.ocean, fontWeight: 500 }}>{row.name}</span>
                    </td>
                    <td style={{ padding: "9px 10px", borderBottom: index === planRows.length - 1 ? "none" : `1px solid ${C.borderSoft}`, textAlign: "center", color: C.textMuted, fontSize: 13.5, fontWeight: 500 }}>{row.slaDays}d</td>
                    <td style={{ padding: "6px 10px", borderBottom: index === planRows.length - 1 ? "none" : `1px solid ${C.borderSoft}`, textAlign: "center" }}>
                      <TrkSlaStepper value={row.adjusted} onChange={(next) => setStageAdjusted(row.id, next)} />
                    </td>
                    <td style={{ padding: "9px 10px", borderBottom: index === planRows.length - 1 ? "none" : `1px solid ${C.borderSoft}`, textAlign: "center", color: C.ocean, fontSize: 12.8, fontWeight: 500 }}>{trkFmtDate(row.target, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function TrkAssignOfficerModal({ proposal, onClose }) {
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const personnelNo = trkActingPersonnelNo(session);
  const officers = useTrackerAssignableOfficers(personnelNo, !!proposal, {
    failClosed: !!(session && session.isImpersonating && !personnelNo),
  });
  const officerOptions = officers.map((name) => ({ value: name, label: name }));
  const [officer, setOfficer] = React.useState("");
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    if (!proposal) return;
    setOfficer("");
    setReason("");
  }, [proposal && proposal.id]);
  React.useEffect(() => {
    if (!officers.length) return;
    setOfficer((current) => (officers.includes(current) ? current : ""));
  }, [officers]);
  if (!proposal) return null;
  const unchanged = !officer || officer === proposal.assignedOfficerName;
  const submit = () => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.ownerName;
    trkReassignProposalOfficer(proposal.id, officer, actor, reason.trim(), personnelNo);
    toast.push({ title: tt("Officer reassigned", "Officer dipindahkan"), description: `${proposal.proposalNumber} -> ${officer}` });
    onClose && onClose();
  };
  return (
    <Modal
      open={!!proposal}
      onClose={onClose}
      width={560}
      icon="user-round-cog"
      title={tt("Reassign Officer", "Pindahkan Officer")}
      subtitle={`${proposal.proposalNumber} - ${proposal.currentStage}`}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="user-round-check" disabled={!officer || unchanged} onClick={submit}>{tt("Reassign", "Pindahkan")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Alert tone="info" title={tt("OnProgress responsibility transfer", "Pemindahan tanggung jawab OnProgress")} description={tt("Section Head can move active proposal ownership when the assigned officer is unavailable.", "Section Head dapat memindahkan tanggung jawab proposal aktif ketika officer berhalangan.")} />
        <Field label={tt("Current officer", "Officer saat ini")}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 38 }}>
            <Avatar name={proposal.assignedOfficerName || "-"} size={28} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{proposal.assignedOfficerName || "-"}</span>
          </div>
        </Field>
        <Field label={tt("Assign to", "Assign ke")} required helper={unchanged ? tt("Choose a different officer.", "Pilih officer yang berbeda.") : tt("The new officer will continue from the current active step.", "Officer baru melanjutkan dari step aktif saat ini.")}>
          <Select value={officer} onChange={(event) => setOfficer(event.target.value)} options={officerOptions.length ? officerOptions : [{ value: "", label: tt("No officers under you", "Tidak ada officer di bawah Anda") }]} />
        </Field>
        <Field label={tt("Reason (optional)", "Alasan (opsional)")}>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={tt("Example: Current officer is on site duty this week.", "Contoh: Officer saat ini sedang tugas site minggu ini.")} />
        </Field>
      </div>
    </Modal>
  );
}

function CompleteModal({ proposal, activity, onClose, onCompleted, onNavigate, onOpenCipCase }) {
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const initialRemark = activity ? (activity.completionRemark || `Completed ${activity.title}; evidence reviewed and uploaded.`) : "";
  const initialEvidence = activity ? ((activity.completionEvidenceNames && activity.completionEvidenceNames.length ? activity.completionEvidenceNames : [`${activity.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${proposal.id}.pdf`]).join(", ")) : "";
  const [remark, setRemark] = React.useState(initialRemark);
  const [evidence, setEvidence] = React.useState(initialEvidence);
  const [completeDate, setCompleteDate] = React.useState(TRK_TODAY);
  React.useEffect(() => {
    if (activity) {
      const names = activity.completionEvidenceNames && activity.completionEvidenceNames.length ? activity.completionEvidenceNames : [`${activity.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${proposal.id}.pdf`];
      setRemark(activity.completionRemark || `Completed ${activity.title}; evidence reviewed and uploaded.`);
      setEvidence(names.join(", "));
      setCompleteDate((activity.completedAt ? String(activity.completedAt).split(" ")[0] : null) || TRK_TODAY);
    }
  }, [activity && activity.id]);
  if (!proposal || !activity) return null;
  const completeDisabled = !remark.trim() || !completeDate;
  const onSubmit = async () => {
    const names = evidence.split(",").map((x) => x.trim()).filter(Boolean);
    const at = (completeDate === TRK_TODAY && typeof trkNow === "function") ? trkNow() : `${completeDate} 10:00:00`;
    try {
      await trkCompleteActivity(proposal.id, activity.id, { remark, evidenceNames: Array.from(new Set(names)), at, completedAt: at });
      toast.push({ title: tt("Activity completed", "Aktivitas selesai"), description: activity.title });
    } catch (error) {
      toast.push({ title: tt("Activity completion failed", "Complete Activity gagal"), description: (error && error.message) || activity.title, tone: "error" });
      return;
    }
    // Record the commercial/award result into the domain (trk.AWARD_RESULT_*) so CIP can build the
    // Term Sheet per winner. The award-defining step depends on the procurement method:
    //  - Tender / Pemilihan Langsung → Bid Evaluation (winners picked in its panel), source "BidEvaluation".
    //  - Penunjukan Langsung (no Bid Evaluation) → Negotiation, winner = the directly-appointed vendor,
    //    source "Negotiation".
    // KV stays the UI source of truth; this is a domain hand-off, so a failure is non-fatal to the
    // local complete but is surfaced to the officer.
    const isBidEval = trkIsBidEvaluationActivity(activity);
    const isDirectAppointment = !trkMethodHasBidEvaluation(proposal);
    const isNegotiationAward = isDirectAppointment && trkIsNegotiationActivity(activity);
    let awardSource = null;
    let winnerIds = [];
    let awardWinnerValues = {};
    if (isBidEval) {
      awardSource = "BidEvaluation";
      const bid = trkBidEvalForActivity(trkLoadBidEvalState(proposal), activity.id);
      winnerIds = bid.winnerVendorIds || [];
      if (!winnerIds.length) winnerIds = trkWinnerIdsFromActivity(activity);
      awardWinnerValues = bid.winnerValues || {};
    } else if (isNegotiationAward) {
      awardSource = "Negotiation";
      winnerIds = trkDirectAppointmentWinnerIds(proposal);
    }
    const actor = (session && session.actingUser && session.actingUser.name) || proposal.ownerName || proposal.assignedOfficerName;
    onClose();
    onCompleted && onCompleted();
    if (awardSource && !winnerIds.length) {
      toast.push({
        title: tt("Term Sheet not opened", "Term Sheet belum dibuka"),
        description: tt(
          "Bid Evaluation is complete, but no winner vendor was recorded — Tracker has nothing to open.",
          "Bid Evaluation selesai, tetapi winner vendor belum tercatat — Tracker tidak punya kasus untuk dibuka."),
        tone: "warning",
      });
    } else if (awardSource && winnerIds.length) {
      const saved = await trkSaveAwardResult(proposal.id, trkBuildAwardResultRequest(proposal, winnerIds, actor, awardSource, null, awardWinnerValues));
      if (!saved.ok) {
        toast.push({
          title: tt("Award not synced", "Award belum tersinkron"),
          description: tt(
            "Activity saved, but the award result could not reach the server — Term Sheet may not see it yet.",
            "Aktivitas tersimpan, tetapi hasil award gagal dikirim ke server — Term Sheet mungkin belum melihatnya."),
          tone: "warning",
        });
      } else if (typeof trkCreateCipCasesFromAward === "function") {
        const cip = await trkCreateCipCasesFromAward(proposal.id, actor);
        if (!cip.ok) {
          toast.push({
            title: tt("Term Sheet not opened", "Term Sheet belum dibuka"),
            description: tt(
              "Award saved, but Term Sheet cases could not be created from the award result.",
              "Award tersimpan, tetapi kasus Term Sheet belum bisa dibuat dari hasil award."),
            tone: "warning",
          });
        } else if (cip.data && ((cip.data.created || []).length || cip.data.existing)) {
          const created = cip.data.created || [];
          toast.push({
            title: tt("Term Sheet ready", "Term Sheet siap"),
            description: tt(
              `${created.length || cip.data.existing} winner panel(s) are ready on this proposal.`,
              `${created.length || cip.data.existing} panel pemenang siap di proposal ini.`),
            tone: "success",
          });
          try { await cipRefreshDomainCases(); } catch (e) { /* embed hydrates on mount */ }
        }
      }
    }
  };
  return (
    <Modal open={!!activity} onClose={onClose} width={560} icon="check-circle-2" title={tt("Complete activity", "Selesaikan aktivitas")} subtitle={activity.title}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" disabled={completeDisabled} onClick={onSubmit}>{tt("Complete", "Selesaikan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Completed date", "Tanggal selesai")} required helper={tt("Date this activity was completed.", "Tanggal activity ini diselesaikan.")}>
          <TextInput type="date" value={completeDate} onChange={(e) => setCompleteDate(e.target.value)} iconLeft="calendar" />
        </Field>
        <Field label={tt("Remark", "Catatan")} required><Textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function TrkCancelReasonModal({ proposal, activity, onClose, onSubmit }) {
  const tt = useTT();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (activity) {
      setReason("");
      setError("");
    }
  }, [activity && activity.id]);
  if (!proposal || !activity) return null;
  const submit = () => {
    const value = reason.trim();
    if (value.length <= 10) {
      setError(tt("Cancel reason must be more than 10 characters.", "Alasan cancel harus lebih dari 10 karakter."));
      return;
    }
    onSubmit && onSubmit(activity, value);
  };
  return (
    <Modal
      open={!!activity}
      onClose={onClose}
      width={560}
      icon="ban"
      title={tt("Cancel Proposal", "Cancel Proposal")}
      subtitle={`${proposal.proposalNumber} - ${activity.title}`}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Back", "Kembali")}</Button><Button variant="destructive" iconLeft="ban" disabled={reason.trim().length <= 10} onClick={submit}>{tt("Cancel Proposal", "Cancel Proposal")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Alert tone="error" title={tt("This will stop the tracker workflow.", "Workflow Tracker akan dihentikan.")} description={tt("All pending and locked steps after this activity will be locked as canceled.", "Semua step pending dan locked setelah activity ini akan dikunci sebagai canceled.")} />
        <Field label={tt("Cancel Reason", "Alasan Cancel")} required helper={error || tt("Write the business reason from Section Head before canceling.", "Tuliskan alasan bisnis dari Section Head sebelum cancel.")} status={error ? "error" : undefined}>
          <Textarea rows={4} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder={tt("Example: User department cancels the procurement need after budget reprioritization.", "Contoh: User department membatalkan kebutuhan procurement karena reprioritasi budget.")} style={{ minHeight: 112 }} />
        </Field>
      </div>
    </Modal>
  );
}

function TrkRecycleReasonModal({ proposal, activity, onClose, onSubmit }) {
  const tt = useTT();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (activity) {
      setReason("");
      setError("");
    }
  }, [activity && activity.id]);
  if (!proposal || !activity) return null;
  const submit = () => {
    const value = reason.trim();
    if (!value) {
      setError(tt("Recycle reason is required.", "Alasan recycle wajib diisi."));
      return;
    }
    onSubmit && onSubmit(activity, value);
  };
  return (
    <Modal
      open={!!activity}
      onClose={onClose}
      width={560}
      icon="rotate-ccw"
      title={tt("Recycle Activity", "Recycle Activity")}
      subtitle={`${proposal.proposalNumber} - ${activity.title}`}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Back", "Kembali")}</Button><Button variant="secondary" iconLeft="rotate-ccw" disabled={!reason.trim()} onClick={submit}>{tt("Recycle", "Recycle")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Alert tone="warning" title={tt("This will reopen the selected activity.", "Activity ini akan dibuka ulang.")} description={tt("Steps after this activity will be locked again until the recycled activity is completed.", "Step setelah activity ini akan dikunci kembali sampai activity yang direcycle diselesaikan.")} />
        <Field label={tt("Recycle Reason", "Alasan Recycle")} required helper={error || tt("Write the business reason before recycling this activity.", "Tuliskan alasan bisnis sebelum recycle activity ini.")} status={error ? "error" : undefined}>
          <Textarea rows={4} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder={tt("Example: User department submitted a technical addendum that requires this step to be reworked.", "Contoh: User department mengirim addendum teknis sehingga step ini perlu dikerjakan ulang.")} style={{ minHeight: 112 }} />
        </Field>
      </div>
    </Modal>
  );
}

function trkDetailDate(value) {
  if (!value) return "-";
  return typeof fmtAppDateTime === "function" ? fmtAppDateTime(value) : fmtAppDate(value);
}
function trkHistoryEventLabel(type, tt) {
  const labels = {
    Distributed: tt("Distributed", "Didistribusikan"),
    Started: tt("Started", "Dimulai"),
    Completed: tt("Completed", "Selesai"),
    Recycle: tt("Recycle", "Recycle"),
    RecycleRequested: tt("Recycle requested", "Recycle diajukan"),
    RecycleApproved: tt("Recycle approved", "Recycle disetujui"),
    RecycleRejected: tt("Recycle rejected", "Recycle ditolak"),
    CancelProposal: tt("Cancel proposal", "Cancel proposal"),
    CancelProposalRequested: tt("Cancel requested", "Cancel diajukan"),
    CancelProposalApproved: tt("Cancel approved", "Cancel disetujui"),
    CancelProposalRejected: tt("Cancel rejected", "Cancel ditolak"),
    LoaGenerated: tt("LOA generated", "LOA dibuat"),
    Reassigned: tt("Officer reassigned", "Officer dipindahkan"),
    ProposalCompleted: tt("Proposal completed", "Proposal selesai"),
  };
  return labels[type] || type;
}
function trkHistoryTone(C, type) {
  if (type === "LoaGenerated") return { color: C.info, bg: C.infoBg, icon: "file-check-2" };
  if (type === "Reassigned") return { color: C.ocean, bg: C.brandBg, icon: "user-round-cog" };
  if (type === "Completed" || type === "ProposalCompleted") return { color: C.success, bg: C.successBg, icon: "check" };
  if (type === "Distributed" || type === "Started") return { color: C.ocean, bg: C.brandBg, icon: "play" };
  if (type.indexOf("Rejected") >= 0 || type.indexOf("Cancel") >= 0) return { color: C.danger, bg: C.dangerBg, icon: type.indexOf("Cancel") >= 0 ? "ban" : "x" };
  if (type.indexOf("Recycle") >= 0) return { color: C.orange, bg: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)", icon: "rotate-ccw" };
  return { color: C.textSubtle, bg: C.surfaceAlt, icon: "history" };
}
/* Per-step palette for Activity History: every event inherits the color of the STEP it belongs to,
   so the trail reads as colored bands per stage (not per event type). Proposal-level events
   (distribution, completion) fall back to a neutral subtle tone. */
const TRK_STEP_HISTORY_PALETTE = [
  { light: "#0F828A", dark: "#3FB6BE" }, // teal
  { light: "#005C96", dark: "#4AA3D6" }, // blue
  { light: "#11713B", dark: "#4FB477" }, // green
  { light: "#B26B00", dark: "#D8A24A" }, // amber
  { light: "#7C5CBF", dark: "#B49BE8" }, // purple
  { light: "#C2477F", dark: "#E78BB4" }, // rose
  { light: "#1F7A8C", dark: "#5FC9D6" }, // cyan
  { light: "#5A6B8C", dark: "#9AAAC9" }, // slate
];
function trkStepHistoryColor(C, stepIndex) {
  if (stepIndex == null) return C.textSubtle;
  const p = TRK_STEP_HISTORY_PALETTE[stepIndex % TRK_STEP_HISTORY_PALETTE.length];
  return C.scheme === "dark" ? p.dark : p.light;
}
function trkHistoryPassthroughType(type) {
  return type === "Created" || type === "Reset" || type === "HoldByRecycle" || type === "HoldByModifyProposal";
}
function trkBuildActivityHistory(proposal) {
  const events = [];
  if (proposal.distribution) {
    events.push({
      id: `${proposal.id}-distributed`,
      type: "Distributed",
      at: proposal.distribution.distributedAt,
      actorName: proposal.distribution.distributedByName,
      message: `Proposal distributed to ${proposal.distribution.assignedOfficerName}.`,
    });
  }
  const seenRecycleApproveAt = {};
  const seenRecycleRejectAt = {};
  const seenModifyApproveAt = {};
  const seenModifyRejectAt = {};
  (proposal.activities || []).forEach((activity, index) => {
    const history = activity.history || [];
    const pushEvent = (event, eventIndex) => events.push({
      id: event.id || `${activity.id}-${event.type}-${eventIndex}`,
      type: event.type,
      at: event.at || proposal.updatedAt,
      actorName: event.actorName,
      message: event.message,
      activityTitle: activity.title,
      stepIndex: index,
    });
    history.forEach((event, eventIndex) => {
      if (!event || trkHistoryPassthroughType(event.type)) return;
      if (event.type === "RecycleApproved") {
        const isTarget = history.some((item) => item.type === "Reset" && item.at === event.at);
        if (!isTarget || seenRecycleApproveAt[event.at]) return;
        seenRecycleApproveAt[event.at] = true;
        pushEvent(event, eventIndex);
        return;
      }
      if (event.type === "RecycleRejected") {
        if (seenRecycleRejectAt[event.at]) return;
        seenRecycleRejectAt[event.at] = true;
        pushEvent(event, eventIndex);
        return;
      }
      if (event.type === "ModifyProposalApproved" || event.type === "CancelProposalApproved") {
        const isTarget = event.type === "CancelProposalApproved" || history.some((item) => item.type === "Reset" && item.at === event.at);
        if (!isTarget || seenModifyApproveAt[event.at]) return;
        seenModifyApproveAt[event.at] = true;
        pushEvent(event, eventIndex);
        return;
      }
      if (event.type === "ModifyProposalRejected" || event.type === "CancelProposalRejected") {
        if (seenModifyRejectAt[event.at]) return;
        seenModifyRejectAt[event.at] = true;
        pushEvent(event, eventIndex);
        return;
      }
      pushEvent(event, eventIndex);
    });
  });
  if (proposal.lifecycleStatus === "Completed") {
    const last = (proposal.activities || []).slice(-1)[0];
    if (last && last.completedAt) {
      events.push({
        id: `${proposal.id}-proposal-completed`,
        type: "ProposalCompleted",
        at: last.completedAt,
        actorName: last.owner,
        message: "All workflow stages closed. Proposal fully completed.",
      });
    }
  }
  return events.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}
const TRK_DETAIL_SIDE_PANEL_MIN_HEIGHT = 500;
const TRK_DETAIL_SIDE_GAP = 16;

function TrkActivityHistoryPanel({ proposal, fill = false, style }) {
  const C = useC();
  const tt = useTT();
  const history = trkBuildActivityHistory(proposal);
  const cardStyle = fill ? { display: "flex", flexDirection: "column", minHeight: 0, ...style } : style;
  const cardBodyStyle = fill ? { flex: 1, minHeight: 0, overflow: "hidden" } : undefined;
  const scrollStyle = fill ? { height: "100%", minHeight: 0, overflowY: "auto", paddingRight: 4 } : { maxHeight: 338, overflowY: "auto", paddingRight: 4 };
  return (
    <DetailCard title={tt("Activity History", "Activity History")} subtitle={tt("Narrative trail from distribution, stage movement, direct recycle, cancel, Term Sheet handoff, and parallel LOA.", "Jejak naratif dari distribusi, pergerakan stage, recycle langsung, cancel, handoff Term Sheet, dan LOA paralel.")} style={cardStyle} bodyStyle={cardBodyStyle}>
      {history.length === 0 ? (
        <EmptyState icon="history" title={tt("No activity yet", "Belum ada aktivitas")} description={tt("Distribution or stage updates will appear here.", "Distribusi atau update stage akan tampil di sini.")} />
      ) : (
        <div style={scrollStyle}>
          {history.map((event, index) => {
            const tone = trkHistoryTone(C, event.type);
            const stepColor = trkStepHistoryColor(C, event.stepIndex);
            const tintBg = stepColor + (C.scheme === "dark" ? "26" : "16");
            const chipBg = stepColor + (C.scheme === "dark" ? "2e" : "1c");
            return (
              <div key={event.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, position: "relative" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: tintBg, color: stepColor, border: `1px solid ${stepColor}55`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={tone.icon} size={13} /></span>
                  {index < history.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: C.borderSoft, margin: "4px 0" }} />}
                </div>
                <div style={{ paddingBottom: index < history.length - 1 ? 13 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    {event.activityTitle
                      ? <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 700, backgroundColor: chipBg, color: stepColor }}>{event.stepIndex != null ? `${String(event.stepIndex + 1).padStart(2, "0")} · ` : ""}{event.activityTitle}</span>
                      : <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 700, backgroundColor: chipBg, color: stepColor }}>{tt("Proposal", "Proposal")}</span>}
                    <span style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 600 }}>{trkHistoryEventLabel(event.type, tt)}</span>
                    <span style={{ fontSize: 11, color: C.textSubtle }}>{trkDetailDate(event.at)}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12.3, lineHeight: 1.5, backgroundColor: tintBg, border: `1px solid ${stepColor}2e`, borderRadius: RADIUS.md, padding: "8px 11px", boxShadow: `inset 3px 0 0 ${stepColor}` }}>
                    {event.actorName && <b style={{ color: stepColor, fontWeight: 700 }}>{event.actorName}</b>}
                    {event.actorName && event.message ? <span style={{ color: C.textSubtle }}> — </span> : ""}
                    <span style={{ color: C.textMuted }}>{event.message || "-"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DetailCard>
  );
}
function trkBuildNotesSummary(proposal, activityNotes) {
  const notes = [];
  (proposal.activities || []).forEach((activity, index) => {
    ((activityNotes && activityNotes[activity.id]) || []).forEach((note, noteIndex) => {
      notes.push({
        id: note.id || `${activity.id}-note-${noteIndex}`,
        type: "Step Note",
        at: note.createdAt,
        actorName: note.authorName,
        authorRole: note.authorRole,
        activityTitle: activity.title,
        stepIndex: index,
        message: note.message,
      });
    });
  });
  return notes.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}
function TrkNotesSummaryPanel({ proposal, activityNotes, fill = false, style }) {
  const C = useC();
  const tt = useTT();
  const notes = trkBuildNotesSummary(proposal, activityNotes);
  const cardStyle = fill ? { display: "flex", flexDirection: "column", minHeight: 0, ...style } : style;
  const cardBodyStyle = fill ? { flex: 1, minHeight: 0, overflow: "hidden" } : undefined;
  const scrollStyle = fill ? { display: "flex", flexDirection: "column", gap: 10, height: "100%", minHeight: 0, overflowY: "auto", paddingRight: 4 } : { display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto", paddingRight: 4 };
  return (
    <DetailCard title={tt("Notes Summary", "Notes Summary")} subtitle={tt("Summary of step notes across the activity workflow.", "Ringkasan notes dari semua step activity workflow.")} style={cardStyle} bodyStyle={cardBodyStyle}>
      {notes.length === 0 ? (
        <EmptyState icon="notebook-pen" title={tt("No step notes yet", "Belum ada step notes")} description={tt("Notes posted inside each activity step will appear here.", "Notes dari setiap step activity akan tampil di sini.")} />
      ) : (
        <div style={scrollStyle}>
          {notes.map((note) => {
            const officer = trkActivityNoteIsOfficer(note.authorRole);
            const bubbleTone = trkActivityNoteBubbleTone(C, note.authorRole);
            return (
              <div key={note.id} style={{ display: "flex", justifyContent: officer ? "flex-end" : "flex-start" }}>
                <div style={{ width: "min(100%, 88%)", border: `1px solid ${bubbleTone.border}`, borderRadius: RADIUS.md, padding: "10px 11px", backgroundColor: bubbleTone.bg, boxShadow: `inset ${officer ? -3 : 3}px 0 0 ${bubbleTone.accent}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 6, justifyContent: officer ? "flex-end" : "flex-start" }}>
                    <Badge tone={trkActivityNoteRoleTone(note.authorRole)} size="sm">{note.authorRole || "Officer"}</Badge>
                    <span style={{ fontSize: 11.5, color: C.text, fontWeight: 700 }}>Step {note.stepIndex + 1} - {note.activityTitle}</span>
                    <span style={{ fontSize: 11, color: C.textSubtle }}>{trkDetailDate(note.at)}</span>
                  </div>
                  <div style={{ fontSize: 12.4, color: C.textMuted, lineHeight: 1.5 }}>
                    {note.actorName && <b style={{ color: C.text }}>{note.actorName}</b>}
                    {note.actorName ? " - " : ""}
                    {note.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DetailCard>
  );
}
function TrkPdfDocumentModal({ document, onClose }) {
  const C = useC();
  const tt = useTT();
  const [src, setSrc] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setError("");
    if (!document) { setSrc(""); setLoading(false); return; }
    if (document.src) { setSrc(document.src); setLoading(false); return; }
    setSrc(""); setLoading(true);
    trkResolveDocumentUrl(document)
      .then((url) => { if (!cancelled) { setSrc(url); if (!url) setError(tt("Document not available.", "Dokumen tidak tersedia.")); } })
      .catch(() => { if (!cancelled) setError(tt("Unable to load document.", "Tidak bisa memuat dokumen.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [document, tt]);
  return (
    <Modal
      open={!!document}
      onClose={onClose}
      width="80vw"
      icon="file-search"
      title={tt("View PDF Document", "View PDF Document")}
      subtitle={document ? document.fileName : ""}
      overlayStyle={{ padding: 0, alignItems: "stretch" }}
      style={{ maxWidth: "80vw", height: "100vh", borderRadius: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflow: "hidden", padding: 16 }}
    >
      {document && (
        <div style={{ height: "100%", minHeight: 0, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {loading ? <Spinner size={22} color={C.ocean} />
            : src ? <iframe title={document.title || document.fileName} src={src} style={{ width: "100%", height: "100%", border: 0, backgroundColor: "#fff" }} />
            : <div style={{ fontSize: 13, color: C.textMuted }}>{error || tt("Document not available.", "Dokumen tidak tersedia.")}</div>}
        </div>
      )}
    </Modal>
  );
}

function TrkUploadDocumentModal({ target, onClose, onSubmit }) {
  const C = useC();
  const tt = useTT();
  const [file, setFile] = React.useState(null);
  const [remark, setRemark] = React.useState("");
  const [error, setError] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  React.useEffect(() => {
    setFile(null);
    setRemark("");
    setError("");
    setUploading(false);
  }, [target && target.key]);
  if (!target) return null;
  const fileName = file && file.name;
  const isWinner = target.mode === "winner-proof";
  const submit = async () => {
    if (uploading) return;
    if (!file) {
      setError(tt("Select one PDF document first.", "Pilih satu dokumen PDF terlebih dahulu."));
      return;
    }
    if (!trkIsPdfFile(file)) {
      setError(tt("Only PDF documents can be uploaded.", "Hanya dokumen PDF yang bisa diupload."));
      return;
    }
    setError("");
    setUploading(true);
    try {
      await (onSubmit && onSubmit(target, file, remark));
    } finally {
      setUploading(false);
    }
  };
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      width={560}
      icon="upload-cloud"
      title={tt("Upload Document", "Upload Dokumen")}
      subtitle={isWinner ? tt("Upload one winner evidence PDF for Bid Evaluation.", "Upload satu PDF evidence pemenang untuk Bid Evaluation.") : `${target.activity.title} - ${target.vendor.vendorName}`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={uploading}>{tt("Cancel", "Batal")}</Button><Button iconLeft={uploading ? undefined : "upload-cloud"} disabled={uploading} onClick={submit}>{uploading ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Spinner size={14} color="#fff" />{tt("Uploading…", "Mengunggah…")}</span> : tt("Upload Document", "Upload Dokumen")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("PDF document", "Dokumen PDF")} required helper={error || (fileName ? `${fileName} . ${trkFileSizeLabel(file.size)}` : tt("Choose a real PDF file from your device.", "Pilih file PDF dari perangkat."))} status={error ? "error" : fileName ? "success" : undefined}>
          <label style={{ ...FONT, minHeight: 78, borderRadius: RADIUS.md, border: `1px dashed ${error ? C.danger : C.border}`, backgroundColor: C.surfaceAlt, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 14, cursor: "pointer", textAlign: "center" }}>
            <Icon name="file-up" size={18} color={error ? C.danger : C.ocean} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{fileName || tt("Browse PDF file", "Pilih file PDF")}</span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => {
                const picked = event.target.files && event.target.files[0];
                setFile(picked || null);
                setError("");
              }}
              style={{ display: "none" }}
            />
          </label>
        </Field>
        <Field label={tt("Remarks (optional)", "Remarks (opsional)")}>
          <Textarea rows={3} value={remark} onChange={(event) => setRemark(event.target.value)} placeholder={tt("Add optional remarks for this upload.", "Tambahkan remarks opsional untuk upload ini.")} style={{ minHeight: 76 }} />
        </Field>
      </div>
    </Modal>
  );
}

function TrkLoaGeneratorModal({ target, proposal, onClose, onSubmit }) {
  const C = useC();
  const tt = useTT();
  const [form, setForm] = React.useState(() => target ? trkLoaInitialForm(proposal, target.vendor, target.support) : {});
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!target) return;
    setForm(trkLoaInitialForm(proposal, target.vendor, target.support));
    setError("");
  }, [target && target.key]);
  if (!target) return null;
  const set = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "letterDate" && (!current.loaNumber || current.loaNumber.indexOf("/LOA/") >= 0)) next.loaNumber = trkSuggestedLoaNumber(proposal, value);
    if (key === "procurementSubject" && (!current.letterSubject || current.letterSubject.indexOf("Surat Penetapan Kerja Sama") === 0)) next.letterSubject = `Surat Penetapan Kerja Sama ${value || ""}`.trim();
    return next;
  });
  const required = [
    ["loaNumber", tt("LOA Number", "Nomor LOA")],
    ["letterDate", tt("Letter Date", "Tanggal surat")],
    ["vendorName", tt("Vendor Name", "Nama vendor")],
    ["vendorAddress", tt("Vendor Address", "Alamat vendor")],
    ["procurementSubject", tt("Procurement Subject", "Subjek procurement")],
    ["letterSubject", tt("Letter Subject", "Perihal surat")],
    ["sisSignatoryName", tt("SIS Signatory", "Penandatangan SIS")],
    ["vendorDirectorName", tt("Vendor Director", "Direktur vendor")],
  ];
  const submit = () => {
    const missing = required.find(([key]) => !String(form[key] || "").trim());
    if (missing) {
      setError(`${missing[1]} ${tt("is required.", "wajib diisi.")}`);
      return;
    }
    const invalid = (form.attachmentFiles || []).find((file) => !trkIsPdfFile(file));
    if (invalid) {
      setError(tt("Only PDF documents can be attached.", "Lampiran hanya boleh PDF."));
      return;
    }
    setError("");
    onSubmit && onSubmit(target, form);
  };
  const files = form.attachmentFiles || [];
  const input = (key, label, props) => (
    <Field label={label} required={required.some(([name]) => name === key)}>
      <TextInput type={(props && props.type) || "text"} value={form[key] || ""} onChange={(event) => set(key, event.target.value)} placeholder={props && props.placeholder} />
    </Field>
  );
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      width={760}
      icon="file-pen"
      title={tt("Generate Letter of Award", "Generate Letter of Award")}
      subtitle={tt("Fill in the LOA details, attach supporting PDF appendices, and generate the previewable LOA.", "Isi data LOA, upload lampiran PDF, lalu generate LOA yang bisa dipreview.")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="sparkles" onClick={submit}>{tt("Generate LOA", "Generate LOA")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <Alert tone="warning" title={tt("Complete required LOA data", "Lengkapi data LOA")} description={error} />}
        <Alert
          tone={target.support && target.support.document ? "success" : "info"}
          title={tt("Term Sheet supporting data", "Data pendukung Term Sheet")}
          description={target.support && target.support.document
            ? `${target.support.termsheetNumber || target.support.caseKey} - ${target.support.document.fileName}`
            : `${(target.support && (target.support.termsheetNumber || target.support.caseKey)) || "Term Sheet"} completed; legacy document reference is not available.`}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="ag-trk-row3">
          {input("loaNumber", tt("LOA Number", "Nomor LOA"))}
          {input("letterDate", tt("Letter Date", "Tanggal surat"), { type: "date" })}
        </div>
        {input("vendorName", tt("Vendor Name", "Nama vendor"))}
        <Field label={tt("Vendor Address", "Alamat vendor")} required>
          <Textarea rows={2} value={form.vendorAddress || ""} onChange={(event) => set("vendorAddress", event.target.value)} style={{ minHeight: 64 }} />
        </Field>
        {input("procurementSubject", tt("Procurement Subject", "Subjek procurement"))}
        <Field label={tt("Letter Subject", "Perihal surat")} required>
          <Textarea rows={2} value={form.letterSubject || ""} onChange={(event) => set("letterSubject", event.target.value)} style={{ minHeight: 64 }} />
        </Field>
        {input("attachmentDescription", tt("Attachment", "Lampiran"))}
        <Field label={tt("Attachment PDF files", "File lampiran PDF")} helper={files.length ? files.map((file) => file.name).join(", ") : tt("Optional. Selected PDF names will be listed in the generated LOA.", "Opsional. Nama PDF yang dipilih akan dicatat di LOA.")}>
          <label style={{ ...FONT, minHeight: 58, borderRadius: RADIUS.md, border: `1px dashed ${C.border}`, backgroundColor: C.surfaceAlt, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 12, cursor: "pointer" }}>
            <Icon name="paperclip" size={16} color={C.ocean} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{files.length ? `${files.length} PDF selected` : tt("Attach PDF appendices", "Pilih lampiran PDF")}</span>
            <input type="file" accept=".pdf,application/pdf" multiple onChange={(event) => set("attachmentFiles", Array.from(event.target.files || []))} style={{ display: "none" }} />
          </label>
        </Field>
        <div style={{ border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md, padding: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 10 }}>{tt("PT SIS Signatory", "Penandatangan PT SIS")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="ag-trk-row3">
            {input("sisSignatoryName", tt("Name", "Nama"))}
            {input("sisSignatoryTitle", tt("Title", "Jabatan"))}
          </div>
        </div>
        <div style={{ border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md, padding: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 10 }}>{tt("Vendor Signatory", "Penandatangan Vendor")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="ag-trk-row3">
            {input("vendorRecipientTitle", tt("Recipient title", "Jabatan penerima"))}
            {input("vendorDirectorName", tt("Director name", "Nama direktur"))}
            {input("vendorDirectorTitle", tt("Director title", "Jabatan direktur"))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TrkLoaVendorCompleteModal({ target, onClose, onSubmit }) {
  const tt = useTT();
  const [remark, setRemark] = React.useState("");
  const [completeDate, setCompleteDate] = React.useState(TRK_TODAY);
  React.useEffect(() => {
    if (!target) return;
    setRemark(tt("LOA generated and reviewed for this winner.", "LOA sudah digenerate dan direview untuk pemenang ini."));
    setCompleteDate(TRK_TODAY);
  }, [target && target.vendor && target.vendor.vendorId, target && target.activity && target.activity.id]);
  if (!target) return null;
  const cleanRemark = String(remark || "").trim();
  const completedAt = completeDate === TRK_TODAY ? trkNow() : `${completeDate} 10:00:00`;
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      width={560}
      icon="check-circle-2"
      overlayStyle={{ zIndex: 1400 }}
      title={tt("Complete activity", "Selesaikan aktivitas")}
      subtitle={`${(target.vendor && target.vendor.vendorName) || ""} · ${(target.activity && target.activity.title) || "LOA"}`}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" disabled={!cleanRemark || !completeDate} onClick={() => onSubmit && onSubmit(target, cleanRemark, completedAt)}>{tt("Complete", "Selesaikan")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Completed date", "Tanggal selesai")} required helper={tt("Date this winner’s LOA was completed.", "Tanggal LOA pemenang ini diselesaikan.")}>
          <TextInput type="date" value={completeDate} onChange={(event) => setCompleteDate(event.target.value)} iconLeft="calendar" />
        </Field>
        <Field label={tt("Remark", "Catatan")} required>
          <Textarea rows={3} value={remark} onChange={(event) => setRemark(event.target.value)} placeholder={tt("Write completion remark for this winner’s LOA...", "Tulis remark penyelesaian LOA pemenang ini...")} />
        </Field>
      </div>
    </Modal>
  );
}

function TrkStepDocumentCell({ documents, canEdit, onAddDocument, onViewDocument }) {
  const C = useC();
  const tt = useTT();
  const docs = documents || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
      {docs.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {docs.slice(0, 3).map((doc) => (
            <div key={doc.id || doc.fileName} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 28px", gap: 6, alignItems: "center", minWidth: 0 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, color: C.text, fontWeight: 600 }}>{doc.fileName || doc.name}</span>
              <IconButton size="sm" variant="secondary" name="search" title={tt("View PDF Document", "View PDF Document")} onClick={() => onViewDocument({ title: doc.fileName || doc.name, fileName: doc.fileName || doc.name, src: doc.src || doc.dataUri, blobKey: doc.blobKey, container: doc.container })} />
            </div>
          ))}
          {docs.length > 3 && <span style={{ fontSize: 10.5, color: C.textSubtle }}>+{docs.length - 3} more document(s)</span>}
        </div>
      ) : (
        <span style={{ fontSize: 11.5, color: C.textSubtle }}>{tt("No document", "Belum ada dokumen")}</span>
      )}
      {canEdit && <Button size="xs" variant="secondary" iconLeft="paperclip" onClick={onAddDocument} style={{ alignSelf: "flex-start" }}>{tt("Upload", "Upload")}</Button>}
    </div>
  );
}

function TrkActivityVendorPanel({ proposal, activity, status, stepDocs, bidEvalState, loaDocumentsByActivity, canSelectWinner, canGenerateLoa = true, canUpload = true, onAddVendorDoc, onRemoveVendorDoc, onToggleWinner, onWinnerValueChange, onAddWinnerProof, onRemoveWinnerProof, onGenerateLoa, onCompleteLoa, onViewDocument, onOpenTermSheet }) {
  const C = useC();
  const tt = useTT();
  const cip = useCipStore();
  const isBidEvaluation = trkIsBidEvaluationActivity(activity);
  const isLoa = trkIsLoaActivity(activity);
  const isCipHandoff = trkIsCipHandoffActivity(activity);
  // Editing (upload/delete vendor docs, generate LOA, select winner) requires the active stage
  // AND upload permission (assigned Officer). Others see read-only "View" controls.
  const canEdit = status === "Pending" && !isCipHandoff && canUpload;
  const allVendors = trkVendorsForProposal(proposal.id);
  const winnerScopedVendors = trkWinnerVendorsForProposal(proposal, bidEvalState);
  const vendors = (isLoa || isCipHandoff) ? winnerScopedVendors : allVendors;
  const docsForActivity = trkStepVendorDocsForActivity(stepDocs, activity.id);
  const bidState = trkBidEvalForActivity(bidEvalState, activity.id);
  const loaDocs = (loaDocumentsByActivity && loaDocumentsByActivity[activity.id]) || {};
  React.useEffect(() => {
    if (!isLoa || !proposal) return;
    cipRefreshDomainCases().catch(() => {});
  }, [isLoa, proposal && proposal.id]);
  const tableCols = canEdit ? "minmax(0, 0.56fr) minmax(160px, 1.44fr) 84px" : "minmax(0, 0.56fr) minmax(160px, 1.44fr) 52px";
  const openDoc = (doc) => onViewDocument && onViewDocument({ title: doc.fileName || doc.name, fileName: doc.fileName || doc.name, src: doc.src || doc.dataUri, blobKey: doc.blobKey, container: doc.container });
  const docRemark = (doc) => doc.remark || doc.remarks || doc.description || "-";
  const docKey = (doc, fallback) => doc.id || doc.fileName || doc.name || fallback;
  const renderDocTable = (vendor, docs) => {
    if (!docs.length) {
      return isLoa
        ? <div style={{ fontSize: 11.5, color: C.textSubtle, padding: "0 16px 12px" }}>{tt("Not generated", "Belum generate")}</div>
        : null;
    }
    return (
      <div style={{ marginTop: 8, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: C.surface }}>
        <div style={{ display: "grid", gridTemplateColumns: tableCols, alignItems: "center", ...trkVendorTableHeaderRowStyle(C) }}>
          {["FileName", "Remarks", canEdit ? "Action" : "View"].map((label) => (
            <div key={label} style={trkVendorTableHeaderCellStyle(C, { padding: "7px 12px", textAlign: label === "Action" || label === "Del" || label === "View" ? "center" : "left" })}>{label}</div>
          ))}
        </div>
        {docs.map((doc, idx) => (
          <div key={docKey(doc, idx)} style={{ display: "grid", gridTemplateColumns: tableCols, alignItems: "center", minHeight: 40, borderBottom: idx === docs.length - 1 ? "none" : `1px solid ${C.borderSoft}` }}>
            <Tooltip label={doc.fileName || doc.name} side="top" block>
              <div title={doc.fileName || doc.name} style={{ minWidth: 0, padding: "8px 12px", color: C.text, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.fileName || doc.name}</div>
            </Tooltip>
            <div title={docRemark(doc)} style={{ minWidth: 0, padding: "8px 12px", color: C.textMuted, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docRemark(doc)}</div>
            <div style={{ padding: "6px 10px", display: "flex", justifyContent: "center", gap: 6 }}>
              <IconButton size="sm" variant="secondary" name="search" title={tt("View PDF Document", "View PDF Document")} onClick={() => openDoc(doc)} style={{ width: 28, height: 28 }} />
              {canEdit && (
                <button type="button" title={tt("Delete document", "Hapus dokumen")} onClick={() => onRemoveVendorDoc && onRemoveVendorDoc(activity, vendor, doc)} style={{ ...FONT, width: 28, height: 28, borderRadius: "50%", border: "none", backgroundColor: C.scheme === "dark" ? "rgba(255,92,122,0.22)" : "#ffd9e1", color: C.danger, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Icon name="minus" size={15} strokeWidth={3} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  if (isBidEvaluation) {
    const winnerCols = "minmax(88px, 0.7fr) minmax(150px, 1.35fr) minmax(168px, 1.15fr) 72px";
    const winnerHeaders = ["Vendor ID", "Vendor Name", tt("Value *", "Nilai *"), "Winner"];
    const winnerTotal = bidState.winnerVendorIds.reduce((sum, id) => sum + (Number(bidState.winnerValues[id]) || 0), 0);
    const proposalValue = Number(proposal.amount) || 0;
    return (
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: C.surface }}>
          <div style={{ display: "grid", gridTemplateColumns: winnerCols, alignItems: "center", minHeight: 42, ...trkVendorTableHeaderRowStyle(C) }}>
            {winnerHeaders.map((label) => (
              <div key={label} style={trkVendorTableHeaderCellStyle(C, { padding: "8px 14px", textAlign: label === "Winner" ? "center" : (label === tt("Value *", "Nilai *") ? "right" : "left") })}>{label}</div>
            ))}
          </div>
          {allVendors.map((vendor, idx) => {
            const checked = bidState.winnerVendorIds.includes(vendor.vendorId);
            const canToggleWinner = canEdit && canSelectWinner;
            const winnerValue = bidState.winnerValues[vendor.vendorId];
            const valueMissing = checked && !(Number(winnerValue) > 0);
            return (
              <div key={vendor.vendorId} style={{ display: "grid", gridTemplateColumns: winnerCols, alignItems: "center", minHeight: 42, backgroundColor: idx % 2 ? C.surfaceInset : C.surface, borderBottom: idx === allVendors.length - 1 ? "none" : `1px solid ${C.borderSoft}` }}>
                <div style={{ minWidth: 0, padding: "8px 14px", color: C.textMuted, fontSize: 11.4, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vendor.vendorId}</div>
                <div style={{ minWidth: 0, padding: "8px 14px", color: C.text, fontSize: 11.8, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vendor.vendorName}</div>
                <div style={{ padding: "6px 10px", minWidth: 0 }}>
                  {checked ? (
                    canEdit && canSelectWinner ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, flexShrink: 0 }}>Rp</span>
                        <TextInput
                          size="sm"
                          status={valueMissing ? "error" : "default"}
                          value={trkFmtIdrDigits(winnerValue)}
                          placeholder={tt("Required", "Wajib")}
                          onChange={(e) => onWinnerValueChange && onWinnerValueChange(activity, vendor, trkParseIdrDigits(e.target.value))}
                          style={{ height: 30, padding: "0 8px", minWidth: 0, flex: 1 }}
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: "right", fontSize: 11.6, fontWeight: 700, color: C.text }}>{winnerValue > 0 ? trkMoney(winnerValue, proposal.currency) : "—"}</div>
                    )
                  ) : (
                    <div style={{ textAlign: "right", fontSize: 11.5, color: C.textSubtle }}>—</div>
                  )}
                </div>
                <div style={{ padding: "8px 14px", display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    aria-pressed={checked}
                    disabled={!canToggleWinner}
                    title={canToggleWinner ? (checked ? tt("Winner selected", "Winner dipilih") : tt("Select winner", "Pilih winner")) : tt("Only Officer can select winner", "Hanya Officer yang boleh memilih winner")}
                    onClick={() => canToggleWinner && onToggleWinner(activity, vendor, !checked)}
                    style={{ ...FONT, width: 19, height: 19, borderRadius: "50%", border: checked ? "none" : `1px solid ${C.border}`, backgroundColor: checked ? C.orange : C.surface, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: canToggleWinner ? "pointer" : "default", boxShadow: checked ? "0 6px 14px rgba(235,102,46,0.22)" : "0 3px 9px rgba(15,42,58,0.06)", opacity: !canToggleWinner && !checked ? 0.62 : 1 }}
                  >
                    {checked && <Icon name="check" size={12} strokeWidth={3} />}
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "9px 14px", borderTop: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt }}>
            <span style={{ fontSize: 11.2, color: C.textMuted }}>
              {tt("Winner VALUE is required (> 0) for every selected winner and may differ from the proposal VALUE after negotiation.", "VALUE wajib diisi (> 0) untuk setiap pemenang dan boleh berbeda dari VALUE Proposal setelah negosiasi.")}
            </span>
            <span style={{ fontSize: 11.4, fontWeight: 700, color: C.text, textAlign: "right" }}>
              {tt("Total", "Total")} {trkMoney(winnerTotal, proposal.currency)}
              {proposalValue ? ` · ${tt("Proposal", "Proposal")} ${trkMoney(proposalValue, proposal.currency)}` : ""}
            </span>
          </div>
        </div>

        <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260, flex: "1 1 360px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ocean, marginBottom: 5 }}>{tt("Winning Vendor Evidence", "Winning Vendor Evidence")}</div>
            <div style={{ fontSize: 11, color: C.info, lineHeight: 1.45 }}>{tt("Upload one PDF that names every winner on this proposal.", "Unggah satu PDF yang menyebut semua pemenang proposal ini.")}</div>
            {bidState.proofDocuments.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                {bidState.proofDocuments.map((doc) => (
                  <div key={doc.id || doc.fileName} style={{ display: "inline-flex", alignItems: "center", gap: 5, maxWidth: 310 }}>
                    <button type="button" onClick={() => onViewDocument({ title: doc.fileName || doc.name, fileName: doc.fileName || doc.name, src: doc.src, blobKey: doc.blobKey, container: doc.container })} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceInset, color: C.text, borderRadius: RADIUS.md, padding: "5px 8px", cursor: "pointer", fontSize: 11.3, fontWeight: 700, minWidth: 0, maxWidth: 250 }}>
                      <Icon name="search" size={12} />
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.fileName || doc.name}</span>
                    </button>
                    {canEdit && (
                      <IconButton size="sm" variant="ghost" name="trash-2" title={tt("Delete winner evidence", "Hapus evidence pemenang")} onClick={() => onRemoveWinnerProof && onRemoveWinnerProof(activity, doc)} style={{ width: 26, height: 26, color: C.danger }} />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {canEdit && !bidState.proofDocuments.length ? (
            <Button size="sm" variant="secondary" iconLeft="plus" onClick={() => onAddWinnerProof(activity)} style={{ borderRadius: RADIUS.pill, padding: "0 12px", height: 32, fontSize: 11.5 }}>
              {tt("Upload Winner Evidence", "Upload Winner Evidence")}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  if (isLoa) {
    const bidActivity = (proposal.activities || []).find(trkIsBidEvaluationActivity);
    const awardBid = bidActivity ? trkBidEvalForActivity(bidEvalState, bidActivity.id) : bidState;
    const method = trkMethodById(proposal.trackerMethod);
    const winnerSplits = trkAwardSplitsForWinners(proposal, vendors.map((row) => row.vendorId), awardBid.winnerValues);
    return (
      <div style={{ marginTop: 8, display: "grid", gap: 14 }}>
        {status === "Locked" && (
          <Alert
            tone="info"
            title={tt("Letter of Award waits for Term Sheet", "LOA menunggu Term Sheet")}
            description={tt("After Term Sheet is completed, LOA and Contract open in parallel. Each winner has their own LOA on this step.", "Setelah Term Sheet selesai, LOA dan Contract terbuka paralel. Setiap pemenang punya LOA sendiri di step ini.")}
          />
        )}
        {vendors.map((vendor) => {
          const loa = loaDocs[vendor.vendorId];
          const split = winnerSplits.find((row) => row.vendorId === vendor.vendorId) || trkAwardSplitForVendor(proposal, vendor);
          const awardValue = Number(awardBid.winnerValues && awardBid.winnerValues[vendor.vendorId]) || Number(split.value) || 0;
          const awardPct = Number(split.percent) || (awardValue && proposal.amount ? Math.round((awardValue / Number(proposal.amount)) * 100) : 100);
          const cipCase = trkMatchCipCaseForVendor((cip && cip.cases) || [], proposal, vendor);
          const termSheetReady = trkVendorTermSheetComplete(cipCase);
          const winnerLocked = status === "Locked" || (status === "Pending" && !termSheetReady);
          const winnerDone = !!(loa && loa.completedAt);
          const snapshotRows = [
            [tt("Proposal", "Proposal"), proposal.proposalNumber || proposal.id],
            [tt("Awarded to", "Diberikan kepada"), vendor.vendorName],
            [tt("Award value", "Nilai award"), awardValue ? trkMoney(awardValue, proposal.currency) : "—"],
            [tt("Award split", "Porsi award"), `${awardPct}%`],
            [tt("Procurement method", "Metode pengadaan"), (method && method.name) || proposal.trackerMethod || "—"],
            [tt("Jobsite", "Jobsite"), proposal.jobsite || "—"],
            [tt("Subject", "Perihal"), proposal.title || "—"],
          ];
          const pairs = [];
          for (let i = 0; i < snapshotRows.length; i += 2) pairs.push(snapshotRows.slice(i, i + 2));
          return (
            <div key={vendor.vendorId} style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: C.surface, opacity: winnerLocked ? 0.78 : 1 }}>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: C.surfaceAlt, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.4, fontWeight: 700, color: C.text }}>{vendor.vendorName}</div>
                  <div style={{ fontSize: 11.4, color: C.textMuted }}>{vendor.vendorId}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {winnerDone ? <Badge tone="success" size="sm">{tt("Completed", "Selesai")}</Badge> : winnerLocked ? <Badge tone="neutral" size="sm">{tt("Locked", "Terkunci")}</Badge> : <Badge tone="info" size="sm">{tt("Active", "Aktif")}</Badge>}
                  <Badge tone="success" size="sm"><Icon name="check-circle-2" size={11} />{tt("Validated in Proposal Tracker", "Valid di Proposal Tracker")}</Badge>
                </div>
              </div>
              {winnerLocked && (
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12, color: C.textMuted, display: "flex", gap: 7, alignItems: "flex-start" }}>
                  <Icon name="lock" size={13} />
                  {tt("Complete this winner’s Term Sheet first. LOA opens for a winner only after that winner’s Term Sheet is complete.", "Selesaikan Term Sheet pemenang ini dulu. LOA terbuka untuk pemenang hanya setelah Term Sheet pemenang itu selesai.")}
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {pairs.map((pair, rowIndex) => (
                    <tr key={rowIndex}>
                      {pair.map(([label, value], colIndex) => (
                        <td key={colIndex} style={{ width: "50%", padding: "10px 12px", borderRight: colIndex === 0 ? `1px solid ${C.borderSoft}` : "none", borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: "top" }}>
                          <div style={{ fontSize: 10.6, color: C.textMuted, fontWeight: 550 }}>{label}</div>
                          <div style={{ fontSize: 12.4, color: C.text, fontWeight: 550, marginTop: 4, lineHeight: 1.45 }}>{value}</div>
                        </td>
                      ))}
                      {pair.length === 1 ? <td style={{ width: "50%", borderBottom: `1px solid ${C.borderSoft}` }} /> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", backgroundColor: C.surfaceAlt }}>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.45, minWidth: 220, flex: "1 1 280px" }}>
                  {tt("Generate LOA from this winner’s Term Sheet, then Complete Activity for this winner. The LOA step stays Active until every winner is complete.", "Generate LOA dari Term Sheet pemenang ini, lalu Complete Activity untuk pemenang ini. Step LOA tetap Active sampai semua pemenang selesai.")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
                  {canEdit && canGenerateLoa && !winnerLocked && (
                    <Button size="sm" iconLeft={loa ? "refresh-cw" : "sparkles"} onClick={() => onGenerateLoa(activity, vendor)}>
                      {loa ? tt("Re-Generate LOA", "Re-Generate LOA") : tt("Generate LOA", "Generate LOA")}
                    </Button>
                  )}
                  {canEdit && !canGenerateLoa && (
                    <Tooltip label={tt("Only Officer can generate LOA", "Hanya Officer yang bisa generate LOA")} side="top">
                      <span style={{ ...FONT, height: 32, borderRadius: RADIUS.pill, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 7, border: `1px dashed ${C.border}`, backgroundColor: C.surface, color: C.textSubtle, fontSize: 11.6, fontWeight: 700, cursor: "not-allowed" }}>
                        <Icon name="lock" size={13} />
                        {loa ? tt("Re-Generate LOA", "Re-Generate LOA") : tt("Generate LOA", "Generate LOA")}
                      </span>
                    </Tooltip>
                  )}
                  {!canEdit && (
                    <Button size="sm" iconLeft="sparkles" disabled>
                      {loa ? tt("Re-Generate LOA", "Re-Generate LOA") : tt("Generate LOA", "Generate LOA")}
                    </Button>
                  )}
                  {loa && (
                    <Button size="sm" variant="secondary" iconLeft="file-search" onClick={() => onViewDocument({ title: loa.fileName, fileName: loa.fileName, src: loa.dataUri, blobKey: loa.blobKey, container: loa.container })}>
                      {tt("Preview LOA", "Preview LOA")}
                    </Button>
                  )}
                  {canEdit && canGenerateLoa && !winnerLocked && (
                    <Button size="sm" iconLeft="check-circle-2" disabled={!loa || winnerDone} onClick={() => onCompleteLoa && onCompleteLoa(activity, vendor, loa)}>
                      {tt("Complete Activity", "Complete Activity")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!vendors.length && (
          <Alert tone="warning" title={tt("No winner yet", "Belum ada pemenang")} description={tt("Complete Bid Evaluation or Negotiation first so each winner gets an LOA panel.", "Selesaikan Bid Evaluation atau Negotiation dulu agar setiap pemenang punya panel LOA.")} />
        )}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8, borderTop: `1px solid ${isCipHandoff ? C.orange + "44" : C.borderSoft}`, paddingTop: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {vendors.map((vendor) => {
          const vendorDocs = docsForActivity[vendor.vendorId] || [];
          const checked = bidState.winnerVendorIds.includes(vendor.vendorId);
          const loa = loaDocs[vendor.vendorId];
          const docs = isLoa && loa ? [{ id: loa.id || loa.fileName, fileName: loa.fileName, remark: tt("Generated LOA", "LOA dibuat"), src: loa.dataUri, dataUri: loa.dataUri, blobKey: loa.blobKey, container: loa.container }] : vendorDocs;
          const actionTitle = isLoa ? (loa ? tt("Regenerate LOA", "Regenerate LOA") : tt("Generate LOA", "Generate LOA")) : tt("Upload document", "Upload dokumen");
          return (
            <div key={vendor.vendorId} style={{ borderBottom: `1px solid ${C.borderSoft}`, padding: "0 0 10px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: canEdit ? "minmax(0, 1fr) 34px" : "minmax(0, 1fr)", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8, flexWrap: "wrap", color: C.text, fontSize: 12.2, fontWeight: 700, textAlign: "left" }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vendor.vendorName}</span>
                  {isBidEvaluation && (
                    canEdit ? (
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: checked ? C.success : C.textMuted, fontWeight: 700, cursor: canSelectWinner ? "pointer" : "default", opacity: canSelectWinner ? 1 : 0.66 }} title={canSelectWinner ? undefined : tt("Only Officer can select winner", "Hanya Officer yang boleh memilih winner")}>
                        <input type="checkbox" checked={checked} disabled={!canSelectWinner} onChange={(e) => canSelectWinner && onToggleWinner(activity, vendor, e.target.checked)} />
                        {checked ? tt("Winner", "Winner") : tt("Select", "Pilih")}
                      </label>
                    ) : checked ? <Badge tone="success" size="sm">{tt("Winner", "Winner")}</Badge> : null
                  )}
                  {isCipHandoff && (
                    <>
                      <Badge tone="orange" size="sm"><Icon name="arrow-right" size={10} />{tt("Term Sheet / Contract", "Term Sheet / Kontrak")}</Badge>
                      {onOpenTermSheet && (
                        <Button
                          size="xs"
                          variant="secondary"
                          iconLeft="file-signature"
                          onClick={() => onOpenTermSheet(vendor)}
                        >
                          {trkActivityStageCode(activity) === "CTR" ? tt("Open Contract", "Buka Kontrak") : tt("Open Term Sheet", "Buka Term Sheet")}
                        </Button>
                      )}
                    </>
                  )}
                </div>
                {canEdit && (
                  <button type="button" title={actionTitle} onClick={() => isLoa ? onGenerateLoa(activity, vendor) : onAddVendorDoc(activity, vendor)} style={{ ...FONT, width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, backgroundColor: C.scheme === "dark" ? "#334255" : "#344357", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", justifySelf: "end", boxShadow: "0 6px 14px rgba(1,59,82,0.14)" }}>
                    <Icon name={isLoa && loa ? "refresh-cw" : "plus"} size={15} />
                  </button>
                )}
              </div>
              {isCipHandoff ? (
                <div style={{ marginTop: 10, fontSize: 11.5, color: C.textMuted }}>{tt("This step continues as Term Sheet / Contract in Tracker.", "Step ini dilanjutkan sebagai Term Sheet / Kontrak di Tracker.")}</div>
              ) : renderDocTable(vendor, docs)}
            </div>
          );
        })}
      </div>

      {isBidEvaluation && (
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.borderSoft}`, backgroundColor: C.surface }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: C.text }}><Icon name="shield-check" size={13} color={C.success} />{tt("Winner evidence", "Evidence pemenang")}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>{tt("One PDF names every winner.", "Satu PDF menyebut semua pemenang.")}</div>
            </div>
            {canEdit && !bidState.proofDocuments.length ? <Button size="xs" variant="secondary" iconLeft="paperclip" onClick={() => onAddWinnerProof(activity)}>{tt("Upload proof", "Upload proof")}</Button> : null}
          </div>
          {bidState.proofDocuments.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {bidState.proofDocuments.map((doc) => (
                <button key={doc.id || doc.fileName} type="button" onClick={() => onViewDocument({ title: doc.fileName || doc.name, fileName: doc.fileName || doc.name, src: doc.src, blobKey: doc.blobKey, container: doc.container })} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceInset, color: C.text, borderRadius: RADIUS.md, padding: "5px 8px", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>
                  <Icon name="search" size={12} />{doc.fileName || doc.name}
                </button>
              ))}
            </div>
          ) : <div style={{ fontSize: 11.5, color: C.textSubtle }}>{tt("No winner evidence uploaded yet.", "Belum ada evidence pemenang.")}</div>}
        </div>
      )}
    </div>
  );
}

function TrkStepNotesPanel({ activity, notes, draft, actorName, onDraftChange, onPostNote, defaultExpanded = false }) {
  const C = useC();
  const tt = useTT();
  const [expanded, setExpanded] = React.useState(!!defaultExpanded);
  const rows = (notes || []).slice().sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  React.useEffect(() => {
    setExpanded(!!defaultExpanded);
  }, [activity && activity.id, defaultExpanded]);
  return (
    <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, backgroundColor: C.scheme === "dark" ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.72)", overflow: "hidden" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((current) => !current);
          }
        }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderBottom: expanded ? `1px solid ${C.borderSoft}` : "none", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 28, height: 28, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="message-square-text" size={15} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.8, fontWeight: 650, color: C.text }}>{tt("Step Notes", "Step Notes")}</div>
            <div style={{ fontSize: 11.4, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activity.title}</div>
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Badge tone={rows.length ? "info" : "neutral"} size="sm">{rows.length}</Badge>
          <span style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surface, color: C.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={expanded ? "chevron-up" : "chevron-down"} size={15} />
          </span>
        </div>
      </div>

      {expanded && <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 ? (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: RADIUS.md, padding: "10px 12px", color: C.textMuted, fontSize: 12.2, lineHeight: 1.45, backgroundColor: C.surfaceAlt }}>
            {tt("No notes in this step yet.", "Belum ada notes di step ini.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9, maxHeight: 170, overflowY: "auto", paddingRight: 4 }}>
            {rows.map((note) => {
              const officer = trkActivityNoteIsOfficer(note.authorRole);
              const bubbleTone = trkActivityNoteBubbleTone(C, note.authorRole);
              return (
                <div key={note.id} style={{ display: "flex", justifyContent: officer ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "78%", minWidth: 180, border: `1px solid ${bubbleTone.border}`, borderRadius: RADIUS.md, padding: "8px 10px", backgroundColor: bubbleTone.bg, boxShadow: `inset ${officer ? -3 : 3}px 0 0 ${bubbleTone.accent}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 5, justifyContent: officer ? "flex-end" : "flex-start" }}>
                      <Badge tone={trkActivityNoteRoleTone(note.authorRole)} size="sm">{note.authorRole || "Officer"}</Badge>
                      <span style={{ fontSize: 11.2, fontWeight: 700, color: C.text }}>{note.authorName}</span>
                      <span style={{ fontSize: 10.8, color: C.textSubtle }}>{trkDetailDate(note.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.48, whiteSpace: "pre-wrap" }}>{note.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 9, alignItems: "end" }} className="ag-trk-row3">
          <Textarea
            rows={2}
            value={draft || ""}
            onChange={(event) => onDraftChange(activity.id, event.target.value)}
            placeholder={tt("Write notes for this step...", "Tulis notes untuk step ini...")}
            style={{ minHeight: 58, resize: "vertical", fontSize: 12.6, lineHeight: 1.45 }}
          />
          <Button
            size="sm"
            iconLeft="send"
            disabled={!String(draft || "").trim()}
            onClick={() => onPostNote(activity)}
            style={{ height: 36 }}
          >
            {tt("Post", "Post")}
          </Button>
        </div>
      </div>}
    </div>
  );
}

function TrkActivityStep({ proposal, activity, index, last, isExpanded = true, onToggleExpanded, canCancel, canRecycle, canComplete, canSelectWinner, canGenerateLoa, notesDefaultExpanded = false, stepDocs, bidEvalState, loaDocumentsByActivity, activityNotes, noteDraft, actorName, onNoteDraftChange, onPostNote, onComplete, onRecycle, onCancel, onAddVendorDoc, onRemoveVendorDoc, onToggleWinner, onWinnerValueChange, onAddWinnerProof, onRemoveWinnerProof, onGenerateLoa, onCompleteLoa, onViewDocument, onNavigate, onOpenCipCase, renderCipActivityEmbed }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const toast = useToast();
  const status = activity.status;
  const open = status === "Pending";
  const done = status === "Completed";
  const isCipHandoff = trkIsCipHandoffActivity(activity);
  const late = done && activity.completedAt && activity.targetDate && trkDaysBetween(activity.targetDate, activity.completedAt) > 0;
  const elapsed = open && activity.startedAt ? trkDaysBetween(activity.startedAt, TRK_TODAY) : null;
  const slaLabel = `SLA${activity.targetLeadDays || 0}d`;
  const planLabel = trkFmtDate(activity.targetDate, lang);
  const actualLabel = activity.completedAt ? trkFmtDate(activity.completedAt, lang) : "-";
  const headerDate = (label) => <b style={{ color: C.text, fontWeight: 600 }}>{label}</b>;
  const headerMeta = !isExpanded && done
    ? <>Plan: {headerDate(planLabel)} - Actual: {headerDate(actualLabel)}</>
    : (!isExpanded && (open || status === "Locked"))
      ? <>{slaLabel} - Plan: {headerDate(planLabel)}</>
      : slaLabel;
  const tone = trkActivityStatusTone(C, status);
  const color = tone.accent;
  const iconName = done ? "check" : status === "Locked" ? "lock" : status === "Canceled" ? "ban" : status === "Hold" ? "pause" : "play";
  const isLoa = trkIsLoaActivity(activity);
  const showWinnerWorkspace = isCipHandoff || isLoa;
  const showBody = isExpanded && (done || open || (showWinnerWorkspace && status === "Locked"));
  const showLocked = isExpanded && status === "Locked" && !showWinnerWorkspace;
  const showClockIn = !isCipHandoff && open && !activity.startedAt;
  const showComplete = !isCipHandoff && !isLoa && open && canComplete;
  const showCancel = open && canCancel;
  const showRecycle = done && canRecycle;
  const hasActivityActions = showClockIn || showComplete || showCancel || showRecycle;
  const winnerVendors = showWinnerWorkspace ? trkWinnerVendorsForProposal(proposal, bidEvalState) : [];
  const cipEmbed = isCipHandoff && typeof renderCipActivityEmbed === "function"
    ? renderCipActivityEmbed({ proposal, activity, activityKey: trkCipEmbedActivityKey(activity), vendors: winnerVendors })
    : null;
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", backgroundColor: tone.iconBg, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", color, boxShadow: status === "Locked" ? "none" : `0 6px 14px ${color}24` }}>
          <Icon name={iconName} size={15} />
        </div>
        {!last && <div style={{ width: 2, flex: 1, minHeight: 28, backgroundColor: tone.connector, opacity: status === "Locked" ? 0.38 : 0.68, margin: "4px 0" }} />}
      </div>
      <div style={{ position: "relative", flex: 1, minWidth: 0, marginBottom: last ? 0 : 12, border: `1px solid ${tone.border}`, backgroundColor: status === "Locked" ? C.surfaceAlt : C.surface, borderRadius: RADIUS.lg, overflow: "hidden", opacity: status === "Locked" ? 0.82 : 1, boxShadow: `inset 4px 0 0 ${color}` }}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleExpanded && onToggleExpanded();
            }
          }}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 12px 16px", borderBottom: showBody ? `1px solid ${tone.border}` : "none", backgroundColor: tone.headerBg, cursor: "pointer", userSelect: "none" }}
        >
          <span style={{ width: 24, fontSize: 11, fontWeight: 700, color }}>{String(index + 1).padStart(2, "0")}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activity.title}</div>
            <div style={{ fontSize: 11.5, color: status === "Locked" ? C.textSubtle : C.textMuted }}>{headerMeta}</div>
          </div>
          {done && <Badge tone={late ? "danger" : "success"}>{late ? tt("Overdue", "Overdue") : tt("On time", "Tepat waktu")}</Badge>}
          <TrkActivityBadge status={status} />
          <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${tone.border}`, backgroundColor: C.surface, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} />
          </span>
        </div>
        {showBody && (
          <div style={{ padding: "12px 14px 12px 16px", display: "grid", gridTemplateColumns: "1fr", gap: 12, alignItems: "start", backgroundColor: tone.bodyBg }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                {done || isCipHandoff ? (
                  <>
                    <span><Icon name="calendar-check" size={12} /> Plan: <b style={{ color: C.text, fontWeight: 600 }}>{planLabel}</b></span>
                    <span><Icon name="flag" size={12} /> Actual: <b style={{ color: C.text, fontWeight: 600 }}>{activity.completedAt ? actualLabel : (open ? tt("Open", "Open") : "-")}</b></span>
                  </>
                ) : (
                  <span><Icon name="hourglass" size={12} /> Elapsed: <b style={{ color: (elapsed || 0) > activity.targetLeadDays ? C.danger : C.text }}>{elapsed == null ? 0 : elapsed} / {activity.targetLeadDays}d</b></span>
                )}
              </div>
              {activity.remark && <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{activity.remark}</div>}
              {activity.lockedReason && <div style={{ fontSize: 12.5, color: C.textMuted }}>{activity.lockedReason}</div>}
              {status === "Locked" && isCipHandoff && (
                <Alert
                  tone="info"
                  title={trkCipEmbedActivityKey(activity) === "contract"
                    ? tt("Contract waits for Term Sheet", "Contract menunggu Term Sheet")
                    : tt("Term Sheet waits for the award", "Term Sheet menunggu award")}
                  description={trkCipEmbedActivityKey(activity) === "contract"
                    ? tt("After Term Sheet is completed, Contract opens here in parallel with LOA. Each winner has their own Contract panel.", "Setelah Term Sheet selesai, Contract terbuka di sini paralel dengan LOA. Setiap pemenang punya panel Contract sendiri.")
                    : tt("Complete Bid Evaluation or Negotiation first. Each winner then gets a Term Sheet panel on this step.", "Selesaikan Bid Evaluation atau Negotiation dulu. Setiap pemenang kemudian punya panel Term Sheet di step ini.")}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
            {cipEmbed ? (
              <div>{cipEmbed}</div>
            ) : (
              <>
                <div>
                  <TrkActivityVendorPanel
                    proposal={proposal}
                    activity={activity}
                    status={status}
                    stepDocs={stepDocs}
                    bidEvalState={bidEvalState}
                    loaDocumentsByActivity={loaDocumentsByActivity}
                    canSelectWinner={canSelectWinner}
                    canGenerateLoa={canGenerateLoa}
                    canUpload={canComplete}
                    onAddVendorDoc={onAddVendorDoc}
                    onRemoveVendorDoc={onRemoveVendorDoc}
                    onToggleWinner={onToggleWinner}
                    onWinnerValueChange={onWinnerValueChange}
                    onAddWinnerProof={onAddWinnerProof}
                    onRemoveWinnerProof={onRemoveWinnerProof}
                    onGenerateLoa={onGenerateLoa}
                    onCompleteLoa={onCompleteLoa}
                    onViewDocument={onViewDocument}
                  />
                </div>
                <div>
                  <TrkStepNotesPanel
                    activity={activity}
                    notes={activityNotes}
                    draft={noteDraft}
                    actorName={actorName}
                    onDraftChange={onNoteDraftChange}
                    onPostNote={onPostNote}
                    defaultExpanded={notesDefaultExpanded}
                  />
                </div>
              </>
            )}
            {hasActivityActions && (
              <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 12, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                {showClockIn && <Button size="sm" variant="secondary" iconLeft="log-in" onClick={() => { trkClockInActivity(proposal.id, activity.id, proposal.assignedOfficerName); toast.push({ title: tt("Clock-in captured", "Clock-in tercatat"), description: activity.title }); }}>{tt("Clock in", "Clock in")}</Button>}
                {showComplete && <Button size="sm" iconLeft="check" onClick={() => onComplete(activity)}>{tt("Complete", "Selesaikan")}</Button>}
                {showCancel && <Tooltip label={tt("Cancel Proposal", "Cancel Proposal")} side="top"><Button size="sm" variant="destructive" iconLeft="ban" onClick={() => onCancel(activity)}>{tt("Cancel", "Cancel")}</Button></Tooltip>}
                {showRecycle && <Tooltip label={tt("Recycle Process", "Recycle Process")} side="top"><Button size="sm" variant="secondary" iconLeft="rotate-ccw" onClick={() => onRecycle(activity)} style={{ borderColor: C.orange, color: C.orange, backgroundColor: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.10)" }}>{tt("Recycle", "Recycle")}</Button></Tooltip>}
              </div>
            )}
          </div>
        )}
        {showLocked && (
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.borderSoft}`, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.textSubtle, display: "flex", gap: 7 }}><Icon name="lock" size={13} />{activity.lockedReason || tt("Locked until previous stage is completed.", "Terkunci sampai stage sebelumnya selesai.")}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function trkInitialActivityExpansion(proposal) {
  const next = {};
  (proposal.activities || []).forEach((activity) => {
    next[activity.id] = activity.status === "Pending";
  });
  return next;
}

function TrkQuickStepModal({ proposal, store, activityId, onClose, onNavigate, onOpenCipCase, renderCipActivityEmbed }) {
  const C = useC();
  const tt = useTT();
  const session = useSession();
  const toast = useToast();
  const [complete, setComplete] = React.useState(null);
  const [pdfDoc, setPdfDoc] = React.useState(null);
  const [stepDocs, setStepDocs] = React.useState(() => proposal ? trkLoadStepVendorDocs(proposal) : {});
  const [bidEvalState, setBidEvalState] = React.useState(() => proposal ? trkLoadBidEvalState(proposal) : {});
  const [activityNotes, setActivityNotes] = React.useState(() => proposal ? trkLoadActivityNotes(proposal) : {});
  const [noteDrafts, setNoteDrafts] = React.useState({});
  const [uploadTarget, setUploadTarget] = React.useState(null);
  const [loaTarget, setLoaTarget] = React.useState(null);
  const [loaCompleteTarget, setLoaCompleteTarget] = React.useState(null);
  const [cancelTarget, setCancelTarget] = React.useState(null);
  const [recycleTarget, setRecycleTarget] = React.useState(null);
  React.useEffect(() => {
    if (!proposal) return;
    setComplete(null);
    setPdfDoc(null);
    setStepDocs(trkLoadStepVendorDocs(proposal));
    setBidEvalState(trkLoadBidEvalState(proposal));
    setActivityNotes(trkLoadActivityNotes(proposal));
    setNoteDrafts({});
    setUploadTarget(null);
    setLoaTarget(null);
    setLoaCompleteTarget(null);
    setCancelTarget(null);
    setRecycleTarget(null);
    let cancelled = false;
    (async () => {
      await trkRefreshProposalAuxiliary(proposal);
      if (cancelled) return;
      setStepDocs(trkLoadStepVendorDocs(proposal));
      setBidEvalState(trkLoadBidEvalState(proposal));
      setActivityNotes(trkLoadActivityNotes(proposal));
    })();
    return () => { cancelled = true; };
  }, [proposal && proposal.id, activityId]);
  if (!proposal || !activityId) return null;
  const activityIndex = (proposal.activities || []).findIndex((item) => item.id === activityId);
  const activity = activityIndex >= 0 ? proposal.activities[activityIndex] : null;
  if (!activity) return null;
  const canCancel = trkCanCancelProposal(session, proposal);
  const canRecycle = trkCanRecycleProposal(session, proposal);
  const canComplete = trkCanCompleteActivity(session, proposal);
  const canSelectWinner = trkCanSelectBidWinner(session, proposal);
  const loaDocumentsByActivity = ((store && store.loaDocuments) || {})[proposal.id] || {};
  const activityNoteActor = (session.actingUser && session.actingUser.name) || proposal.assignedOfficerName || proposal.ownerName;
  const activityNoteRole = trkActivityNoteRoleForSession(session);
  const saveStepDocs = (next) => setStepDocs(trkSaveStepVendorDocs(proposal.id, next));
  const saveBidEvalState = (next) => setBidEvalState(trkSaveBidEvalState(proposal.id, next));
  const saveActivityNotes = (next) => setActivityNotes(trkSaveActivityNotes(proposal.id, next));
  const handleNoteDraftChange = (targetActivityId, value) => {
    setNoteDrafts((current) => ({ ...current, [targetActivityId]: value }));
  };
  const handlePostActivityNote = async (targetActivity) => {
    const message = String((noteDrafts && noteDrafts[targetActivity.id]) || "").trim();
    if (!message) {
      toast.push({ title: tt("Note is empty", "Notes masih kosong"), description: targetActivity.title, tone: "warning" });
      return;
    }
    const note = {
      id: `note-${targetActivity.id}-${Date.now()}`,
      activityId: targetActivity.id,
      authorName: activityNoteActor,
      authorRole: activityNoteRole,
      message,
      createdAt: trkNow(),
    };
    const next = { ...(activityNotes || {}), [targetActivity.id]: ((activityNotes && activityNotes[targetActivity.id]) || []).concat([note]) };
    saveActivityNotes(next);
    setNoteDrafts((current) => ({ ...current, [targetActivity.id]: "" }));
    try {
      await trkFlushProcurementStorage();
      toast.push({ title: tt("Step note posted", "Step note tersimpan"), description: targetActivity.title });
    } catch {
      toast.push({
        title: tt("Step note not saved", "Step note gagal tersimpan"),
        description: tt("The note is visible on this screen only. Refresh or another login will not see it.", "Notes hanya tampil di layar ini. Refresh atau login lain tidak akan melihatnya."),
        tone: "danger",
      });
    }
  };
  const handleAddVendorDoc = (targetActivity, vendor) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only the assigned Officer can upload vendor documents.", "Hanya Officer yang ditugaskan yang boleh mengunggah dokumen vendor."), tone: "warning" });
      return;
    }
    setUploadTarget({ key: `vendor-${targetActivity.id}-${vendor.vendorId}-${Date.now()}`, mode: "vendor", activity: targetActivity, vendor });
  };
  const handleSubmitUpload = async (target, file, remark) => {
    try {
      if (target.mode === "winner-proof") {
        const current = trkBidEvalForActivity(bidEvalState, target.activity.id);
        if ((current.proofDocuments || []).length) {
          toast.push({
            title: tt("Winner evidence already uploaded", "Evidence pemenang sudah ada"),
            description: tt("One PDF names every winner. Remove it first to replace.", "Satu PDF untuk semua pemenang. Hapus dulu untuk mengganti."),
            tone: "info",
          });
          setUploadTarget(null);
          return;
        }
      }
      const upload = await trkUploadDocument(file, { entityId: proposal.id, docType: target.mode === "winner-proof" ? "winner-proof" : trkSlugPart(target.activity.title) });
      if (target.mode === "winner-proof") {
        const current = trkBidEvalForActivity(bidEvalState, target.activity.id);
        const doc = trkBuildUploadedWinnerProof(proposal, target.activity, file, upload, remark);
        const next = { ...(bidEvalState || {}), [target.activity.id]: { ...current, proofDocuments: (current.proofDocuments || []).concat([doc]) } };
        saveBidEvalState(next);
        toast.push({ title: tt("Winner evidence stored", "Evidence pemenang tersimpan"), description: doc.fileName });
      } else {
        const doc = trkBuildUploadedVendorDocument(proposal, target.activity, target.vendor, file, upload, remark);
        const next = trkClone(stepDocs || {});
        next[target.activity.id] = next[target.activity.id] || {};
        next[target.activity.id][target.vendor.vendorId] = (next[target.activity.id][target.vendor.vendorId] || []).concat([doc]);
        saveStepDocs(next);
        toast.push({ title: tt("Vendor document stored", "Dokumen vendor tersimpan"), description: `${target.vendor.vendorName} - ${doc.fileName}` });
      }
      setUploadTarget(null);
    } catch (error) {
      toast.push({ title: tt("Upload failed", "Upload gagal"), description: (error && error.message) || tt("Unable to read selected file.", "File yang dipilih tidak bisa dibaca."), tone: "error" });
    }
  };
  const handleRemoveVendorDoc = async (targetActivity, vendor, doc) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only the assigned Officer can remove vendor documents.", "Hanya Officer yang ditugaskan yang boleh menghapus dokumen vendor."), tone: "warning" });
      return;
    }
    try { await trkDeleteDocument(doc); }
    catch (e) { toast.push({ title: tt("Delete failed", "Gagal menghapus"), description: (e && e.message) || tt("Could not delete the file from storage.", "Tidak bisa menghapus file dari storage."), tone: "error" }); return; }
    const next = trkClone(stepDocs || {});
    const byActivity = next[targetActivity.id] || {};
    const currentDocs = byActivity[vendor.vendorId] || [];
    const docId = doc && (doc.id || doc.fileName || doc.name);
    const remaining = currentDocs.filter((item) => (item.id || item.fileName || item.name) !== docId);
    if (remaining.length) byActivity[vendor.vendorId] = remaining;
    else delete byActivity[vendor.vendorId];
    next[targetActivity.id] = byActivity;
    saveStepDocs(next);
    toast.push({ title: tt("Vendor document removed", "Dokumen vendor dihapus"), description: `${vendor.vendorName} - ${(doc && (doc.fileName || doc.name)) || ""}`, tone: "warning" });
  };
  const handleToggleWinner = (targetActivity, vendor, checked) => {
    if (!canSelectWinner) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only Officer can select winner in Bid Evaluation.", "Hanya Officer yang boleh memilih winner di Bid Evaluation."), tone: "warning" });
      return;
    }
    const current = trkBidEvalForActivity(bidEvalState, targetActivity.id);
    const ids = checked
      ? Array.from(new Set(current.winnerVendorIds.concat([vendor.vendorId])))
      : current.winnerVendorIds.filter((id) => id !== vendor.vendorId);
    const winnerValues = trkPruneWinnerValues(current.winnerValues, ids);
    const next = { ...(bidEvalState || {}), [targetActivity.id]: { ...current, winnerVendorIds: ids, winnerValues } };
    saveBidEvalState(next);
    toast.push({ title: checked ? tt("Winner vendor selected", "Winner vendor dipilih") : tt("Winner vendor removed", "Winner vendor dilepas"), description: vendor.vendorName, tone: "info" });
  };
  const handleWinnerValueChange = (targetActivity, vendor, amount) => {
    if (!canSelectWinner) return;
    const current = trkBidEvalForActivity(bidEvalState, targetActivity.id);
    const winnerValues = trkPruneWinnerValues({ ...current.winnerValues, [vendor.vendorId]: amount }, current.winnerVendorIds);
    const next = { ...(bidEvalState || {}), [targetActivity.id]: { ...current, winnerValues } };
    saveBidEvalState(next);
  };
  const handleAddWinnerProof = (targetActivity) => {
    if (!canSelectWinner) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only the assigned Officer can upload winner evidence.", "Hanya Officer yang ditugaskan yang boleh mengunggah evidence pemenang."), tone: "warning" });
      return;
    }
    const current = trkBidEvalForActivity(bidEvalState, targetActivity.id);
    if ((current.proofDocuments || []).length) {
      toast.push({
        title: tt("Winner evidence already uploaded", "Evidence pemenang sudah ada"),
        description: tt("One PDF names every winner. Remove it first to replace.", "Satu PDF untuk semua pemenang. Hapus dulu untuk mengganti."),
        tone: "info",
      });
      return;
    }
    setUploadTarget({ key: `winner-${targetActivity.id}-${Date.now()}`, mode: "winner-proof", activity: targetActivity });
  };
  const handleRemoveWinnerProof = async (targetActivity, doc) => {
    if (!canSelectWinner) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only the assigned Officer can remove winner evidence.", "Hanya Officer yang ditugaskan yang boleh menghapus evidence pemenang."), tone: "warning" });
      return;
    }
    try { await trkDeleteDocument(doc); }
    catch (e) { toast.push({ title: tt("Delete failed", "Gagal menghapus"), description: (e && e.message) || tt("Could not delete the file from storage.", "Tidak bisa menghapus file dari storage."), tone: "error" }); return; }
    const current = trkBidEvalForActivity(bidEvalState, targetActivity.id);
    const docId = doc && (doc.id || doc.fileName || doc.name);
    const proofDocuments = current.proofDocuments.filter((item) => (item.id || item.fileName || item.name) !== docId);
    const next = { ...(bidEvalState || {}), [targetActivity.id]: { ...current, proofDocuments } };
    saveBidEvalState(next);
    toast.push({ title: tt("Winner evidence removed", "Evidence pemenang dihapus"), description: (doc && (doc.fileName || doc.name)) || targetActivity.title, tone: "warning" });
  };
  const handleGenerateLoa = async (targetActivity, vendor) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only Officer can generate or re-generate LOA.", "Hanya Officer yang boleh generate atau re-generate LOA."), tone: "warning" });
      return;
    }
    try {
      const support = await trkLoadLoaSupport(proposal.id, vendor.vendorId);
      setLoaTarget({ key: `loa-${targetActivity.id}-${vendor.vendorId}-${Date.now()}`, activity: targetActivity, vendor, support });
    } catch (error) {
      toast.push({ title: tt("Term Sheet is required", "Term Sheet wajib selesai"), description: tt("Complete and persist the winner's Term Sheet in Tracker before generating LOA.", "Selesaikan dan simpan Term Sheet vendor pemenang di Tracker sebelum generate LOA."), tone: "warning" });
    }
  };
  const handleSubmitLoa = async (target, form) => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.assignedOfficerName || proposal.ownerName;
    const payload = {
      ...form,
      attachmentFiles: (form.attachmentFiles || []).map((file) => ({ name: file.name, size: file.size, type: file.type })),
    };
    try {
      const nextStore = await trkGenerateLoaDocument(proposal.id, target.activity.id, target.vendor.vendorId, actor, payload);
      const generated = (((nextStore.loaDocuments || {})[proposal.id] || {})[target.activity.id] || {})[target.vendor.vendorId];
      if (generated) {
        toast.push({ title: tt("LOA generated", "LOA dibuat"), description: generated.fileName });
        setLoaTarget(null);
      }
    } catch (error) {
      toast.push({ title: tt("LOA generation failed", "Generate LOA gagal"), description: (error && error.message) || "Unable to persist LOA.", tone: "error" });
    }
  };
  const handleCompleteLoa = (targetActivity, vendor, loa) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only Officer can complete LOA.", "Hanya Officer yang boleh complete LOA."), tone: "warning" });
      return;
    }
    if (!loa) {
      toast.push({ title: tt("Generate LOA first", "Generate LOA dulu"), description: tt("Generate this winner’s LOA before completing the activity.", "Generate LOA pemenang ini dulu sebelum complete activity."), tone: "warning" });
      return;
    }
    setLoaCompleteTarget({ activity: targetActivity, vendor, loa });
  };
  const handleSubmitLoaComplete = async (target, remark, completedAt) => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.assignedOfficerName || proposal.ownerName;
    const winnerVendorIds = trkWinnerVendorsForProposal(proposal, bidEvalState).map((row) => row.vendorId);
    try {
      await trkCompleteLoaVendor(proposal.id, target.activity.id, target.vendor.vendorId, {
        remark,
        completedAt,
        actorName: actor,
        winnerVendorIds,
      });
      toast.push({ title: tt("LOA completed for winner", "LOA pemenang selesai"), description: target.vendor.vendorName });
      setLoaCompleteTarget(null);
    } catch (error) {
      toast.push({ title: tt("LOA completion failed", "Complete LOA gagal"), description: (error && error.message) || target.vendor.vendorName, tone: "error" });
    }
  };
  const handleRecycleActivity = (targetActivity) => {
    setRecycleTarget(targetActivity);
  };
  const handleSubmitRecycleActivity = async (targetActivity, reason) => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.ownerName || proposal.assignedOfficerName;
    // Purge downstream (later-activity) documents from Blob before reopening the workflow.
    try {
      const cleaned = await trkPurgeDownstreamActivityDocs(proposal, targetActivity.id, stepDocs, bidEvalState, loaDocumentsByActivity);
      saveStepDocs(cleaned.stepDocs);
      saveBidEvalState(cleaned.bidEvalState);
    } catch (e) { /* best-effort blob cleanup */ }
    trkRecycleActivity(proposal.id, targetActivity.id, reason, actor);
    await trkFlushProcurementStorage();
    toast.push({ title: tt("Activity recycled", "Activity direcycle"), description: targetActivity.title, tone: "warning" });
    setRecycleTarget(null);
  };
  const handleCancelActivity = (targetActivity) => setCancelTarget(targetActivity);
  const handleSubmitCancelActivity = (targetActivity, reason) => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.ownerName || proposal.assignedOfficerName;
    trkCancelProposal(proposal.id, targetActivity.id, reason, actor);
    toast.push({ title: tt("Proposal canceled", "Proposal dicancel"), description: proposal.proposalNumber, tone: "error" });
    setCancelTarget(null);
  };
  const handleCompleteActivity = (targetActivity) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only Officer can complete activity.", "Hanya Officer yang boleh melakukan Complete Activity."), tone: "warning" });
      return;
    }
    if (trkIsCipHandoffActivity(targetActivity)) {
      toast.push({
        title: tt("Complete in the winner panel", "Selesaikan di panel pemenang"),
        description: tt("Generate and complete Term Sheet or Contract in the winner panel on this step.", "Generate dan complete Term Sheet atau Contract di panel pemenang pada step ini."),
        tone: "info",
      });
      return;
    }
    if (trkIsBidEvaluationActivity(targetActivity)) {
      const current = trkBidEvalForActivity(bidEvalState, targetActivity.id);
      if (!current.winnerVendorIds.length) {
        toast.push({ title: tt("Winner vendor required", "Winner vendor wajib dipilih"), description: tt("Select at least one winner before completing Bid Evaluation.", "Pilih minimal satu winner sebelum menyelesaikan Bid Evaluation."), tone: "warning" });
        return;
      }
      if (!current.proofDocuments.length) {
        toast.push({ title: tt("Winner evidence required", "Evidence pemenang wajib ada"), description: tt("Upload winner evidence before completing Bid Evaluation.", "Upload evidence pemenang sebelum menyelesaikan Bid Evaluation."), tone: "warning" });
        return;
      }
      const winnerValueBlock = trkBidEvalWinnerValuesBlock(tt, current, proposal);
      if (winnerValueBlock) {
        toast.push({ ...winnerValueBlock, tone: "warning" });
        return;
      }
      const vendors = trkVendorsForProposal(proposal.id).filter((vendor) => current.winnerVendorIds.includes(vendor.vendorId));
      const evidenceNames = current.winnerVendorIds.map((id) => `winner::${id}`).concat(current.proofDocuments.map((doc) => doc.fileName || doc.name));
      setComplete({ ...targetActivity, completionEvidenceNames: evidenceNames, completionRemark: `Bid Evaluation completed. Winner vendor: ${vendors.map((vendor) => vendor.vendorName).join(", ")}.` });
      return;
    }
    if (trkIsLoaActivity(targetActivity)) {
      toast.push({
        title: tt("Complete in the winner panel", "Selesaikan di panel pemenang"),
        description: tt("Generate and complete LOA for each winner on this step. The LOA step closes when every winner is complete.", "Generate dan complete LOA untuk setiap pemenang di step ini. Step LOA tertutup setelah semua pemenang selesai."),
        tone: "info",
      });
      return;
    }
    const docsForActivity = trkStepVendorDocsForActivity(stepDocs, targetActivity.id);
    const vendors = trkVendorsForProposal(proposal.id);
    if (trkActivityAllowsSingleVendorDoc(targetActivity)) {
      const hasAny = vendors.some((vendor) => (docsForActivity[vendor.vendorId] || []).length);
      if (!hasAny) {
        toast.push({ title: tt("Vendor document required", "Dokumen vendor wajib ada"), description: tt("Upload at least one vendor document to complete this activity.", "Upload minimal satu dokumen vendor untuk menyelesaikan activity ini."), tone: "warning" });
        return;
      }
    } else {
      const missing = vendors.filter((vendor) => !(docsForActivity[vendor.vendorId] || []).length);
      if (missing.length) {
        toast.push({ title: tt("Vendor document required", "Dokumen vendor wajib ada"), description: `${missing.length} vendor still missing activity document(s).`, tone: "warning" });
        return;
      }
    }
    const evidenceNames = [];
    vendors.forEach((vendor) => (docsForActivity[vendor.vendorId] || []).forEach((doc) => evidenceNames.push(`${vendor.vendorId}::${doc.fileName || doc.name}`)));
    setComplete({ ...targetActivity, completionEvidenceNames: evidenceNames, completionRemark: `Completed ${targetActivity.title}; vendor documents reviewed for ${vendors.length} vendor(s).` });
  };

  const quickWidth = "min(96vw, 850px)";
  return (
    <>
      <Modal
        open={!!activity}
        onClose={onClose}
        width={quickWidth}
        icon="workflow"
        title={activity.title}
        subtitle={`${proposal.proposalNumber} - ${proposal.title}`}
        overlayStyle={{ padding: "8px 20px" }}
        style={{ maxWidth: quickWidth, height: "calc(100vh - 16px)", display: "flex", flexDirection: "column" }}
        bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflowY: "auto", padding: "16px 20px 20px" }}
      >
        <TrkActivityStep
          proposal={proposal}
          activity={activity}
          index={activityIndex}
          last
          isExpanded
          onToggleExpanded={() => {}}
          canCancel={canCancel}
          canRecycle={canRecycle}
          canComplete={canComplete}
          canSelectWinner={canSelectWinner}
          canGenerateLoa={canComplete}
          notesDefaultExpanded
          stepDocs={stepDocs}
          bidEvalState={bidEvalState}
          loaDocumentsByActivity={loaDocumentsByActivity}
          activityNotes={(activityNotes && activityNotes[activity.id]) || []}
          noteDraft={(noteDrafts && noteDrafts[activity.id]) || ""}
          actorName={activityNoteActor}
          onNoteDraftChange={handleNoteDraftChange}
          onPostNote={handlePostActivityNote}
          onComplete={handleCompleteActivity}
          onRecycle={handleRecycleActivity}
          onCancel={handleCancelActivity}
          onAddVendorDoc={handleAddVendorDoc}
          onRemoveVendorDoc={handleRemoveVendorDoc}
          onToggleWinner={handleToggleWinner}
          onWinnerValueChange={handleWinnerValueChange}
          onAddWinnerProof={handleAddWinnerProof}
          onRemoveWinnerProof={handleRemoveWinnerProof}
          onGenerateLoa={handleGenerateLoa}
          onCompleteLoa={handleCompleteLoa}
          onViewDocument={setPdfDoc}
          onNavigate={onNavigate}
          onOpenCipCase={onOpenCipCase}
          renderCipActivityEmbed={renderCipActivityEmbed}
        />
      </Modal>
      <CompleteModal proposal={proposal} activity={complete} onClose={() => setComplete(null)} onCompleted={onClose} onNavigate={onNavigate} onOpenCipCase={onOpenCipCase} />
      <TrkCancelReasonModal proposal={proposal} activity={cancelTarget} onClose={() => setCancelTarget(null)} onSubmit={handleSubmitCancelActivity} />
      <TrkRecycleReasonModal proposal={proposal} activity={recycleTarget} onClose={() => setRecycleTarget(null)} onSubmit={handleSubmitRecycleActivity} />
      <TrkUploadDocumentModal target={uploadTarget} onClose={() => setUploadTarget(null)} onSubmit={handleSubmitUpload} />
      <TrkLoaGeneratorModal target={loaTarget} proposal={proposal} onClose={() => setLoaTarget(null)} onSubmit={handleSubmitLoa} />
      <TrkLoaVendorCompleteModal target={loaCompleteTarget} onClose={() => setLoaCompleteTarget(null)} onSubmit={handleSubmitLoaComplete} />
      <TrkPdfDocumentModal document={pdfDoc} onClose={() => setPdfDoc(null)} />
    </>
  );
}

function TrkProposalMaterialsPanel({ proposal }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const [reloadKey, setReloadKey] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [state, setState] = React.useState({ loading: true, error: "", enabled: true, sample: false, sourceProposalId: null, currency: null, totalRows: 0, totalPages: 0, totals: [], rows: [] });

  React.useEffect(() => { setPage(1); }, [proposal.id]);

  React.useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "", enabled: true, sample: false, sourceProposalId: proposal.sourceProposalId || null }));
    fetch(`/api/v1/proposal-tracker/proposal-materials?proposalId=${encodeURIComponent(proposal.id)}&page=${page}&pageSize=${pageSize}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || payload.title || `HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          error: "",
          enabled: payload.enabled !== false,
          sample: payload.sample === true || payload.source === "sample",
          sourceProposalId: payload.sourceProposalId || null,
          currency: payload.currency || null,
          totalRows: Number(payload.totalRows) || 0,
          totalPages: Number(payload.totalPages) || 0,
          totals: Array.isArray(payload.totals) ? payload.totals : [],
          rows: Array.isArray(payload.rows) ? payload.rows : [],
        });
        if (Number(payload.page) > 0 && Number(payload.page) !== page) setPage(Number(payload.page));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ loading: false, error: (error && error.message) || "Unable to load materials.", enabled: false, sample: false, sourceProposalId: proposal.sourceProposalId || null, currency: null, totalRows: 0, totalPages: 0, totals: [], rows: [] });
      });
    return () => controller.abort();
  }, [proposal.id, page, pageSize, reloadKey]);

  const rows = state.rows || [];
  const isSampleMaterials = !!state.sample;
  const sourceLinked = isSampleMaterials || !!(state.sourceProposalId || proposal.sourceProposalId);
  const currency = state.currency || proposal.currency || "IDR";
  const totalsByCurrency = (state.totals || []).reduce((totals, total) => {
    totals[trkCurrencyCode(total.currency || "IDR")] = Number(total.totalPrice) || 0;
    return totals;
  }, {});
  const headCell = { padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 10.5, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", textAlign: "left" };
  const bodyCell = { padding: "11px 12px", borderBottom: `1px solid ${C.borderSoft}`, color: C.text, fontSize: 12, verticalAlign: "middle" };
  const numberCell = { ...bodyCell, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ marginBottom: 16 }}>
      <DetailCard
        title={tt("Proposal materials", "Material proposal")}
        subtitle={tt("Current material data is read directly from E-Proposal and is not copied into Proposal Tracker.", "Data material terkini dibaca langsung dari E-Proposal dan tidak disalin ke Proposal Tracker.")}
        action={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <Badge tone={state.enabled && sourceLinked ? "success" : "neutral"}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: state.enabled && sourceLinked ? C.success : C.textMuted, boxShadow: state.enabled && sourceLinked ? `0 0 0 3px ${C.success}1f` : "none" }} />
              {isSampleMaterials
                ? tt("Sample materials", "Material sample")
                : sourceLinked ? tt("Live E-Proposal", "Live E-Proposal") : tt("No E-Proposal link", "Tidak terhubung E-Proposal")}
            </Badge>
            {!state.loading && state.totalRows ? <Badge tone="info">{state.totalRows} {tt("items", "material")}</Badge> : null}
            <IconButton
              size="sm"
              variant="secondary"
              name="refresh-cw"
              title={tt("Refresh materials", "Refresh material")}
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={state.loading}
            />
          </div>
        }
        pad={0}
      >
        {state.loading ? (
          <div aria-live="polite" style={{ minHeight: 128, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: C.textMuted, fontSize: 12.5 }}>
            <Spinner size={18} color={C.ocean} />
            {tt("Loading live material data…", "Memuat data material live…")}
          </div>
        ) : state.error || !state.enabled ? (
          <div style={{ padding: 20 }}>
            <EmptyState
              icon="triangle-alert"
              title={tt("Material data unavailable", "Data material tidak tersedia")}
              description={state.error || tt("The E-Proposal material source cannot be reached right now.", "Sumber material E-Proposal belum dapat diakses.")}
              action={<Button size="sm" variant="secondary" iconLeft="refresh-cw" onClick={() => setReloadKey((value) => value + 1)}>{tt("Try again", "Coba lagi")}</Button>}
            />
          </div>
        ) : !rows.length ? (
          <div style={{ padding: 20 }}>
            <EmptyState
              icon="package-open"
              title={tt("No proposal materials", "Belum ada material proposal")}
              description={isSampleMaterials
                ? tt("This sample proposal has no material rows.", "Proposal sample ini belum punya baris material.")
                : tt("E-Proposal has no material rows linked to this proposal.", "Belum ada baris material E-Proposal yang terhubung ke proposal ini.")}
            />
          </div>
        ) : (
          <div>
            <div style={{ overflowX: "auto", maxHeight: 390, overflowY: "auto" }}>
              <table style={{ width: "100%", minWidth: 1050, borderCollapse: "separate", borderSpacing: 0 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2, backgroundColor: C.surfaceAlt }}>
                <tr>
                  <th style={{ ...headCell, width: 46, textAlign: "center" }}>#</th>
                  <th style={{ ...headCell, minWidth: 310 }}>{tt("Material", "Material")}</th>
                  <th style={headCell}>{tt("Subclass", "Subclass")}</th>
                  <th style={headCell}>{tt("Brand", "Brand")}</th>
                  <th style={{ ...headCell, textAlign: "right" }}>Qty</th>
                  <th style={{ ...headCell, textAlign: "right" }}>{tt("Estimated price", "Estimasi harga")}</th>
                  <th style={{ ...headCell, textAlign: "right" }}>{tt("Total", "Total")}</th>
                  <th style={headCell}>{tt("Required date", "Tanggal kebutuhan")}</th>
                  <th style={headCell}>{tt("Site / Plant", "Site / Plant")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowCurrency = row.currency || currency;
                  return (
                    <tr key={`${row.materialCode || "material"}-${index}`} style={{ backgroundColor: index % 2 ? C.surfaceAlt : C.surface }}>
                      <td style={{ ...bodyCell, textAlign: "center", color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{((page - 1) * pageSize) + index + 1}</td>
                      <td style={bodyCell}>
                        <div style={{ color: C.ocean, fontFamily: "monospace", fontSize: 11.5, fontWeight: 800 }}>{row.materialCode || "-"}</div>
                        <div style={{ marginTop: 3, color: C.text, fontSize: 12.2, fontWeight: 650, lineHeight: 1.35 }}>{row.materialDescription || "-"}</div>
                      </td>
                      <td style={{ ...bodyCell, whiteSpace: "nowrap" }}>{row.materialSubclass || "-"}</td>
                      <td style={{ ...bodyCell, whiteSpace: "nowrap" }}>{row.brand || "-"}</td>
                      <td style={numberCell}>{(Number(row.quantity) || 0).toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 4 })}</td>
                      <td style={numberCell}>{trkMoney(row.estimatedPrice, rowCurrency, lang)}</td>
                      <td style={{ ...numberCell, fontWeight: 800 }}>{trkMoney(row.totalPrice, rowCurrency, lang)}</td>
                      <td style={{ ...bodyCell, whiteSpace: "nowrap" }}>{row.requiredDate ? trkFmtDate(row.requiredDate, lang) : "-"}</td>
                      <td style={{ ...bodyCell, whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700 }}>{row.jobsite || "-"}</div>
                        <div style={{ marginTop: 2, color: C.textMuted, fontSize: 10.8 }}>{row.plant || "-"}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ position: "sticky", bottom: 0, zIndex: 1, backgroundColor: C.surface }}>
                <tr>
                  <td colSpan={6} style={{ ...bodyCell, borderBottom: 0, textAlign: "right", color: C.textMuted, fontWeight: 800 }}>{tt("Material total", "Total material")}</td>
                  <td style={{ ...numberCell, borderBottom: 0, color: C.ocean, fontSize: 12.5, fontWeight: 900 }}>
                    {Object.entries(totalsByCurrency).map(([code, total]) => <div key={code}>{trkMoney(total, code, lang)}</div>)}
                  </td>
                  <td colSpan={2} style={{ ...bodyCell, borderBottom: 0 }} />
                </tr>
              </tfoot>
              </table>
            </div>
            <div style={{ padding: "0 14px 12px" }}>
              <Pagination
                page={page}
                pageCount={Math.max(1, state.totalPages)}
                onPage={setPage}
                total={state.totalRows}
                pageSize={pageSize}
                onPageSize={(value) => { setPageSize(value); setPage(1); }}
              />
            </div>
          </div>
        )}
      </DetailCard>
    </div>
  );
}

function TrackerProposalDetail({ proposal, store, onBack, asModal, onNavigate, onOpenCipCase, renderCipActivityEmbed }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const toast = useToast();
  const [dist, setDist] = React.useState(null);
  const [complete, setComplete] = React.useState(null);
  const [pdfDoc, setPdfDoc] = React.useState(null);
  const [stepDocs, setStepDocs] = React.useState(() => trkLoadStepVendorDocs(proposal));
  const [bidEvalState, setBidEvalState] = React.useState(() => trkLoadBidEvalState(proposal));
  const [activityNotes, setActivityNotes] = React.useState(() => trkLoadActivityNotes(proposal));
  const [noteDrafts, setNoteDrafts] = React.useState({});
  const [uploadTarget, setUploadTarget] = React.useState(null);
  const [loaTarget, setLoaTarget] = React.useState(null);
  const [loaCompleteTarget, setLoaCompleteTarget] = React.useState(null);
  const [cancelTarget, setCancelTarget] = React.useState(null);
  const [recycleTarget, setRecycleTarget] = React.useState(null);
  const [assignTarget, setAssignTarget] = React.useState(null);
  const [editingAriba, setEditingAriba] = React.useState(false);
  const [aribaDraft, setAribaDraft] = React.useState(() => proposal.aribaId || "");
  const [downloadingEvidence, setDownloadingEvidence] = React.useState(false);
  const [expandedActivities, setExpandedActivities] = React.useState(() => trkInitialActivityExpansion(proposal));
  const workflowCardRef = React.useRef(null);
  const [sideMatchHeight, setSideMatchHeight] = React.useState(null);
  const sideTargetHeight = sideMatchHeight ? Math.max(sideMatchHeight, (TRK_DETAIL_SIDE_PANEL_MIN_HEIGHT * 2) + TRK_DETAIL_SIDE_GAP) : null;
  React.useEffect(() => {
    setStepDocs(trkLoadStepVendorDocs(proposal));
    setBidEvalState(trkLoadBidEvalState(proposal));
    setActivityNotes(trkLoadActivityNotes(proposal));
    setNoteDrafts({});
    setUploadTarget(null);
    setLoaTarget(null);
    setCancelTarget(null);
    setRecycleTarget(null);
    setAssignTarget(null);
    setEditingAriba(false);
    setAribaDraft(proposal.aribaId || "");
    let cancelled = false;
    (async () => {
      await trkRefreshProposalAuxiliary(proposal);
      if (cancelled) return;
      setStepDocs(trkLoadStepVendorDocs(proposal));
      setBidEvalState(trkLoadBidEvalState(proposal));
      setActivityNotes(trkLoadActivityNotes(proposal));
    })();
    return () => { cancelled = true; };
  }, [proposal.id]);
  React.useEffect(() => {
    if (!editingAriba) setAribaDraft(proposal.aribaId || "");
  }, [proposal.aribaId, editingAriba]);
  const activityIdsKey = (proposal.activities || []).map((activity) => activity.id).join("|");
  React.useEffect(() => {
    setExpandedActivities(trkInitialActivityExpansion(proposal));
  }, [proposal.id, activityIdsKey]);
  React.useLayoutEffect(() => {
    const el = workflowCardRef.current;
    if (!el) return;
    let raf = null;
    const measure = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const wide = window.innerWidth > 1180;
        setSideMatchHeight(wide ? Math.round(el.getBoundingClientRect().height) : null);
      });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [proposal.id]);
  const method = trkMethodById(proposal.trackerMethod);
  const pct = trkProgressPct(proposal);
  const strategyText = (proposal.distribution && proposal.distribution.strategy) || "-";
  const canDistribute = proposal.lifecycleStatus === "ReadyToDistribute" && trkCanDistributeProposal(session, proposal);
  const canDownloadEvidence = proposal.lifecycleStatus === "OnProgress" || proposal.lifecycleStatus === "Completed" || proposal.lifecycleStatus === "Canceled";
  const canCancel = trkCanCancelProposal(session, proposal);
  const canRecycle = trkCanRecycleProposal(session, proposal);
  const canComplete = trkCanCompleteActivity(session, proposal);
  const canSelectWinner = trkCanSelectBidWinner(session, proposal);
  const canAssign = trkCanReassignProposal(session, proposal);
  const canEditAriba = trkCanEditAribaId(session, proposal);
  const handleSaveAribaId = () => {
    const next = String(aribaDraft || "").trim();
    if (next.length > 64) {
      toast.push({ title: tt("ARIBA ID too long", "ARIBA ID terlalu panjang"), description: tt("Maximum 64 characters.", "Maksimal 64 karakter."), tone: "warning" });
      return;
    }
    if (next === String(proposal.aribaId || "").trim()) {
      setEditingAriba(false);
      return;
    }
    trkUpdateProposalAribaId(proposal.id, next);
    setEditingAriba(false);
    toast.push({ title: tt("ARIBA ID updated", "ARIBA ID diperbarui"), description: next || tt("Cleared", "Dikosongkan") });
  };
  const loaDocumentsByActivity = ((store.loaDocuments || {})[proposal.id]) || {};
  const activityNoteActor = (session.actingUser && session.actingUser.name) || proposal.assignedOfficerName || proposal.ownerName;
  const activityNoteRole = trkActivityNoteRoleForSession(session);
  const saveStepDocs = (next) => setStepDocs(trkSaveStepVendorDocs(proposal.id, next));
  const saveBidEvalState = (next) => setBidEvalState(trkSaveBidEvalState(proposal.id, next));
  const saveActivityNotes = (next) => setActivityNotes(trkSaveActivityNotes(proposal.id, next));
  const setAllActivityExpanded = (expanded) => {
    const next = {};
    (proposal.activities || []).forEach((activity) => { next[activity.id] = expanded; });
    setExpandedActivities(next);
  };
  const toggleActivityExpanded = (activityId) => {
    setExpandedActivities((current) => ({ ...current, [activityId]: current[activityId] === false }));
  };
  const handleNoteDraftChange = (activityId, value) => {
    setNoteDrafts((current) => ({ ...current, [activityId]: value }));
  };
  const handlePostActivityNote = async (activity) => {
    const message = String((noteDrafts && noteDrafts[activity.id]) || "").trim();
    if (!message) {
      toast.push({ title: tt("Note is empty", "Notes masih kosong"), description: activity.title, tone: "warning" });
      return;
    }
    const note = {
      id: `note-${activity.id}-${Date.now()}`,
      activityId: activity.id,
      authorName: activityNoteActor,
      authorRole: activityNoteRole,
      message,
      createdAt: trkNow(),
    };
    const next = { ...(activityNotes || {}), [activity.id]: ((activityNotes && activityNotes[activity.id]) || []).concat([note]) };
    saveActivityNotes(next);
    setNoteDrafts((current) => ({ ...current, [activity.id]: "" }));
    try {
      await trkFlushProcurementStorage();
      toast.push({ title: tt("Step note posted", "Step note tersimpan"), description: activity.title });
    } catch {
      toast.push({
        title: tt("Step note not saved", "Step note gagal tersimpan"),
        description: tt("The note is visible on this screen only. Refresh or another login will not see it.", "Notes hanya tampil di layar ini. Refresh atau login lain tidak akan melihatnya."),
        tone: "danger",
      });
    }
  };
  const handleAddVendorDoc = (activity, vendor) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only the assigned Officer can upload vendor documents.", "Hanya Officer yang ditugaskan yang boleh mengunggah dokumen vendor."), tone: "warning" });
      return;
    }
    setUploadTarget({ key: `vendor-${activity.id}-${vendor.vendorId}-${Date.now()}`, mode: "vendor", activity, vendor });
  };
  const handleSubmitUpload = async (target, file, remark) => {
    try {
      if (target.mode === "winner-proof") {
        const current = trkBidEvalForActivity(bidEvalState, target.activity.id);
        if ((current.proofDocuments || []).length) {
          toast.push({
            title: tt("Winner evidence already uploaded", "Evidence pemenang sudah ada"),
            description: tt("One PDF names every winner. Remove it first to replace.", "Satu PDF untuk semua pemenang. Hapus dulu untuk mengganti."),
            tone: "info",
          });
          setUploadTarget(null);
          return;
        }
      }
      const upload = await trkUploadDocument(file, { entityId: proposal.id, docType: target.mode === "winner-proof" ? "winner-proof" : trkSlugPart(target.activity.title) });
      if (target.mode === "winner-proof") {
        const current = trkBidEvalForActivity(bidEvalState, target.activity.id);
        const doc = trkBuildUploadedWinnerProof(proposal, target.activity, file, upload, remark);
        const next = { ...(bidEvalState || {}), [target.activity.id]: { ...current, proofDocuments: (current.proofDocuments || []).concat([doc]) } };
        saveBidEvalState(next);
        toast.push({ title: tt("Winner evidence stored", "Evidence pemenang tersimpan"), description: doc.fileName });
      } else {
        const doc = trkBuildUploadedVendorDocument(proposal, target.activity, target.vendor, file, upload, remark);
        const next = trkClone(stepDocs || {});
        next[target.activity.id] = next[target.activity.id] || {};
        next[target.activity.id][target.vendor.vendorId] = (next[target.activity.id][target.vendor.vendorId] || []).concat([doc]);
        saveStepDocs(next);
        toast.push({ title: tt("Vendor document stored", "Dokumen vendor tersimpan"), description: `${target.vendor.vendorName} - ${doc.fileName}` });
      }
      setUploadTarget(null);
    } catch (error) {
      toast.push({ title: tt("Upload failed", "Upload gagal"), description: (error && error.message) || tt("Unable to read selected file.", "File yang dipilih tidak bisa dibaca."), tone: "error" });
    }
  };
  const handleRemoveVendorDoc = async (activity, vendor, doc) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only the assigned Officer can remove vendor documents.", "Hanya Officer yang ditugaskan yang boleh menghapus dokumen vendor."), tone: "warning" });
      return;
    }
    try { await trkDeleteDocument(doc); }
    catch (e) { toast.push({ title: tt("Delete failed", "Gagal menghapus"), description: (e && e.message) || tt("Could not delete the file from storage.", "Tidak bisa menghapus file dari storage."), tone: "error" }); return; }
    const next = trkClone(stepDocs || {});
    const byActivity = next[activity.id] || {};
    const currentDocs = byActivity[vendor.vendorId] || [];
    const docId = doc && (doc.id || doc.fileName || doc.name);
    const remaining = currentDocs.filter((item) => (item.id || item.fileName || item.name) !== docId);
    if (remaining.length) byActivity[vendor.vendorId] = remaining;
    else delete byActivity[vendor.vendorId];
    next[activity.id] = byActivity;
    saveStepDocs(next);
    toast.push({ title: tt("Vendor document removed", "Dokumen vendor dihapus"), description: `${vendor.vendorName} - ${(doc && (doc.fileName || doc.name)) || ""}`, tone: "warning" });
  };
  const handleToggleWinner = (activity, vendor, checked) => {
    if (!canSelectWinner) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only Officer can select winner in Bid Evaluation.", "Hanya Officer yang boleh memilih winner di Bid Evaluation."), tone: "warning" });
      return;
    }
    const current = trkBidEvalForActivity(bidEvalState, activity.id);
    const ids = checked
      ? Array.from(new Set(current.winnerVendorIds.concat([vendor.vendorId])))
      : current.winnerVendorIds.filter((id) => id !== vendor.vendorId);
    const winnerValues = trkPruneWinnerValues(current.winnerValues, ids);
    const next = { ...(bidEvalState || {}), [activity.id]: { ...current, winnerVendorIds: ids, winnerValues } };
    saveBidEvalState(next);
    toast.push({ title: checked ? tt("Winner vendor selected", "Winner vendor dipilih") : tt("Winner vendor removed", "Winner vendor dilepas"), description: vendor.vendorName, tone: "info" });
  };
  const handleWinnerValueChange = (activity, vendor, amount) => {
    if (!canSelectWinner) return;
    const current = trkBidEvalForActivity(bidEvalState, activity.id);
    const winnerValues = trkPruneWinnerValues({ ...current.winnerValues, [vendor.vendorId]: amount }, current.winnerVendorIds);
    const next = { ...(bidEvalState || {}), [activity.id]: { ...current, winnerValues } };
    saveBidEvalState(next);
  };
  const handleAddWinnerProof = (activity) => {
    if (!canSelectWinner) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only the assigned Officer can upload winner evidence.", "Hanya Officer yang ditugaskan yang boleh mengunggah evidence pemenang."), tone: "warning" });
      return;
    }
    const current = trkBidEvalForActivity(bidEvalState, activity.id);
    if ((current.proofDocuments || []).length) {
      toast.push({
        title: tt("Winner evidence already uploaded", "Evidence pemenang sudah ada"),
        description: tt("One PDF names every winner. Remove it first to replace.", "Satu PDF untuk semua pemenang. Hapus dulu untuk mengganti."),
        tone: "info",
      });
      return;
    }
    setUploadTarget({ key: `winner-${activity.id}-${Date.now()}`, mode: "winner-proof", activity });
  };
  const handleRemoveWinnerProof = async (activity, doc) => {
    if (!canSelectWinner) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only the assigned Officer can remove winner evidence.", "Hanya Officer yang ditugaskan yang boleh menghapus evidence pemenang."), tone: "warning" });
      return;
    }
    try { await trkDeleteDocument(doc); }
    catch (e) { toast.push({ title: tt("Delete failed", "Gagal menghapus"), description: (e && e.message) || tt("Could not delete the file from storage.", "Tidak bisa menghapus file dari storage."), tone: "error" }); return; }
    const current = trkBidEvalForActivity(bidEvalState, activity.id);
    const docId = doc && (doc.id || doc.fileName || doc.name);
    const proofDocuments = current.proofDocuments.filter((item) => (item.id || item.fileName || item.name) !== docId);
    const next = { ...(bidEvalState || {}), [activity.id]: { ...current, proofDocuments } };
    saveBidEvalState(next);
    toast.push({ title: tt("Winner evidence removed", "Evidence pemenang dihapus"), description: (doc && (doc.fileName || doc.name)) || activity.title, tone: "warning" });
  };
  const handleGenerateLoa = async (activity, vendor) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only Officer can generate or re-generate LOA.", "Hanya Officer yang boleh generate atau re-generate LOA."), tone: "warning" });
      return;
    }
    try {
      const support = await trkLoadLoaSupport(proposal.id, vendor.vendorId);
      setLoaTarget({ key: `loa-${activity.id}-${vendor.vendorId}-${Date.now()}`, activity, vendor, support });
    } catch (error) {
      toast.push({ title: tt("Term Sheet is required", "Term Sheet wajib selesai"), description: tt("Complete and persist the winner's Term Sheet in Tracker before generating LOA.", "Selesaikan dan simpan Term Sheet vendor pemenang di Tracker sebelum generate LOA."), tone: "warning" });
    }
  };
  const handleSubmitLoa = async (target, form) => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.assignedOfficerName || proposal.ownerName;
    const payload = {
      ...form,
      attachmentFiles: (form.attachmentFiles || []).map((file) => ({ name: file.name, size: file.size, type: file.type })),
    };
    try {
      const nextStore = await trkGenerateLoaDocument(proposal.id, target.activity.id, target.vendor.vendorId, actor, payload);
      const generated = (((nextStore.loaDocuments || {})[proposal.id] || {})[target.activity.id] || {})[target.vendor.vendorId];
      if (generated) {
        toast.push({ title: tt("LOA generated", "LOA dibuat"), description: generated.fileName });
        setLoaTarget(null);
      }
    } catch (error) {
      toast.push({ title: tt("LOA generation failed", "Generate LOA gagal"), description: (error && error.message) || "Unable to persist LOA.", tone: "error" });
    }
  };
  const handleCompleteLoa = (activity, vendor, loa) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only Officer can complete LOA.", "Hanya Officer yang boleh complete LOA."), tone: "warning" });
      return;
    }
    if (!loa) {
      toast.push({ title: tt("Generate LOA first", "Generate LOA dulu"), description: tt("Generate this winner’s LOA before completing the activity.", "Generate LOA pemenang ini dulu sebelum complete activity."), tone: "warning" });
      return;
    }
    setLoaCompleteTarget({ activity, vendor, loa });
  };
  const handleSubmitLoaComplete = async (target, remark, completedAt) => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.assignedOfficerName || proposal.ownerName;
    const winnerVendorIds = trkWinnerVendorsForProposal(proposal, bidEvalState).map((row) => row.vendorId);
    try {
      await trkCompleteLoaVendor(proposal.id, target.activity.id, target.vendor.vendorId, {
        remark,
        completedAt,
        actorName: actor,
        winnerVendorIds,
      });
      toast.push({ title: tt("LOA completed for winner", "LOA pemenang selesai"), description: target.vendor.vendorName });
      setLoaCompleteTarget(null);
    } catch (error) {
      toast.push({ title: tt("LOA completion failed", "Complete LOA gagal"), description: (error && error.message) || target.vendor.vendorName, tone: "error" });
    }
  };
  const handleRecycleActivity = (activity) => {
    setRecycleTarget(activity);
  };
  const handleSubmitRecycleActivity = async (activity, reason) => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.ownerName || proposal.assignedOfficerName;
    // Purge downstream (later-activity) documents from Blob before reopening the workflow.
    try {
      const cleaned = await trkPurgeDownstreamActivityDocs(proposal, activity.id, stepDocs, bidEvalState, loaDocumentsByActivity);
      saveStepDocs(cleaned.stepDocs);
      saveBidEvalState(cleaned.bidEvalState);
    } catch (e) { /* best-effort blob cleanup */ }
    trkRecycleActivity(proposal.id, activity.id, reason, actor);
    await trkFlushProcurementStorage();
    toast.push({ title: tt("Activity recycled", "Activity direcycle"), description: activity.title, tone: "warning" });
    setRecycleTarget(null);
  };
  const handleCancelActivity = (activity) => {
    setCancelTarget(activity);
  };
  const handleSubmitCancelActivity = (activity, reason) => {
    const actor = (session.actingUser && session.actingUser.name) || proposal.ownerName || proposal.assignedOfficerName;
    trkCancelProposal(proposal.id, activity.id, reason, actor);
    toast.push({ title: tt("Proposal canceled", "Proposal dicancel"), description: proposal.proposalNumber, tone: "error" });
    setCancelTarget(null);
  };
  const handleCompleteActivity = (activity) => {
    if (!canComplete) {
      toast.push({ title: tt("Officer only", "Hanya Officer"), description: tt("Only Officer can complete activity.", "Hanya Officer yang boleh melakukan Complete Activity."), tone: "warning" });
      return;
    }
    if (trkIsCipHandoffActivity(activity)) {
      toast.push({
        title: tt("Complete in the winner panel", "Selesaikan di panel pemenang"),
        description: tt("Generate and complete Term Sheet or Contract in the winner panel on this step.", "Generate dan complete Term Sheet atau Contract di panel pemenang pada step ini."),
        tone: "info",
      });
      return;
    }
    if (trkIsBidEvaluationActivity(activity)) {
      const current = trkBidEvalForActivity(bidEvalState, activity.id);
      if (!current.winnerVendorIds.length) {
        toast.push({ title: tt("Winner vendor required", "Winner vendor wajib dipilih"), description: tt("Select at least one winner before completing Bid Evaluation.", "Pilih minimal satu winner sebelum menyelesaikan Bid Evaluation."), tone: "warning" });
        return;
      }
      if (!current.proofDocuments.length) {
        toast.push({ title: tt("Winner evidence required", "Evidence pemenang wajib ada"), description: tt("Upload winner evidence before completing Bid Evaluation.", "Upload evidence pemenang sebelum menyelesaikan Bid Evaluation."), tone: "warning" });
        return;
      }
      const winnerValueBlock = trkBidEvalWinnerValuesBlock(tt, current, proposal);
      if (winnerValueBlock) {
        toast.push({ ...winnerValueBlock, tone: "warning" });
        return;
      }
      const vendors = trkVendorsForProposal(proposal.id).filter((vendor) => current.winnerVendorIds.includes(vendor.vendorId));
      const evidenceNames = current.winnerVendorIds.map((id) => `winner::${id}`).concat(current.proofDocuments.map((doc) => doc.fileName || doc.name));
      setComplete({
        ...activity,
        completionEvidenceNames: evidenceNames,
        completionRemark: `Bid Evaluation completed. Winner vendor: ${vendors.map((vendor) => vendor.vendorName).join(", ")}.`,
      });
      return;
    }
    if (trkIsLoaActivity(activity)) {
      toast.push({
        title: tt("Complete in the winner panel", "Selesaikan di panel pemenang"),
        description: tt("Generate and complete LOA for each winner on this step. The LOA step closes when every winner is complete.", "Generate dan complete LOA untuk setiap pemenang di step ini. Step LOA tertutup setelah semua pemenang selesai."),
        tone: "info",
      });
      return;
    }
    const docsForActivity = trkStepVendorDocsForActivity(stepDocs, activity.id);
    const vendors = trkVendorsForProposal(proposal.id);
    if (trkActivityAllowsSingleVendorDoc(activity)) {
      const hasAny = vendors.some((vendor) => (docsForActivity[vendor.vendorId] || []).length);
      if (!hasAny) {
        toast.push({ title: tt("Vendor document required", "Dokumen vendor wajib ada"), description: tt("Upload at least one vendor document to complete this activity.", "Upload minimal satu dokumen vendor untuk menyelesaikan activity ini."), tone: "warning" });
        return;
      }
    } else {
      const missing = vendors.filter((vendor) => !(docsForActivity[vendor.vendorId] || []).length);
      if (missing.length) {
        toast.push({ title: tt("Vendor document required", "Dokumen vendor wajib ada"), description: `${missing.length} vendor still missing activity document(s).`, tone: "warning" });
        return;
      }
    }
    const evidenceNames = [];
    vendors.forEach((vendor) => (docsForActivity[vendor.vendorId] || []).forEach((doc) => evidenceNames.push(`${vendor.vendorId}::${doc.fileName || doc.name}`)));
    setComplete({
      ...activity,
      completionEvidenceNames: evidenceNames,
      completionRemark: `Completed ${activity.title}; vendor documents reviewed for ${vendors.length} vendor(s).`,
    });
  };
  return (
    <div style={asModal ? { display: "flex", flexDirection: "column", minHeight: 0, height: "100%", flex: 1 } : undefined}>
      {!asModal && (
        <div style={{ position: "sticky", top: 12, zIndex: 18, height: 0, display: "flex", justifyContent: "flex-end", pointerEvents: "none" }}>
          <Button
            variant="secondary"
            size="sm"
            iconLeft="arrow-left"
            onClick={onBack}
            style={{ pointerEvents: "auto", boxShadow: C.shadowSm }}
          >
            {tt("Back", "Kembali")}
          </Button>
        </div>
      )}
      <div
        style={asModal ? {
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 6,
          backgroundColor: C.surface,
          padding: "12px 16px 14px",
          borderBottom: `1px solid ${C.borderSoft}`,
          boxShadow: C.scheme === "dark" ? "0 10px 22px -16px rgba(0,0,0,0.55)" : "0 10px 22px -16px rgba(15,23,42,0.38)",
        } : undefined}
      >
        <PageHeader
          style={asModal ? { marginBottom: 0, gap: 8 } : undefined}
          breadcrumb={asModal ? [{ label: proposal.proposalNumber }] : [{ label: tt("Proposal Tracker", "Daftar Proposal"), onClick: onBack }, { label: proposal.proposalNumber }]}
          title={proposal.title}
          meta={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Badge tone={method.tone}>{method.name}</Badge><Badge tone="neutral"><Icon name="map-pin" size={11} />{proposal.jobsite}</Badge><Badge tone="neutral">{proposal.commodity}</Badge><TrkStatusBadge status={proposal.lifecycleStatus} /></div>}
          actions={
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {canDownloadEvidence ? (
                <Button
                  variant="secondary"
                  iconLeft="download"
                  disabled={downloadingEvidence}
                  style={asModal ? undefined : { marginRight: 104 }}
                  onClick={async () => {
                    setDownloadingEvidence(true);
                    try {
                      await trkDownloadHistoricalEvidence(proposal, { stepDocs, bidEvalState, loaDocumentsByActivity });
                    } catch (error) {
                      toast.push({ title: tt("Download failed", "Download gagal"), description: (error && error.message) || proposal.proposalNumber, tone: "error" });
                    } finally {
                      setDownloadingEvidence(false);
                    }
                  }}
                >
                  {downloadingEvidence ? tt("Preparing…", "Menyiapkan…") : tt("Download Historical Evidence", "Download Historical Evidence")}
                </Button>
              ) : null}
              {canDistribute ? <Button iconLeft="send" onClick={() => setDist(proposal)} style={asModal ? undefined : { marginRight: 104 }}>{tt("Distribute", "Distribusi")}</Button> : null}
              {asModal ? <IconButton name="x" size="sm" variant="secondary" title={tt("Close", "Tutup")} onClick={onBack} /> : null}
            </div>
          }
        />
      </div>

      <div style={asModal ? { flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 16px 20px" } : undefined}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, alignItems: "stretch" }} className="ag-trk-row3">
        <div style={{ display: "grid", minWidth: 0, height: "100%" }}>
          <DetailCard
            title={tt("Proposal profile", "Profil proposal")}
            subtitle={tt("Key identity, ownership, value, and SLA snapshot for this proposal.", "Identitas, ownership, nilai, dan ringkasan SLA proposal ini.")}
            style={{ height: "100%" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <InfoList items={[
                { label: "Proposal No", value: <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0 }}><b style={{ color: C.ocean, fontFamily: "monospace", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{proposal.proposalNumber}</b><IconButton size="sm" variant="secondary" name="search" title={tt("View proposal document", "Lihat dokumen proposal")} onClick={() => setPdfDoc(trkBuildProposalDocument(proposal))} style={{ width: 28, height: 28 }} /></span> },
                {
                  label: "ARIBA",
                  value: editingAriba ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <TextInput
                          size="sm"
                          value={aribaDraft}
                          maxLength={64}
                          onChange={(e) => setAribaDraft(e.target.value)}
                          placeholder={tt("Enter ARIBA ID", "Masukkan ARIBA ID")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleSaveAribaId(); }
                            if (e.key === "Escape") { e.preventDefault(); setEditingAriba(false); setAribaDraft(proposal.aribaId || ""); }
                          }}
                        />
                      </div>
                      <IconButton size="sm" variant="secondary" name="check" title={tt("Save", "Simpan")} onClick={handleSaveAribaId} style={{ width: 28, height: 28, color: C.success }} />
                      <IconButton size="sm" variant="secondary" name="x" title={tt("Cancel", "Batal")} onClick={() => { setEditingAriba(false); setAribaDraft(proposal.aribaId || ""); }} style={{ width: 28, height: 28 }} />
                    </span>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0 }}>
                      <b style={{ color: proposal.aribaId ? C.text : C.textMuted, fontFamily: "monospace", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>{proposal.aribaId || "-"}</b>
                      {canEditAriba && (
                        <IconButton
                          size="sm"
                          variant="secondary"
                          name="pencil"
                          title={tt("Edit ARIBA ID", "Edit ARIBA ID")}
                          onClick={() => { setAribaDraft(proposal.aribaId || ""); setEditingAriba(true); }}
                          style={{ width: 28, height: 28 }}
                        />
                      )}
                    </span>
                  ),
                },
                { label: tt("Owner", "Owner"), value: <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Avatar name={proposal.ownerName} size={22} />{proposal.ownerName}</span> },
                { label: tt("Officer", "Officer"), value: <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proposal.assignedOfficerName || "-"}</span>{canAssign && <Tooltip label="Assign to Other Officer" side="top"><Button size="xs" variant="secondary" iconLeft="user-round-cog" onClick={() => setAssignTarget(proposal)} style={{ height: 24, padding: "0 8px", fontSize: 10.5, textTransform: "lowercase", flexShrink: 0, borderColor: C.orange, color: C.orange, backgroundColor: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.11)", boxShadow: C.scheme === "dark" ? "0 0 0 1px rgba(240,116,61,0.12)" : "0 3px 8px rgba(235,102,46,0.14)" }}>{tt("re-assign", "re-assign")}</Button></Tooltip>}</span> },
                { label: tt("Contract type", "Tipe kontrak"), value: proposal.contractType || "-" },
                { label: tt("Value", "Nilai"), value: <b>{trkMoney(proposal.amount, proposal.currency, lang)}</b> },
                { label: tt("Requirement date", "Tanggal kebutuhan"), value: trkFmtDate(proposal.requirementDate, lang) },
              ]} />
              <div style={{ paddingTop: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>SLA</span>
                  <span style={{ flex: 1, height: 1, backgroundColor: C.borderSoft }} />
                </div>
                <div className="ag-trk-sla-host" style={{ display: "grid", gap: 12 }}>
                  <div className="ag-trk-sla-metrics">
                    <MiniMetric icon="target" label={tt("Method SLA", "SLA metode")} value={`${proposal.slaDays}d`} />
                    <MiniMetric icon="hourglass" label="Aging" value={`${proposal.agingDays}d`} danger={proposal.overdueDays > 0} />
                    <MiniMetric icon="calendar-check" label={tt("Estimated finish", "Estimasi selesai")} value={trkProposalEstimatedDate(proposal) ? trkFmtDate(trkProposalEstimatedDate(proposal), lang) : "-"} />
                  </div>
                  <div style={{ height: 8, borderRadius: 999, backgroundColor: C.surfaceAlt, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, pct)}%`, backgroundColor: proposal.overdueDays > 0 ? C.danger : C.ocean }} /></div>
                </div>
              </div>
            </div>
          </DetailCard>
        </div>
        <TrkReadinessPanel proposal={proposal} onViewDocument={setPdfDoc} style={{ height: "100%" }} />
      </div>

      <TrkProposalMaterialsPanel proposal={proposal} />

      <div style={{ marginBottom: 16 }}>
        <DetailCard title={tt("Strategy", "Strategi")}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>{strategyText}</div>
        </DetailCard>
      </div>

      <div className="ag-trk-detail-lower" style={{ display: "grid", gridTemplateColumns: "minmax(0, 59.5fr) minmax(324px, 40.5fr)", gap: 16, alignItems: "start" }}>
        <div ref={workflowCardRef} style={{ minWidth: 0 }}>
          <DetailCard
            title={tt("Activity workflow", "Alur aktivitas")}
            subtitle={tt("Every activity unlocks sequentially. Section Head can recycle completed steps or cancel active proposals directly.", "Setiap aktivitas terbuka berurutan. Section Head dapat recycle step selesai atau cancel proposal aktif secara langsung.")}
            action={proposal.activities && proposal.activities.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <IconButton size="sm" variant="secondary" name="chevrons-down" title={tt("Expand all", "Expand all")} tipSide="top" onClick={() => setAllActivityExpanded(true)} />
                <IconButton size="sm" variant="secondary" name="chevrons-up" title={tt("Collapse all", "Collapse all")} tipSide="top" onClick={() => setAllActivityExpanded(false)} />
              </div>
            ) : null}
            pad={0}
          >
            <div style={{ padding: "12px 20px 20px" }}>
              {proposal.activities && proposal.activities.length ? proposal.activities.map((a, i) => (
                <TrkActivityStep
                  key={a.id}
                  proposal={proposal}
                  activity={a}
                  index={i}
                  last={i === proposal.activities.length - 1}
                  isExpanded={expandedActivities[a.id] !== false}
                  onToggleExpanded={() => toggleActivityExpanded(a.id)}
                  canCancel={canCancel}
                  canRecycle={canRecycle}
                  canComplete={canComplete}
                  canSelectWinner={canSelectWinner}
                  canGenerateLoa={canComplete}
                  notesDefaultExpanded={a.status === "Pending"}
                  stepDocs={stepDocs}
                  bidEvalState={bidEvalState}
                  loaDocumentsByActivity={loaDocumentsByActivity}
                  activityNotes={(activityNotes && activityNotes[a.id]) || []}
                  noteDraft={(noteDrafts && noteDrafts[a.id]) || ""}
                  actorName={activityNoteActor}
                  onNoteDraftChange={handleNoteDraftChange}
                  onPostNote={handlePostActivityNote}
                  onComplete={handleCompleteActivity}
                  onRecycle={handleRecycleActivity}
                  onCancel={handleCancelActivity}
                  onAddVendorDoc={handleAddVendorDoc}
                  onRemoveVendorDoc={handleRemoveVendorDoc}
                  onToggleWinner={handleToggleWinner}
                  onWinnerValueChange={handleWinnerValueChange}
                  onAddWinnerProof={handleAddWinnerProof}
                  onRemoveWinnerProof={handleRemoveWinnerProof}
                  onGenerateLoa={handleGenerateLoa}
                  onCompleteLoa={handleCompleteLoa}
                  onViewDocument={setPdfDoc}
                  onNavigate={onNavigate}
                  onOpenCipCase={onOpenCipCase}
                  renderCipActivityEmbed={renderCipActivityEmbed}
                />
              )) : <EmptyState icon="send" title={tt("Not distributed yet", "Belum didistribusikan")} description={tt("Distribute the proposal to generate SLA timeline and activities.", "Distribusikan proposal untuk membuat timeline SLA dan aktivitas.")} action={canDistribute ? <Button iconLeft="send" onClick={() => setDist(proposal)}>{tt("Distribute proposal", "Distribusikan proposal")}</Button> : null} />}
            </div>
          </DetailCard>
        </div>
        <div className="ag-trk-detail-side" style={{ display: "flex", flexDirection: "column", gap: TRK_DETAIL_SIDE_GAP, minWidth: 0, minHeight: 0, height: sideTargetHeight || "auto" }}>
          <TrkNotesSummaryPanel proposal={proposal} activityNotes={activityNotes} fill={!!sideTargetHeight} style={{ flex: sideTargetHeight ? "1 1 0" : undefined, minHeight: TRK_DETAIL_SIDE_PANEL_MIN_HEIGHT }} />
          <TrkActivityHistoryPanel proposal={proposal} fill={!!sideTargetHeight} style={{ flex: sideTargetHeight ? "1 1 0" : undefined, minHeight: TRK_DETAIL_SIDE_PANEL_MIN_HEIGHT }} />
        </div>
      </div>
      </div>

      <DistributionModal proposal={dist} onClose={() => setDist(null)} />
      <TrkAssignOfficerModal proposal={assignTarget} onClose={() => setAssignTarget(null)} />
      <CompleteModal proposal={proposal} activity={complete} onClose={() => setComplete(null)} onNavigate={onNavigate} onOpenCipCase={onOpenCipCase} />
      <TrkCancelReasonModal proposal={proposal} activity={cancelTarget} onClose={() => setCancelTarget(null)} onSubmit={handleSubmitCancelActivity} />
      <TrkRecycleReasonModal proposal={proposal} activity={recycleTarget} onClose={() => setRecycleTarget(null)} onSubmit={handleSubmitRecycleActivity} />
      <TrkUploadDocumentModal target={uploadTarget} onClose={() => setUploadTarget(null)} onSubmit={handleSubmitUpload} />
      <TrkLoaGeneratorModal target={loaTarget} proposal={proposal} onClose={() => setLoaTarget(null)} onSubmit={handleSubmitLoa} />
      <TrkLoaVendorCompleteModal target={loaCompleteTarget} onClose={() => setLoaCompleteTarget(null)} onSubmit={handleSubmitLoaComplete} />
      <TrkPdfDocumentModal document={pdfDoc} onClose={() => setPdfDoc(null)} />
    </div>
  );
}

function MiniMetric({ icon, label, value, danger }) {
  const C = useC();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, backgroundColor: danger ? C.dangerBg : C.brandBg, color: danger ? C.danger : C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={14} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontSize: 13.5, color: danger ? C.danger : C.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      </div>
    </div>
  );
}

function trkCompactTableDate(value) {
  return fmtAppDate(value);
}
function trkProposalStepStages() {
  return (TRK_STAGE_MASTER || []).filter((stage) => stage && stage.code !== "PROP");
}
function trkProposalStepApplicable(proposal, stage) {
  if (!proposal || !stage) return false;
  const method = typeof trkMethodById === "function" ? trkMethodById(proposal.trackerMethod) : null;
  const stages = (method && Array.isArray(method.stages)) ? method.stages : [];
  return stages.some((row) => row && row[0] === stage.id);
}
function trkProposalActivityForStage(proposal, stage) {
  return (proposal.activities || []).find((a) => a.stageId === stage.id || a.title === stage.name);
}
function trkProposalStageHeaderLabel(stage) {
  return ((stage && (stage.name || stage.code)) || "").replace(/\s+\([A-Z][A-Z0-9&/-]*\)$/, "");
}
function trkCommodityName(value) {
  return String(value || "-").replace(/^[A-Z]\.\d{2}\.\d{2}\s+/, "");
}
function trkDateOnlyTime(value) {
  const d = trkParse(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function trkScheduleTone(actualDate, planDate) {
  const actual = trkDateOnlyTime(actualDate);
  const plan = trkDateOnlyTime(planDate);
  if (actual == null || plan == null) return "neutral";
  return actual > plan ? "danger" : "success";
}
function trkPendingTone(planDate) {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${trkPad(now.getMonth() + 1)}-${trkPad(now.getDate())}`;
  const today = trkDateOnlyTime(typeof TRK_TODAY !== "undefined" ? TRK_TODAY : todayIso);
  const plan = trkDateOnlyTime(planDate);
  if (today == null || plan == null) return "neutral";
  return today > plan ? "danger" : "success";
}
function trkProposalEstimatedDate(proposal) {
  if (!proposal || !proposal.distribution) return undefined;
  if (typeof trkDynamicEstimatedDate === "function") return trkDynamicEstimatedDate(proposal);
  const contract = (proposal.activities || []).find((activity) => activity.title === "Contract");
  if (contract && contract.targetDate) return contract.targetDate;
  const last = (proposal.activities || []).filter((activity) => activity.targetDate).slice(-1)[0];
  return (last && last.targetDate) || proposal.distribution.estimatedDate;
}
function trkProposalMatrixCell(proposal, stage, kind) {
  const applicable = trkProposalStepApplicable(proposal, stage);
  if (!applicable) return { value: "", applicable: false, tone: "na" };
  if (proposal.lifecycleStatus === "ReadyToDistribute") return { value: "", applicable: true, tone: "empty" };
  const activity = trkProposalActivityForStage(proposal, stage);
  if (kind === "plan") {
    return { value: trkCompactTableDate(activity && activity.targetDate), applicable: true, tone: "plan", activity };
  }
  if (activity && activity.status === "Canceled") return { value: "Canceled", applicable: true, tone: "danger", activity };
  if (activity && activity.completedAt) {
    return { value: trkCompactTableDate(activity.completedAt), applicable: true, tone: trkScheduleTone(activity.completedAt, activity.targetDate), activity };
  }
  if (activity && activity.status === "Pending") return { value: "Open", applicable: true, tone: trkPendingTone(activity.targetDate), activity };
  // Locked Term Sheet / LOA / Contract must not look Open. LOA and Contract become
  // Pending (green Open) only after at least one winner completes Term Sheet.
  return { value: "-", applicable: true, tone: "empty", activity };
}
function trkEstimatedMatrixCell(proposal) {
  const estimatedDate = trkProposalEstimatedDate(proposal);
  if (!estimatedDate) return { value: "", applicable: true, tone: "empty" };
  return { value: trkCompactTableDate(estimatedDate), applicable: true, tone: trkScheduleTone(estimatedDate, proposal.requirementDate) };
}
function TrkMatrixDateCell({ cell, activeHover, variant = "actual", onClick, title }) {
  const C = useC();
  const isDateBadge = variant === "plan" || variant === "actual" || variant === "estimated";
  const isOpenPulse = variant === "actual" && cell && cell.value === "Open";
  const clickable = typeof onClick === "function" && cell && cell.applicable && cell.value && cell.value !== "-";
  const toneStyle = {
    na: { color: "#fff", backgroundColor: "#111827", borderColor: "#111827", fontWeight: 700 },
    plan: { color: C.textMuted, backgroundColor: C.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(1,59,82,0.045)", borderColor: C.borderSoft },
    success: { color: "#fff", backgroundColor: "#11713B", borderColor: "#11713B", boxShadow: "0 5px 12px rgba(17,113,59,0.24)", fontWeight: 700 },
    danger: { color: "#fff", backgroundColor: "#C5341A", borderColor: "#C5341A", boxShadow: "0 5px 12px rgba(197,52,26,0.26)", fontWeight: 700 },
    neutral: { color: "#fff", backgroundColor: "#64748b", borderColor: "#64748b", boxShadow: "0 5px 12px rgba(100,116,139,0.22)", fontWeight: 700 },
    empty: { color: C.textSubtle, backgroundColor: "transparent", borderColor: "transparent" },
  }[cell.tone] || {};
  if (!cell.applicable) return <span aria-label="Not applicable" style={{ display: "block", minHeight: 19 }} />;
  const commonStyle = { ...FONT, display: "inline-flex", minWidth: isDateBadge ? 68 : 42, maxWidth: "100%", justifyContent: "center", alignItems: "center", minHeight: isDateBadge ? 24 : 19, padding: isDateBadge ? "3px 5px" : "1px 5px", borderRadius: isDateBadge ? RADIUS.sm : RADIUS.pill, border: `1px solid ${toneStyle.borderColor || "transparent"}`, fontSize: isDateBadge ? 8.8 : 9.2, lineHeight: 1.12, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", transform: activeHover ? "translateY(-1px)" : "translateY(0)", transition: "transform 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease", ...toneStyle };
  if (clickable) {
    return (
      <button
        type="button"
        className={isOpenPulse ? "ag-trk-open-pulse" : undefined}
        data-trk-step-open="1"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.nativeEvent && event.nativeEvent.stopImmediatePropagation) event.nativeEvent.stopImmediatePropagation();
          onClick(event);
        }}
        onMouseDown={(event) => event.stopPropagation()}
        title={title}
        style={{ ...commonStyle, cursor: "pointer", boxShadow: toneStyle.boxShadow || "none", outline: "none" }}
      >
        {cell.value || ""}
      </button>
    );
  }
  return (
    <span className={isOpenPulse ? "ag-trk-open-pulse" : undefined} style={commonStyle}>
      {cell.value || ""}
    </span>
  );
}
function TrkReqEstDateCell({ proposal, estimatedCell, activeHover }) {
  return (
    <div className="ag-trk-datepair" style={{ display: "flex", alignItems: "center", justifyContent: "center", transform: activeHover ? "translateY(-1px)" : "translateY(0)", transition: "transform 0.16s ease" }}>
      <TrkMatrixDateCell cell={{ value: trkCompactTableDate(proposal.requirementDate), applicable: true, tone: "plan" }} activeHover={false} variant="plan" />
      <TrkMatrixDateCell cell={estimatedCell} activeHover={false} variant="estimated" />
    </div>
  );
}
function TrkPlanActualDateCell({ plan, actual, activeHover, onOpenActual }) {
  const tt = useTT();
  return (
    <div className="ag-trk-datepair" style={{ display: "flex", alignItems: "center", justifyContent: "center", transform: activeHover ? "translateY(-1px)" : "translateY(0)", transition: "transform 0.16s ease" }}>
      <TrkMatrixDateCell cell={plan} activeHover={false} variant="plan" />
      <TrkMatrixDateCell cell={actual} activeHover={false} variant="actual" onClick={onOpenActual} title={tt("Open this activity step", "Buka step aktivitas ini")} />
    </div>
  );
}
function TrkProposalMatrixTable({ rows, session, onOpenDetail, onDistribute, onOpenStep }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const frameRef = React.useRef(null);
  const headerScrollRef = React.useRef(null);
  const bodyScrollRef = React.useRef(null);
  const fakeScrollRef = React.useRef(null);
  const fakeInnerRef = React.useRef(null);
  const [hoveredDateColumn, setHoveredDateColumn] = React.useState(null);
  const [proposalSticky, setProposalSticky] = React.useState(() => {
    try {
      const stored = window.__procurementStorage.getItem("tracker.proposals.sticky-proposal");
      return stored == null ? true : stored === "true";
    } catch (e) { return true; }
  });
  const stages = trkProposalStepStages();
  const mastersReady = stages.length > 0 && Array.isArray(TRK_METHODS) && TRK_METHODS.length > 0;
  const frameKey = `${mastersReady ? 1 : 0}:${rows.length}`;
  const containerW = useConstrainedFrameWidth(frameRef, frameKey);
  const bodyOverflow = useBodyHOverflow(bodyScrollRef, `${frameKey}:${containerW}`);
  const proposalWidth = 335;
  const baseStepWidths = stages.map((stage) => Math.max(104, Math.min(150, String(trkProposalStageHeaderLabel(stage) || "").length * 5.8 + 10)));
  const reqEstWidth = 108;
  const valueWidth = 104;
  const picWidth = 154;
  const statusWidth = 118;
  const actionWidth = 52;
  const fixedWidth = proposalWidth + reqEstWidth + valueWidth + picWidth + statusWidth + actionWidth;
  const minWidth = fixedWidth + baseStepWidths.reduce((total, width) => total + width, 0);
  const tableWidth = containerW ? Math.max(minWidth, containerW) : minWidth;
  const stretchPerStep = stages.length ? Math.max(0, tableWidth - minWidth) / stages.length : 0;
  const stepWidths = baseStepWidths.map((width) => width + stretchPerStep);
  const overflowing = (containerW > 0 && minWidth > containerW + 1) || bodyOverflow.overflowing;
  const stickyProposal = proposalSticky ? { position: "sticky", left: 0, zIndex: 4, backgroundColor: C.surface, boxShadow: `inset -1px 0 0 ${C.borderSoft}, 14px 0 22px -22px rgba(15,23,42,0.42)` } : {};
  const stickyProposalHead = proposalSticky ? { ...stickyProposal, zIndex: 7, backgroundColor: C.surfaceAlt } : { backgroundColor: C.surfaceAlt };
  const tableStyle = { width: tableWidth, minWidth, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", fontSize: 12.5 };
  const dateHoverStyle = (key) => hoveredDateColumn === key ? { backgroundColor: C.brandBg, boxShadow: `inset 0 0 0 1px ${C.ocean}33`, transition: "background-color 0.16s ease, box-shadow 0.16s ease" } : { transition: "background-color 0.16s ease, box-shadow 0.16s ease" };
  const dateHoverBind = (key) => ({ onMouseEnter: () => setHoveredDateColumn(key) });
  const colGroup = () => (
    <colgroup>
      <col style={{ width: proposalWidth }} />
      {stages.map((stage, index) => <col key={stage.id} style={{ width: stepWidths[index] }} />)}
      <col style={{ width: reqEstWidth }} />
      <col style={{ width: valueWidth }} />
      <col style={{ width: picWidth }} />
      <col style={{ width: statusWidth }} />
      <col style={{ width: actionWidth }} />
    </colgroup>
  );
  useLockstepHScroll(bodyScrollRef, headerScrollRef, fakeScrollRef, `${frameKey}:${tableWidth}:${overflowing ? 1 : 0}`);
  React.useEffect(() => {
    try { window.__procurementStorage.setItem("tracker.proposals.sticky-proposal", String(proposalSticky)); } catch (e) {}
  }, [proposalSticky]);
  React.useEffect(() => {
    const onStorage = (event) => {
      if (event.key === "tracker.proposals.sticky-proposal") setProposalSticky(event.newValue == null ? true : event.newValue === "true");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const frameStyle = { ...FONT, position: "relative", borderRadius: RADIUS.lg, width: "100%", minWidth: 0, maxWidth: "100%" };
  if (!mastersReady) {
    return (
      <div ref={frameRef} style={frameStyle}>
        <EmptyState
          icon="loader"
          title={tt("Loading process model…", "Memuat model proses…")}
          description={tt("Waiting for tracker steps and methods from the server.", "Menunggu step dan metode tracker dari server.")}
          action={<Button variant="secondary" iconLeft="refresh-cw" onClick={() => typeof loadTrackerProcessModel === "function" && loadTrackerProcessModel(true)}>{tt("Retry", "Coba lagi")}</Button>}
        />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div ref={frameRef} style={frameStyle}>
        <EmptyState icon="search-x" title={tt("No proposals found", "Tidak ada proposal")} description={tt("Adjust filters or reset the seed.", "Sesuaikan filter atau reset seed.")} />
      </div>
    );
  }
  return (
    <div ref={frameRef} onMouseLeave={() => setHoveredDateColumn(null)} style={frameStyle}>
      <div style={{ position: "sticky", top: 0, zIndex: 9, backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
        <div ref={headerScrollRef} className="ag-hide-scroll" style={{ overflowX: "auto", overflowY: "hidden" }}>
          <table style={tableStyle}>
            {colGroup()}
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...stickyProposalHead, padding: "5px", borderBottom: `1px solid ${C.border}`, textAlign: "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted }}>
                  <label title={tt("Pin Proposal column to the left", "Tempel kolom Proposal di kiri")} onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={proposalSticky} onChange={(e) => setProposalSticky(e.target.checked)} style={{ width: 13, height: 13, margin: 0, accentColor: C.ocean, cursor: "pointer" }} />
                    <span>Proposal</span>
                  </label>
                </th>
                {stages.map((stage, index) => (
                  <th key={stage.id} {...dateHoverBind(stage.id)} style={{ padding: "5px", borderBottom: `1px solid ${C.border}`, borderLeft: index === 0 ? `1px solid ${C.borderSoft}` : 0, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 10.5, color: C.text, fontWeight: 700, whiteSpace: "normal", lineHeight: 1.2, ...dateHoverStyle(stage.id) }}>
                    <Tooltip label={stage.name} side="top">
                      <span style={{ display: "block" }}>{trkProposalStageHeaderLabel(stage)}</span>
                    </Tooltip>
                  </th>
                ))}
                <th rowSpan={2} title={tt("Requirement Date / Estimated Date", "Tanggal kebutuhan / tanggal estimasi")} {...dateHoverBind("req-est")} style={{ padding: "5px", borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 10, letterSpacing: "0.01em", color: C.textMuted, fontWeight: 700, ...dateHoverStyle("req-est") }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 4, lineHeight: 1.05 }}>
                    <span>{tt("Requirement Date", "Tanggal Kebutuhan")}</span>
                    <span>{tt("Estimated Date", "Tanggal Estimasi")}</span>
                  </span>
                </th>
                <th rowSpan={2} style={{ padding: "5px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt, textAlign: "right", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted }}>Value</th>
                <th rowSpan={2} style={{ padding: "5px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt, textAlign: "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted }}>{tt("Person in Charge", "Penanggung Jawab")}</th>
                <th rowSpan={2} style={{ padding: "5px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt, textAlign: "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted }}>Status</th>
                <th rowSpan={2} style={{ padding: "5px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt, textAlign: "right", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted }} />
              </tr>
              <tr>
                {stages.map((stage) => (
                  <th key={`${stage.id}-plan-actual`} {...dateHoverBind(stage.id)} style={{ padding: "5px", borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 9.5, color: C.textMuted, fontWeight: 700, whiteSpace: "nowrap", ...dateHoverStyle(stage.id) }}>Plan / Actual</th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>
      <div ref={bodyScrollRef} className="ag-hide-scroll" style={{ overflowX: "auto", overflowY: "hidden", backgroundColor: C.surface }}>
        <table style={tableStyle}>
          {colGroup()}
          <tbody>
            {rows.map((p, rowIndex) => {
              const method = trkMethodById(p.trackerMethod) || {};
              const rowBg = rowIndex % 2 ? C.surfaceInset : C.surface;
              return (
                <tr
                  key={p.id}
                  onClick={(event) => {
                    if (event.target && event.target.closest && event.target.closest("[data-trk-step-open]")) return;
                    onOpenDetail(p);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ ...stickyProposal, backgroundColor: rowBg, padding: "8px 10px", borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: "top", overflow: "hidden" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, height: 22, whiteSpace: "nowrap" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 900, color: C.ocean, paddingTop: 0 }}>{p.proposalNumber}</span>
                        <span style={{ color: C.textSubtle }}>|</span>
                        <span style={{ fontFamily: "monospace", fontSize: 11.5, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", paddingTop: 0 }}>{p.aribaId || "-"}</span>
                        {p.overdueDays > 0 && <Badge tone="danger" size="sm">+{p.overdueDays}d</Badge>}
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.22, color: C.text, fontWeight: 500, paddingTop: 2, paddingBottom: 2, whiteSpace: "normal" }}>{p.title}</div>
                      <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 10.5, lineHeight: 1.22, color: C.textMuted, whiteSpace: "normal" }}>
                          {p.jobsite} <span style={{ color: C.textSubtle }}>.</span> <b style={{ color: C.text }}>{method.name || p.trackerMethod || "—"}</b>{p.contractType ? <React.Fragment> <span style={{ color: C.textSubtle }}>.</span> {p.contractType}</React.Fragment> : null}
                        </div>
                        {p.lifecycleStatus === "ReadyToDistribute" && trkCanDistributeProposal(session, p) && <TrkInlineDistributeBadge proposal={p} onDistribute={onDistribute} />}
                      </div>
                    </div>
                  </td>
                  {stages.map((stage) => {
                    const plan = trkProposalMatrixCell(p, stage, "plan");
                    const actual = trkProposalMatrixCell(p, stage, "actual");
                    const naBg = !plan.applicable ? "#111827" : rowBg;
                    const activeHover = hoveredDateColumn === stage.id;
                    const openStep = actual.activity && onOpenStep;
                    return (
                      <td
                        key={stage.id}
                        data-trk-step-open={openStep ? "1" : undefined}
                        {...dateHoverBind(stage.id)}
                        onMouseDown={openStep ? (event) => event.stopPropagation() : undefined}
                        onClick={openStep ? (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (event.nativeEvent && event.nativeEvent.stopImmediatePropagation) event.nativeEvent.stopImmediatePropagation();
                          onOpenStep(p, actual.activity);
                        } : undefined}
                        style={{ padding: "5px 1px", textAlign: "center", borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: naBg, verticalAlign: "middle", ...dateHoverStyle(stage.id) }}
                      >
                        <TrkPlanActualDateCell plan={plan} actual={actual} activeHover={activeHover} onOpenActual={actual.activity && onOpenStep ? () => onOpenStep(p, actual.activity) : undefined} />
                      </td>
                    );
                  })}
                  <td {...dateHoverBind("req-est")} style={{ padding: "5px 3px", textAlign: "center", borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle", ...dateHoverStyle("req-est") }}>
                    <TrkReqEstDateCell proposal={p} estimatedCell={trkEstimatedMatrixCell(p)} activeHover={hoveredDateColumn === "req-est"} />
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, textAlign: "right", verticalAlign: "middle" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }} title={trkMoney(p.amount, p.currency, lang)}>
                      {trkMoneyCompact(p.amount, p.currency, lang)}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <span title={tt(`Section Head (assigner): ${p.ownerName || "-"}`, `Section Head (yang assign): ${p.ownerName || "-"}`)} style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <Icon name="user-round-cog" size={12} color={C.ocean} />
                        <span style={{ fontSize: 11.5, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.ownerName || "-"}</span>
                      </span>
                      <span title={tt(`Officer (assigned): ${p.assignedOfficerName || "Not assigned"}`, `Officer (yang di-assign): ${p.assignedOfficerName || "Belum di-assign"}`)} style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <Icon name="user-round" size={12} color={C.textMuted} />
                        <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.assignedOfficerName || "—"}</span>
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle" }}><TrkStatusBadge status={p.lifecycleStatus} /></td>
                  <td onClick={(e) => e.stopPropagation()} style={{ padding: "9px 12px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, textAlign: "right", verticalAlign: "middle" }}>
                    <IconButton name="arrow-right" size="sm" title={tt("Open detail", "Buka detail")} onClick={() => onOpenDetail(p)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        ref={fakeScrollRef}
        aria-hidden="true"
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 6,
          height: overflowing ? 14 : 0,
          overflowX: "scroll",
          overflowY: "hidden",
          borderTop: overflowing ? `1px solid ${C.border}` : "none",
          backgroundColor: C.surface,
          opacity: overflowing ? 1 : 0,
          pointerEvents: overflowing ? "auto" : "none",
          transition: "opacity 0.15s",
        }}
      >
        <div ref={fakeInnerRef} style={{ width: Math.max(tableWidth, bodyOverflow.scrollWidth || 0), height: 1 }} />
      </div>
    </div>
  );
}
// Detail modal sizing tuned for Full HD @ 125% (≈1536×864 CSS): width 1450, vertical gutters 18 (=28−10).
// Other viewports scale gutters/cap so the dialog stays framed without feeling cramped or sparse.
function trkDetailModalLayout(vw, vh) {
  const padX = vw >= 1800 ? 32 : vw >= 1600 ? 24 : vw >= 1400 ? 18 : vw >= 1100 ? 16 : 12;
  const padY = vh >= 900 ? 20 : vh >= 780 ? 18 : vh >= 680 ? 14 : 10;
  const preferred = 1450;
  const maxCap = vw >= 1920 ? 1630 : vw >= 1680 ? 1530 : preferred;
  const width = Math.max(320, Math.min(maxCap, vw - padX * 2));
  return {
    width,
    overlayStyle: { padding: `${padY}px ${padX}px`, alignItems: "flex-start" },
    // CIP case detail keeps Modal chrome outside the scroller. Proposal Profile
    // hides that chrome, so the dialog itself is a flex column: identity header
    // stays pinned, only the body scrolls.
    style: { overflow: "hidden", display: "flex", flexDirection: "column", height: `calc(100vh - ${padY * 2}px)` },
    bodyStyle: { padding: 0, maxHeight: "none", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
  };
}
function useTrkDetailModalLayout() {
  const read = () => trkDetailModalLayout(
    (typeof window !== "undefined" && window.innerWidth) || 1536,
    (typeof window !== "undefined" && window.innerHeight) || 864,
  );
  const [layout, setLayout] = React.useState(read);
  React.useEffect(() => {
    const onResize = () => setLayout(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return layout;
}
function TrkProposalWorkspaceSwitch({ value, onChange }) {
  const C = useC();
  const tt = useTT();
  const items = [
    { key: "proposals", icon: "clipboard-list", label: tt("Proposals", "Proposal") },
    { key: "termsheet", icon: "file-signature", label: tt("Term Sheet & Contract", "Term Sheet & Kontrak") },
  ];
  return (
    <div role="tablist" aria-label={tt("Proposal workspace", "Workspace proposal")} style={{ display: "inline-flex", padding: 4, borderRadius: RADIUS.lg, backgroundColor: C.surfaceAlt, border: `1px solid ${C.border}`, gap: 4, boxShadow: C.scheme === "dark" ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "inset 0 1px 0 rgba(255,255,255,0.7)" }}>
      {items.map((item) => {
        const active = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            style={{
              ...FONT,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 36,
              padding: "0 14px",
              borderRadius: RADIUS.md,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 750,
              letterSpacing: "-0.01em",
              color: active ? "#fff" : C.textMuted,
              backgroundColor: active ? C.ocean : "transparent",
              boxShadow: active ? "0 8px 18px rgba(1,59,82,0.18)" : "none",
              transition: "background-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease",
            }}
          >
            <Icon name={item.icon} size={15} color={active ? "#fff" : C.textMuted} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
function TrackerProposals({ onNavigate, initialProposal, initialArg, onConsumeInitial, preferTermSheetView, renderTermSheetView, renderCipActivityEmbed }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const toast = useToast();
  const store = useTrackerStore();
  const detailModalLayout = useTrkDetailModalLayout();
  const navArg = initialArg != null ? initialArg : initialProposal;
  const [syncing, setSyncing] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [sampleOpen, setSampleOpen] = React.useState(false);
  const [workspace, setWorkspace] = React.useState(() => (preferTermSheetView || trkIsCipCaseKey(navArg) ? "termsheet" : "proposals"));
  const [cipCaseId, setCipCaseId] = React.useState(() => (trkIsCipCaseKey(navArg) ? String(navArg) : null));
  const [detailId, setDetailId] = React.useState(() => (trkIsCipCaseKey(navArg) ? null : (navArg || null)));
  const [quickStep, setQuickStep] = React.useState(null);
  const [statusF, setStatusF] = React.useState("all");
  const [methodF, setMethodF] = React.useState("all");
  const [siteF, setSiteF] = React.useState("all");
  const [stepF, setStepF] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [dist, setDist] = React.useState(null);
  const ps = usePageSearch(tt("Search proposal, owner, site, commodity...", "Cari proposal, owner, site, komoditas..."));
  const q = ps.query, setQ = ps.setQuery;
  const [, setMasterTick] = React.useState(0);
  React.useEffect(() => { trkHydrateFromDomain(); }, []);
  React.useEffect(() => {
    const personnelNo = trkActingPersonnelNo(session);
    try { window.loadTrackerAssignableUsers && window.loadTrackerAssignableUsers(true, personnelNo); } catch (e) {}
  }, [session && trkActingPersonnelNo(session)]);
  const openCipCase = React.useCallback((caseId) => {
    if (!caseId) return;
    setCipCaseId(String(caseId));
  }, []);
  React.useEffect(() => {
    if (!navArg) return;
    if (trkIsCipCaseKey(navArg)) {
      setWorkspace("termsheet");
      setCipCaseId(String(navArg));
    } else {
      setDetailId(navArg);
    }
    if (onConsumeInitial) onConsumeInitial();
  }, [navArg]);
  // Ensure process model is loaded before/while matrix renders (BUG-1: empty TRK_METHODS → .name crash).
  React.useEffect(() => {
    let cancelled = false;
    const bump = () => { if (!cancelled) setMasterTick((n) => n + 1); };
    window.addEventListener("ag:tracker-master-loaded", bump);
    if (typeof loadTrackerProcessModel === "function") {
      loadTrackerProcessModel(true).then(bump).catch(bump);
    }
    return () => {
      cancelled = true;
      window.removeEventListener("ag:tracker-master-loaded", bump);
    };
  }, []);
  const onSyncEproposal = async () => {
    const syncRoles = (session && session.effectiveRoles) || [];
    const sectionHeadSync = trkIsSectionHeadTracker(session)
      && !syncRoles.includes("Super Admin")
      && !syncRoles.includes("Administrator Proposal Tracker");
    const ownedBefore = sectionHeadSync ? trkSectionHeadSyncSnapshot(session) : null;
    setSyncing(true);
    try {
      const r = await trkSyncEproposal();
      if (!r.ok) {
        toast.push({ title: tt("Sync failed", "Sync gagal"), description: tt("Could not reach E-Proposal.", "Tidak dapat menghubungi E-Proposal."), tone: "error" });
      } else if (r.result && r.result.enabled === false) {
        toast.push({ title: tt("Sync unavailable", "Sync tidak tersedia"), description: tt("E-Proposal connection is not configured.", "Koneksi E-Proposal belum dikonfigurasi."), tone: "warning" });
      } else if (sectionHeadSync) {
        const delta = trkSectionHeadSyncDelta(ownedBefore, trkSectionHeadSyncSnapshot(session));
        if (delta.total === 0) {
          toast.push({ title: tt("No proposal changes", "Tidak ada perubahan proposal"), description: tt("Your proposal list is already up to date.", "Daftar proposal milik Anda sudah terbaru.") });
        } else {
          toast.push({
            title: tt("Your proposal list was updated", "Daftar proposal Anda diperbarui"),
            description: tt(
              `${delta.added} new, ${delta.updated} updated, ${delta.removed} no longer in your list.`,
              `${delta.added} baru, ${delta.updated} diperbarui, ${delta.removed} tidak lagi berada di daftar Anda.`
            ),
          });
        }
      } else {
        const fetched = (r.result && r.result.fetched) || 0;
        const inserted = (r.result && r.result.inserted) || 0;
        const updated = (r.result && r.result.updated) || 0;
        toast.push({ title: tt("Sync complete", "Sync selesai"), description: tt(`${fetched} fetched, ${inserted} new, ${updated} updated, ${r.added} shown.`, `${fetched} diambil, ${inserted} baru, ${updated} di-update, ${r.added} ditampilkan.`) });
      }
    } finally {
      setSyncing(false);
    }
  };
  const onRefreshList = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await trkReloadStoreFromServer();
    } finally {
      setRefreshing(false);
    }
  };
  React.useEffect(() => setPage(1), [q, statusF, methodF, siteF, stepF]);
  const isOfficerTracker = ((session && session.effectiveRoles) || []).includes("Officer Proposal Tracker");
  const statusFilterKeys = ["all", "ReadyToDistribute", "OnProgress", "Completed", "Canceled"].filter((key) => !(isOfficerTracker && key === "ReadyToDistribute"));
  React.useEffect(() => {
    if (!statusFilterKeys.includes(statusF)) setStatusF("all");
  }, [statusFilterKeys.join(","), statusF]);

  const proposals = (store.proposals || []).map(trkNormalizeProposalLifecycle);
  const visibleProposals = proposals.filter((p) => trkIsActorProposal(p, session));
  const detail = detailId ? visibleProposals.find((p) => p.id === detailId) : null;
  const quickProposal = quickStep ? visibleProposals.find((p) => p.id === quickStep.proposalId) : null;
  React.useEffect(() => {
    if (detailId && !detail) setDetailId(null);
  }, [detailId, detail]);

  const filtered = visibleProposals
    .filter((p) => statusF === "all" || trkLifecycleStatusForProposal(p) === statusF)
    .filter((p) => methodF === "all" || p.trackerMethod === methodF)
    .filter((p) => siteF === "all" || p.jobsite === siteF)
    .filter((p) => stepF === "all" || trkProposalHasOpenStep(p, stepF))
    .filter((p) => {
      const needle = q.trim().toLowerCase();
      return !needle || [p.proposalNumber, p.aribaId, p.title, p.ownerName, p.assignedOfficerName, p.commodity, p.jobsite].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
    });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = statusFilterKeys.reduce((acc, key) => ({ ...acc, [key]: key === "all" ? visibleProposals.length : visibleProposals.filter((p) => trkLifecycleStatusForProposal(p) === key).length }), {});

  const countBubble = (n, toneColor) => (
    <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, backgroundColor: toneColor, color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: C.scheme === "dark" ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 2px rgba(1,59,82,0.10)" }}>{n}</span>
  );
  const chipTone = (key) => ({
    all: { color: C.ocean, bg: C.brandBg },
    ReadyToDistribute: { color: C.warningText, bg: C.warningBg },
    OnProgress: { color: C.info, bg: C.infoBg },
    Completed: { color: C.success, bg: C.successBg },
    Canceled: { color: C.danger, bg: C.dangerBg },
  }[key] || { color: C.ocean, bg: C.brandBg });
  const chip = (key, label) => {
    const act = statusF === key;
    const tone = chipTone(key);
    return <button key={key} onClick={() => setStatusF(key)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 400, border: `1px solid ${act ? tone.color : C.border}`, backgroundColor: act ? tone.bg : C.surface, color: act ? tone.color : C.textMuted }}>
      {act && <Icon name="check" size={13} />}
      {label}{countBubble(counts[key] || 0, tone.color)}
    </button>;
  };
  const handleStepFilter = (value) => {
    setStepF(value);
    if (value === "all") setStatusF("OnProgress");
  };

  const termSheetView = renderTermSheetView && renderTermSheetView({
    embedded: true,
    hideList: false,
    listHidden: workspace !== "termsheet",
    hideChrome: true,
    initialCase: cipCaseId,
    onNavigate,
    onCaseClose: () => setCipCaseId(null),
  });

  return (
    <div>
      <PageHeader
        title={tt("Proposal Tracker", "Daftar Proposal Tracker")}
        description={workspace === "termsheet"
          ? tt("Term Sheet and Contract cases for awarded proposals. Work stays on this Proposal list — no separate menu.", "Kasus Term Sheet dan Contract untuk proposal yang sudah di-award. Semua dikerjakan dari daftar Proposal — tanpa menu terpisah.")
          : tt("Tracker list with lifecycle, SLA, and award through Term Sheet, then LOA in parallel with Contract.", "Daftar tracker dengan lifecycle, SLA, dan award ke Term Sheet, lalu LOA paralel dengan Contract.")}
        meta={<TrkProposalWorkspaceSwitch value={workspace} onChange={setWorkspace} />}
        actions={<>
          {workspace === "proposals" && trkCanSyncEproposal(session) && <Button variant="secondary" iconLeft="refresh-cw" disabled={syncing} onClick={onSyncEproposal}>{syncing ? tt("Syncing...", "Sinkronisasi...") : tt("Sync E-Proposal", "Sync E-Proposal")}</Button>}
          {workspace === "proposals" && trkIsSectionHeadTracker(session) && (
            <Button variant="secondary" iconLeft="sparkles" onClick={() => setSampleOpen(true)}>
              {tt("Generate Sample Data", "Generate Sample Data")}
            </Button>
          )}
          {workspace === "termsheet" && <Button variant="secondary" iconLeft="archive" onClick={() => onNavigate("cipRepository")}>{tt("Document Repository", "Repositori Dokumen")}</Button>}
          <Button iconLeft="layout-dashboard" onClick={() => onNavigate("trackerDashboard")}>{tt("Dashboard", "Dashboard")}</Button>
        </>}
      />

      <div style={{ display: workspace === "proposals" ? undefined : "none", width: "100%", minWidth: 0, maxWidth: "100%" }}>
        <Card pad={0} style={{ width: "100%", minWidth: 0, maxWidth: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }} className="ag-trk-filter">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {statusFilterKeys.map((key) => chip(key, key === "all" ? tt("All", "Semua") : trkText(lang, TRK_STATUS_META[key])))}
                  </div>
                  <div style={{ width: 210 }}><Select value={stepF} onChange={(e) => handleStepFilter(e.target.value)} options={[{ value: "all", label: tt("All Current Step", "All Current Step") }].concat(TRK_STAGE_MASTER.map((s) => ({ value: s.name, label: s.name })))} /></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div ref={ps.ref} style={{ width: 260 }}><TextInput iconLeft="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt("Search proposal, owner, site, commodity...", "Cari proposal, owner, site, komoditas...")} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
                  <div style={{ width: 220 }}><Select value={methodF} onChange={(e) => setMethodF(e.target.value)} options={[{ value: "all", label: tt("All methods", "Semua metode") }].concat(TRK_METHODS.map((m) => ({ value: m.id, label: m.name })))} /></div>
                  <div style={{ width: 180 }}><Select value={siteF} onChange={(e) => setSiteF(e.target.value)} options={[{ value: "all", label: tt("All sites", "Semua site") }].concat(TRK_JOBSITES.map((s) => ({ value: s, label: s })))} /></div>
                </div>
              </div>
              <TableRefreshButton onClick={onRefreshList} disabled={refreshing} title={tt("Refresh proposals", "Muat ulang proposal")} />
            </div>
          </div>
          <TrkProposalMatrixTable
            rows={rows}
            session={session}
            onOpenDetail={(p) => {
              setQuickStep(null);
              setDetailId(p.id);
            }}
            onDistribute={setDist}
            onOpenStep={(p, activity) => {
              setQuickStep({ proposalId: p.id, activityId: activity.id });
            }}
          />
          <div style={{ padding: "0 14px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} /></div>
        </Card>
      </div>

      <TrkQuickStepModal proposal={quickProposal} store={store} activityId={quickStep && quickStep.activityId} onClose={() => setQuickStep(null)} onNavigate={onNavigate} onOpenCipCase={openCipCase} renderCipActivityEmbed={renderCipActivityEmbed} />
      <DistributionModal proposal={dist} onClose={() => setDist(null)} />
      <TrkGenerateSampleDataModal open={sampleOpen} onClose={() => setSampleOpen(false)} />
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        width={detailModalLayout.width}
        hideHeader
        overlayStyle={detailModalLayout.overlayStyle}
        bodyStyle={detailModalLayout.bodyStyle}
        style={detailModalLayout.style}
      >
        {detail && <TrackerProposalDetail proposal={detail} store={store} onBack={() => setDetailId(null)} asModal onNavigate={onNavigate} onOpenCipCase={openCipCase} renderCipActivityEmbed={renderCipActivityEmbed} />}
      </Modal>
      {termSheetView}
    </div>
  );
}

Object.assign(window, {
  TrkStatusBadge, TrkActivityBadge, TrackerProposals, TrackerProposalDetail,
  TrkMatrixDateCell, TrkReqEstDateCell, TrkPlanActualDateCell,
  trkActivityStatusTone, trkActivityNoteRoleForSession, trkActivityNoteRoleTone, trkActivityNoteIsOfficer,
  trkActivityNoteBubbleTone, trkLoadActivityNotes, trkSaveActivityNotes, trkActivityStageCode,
  trkDetailDate, trkHistoryEventLabel, trkHistoryTone, trkStepHistoryColor, trkCompactTableDate,
  trkScheduleTone, trkPendingTone, trkProposalEstimatedDate,
  trkLoadStepVendorDocs, trkLoadBidEvalState, trkResolveDocumentUrl, trkBuildProposalDocument,
  trkIsBidEvaluationActivity, trkIsNegotiationActivity, trkBidEvalForActivity,
});
export {
  TrkStatusBadge, TrkActivityBadge, TrackerProposals, TrackerProposalDetail,
  TrkMatrixDateCell, TrkReqEstDateCell, TrkPlanActualDateCell,
  trkActivityStatusTone, trkActivityNoteRoleForSession, trkActivityNoteRoleTone, trkActivityNoteIsOfficer,
  trkActivityNoteBubbleTone, trkLoadActivityNotes, trkSaveActivityNotes, trkActivityStageCode,
  trkDetailDate, trkHistoryEventLabel, trkHistoryTone, trkStepHistoryColor, trkCompactTableDate,
  trkScheduleTone, trkPendingTone, trkProposalEstimatedDate,
  trkLoadStepVendorDocs, trkLoadBidEvalState, trkResolveDocumentUrl, trkBuildProposalDocument,
  trkIsBidEvaluationActivity, trkIsNegotiationActivity, trkBidEvalForActivity,
};
