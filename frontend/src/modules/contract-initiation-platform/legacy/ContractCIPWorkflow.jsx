/* fm3-converted */
import React from "react";
import { CIP_AS_OF, CIP_DRAFT_TEMPLATE_FIELDS, CIP_PHASE, CIP_PHASES, CIP_STAGE, CIP_STAGES, CIP_STATUS, CIP_TEMPLATE, CIP_TEMPLATES, CIP_TERMSHEET_TEMPLATE_FIELDS, CIP_TERMSHEET_TEMPLATE_META, CIP_TPL_CAT, CIP_TPL_CATS, CIP_USD_RATE, cipBuildDraftPayload, cipBuildTermsheetPayload, cipContractSigningForCase, cipDraftMissingFields, cipGenerateDraftDocument, cipGenerateTermsheetDocument, cipLoaFor, cipMatchPct, cipPatchCase, cipPersistActivityCompletion, cipPersistTransition, cipPhaseForStage, cipPhaseIdx, cipReadStore, cipRecommend, cipRecommendCorpus, cipRecycleContractSubStage, cipResolveDocumentUrl, cipSetStage, cipStageIdx, cipTemplateDoc, cipTemplateMergePlan, cipTemplateReadiness, cipTermsheetMissingFields, cipTrackerPlanActualFromProposal, cipUploadFinalContract, cipRefreshDomainCases, useCipStore } from "./ContractCIPData.jsx";
import { CIP_HERO_GRAD, CIP_HERO_PATTERN, CIPDocumentPreviewModal, CipContractSignerRoute, CipHero, CipPage, CipSourceChip, cipStatusBadge } from "./ContractCIPScreens.jsx";
import { TRK_TODAY, trkAwardSplitsForWinners, trkCompleteActivityLocal, trkDatePart, trkFmtDate, trkIsActorProposal, trkIsCipCaseKey, trkLifecycleStatusForProposal, trkNow, trkReadStore, trkRp, trkStageIdByCode, trkText, trkUnlockParallelAfterTerm } from "../../proposal-tracker/legacy/TrackerData.jsx";
import { TrkActivityBadge, TrkMatrixDateCell, TrkPlanActualDateCell, TrkReqEstDateCell, trkActivityNoteBubbleTone, trkActivityNoteIsOfficer, trkActivityNoteRoleForSession, trkActivityNoteRoleTone, trkActivityStageCode, trkActivityStatusTone, trkBidEvalForActivity, trkBuildProposalDocument, trkCompactTableDate, trkDetailDate, trkHistoryEventLabel, trkHistoryTone, trkIsBidEvaluationActivity, trkIsNegotiationActivity, trkLoadActivityNotes, trkLoadBidEvalState, trkLoadStepVendorDocs, trkPendingTone, trkProposalEstimatedDate, trkResolveDocumentUrl, trkSaveActivityNotes, trkScheduleTone, trkStepHistoryColor } from "../../proposal-tracker/legacy/TrackerProposals.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { Avatar, Badge, Button, Card, DetailCard, Field, Icon, IconButton, TextInput, Textarea } from "../../../shared/legacy/Primitives.jsx";
import { Alert, EmptyState, Modal, Pagination, Spinner, Tooltip, useBodyHOverflow, useConstrainedFrameWidth, useLockstepHScroll, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { FONT, RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
/* CIP reads Tracker helpers by ES import (not window.trk*). Persistence stays on CIP APIs;
   Suite also syncs the in-process Tracker store. Across portals use the API + a hyperlink. */
/* Alamtri Geo Admin — CIP ▸ Termsheet → Contract workflow.
   Case list + case detail with a Tracker-like two-phase visual rail. The first
   phase turns a Proposal Tracker award result into a Term Sheet; the second phase turns the
   Termsheet into an executed contract. Internal substeps remain persisted. */

/* ---------- shared paper-document styling (contracts look like paper, even in dark mode) ---------- */
const CIP_DETAIL_SIDE_GAP = 16;
const CIP_PAPER = {
  backgroundColor: "#FFFFFF",
  color: "#22333B",
  fontFamily: "Georgia, 'Times New Roman', serif",
  borderRadius: 10,
  boxShadow: "0 1px 3px rgba(1,59,82,0.14), 0 12px 28px rgba(1,59,82,0.12)",
  border: "1px solid rgba(1,59,82,0.14)",
};
function CipMerged({ children, title }) {
  return <span title={title || "Auto-filled from Award Result / Term Sheet"} style={{ backgroundColor: "rgba(15,130,138,0.16)", borderBottom: "1.5px solid rgba(15,130,138,0.55)", borderRadius: 2, padding: "0 3px", fontWeight: 600 }}>{children}</span>;
}

function cipTermsheetFor(c) { return cipBuildTermsheetPayload(c, c.termsheetPayload).sections; }

function cipEmptyTrackerDates() {
  return { termsheet: { plan: "", actual: "", status: "", title: "" }, contract: { plan: "", actual: "", status: "", title: "" } };
}
function cipMergeTrackerDates(stored, live) {
  const source = (key) => {
    const s = (stored && stored[key]) || {};
    const l = (live && live[key]) || {};
    return {
      plan: l.plan || s.plan || "",
      actual: l.actual || s.actual || "",
      status: l.status || s.status || "",
      title: l.title || s.title || "",
    };
  };
  return { termsheet: source("termsheet"), contract: source("contract") };
}
function cipTrackerDatesForCase(c) {
  const stored = c && c.trackerDates;
  try {
    const store = typeof trkReadStore === "function" ? trkReadStore() : null;
    const proposal = store && (store.proposals || []).find((p) => p.id === c.proposalId || (c.proposalNumber && p.proposalNumber === c.proposalNumber));
    return cipMergeTrackerDates(stored, cipTrackerPlanActualFromProposal(proposal));
  } catch (e) {
    return cipMergeTrackerDates(stored, cipEmptyTrackerDates());
  }
}

function cipTrackerProposalForCase(c) {
  try {
    const store = typeof trkReadStore === "function" ? trkReadStore() : null;
    return store && (store.proposals || []).find((p) => p.id === c.proposalId || (c.proposalNumber && p.proposalNumber === c.proposalNumber));
  } catch (e) {
    return null;
  }
}

function cipTrackerActivityCodeForStage(stageKey) {
  if (!stageKey) return "";
  if (stageKey === "termsheet") return "TERM";
  if (stageKey === "contract" || cipPhaseForStage(stageKey) === "contract") return "CTR";
  return "";
}

function cipTrackerActivityForCase(c, stageKey) {
  const proposal = cipTrackerProposalForCase(c);
  const code = cipTrackerActivityCodeForStage(stageKey);
  if (!proposal || !code) return null;
  const stageId = typeof trkStageIdByCode === "function" ? trkStageIdByCode(code) : code;
  const activity = (proposal.activities || []).find((a) => a.stageId === stageId || (code === "TERM" && (a.title === "Term Sheet" || a.title === "Termsheet")) || (code === "CTR" && a.title === "Contract"));
  return activity ? { proposal, activity, code } : null;
}

function cipSyncTrackerActivityNote(c, stageKey, note) {
  if (!c || !note || typeof trkLoadActivityNotes !== "function" || typeof trkSaveActivityNotes !== "function") return false;
  const target = cipTrackerActivityForCase(c, stageKey);
  if (!target) return false;
  const notes = trkLoadActivityNotes(target.proposal) || {};
  const trackerNote = {
    id: note.id || `cip-note-${stageKey}-${Date.now()}`,
    activityId: target.activity.id,
    authorName: note.authorName || c.procurement || c.requestor || "Officer Proposal Tracker",
    authorRole: note.authorRole || "Officer",
    message: note.message || "",
    createdAt: note.createdAt || trkNow(),
  };
  const existing = notes[target.activity.id] || [];
  if (existing.some((row) => row && row.id === trackerNote.id)) return true;
  const next = { ...notes, [target.activity.id]: existing.concat([trackerNote]) };
  trkSaveActivityNotes(target.proposal.id, next);
  return true;
}

function cipAppendActivityNote(c, stageKey, note, currentNotes) {
  const key = stageKey || (note && note.activityId) || "termsheet";
  const notes = currentNotes || (c && c.activityNotes) || {};
  const nextNotes = { ...(notes || {}), [key]: ((notes && notes[key]) || []).concat([note]) };
  if (c && c.id) cipPatchCase(c.id, { activityNotes: nextNotes });
  cipSyncTrackerActivityNote(c, key, note);
  return nextNotes;
}

async function cipAdvanceCase(c, nextKey, actorName, msgEn, extra, eventType, remarkText, completedAt) {
  const fromKey = c.stage;
  const at = completedAt || trkNow();
  const cleanRemark = String(remarkText || "").trim();
  if (fromKey === "termsheet") {
    await cipPersistActivityCompletion(c.id, "termsheet", at, actorName, cleanRemark || msgEn);
  } else {
    await cipPersistTransition(c.id, fromKey, nextKey, at, actorName, cleanRemark || msgEn);
  }
  const trackerDates = cipTrackerDatesWithLocalCompletion(c, fromKey, at, cipSyncTrackerActivity(c, fromKey, actorName, nextKey, cleanRemark, at));
  const historyBase = Array.isArray(c.activityHistory) ? c.activityHistory : cipStageHistoryRows(c);
  const history = historyBase.concat([
    { id: `cip-${c.id}-${fromKey}-done-${Date.now()}`, type: eventType || "Completed", stageKey: fromKey, at, actorName, message: cleanRemark ? `${msgEn} Remark: ${cleanRemark}` : msgEn },
    { id: `cip-${c.id}-${nextKey}-start-${Date.now()}`, type: "Started", stageKey: nextKey, at, actorName, message: `Continue Term Sheet / Contract from ${trkText("en", CIP_STAGE[nextKey])}.` },
  ]);
  cipSetStage(c.id, nextKey, { ...(extra || {}), activityHistory: history, ...(trackerDates ? { trackerDates } : {}) });
  return { at, trackerDates, history };
}

function cipRequirementDateForCase(c) {
  if (c && c.requirementDate) return c.requirementDate;
  const proposal = cipTrackerProposalForCase(c);
  return (proposal && proposal.requirementDate) || "";
}

function cipEstimatedFinishDateForCase(c) {
  if (c && c.estimatedFinishDate) return c.estimatedFinishDate;
  const proposal = cipTrackerProposalForCase(c);
  if (proposal && typeof trkProposalEstimatedDate === "function") return trkProposalEstimatedDate(proposal);
  if (proposal && proposal.distribution) return proposal.distribution.estimatedDate || "";
  const dates = cipTrackerDatesForCase(c);
  return (dates && dates.contract && dates.contract.plan) || "";
}
const CIP_DETAIL_ACTIVITIES = [
  { key: "termsheet", en: "Term Sheet", id: "Term Sheet", icon: "file-text", trackerCode: "TERM", subStages: [], desc_en: "Build the Term Sheet from the Tracker award (Bid Evaluation winner, or Negotiation for Penunjukan Langsung). Completing Term Sheet opens LOA and Contract in parallel.", desc_id: "Susun Term Sheet dari hasil award Tracker (pemenang Bid Evaluation, atau Negotiation untuk Penunjukan Langsung). Setelah Term Sheet selesai, LOA dan Contract terbuka paralel." },
  { key: "contract", en: "Contract", id: "Contract", icon: "file-signature", trackerCode: "CTR", subStages: ["template", "draft", "final"], desc_en: "Officer Tracker: template, draft, final — runs in parallel with LOA after Term Sheet", desc_id: "Officer Tracker: template, draf, final — berjalan paralel dengan LOA setelah Term Sheet" },
];
const CIP_DETAIL_ACTIVITY = Object.fromEntries(CIP_DETAIL_ACTIVITIES.map((activity, index) => [activity.key, { ...activity, order: index }]));
const CIP_CONTRACT_NOTE_STAGE = { key: "contract", en: "Contract", id: "Contract" };
function cipContractActivityNotes(activityNotes) {
  const rows = [];
  ["contract", "template", "draft", "final"].forEach((key) => {
    ((activityNotes && activityNotes[key]) || []).forEach((note) => rows.push(note));
  });
  return rows;
}

function cipProjectedCasesForCompletion(c, nextStageKey) {
  try {
    const store = typeof cipReadStore === "function" ? cipReadStore() : null;
    const cases = (store && store.cases) || [];
    return cases.map((row) => row.id === c.id ? { ...row, stage: nextStageKey || row.stage } : row);
  } catch (e) {
    return [{ ...(c || {}), stage: nextStageKey || (c && c.stage) }];
  }
}
function cipCanSyncTrackerActivity(c, cipStageKey, nextStageKey) {
  if (!c || (!c.proposalId && !c.proposalNumber)) return true;
  const cases = cipProjectedCasesForCompletion(c, nextStageKey).filter((row) => row.proposalId === c.proposalId || (c.proposalNumber && row.proposalNumber === c.proposalNumber));
  if (!cases.length) return true;
  if (cipStageKey === "termsheet") return cases.every((row) => cipPhaseForStage(row.stage) === "contract" || row.stage === "final");
  if (cipStageKey === "final" || cipStageKey === "contract") return cases.every((row) => row.stage === "final" && (row.contractActivityCompletedAt || (row.id === c.id && row.finalContractDataUri)));
  if (cipStageKey === "review") return cases.every((row) => row.stage === "final");
  return true;
}
function cipSyncTrackerActivity(c, cipStageKey, actorName, nextStageKey, remarkText, completedAt) {
  const map = { termsheet: "TERM", final: "CTR", contract: "CTR", review: "CTR" };
  const code = map[cipStageKey];
  if (!code || !c || (!c.proposalId && !c.proposalNumber) || typeof trkReadStore !== "function") return null;
  const store = trkReadStore();
  const proposal = store && (store.proposals || []).find((p) => p.id === c.proposalId || (c.proposalNumber && p.proposalNumber === c.proposalNumber));
  if (!proposal) return null;
  const actor = actorName || proposal.assignedOfficerName || proposal.ownerName;
  if (cipStageKey === "termsheet" && typeof trkUnlockParallelAfterTerm === "function") {
    trkUnlockParallelAfterTerm(proposal.id, actor, completedAt);
  }
  if (!cipCanSyncTrackerActivity(c, cipStageKey, nextStageKey)) {
    const latest = trkReadStore();
    const nextProposal = latest && (latest.proposals || []).find((p) => p.id === proposal.id);
    return cipTrackerPlanActualFromProposal(nextProposal || proposal);
  }
  if (typeof trkCompleteActivityLocal !== "function") return cipTrackerPlanActualFromProposal(proposal);
  const latestStore = trkReadStore();
  const liveProposal = latestStore && (latestStore.proposals || []).find((p) => p.id === proposal.id);
  const stageId = typeof trkStageIdByCode === "function" ? trkStageIdByCode(code) : code;
  const activity = ((liveProposal || proposal).activities || []).find((a) => a.stageId === stageId || (code === "TERM" && (a.title === "Term Sheet" || a.title === "Termsheet")) || (code === "CTR" && a.title === "Contract"));
  if (!activity || activity.status !== "Pending") return cipTrackerPlanActualFromProposal(liveProposal || proposal);
  const cleanRemark = String(remarkText || "").trim();
  const nextStore = trkCompleteActivityLocal(proposal.id, activity.id, {
    actorName: actor,
    remark: cleanRemark ? `Completed from CIP ${trkText("en", CIP_STAGE[cipStageKey])}. ${cleanRemark}` : `Completed from CIP ${trkText("en", CIP_STAGE[cipStageKey])}.`,
    evidenceNames: [`cip::${c.id}::${cipStageKey}`],
    ...(completedAt ? { at: completedAt, completedAt } : {}),
  });
  const nextProposal = nextStore && (nextStore.proposals || []).find((p) => p.id === proposal.id);
  return cipTrackerPlanActualFromProposal(nextProposal || liveProposal || proposal);
}
function cipTrackerDatesWithLocalCompletion(c, cipStageKey, completedAt, syncedDates) {
  const key = cipStageKey === "termsheet" ? "termsheet" : (cipStageKey === "final" || cipStageKey === "review" || cipStageKey === "contract" ? "contract" : null);
  const base = cipMergeTrackerDates(c && c.trackerDates, syncedDates || cipTrackerDatesForCase(c));
  if (!key) return base;
  const row = base[key] || {};
  const stepClosed = row.status === "Completed";
  return {
    ...base,
    [key]: {
      ...row,
      actual: stepClosed ? (row.actual || completedAt || (typeof trkNow === "function" ? trkNow() : "")) : (row.actual || ""),
      status: stepClosed ? "Completed" : (row.status || "Pending"),
    },
  };
}

function cipDetailActivityStatusForCase(c, activityKey) {
  const phase = cipPhaseForStage(c.stage);
  if (activityKey === "termsheet") return phase === "contract" || c.stage === "final" ? "Completed" : "Pending";
  if (activityKey === "contract") {
    if (phase === "termsheet") return "Locked";
    return c.contractActivityCompletedAt ? "Completed" : "Pending";
  }
  return "Locked";
}
async function cipCompleteContractActivity(c, actorName, remarkText, completedAt) {
  const at = completedAt || trkNow();
  const cleanRemark = String(remarkText || "").trim();
  const msgEn = "Contract activity completed — executed contract ready";
  const historyBase = Array.isArray(c.activityHistory) ? c.activityHistory : cipStageHistoryRows(c);
  const history = historyBase.concat([
    { id: `cip-${c.id}-contract-activity-${Date.now()}`, type: "Completed", stageKey: "final", at, actorName, message: cleanRemark ? `${msgEn} Remark: ${cleanRemark}` : msgEn },
  ]);
  await cipPersistActivityCompletion(c.id, "contract", at, actorName, cleanRemark || msgEn);
  cipPatchCase(c.id, { stage: "final", status: "approved", contractActivityCompletedAt: at, activityHistory: history });
  const syncedDates = cipSyncTrackerActivity(c, "final", actorName, "final", cleanRemark, at);
  const trackerDates = cipTrackerDatesWithLocalCompletion(c, "final", at, syncedDates);
  cipPatchCase(c.id, { trackerDates });
}
function cipTrackerNoteRows(c) {
  const proposal = cipTrackerProposalForCase(c);
  if (!proposal || typeof trkLoadActivityNotes !== "function") return [];
  const activities = proposal.activities || [];
  const notesByActivity = trkLoadActivityNotes(proposal) || {};
  const stageTitle = (activityId) => {
    const activity = activities.find((row) => row.id === activityId);
    return activity ? activity.title : "Proposal Tracker";
  };
  const stageIndex = (activityId) => {
    const activity = activities.find((row) => row.id === activityId);
    const code = activity && typeof trkActivityStageCode === "function" ? trkActivityStageCode(activity) : "";
    return code === "CTR" ? 1 : 0;
  };
  return Object.entries(notesByActivity).flatMap(([activityId, notes]) => (notes || [])
    .filter((note) => note && String(note.id || "").indexOf("cip-note-") !== 0)
    .map((note, index) => ({
    id: `tracker-${activityId}-${note.id || index}`,
    source: "tracker",
    stageKey: stageIndex(activityId) === 1 ? "contract" : "termsheet",
    stageTitle: `Proposal Tracker - ${stageTitle(activityId)}`,
    stepIndex: stageIndex(activityId),
    ...note,
  })));
}

function cipMatrixCellFromTrackerRow(row, kind) {
  if (kind === "plan") return { value: row && row.plan ? trkCompactTableDate(row.plan) : "", applicable: true, tone: row && row.plan ? "plan" : "empty" };
  if (row && row.actual) return { value: trkCompactTableDate(row.actual), applicable: true, tone: trkScheduleTone(row.actual, row.plan) };
  if (row && row.status === "Pending") return { value: "Open", applicable: true, tone: trkPendingTone(row.plan) };
  return { value: "-", applicable: true, tone: "empty" };
}

function CipMatrixDateCell({ cell, variant = "actual", onClick, title }) {
  const C = useC();
  if (typeof TrkMatrixDateCell === "function") return <TrkMatrixDateCell cell={cell} activeHover={false} variant={variant} onClick={onClick} title={title} />;
  const isDateBadge = variant === "plan" || variant === "actual" || variant === "estimated";
  const clickable = typeof onClick === "function" && cell && cell.applicable && cell.value && cell.value !== "-";
  const toneStyle = {
    plan: { color: C.textMuted, backgroundColor: C.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(1,59,82,0.045)", borderColor: C.borderSoft },
    success: { color: "#fff", backgroundColor: "#11713B", borderColor: "#11713B", boxShadow: "0 5px 12px rgba(17,113,59,0.24)", fontWeight: 600 },
    danger: { color: "#fff", backgroundColor: "#C5341A", borderColor: "#C5341A", boxShadow: "0 5px 12px rgba(197,52,26,0.26)", fontWeight: 600 },
    neutral: { color: "#fff", backgroundColor: "#64748b", borderColor: "#64748b", boxShadow: "0 5px 12px rgba(100,116,139,0.22)", fontWeight: 600 },
    empty: { color: C.textSubtle, backgroundColor: "transparent", borderColor: "transparent" },
  }[cell.tone] || {};
  const commonStyle = { ...FONT, display: "inline-flex", minWidth: isDateBadge ? 68 : 42, maxWidth: "100%", justifyContent: "center", alignItems: "center", minHeight: isDateBadge ? 24 : 19, padding: isDateBadge ? "3px 5px" : "1px 5px", borderRadius: isDateBadge ? RADIUS.sm : RADIUS.pill, border: `1px solid ${toneStyle.borderColor || "transparent"}`, fontSize: isDateBadge ? 8.8 : 9.2, lineHeight: 1.12, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", transition: "transform 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease", ...toneStyle };
  if (clickable) {
    return (
      <button type="button" className={variant === "actual" && cell && cell.value === "Open" ? "ag-trk-open-pulse" : undefined} title={title} onClick={(event) => { event.stopPropagation(); onClick(event); }} style={{ ...commonStyle, cursor: "pointer", boxShadow: toneStyle.boxShadow || "none", outline: "none" }}>
        {cell.value || ""}
      </button>
    );
  }
  return <span className={variant === "actual" && cell && cell.value === "Open" ? "ag-trk-open-pulse" : undefined} style={commonStyle}>{cell.value || ""}</span>;
}

function CipReqEstDateCell({ reqDate, estimatedDate }) {
  const req = { value: reqDate ? trkCompactTableDate(reqDate) : "", applicable: true, tone: reqDate ? "plan" : "empty" };
  const est = { value: estimatedDate ? trkCompactTableDate(estimatedDate) : "", applicable: true, tone: estimatedDate && reqDate ? trkScheduleTone(estimatedDate, reqDate) : estimatedDate ? "neutral" : "empty" };
  if (typeof TrkReqEstDateCell === "function") {
    return <TrkReqEstDateCell proposal={{ requirementDate: reqDate, distribution: { estimatedDate }, activities: [{ title: "Contract", targetDate: estimatedDate }] }} estimatedCell={est} activeHover={false} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 58 }}>
      <CipMatrixDateCell cell={req} variant="plan" />
      <CipMatrixDateCell cell={est} variant="estimated" />
    </div>
  );
}

function CipPlanActualCell({ row, activeHover, onHover, onOpenActual }) {
  const tt = useTT();
  const plan = cipMatrixCellFromTrackerRow(row, "plan");
  const actual = cipMatrixCellFromTrackerRow(row, "actual");
  const inner = typeof TrkPlanActualDateCell === "function"
    ? <TrkPlanActualDateCell plan={plan} actual={actual} activeHover={activeHover} onOpenActual={onOpenActual} />
    : (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 58 }}>
        <CipMatrixDateCell cell={plan} variant="plan" />
        <CipMatrixDateCell cell={actual} variant="actual" onClick={onOpenActual} title={tt("Open this activity step", "Buka step aktivitas ini")} />
      </div>
    );
  return (
    <div onMouseEnter={onHover} style={{ minHeight: 58, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {inner}
    </div>
  );
}

function CipTrackerStageHeader({ label, active, onHover }) {
  const C = useC();
  return (
    <span onMouseEnter={onHover} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, lineHeight: 1.05, minWidth: 0, margin: "-6px -3px", padding: "6px 3px", backgroundColor: active ? C.brandBg : "transparent", boxShadow: active ? `inset 0 0 0 1px ${C.ocean}33` : "none", transition: "background-color 0.16s ease, box-shadow 0.16s ease" }}>
      <span style={{ display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", fontSize: 10.5, color: C.text, fontWeight: 600, letterSpacing: 0, textTransform: "none" }}>{label}</span>
      <span style={{ display: "block", width: "100%", textAlign: "center", fontSize: 9.5, color: C.textMuted, fontWeight: 600, letterSpacing: 0, textTransform: "none", whiteSpace: "nowrap" }}>Plan / Actual</span>
    </span>
  );
}

function CIPCaseMatrixTable({ rows, onOpenDetail, onOpenActivity }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const frameRef = React.useRef(null);
  const headerScrollRef = React.useRef(null);
  const bodyScrollRef = React.useRef(null);
  const fakeScrollRef = React.useRef(null);
  const frameKey = String(rows.length);
  const [hoveredDateColumn, setHoveredDateColumn] = React.useState(null);
  const [hoverRow, setHoverRow] = React.useState(null);
  const [caseSticky, setCaseSticky] = React.useState(() => {
    try {
      const stored = window.__procurementStorage.getItem("cip.workflow.sticky-case");
      return stored == null ? true : stored === "true";
    } catch (e) { return true; }
  });
  const caseWidth = 360;
  const vendorWidth = 248;
  const stepWidth = 94;
  const reqDateWidth = stepWidth;
  const estDateWidth = stepWidth;
  const templateWidth = 105;
  const statusWidth = 120;
  const actionWidth = 54;
  const minWidth = caseWidth + vendorWidth + (stepWidth * 2) + reqDateWidth + estDateWidth + templateWidth + statusWidth + actionWidth;
  const containerW = useConstrainedFrameWidth(frameRef, frameKey);
  const bodyOverflow = useBodyHOverflow(bodyScrollRef, `${frameKey}:${containerW}`);
  const tableWidth = containerW ? Math.max(minWidth, containerW) : minWidth;
  const overflowing = (containerW > 0 && minWidth > containerW + 1) || bodyOverflow.overflowing;
  const stickyCase = caseSticky ? { position: "sticky", left: 0, zIndex: 4, backgroundColor: C.surface, boxShadow: `inset -1px 0 0 ${C.borderSoft}, 14px 0 22px -22px rgba(15,23,42,0.42)` } : {};
  const stickyCaseHead = caseSticky ? { ...stickyCase, zIndex: 7, backgroundColor: C.surfaceAlt } : { backgroundColor: C.surfaceAlt };
  const tableStyle = { width: tableWidth, minWidth, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", fontSize: 12.5 };
  const dateHoverStyle = (key) => hoveredDateColumn === key ? { backgroundColor: C.brandBg, boxShadow: `inset 0 0 0 1px ${C.ocean}33`, transition: "background-color 0.16s ease, box-shadow 0.16s ease" } : { transition: "background-color 0.16s ease, box-shadow 0.16s ease" };
  const dateHoverBind = (key) => ({ onMouseEnter: () => setHoveredDateColumn(key) });
  const headBase = { padding: "11px 12px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted };
  const colGroup = () => (
    <colgroup>
      <col style={{ width: caseWidth }} />
      <col style={{ width: vendorWidth }} />
      <col style={{ width: stepWidth }} />
      <col style={{ width: stepWidth }} />
      <col style={{ width: reqDateWidth }} />
      <col style={{ width: estDateWidth }} />
      <col style={{ width: templateWidth }} />
      <col style={{ width: statusWidth }} />
      <col style={{ width: actionWidth }} />
    </colgroup>
  );

  useLockstepHScroll(bodyScrollRef, headerScrollRef, fakeScrollRef, `${frameKey}:${tableWidth}:${overflowing ? 1 : 0}`);
  React.useEffect(() => {
    try { window.__procurementStorage.setItem("cip.workflow.sticky-case", String(caseSticky)); } catch (e) {}
  }, [caseSticky]);

  if (!rows.length) {
    return (
      <div ref={frameRef} style={{ ...FONT, position: "relative", borderRadius: RADIUS.lg, width: "100%", minWidth: 0, maxWidth: "100%" }}>
        <EmptyState icon="search-x" title={tt("No cases found", "Tidak ada kasus")} description={tt("Adjust the filters, or open a Term Sheet case from a finalized award result.", "Sesuaikan filter, atau buka kasus Term Sheet dari hasil award yang sudah difinalisasi.")} />
      </div>
    );
  }

  return (
    <div ref={frameRef} onMouseLeave={() => setHoveredDateColumn(null)} style={{ ...FONT, position: "relative", borderRadius: RADIUS.lg, width: "100%", minWidth: 0, maxWidth: "100%" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 9, backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
        <div ref={headerScrollRef} className="ag-hide-scroll" style={{ overflowX: "auto", overflowY: "hidden" }}>
          <table style={tableStyle}>
            {colGroup()}
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...stickyCaseHead, padding: "9px 10px", borderBottom: `1px solid ${C.border}`, textAlign: "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted }}>
                  <label title={tt("Pin Case column to the left", "Tempel kolom Case di kiri")} onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={caseSticky} onChange={(e) => setCaseSticky(e.target.checked)} style={{ width: 13, height: 13, margin: 0, accentColor: C.ocean, cursor: "pointer" }} />
                    <span>{tt("Proposal / Case", "Proposal / Kasus")}</span>
                  </label>
                </th>
                <th rowSpan={2} style={{ ...headBase, textAlign: "left", borderRight: `1px solid ${C.borderSoft}` }}>Vendor / Value</th>
                <th {...dateHoverBind("termsheet")} style={{ padding: "8px 4px", borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 10.5, color: C.text, fontWeight: 600, whiteSpace: "nowrap", ...dateHoverStyle("termsheet") }}>Term Sheet</th>
                <th {...dateHoverBind("contract")} style={{ padding: "8px 4px", borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 10.5, color: C.text, fontWeight: 600, whiteSpace: "nowrap", ...dateHoverStyle("contract") }}>Contract</th>
                <th rowSpan={2} title={tt("Requirement Date", "Tanggal kebutuhan")} {...dateHoverBind("req-date")} style={{ padding: "8px 3px", borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 10, letterSpacing: "0.01em", color: C.textMuted, fontWeight: 600, ...dateHoverStyle("req-date") }}>Req Date</th>
                <th rowSpan={2} title={tt("Estimated Date", "Tanggal estimasi")} {...dateHoverBind("est-date")} style={{ padding: "8px 3px", borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 10, letterSpacing: "0.01em", color: C.textMuted, fontWeight: 600, ...dateHoverStyle("est-date") }}>Est Date</th>
                <th rowSpan={2} style={{ ...headBase, textAlign: "left", borderRight: `1px solid ${C.borderSoft}` }}>{tt("Template", "Template")}</th>
                <th rowSpan={2} style={{ ...headBase, textAlign: "left" }}>{tt("Status", "Status")}</th>
                <th rowSpan={2} style={{ ...headBase, textAlign: "right" }} />
              </tr>
              <tr>
                <th {...dateHoverBind("termsheet")} style={{ padding: "6px 3px", borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 9.5, color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap", ...dateHoverStyle("termsheet") }}>Plan / Actual</th>
                <th {...dateHoverBind("contract")} style={{ padding: "6px 3px", borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, textAlign: "center", fontSize: 9.5, color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap", ...dateHoverStyle("contract") }}>Plan / Actual</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
      <div ref={bodyScrollRef} className="ag-hide-scroll" style={{ overflowX: "auto", overflowY: "hidden", backgroundColor: C.surface }}>
        <table style={tableStyle}>
          {colGroup()}
          <tbody>
            {rows.map((c, rowIndex) => {
              const rowBg = hoverRow === c.id ? C.hover : (rowIndex % 2 ? C.surfaceInset : C.surface);
              const proposalNo = c.proposalNumber || c.proposalId || "-";
              return (
                <tr key={c.id} onMouseEnter={() => setHoverRow(c.id)} onMouseLeave={() => setHoverRow(null)} onClick={() => onOpenDetail(c)} style={{ cursor: "pointer" }}>
                  <td style={{ ...stickyCase, backgroundColor: rowBg, padding: "8px 10px", borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: "top" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "62px minmax(0, 1fr)", alignItems: "start", gap: 8, minWidth: 0 }}>
                        <span style={{ marginTop: 1, fontSize: 9.5, lineHeight: 1.35, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textSubtle }}>Proposal</span>
                        <span style={{ minWidth: 0, fontFamily: "monospace", fontSize: 11.3, lineHeight: 1.35, fontWeight: 800, color: C.ocean, overflowWrap: "anywhere", wordBreak: "break-word" }}>{proposalNo}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "62px minmax(0, 1fr)", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 9.5, lineHeight: 1.35, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textSubtle }}>{tt("Case", "Kasus")}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.3, fontWeight: 800, color: C.text }}>{c.id}</span>
                          {c.proposalId && <CipSourceChip kind="tracker" size="sm" />}
                          {c.lead && <Badge tone="brand" size="sm"><Icon name="star" size={10} />{tt("Sample", "Contoh")}</Badge>}
                        </div>
                      </div>
                      <div style={{ paddingTop: 5, borderTop: `1px solid ${C.borderSoft}`, fontSize: 12.3, lineHeight: 1.35, color: C.text, fontWeight: 600, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>{c.title}</div>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Avatar name={c.vendor.replace(/^PT\s+/, "")} size={28} />
                      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.vendor}</div>
                        <div style={{ fontSize: 11.5, color: C.ocean, fontWeight: 500, lineHeight: 1.2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{trkRp(c.value)}</div>
                      </div>
                    </div>
                  </td>
                  <td {...dateHoverBind("termsheet")} style={{ padding: "5px 3px", textAlign: "center", borderBottom: `1px solid ${C.borderSoft}`, borderLeft: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle", ...dateHoverStyle("termsheet") }}>
                    <CipPlanActualCell row={cipTrackerDatesForCase(c).termsheet} activeHover={hoveredDateColumn === "termsheet"} onHover={() => setHoveredDateColumn("termsheet")} onOpenActual={onOpenActivity ? () => onOpenActivity(c, "termsheet") : undefined} />
                  </td>
                  <td {...dateHoverBind("contract")} style={{ padding: "5px 3px", textAlign: "center", borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle", ...dateHoverStyle("contract") }}>
                    <CipPlanActualCell row={cipTrackerDatesForCase(c).contract} activeHover={hoveredDateColumn === "contract"} onHover={() => setHoveredDateColumn("contract")} onOpenActual={onOpenActivity ? () => onOpenActivity(c, "contract") : undefined} />
                  </td>
                  <td {...dateHoverBind("req-date")} style={{ padding: "5px 3px", textAlign: "center", borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle", ...dateHoverStyle("req-date") }}>
                    <CipMatrixDateCell cell={{ value: trkCompactTableDate(cipRequirementDateForCase(c)), applicable: true, tone: cipRequirementDateForCase(c) ? "plan" : "empty" }} variant="plan" />
                  </td>
                  <td {...dateHoverBind("est-date")} style={{ padding: "5px 3px", textAlign: "center", borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle", ...dateHoverStyle("est-date") }}>
                    <CipMatrixDateCell cell={{ value: trkCompactTableDate(cipEstimatedFinishDateForCase(c)), applicable: true, tone: cipEstimatedFinishDateForCase(c) ? trkScheduleTone(cipEstimatedFinishDateForCase(c), cipRequirementDateForCase(c)) : "empty" }} variant="estimated" />
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle" }}>{c.template ? <Badge tone="neutral">{c.template}</Badge> : <span style={{ color: C.textSubtle, fontSize: 12 }}>—</span>}</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, verticalAlign: "middle" }}>{cipStatusBadge(c.status, lang)}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ padding: "9px 10px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: rowBg, textAlign: "right", verticalAlign: "middle" }}>
                    <IconButton name="arrow-right" size="sm" title={tt("Open detail", "Buka detail")} onClick={() => onOpenDetail(c)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div ref={fakeScrollRef} aria-hidden="true" style={{ position: "sticky", bottom: 0, zIndex: 9, height: overflowing ? 14 : 0, overflowX: "scroll", overflowY: "hidden", borderTop: overflowing ? `1px solid ${C.border}` : "none", backgroundColor: C.surface, opacity: overflowing ? 1 : 0, pointerEvents: overflowing ? "auto" : "none", transition: "opacity 0.15s" }}>
        <div style={{ width: Math.max(tableWidth, bodyOverflow.scrollWidth || 0), height: 1 }} />
      </div>
    </div>
  );
}

/* =================== CASE LIST =================== */
function CIPWorkflow({ initialCase, onConsumeInitial, onNavigate, embedded, hideList, hideChrome, listHidden, onCaseClose }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const cip = useCipStore();
  const [detail, setDetail] = React.useState(initialCase || null);
  const [quickActivity, setQuickActivity] = React.useState(null);
  const [statusF, setStatusF] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const ps = usePageSearch(tt("Search case…", "Cari kasus…"));
  const q = ps.query, setQ = ps.setQuery;
  const closeDetail = () => {
    setDetail(null);
    if (onCaseClose) onCaseClose();
  };
  React.useEffect(() => { if (initialCase) { setDetail(initialCase); onConsumeInitial && onConsumeInitial(); } }, [initialCase]);
  React.useEffect(() => setPage(1), [q, statusF]);

  const cases = cip.cases;
  const counts = { all: cases.length };
  Object.keys(CIP_STATUS).forEach((k) => (counts[k] = cases.filter((c) => c.status === k).length));
  const filtered = cases.filter((c) => statusF === "all" || c.status === statusF)
    .filter((c) => { const qq = q.trim().toLowerCase(); return !qq || c.id.toLowerCase().includes(qq) || c.title.toLowerCase().includes(qq) || c.vendor.toLowerCase().includes(qq) || (c.loaNo || "").toLowerCase().includes(qq); });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const quickCase = quickActivity ? cases.find((c) => c.id === quickActivity.caseId) : null;
  const detailCase = detail ? cases.find((c) => c.id === detail) : null;

  const chip = (key, label, n) => {
    const act = statusF === key;
    return <button key={key} onClick={() => setStatusF(key)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: RADIUS.pill, fontSize: 12.5, fontWeight: 600, border: `1px solid ${act ? C.ocean : C.border}`, backgroundColor: act ? C.brandBg : C.surface, color: act ? C.ocean : C.textMuted }}>{label}<span style={{ fontSize: 11, fontWeight: 600, color: act ? C.ocean : C.textSubtle }}>{n}</span></button>;
  };

  const list = hideList ? null : (
    <div style={listHidden ? { display: "none" } : undefined}>
      {!embedded && !hideChrome && (
        <CipHero
          kicker={tt("Case workflow", "Workflow kasus")}
          title={tt("Term Sheet & Contract", "Term Sheet & Kontrak")}
          subtitle={tt("Every new case starts from an approved Proposal Tracker award result. Term Sheet is completed here before LOA and Contract continue in parallel.", "Setiap kasus baru berawal dari hasil award Proposal Tracker yang sudah disetujui. Term Sheet diselesaikan di sini sebelum LOA dan Contract berjalan paralel.")}
          compact
          right={<Button iconLeft="archive" onClick={() => onNavigate && onNavigate("cipRepository")} style={{ backgroundColor: "#fff", color: "#013B52", border: "none" }}>{tt("Open Document Repository", "Buka Repositori Dokumen")}</Button>}
        >
          <div className="cip-hero-kpis cip-stagger" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
            {[
              { key: "all", label: tt("All cases", "Semua kasus"), value: counts.all, icon: "files" },
              ...Object.keys(CIP_STATUS).map((k) => ({ key: k, label: trkText(lang, CIP_STATUS[k]), value: counts[k], icon: k === "approved" ? "award" : k === "inprogress" ? "loader" : "inbox" })),
            ].map((k) => (
              <div key={k.key} style={{ borderRadius: RADIUS.lg, padding: "11px 13px", backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}><Icon name={k.icon} size={12} color="#7FD4D9" />{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#fff" }}>{k.value}</div>
              </div>
            ))}
          </div>
        </CipHero>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {chip("all", tt("All", "Semua"), counts.all)}
        {Object.keys(CIP_STATUS).map((k) => chip(k, trkText(lang, CIP_STATUS[k]), counts[k]))}
      </div>

      <Card pad={0} style={{ width: "100%", minWidth: 0, maxWidth: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div ref={ps.ref} style={{ width: 300 }}><TextInput iconLeft="search" placeholder={tt("Search case, proposal, vendor…", "Cari kasus, proposal, vendor…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: C.textSubtle, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="route" size={12} />{tt("Work Term Sheet and Contract from this proposal list.", "Kerjakan Term Sheet dan Contract dari daftar proposal ini.")}</span>
        </div>
        <CIPCaseMatrixTable
          rows={rows}
          onOpenDetail={(c) => { setQuickActivity(null); setDetail(c.id); }}
          onOpenActivity={(c, activityKey) => setQuickActivity({ caseId: c.id, activityKey })}
        />
        <div style={{ padding: "0 14px 12px" }}><Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} /></div>
      </Card>
    </div>
  );
  const modals = (
    <>
      <CIPQuickActivityModal
        c={quickCase}
        activityKey={quickActivity && quickActivity.activityKey}
        onClose={() => setQuickActivity(null)}
      />
      <Modal
        open={!!detailCase}
        onClose={closeDetail}
        width="min(97vw, 1560px)"
        icon="file-search"
        title={detailCase ? `${detailCase.id} - ${detailCase.title}` : tt("Term Sheet detail", "Detail Term Sheet")}
        subtitle={detailCase ? `${detailCase.proposalNumber || detailCase.proposalId || "-"} - ${detailCase.vendor}` : ""}
        overlayStyle={{ padding: "8px 16px" }}
        style={{ maxWidth: "min(97vw, 1560px)", height: "calc(100vh - 16px)", display: "flex", flexDirection: "column" }}
        bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflowY: "auto", padding: "14px 16px 18px" }}
      >
        {detailCase && <CIPCaseDetail c={detailCase} embedded={!!embedded} onBack={closeDetail} onNavigate={onNavigate} />}
      </Modal>
    </>
  );
  if (hideList) return modals;
  if (embedded) return <div>{list}{modals}</div>;
  return <CipPage>{list}{modals}</CipPage>;
}

function cipCasesForProposal(cases, proposal) {
  const pid = String((proposal && proposal.id) || "").toLowerCase();
  const pnum = String((proposal && proposal.proposalNumber) || "").toLowerCase();
  return (cases || []).filter((c) => {
    const cid = String((c && c.proposalId) || "").toLowerCase();
    const cnum = String((c && c.proposalNumber) || "").toLowerCase();
    return (pid && cid === pid) || (pnum && (cnum === pnum || cid === pnum));
  });
}

function cipMatchCaseForVendor(cases, vendor) {
  const vid = String((vendor && vendor.vendorId) || "").toLowerCase();
  const vname = String((vendor && (vendor.vendorName || vendor.name)) || "").toLowerCase();
  return (cases || []).find((c) => vid && String(c.vendorId || "").toLowerCase() === vid)
    || (cases || []).find((c) => vname && String(c.vendor || "").toLowerCase() === vname)
    || null;
}

function cipHasOfficerTrackerRole(session) {
  const roles = ((session && session.effectiveRoles) || []).concat((session && session.effectiveRole) ? [session.effectiveRole] : []);
  return roles.includes("Officer Proposal Tracker");
}

function cipProposalForCase(c) {
  if (!c) return null;
  const proposals = ((typeof trkReadStore === "function" && trkReadStore()) || {}).proposals || [];
  const keys = [c.proposalId, c.proposalKey, c.proposalNumber]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  if (!keys.length) return null;
  return proposals.find((proposal) => keys.includes(String(proposal.id || "").trim().toLowerCase())
    || keys.includes(String(proposal.proposalNumber || "").trim().toLowerCase())) || null;
}

function cipCanGenerateTermSheet(session, proposal) {
  if (!session || !proposal) return false;
  if (typeof trkLifecycleStatusForProposal === "function" && trkLifecycleStatusForProposal(proposal) !== "OnProgress") return false;
  if (!cipHasOfficerTrackerRole(session)) return false;
  return typeof trkIsActorProposal === "function" ? trkIsActorProposal(proposal, session) : false;
}

function CipAssignedOfficerLockedAction({ label, tt }) {
  const C = useC();
  return (
    <Tooltip label={tt("Only the assigned Officer can generate Term Sheet", "Hanya Officer yang ditunjuk yang bisa generate Term Sheet")} side="top">
      <span style={{ ...FONT, height: 32, borderRadius: RADIUS.pill, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 7, border: `1px dashed ${C.border}`, backgroundColor: C.surface, color: C.textSubtle, fontSize: 11.6, fontWeight: 700, cursor: "not-allowed" }}>
        <Icon name="lock" size={13} />
        {label}
      </span>
    </Tooltip>
  );
}

function CIPEmbeddedActivityBody({ c, activityKey, onClose, layout = "full", proposal }) {
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const toast = useToast();
  const activity = CIP_DETAIL_ACTIVITY[activityKey];
  const [activityNotes, setActivityNotes] = React.useState(() => (c && c.activityNotes) || {});
  const [noteDrafts, setNoteDrafts] = React.useState({});
  const [recycleTarget, setRecycleTarget] = React.useState(null);
  React.useEffect(() => {
    setActivityNotes((c && c.activityNotes) || {});
    setNoteDrafts({});
  }, [c && c.id, activityKey]);
  if (!c || !activity) return null;
  const status = cipDetailActivityStatusForCase(c, activity.key);
  const actorName = (session && session.actingUser && session.actingUser.name) || c.procurement || c.requestor || "Officer Proposal Tracker";
  const actorRole = typeof trkActivityNoteRoleForSession === "function" ? trkActivityNoteRoleForSession(session) : "Officer";
  const canGenerate = cipCanGenerateTermSheet(session, proposal || cipProposalForCase(c));
  const canCompleteActivity = (targetKey) => {
    if (targetKey === "termsheet") return canGenerate && c.stage === "termsheet" && !!c.termsheetBlobKey;
    if (targetKey === "contract") return c.stage === "final" && !!c.finalContractBlobKey && !c.contractActivityCompletedAt;
    return false;
  };
  const advance = async (nextKey, msgEn, msgId, extra, eventType, remarkText, closeAfter, completedAt) => {
    try {
      await cipAdvanceCase(c, nextKey, actorName, msgEn, extra, eventType, remarkText, completedAt);
      toast.push({ title: tt(msgEn, msgId), description: c.id });
      if (closeAfter) onClose && onClose();
    } catch (error) {
      toast.push({ title: tt("Workflow update failed", "Update workflow gagal"), description: (error && error.message) || c.id, tone: "error" });
    }
  };
  const completeActivity = async (targetActivityKey, remarkText, completedAt) => {
    if (targetActivityKey === "termsheet") {
      advance("template", "Term Sheet activity completed — continue to Contract", "Aktivitas Term Sheet selesai — lanjut ke Contract", null, "Completed", remarkText, false, completedAt);
      return;
    }
    if (targetActivityKey === "contract") {
      try {
        await cipCompleteContractActivity(c, actorName, remarkText, completedAt);
        toast.push({ title: tt("Contract activity completed", "Aktivitas Contract selesai"), description: c.id });
      } catch (error) {
        toast.push({ title: tt("Contract completion failed", "Complete Contract gagal"), description: (error && error.message) || c.id, tone: "error" });
      }
    }
  };
  const handleNoteDraftChange = (stageKey, value) => setNoteDrafts((current) => ({ ...current, [stageKey]: value }));
  const handlePostNote = (stage) => {
    const message = String((noteDrafts && noteDrafts[stage.key]) || "").trim();
    if (!message) {
      toast.push({ title: tt("Note is empty", "Notes masih kosong"), description: trkText(lang, stage), tone: "warning" });
      return;
    }
    const note = { id: `cip-note-${stage.key}-${Date.now()}`, activityId: stage.key, authorName: actorName, authorRole: actorRole, message, createdAt: trkNow() };
    const nextNotes = cipAppendActivityNote(c, stage.key, note, activityNotes);
    setActivityNotes(nextNotes);
    setNoteDrafts((current) => ({ ...current, [stage.key]: "" }));
    toast.push({ title: tt("Step note posted", "Step note tersimpan"), description: trkText(lang, stage) });
  };
  const renderStagePanel = (stage, readOnly) => {
    const key = stage.key;
    const isCurrent = !readOnly && c.stage === key;
    if (key === "loa") return <CIPLoaPanel c={c} tt={tt} lang={lang} isCurrent={isCurrent} onAdvance={() => advance("termsheet", "Award result from Proposal Tracker is ready — generate Term Sheet", "Hasil award dari Proposal Tracker siap — lanjut generate Term Sheet")} />;
    if (key === "verify") return <CIPVerifyPanel c={c} tt={tt} lang={lang} isCurrent={isCurrent} onAdvance={() => advance("termsheet", "Data confirmed — ready to generate the Termsheet", "Data dikonfirmasi — siap generate Termsheet")} />;
    if (key === "termsheet") return <CIPTermsheetPanel c={c} tt={tt} lang={lang} toast={toast} isCurrent={isCurrent} onAdvance={() => advance("template", "Termsheet approved — choose a template", "Termsheet disetujui — pilih template")} />;
    if (key === "template") return <CIPTemplatePanel c={c} tt={tt} lang={lang} toast={toast} isCurrent={isCurrent} readOnly={readOnly} onAdvance={(code) => advance("draft", "Draft contract generated — review draft output", "Draf kontrak digenerate — review output draf", { template: code })} />;
    if (key === "draft") return <CIPDraftPanel c={c} tt={tt} lang={lang} toast={toast} isCurrent={isCurrent} onAdvance={() => advance("final", "Draft has been reviewed — upload Final Contract", "Draft has been Reviewed — upload Final Contract", { legalReviewedOutsideSystem: true })} />;
    return <CIPFinalPanel c={c} tt={tt} lang={lang} toast={toast} isCurrent={isCurrent} canComplete={canCompleteActivity("contract")} onComplete={(remark, completedAt) => completeActivity("contract", remark, completedAt)} />;
  };
  const canRecycleSub = cipCanRecycleContractSubStage(session);
  const handleRecycleSub = (stage, reason) => {
    cipRecycleContractSubStage(c.id, stage.key, reason, actorName);
    toast.push({ title: tt("Sub-activity recycled", "Sub-activity direcycle"), description: trkText(lang, stage), tone: "warning" });
    setRecycleTarget(null);
  };
  const winnerBody = activity.key === "termsheet" ? (
    <CIPTermSheetActivityPanel
      c={c}
      tt={tt}
      lang={lang}
      toast={toast}
      isCurrent={["loa", "termsheet"].includes(c.stage)}
      canGenerate={canGenerate}
      canComplete={canCompleteActivity(activity.key)}
      onComplete={(remark, completedAt) => completeActivity(activity.key, remark, completedAt)}
      activityNotes={activityNotes}
      noteDrafts={noteDrafts}
      actorName={actorName}
      onNoteDraftChange={handleNoteDraftChange}
      onPostNote={handlePostNote}
      layout={layout === "winner" ? "winner" : "full"}
    />
  ) : (
    <>
      <CIPSubActivityList
        c={c}
        activity={activity}
        renderStagePanel={renderStagePanel}
        canRecycle={canRecycleSub}
        onRecycle={(stage) => setRecycleTarget(stage)}
      />
      {layout !== "winner" && (
        <CIPStepNotesPanel
          stage={CIP_CONTRACT_NOTE_STAGE}
          notes={cipContractActivityNotes(activityNotes)}
          draft={(noteDrafts && noteDrafts.contract) || ""}
          actorName={actorName}
          onDraftChange={handleNoteDraftChange}
          onPostNote={handlePostNote}
          defaultExpanded={status === "Pending"}
        />
      )}
    </>
  );
  const recycleModal = (
    <CIPRecycleSubActivityModal
      open={!!recycleTarget}
      stage={recycleTarget}
      caseTitle={c.title}
      onClose={() => setRecycleTarget(null)}
      onSubmit={handleRecycleSub}
      tt={tt}
      lang={lang}
    />
  );
  if (layout === "winner") {
    if (status === "Locked") {
      return (
        <>
          <Alert
            tone="info"
            title={activity.key === "contract"
              ? tt("Contract waits for this winner’s Term Sheet", "Contract menunggu Term Sheet pemenang ini")
              : tt("Term Sheet is locked", "Term Sheet terkunci")}
            description={activity.key === "contract"
              ? tt("Complete Term Sheet for this winner first. LOA and Contract then open for this winner only; other winners stay locked until their Term Sheet is complete.", "Selesaikan Term Sheet pemenang ini dulu. LOA dan Contract kemudian terbuka untuk pemenang ini saja; pemenang lain tetap terkunci sampai Term Sheet mereka selesai.")
              : tt("This winner cannot work Term Sheet until the previous Tracker step is complete.", "Pemenang ini belum bisa mengerjakan Term Sheet sampai step Tracker sebelumnya selesai.")}
          />
          {recycleModal}
        </>
      );
    }
    return (
      <>
        {winnerBody}
        {recycleModal}
      </>
    );
  }
  return (
    <>
      <CIPParentActivityStep
        c={c}
        activity={activity}
        index={activity.order || 0}
        last
        status={status}
        isExpanded
        onToggleExpanded={() => {}}
        canComplete={canCompleteActivity(activity.key)}
        onComplete={(remark) => completeActivity(activity.key, remark)}
      >
        {winnerBody}
      </CIPParentActivityStep>
      {recycleModal}
    </>
  );
}

function CIPQuickActivityModal({ c, activityKey, onClose }) {
  const { lang } = useI18n();
  const activity = CIP_DETAIL_ACTIVITY[activityKey];
  if (!c || !activity) return null;
  return (
    <Modal
      open={!!c}
      onClose={onClose}
      width="min(96vw, 880px)"
      icon={activity.icon || "workflow"}
      title={trkText(lang, activity)}
      subtitle={`${c.proposalNumber || c.id} - ${c.title}`}
      overlayStyle={{ padding: "8px 20px" }}
      style={{ maxWidth: "min(96vw, 880px)", height: "calc(100vh - 16px)", display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflowY: "auto", padding: "16px 20px 20px" }}
    >
      <CIPEmbeddedActivityBody c={c} activityKey={activityKey} onClose={onClose} />
    </Modal>
  );
}

function CIPProposalEmbeddedActivities({ proposal, activityKey, vendors }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const session = useSession();
  const toast = useToast();
  const cip = useCipStore();
  const activity = CIP_DETAIL_ACTIVITY[activityKey || "termsheet"];
  const [ready, setReady] = React.useState(() => ((cip && cip.cases) || []).length > 0);
  React.useEffect(() => {
    let cancelled = false;
    cipRefreshDomainCases().catch(() => {}).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [proposal && proposal.id]);
  const cases = cipCasesForProposal((cip && cip.cases) || [], proposal);
  const vendorList = (vendors && vendors.length)
    ? vendors
    : cases.map((c) => ({ vendorId: c.vendorId, vendorName: c.vendor }));
  const cards = vendorList.length
    ? vendorList.map((vendor) => ({ vendor, caseRow: cipMatchCaseForVendor(cases, vendor) }))
    : cases.map((c) => ({ vendor: { vendorId: c.vendorId, vendorName: c.vendor }, caseRow: c }));
  const notesCase = cards.map((row) => row.caseRow).find(Boolean) || null;
  const [activityNotes, setActivityNotes] = React.useState(() => (notesCase && notesCase.activityNotes) || {});
  const [noteDrafts, setNoteDrafts] = React.useState({});
  React.useEffect(() => {
    setActivityNotes((notesCase && notesCase.activityNotes) || {});
    setNoteDrafts({});
  }, [notesCase && notesCase.id, activity && activity.key]);
  if (!ready && !cards.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 4px", color: C.textMuted, fontSize: 12.5 }}>
        <Spinner size={14} color={C.ocean} />
        {activityKey === "contract"
          ? tt("Loading Contract for each winner…", "Memuat Contract untuk setiap pemenang…")
          : tt("Loading Term Sheet for each winner…", "Memuat Term Sheet untuk setiap pemenang…")}
      </div>
    );
  }
  if (!cards.length || !activity) {
    return (
      <Alert
        tone="info"
        title={activityKey === "contract" ? tt("Contract not ready", "Contract belum siap") : tt("Term Sheet not ready", "Term Sheet belum siap")}
        description={activityKey === "contract"
          ? tt("Complete Term Sheet first so Contract can open here for each winner, in parallel with LOA.", "Selesaikan Term Sheet dulu agar Contract bisa dibuka di sini untuk setiap pemenang, paralel dengan LOA.")
          : tt("Complete Bid Evaluation or Negotiation first so a Term Sheet case can be opened for each winner.", "Selesaikan Bid Evaluation atau Negotiation dulu agar kasus Term Sheet bisa dibuka untuk setiap pemenang.")}
      />
    );
  }
  const statuses = cards.map(({ caseRow }) => (caseRow ? cipDetailActivityStatusForCase(caseRow, activity.key) : "Locked"));
  const aggregateStatus = statuses.every((status) => status === "Completed")
    ? "Completed"
    : statuses.some((status) => status === "Pending" || status === "Completed")
      ? "Pending"
      : "Locked";
  if (aggregateStatus === "Locked") return null;
  const actorName = (session && session.actingUser && session.actingUser.name) || (notesCase && (notesCase.procurement || notesCase.requestor)) || "Officer Proposal Tracker";
  const actorRole = typeof trkActivityNoteRoleForSession === "function" ? trkActivityNoteRoleForSession(session) : "Officer";
  const noteStage = activity.key === "termsheet" ? CIP_STAGE.termsheet : CIP_CONTRACT_NOTE_STAGE;
  const handleNoteDraftChange = (stageKey, value) => setNoteDrafts((current) => ({ ...current, [stageKey]: value }));
  const handlePostNote = (stage) => {
    if (!notesCase) return;
    const message = String((noteDrafts && noteDrafts[stage.key]) || "").trim();
    if (!message) {
      toast.push({ title: tt("Note is empty", "Notes masih kosong"), description: trkText(lang, stage), tone: "warning" });
      return;
    }
    const note = { id: `cip-note-${stage.key}-${Date.now()}`, activityId: stage.key, authorName: actorName, authorRole: actorRole, message, createdAt: trkNow() };
    const nextNotes = cipAppendActivityNote(notesCase, stage.key, note, activityNotes);
    setActivityNotes(nextNotes);
    setNoteDrafts((current) => ({ ...current, [stage.key]: "" }));
    toast.push({ title: tt("Step note posted", "Step note tersimpan"), description: trkText(lang, stage) });
  };
  const winnerCards = cards.map(({ vendor, caseRow }) => {
    const winnerStatus = caseRow ? cipDetailActivityStatusForCase(caseRow, activity.key) : "Locked";
    if (activity.key === "termsheet" && caseRow) {
      return (
        <CIPEmbeddedActivityBody
          key={caseRow.id}
          c={caseRow}
          activityKey={activity.key}
          layout="winner"
          proposal={proposal}
        />
      );
    }
    return (
      <div key={(caseRow && caseRow.id) || (vendor && vendor.vendorId) || "cip-winner"} style={{ display: "grid", gap: 8, border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, padding: "12px 14px", backgroundColor: C.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.6, fontWeight: 700, color: C.text }}>{(vendor && vendor.vendorName) || (caseRow && caseRow.vendor) || "-"}</div>
          {caseRow ? <Badge tone="neutral" size="sm">{caseRow.id}</Badge> : <Badge tone="warning" size="sm">{tt("No case yet", "Belum ada kasus")}</Badge>}
          <span style={{ marginLeft: "auto" }}><TrkActivityBadge status={winnerStatus} /></span>
        </div>
        {caseRow ? (
          <CIPEmbeddedActivityBody c={caseRow} activityKey={activity.key} layout="winner" proposal={proposal} />
        ) : (
          <Alert
            tone="warning"
            title={tt("Case not created yet", "Kasus belum dibuat")}
            description={tt("This winner does not have a Term Sheet case yet. Complete Bid Evaluation or Negotiation so the case can be created.", "Pemenang ini belum punya kasus Term Sheet. Selesaikan Bid Evaluation atau Negotiation agar kasusnya dibuat.")}
          />
        )}
      </div>
    );
  });
  const infoAlert = activity.key === "termsheet" ? (
    <Alert
      tone="info"
      title={tt("Term Sheet stays on this step until every winner is complete", "Term Sheet tetap di step ini sampai semua pemenang selesai")}
      description={tt("Complete Activity on a winner opens that winner’s LOA and Contract. Until then LOA and Contract stay closed. The Term Sheet step stays Active until every winner is complete.", "Complete Activity pada satu pemenang membuka LOA dan Contract pemenang itu. Sebelum itu LOA dan Contract tetap tertutup. Step Term Sheet tetap Active sampai semua pemenang selesai.")}
    />
  ) : (
    <Alert
      tone="info"
      title={tt("Contract runs per winner", "Contract dikerjakan per pemenang")}
      description={tt("A winner can work Contract after that winner’s Term Sheet is complete. The Contract step stays Active until every winner finishes.", "Pemenang bisa mengerjakan Contract setelah Term Sheet pemenang itu selesai. Step Contract tetap Active sampai semua pemenang selesai.")}
    />
  );
  if (!notesCase) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {infoAlert}
        {winnerCards}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {infoAlert}
      <div style={{ display: "grid", gap: 14 }}>{winnerCards}</div>
      <CIPStepNotesPanel
        stage={noteStage}
        notes={noteStage.key === "contract" ? cipContractActivityNotes(activityNotes) : ((activityNotes && activityNotes[noteStage.key]) || [])}
        draft={(noteDrafts && noteDrafts[noteStage.key]) || ""}
        actorName={actorName}
        onDraftChange={handleNoteDraftChange}
        onPostNote={handlePostNote}
        defaultExpanded={aggregateStatus === "Pending"}
      />
    </div>
  );
}

/* =================== CASE DETAIL =================== */
function CIPCaseDetail({ c, onBack, onNavigate, embedded }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const toast = useToast();
  const session = useSession();
  const [noteDrafts, setNoteDrafts] = React.useState({});
  const [recycleTarget, setRecycleTarget] = React.useState(null);
  const [expandedActivities, setExpandedActivities] = React.useState(() => {
    const next = {};
    CIP_DETAIL_ACTIVITIES.forEach((activity) => { next[activity.key] = cipDetailActivityStatusForCase(c, activity.key) === "Pending"; });
    return next;
  });
  const phaseKey = cipPhaseForStage(c.stage);
  const pct = Math.round(((cipPhaseIdx(c.stage) + 1) / CIP_PHASES.length) * 100);
  const actorName = (session && session.actingUser && session.actingUser.name) || c.procurement || c.requestor || "Officer Proposal Tracker";
  const actorRole = typeof trkActivityNoteRoleForSession === "function" ? trkActivityNoteRoleForSession(session) : "Officer";
  const canGenerate = cipCanGenerateTermSheet(session, cipProposalForCase(c));
  const activityNotes = c.activityNotes || {};
  React.useEffect(() => {
    const next = {};
    CIP_DETAIL_ACTIVITIES.forEach((activity) => { next[activity.key] = cipDetailActivityStatusForCase(c, activity.key) === "Pending"; });
    setExpandedActivities(next);
    setNoteDrafts({});
  }, [c.id, c.stage]);
  const setAllActivityExpanded = (expanded) => {
    const next = {};
    CIP_DETAIL_ACTIVITIES.forEach((activity) => { next[activity.key] = expanded; });
    setExpandedActivities(next);
  };
  const toggleActivityExpanded = (activityKey) => setExpandedActivities((current) => ({ ...current, [activityKey]: current[activityKey] === false }));
  const handleNoteDraftChange = (stageKey, value) => setNoteDrafts((current) => ({ ...current, [stageKey]: value }));
  const handlePostActivityNote = (stage) => {
    const message = String(noteDrafts[stage.key] || "").trim();
    if (!message) {
      toast.push({ title: tt("Note is empty", "Notes masih kosong"), description: trkText(lang, stage), tone: "warning" });
      return;
    }
    const note = { id: `cip-note-${stage.key}-${Date.now()}`, activityId: stage.key, authorName: actorName, authorRole: actorRole, message, createdAt: trkNow() };
    cipAppendActivityNote(c, stage.key, note, activityNotes);
    setNoteDrafts((current) => ({ ...current, [stage.key]: "" }));
    toast.push({ title: tt("Step note posted", "Step note tersimpan"), description: trkText(lang, stage) });
  };
  const renderStagePanel = (stage, readOnly) => {
    const key = stage.key;
    const isCurrent = !readOnly && c.stage === key;
    if (key === "loa") return <CIPLoaPanel c={c} tt={tt} lang={lang} isCurrent={isCurrent} onAdvance={() => advance("termsheet", "Award result from Proposal Tracker is ready — generate Term Sheet", "Hasil award dari Proposal Tracker siap — lanjut generate Term Sheet")} />;
    if (key === "verify") return <CIPVerifyPanel c={c} tt={tt} lang={lang} isCurrent={isCurrent} onAdvance={() => advance("termsheet", "Data confirmed — ready to generate the Termsheet", "Data dikonfirmasi — siap generate Termsheet")} />;
    if (key === "termsheet") return <CIPTermsheetPanel c={c} tt={tt} lang={lang} toast={toast} isCurrent={isCurrent} onAdvance={() => advance("template", "Termsheet approved — choose a template", "Termsheet disetujui — pilih template")} />;
    if (key === "template") return <CIPTemplatePanel c={c} tt={tt} lang={lang} toast={toast} isCurrent={isCurrent} readOnly={readOnly} onAdvance={(code) => advance("draft", "Draft contract generated — review draft output", "Draf kontrak digenerate — review output draf", { template: code })} />;
    if (key === "draft") return <CIPDraftPanel c={c} tt={tt} lang={lang} toast={toast} isCurrent={isCurrent} onAdvance={() => advance("final", "Draft has been reviewed — upload Final Contract", "Draft has been Reviewed — upload Final Contract", { legalReviewedOutsideSystem: true })} />;
    return <CIPFinalPanel c={c} tt={tt} lang={lang} toast={toast} isCurrent={isCurrent} canComplete={canCompleteActivity("contract")} onComplete={(remark, completedAt) => completeActivity("contract", remark, completedAt)} onNavigate={onNavigate} />;
  };
  const canRecycleSub = cipCanRecycleContractSubStage(session);
  const handleRecycleSub = (stage, reason) => {
    cipRecycleContractSubStage(c.id, stage.key, reason, actorName);
    toast.push({ title: tt("Sub-activity recycled", "Sub-activity direcycle"), description: trkText(lang, stage), tone: "warning" });
    setRecycleTarget(null);
  };
  const canCompleteActivity = (activityKey) => {
    if (activityKey === "termsheet") return canGenerate && c.stage === "termsheet" && !!c.termsheetBlobKey;
    if (activityKey === "contract") return c.stage === "final" && !!c.finalContractBlobKey && !c.contractActivityCompletedAt;
    return false;
  };
  const completeActivity = async (activityKey, remarkText, completedAt) => {
    if (activityKey === "termsheet") {
      advance("template", "Term Sheet activity completed — continue to Contract", "Aktivitas Term Sheet selesai — lanjut ke Contract", null, "Completed", remarkText, completedAt);
      return;
    }
    if (activityKey === "contract") {
      try {
        await cipCompleteContractActivity(c, actorName, remarkText, completedAt);
        toast.push({ title: tt("Contract activity completed", "Aktivitas Contract selesai"), description: c.id });
      } catch (error) {
        toast.push({ title: tt("Contract completion failed", "Complete Contract gagal"), description: (error && error.message) || c.id, tone: "error" });
      }
    }
  };

  const advance = async (nextKey, msgEn, msgId, extra, eventType, remarkText, completedAt) => {
    try {
      await cipAdvanceCase(c, nextKey, actorName, msgEn, extra, eventType, remarkText, completedAt);
      toast.push({ title: tt(msgEn, msgId), description: c.id });
    } catch (error) {
      toast.push({ title: tt("Workflow update failed", "Update workflow gagal"), description: (error && error.message) || c.id, tone: "error" });
    }
  };

  return (
    <div>
      {/* gradient case header */}
      <div className="cip-fade-up" style={{ position: "relative", overflow: "hidden", borderRadius: RADIUS.xl, background: CIP_HERO_GRAD, padding: "20px 24px 22px", marginBottom: 18, color: "#fff" }}>
        <div style={{ position: "absolute", inset: 0, background: CIP_HERO_PATTERN, pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          {onBack && (
            <button onClick={onBack} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "none", padding: 0, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 10 }}>
              <Icon name="arrow-left" size={13} color="rgba(255,255,255,0.75)" />{embedded ? tt("Back to Proposal", "Kembali ke Proposal") : tt("Term Sheet & Contract", "Term Sheet & Kontrak")}
            </button>
          )}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 550, color: "#7FD4D9" }}>{c.id}</span>
                {cipStatusBadge(c.status, lang)}
                {c.proposalId && <CipSourceChip kind="tracker" size="sm" />}
              </div>
              <div style={{ fontSize: 19, fontWeight: 550, marginTop: 5, lineHeight: 1.3 }}>{c.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 7, fontSize: 12, color: "rgba(255,255,255,0.78)", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="building-2" size={13} color="rgba(255,255,255,0.7)" />{c.vendor}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="map-pin" size={13} color="rgba(255,255,255,0.7)" />{c.jobsite}</span>
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>{c.loaNo}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>{tt("Contract value", "Nilai kontrak")}</div>
              <div style={{ fontSize: 21, fontWeight: 550, letterSpacing: "-0.01em" }}>{trkRp(c.value)}</div>
            </div>
          </div>
          {/* progress */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 5 }}>
              <span>{trkText(lang, CIP_PHASE[phaseKey])} · {trkText(lang, CIP_STAGE[c.stage])}</span><span>{pct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)", overflow: "hidden" }}>
              <div className="cip-grow" style={{ width: `${Math.max(pct, 3)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#3FB6BE,#ABD096)" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="ag-trk-detail-lower" style={{ display: "grid", gridTemplateColumns: "minmax(0, 55fr) minmax(360px, 45fr)", gap: 16, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <DetailCard
            title={tt("Activity workflow", "Alur aktivitas")}
            subtitle={tt("Term Sheet and Contract activities stay on this proposal. Completing Term Sheet opens LOA and Contract in parallel.", "Aktivitas Term Sheet dan Contract tetap di proposal ini. Menyelesaikan Term Sheet membuka LOA dan Contract secara paralel.")}
            action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}><IconButton size="sm" variant="secondary" name="chevrons-down" title={tt("Expand all", "Expand all")} tipSide="top" onClick={() => setAllActivityExpanded(true)} /><IconButton size="sm" variant="secondary" name="chevrons-up" title={tt("Collapse all", "Collapse all")} tipSide="top" onClick={() => setAllActivityExpanded(false)} /></div>}
            pad={0}
          >
            <div style={{ padding: "12px 20px 20px" }}>
              {CIP_DETAIL_ACTIVITIES.map((activity, index) => (
                <CIPParentActivityStep
                  key={activity.key}
                  c={c}
                  activity={activity}
                  index={index}
                  last={index === CIP_DETAIL_ACTIVITIES.length - 1}
                  status={cipDetailActivityStatusForCase(c, activity.key)}
                  isExpanded={expandedActivities[activity.key] !== false}
                  onToggleExpanded={() => toggleActivityExpanded(activity.key)}
                  canComplete={canCompleteActivity(activity.key)}
                  onComplete={() => completeActivity(activity.key)}
                  actorName={actorName}
                >
                  {activity.key === "termsheet" ? (
                    <CIPTermSheetActivityPanel
                      c={c}
                      tt={tt}
                      lang={lang}
                      toast={toast}
                      isCurrent={["loa", "termsheet"].includes(c.stage)}
                      canGenerate={canGenerate}
                      canComplete={canCompleteActivity(activity.key)}
                      onComplete={(remark, completedAt) => completeActivity(activity.key, remark, completedAt)}
                      activityNotes={activityNotes}
                      noteDrafts={noteDrafts}
                      actorName={actorName}
                      onNoteDraftChange={handleNoteDraftChange}
                      onPostNote={handlePostActivityNote}
                    />
                  ) : (
                    <>
                      <CIPSubActivityList
                        c={c}
                        activity={activity}
                        renderStagePanel={renderStagePanel}
                        canRecycle={canRecycleSub}
                        onRecycle={(stage) => setRecycleTarget(stage)}
                      />
                      <CIPStepNotesPanel
                        stage={CIP_CONTRACT_NOTE_STAGE}
                        notes={cipContractActivityNotes(activityNotes)}
                        draft={(noteDrafts && noteDrafts.contract) || ""}
                        actorName={actorName}
                        onDraftChange={handleNoteDraftChange}
                        onPostNote={handlePostActivityNote}
                        defaultExpanded={cipDetailActivityStatusForCase(c, activity.key) === "Pending"}
                      />
                    </>
                  )}
                </CIPParentActivityStep>
              ))}
            </div>
          </DetailCard>
        </div>
        <div className="ag-trk-detail-side" style={{ display: "flex", flexDirection: "column", gap: CIP_DETAIL_SIDE_GAP, minWidth: 0 }}>
          <CIPNotesSummaryPanel c={c} />
          <CIPActivityHistoryPanel c={c} />
        </div>
      </div>
      <CIPRecycleSubActivityModal
        open={!!recycleTarget}
        stage={recycleTarget}
        caseTitle={c.title}
        onClose={() => setRecycleTarget(null)}
        onSubmit={handleRecycleSub}
        tt={tt}
        lang={lang}
      />
    </div>
  );
}

/* ---------- panel action bar ---------- */
function CipActions({ children, note }) {
  const C = useC();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
      {note && <span style={{ fontSize: 11.5, color: C.textSubtle, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="info" size={12} />{note}</span>}
      <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>{children}</div>
    </div>
  );
}

function cipStageStatusForCase(c, stageKey) {
  const curIdx = cipStageIdx(c.stage);
  const idx = cipStageIdx(stageKey);
  if (stageKey === "final" && c.stage === "final" && !c.contractActivityCompletedAt) return "Pending";
  if (c.stage === "final" && idx <= curIdx) return "Completed";
  if (idx < curIdx) return "Completed";
  if (idx === curIdx) return "Pending";
  return "Locked";
}

function cipSubStageExpandedDefaults(c, subStages) {
  const next = {};
  (subStages || []).forEach((stageKey) => {
    next[stageKey] = cipStageStatusForCase(c, stageKey) === "Pending";
  });
  return next;
}

function cipCanRecycleContractSubStage(session) {
  const roles = (session && session.effectiveRoles) || [];
  const role = session && session.effectiveRole;
  const all = role ? roles.concat([role]) : roles;
  return all.some((r) => /section head proposal tracker/i.test(String(r || ""))
    || /super admin/i.test(String(r || ""))
    || /officer contract intelligent platform/i.test(String(r || "")));
}

function CipReadOnlyBanner({ tt }) {
  const C = useC();
  return (
    <Alert
      tone="neutral"
      title={tt("Read-only snapshot", "Tampilan read-only")}
      description={tt("This sub-activity is completed. Only the open step can be edited.", "Sub-activity ini sudah selesai. Hanya step yang open yang dapat diedit.")}
      style={{ marginBottom: 12 }}
    />
  );
}

function CIPRecycleSubActivityModal({ open, stage, caseTitle, onClose, onSubmit, tt, lang }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (open) { setReason(""); setError(""); }
  }, [open, stage && stage.key]);
  if (!stage) return null;
  const submit = () => {
    const value = reason.trim();
    if (!value) {
      setError(tt("Recycle reason is required.", "Alasan recycle wajib diisi."));
      return;
    }
    onSubmit && onSubmit(stage, value);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      icon="rotate-ccw"
      overlayStyle={{ zIndex: 1400 }}
      title={tt("Recycle Sub-Activity", "Recycle Sub-Activity")}
      subtitle={`${caseTitle || ""} · ${trkText(lang, stage)}`}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Back", "Kembali")}</Button><Button variant="secondary" iconLeft="rotate-ccw" disabled={!reason.trim()} onClick={submit} style={{ borderColor: "#EB662E", color: "#EB662E" }}>{tt("Recycle", "Recycle")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Alert
          tone="warning"
          title={tt("This will reopen the selected sub-activity.", "Sub-activity ini akan dibuka ulang.")}
          description={tt("Later contract sub-activities will be locked again until this step is completed.", "Sub-activity Contract setelahnya akan dikunci kembali sampai step ini diselesaikan.")}
        />
        <Field label={tt("Recycle Reason", "Alasan Recycle")} required helper={error || tt("Write the business reason before recycling this sub-activity.", "Tuliskan alasan bisnis sebelum recycle sub-activity ini.")} status={error ? "error" : undefined}>
          <Textarea rows={4} value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder={tt("Example: Final contract upload needs correction after offline review.", "Contoh: Upload kontrak final perlu koreksi setelah review offline.")} style={{ minHeight: 112 }} />
        </Field>
      </div>
    </Modal>
  );
}
function cipStageHistoryRows(c) {
  const fromCase = Array.isArray(c.activityHistory) ? c.activityHistory : [];
  const legacyLoaSource = c.source === "tracker-loa" || !!c.loaNo;
  const created = {
    id: `${c.id}-created`,
    type: "Started",
    stageKey: legacyLoaSource ? "loa" : "termsheet",
    at: c.createdAt || CIP_AS_OF,
    actorName: c.procurement || c.requestor || "Proposal Tracker",
    message: legacyLoaSource ? "Legacy LOA handoff received from Proposal Tracker." : "Award result received from Proposal Tracker for Term Sheet generation.",
  };
  const rows = fromCase.length ? fromCase : [created];
  return rows.slice().sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}
function cipActivityNoteRows(c) {
  const notes = c.activityNotes || {};
  const rows = [];
  CIP_STAGES.forEach((stage, index) => {
    ((notes && notes[stage.key]) || []).forEach((note, noteIndex) => rows.push({
      id: note.id || `${stage.key}-note-${noteIndex}`,
      stageKey: stage.key,
      stageTitle: stage.en,
      stepIndex: index,
      ...note,
    }));
  });
  return rows.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}
function cipStageColor(C, index) {
  return trkStepHistoryColor(C, index);
}
function CIPStepNotesPanel({ stage, notes, draft, actorName, onDraftChange, onPostNote, defaultExpanded, readOnly }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const [expanded, setExpanded] = React.useState(!!defaultExpanded);
  const rows = (notes || []).slice().sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  React.useEffect(() => setExpanded(!!defaultExpanded), [stage.key, defaultExpanded]);
  return (
    <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, backgroundColor: C.scheme === "dark" ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.72)", overflow: "hidden" }}>
      <div role="button" tabIndex={0} aria-expanded={expanded} onClick={() => setExpanded((x) => !x)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpanded((x) => !x); } }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderBottom: expanded ? `1px solid ${C.borderSoft}` : "none", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 28, height: 28, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="message-square-text" size={15} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.8, fontWeight: 550, color: C.text }}>{tt("Step Notes", "Step Notes")}</div>
            <div style={{ fontSize: 11.4, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trkText(lang, stage)}</div>
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Badge tone={rows.length ? "info" : "neutral"} size="sm">{rows.length}</Badge>
          <span style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surface, color: C.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={expanded ? "chevron-up" : "chevron-down"} size={15} /></span>
        </div>
      </div>
      {expanded && <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 ? (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: RADIUS.md, padding: "10px 12px", color: C.textMuted, fontSize: 12.2, lineHeight: 1.45, backgroundColor: C.surfaceAlt }}>{tt("No notes in this step yet.", "Belum ada notes di step ini.")}</div>
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
                      <span style={{ fontSize: 11.2, fontWeight: 600, color: C.text }}>{note.authorName}</span>
                      <span style={{ fontSize: 10.8, color: C.textSubtle }}>{trkDetailDate(note.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.48, whiteSpace: "pre-wrap" }}>{note.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!readOnly && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 9, alignItems: "end" }} className="ag-trk-row3">
          <Textarea rows={2} value={draft || ""} onChange={(event) => onDraftChange(stage.key, event.target.value)} placeholder={tt("Write notes for this step...", "Tulis notes untuk step ini...")} style={{ minHeight: 58, resize: "vertical", fontSize: 12.6, lineHeight: 1.45 }} />
          <Button size="sm" iconLeft="send" disabled={!String(draft || "").trim()} onClick={() => onPostNote(stage)} style={{ height: 36 }}>{tt("Post", "Post")}</Button>
        </div>
        )}
      </div>}
    </div>
  );
}
function CIPSubActivityList({ c, activity, renderStagePanel, canRecycle, onRecycle }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const subStages = activity.subStages || [];
  const [expandedSubs, setExpandedSubs] = React.useState(() => cipSubStageExpandedDefaults(c, subStages));
  React.useEffect(() => {
    setExpandedSubs(cipSubStageExpandedDefaults(c, subStages));
  }, [c.id, c.stage, subStages.join("|")]);
  const toggleSubExpanded = (stageKey) => {
    if (cipStageStatusForCase(c, stageKey) === "Locked") return;
    setExpandedSubs((current) => ({ ...current, [stageKey]: !current[stageKey] }));
  };
  const parentContractCompleted = activity.key === "contract" && !!c.contractActivityCompletedAt;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {subStages.map((stageKey, idx) => {
        const stage = CIP_STAGE[stageKey];
        if (!stage) return null;
        const status = cipStageStatusForCase(c, stage.key);
        const locked = status === "Locked";
        const active = status === "Pending";
        const done = status === "Completed";
        const readOnly = !active;
        const isExpanded = !locked && expandedSubs[stage.key] === true;
        const tone = trkActivityStatusTone(C, status);
        const showBody = isExpanded && !locked;
        const showRecycle = !parentContractCompleted && done && canRecycle && cipStageIdx(c.stage) >= cipStageIdx(stage.key);
        return (
          <div
            key={stage.key}
            className="cip-sub-acc"
            style={{
              border: `1px solid ${tone.border}`,
              borderRadius: RADIUS.lg,
              backgroundColor: locked ? C.surfaceAlt : C.surface,
              overflow: "hidden",
              opacity: locked ? 0.72 : 1,
              boxShadow: active ? `inset 4px 0 0 ${tone.accent}` : done ? `inset 4px 0 0 ${C.success}` : "none",
              transition: "box-shadow 0.22s ease, border-color 0.22s ease, opacity 0.22s ease",
            }}
          >
            <div
              role="button"
              tabIndex={locked ? -1 : 0}
              aria-expanded={isExpanded}
              onClick={() => toggleSubExpanded(stage.key)}
              onKeyDown={(e) => { if (!locked && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleSubExpanded(stage.key); } }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 13px 11px 14px",
                borderBottom: showBody ? `1px solid ${tone.border}` : "none",
                backgroundColor: tone.headerBg,
                cursor: locked ? "default" : "pointer",
                userSelect: "none",
              }}
            >
              <span style={{ width: 26, height: 26, borderRadius: RADIUS.md, backgroundColor: done ? C.success : active ? tone.accent : C.border, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                {done ? <Icon name="check" size={13} color="#fff" /> : idx + 1}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{trkText(lang, stage)}</span>
                  {done && <Badge tone="success" size="sm">{tt("Completed", "Selesai")}</Badge>}
                  {active && <Badge tone="brand" size="sm" dot>{tt("Open", "Open")}</Badge>}
                  {readOnly && !locked && <Badge tone="neutral" size="sm">{tt("Read-only", "Read-only")}</Badge>}
                </div>
                <div style={{ fontSize: 11.4, color: C.textMuted, marginTop: 2, lineHeight: 1.4 }}>{lang === "id" ? stage.desc_id : stage.desc_en}</div>
              </div>
              {showRecycle && (
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft="rotate-ccw"
                  onClick={(e) => { e.stopPropagation(); onRecycle && onRecycle(stage); }}
                  style={{ borderColor: C.orange, color: C.orange, backgroundColor: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.10)", flexShrink: 0 }}
                >
                  {tt("Recycle", "Recycle")}
                </Button>
              )}
              <TrkActivityBadge status={status} />
              {!locked && (
                <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${tone.border}`, backgroundColor: C.surface, color: tone.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "transform 0.2s ease" }}>
                  <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} />
                </span>
              )}
              {locked && <Icon name="lock" size={15} color={C.textSubtle} />}
            </div>
            {showBody && (
              <div className="cip-fade-up" style={{ padding: "12px 14px 14px", display: "grid", gap: 12, backgroundColor: tone.bodyBg }}>
                {readOnly && <CipReadOnlyBanner tt={tt} />}
                <div style={readOnly ? { pointerEvents: "none", userSelect: "none", opacity: 0.88 } : undefined}>
                  {renderStagePanel(stage, readOnly)}
                </div>
              </div>
            )}
            {locked && (
              <div style={{ padding: "9px 14px", fontSize: 11.5, color: C.textSubtle, display: "flex", gap: 7, alignItems: "center", backgroundColor: C.surfaceInset }}>
                <Icon name="lock" size={13} />
                {tt("Sub-activity is locked until previous sub-activity is completed.", "Sub-activity terkunci sampai sub-activity sebelumnya selesai.")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
function CIPParentActivityStep({ c, activity, index, last, status, isExpanded, onToggleExpanded, canComplete, onComplete, children }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const done = status === "Completed";
  const open = status === "Pending";
  const locked = status === "Locked";
  const tone = trkActivityStatusTone(C, status);
  const color = tone.accent;
  const dates = activity.key === "termsheet" ? cipTrackerDatesForCase(c).termsheet : cipTrackerDatesForCase(c).contract;
  const showBody = isExpanded && !locked;
  const [completeOpen, setCompleteOpen] = React.useState(false);
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: tone.iconBg, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", color, boxShadow: locked ? "none" : `0 6px 14px ${color}24` }}><Icon name={done ? "check" : locked ? "lock" : activity.icon} size={16} /></div>
        {!last && <div style={{ width: 2, flex: 1, minHeight: 36, backgroundColor: tone.connector, opacity: locked ? 0.38 : 0.68, margin: "4px 0" }} />}
      </div>
      <div style={{ position: "relative", flex: 1, minWidth: 0, marginBottom: last ? 0 : 14, border: `1px solid ${tone.border}`, backgroundColor: locked ? C.surfaceAlt : C.surface, borderRadius: RADIUS.lg, overflow: "hidden", opacity: locked ? 0.82 : 1, boxShadow: `inset 4px 0 0 ${color}` }}>
        <div role="button" tabIndex={0} aria-expanded={isExpanded} onClick={onToggleExpanded} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleExpanded && onToggleExpanded(); } }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px 13px 16px", borderBottom: showBody ? `1px solid ${tone.border}` : "none", backgroundColor: tone.headerBg, cursor: "pointer", userSelect: "none" }}>
          <span style={{ width: 26, fontSize: 11, fontWeight: 550, color }}>{String(index + 1).padStart(2, "0")}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 550, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trkText(lang, activity)}</span>
              <Badge tone="neutral" size="sm">{activity.trackerCode}</Badge>
              {(activity.subStages || []).length > 0 && <Badge tone="brand" size="sm">{(activity.subStages || []).length} sub-activity</Badge>}
            </div>
            <div style={{ fontSize: 11.7, color: locked ? C.textSubtle : C.textMuted }}>{lang === "id" ? activity.desc_id : activity.desc_en}</div>
          </div>
          {done && <Badge tone="success">{tt("Completed", "Selesai")}</Badge>}
          <TrkActivityBadge status={status} />
          <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${tone.border}`, backgroundColor: C.surface, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} /></span>
        </div>
        {showBody && <div style={{ padding: "12px 14px 14px 16px", display: "grid", gap: 12, backgroundColor: tone.bodyBg }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: C.textMuted }}>
            <span><Icon name="calendar-check" size={12} /> Plan: <b style={{ color: C.text, fontWeight: 600 }}>{dates && dates.plan ? trkFmtDate(dates.plan, lang) : "-"}</b></span>
            <span><Icon name="flag" size={12} /> Actual: <b style={{ color: C.text, fontWeight: 600 }}>{dates && dates.actual ? trkFmtDate(dates.actual, lang) : open ? "Open" : "-"}</b></span>
            {activity.key !== "termsheet" && activity.key !== "contract" && <Button size="sm" iconLeft="check-circle-2" disabled={!canComplete} onClick={(event) => { event.stopPropagation(); setCompleteOpen(true); }} style={{ marginLeft: "auto" }}>{tt("Complete Activity", "Complete Activity")}</Button>}
          </div>
          {!canComplete && open && activity.key !== "termsheet" && activity.key !== "contract" && <Alert tone="info" title={tt("Complete activity is gated", "Complete activity menunggu syarat")} description={tt("Finish the required sub-activities, then complete this activity.", "Selesaikan sub-activity yang diperlukan, lalu complete activity ini.")} />}
          {children}
        </div>}
        {isExpanded && locked && <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.borderSoft}`, display: "flex", gap: 7, fontSize: 12, color: C.textSubtle }}><Icon name="lock" size={13} />{tt("Locked until Term Sheet activity is completed.", "Terkunci sampai aktivitas Term Sheet selesai.")}</div>}
      </div>
      <CIPCompleteActivityModal
        open={completeOpen}
        title={trkText(lang, activity)}
        subtitle={tt("Complete activity", "Selesaikan aktivitas")}
        defaultRemark={tt(`${trkText("en", activity)} reviewed and completed in Tracker.`, `${trkText("id", activity)} sudah direview dan diselesaikan di Tracker.`)}
        onClose={() => setCompleteOpen(false)}
        onSubmit={(remark) => { setCompleteOpen(false); onComplete && onComplete(remark); }}
      />
    </div>
  );
}
function CIPActivityStep({ c, stage, index, last, status, isExpanded, onToggleExpanded, notes, noteDraft, actorName, onNoteDraftChange, onPostNote, children }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const done = status === "Completed";
  const open = status === "Pending";
  const locked = status === "Locked";
  const tone = trkActivityStatusTone(C, status);
  const color = tone.accent;
  const iconName = done ? "check" : locked ? "lock" : "play";
  const trackerCode = cipPhaseForStage(stage.key) === "termsheet" ? "TERM" : "CTR";
  const dates = cipPhaseForStage(stage.key) === "termsheet" ? cipTrackerDatesForCase(c).termsheet : cipTrackerDatesForCase(c).contract;
  const showBody = isExpanded && !locked;
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", backgroundColor: tone.iconBg, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", color, boxShadow: locked ? "none" : `0 6px 14px ${color}24` }}><Icon name={iconName} size={15} /></div>
        {!last && <div style={{ width: 2, flex: 1, minHeight: 28, backgroundColor: tone.connector, opacity: locked ? 0.38 : 0.68, margin: "4px 0" }} />}
      </div>
      <div style={{ position: "relative", flex: 1, minWidth: 0, marginBottom: last ? 0 : 12, border: `1px solid ${tone.border}`, backgroundColor: locked ? C.surfaceAlt : C.surface, borderRadius: RADIUS.lg, overflow: "hidden", opacity: locked ? 0.82 : 1, boxShadow: `inset 4px 0 0 ${color}` }}>
        <div role="button" tabIndex={0} aria-expanded={isExpanded} onClick={onToggleExpanded} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleExpanded && onToggleExpanded(); } }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 12px 16px", borderBottom: showBody ? `1px solid ${tone.border}` : "none", backgroundColor: tone.headerBg, cursor: "pointer", userSelect: "none" }}>
          <span style={{ width: 24, fontSize: 11, fontWeight: 600, color }}>{String(index + 1).padStart(2, "0")}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trkText(lang, stage)}</span>
              <Badge tone="neutral" size="sm">{trackerCode}</Badge>
            </div>
            <div style={{ fontSize: 11.5, color: locked ? C.textSubtle : C.textMuted }}>{lang === "id" ? stage.desc_id : stage.desc_en}</div>
          </div>
          {done && <Badge tone="success">{tt("Completed", "Selesai")}</Badge>}
          <TrkActivityBadge status={status} />
          <span style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${tone.border}`, backgroundColor: C.surface, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} /></span>
        </div>
        {showBody && <div style={{ padding: "12px 14px 12px 16px", display: "grid", gap: 12, backgroundColor: tone.bodyBg }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: C.textMuted }}>
            <span><Icon name="calendar-check" size={12} /> Plan: <b style={{ color: C.text, fontWeight: 600 }}>{dates && dates.plan ? trkFmtDate(dates.plan, lang) : "-"}</b></span>
            <span><Icon name="flag" size={12} /> Actual: <b style={{ color: C.text, fontWeight: 600 }}>{dates && dates.actual ? trkFmtDate(dates.actual, lang) : open ? "Open" : "-"}</b></span>
          </div>
          {children}
          <CIPStepNotesPanel stage={stage} notes={notes} draft={noteDraft} actorName={actorName} onDraftChange={onNoteDraftChange} onPostNote={onPostNote} defaultExpanded={open} />
        </div>}
        {isExpanded && locked && <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.borderSoft}`, display: "flex", gap: 7, fontSize: 12, color: C.textSubtle }}><Icon name="lock" size={13} />{tt("Locked until the previous Term Sheet / Contract activity is completed.", "Terkunci sampai aktivitas Term Sheet / Contract sebelumnya selesai.")}</div>}
      </div>
    </div>
  );
}
function CIPNotesSummaryPanel({ c }) {
  const C = useC();
  const tt = useTT();
  const cipNotes = cipActivityNoteRows(c).map((note) => ({ ...note, source: note.source || "cip" }));
  const trackerNotes = cipTrackerNoteRows(c);
  const notes = cipNotes.concat(trackerNotes).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return (
    <DetailCard title={tt("Notes Summary", "Notes Summary")} subtitle={tt("Proposal notes carry forward into Term Sheet / Contract.", "Catatan proposal diteruskan ke Term Sheet / Contract.")} style={{ minHeight: 420 }}>
      {!notes.length ? <EmptyState icon="notebook-pen" title={tt("No step notes yet", "Belum ada step notes")} description={tt("Notes posted inside each Term Sheet / Contract step will appear here.", "Notes dari setiap step Term Sheet / Contract akan tampil di sini.")} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
          {notes.map((note) => {
            const officer = trkActivityNoteIsOfficer(note.authorRole);
            const bubbleTone = trkActivityNoteBubbleTone(C, note.authorRole);
            const sourceTone = note.source === "tracker" ? "info" : "neutral";
            const sourceLabel = note.source === "tracker" ? "Proposal Tracker" : "CIP";
            return <div key={note.id} style={{ display: "flex", justifyContent: officer ? "flex-end" : "flex-start" }}><div style={{ width: "min(100%, 88%)", border: `1px solid ${bubbleTone.border}`, borderRadius: RADIUS.md, padding: "10px 11px", backgroundColor: bubbleTone.bg, boxShadow: `inset ${officer ? -3 : 3}px 0 0 ${bubbleTone.accent}` }}><div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 6, justifyContent: officer ? "flex-end" : "flex-start" }}><Badge tone={sourceTone} size="sm">{sourceLabel}</Badge><Badge tone={trkActivityNoteRoleTone(note.authorRole)} size="sm">{note.authorRole || "Officer"}</Badge><span style={{ fontSize: 11.5, color: C.text, fontWeight: 600 }}>Step {note.stepIndex + 1} - {note.stageTitle}</span><span style={{ fontSize: 11, color: C.textSubtle }}>{trkDetailDate(note.createdAt)}</span></div><div style={{ fontSize: 12.4, color: C.textMuted, lineHeight: 1.5 }}>{note.authorName && <b style={{ color: C.text }}>{note.authorName}</b>}{note.authorName ? " - " : ""}{note.message}</div></div></div>;
          })}
        </div>
      )}
    </DetailCard>
  );
}
function CIPActivityHistoryPanel({ c }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const history = cipStageHistoryRows(c);
  return (
    <DetailCard title={tt("Activity History", "Activity History")} subtitle={tt("Term Sheet / Contract trail and proposal workflow sync.", "Jejak Term Sheet / Contract dan sinkronisasi workflow proposal.")} style={{ minHeight: 420 }}>
      <div style={{ maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
        {history.map((event, index) => {
          const stage = CIP_STAGE[event.stageKey] || CIP_STAGE.loa;
          const stepIndex = stage.order || 0;
          const color = cipStageColor(C, stepIndex);
          const tone = trkHistoryTone(C, event.type || "Started");
          const tintBg = color + (C.scheme === "dark" ? "26" : "16");
          const chipBg = color + (C.scheme === "dark" ? "2e" : "1c");
          return (
            <div key={event.id || `${event.stageKey}-${index}`} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, position: "relative" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: tintBg, color, border: `1px solid ${color}55`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={tone.icon} size={13} /></span>
                {index < history.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: C.borderSoft, margin: "4px 0" }} />}
              </div>
              <div style={{ paddingBottom: index < history.length - 1 ? 13 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 600, backgroundColor: chipBg, color }}>{String(stepIndex + 1).padStart(2, "0")} · {trkText(lang, stage)}</span>
                  <span style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 600 }}>{trkHistoryEventLabel(event.type || "Started", tt)}</span>
                  <span style={{ fontSize: 11, color: C.textSubtle }}>{trkDetailDate(event.at)}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12.3, lineHeight: 1.5, backgroundColor: tintBg, border: `1px solid ${color}2e`, borderRadius: RADIUS.md, padding: "8px 11px", boxShadow: `inset 3px 0 0 ${color}` }}>
                  {event.actorName && <b style={{ color, fontWeight: 600 }}>{event.actorName}</b>}{event.actorName && event.message ? <span style={{ color: C.textSubtle }}> - </span> : ""}<span style={{ color: C.textMuted }}>{event.message || "-"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DetailCard>
  );
}

function CIPDocumentTile({ title, fileName, sourceLabel, meta, tone = "info", disabled, onPreview, actionLabel }) {
  const C = useC();
  const tt = useTT();
  const toneColor = tone === "success" ? C.success : tone === "brand" ? C.ocean : C.info;
  const toneBg = tone === "success" ? C.successBg : tone === "brand" ? C.brandBg : C.infoBg;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, overflow: "hidden", boxShadow: "0 10px 22px rgba(15,42,58,0.06)" }}>
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "46px minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
        <span style={{ width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: toneBg, color: toneColor, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="file-text" size={24} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.8, fontWeight: 550, color: C.text }}>{title}</div>
            {sourceLabel && <Badge tone={tone === "success" ? "success" : "info"} size="sm">{sourceLabel}</Badge>}
          </div>
          <div title={fileName} style={{ marginTop: 3, fontSize: 11.5, color: C.textMuted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName || "-"}</div>
        </div>
        <Tooltip label={disabled ? tt("Document is not available yet", "Dokumen belum tersedia") : (actionLabel || tt("Preview PDF", "Preview PDF"))} side="top">
          <button
            type="button"
            disabled={disabled}
            onClick={onPreview}
            style={{ ...FONT, width: 34, height: 34, borderRadius: "50%", border: `1px solid ${disabled ? C.border : toneColor}`, backgroundColor: disabled ? C.surfaceAlt : toneBg, color: disabled ? C.textSubtle : toneColor, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.65 : 1 }}
            aria-label={actionLabel || tt("Preview PDF", "Preview PDF")}
          >
            <Icon name="file-search" size={15} />
          </button>
        </Tooltip>
      </div>
      {meta && meta.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderTop: `1px solid ${C.borderSoft}` }}>
          {meta.map((item, index) => (
            <div key={index} style={{ padding: "9px 12px", borderRight: index === meta.length - 1 ? "none" : `1px solid ${C.borderSoft}`, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: C.textSubtle, fontWeight: 550 }}>{item.label}</div>
              <div style={{ marginTop: 2, fontSize: 12.2, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value || "-"}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CIPCompleteActivityModal({ open, title, subtitle, defaultRemark, showCompleteDate = false, defaultCompleteDate, onClose, onSubmit }) {
  const tt = useTT();
  const [remark, setRemark] = React.useState(defaultRemark || "");
  const [completeDate, setCompleteDate] = React.useState(defaultCompleteDate || TRK_TODAY);
  React.useEffect(() => {
    if (open) {
      setRemark(defaultRemark || "");
      setCompleteDate(defaultCompleteDate || TRK_TODAY);
    }
  }, [open, defaultRemark, defaultCompleteDate]);
  if (!open) return null;
  const cleanRemark = String(remark || "").trim();
  const completeDisabled = !cleanRemark || (showCompleteDate && !completeDate);
  const completedAt = completeDate === TRK_TODAY ? trkNow() : `${completeDate} 10:00:00`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      icon="check-circle-2"
      overlayStyle={{ zIndex: 1400 }}
      title={tt("Complete activity", "Selesaikan aktivitas")}
      subtitle={subtitle || title}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="check" disabled={completeDisabled} onClick={() => onSubmit && onSubmit(cleanRemark, showCompleteDate ? completedAt : null)}>{tt("Complete", "Selesaikan")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {showCompleteDate && (
          <Field label={tt("Completed date", "Tanggal selesai")} required helper={tt("Date this activity was completed.", "Tanggal activity ini diselesaikan.")}>
            <TextInput type="date" value={completeDate} onChange={(event) => setCompleteDate(event.target.value)} iconLeft="calendar" />
          </Field>
        )}
        <Field label={tt("Remark", "Catatan")} required>
          <Textarea rows={3} value={remark} onChange={(event) => setRemark(event.target.value)} placeholder={tt("Write completion remark for this activity...", "Tulis remark penyelesaian activity ini...")} />
        </Field>
      </div>
    </Modal>
  );
}

function cipTrackerVendorStepDoc(proposal, vendorId, activityPredicate) {
  if (!proposal || typeof trkLoadStepVendorDocs !== "function" || typeof activityPredicate !== "function") return null;
  const activity = (proposal.activities || []).find(activityPredicate);
  if (!activity) return null;
  const stepDocs = trkLoadStepVendorDocs(proposal) || {};
  const byVendor = stepDocs[activity.id] || {};
  const wanted = String(vendorId || "").toLowerCase();
  if (wanted) {
    const match = Object.keys(byVendor).find((id) => String(id).toLowerCase() === wanted);
    if (match && byVendor[match] && byVendor[match][0]) return byVendor[match][0];
  }
  for (const id of Object.keys(byVendor)) {
    if (byVendor[id] && byVendor[id][0]) return byVendor[id][0];
  }
  return null;
}
function cipTrackerFirstStepDoc(proposal, activityPredicate) {
  return cipTrackerVendorStepDoc(proposal, null, activityPredicate);
}
function cipTrackerSharedBidEvalWinnerProof(proposal) {
  if (!proposal || typeof trkIsBidEvaluationActivity !== "function") return null;
  const activity = (proposal.activities || []).find(trkIsBidEvaluationActivity);
  if (!activity) return null;
  const state = typeof trkLoadBidEvalState === "function" ? trkLoadBidEvalState(proposal) : {};
  const current = typeof trkBidEvalForActivity === "function" ? trkBidEvalForActivity(state, activity.id) : ((state && state[activity.id]) || {});
  const proofs = (current.proofDocuments || []).filter(Boolean);
  if (!proofs.length) return null;
  const unscoped = proofs.find((doc) => !String(doc.vendorId || "").trim());
  if (unscoped) return unscoped;
  const vendorIds = new Set(proofs.map((doc) => String(doc.vendorId || "").trim()).filter(Boolean));
  if (vendorIds.size > 1) {
    const sharedName = proofs.find((doc) => {
      const name = String(doc.fileName || doc.name || "").toLowerCase();
      return name.startsWith("evaluasi_bid")
        || name.includes("bid-evaluation-winner")
        || (name.startsWith("bukti_pemenang_") && !/_pt[-_]/.test(name));
    });
    if (sharedName) return sharedName;
  }
  return proofs[0];
}
function cipSnapshotDocFromPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const blobKey = raw.blobKey || raw.BlobKey || "";
  const container = raw.container || raw.Container || "";
  const src = raw.src || raw.dataUri || raw.Src || raw.DataUri || "";
  if (!src && !(blobKey && container)) return null;
  return {
    title: raw.title || raw.Title || raw.fileName || raw.FileName || "Document",
    fileName: raw.fileName || raw.FileName || raw.name || "document.pdf",
    src: src || undefined,
    blobKey: blobKey || undefined,
    container: container || undefined,
  };
}
function cipSnapshotDocIsOpenable(doc) {
  return !!(doc && (doc.src || doc.dataUri || (doc.blobKey && doc.container)));
}
function cipProposalDocumentForCase(c, trackerProposal) {
  const fromPayload = cipSnapshotDocFromPayload(c && c.awardPayload && c.awardPayload.proposalDocument);
  if (fromPayload) return fromPayload;
  if (typeof trkBuildProposalDocument !== "function") return null;
  if (trackerProposal) return trkBuildProposalDocument(trackerProposal);
  return trkBuildProposalDocument({
    proposalNumber: (c && (c.proposalNumber || c.proposalId)) || "",
    aribaId: (c && c.awardPayload && c.awardPayload.aribaId) || "",
    title: (c && c.title) || "",
    ownerName: (c && (c.requestor || c.procurement)) || "",
    jobsite: (c && c.jobsite) || "",
    commodity: (c && c.awardPayload && c.awardPayload.commodity) || "",
    amount: (c && (c.proposalTotalValue || c.value)) || 0,
    currency: "IDR",
    requirementDate: (c && c.requirementDate) || "",
  });
}
function cipNegotiationDocumentForCase(c, trackerProposal) {
  const live = cipTrackerVendorStepDoc(trackerProposal, c && c.vendorId, typeof trkIsNegotiationActivity === "function" ? trkIsNegotiationActivity : null);
  if (live) return live;
  const source = String((c && c.awardPayload && c.awardPayload.source) || "").toLowerCase();
  if (source.includes("nego")) return cipSnapshotDocFromPayload(c && c.awardPayload && c.awardPayload.awardSourceDocument);
  return null;
}
function cipWinnerBidDocumentForCase(c, trackerProposal) {
  const live = cipTrackerSharedBidEvalWinnerProof(trackerProposal);
  if (live) return live;
  return cipSnapshotDocFromPayload(c && c.awardPayload && c.awardPayload.winnerBidDocument);
}
function cipAwardSourceLabel(c) {
  const payload = c && c.awardPayload && c.awardPayload.source;
  if (payload) return payload;
  const raw = String((c && c.source) || "").replace(/^tracker-/i, "");
  if (raw && raw.toLowerCase() !== "award") return raw;
  return "—";
}
function cipAwardSnapshotFieldsForCase(c, tt) {
  const L = cipLoaFor(c);
  const trackerProposal = cipTrackerProposalForCase(c);
  const method = c && (c.method || (c.awardPayload && c.awardPayload.method));
  let awardValue = (c && c.value) || (L && L.value);
  let awardPct = (c && c.awardPercent) || (L && L.awardPercent) || 100;
  if (trackerProposal && typeof trkAwardSplitsForWinners === "function") {
    const bidActivity = (trackerProposal.activities || []).find((row) => typeof trkIsBidEvaluationActivity === "function" && trkIsBidEvaluationActivity(row));
    const bid = bidActivity && typeof trkLoadBidEvalState === "function"
      ? trkBidEvalForActivity(trkLoadBidEvalState(trackerProposal), bidActivity.id)
      : { winnerVendorIds: [], winnerValues: {} };
    const winnerIds = (bid.winnerVendorIds && bid.winnerVendorIds.length)
      ? bid.winnerVendorIds
      : (c && c.vendorId ? [c.vendorId] : []);
    const split = trkAwardSplitsForWinners(trackerProposal, winnerIds, bid.winnerValues).find((row) =>
      (c && c.vendorId && String(row.vendorId).toLowerCase() === String(c.vendorId).toLowerCase())
      || (c && c.vendor && String(row.vendorName || "").toLowerCase() === String(c.vendor).toLowerCase()));
    if (split) {
      awardValue = split.value;
      awardPct = split.percent;
    }
  }
  return {
    proposal: {
      label: tt("Proposal No", "No. Proposal"),
      value: (c && (c.proposalNumber || c.proposalId)) || (trackerProposal && (trackerProposal.proposalNumber || trackerProposal.id)) || "—",
      doc: cipProposalDocumentForCase(c, trackerProposal),
      tip: tt("Preview proposal document", "Preview dokumen proposal"),
    },
    awardedTo: {
      label: tt("Awarded to", "Diberikan kepada"),
      value: (L && L.to) || (c && c.vendor) || "—",
      doc: cipNegotiationDocumentForCase(c, trackerProposal),
      tip: tt("Preview Negotiation document", "Preview dokumen Negotiation"),
    },
    subject: {
      label: tt("Subject", "Perihal"),
      value: (trackerProposal && trackerProposal.title) || (L && L.subject) || (c && c.title) || "—",
    },
    awardSource: {
      label: tt("Award source", "Sumber award"),
      value: cipAwardSourceLabel(c),
      doc: cipWinnerBidDocumentForCase(c, trackerProposal),
      tip: tt("Preview Bid Evaluation winner document (one file names every winner)", "Preview dokumen pemenang Bid Evaluation (satu file untuk semua pemenang)"),
    },
    awardValue: {
      label: tt("Award value", "Nilai award"),
      value: trkRp(awardValue),
    },
    awardSplit: {
      label: tt("Award split", "Porsi award"),
      value: `${awardPct}%`,
    },
    method: {
      label: tt("Procurement method", "Metode pengadaan"),
      value: method || (trackerProposal && trackerProposal.trackerMethod) || "—",
    },
    jobsite: {
      label: tt("Jobsite", "Jobsite"),
      value: (c && c.jobsite) || (L && L.jobsite) || (trackerProposal && trackerProposal.jobsite) || "—",
    },
  };
}
function CipAwardSnapshotGrid({ fields, onPreview }) {
  const C = useC();
  const cell = (field, style) => {
    const hasDoc = Object.prototype.hasOwnProperty.call(field, "doc");
    const value = hasDoc
      ? cipSnapshotValueWithDoc(field.value, field.doc, field.tip, onPreview, field.tip)
      : (field.value || "—");
    return (
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSoft}`, minWidth: 0, ...style }}>
        <div style={{ fontSize: 10.6, color: C.textMuted, fontWeight: 550 }}>{field.label}</div>
        <div style={{ fontSize: 12.4, color: C.text, fontWeight: 550, marginTop: 4, lineHeight: 1.45, whiteSpace: "normal", overflowWrap: "anywhere" }}>{value}</div>
      </div>
    );
  };
  const vSplit = { borderRight: `1px solid ${C.borderSoft}` };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        {cell(fields.proposal, vSplit)}
        {cell(fields.awardedTo)}
      </div>
      <div>{cell(fields.subject)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 35fr) minmax(0, 45fr) minmax(0, 20fr)" }}>
        {cell(fields.awardSource, vSplit)}
        {cell(fields.awardValue, vSplit)}
        {cell(fields.awardSplit)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        {cell(fields.method, vSplit)}
        {cell(fields.jobsite)}
      </div>
    </div>
  );
}
function cipSnapshotValueWithDoc(value, doc, title, onPreview, tip) {
  const openable = cipSnapshotDocIsOpenable(doc);
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{value || "-"}</span>
      <IconButton
        size="sm"
        variant="secondary"
        name="file-search"
        title={tip || title}
        disabled={!openable}
        onClick={() => {
          if (!openable || !onPreview) return;
          onPreview({
            title: title || doc.title || doc.fileName || "Document",
            fileName: doc.fileName || doc.name || "document.pdf",
            src: doc.src || doc.dataUri,
            blobKey: doc.blobKey,
            container: doc.container,
          });
        }}
        style={{ width: 28, height: 28, flexShrink: 0 }}
      />
    </span>
  );
}

function cipFormatIdrInput(value) {
  const digits = String(value == null ? "" : value).replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}
function cipParseIdrInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits ? Number(digits) : "";
}

function cipLooksLikeCaseKeyTitle(value, c) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (typeof trkIsCipCaseKey === "function" && trkIsCipCaseKey(raw)) return true;
  const caseId = String((c && (c.id || c.caseKey)) || "").trim();
  return !!(caseId && raw.toLowerCase() === caseId.toLowerCase());
}
function cipTermsheetPreferredTitle(c) {
  const trackerProposal = cipTrackerProposalForCase(c);
  const loa = typeof cipLoaFor === "function" ? cipLoaFor(c) : null;
  const candidates = [
    trackerProposal && trackerProposal.title,
    loa && loa.subject,
    c && c.title,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = String(candidates[i] || "").trim();
    if (value && !cipLooksLikeCaseKeyTitle(value, c)) return value;
  }
  return String((trackerProposal && trackerProposal.title) || (c && c.title) || "").trim();
}
function cipTermsheetOverrideSeed(c) {
  const payload = typeof cipBuildTermsheetPayload === "function" ? cipBuildTermsheetPayload(c, c && c.termsheetPayload) : {};
  const existing = String(payload.transaction || "").trim();
  const preferred = cipTermsheetPreferredTitle(c);
  const seed = {
    transaction: existing && !cipLooksLikeCaseKeyTitle(existing, c) ? existing : (preferred || existing),
    periodStart: payload.periodStart || "",
    periodEnd: payload.periodEnd || "",
    totalValueIdr: payload.totalValueIdr != null ? payload.totalValueIdr : ((c && c.value) || 0),
  };
  if (String(payload.termOfPayment || "").trim()) seed.termOfPayment = payload.termOfPayment;
  if (String(payload.paymentMethod || "").trim()) seed.paymentMethod = payload.paymentMethod;
  return seed;
}

function cipTermsheetGenerateTarget(c) {
  const seed = cipTermsheetOverrideSeed(c);
  const payload = cipBuildTermsheetPayload(c, { ...(c.termsheetPayload || {}), ...seed, totalValueIdr: Number(seed.totalValueIdr) || 0 });
  return {
    key: `termsheet-${c.id}-${Date.now()}`,
    case: c,
    payload,
    missing: cipTermsheetMissingFields(c, payload),
  };
}

function CIPTermSheetActivityPanel({ c, tt, lang, toast, isCurrent, canGenerate, canComplete, onComplete, activityNotes, noteDrafts, actorName: noteActorName, onNoteDraftChange, onPostNote, layout = "full" }) {
  const C = useC();
  const activeSession = useSession();
  const actorName = (activeSession && activeSession.actingUser && (activeSession.actingUser.name || activeSession.actingUser.fullName)) || noteActorName || c.procurement || c.requestor || "Officer Proposal Tracker";
  const officerCanGenerate = canGenerate == null ? cipCanGenerateTermSheet(activeSession, cipProposalForCase(c)) : !!canGenerate;
  const L = cipLoaFor(c);
  const legacyLoaSource = c.source === "tracker-loa" || c.stage === "loa" || !!c.loaNo;
  const generated = !!c.termsheetBlobKey || cipStageIdx(c.stage) > cipStageIdx("termsheet");
  const [gen, setGen] = React.useState(generated ? "done" : "idle");
  const [step, setStep] = React.useState(0);
  const [completeTarget, setCompleteTarget] = React.useState(null);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [previewDoc, setPreviewDoc] = React.useState(null);
  React.useEffect(() => setGen(generated ? "done" : "idle"), [c.id, c.termsheetBlobKey, c.stage]);
  const loaFileName = c.loaFileName || `LOA_${(c.loaNo || c.id || "CIP").replace(/\//g, "-")}.pdf`;
  const termsheetFileName = c.termsheetFileName || `Termsheet_${c.id}.pdf`;
  const P = cipBuildTermsheetPayload(c, c.termsheetPayload);
  const snapshotFields = cipAwardSnapshotFieldsForCase(c, tt);
  const winnerStatus = cipDetailActivityStatusForCase(c, "termsheet");
  const steps = [
    legacyLoaSource
      ? tt("Reading legacy LOA payload from Proposal Tracker...", "Membaca payload LOA lama dari Proposal Tracker...")
      : tt("Reading award result from Proposal Tracker...", "Membaca hasil award dari Proposal Tracker..."),
    tt("Mapping fields to Termsheet.ods...", "Memetakan field ke Termsheet.ods..."),
    tt("Applying Authorization master...", "Menerapkan master Authorization..."),
    tt("Composing the previewable PDF...", "Menyusun PDF yang bisa dipreview..."),
  ];
  const markTermSheetStage = () => {
    if (c.stage !== "loa") return;
    const at = trkNow();
    const historyBase = Array.isArray(c.activityHistory) ? c.activityHistory : cipStageHistoryRows(c);
    const history = historyBase.concat([
      { id: `cip-${c.id}-loa-auto-${Date.now()}`, type: "Completed", stageKey: "loa", at, actorName, message: "LOA data consumed from Proposal Tracker for Term Sheet generation." },
      { id: `cip-${c.id}-termsheet-start-${Date.now()}`, type: "Started", stageKey: "termsheet", at, actorName, message: legacyLoaSource ? "Generate Term Sheet from legacy LOA payload." : "Generate Term Sheet from approved award result." },
    ]);
    cipSetStage(c.id, "termsheet", { activityHistory: history });
  };
  const finishGeneration = (payload) => {
    setGen("running");
    setStep(0);
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        clearInterval(iv);
        markTermSheetStage();
        cipGenerateTermsheetDocument(c.id, payload).then((result) => {
          setGen("done");
          if (result.document) toast.push({ title: tt("Term Sheet generated", "Term Sheet berhasil digenerate"), description: result.document.fileName });
        }).catch((error) => {
          setGen("idle");
          toast.push({
            title: tt("Term Sheet generate failed", "Generate Term Sheet gagal"),
            description: (error && error.message) || tt("The PDF could not be saved.", "PDF tidak bisa disimpan."),
            tone: "error",
          });
        });
      } else {
        setStep(i);
      }
    }, 560);
  };
  const run = () => {
    if (!isCurrent || !officerCanGenerate) {
      toast.push({
        title: tt("Officer only", "Hanya Officer"),
        description: tt("Only the assigned Officer can generate Term Sheet.", "Hanya Officer yang ditunjuk yang boleh generate Term Sheet."),
        tone: "warning",
      });
      return;
    }
    setCompleteTarget(cipTermsheetGenerateTarget(c));
  };
  const handleCompleteMissing = (form) => {
    const payload = cipBuildTermsheetPayload(c, form);
    setCompleteTarget(null);
    finishGeneration(payload);
  };
  const generatedDate = c.termsheetGeneratedAt ? trkFmtDate(trkDatePart(c.termsheetGeneratedAt), lang) : "-";
  const winnerDone = winnerStatus === "Completed";
  const documentTile = generated ? (
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}` }}>
      <CIPDocumentTile
        title={tt("Term Sheet PDF", "PDF Term Sheet")}
        fileName={termsheetFileName}
        sourceLabel={tt("Generated", "Generated")}
        tone="brand"
        disabled={!c.termsheetBlobKey}
        onPreview={() => c.termsheetBlobKey && setPreviewDoc({ title: "Generated Term Sheet", fileName: termsheetFileName, blobKey: c.termsheetBlobKey, container: c.termsheetContainer })}
        actionLabel={tt("Preview Term Sheet PDF", "Preview PDF Term Sheet")}
        meta={[
          { label: tt("No", "No"), value: P.termsheetNo },
          { label: tt("Generated", "Generate"), value: generatedDate },
          { label: tt("Template", "Template"), value: CIP_TERMSHEET_TEMPLATE_META.odsFile },
        ]}
      />
    </div>
  ) : null;
  const actionFooter = gen === "running" ? (
    <div style={{ padding: 16, display: "grid", gap: 9 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: i <= step ? C.text : C.textSubtle, fontWeight: i === step ? 700 : 500 }}>
          {i < step ? <Icon name="check-circle-2" size={15} color={C.success} /> : i === step ? <Spinner size={14} color={C.ocean} /> : <Icon name="circle" size={14} color={C.border} />}
          {s}
        </div>
      ))}
    </div>
  ) : (
    <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", backgroundColor: C.surfaceAlt }}>
      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.45, minWidth: 220, flex: "1 1 280px" }}>
        {tt("Generate Term Sheet from this winner’s award result, then Complete Activity for this winner. The Term Sheet step stays Active until every winner is complete.", "Generate Term Sheet dari hasil award pemenang ini, lalu Complete Activity untuk pemenang ini. Step Term Sheet tetap Active sampai semua pemenang selesai.")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
        {isCurrent && officerCanGenerate && (
          <Button size="sm" iconLeft={generated ? "refresh-cw" : "sparkles"} onClick={run}>
            {generated ? tt("Regenerate Term Sheet", "Regenerate Term Sheet") : tt("Generate Term Sheet", "Generate Term Sheet")}
          </Button>
        )}
        {isCurrent && !officerCanGenerate && (
          <CipAssignedOfficerLockedAction
            tt={tt}
            label={generated ? tt("Regenerate Term Sheet", "Regenerate Term Sheet") : tt("Generate Term Sheet", "Generate Term Sheet")}
          />
        )}
        {!isCurrent && (
          <Button size="sm" iconLeft={generated ? "refresh-cw" : "sparkles"} disabled>
            {generated ? tt("Regenerate Term Sheet", "Regenerate Term Sheet") : tt("Generate Term Sheet", "Generate Term Sheet")}
          </Button>
        )}
        {officerCanGenerate && (
          <Button size="sm" iconLeft="check-circle-2" disabled={!canComplete} onClick={() => setCompleteOpen(true)}>{tt("Complete Activity", "Complete Activity")}</Button>
        )}
      </div>
    </div>
  );
  const winnerCard = (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: C.surface }}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: C.surfaceAlt, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.4, fontWeight: 700, color: C.text }}>{c.vendor || L.to || "—"}</div>
          <div style={{ fontSize: 11.4, color: C.textMuted }}>{[c.vendorId, c.id].filter(Boolean).join(" · ")}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {winnerDone ? <Badge tone="success" size="sm">{tt("Completed", "Selesai")}</Badge> : <Badge tone="info" size="sm">{tt("Active", "Aktif")}</Badge>}
          <Badge tone="success" size="sm"><Icon name="check-circle-2" size={11} />{tt("Validated in Proposal Tracker", "Valid di Proposal Tracker")}</Badge>
        </div>
      </div>
      <CipAwardSnapshotGrid fields={snapshotFields} onPreview={setPreviewDoc} />
      {documentTile}
      {actionFooter}
    </div>
  );
  const modals = (
    <>
      <CIPTermsheetDataModal target={completeTarget} onClose={() => setCompleteTarget(null)} onSubmit={handleCompleteMissing} />
      <CIPCompleteActivityModal
        open={completeOpen}
        title={tt("Term Sheet", "Term Sheet")}
        subtitle={tt("Term Sheet activity", "Aktivitas Term Sheet")}
        defaultRemark={legacyLoaSource
          ? tt("Term Sheet generated and reviewed from approved legacy Proposal Tracker LOA data.", "Term Sheet sudah digenerate dan direview dari data LOA lama Proposal Tracker yang valid.")
          : tt("Term Sheet generated and reviewed from the approved Proposal Tracker award result.", "Term Sheet sudah digenerate dan direview dari hasil award Proposal Tracker yang disetujui.")}
        showCompleteDate
        onClose={() => setCompleteOpen(false)}
        onSubmit={(remark, completedAt) => { setCompleteOpen(false); onComplete && onComplete(remark, completedAt); }}
      />
      <CIPDocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  );
  if (layout === "winner") {
    return (
      <>
        {winnerCard}
        {modals}
      </>
    );
  }
  return (
    <>
      <div style={{ display: "grid", gap: 14 }}>
        {legacyLoaSource ? (
          <CIPDocumentTile
            title={tt("Letter of Award (legacy source)", "Letter of Award (sumber lama)")}
            fileName={loaFileName}
            sourceLabel={tt("From Proposal Tracker", "Dari Proposal Tracker")}
            tone="success"
            disabled={!c.loaDataUri && !c.loaBlobKey}
            onPreview={() => c.loaBlobKey
              ? setPreviewDoc({ title: "Letter of Award", fileName: loaFileName, blobKey: c.loaBlobKey, container: c.loaContainer })
              : c.loaDataUri && setPreviewDoc({ title: "Letter of Award", fileName: loaFileName, src: c.loaDataUri })}
            actionLabel={tt("Preview LOA PDF", "Preview PDF LOA")}
            meta={[
              { label: tt("Proposal", "Proposal"), value: c.proposalNumber },
              { label: tt("Issued", "Terbit"), value: trkFmtDate(L.date, lang) },
              { label: tt("Source", "Sumber"), value: "Proposal Tracker LOA Step" },
            ]}
          />
        ) : (
          <Alert tone="info" title={tt("Award Result from Proposal Tracker", "Hasil Award dari Proposal Tracker")} description={tt("The winning vendor and commercial result are the approved source for this Term Sheet. LOA is produced later, in parallel with Contract.", "Vendor pemenang dan hasil komersial menjadi sumber resmi Term Sheet ini. LOA dibuat setelahnya, secara paralel dengan Contract.")} />
        )}
        {winnerCard}
      </div>
      <CIPStepNotesPanel
        stage={CIP_STAGE.termsheet}
        notes={(activityNotes && activityNotes.termsheet) || []}
        draft={(noteDrafts && noteDrafts.termsheet) || ""}
        actorName={actorName}
        onDraftChange={onNoteDraftChange}
        onPostNote={onPostNote}
        defaultExpanded={true}
      />
      {modals}
    </>
  );
}

/* ---------- 1. Award result from Proposal Tracker (legacy loa stage remains readable) ---------- */
function CIPLoaPanel({ c, tt, lang, isCurrent, onAdvance }) {
  const C = useC();
  const L = cipLoaFor(c);
  const legacyLoaSource = c.source === "tracker-loa" || !!c.loaNo;
  const [previewDoc, setPreviewDoc] = React.useState(null);
  const rows = [
    [tt("LOA number", "Nomor LOA"), <span style={{ fontFamily: "monospace", fontSize: 12 }}>{L.number}</span>, "tracker"],
    [tt("Issued date", "Tanggal terbit"), trkFmtDate(L.date, lang), "tracker"],
    [tt("Awarded to", "Diberikan kepada"), L.to, "tracker"],
    [tt("Vendor address", "Alamat vendor"), L.vendorAddress, "vendor"],
    [tt("Subject", "Perihal"), L.subject, "tracker"],
    [tt("Award value", "Nilai award"), <b>{trkRp(L.value)}</b>, "tracker"],
    [tt("Award split", "Porsi award"), `${L.awardPercent || 100}%`, "tracker"],
    [tt("Jobsite", "Jobsite"), L.jobsite, "tracker"],
    [tt("Attachment", "Lampiran"), L.attachmentDescription, "tracker"],
    [tt("SIS signatory", "Penandatangan SIS"), L.sisSignatoryName, "tracker"],
    [tt("Vendor director", "Direktur vendor"), L.vendorDirectorName, "tracker"],
  ];
  const loaFileName = c.loaFileName || `LOA_${(c.loaNo || c.id || "CIP").replace(/\//g, "-")}.pdf`;
  // The Proposal Tracker LOA lives in Blob (loaBlobKey/loaContainer); older cases may still carry a base64 dataUri.
  const loaHasDoc = !!(c.loaBlobKey || c.loaDataUri);
  const preview = () => {
    if (c.loaBlobKey) {
      setPreviewDoc({ title: "Letter of Award", fileName: loaFileName, blobKey: c.loaBlobKey, container: c.loaContainer });
      return;
    }
    if (c.loaDataUri) setPreviewDoc({ title: "Letter of Award", fileName: loaFileName, src: c.loaDataUri });
  };
  return (
    <>
      <DetailCard
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{legacyLoaSource ? tt("Letter of Award from Proposal Tracker", "Letter of Award dari Proposal Tracker") : tt("Award Result from Proposal Tracker", "Hasil Award dari Proposal Tracker")}<CipSourceChip kind="tracker" size="sm" /></span>}
        subtitle={legacyLoaSource
          ? tt("Legacy case: the LOA document and structured payload are consumed from Proposal Tracker.", "Kasus lama: dokumen LOA dan payload terstruktur dipakai dari Proposal Tracker.")
          : tt("The winning vendor and commercial result come from this proposal. LOA is issued later, in parallel with Contract.", "Vendor pemenang dan hasil komersial berasal dari proposal ini. LOA diterbitkan kemudian, paralel dengan Contract.")}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.72fr) minmax(320px, 1.28fr)", gap: 14 }} className="cip-split">
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <CIPDocumentTile
              title={tt("Letter of Award", "Letter of Award")}
              fileName={loaFileName}
              sourceLabel={tt("From Proposal Tracker", "Dari Proposal Tracker")}
              tone="success"
              disabled={!loaHasDoc}
              onPreview={preview}
              actionLabel={tt("Preview LOA PDF", "Preview LOA PDF")}
              meta={[
                { label: tt("Proposal", "Proposal"), value: c.proposalNumber },
                { label: tt("Issued", "Terbit"), value: trkFmtDate(L.date, lang) },
                { label: tt("Source", "Sumber"), value: legacyLoaSource ? "Proposal Tracker LOA Step" : "Proposal Tracker award" },
              ]}
            />
            <Alert tone="info"
              title={tt("Ready for Term Sheet generation", "Siap untuk generate Term Sheet")}
              description={legacyLoaSource
                ? tt("This legacy LOA is the approved source from the proposal, including vendor, award value, split percentage, and the original previewable PDF.", "LOA lama ini adalah sumber resmi dari proposal, termasuk vendor, nilai award, persentase split, dan PDF asli yang bisa dipreview.")
                : tt("This award result is the approved source from the proposal, including vendor, award value, and split percentage. LOA is produced later, in parallel with Contract.", "Hasil award ini adalah sumber resmi dari proposal, termasuk vendor, nilai award, dan persentase split. LOA dibuat kemudian, paralel dengan Contract.")}
            />
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: C.surface }}>
            <div style={{ padding: "11px 14px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: C.surfaceAlt }}>
              <div>
                <div style={{ fontSize: 12.8, color: C.text, fontWeight: 550 }}>{legacyLoaSource ? tt("LOA Data Snapshot", "Snapshot Data LOA") : tt("Award Data Snapshot", "Snapshot Data Award")}</div>
                <div style={{ fontSize: 11.4, color: C.textSubtle }}>{legacyLoaSource ? tt("Same payload used by Proposal Tracker LOA preview.", "Payload yang sama dengan preview LOA di Proposal Tracker.") : tt("Same award payload used to generate the Term Sheet.", "Payload award yang sama dipakai untuk generate Term Sheet.")}</div>
              </div>
              <Badge tone="success"><Icon name="check-circle-2" size={11} />{tt("Validated in Proposal Tracker", "Valid di Proposal Tracker")}</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }} className="cip-split">
              {rows.map(([l, v, src], i) => (
                <div key={i} style={{ padding: "10px 12px", borderRight: i % 2 === 0 ? `1px solid ${C.borderSoft}` : "none", borderBottom: i < rows.length - 2 ? `1px solid ${C.borderSoft}` : "none", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 10.6, color: C.textMuted, fontWeight: 550 }}>{l}</span>
                    <CipSourceChip kind={src} size="sm" />
                  </div>
                  <div style={{ fontSize: 12.5, color: C.text, fontWeight: 550, marginTop: 3, lineHeight: 1.4, wordBreak: "break-word" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <CipActions note={legacyLoaSource
          ? tt("Next action uses the legacy LOA payload to populate the Term Sheet template.", "Aksi berikutnya memakai payload LOA lama untuk mengisi template Term Sheet.")
          : tt("Next action uses the award payload to populate the Term Sheet template.", "Aksi berikutnya memakai payload award untuk mengisi template Term Sheet.")}>
          <Button iconLeft="sparkles" disabled={!isCurrent} onClick={onAdvance}>{tt("Generate Term Sheet", "Generate Term Sheet")}</Button>
        </CipActions>
      </DetailCard>
      <CIPDocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  );
}

/* ---------- 2. Data verification ---------- */
function CIPVerifyPanel({ c, tt, lang, isCurrent, onAdvance }) {
  const C = useC();
  const L = cipLoaFor(c);
  const fields = [
    { label: tt("Vendor name", "Nama vendor"), value: c.vendor, src: "tracker" },
    { label: tt("Vendor address", "Alamat vendor"), value: c.lead ? L.vendorAddress : tt("Verified vendor master record", "Data master vendor terverifikasi"), src: "vendor" },
    { label: tt("Bank account", "Rekening bank"), value: c.lead ? "Bank Mandiri Cab. Tanjung — 031-00-2355961-3" : tt("From verified vendor profile", "Dari profil vendor terverifikasi"), src: "vendor" },
    { label: tt("Scope of work", "Ruang lingkup"), value: L.scope, src: "tracker" },
    { label: tt("Jobsite / location", "Jobsite / lokasi"), value: L.jobsite, src: "tracker" },
    { label: tt("Contract period", "Jangka waktu"), value: c.lead ? `${trkFmtDate(L.periodStart, lang)} – ${trkFmtDate(L.periodEnd, lang)} (${L.durationMonths} ${tt("months", "bulan")})` : `${L.durationMonths} ${tt("months from effective date", "bulan sejak tanggal efektif")}`, src: "tracker" },
    { label: tt("Contract value", "Nilai kontrak"), value: trkRp(c.value), src: "tracker" },
    { label: tt("Requestor", "Requestor"), value: c.requestor, src: "tracker" },
  ];
  return (
    <DetailCard title={tt("Data verification", "Verifikasi data")}
      subtitle={tt("The award payload arrives structured from Proposal Tracker; vendor details are matched against the Vendor Database. Confirm before generating.", "Payload award tiba terstruktur dari Proposal Tracker; data vendor dicocokkan dengan Vendor Database. Konfirmasi sebelum generate.")}
      action={<Badge tone="success"><Icon name="shield-check" size={11} />{tt("All fields matched", "Semua field cocok")}</Badge>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {fields.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderRadius: RADIUS.md, border: `1px solid ${C.borderSoft}`, backgroundColor: C.surface }}>
            <Icon name="check-circle-2" size={15} color={C.success} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{f.label}</span>
                <CipSourceChip kind={f.src} size="sm" />
              </div>
              <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, marginTop: 2, lineHeight: 1.4 }}>{f.value}</div>
            </div>
          </div>
        ))}
      </div>
      <CipActions note={tt("Vendor Database Integration — bank, address & licenses auto-matched.", "Integrasi Vendor Database — rekening, alamat & legalitas tercocok otomatis.")}>
        <Button iconLeft="check" disabled={!isCurrent} onClick={onAdvance}>{tt("Confirm data → generate Termsheet", "Konfirmasi data → generate Termsheet")}</Button>
      </CipActions>
    </DetailCard>
  );
}

/* ---------- 3. Termsheet (with generation moment) ---------- */
function CIPTermsheetPanel({ c, tt, lang, toast, isCurrent, onAdvance }) {
  const C = useC();
  const session = useSession();
  const officerCanGenerate = cipCanGenerateTermSheet(session, cipProposalForCase(c));
  const canAct = isCurrent && officerCanGenerate;
  const generated = !!c.termsheetBlobKey || cipStageIdx(c.stage) > cipStageIdx("termsheet");
  const [gen, setGen] = React.useState(generated ? "done" : "idle"); // idle | running | done
  const [step, setStep] = React.useState(0);
  const [completeTarget, setCompleteTarget] = React.useState(null);
  const [previewDoc, setPreviewDoc] = React.useState(null);
  const steps = [
    tt("Reading award result from Proposal Tracker…", "Membaca hasil award dari Proposal Tracker…"),
    tt("Mapping fields to Termsheet.ods…", "Memetakan field ke Termsheet.ods…"),
    tt("Applying Authorization master…", "Menerapkan master Authorization…"),
    tt("Composing the previewable PDF…", "Menyusun PDF yang bisa dipreview…"),
  ];
  React.useEffect(() => {
    if (generated) setGen("done");
    else setGen("idle");
  }, [c.id, c.termsheetBlobKey, c.stage]);
  const finishGeneration = (payload) => {
    setGen("running"); setStep(0);
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        clearInterval(iv);
        cipGenerateTermsheetDocument(c.id, payload).then((result) => {
          setGen("done");
          if (result.document) toast.push({ title: tt("Termsheet generated", "Termsheet berhasil digenerate"), description: result.document.fileName });
        }).catch((error) => {
          setGen("idle");
          toast.push({
            title: tt("Termsheet generate failed", "Generate Termsheet gagal"),
            description: (error && error.message) || tt("The PDF could not be saved.", "PDF tidak bisa disimpan."),
            tone: "error",
          });
        });
      }
      else setStep(i);
    }, 600);
  };
  const run = () => {
    if (!canAct) {
      toast.push({
        title: tt("Officer only", "Hanya Officer"),
        description: tt("Only the assigned Officer can generate Term Sheet.", "Hanya Officer yang ditunjuk yang boleh generate Term Sheet."),
        tone: "warning",
      });
      return;
    }
    setCompleteTarget(cipTermsheetGenerateTarget(c));
  };
  const handleComplete = (form) => {
    const payload = cipBuildTermsheetPayload(c, form);
    setCompleteTarget(null);
    finishGeneration(payload);
  };
  const P = cipBuildTermsheetPayload(c, c.termsheetPayload);
  const TS = cipTermsheetFor(c);
  const total = TS.lineItems.reduce((s, it) => s + it.monthly * it.qty, 0);
  const auth = P.authorization;

  if (gen !== "done") {
    return (
      <>
      <DetailCard title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{tt("Generate Termsheet", "Generate Termsheet")}<CipSourceChip kind="ai" size="sm" /></span>}
        subtitle={tt("The platform fills the supplied Termsheet.ods structure, then applies the Authorization master for the signer list.", "Platform mengisi struktur Termsheet.ods yang diberikan, lalu menerapkan master Authorization untuk daftar penandatangan.")}>
        <div style={{ padding: "34px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          <span style={{ width: 64, height: 64, borderRadius: RADIUS.lg, background: CIP_HERO_GRAD, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", ...(gen === "running" ? { animation: "cipPulse 1.2s ease-in-out infinite" } : {}) }}>
            <Icon name="sparkles" size={30} color="#fff" />
          </span>
          {gen === "idle" ? (
            <>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{tt("Ready to generate", "Siap generate")}</div>
              <div style={{ fontSize: 12.5, color: C.textMuted, maxWidth: 520 }}>
                {CIP_TERMSHEET_TEMPLATE_META.odsFile} · {CIP_TERMSHEET_TEMPLATE_META.sheet} · {auth.band.code}. {tt("Generate opens a popup to confirm title, period, estimated cost, Term of Payment, and payment method.", "Generate membuka popup untuk konfirmasi judul, jangka waktu, estimasi biaya, Term of Payment, dan Cara Pembayaran.")}
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}>
                <Badge tone="brand"><Icon name="shield-check" size={11} />{auth.signers.length} {tt("authorized signers", "penandatangan")}</Badge>
                <Badge tone="success"><Icon name="check" size={11} />{tt("Award payload ready", "Payload award siap")}</Badge>
              </div>
              <Button iconLeft="sparkles" size="lg" disabled={!canAct} onClick={run}>{tt("Generate Termsheet", "Generate Termsheet")}</Button>
            </>
          ) : (
            <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 9 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: i <= step ? C.text : C.textSubtle, fontWeight: i === step ? 700 : 500 }}>
                  {i < step ? <Icon name="check-circle-2" size={15} color={C.success} /> : i === step ? <Spinner size={14} color={C.ocean} /> : <Icon name="circle" size={14} color={C.border} />}
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </DetailCard>
      <CIPTermsheetDataModal target={completeTarget} onClose={() => setCompleteTarget(null)} onSubmit={handleComplete} />
      </>
    );
  }

  const termsheetFileName = c.termsheetFileName || `Termsheet_${c.id}.pdf`;
  const previewTermsheet = () => {
    if (!c.termsheetBlobKey) {
      toast.push({ title: tt("Generate first", "Generate dulu"), description: tt("The PDF will be available after generation.", "PDF tersedia setelah generate."), tone: "warning" });
      return;
    }
    setPreviewDoc({ title: "Generated Term Sheet", fileName: termsheetFileName, blobKey: c.termsheetBlobKey, container: c.termsheetContainer });
  };
  return (
    <>
      <DetailCard
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{tt("Generated Term Sheet", "Term Sheet hasil generate")}<CipSourceChip kind="ai" size="sm" /></span>}
        subtitle={tt("Generated from the Proposal Tracker award result and Authorization Master. Preview opens in a modal window.", "Digenerate dari hasil award Proposal Tracker dan Authorization Master. Preview dibuka lewat modal window.")}
        action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" size="sm" iconLeft="refresh-cw" disabled={!canAct} onClick={run}>{tt("Regenerate", "Regenerate")}</Button>
          <Button size="sm" iconLeft="check" disabled={!canAct} onClick={onAdvance}>{tt("Complete Term Sheet", "Complete Term Sheet")}</Button>
        </div>}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.72fr) minmax(320px, 1.28fr)", gap: 14 }} className="cip-split">
          <CIPDocumentTile
            title={tt("Term Sheet PDF", "PDF Term Sheet")}
            fileName={termsheetFileName}
            sourceLabel={tt("Generated", "Generated")}
            tone="brand"
            disabled={!c.termsheetBlobKey}
            onPreview={previewTermsheet}
            actionLabel={tt("Preview Term Sheet PDF", "Preview PDF Term Sheet")}
              meta={[
                { label: tt("No", "No"), value: P.termsheetNo },
              { label: tt("Generated", "Generate"), value: c.termsheetGeneratedAt ? trkFmtDate(trkDatePart(c.termsheetGeneratedAt), lang) : "-" },
                { label: tt("Template", "Template"), value: CIP_TERMSHEET_TEMPLATE_META.odsFile },
              ]}
          />
          <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, overflow: "hidden" }}>
            <div style={{ padding: "11px 14px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12.8, color: C.text, fontWeight: 550 }}>{tt("Generation Summary", "Ringkasan Generate")}</div>
                <div style={{ fontSize: 11.4, color: C.textSubtle }}>{tt("Only the output file is shown here. Open preview to inspect the document.", "Di halaman ini cukup output file. Klik preview untuk inspeksi dokumen.")}</div>
              </div>
              <Badge tone="success"><Icon name="check-circle-2" size={11} />{tt("Ready", "Ready")}</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }} className="cip-split">
              {[
                [c.loaNo ? tt("LOA number", "Nomor LOA") : tt("Award source", "Sumber award"), c.loaNo || c.proposalNumber || (c.awardPayload && c.awardPayload.source) || "Proposal Tracker"],
                [tt("Vendor", "Vendor"), c.vendor],
                [tt("Award value", "Nilai award"), trkRp(c.value)],
                [tt("Authorization band", "Band authorization"), auth.band.code],
                [tt("Signers", "Penandatangan"), `${auth.signers.length} ${tt("person(s)", "orang")}`],
                [tt("Term Sheet no", "No Term Sheet"), P.termsheetNo],
              ].map(([label, value], index) => (
                <div key={index} style={{ padding: "10px 12px", borderRight: index % 2 === 0 ? `1px solid ${C.borderSoft}` : "none", borderBottom: index < 4 ? `1px solid ${C.borderSoft}` : "none", minWidth: 0 }}>
                  <div style={{ fontSize: 10.6, color: C.textMuted, fontWeight: 550 }}>{label}</div>
                  <div style={{ marginTop: 3, fontSize: 12.5, color: C.text, fontWeight: 550, lineHeight: 1.4, wordBreak: "break-word" }}>{value || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DetailCard>
      <CIPTermsheetDataModal target={completeTarget} onClose={() => setCompleteTarget(null)} onSubmit={handleComplete} />
      <CIPDocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  );

  /* paper preview */
  const secHead = (n, title) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px", paddingBottom: 5, borderBottom: "2px solid #013B52" }}>
      <span style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: "#013B52", color: "#fff", fontSize: 11, fontWeight: 550, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.fontFamily }}>{n}</span>
      <span style={{ fontSize: 13, fontWeight: 550, letterSpacing: "0.04em", textTransform: "uppercase" }}>{title}</span>
    </div>
  );
  const oList = (arr) => <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 5 }}>{arr.map((x, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.55 }}>{x}</li>)}</ol>;
  const fieldRow = (label, value, tall) => (
    <tr>
      <td style={{ padding: tall ? "8px 8px 8px 0" : "5px 8px 5px 0", width: 190, verticalAlign: "top", fontWeight: 600 }}>{label}</td>
      <td style={{ padding: tall ? "8px 0" : "5px 0", verticalAlign: "top" }}>: <CipMerged>{value || "-"}</CipMerged></td>
    </tr>
  );
  const check = (active, label) => <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 12, fontWeight: 600 }}>{active ? "☒" : "☐"} {label}</span>;

  return (
    <>
    <DetailCard
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{tt("Generated Termsheet", "Termsheet hasil generate")}<CipSourceChip kind="ai" size="sm" /></span>}
      subtitle={tt("Generated from the supplied Termsheet template and the Authorization master.", "Digenerate dari template Termsheet yang diberikan dan master Authorization.")}
      action={<div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" size="sm" iconLeft="eye" onClick={() => c.termsheetBlobKey ? cipResolveDocumentUrl({ blobKey: c.termsheetBlobKey, container: c.termsheetContainer }).then((u) => u && window.open(u, "_blank")).catch(() => {}) : toast.push({ title: tt("Generate first", "Generate dulu"), description: tt("The PDF will be available after generation.", "PDF tersedia setelah generate."), tone: "warning" })}>{tt("Open PDF", "Buka PDF")}</Button>
        <Button variant="secondary" size="sm" iconLeft="refresh-cw" disabled={!canAct} onClick={run}>{tt("Regenerate", "Regenerate")}</Button>
        <Button size="sm" iconLeft="check" disabled={!canAct} onClick={onAdvance}>{tt("Approve → choose template", "Setujui → pilih template")}</Button>
      </div>}>
      <div style={{ ...CIP_PAPER, padding: "26px 30px" }} className="cip-fade-up">
        <div style={{ textAlign: "center", borderBottom: "3px double #22333B", paddingBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 550, letterSpacing: "0.06em" }}>{CIP_TERMSHEET_TEMPLATE_META.title}</div>
          <div style={{ fontSize: 12, marginTop: 3 }}>{CIP_TERMSHEET_TEMPLATE_META.company}</div>
          <div style={{ fontSize: 11, marginTop: 2, fontFamily: "monospace" }}>{P.termsheetNo}</div>
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
          <span style={{ fontWeight: 550 }}>Jenis Pengadaan</span>
          <span>:</span>
          {check(P.procurementKind === "Barang", "Barang")}
          {check(P.procurementKind === "Jasa", "Jasa")}
          <span style={{ marginLeft: "auto", fontWeight: 550 }}>Value: Xv <CipMerged>{P.bandCode}</CipMerged></span>
        </div>

        {secHead("1", "Persetujuan Transaksi")}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {fieldRow("Transaksi", P.transaction)}
            {fieldRow("Counterpart", P.counterpart)}
            {fieldRow("Total Nilai Transaksi", P.totalValueText)}
            {fieldRow("Jangka Waktu Pengadaan", P.periodText)}
            {fieldRow("Proses Penunjukan", P.processType)}
            {fieldRow("Term of Payment", P.termOfPayment)}
            {fieldRow("Cara Pembayaran", P.paymentMethod)}
            {fieldRow("Ruang Lingkup Transaksi", P.scope, true)}
            {fieldRow("Lampiran Form", P.attachmentNote, true)}
            {fieldRow("Hukum Yang Berlaku", P.governingLaw)}
            {fieldRow("Keterangan", P.businessNotes, true)}
          </tbody>
        </table>

        {secHead("2", "Matrix Authorization Term Sheet")}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Badge tone="brand"><Icon name="badge-dollar-sign" size={11} />{P.bandLabel}</Badge>
          <Badge tone="neutral">USD {auth.usdValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}</Badge>
          <span style={{ fontSize: 11, color: "#5D6B72" }}>1 USD = IDR {auth.rate.toLocaleString("id-ID")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
          {auth.signers.map((s, i) => (
            <div key={s.key} style={{ border: "1px solid #9AA8AE", borderRadius: 6, padding: 10, minHeight: 86 }}>
              <div style={{ fontSize: 10.5, fontWeight: 550, color: "#0F5D6C", textTransform: "uppercase" }}>{i === 0 ? "Disiapkan oleh" : s.group === "submitted" ? "Diperiksa & diajukan oleh" : "Diketahui & disetujui oleh"}</div>
              <div style={{ marginTop: 10, fontSize: 12.2, fontWeight: 550 }}>{s.defaultName}</div>
              <div style={{ fontSize: 10.8, lineHeight: 1.35 }}>{s.defaultTitle}</div>
              <div style={{ marginTop: 8, fontSize: 10.5, color: "#5D6B72" }}>Tanggal :</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.8, color: "#5D6B72", marginTop: 8 }}>Notes: Disesuaikan dengan matrix authorization dan struktur organisasi yang berlaku.</div>

        {secHead("3", "Lampiran Detail")}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {TS.commercial.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: "5px 8px 5px 0", width: 190, verticalAlign: "top", fontWeight: 600 }}>{r.label}</td>
                <td style={{ padding: "5px 0", verticalAlign: "top" }}>: <CipMerged>{r.value}</CipMerged></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11.5, fontWeight: 550, margin: "12px 0 6px", letterSpacing: "0.04em" }}>DAFTAR BIAYA JASA</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, border: "1px solid #9AA8AE" }}>
          <thead><tr style={{ backgroundColor: "#EEF3F4" }}>
            {["No", tt("Description", "Deskripsi Jasa"), tt("Monthly Rate", "Harga/Bulan"), "Qty (bln)", tt("Estimated Value", "Estimasi Nilai")].map((h, i) => (
              <th key={i} style={{ border: "1px solid #9AA8AE", padding: "6px 9px", textAlign: i >= 2 ? "right" : "left", fontWeight: 550 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {TS.lineItems.map((it, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #9AA8AE", padding: "6px 9px" }}>{i + 1}</td>
                <td style={{ border: "1px solid #9AA8AE", padding: "6px 9px" }}>{it.desc}</td>
                <td style={{ border: "1px solid #9AA8AE", padding: "6px 9px", textAlign: "right" }}>{trkRp(it.monthly)}</td>
                <td style={{ border: "1px solid #9AA8AE", padding: "6px 9px", textAlign: "right" }}>{it.qty}</td>
                <td style={{ border: "1px solid #9AA8AE", padding: "6px 9px", textAlign: "right", fontWeight: 600 }}>{trkRp(it.monthly * it.qty)}</td>
              </tr>
            ))}
            <tr style={{ backgroundColor: "#EEF3F4" }}>
              <td colSpan={4} style={{ border: "1px solid #9AA8AE", padding: "6px 9px", fontWeight: 550 }}>Grand Total</td>
              <td style={{ border: "1px solid #9AA8AE", padding: "6px 9px", textAlign: "right", fontWeight: 550 }}><CipMerged>{trkRp(total)}</CipMerged></td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 550, marginBottom: 4, color: "#11713B" }}>{tt("Price includes", "Harga termasuk")}</div>
            {oList(TS.priceIncludes)}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 550, marginBottom: 4, color: "#C5341A" }}>{tt("Price excludes", "Harga belum termasuk")}</div>
            {oList(TS.priceExcludes)}
          </div>
        </div>

        {secHead("4", "Technical")}{oList(TS.technical)}
        {secHead("5", "Operations")}{oList(TS.operations)}
        {secHead("6", "Legal")}{oList(TS.legal)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 11, color: C.textSubtle }}>
        <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, backgroundColor: "rgba(15,130,138,0.16)", border: "1.5px solid rgba(15,130,138,0.55)" }} />
        {tt("Highlighted values were auto-filled from the Proposal Tracker award result & Vendor Database.", "Nilai yang disorot terisi otomatis dari hasil award Proposal Tracker & Vendor Database.")}
      </div>
    </DetailCard>
    <CIPTermsheetDataModal target={completeTarget} onClose={() => setCompleteTarget(null)} onSubmit={handleComplete} />
    </>
  );
}

function CIPTermsheetDataModal({ target, onClose, onSubmit }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const [form, setForm] = React.useState(() => target ? target.payload : {});
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!target) return;
    setForm(target.payload || {});
    setError("");
  }, [target && target.key]);
  if (!target) return null;
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const payload = cipBuildTermsheetPayload(target.case, form);
  const missing = cipTermsheetMissingFields(target.case, payload);
  const missingSet = new Set(missing.map((x) => x.key));
  const targetMissingSet = new Set(((target && target.missing) || []).map((x) => x.key));
  const headerKeys = ["transaction", "periodStart", "periodEnd", "businessNotes", "termOfPayment", "paymentMethod"];
  headerKeys.forEach((key) => targetMissingSet.add(key));
  const extraFields = CIP_TERMSHEET_TEMPLATE_FIELDS.filter((field) => targetMissingSet.has(field.key) && !headerKeys.includes(field.key));
  const fieldByKey = (key) => CIP_TERMSHEET_TEMPLATE_FIELDS.find((field) => field.key === key);
  const submit = () => {
    if (missing.length) {
      setError(tt(`${missing[0].en} is required.`, `${missing[0].id} wajib diisi.`));
      return;
    }
    onSubmit && onSubmit(form);
  };
  const control = (field) => {
    const common = { value: form[field.key] || "", onChange: (event) => set(field.key, event.target.value) };
    if (field.type === "textarea") return <Textarea rows={3} {...common} style={{ minHeight: 78 }} />;
    if (field.type === "select") {
      return (
        <select value={form[field.key] || ""} onChange={(event) => set(field.key, event.target.value)} style={{ ...FONT, width: "100%", height: 36, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.text, padding: "0 10px", outline: "none" }}>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }
    return <TextInput type={field.type === "date" ? "date" : "text"} {...common} />;
  };
  const renderField = (field, label, style, helper) => (
    <Field key={field.key} label={label} required={field.required} helper={helper || `${tt("Template row", "Baris template")} ${field.row}`} status={missingSet.has(field.key) ? "warning" : undefined} style={style}>
      {control(field)}
    </Field>
  );
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      width={840}
      icon="file-pen"
      title={tt("Generate Term Sheet", "Generate Term Sheet")}
      subtitle={`${(target.case && (target.case.proposalNumber || target.case.id)) || ""} - ${(target.case && (target.case.title || target.case.vendor)) || ""}`}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="sparkles" onClick={submit}>{tt("Generate Termsheet", "Generate Termsheet")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <Alert tone="warning" title={tt("Complete required data", "Lengkapi data wajib")} description={error} />}
        <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: C.surface }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, fontSize: 12.5, fontWeight: 700, color: C.text }}>
            {tt("Term Sheet Details", "Detail Term Sheet")}
          </div>
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {renderField(fieldByKey("transaction"), tt("Termsheet title", "Judul Termsheet"), { gridColumn: "1 / -1" })}
            {renderField(fieldByKey("periodStart"), tt("Period start", "Periode awal"))}
            {renderField(fieldByKey("periodEnd"), tt("Period end", "Periode akhir"))}
            <Field label={tt("Estimated cost", "Estimasi Biaya")} helper={tt("Default from the proposal / award value.", "Default dari nilai proposal / award.")} style={{ gridColumn: "1 / -1" }}>
              <TextInput
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={cipFormatIdrInput(form.totalValueIdr)}
                onChange={(event) => set("totalValueIdr", cipParseIdrInput(event.target.value))}
                style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              />
            </Field>
            {renderField(fieldByKey("termOfPayment"), tt("Term of Payment", "Term of Payment"), undefined, tt("Prefill can be edited before generate.", "Nilai awal bisa diubah sebelum generate."))}
            {renderField(fieldByKey("paymentMethod"), tt("Payment method", "Cara Pembayaran"), undefined, tt("Prefill can be edited before generate.", "Nilai awal bisa diubah sebelum generate."))}
            {renderField(fieldByKey("businessNotes"), tt("Description", "Keterangan"), { gridColumn: "1 / -1" })}
            {extraFields.map((field) => renderField(field, lang === "id" ? field.id : field.en))}
          </div>
        </div>
        <div style={{ border: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="shield-check" size={15} color={C.ocean} />
            <div style={{ fontSize: 12.5, fontWeight: 550, color: C.text }}>{tt("Authorization from master data", "Authorization dari master data")}</div>
            <Badge tone="brand">{payload.bandCode}</Badge>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {payload.authorization.signers.map((s) => <span key={s.key} style={{ fontSize: 11, borderRadius: RADIUS.pill, backgroundColor: C.surface, border: `1px solid ${C.borderSoft}`, color: C.text, padding: "4px 8px" }}>{s.defaultName} · {s.label}</span>)}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- 4. Smart template recommendation ---------- */
function CIPTemplateBrowseModal({ open, onClose, picked, onPick, tt, lang }) {
  const C = useC();
  const [catF, setCatF] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [draft, setDraft] = React.useState(picked || "");
  React.useEffect(() => { if (open) { setCatF("all"); setQ(""); setDraft(picked || ""); } }, [open, picked]);

  const filtered = CIP_TEMPLATES
    .filter((t) => catF === "all" || t.cat === catF)
    .filter((t) => {
      const qq = q.trim().toLowerCase();
      const doc = cipTemplateDoc(t);
      return !qq || [t.code, t.id, t.en, t.kw.join(" "), doc && doc.fileName].filter(Boolean).some((s) => String(s).toLowerCase().includes(qq));
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="min(96vw, 940px)"
      icon="layout-template"
      title={tt("Browse contract templates", "Telusuri template kontrak")}
      subtitle={tt("Pick any of the 23 standardized Legal templates — search by code, name, or keyword.", "Pilih salah satu dari 23 template standar Legal — cari berdasarkan kode, nama, atau kata kunci.")}
      overlayStyle={{ padding: "12px 20px" }}
      style={{ maxWidth: "min(96vw, 940px)", maxHeight: "calc(100vh - 24px)", display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, maxHeight: "none", overflowY: "auto", padding: "14px 20px 18px" }}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Close", "Tutup")}</Button><Button iconLeft="check" disabled={!draft} onClick={() => { onPick(draft); onClose(); }}>{tt("Use selected template", "Gunakan template terpilih")}</Button></>}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 280 }}><TextInput iconLeft="search" placeholder={tt("Search code, name, keyword…", "Cari kode, nama, kata kunci…")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {[{ key: "all" }, ...CIP_TPL_CATS].map((c) => {
            const act = catF === c.key;
            const label = c.key === "all" ? tt("All", "Semua") : trkText(lang, c);
            return (
              <button key={c.key} type="button" onClick={() => setCatF(c.key)} style={{ ...FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 600, border: `1px solid ${act ? (c.color || C.ocean) : C.border}`, backgroundColor: act ? (c.color ? c.color + "1c" : C.brandBg) : C.surface, color: act ? (c.color || C.ocean) : C.textMuted }}>
                {c.color && <span style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: c.color }} />}{label}
              </button>
            );
          })}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.textSubtle }}>{filtered.length} / 23</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {filtered.map((tpl, i) => {
          const sel = draft === tpl.code;
          const cat = CIP_TPL_CAT[tpl.cat];
          const doc = cipTemplateDoc(tpl);
          const readiness = cipTemplateReadiness(tpl);
          return (
            <button key={tpl.code} type="button" onClick={() => setDraft(tpl.code)} style={{ ...FONT, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: RADIUS.lg, border: `1.5px solid ${sel ? C.ocean : C.borderSoft}`, backgroundColor: sel ? C.brandBg : C.surface, animation: `cipFadeUp .35s ${Math.min(i * 0.03, 0.25)}s cubic-bezier(.2,.7,.3,1) both` }}>
              <span style={{ width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: cat.color + "1c", color: cat.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700 }}>{tpl.code.split("-")[1]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: cat.color }}>{tpl.code}</span>
                  <Badge tone="neutral" size="sm">{trkText(lang, cat)}</Badge>
                  <Badge tone={readiness.tone} size="sm">{trkText(lang, readiness)}</Badge>
                </div>
                <div style={{ fontSize: 13, fontWeight: 650, color: C.text, marginTop: 3, lineHeight: 1.35 }}>{tpl.id}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{doc.pages} {tt("pages", "hal.")} · {doc.placeholders} {tt("fields", "field")}</div>
              </div>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sel ? C.ocean : C.border}`, backgroundColor: sel ? C.ocean : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel && <Icon name="check" size={13} color="#fff" />}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <EmptyState icon="search-x" title={tt("No templates found", "Template tidak ditemukan")} description={tt("Try another keyword or category.", "Coba kata kunci atau kategori lain.")} />}
      </div>
    </Modal>
  );
}

function CIPDraftContractDataModal({ target, onClose, onSubmit }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const [form, setForm] = React.useState({});
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (target) {
      setForm({ ...(target.payload || {}) });
      setError("");
    }
  }, [target && target.key]);
  if (!target) return null;
  const payload = cipBuildDraftPayload(target.case, target.templateCode, form);
  const missing = cipDraftMissingFields(target.case, target.templateCode, payload);
  const missingSet = new Set(missing.map((x) => x.key));
  const targetMissingSet = new Set(((target.missing) || []).map((x) => x.key));
  const fieldsToRender = targetMissingSet.size
    ? CIP_DRAFT_TEMPLATE_FIELDS.filter((field) => targetMissingSet.has(field.key))
    : CIP_DRAFT_TEMPLATE_FIELDS.filter((field) => field.required);
  const tpl = CIP_TEMPLATE[target.templateCode];
  const submit = () => {
    if (missing.length) {
      setError(tt(`${missing[0].en} is required.`, `${missing[0].id} wajib diisi.`));
      return;
    }
    onSubmit && onSubmit(form);
  };
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const control = (field) => {
    const common = { value: form[field.key] || "", onChange: (event) => set(field.key, event.target.value) };
    if (field.type === "textarea") return <Textarea rows={3} {...common} style={{ minHeight: 78 }} />;
    return <TextInput type={field.type === "date" ? "date" : "text"} {...common} />;
  };
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      width={840}
      icon="file-pen"
      title={tt("Generate Draft Contract", "Generate Draft Contract")}
      subtitle={tt("Complete only the contract fields that are not already supplied from the award result or Term Sheet.", "Lengkapi hanya field kontrak yang belum tersedia dari hasil award atau Term Sheet.")}
      footer={<><Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="sparkles" onClick={submit}>{tt("Generate draft", "Generate draf")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <Alert tone="warning" title={tt("Complete required data", "Lengkapi data wajib")} description={error} />}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          {tpl && <Badge tone="neutral">{tpl.code}</Badge>}
          <Badge tone="brand"><Icon name="layout-template" size={11} />{target.templateCode}</Badge>
          <Badge tone={missing.length ? "warning" : "success"}><Icon name={missing.length ? "alert-triangle" : "check"} size={11} />{missing.length} {tt("missing", "kosong")}</Badge>
        </div>
        <Alert tone="info" title={tt("Output files", "File output")} description={tt("Generation produces a previewable PDF and an editable .docx package for work outside the system.", "Generate menghasilkan PDF yang bisa dipreview dan paket .docx yang bisa diedit di luar sistem.")} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="cip-split">
          {fieldsToRender.map((field) => (
            <div key={field.key} style={field.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
              <Field label={lang === "id" ? field.id : field.en} required={field.required} helper={field.source === "manual" ? tt("Not from award / Term Sheet", "Bukan dari award / Term Sheet") : tt("Prefilled when available", "Terisi otomatis bila tersedia")} status={missingSet.has(field.key) ? "warning" : undefined}>
                {control(field)}
              </Field>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function CIPSelectedTemplateCard({ templateCode, tt, lang, compact }) {
  const C = useC();
  const tpl = templateCode ? CIP_TEMPLATE[templateCode] : null;
  if (!tpl) return <Alert tone="warning" title={tt("No template selected", "Belum ada template dipilih")} description={tt("Recycle this step to pick a template again.", "Recycle step ini untuk memilih template lagi.")} />;
  const cat = CIP_TPL_CAT[tpl.cat];
  const doc = cipTemplateDoc(tpl);
  const readiness = cipTemplateReadiness(tpl);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, padding: compact ? 14 : 18, display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: cat.color + "1c", color: cat.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, fontWeight: 700 }}>{tpl.code.split("-")[1]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: cat.color }}>{tpl.code}</span>
          <Badge tone="neutral" size="sm">{trkText(lang, cat)}</Badge>
          <Badge tone={readiness.tone} size="sm">{trkText(lang, readiness)}</Badge>
          <Badge tone="success" size="sm"><Icon name="check" size={10} />{tt("Selected", "Dipilih")}</Badge>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 5, lineHeight: 1.35 }}>{tpl.id}</div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6, fontFamily: "monospace", wordBreak: "break-all" }}>{doc.fileName}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ fontSize: 10.8, color: C.textMuted, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: "2px 8px" }}>{doc.pages} {tt("pages", "hal.")}</span>
          <span style={{ fontSize: 10.8, color: C.textMuted, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: "2px 8px" }}>{doc.placeholders} {tt("fields", "field")}</span>
        </div>
      </div>
    </div>
  );
}

function CIPTemplatePanel({ c, tt, lang, toast, isCurrent, readOnly, onAdvance }) {
  const C = useC();
  const completed = readOnly || cipStageIdx(c.stage) > cipStageIdx("template") || !!c.draftBlobKey;
  const recs = React.useMemo(() => cipRecommend(c), [c.id, c.title, c.stage, c.termsheetPayload, c.lead]);
  const [picked, setPicked] = React.useState(c.template || (recs[0] && recs[0].tpl.code) || "");
  const [browseOpen, setBrowseOpen] = React.useState(false);
  const [gen, setGen] = React.useState("idle");
  const [step, setStep] = React.useState(0);
  const [genTarget, setGenTarget] = React.useState(null);
  const [previewDoc, setPreviewDoc] = React.useState(null);
  React.useEffect(() => {
    if (c.template) setPicked(c.template);
    else if (!picked && recs[0]) setPicked(recs[0].tpl.code);
  }, [c.id, c.template]);
  const pickedTemplate = picked ? CIP_TEMPLATE[picked] : null;
  const pickedReadiness = pickedTemplate ? cipTemplateReadiness(pickedTemplate) : null;
  const canUsePicked = pickedTemplate && ["ready", "heavy"].includes(pickedReadiness.key);
  const strongRecs = recs.filter((r) => !r.fallback);
  const corpusPreview = React.useMemo(() => cipRecommendCorpus(c).slice(0, 120), [c]);
  const editable = isCurrent && !readOnly;
  const missingNow = picked ? cipDraftMissingFields(c, picked, cipBuildDraftPayload(c, picked)) : [];
  const steps = [
    tt("Reading award result + Term Sheet payload...", "Membaca payload award + Term Sheet..."),
    tt("Merging data into Word master...", "Menggabungkan data ke master Word..."),
    tt("Composing previewable PDF...", "Menyusun PDF yang bisa dipreview..."),
    tt("Packaging editable .docx...", "Menyiapkan .docx yang bisa diedit..."),
  ];
  const finishGeneration = (templateCode, form) => {
    setGen("running");
    setStep(0);
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        clearInterval(iv);
        cipGenerateDraftDocument(c.id, templateCode, form).then((result) => {
          setGen("idle");
          if (result.document) {
            toast.push({
              title: tt("Draft contract generated", "Draf kontrak berhasil digenerate"),
              description: `${result.document.fileName} · ${result.document.docxFileName}`,
            });
            onAdvance && onAdvance(templateCode);
          }
        });
      } else {
        setStep(i);
      }
    }, 520);
  };
  const runGenerate = () => {
    if (!picked || !canUsePicked) return;
    const payload = cipBuildDraftPayload(c, picked);
    const missing = cipDraftMissingFields(c, picked, payload);
    if (missing.length) {
      setGenTarget({ key: `draft-${c.id}-${Date.now()}`, case: c, templateCode: picked, payload, missing });
      return;
    }
    finishGeneration(picked, payload);
  };
  const handleCompleteMissing = (form) => {
    const templateCode = genTarget && genTarget.templateCode;
    setGenTarget(null);
    if (templateCode) finishGeneration(templateCode, form);
  };
  if (completed) {
    const draftPdf = c.draftFileName || (pickedTemplate ? `Draft_${pickedTemplate.code}_${c.id}.pdf` : `Draft_${c.id}.pdf`);
    const draftDocx = c.draftDocxFileName || (pickedTemplate ? `Draft_${pickedTemplate.code}_${c.id}.docx` : `Draft_${c.id}.docx`);
    return (
      <>
        <DetailCard
          title={tt("Selected template", "Template terpilih")}
          subtitle={tt("Template used to generate the draft contract package.", "Template yang dipakai untuk generate paket draf kontrak.")}
        >
          <CIPSelectedTemplateCard templateCode={c.template || picked} tt={tt} lang={lang} />
          {c.draftBlobKey && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 14 }}>
              <CIPDocumentTile
                title={tt("Draft contract PDF", "PDF draf kontrak")}
                fileName={draftPdf}
                sourceLabel={tt("Generated", "Generated")}
                tone="brand"
                disabled={!c.draftBlobKey}
                onPreview={() => setPreviewDoc({ title: tt("Draft contract PDF", "PDF draf kontrak"), fileName: draftPdf, blobKey: c.draftBlobKey, container: c.draftContainer })}
                actionLabel={tt("Preview PDF", "Preview PDF")}
              />
              <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: C.warningBg, color: C.warningText, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="file-pen" size={22} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.8, fontWeight: 550, color: C.text }}>{tt("Editable Word package", "Paket Word editable")}</div>
                  <div style={{ fontSize: 11.5, color: C.textMuted, fontFamily: "monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draftDocx}</div>
                </div>
                <Button variant="secondary" size="sm" iconLeft="download" disabled={!c.draftDocxBlobKey} onClick={() => c.draftDocxBlobKey ? cipResolveDocumentUrl({ blobKey: c.draftDocxBlobKey, container: c.draftDocxContainer }).then((u) => u && window.open(u, "_blank")).catch(() => toast.push({ title: tt("Download failed", "Unduh gagal"), tone: "error" })) : toast.push({ title: tt("Generate first", "Generate dulu"), description: tt("The .docx is available after the draft is generated.", "File .docx tersedia setelah draf digenerate."), tone: "warning" })}>.docx</Button>
              </div>
            </div>
          )}
        </DetailCard>
        <CIPDocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
      </>
    );
  }
  return (
    <>
    <DetailCard
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{tt("Smart template recommendation", "Rekomendasi template cerdas")}<CipSourceChip kind="ai" size="sm" /></span>}
      subtitle={tt("Keyword scoring across case title, LOA scope, Termsheet sections, jobsite & method — top 3 matches, with category fallback.", "Skor kata kunci dari judul kasus, ruang lingkup LOA, bagian Termsheet, jobsite & metode — 3 kecocokan teratas, dengan fallback kategori.")}
      action={editable ? <Button variant="secondary" size="sm" iconLeft="layout-grid" onClick={() => setBrowseOpen(true)}>{tt("Browse all 23", "Telusuri 23 template")}</Button> : null}>
      <div style={{ fontSize: 12.3, color: C.textMuted, lineHeight: 1.5, marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <Icon name="info" size={14} color={C.ocean} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>{editable ? tt("Pick a recommended template or browse the full library.", "Pilih template rekomendasi atau telusuri pustaka lengkap.") : tt("Completed — use Recycle to reopen this step.", "Selesai — gunakan Recycle untuk membuka ulang step ini.")}</span>
      </div>
      <Alert tone="info" title={tt("How scoring works", "Cara penilaian")} description={tt(
        "Each template keyword found in the case corpus adds weighted points (longer phrases score higher). Templates in the inferred category get +1. Match % = 52 + score×8 + usage bonus. If fewer than 3 keyword hits, the list is filled from the most-used templates in the same category.",
        "Setiap kata kunci template yang ditemukan di korpus kasus menambah poin (frasa lebih panjang = poin lebih besar). Template dalam kategori terdeteksi mendapat +1. Match % = 52 + skor×8 + bonus pemakaian. Jika kurang dari 3 hit kata kunci, daftar diisi dari template terbanyak dipakai dalam kategori yang sama."
      )} style={{ marginBottom: 12 }} />
      {corpusPreview && (
        <div style={{ fontSize: 10.5, color: C.textSubtle, marginBottom: 12, lineHeight: 1.45, fontFamily: "monospace", backgroundColor: C.surfaceInset, borderRadius: RADIUS.md, padding: "8px 11px", border: `1px solid ${C.borderSoft}` }}>
          <span style={{ fontWeight: 700, color: C.textMuted }}>{tt("Corpus scanned", "Korpus yang dipindai")}: </span>{corpusPreview}{cipRecommendCorpus(c).length > 120 ? "…" : ""}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {strongRecs.length === 0 && <Alert tone="warning" title={tt("No keyword match in case text", "Tidak ada kata kunci di teks kasus")} description={tt("Showing category fallbacks — use Browse to pick manually.", "Menampilkan fallback kategori — gunakan Telusuri untuk pilih manual.")} />}
        {recs.map(({ tpl, score, hits, fallback }, i) => {
          const sel = picked === tpl.code;
          const matchPct = cipMatchPct({ tpl, score, fallback }, i);
          const cat = CIP_TPL_CAT[tpl.cat];
          const doc = cipTemplateDoc(tpl);
          const readiness = cipTemplateReadiness(tpl);
          const plan = cipTemplateMergePlan(tpl);
          return (
            <button key={tpl.code} type="button" disabled={!editable} onClick={() => editable && setPicked(tpl.code)} style={{ ...FONT, cursor: editable ? "pointer" : "not-allowed", textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: RADIUS.lg, border: `1.5px solid ${sel ? C.ocean : C.border}`, backgroundColor: sel ? C.brandBg : C.surface, animation: `cipFadeUp .4s ${i * 0.07}s cubic-bezier(.2,.7,.3,1) both`, opacity: editable ? 1 : 0.92 }}>
              <span style={{ width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: cat.color + "1c", color: cat.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15, fontWeight: 550 }}>{tpl.code.split("-")[1]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: cat.color }}>{tpl.code}</span>
                  {i === 0 && !fallback && <Badge tone="success" size="sm"><Icon name="sparkles" size={10} />{tt("Best match", "Paling cocok")}</Badge>}
                  {fallback && <Badge tone="neutral" size="sm">{tt("Category fallback", "Fallback kategori")}</Badge>}
                  <Badge tone={readiness.tone} size="sm">{trkText(lang, readiness)}</Badge>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginTop: 2, lineHeight: 1.35 }}>{tpl.id}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                  <span style={{ fontSize: 10.8, color: C.textMuted, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: "2px 7px" }}>{doc.pages} {tt("pages", "hal.")}</span>
                  <span style={{ fontSize: 10.8, color: C.textMuted, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: "2px 7px" }}>{doc.placeholders} {tt("fields", "field")}</span>
                  <span style={{ fontSize: 10.8, color: C.textMuted, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: "2px 7px" }}>{plan.manual} {tt("manual", "manual")}</span>
                  {hits.map((h, j) => <span key={j} style={{ backgroundColor: C.brandBg, color: C.ocean, fontWeight: 600, padding: "2px 7px", borderRadius: 99, fontSize: 10.8 }}>{h}</span>)}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, width: 64 }}>
                <div style={{ fontSize: 18, fontWeight: 550, color: i === 0 && !fallback ? C.success : C.text }}>{matchPct}%</div>
                <div style={{ height: 5, borderRadius: 99, backgroundColor: C.surfaceAlt, overflow: "hidden", marginTop: 3 }}>
                  <div className="cip-grow" style={{ width: `${matchPct}%`, height: "100%", backgroundColor: i === 0 && !fallback ? C.success : C.ocean, borderRadius: 99 }} />
                </div>
              </div>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sel ? C.ocean : C.border}`, backgroundColor: sel ? C.ocean : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel && <Icon name="check" size={13} color="#fff" />}</span>
            </button>
          );
        })}
        {pickedTemplate && (
          <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, backgroundColor: C.surfaceAlt, padding: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <Icon name="file-check-2" size={16} color={pickedReadiness.tone === "success" ? C.success : pickedReadiness.tone === "warning" ? C.warningText : C.ocean} />
              <div style={{ fontSize: 12.8, fontWeight: 550, color: C.text }}>{tt("Selected master status", "Status master terpilih")}</div>
              <Badge tone={pickedReadiness.tone}>{trkText(lang, pickedReadiness)}</Badge>
              {!canUsePicked && <Badge tone="warning">{tt("Needs cleanup before draft generation", "Perlu cleanup sebelum generate draf")}</Badge>}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 10.8, color: C.textMuted, marginTop: 7, wordBreak: "break-all" }}>{cipTemplateDoc(pickedTemplate).fileName}</div>
          </div>
        )}
      </div>
      <CipActions note={tt("Missing LOA / Term Sheet fields open in a popup before generation. Output: preview PDF + downloadable .docx.", "Field LOA / Term Sheet yang belum ada akan muncul di popup sebelum generate. Output: PDF preview + .docx unduhan.")}>
        <Badge tone={missingNow.length ? "warning" : "success"} size="sm"><Icon name={missingNow.length ? "alert-triangle" : "check"} size={11} />{missingNow.length ? `${missingNow.length} ${tt("field(s) need input", "field perlu diisi")}` : tt("Sources ready", "Sumber siap")}</Badge>
        <Button iconLeft="file-pen" disabled={!editable || !picked || !canUsePicked || gen === "running"} onClick={runGenerate}>{tt("Use template → generate draft", "Gunakan template → generate draf")}</Button>
      </CipActions>
      {gen === "running" && (
        <div style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, padding: 16, display: "grid", gap: 9 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: i <= step ? C.text : C.textSubtle, fontWeight: i === step ? 700 : 500 }}>
              {i < step ? <Icon name="check-circle-2" size={15} color={C.success} /> : i === step ? <Spinner size={14} color={C.ocean} /> : <Icon name="circle" size={14} color={C.border} />}
              {s}
            </div>
          ))}
        </div>
      )}
      {editable && <CIPTemplateBrowseModal open={browseOpen} onClose={() => setBrowseOpen(false)} picked={picked} onPick={setPicked} tt={tt} lang={lang} />}
    </DetailCard>
    <CIPDraftContractDataModal target={genTarget} onClose={() => setGenTarget(null)} onSubmit={handleCompleteMissing} />
    </>
  );
}

/* ---------- 5. Draft contract — generated outputs ---------- */
function CIPDraftPanel({ c, tt, lang, toast, isCurrent, onAdvance }) {
  const C = useC();
  const tpl = c.template ? CIP_TEMPLATE[c.template] : null;
  const hasDraft = !!c.draftBlobKey || cipStageIdx(c.stage) > cipStageIdx("template");
  const draftPdfName = c.draftFileName || (tpl ? `Draft_${tpl.code}_${c.id}.pdf` : `Draft_Perjanjian_${c.id}.pdf`);
  const draftDocxName = c.draftDocxFileName || (tpl ? `Draft_${tpl.code}_${c.id}.docx` : `Draft_Perjanjian_${c.id}.docx`);
  const [previewDoc, setPreviewDoc] = React.useState(null);
  const generatedDate = c.draftGeneratedAt ? trkFmtDate(trkDatePart(c.draftGeneratedAt), lang) : "-";
  if (!hasDraft) {
    return (
      <Alert
        tone="info"
        title={tt("Draft not generated yet", "Draf belum digenerate")}
        description={tt("Complete the Template sub-activity and generate the draft contract package first.", "Selesaikan sub-activity Template dan generate paket draf kontrak terlebih dahulu.")}
      />
    );
  }
  return (
    <>
      <DetailCard
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{tt("Draft contract", "Draf kontrak")}<CipSourceChip kind="ai" size="sm" /></span>}
        subtitle={tt("Preview the generated PDF or download the editable Word package for offline review.", "Preview PDF hasil generate atau unduh paket Word editable untuk review offline.")}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <CIPDocumentTile
            title={tt("Draft contract PDF", "PDF draf kontrak")}
            fileName={draftPdfName}
            sourceLabel={tt("Generated", "Generated")}
            tone="brand"
            disabled={!c.draftBlobKey}
            onPreview={() => c.draftBlobKey && setPreviewDoc({ title: tt("Draft contract PDF", "PDF draf kontrak"), fileName: draftPdfName, blobKey: c.draftBlobKey, container: c.draftContainer })}
            actionLabel={tt("Preview PDF", "Preview PDF")}
            meta={[
              { label: tt("Template", "Template"), value: tpl ? tpl.code : c.template || "-" },
              { label: tt("Generated", "Generate"), value: generatedDate },
              { label: tt("Contract no", "No kontrak"), value: c.contractNo || "-" },
            ]}
          />
          <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, backgroundColor: C.surface, overflow: "hidden", boxShadow: "0 10px 22px rgba(15,42,58,0.06)" }}>
            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "46px minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
              <span style={{ width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: C.warningBg, color: C.warningText, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file-pen" size={24} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12.8, fontWeight: 550, color: C.text }}>{tt("Editable Word package", "Paket Word editable")}</div>
                  <Badge tone="warning" size="sm">.docx</Badge>
                </div>
                <div title={draftDocxName} style={{ marginTop: 3, fontSize: 11.5, color: C.textMuted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draftDocxName}</div>
              </div>
              <Button variant="secondary" size="sm" iconLeft="download" disabled={!c.draftDocxBlobKey} onClick={() => c.draftDocxBlobKey ? cipResolveDocumentUrl({ blobKey: c.draftDocxBlobKey, container: c.draftDocxContainer }).then((u) => u && window.open(u, "_blank")).catch(() => toast.push({ title: tt("Download failed", "Unduh gagal"), tone: "error" })) : toast.push({ title: tt("Generate first", "Generate dulu"), description: tt("The .docx is available after the draft is generated.", "File .docx tersedia setelah draf digenerate."), tone: "warning" })}>{tt("Download", "Unduh")}</Button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${C.borderSoft}` }}>
              {[
                [tt("For external edit", "Untuk edit eksternal"), tt("Outside system", "Di luar sistem")],
                [tt("Master", "Master"), tpl ? tpl.id : "-"],
              ].map(([label, value], index) => (
                <div key={index} style={{ padding: "9px 12px", borderRight: index === 0 ? `1px solid ${C.borderSoft}` : "none", minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: C.textSubtle, fontWeight: 550 }}>{label}</div>
                  <div style={{ marginTop: 2, fontSize: 12.2, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Alert tone="info" title={tt("Next step", "Langkah berikut")} description={tt("Use the .docx for offline review if needed. When the draft has been reviewed outside the system, continue to Final Contract.", "Gunakan .docx untuk review offline bila perlu. Jika draf sudah direview di luar sistem, lanjut ke Final Contract.")} style={{ marginTop: 14 }} />
        {isCurrent && (
          <CipActions note={tt("Review is handled outside the system.", "Review dilakukan di luar sistem.")}>
            <Button iconLeft="check-circle-2" onClick={onAdvance}>{tt("Draft has been Reviewed", "Draft has been Reviewed")}</Button>
          </CipActions>
        )}
      </DetailCard>
      <CIPDocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  );
}

/* ---------- 6. Final contract — upload & complete ---------- */
function CIPFinalPanel({ c, tt, lang, toast, onNavigate, isCurrent, canComplete, onComplete }) {
  const C = useC();
  const uploaded = !!c.finalContractBlobKey;
  const finalFileName = c.finalContractFileName || `Perjanjian_${c.id}_signed.pdf`;
  const [previewDoc, setPreviewDoc] = React.useState(null);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const contractRoute = cipContractSigningForCase(c, CIP_USD_RATE);
  const flow = [
    { role: tt("Offline draft review", "Review draf offline"), name: tt("Outside system", "Di luar sistem"), done: true },
    ...contractRoute.signers.map((signer, index) => ({
      role: `${tt("Contract signer", "Penanda tangan Contract")} ${index + 1} · ${signer.label}`,
      name: signer.defaultName,
      done: uploaded,
    })),
  ];
  const handleUpload = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      await cipUploadFinalContract(c.id, file);
      toast.push({ title: tt("Final contract uploaded", "Kontrak final diupload"), description: file.name, tone: "success" });
    } catch (e) {
      toast.push({ title: tt("Upload failed", "Upload gagal"), description: (e && e.message) || file.name, tone: "error" });
    }
  };
  return (
    <>
      <DetailCard
        title={tt("Final contract", "Kontrak final")}
        subtitle={tt("Upload the final contract reviewed outside the system, then complete the Contract activity.", "Upload kontrak final yang sudah direview di luar sistem, lalu complete aktivitas Contract.")}
      >
        <div style={{ marginBottom: 14 }}>
          <CipContractSignerRoute c={c} />
        </div>
        {isCurrent && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.lg, backgroundColor: C.surfaceAlt, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ minWidth: 240, flex: "1 1 320px" }}>
              <div style={{ fontSize: 12.8, fontWeight: 550, color: C.text }}>{tt("External final contract", "Kontrak final eksternal")}</div>
              <div style={{ fontSize: 11.8, color: C.textMuted, marginTop: 4, lineHeight: 1.45 }}>{tt("Accept PDF or Word after offline review. Upload stores the file in the Document Repository.", "Terima PDF atau Word setelah review offline. Upload menyimpan file ke Document Repository.")}</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleUpload} style={{ display: "none" }} />
              <Button variant="secondary" iconLeft="upload" onClick={() => fileInputRef.current && fileInputRef.current.click()}>{tt("Upload final contract", "Upload kontrak final")}</Button>
              <Button iconLeft="check-circle-2" disabled={!canComplete} onClick={() => setCompleteOpen(true)}>{tt("Complete Activity", "Complete Activity")}</Button>
            </div>
          </div>
        )}
        {!uploaded && (
          <Alert tone="warning" title={tt("No final contract yet", "Belum ada kontrak final")} description={tt("Upload the final contract package before completing this activity.", "Upload paket kontrak final sebelum complete activity ini.")} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 16, marginBottom: 6 }}>
          {flow.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: f.done ? C.successBg : C.surfaceAlt, border: `2px solid ${f.done ? C.success : C.border}`, color: f.done ? C.success : C.textSubtle }}><Icon name={f.done ? "check" : "clock"} size={15} /></span>
                {i < flow.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: f.done ? C.success : C.border, margin: "3px 0" }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{f.role}</div>
                <div style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}><Avatar name={f.name} size={20} />{f.name}</div>
                <div style={{ fontSize: 11.5, color: f.done ? C.success : C.textSubtle, marginTop: 3 }}>{f.done ? tt("Approved", "Disetujui") : tt("Awaiting approval", "Menunggu persetujuan")}</div>
              </div>
            </div>
          ))}
        </div>
        {uploaded && (
          <CIPDocumentTile
            title={tt("Uploaded final contract", "Kontrak final terupload")}
            fileName={finalFileName}
            sourceLabel={tt("Uploaded", "Uploaded")}
            tone="success"
            disabled={!c.finalContractBlobKey}
            onPreview={() => c.finalContractBlobKey && setPreviewDoc({ title: tt("Final contract", "Kontrak final"), fileName: finalFileName, blobKey: c.finalContractBlobKey, container: c.finalContractContainer })}
            actionLabel={tt("Preview", "Preview")}
            meta={[
              { label: tt("Uploaded", "Upload"), value: c.finalContractUploadedAt ? trkFmtDate(trkDatePart(c.finalContractUploadedAt), lang) : "-" },
              { label: tt("Size", "Ukuran"), value: c.finalContractSize ? `${Math.round(c.finalContractSize / 1024)} KB` : "-" },
            ]}
          />
        )}
      </DetailCard>
      <CIPCompleteActivityModal
        open={completeOpen}
        title={tt("Contract", "Contract")}
        subtitle={tt("Contract activity", "Aktivitas Contract")}
        defaultRemark={tt("Final contract uploaded after offline review and ready for monitoring handoff.", "Kontrak final sudah diupload setelah review offline dan siap handoff monitoring.")}
        showCompleteDate
        onClose={() => setCompleteOpen(false)}
        onSubmit={(remark, completedAt) => { setCompleteOpen(false); onComplete && onComplete(remark, completedAt); }}
      />
      <CIPDocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  );
}

Object.assign(window, { CIPWorkflow, CIPProposalEmbeddedActivities });
export { CIPWorkflow, CIPProposalEmbeddedActivities };
