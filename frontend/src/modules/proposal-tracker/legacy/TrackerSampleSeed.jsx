/* fm3-converted */
import {
  TRK_TODAY, trkAddDays, trkAwardSplitsForWinners, trkBuildAwardResultRequest, trkBuildPdfDataUri,
  trkClockInActivity, trkCompleteActivity, trkCreateCipCasesFromAward, trkDirectAppointmentWinnerIds,
  trkDistributeProposal, trkFlushProcurementStorage, trkHash, trkMethodHasBidEvaluation, trkNow, trkPad,
  trkReadStore, trkRp, trkSaveAwardResult, trkStageById, trkStageRows, trkUid,
  trkVendorsForProposal,
} from "./TrackerData.jsx";

const TRK_STEP_VENDOR_DOCS_KEY = "ag_tracker_step_vendor_docs_v1:";
const TRK_BID_EVAL_KEY = "ag_tracker_bid_eval_v1:";

function trkSampleAuxKeyPart(proposalId) {
  const value = String(proposalId || "");
  try { return encodeURIComponent(decodeURIComponent(value)); } catch (e) { return encodeURIComponent(value); }
}
function trkSampleReadJson(key, fallback) {
  try {
    const raw = window.__procurementStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function trkSampleWriteJson(key, value) {
  try { window.__procurementStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  return value;
}
function trkSampleStageCode(activity) {
  const stage = activity && activity.stageId ? trkStageById(activity.stageId) : null;
  return (stage && stage.code) || "";
}
function trkSampleSlug(value) {
  return String(value || "doc").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "doc";
}
function trkSampleShiftTimestamp(base, hours) {
  const parsed = new Date(String(base || trkNow()).replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return trkNow();
  parsed.setHours(parsed.getHours() + hours);
  return `${parsed.getFullYear()}-${trkPad(parsed.getMonth() + 1)}-${trkPad(parsed.getDate())} ${trkPad(parsed.getHours())}:${trkPad(parsed.getMinutes())}:00`;
}
function trkSampleDayTime(isoDate, hour, minute) {
  const day = String(isoDate || TRK_TODAY).slice(0, 10);
  return `${day} ${trkPad(hour || 9)}:${trkPad(minute || 20)}:00`;
}

function trkSampleSlaWindows(stages, lastIndex, requirementDate) {
  const slice = (stages || []).slice(0, lastIndex + 1);
  const windows = new Array(slice.length);
  const today = String(TRK_TODAY || "").slice(0, 10);
  const req = String(requirementDate || today).slice(0, 10);
  let cursor = req && today && req < today ? req : (today || req);
  for (let i = slice.length - 1; i >= 0; i -= 1) {
    const days = Math.max(1, Number(slice[i].slaDays) || 1);
    const end = cursor;
    const start = trkAddDays(end, -(days - 1));
    windows[i] = { start, end, days };
    cursor = trkAddDays(start, -1);
  }
  return windows;
}

async function trkUploadSamplePdf(proposalId, docType, fileName, dataUri) {
  try {
    const blob = await (await fetch(dataUri)).blob();
    const file = new File([blob], fileName, { type: blob.type || "application/pdf" });
    const form = new FormData();
    form.append("file", file);
    form.append("entityId", String(proposalId));
    form.append("docType", String(docType || "doc"));
    const res = await fetch("/api/v1/documents/proposal-tracker/upload", { method: "POST", credentials: "include", body: form });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

function trkSampleVendorScores(proposal, vendors) {
  const amount = Number(proposal.amount) || 0;
  const seed = trkHash(proposal.id);
  return vendors.map((vendor, index) => {
    const technicalScore = 72 + ((seed + index * 11) % 22);
    const commercialScore = 70 + ((seed + index * 17) % 24);
    const totalScore = Math.round((technicalScore * 0.6) + (commercialScore * 0.4));
    const bidPrice = Math.round(amount * (0.88 + (((seed + index * 5) % 18) / 100)));
    const negotiatedValue = Math.round(bidPrice * (0.94 - (index * 0.01)));
    return {
      ...vendor,
      technicalScore,
      commercialScore,
      totalScore,
      bidPrice,
      negotiatedValue,
      rank: 0,
    };
  }).map((row, _i, rows) => {
    const ranked = rows.slice().sort((a, b) => b.totalScore - a.totalScore || a.bidPrice - b.bidPrice);
    return { ...row, rank: ranked.findIndex((item) => item.vendorId === row.vendorId) + 1 };
  });
}

function trkSampleDocSpecs(code, proposal, vendor, scores) {
  const site = proposal.jobsite || "Site";
  const slug = trkSampleSlug(vendor.vendorName).slice(0, 28);
  const req = proposal.requirementDate || "";
  const score = (scores || []).find((row) => row.vendorId === vendor.vendorId);
  if (code === "TIA") {
    return [
      {
        fileName: `Undangan_Aanwijzing_${slug}_${site}.pdf`,
        docType: "invitation-aanwijzing",
        title: "Undangan Aanwijzing",
        remark: `Undangan aanwijzing ke ${vendor.vendorName} untuk pekerjaan di ${site}.`,
        lines: [
          `Proposal: ${proposal.proposalNumber}`,
          `Pekerjaan: ${proposal.title}`,
          `Jobsite: ${site}`,
          `Vendor: ${vendor.vendorName} (${vendor.vendorId})`,
          `Requirement date: ${req}`,
          "Lokasi aanwijzing: Meeting Room Procurement + site visit",
        ],
      },
      {
        fileName: `BA_Aanwijzing_${slug}.pdf`,
        docType: "invitation-aanwijzing",
        title: "Berita Acara Aanwijzing",
        remark: `BA kehadiran aanwijzing ${vendor.vendorName}. Tidak ada addendum TOR.`,
        lines: [
          `Vendor hadir: ${vendor.vendorName}`,
          `Direktur/wakil: ${vendor.director || "-"}`,
          "Klarifikasi TOR/TER dicatat; tidak ada perubahan scope.",
          `Berita acara ditandatangani di ${site}.`,
        ],
      },
    ];
  }
  if (code === "RFQ") {
    return [{
      fileName: `Penawaran_${slug}_${trkSampleSlug(proposal.commodity).slice(0, 20)}.pdf`,
      docType: "request-for-quotation-rfq",
      title: "Dokumen Penawaran Vendor",
      remark: `Penawaran teknis dan komersial ${vendor.vendorName}.`,
      lines: [
        `RFQ: ${proposal.proposalNumber}`,
        `Vendor: ${vendor.vendorName}`,
        `Alamat: ${vendor.address || "-"}`,
        score ? `Nilai penawaran (indikatif): ${trkRp(score.bidPrice)}` : `Nilai proposal: ${trkRp(proposal.amount)}`,
        "Kelengkapan: administratif, teknis, komersial.",
      ],
    }];
  }
  if (code === "NEGO") {
    const pct = 4 + (trkHash(`${proposal.id}:${vendor.vendorId}`) % 7);
    return [{
      fileName: `BA_Negosiasi_${slug}.pdf`,
      docType: "negotiation",
      title: "Berita Acara Negosiasi",
      remark: `BA negosiasi ${vendor.vendorName}: diskon ${pct}%, delivery dan garansi dicatat.`,
      lines: [
        `Vendor: ${vendor.vendorName}`,
        `Diskon terhadap penawaran awal: ${pct}%`,
        "Komitmen delivery sesuai requirement date user.",
        "Garansi suku cadang / layanan sesuai TOR.",
        score ? `Nilai negosiasi: ${trkRp(score.negotiatedValue)}` : "",
      ].filter(Boolean),
    }];
  }
  if (code === "EVAL") {
    return [{
      fileName: `Evaluasi_Bid_${slug}.pdf`,
      docType: "bid-evaluation",
      title: "Lembar Evaluasi Penawaran",
      remark: `Skor teknis/komersial ${vendor.vendorName}.`,
      lines: [
        `Vendor: ${vendor.vendorName}`,
        score ? `Teknis: ${score.technicalScore} | Komersial: ${score.commercialScore} | Total: ${score.totalScore}` : "Skor sedang direkap.",
        score ? `Peringkat: ${score.rank}` : "",
        `Jobsite: ${site}`,
      ].filter(Boolean),
    }];
  }
  return [{
    fileName: `${trkSampleSlug(code)}_${slug}.pdf`,
    docType: "doc",
    title: "Dokumen pendukung",
    remark: `Dokumen ${code} ${vendor.vendorName}.`,
    lines: [`Proposal: ${proposal.proposalNumber}`, `Vendor: ${vendor.vendorName}`],
  }];
}

async function trkBuildSampleDocumentRecord(proposal, activity, vendor, spec, createdAt) {
  const dataUri = trkBuildPdfDataUri(spec.title, spec.lines.concat([`Dibuat: ${createdAt}`]));
  const uploaded = await trkUploadSamplePdf(proposal.id, spec.docType, spec.fileName, dataUri);
  const record = {
    id: trkUid("doc"),
    fileName: spec.fileName,
    name: spec.fileName,
    remark: spec.remark,
    createdAt,
  };
  if (vendor && vendor.vendorId) {
    record.vendorId = vendor.vendorId;
    record.vendorName = vendor.vendorName;
  }
  if (uploaded && uploaded.blobKey) {
    return { ...record, container: uploaded.container, blobKey: uploaded.blobKey, size: uploaded.size, contentType: uploaded.contentType };
  }
  return { ...record, src: dataUri };
}

// Officers complete TIA/RFQ/NEGO without a header dump of every filename — that slot stays
// empty unless they type Catatan. EVAL still records the winner line the Complete modal prefills.
function trkSampleCompletionRemark(code, winnerNames) {
  if (code === "EVAL") {
    return `Bid Evaluation completed. Winner vendor: ${winnerNames}.`;
  }
  return "";
}

export async function trkAdvanceGeneratedSample(proposalId, row, actorName) {
  const lastStep = String((row && row.lastStepCode) || "READY").toUpperCase();
  if (!proposalId || lastStep === "READY" || lastStep === "PROP") return { ok: true, skipped: true };

  let proposal = (trkReadStore().proposals || []).find((item) => item.id === proposalId);
  if (!proposal) throw new Error("proposal_not_found");

  const officer = String((row && row.assignedOfficerName) || proposal.assignedOfficerName || "").trim()
    || proposal.ownerName || "Officer";
  const owner = actorName || proposal.ownerName || officer;
  const stages = trkStageRows(proposal.trackerMethod);
  const maxIdx = stages.findIndex((stage) => stage.code === lastStep);
  if (maxIdx < 0) throw new Error("last_step_invalid");

  const windows = trkSampleSlaWindows(stages, maxIdx, proposal.requirementDate || (row && row.requirementDate));
  const startActivityDate = windows[0] ? windows[0].start : TRK_TODAY;

  if (proposal.lifecycleStatus === "ReadyToDistribute") {
    trkDistributeProposal(proposalId, {
      assignedOfficerName: officer,
      distributedByName: owner,
      startActivityDate,
      timestamp: trkSampleDayTime(startActivityDate, 9, 15),
    });
    await trkFlushProcurementStorage();
  }

  const vendors = trkVendorsForProposal(proposalId);
  const scores = trkSampleVendorScores(proposal, vendors);
  const ranked = scores.slice().sort((a, b) => a.rank - b.rank);
  const hasEval = trkMethodHasBidEvaluation(proposal);
  const winnerCount = hasEval && ranked.length >= 2 ? 2 : 1;
  const rankedWinners = ranked.slice(0, winnerCount);
  const winner = rankedWinners[0] || vendors[0];
  const winnerIds = rankedWinners.length
    ? rankedWinners.map((row) => row.vendorId)
    : (winner && winner.vendorId ? [winner.vendorId] : []);
  const winnerNames = rankedWinners.length
    ? rankedWinners.map((row) => row.vendorName).join(", ")
    : (winner && winner.vendorName) || "";
  const awardSplits = trkAwardSplitsForWinners(proposal, winnerIds, null);
  const winnerValues = {};
  awardSplits.forEach((row) => {
    if (row.vendorId) winnerValues[row.vendorId] = row.value;
  });

  for (let i = 0; i <= maxIdx; i += 1) {
    proposal = (trkReadStore().proposals || []).find((item) => item.id === proposalId);
    if (!proposal) throw new Error("proposal_not_found");
    const stage = stages[i];
    if (stage.code === "TERM" || stage.code === "LOA" || stage.code === "CTR") continue;
    const activity = (proposal.activities || []).find((item) => item.stageId === stage.id || trkSampleStageCode(item) === stage.code);
    if (!activity || activity.status === "Completed" || activity.status === "Canceled") continue;
    if (activity.status === "Locked") throw new Error(`activity_locked:${stage.code}`);

    const window = windows[i] || { start: TRK_TODAY, end: TRK_TODAY };
    const startedAt = trkSampleDayTime(window.start, 8, 40);
    const completedAt = trkSampleDayTime(window.end, 16, 20);
    trkClockInActivity(proposalId, activity.id, officer, startedAt);

    const docsKey = `${TRK_STEP_VENDOR_DOCS_KEY}${trkSampleAuxKeyPart(proposalId)}`;
    const stepDocs = trkSampleReadJson(docsKey, {}) || {};
    stepDocs[activity.id] = stepDocs[activity.id] || {};
    const evidenceNames = [];

    if (stage.code !== "EVAL") {
      for (let v = 0; v < vendors.length; v += 1) {
        const vendor = vendors[v];
        const specs = trkSampleDocSpecs(stage.code, proposal, vendor, scores);
        const created = [];
        for (let s = 0; s < specs.length; s += 1) {
          const record = await trkBuildSampleDocumentRecord(proposal, activity, vendor, specs[s], trkSampleShiftTimestamp(completedAt, -(s + 1)));
          created.push(record);
          evidenceNames.push(`${vendor.vendorId}::${record.fileName}`);
        }
        stepDocs[activity.id][vendor.vendorId] = created;
      }
      trkSampleWriteJson(docsKey, stepDocs);
    }

    if (stage.code === "EVAL" && winnerIds.length) {
      const evalVendors = vendors.filter((vendor) => winnerIds.indexOf(vendor.vendorId) >= 0);
      const splits = awardSplits.length ? awardSplits : evalVendors;
      const winnerLines = splits.map((row) => {
        const name = row.vendorName || row.vendorId;
        const id = row.vendorId ? ` (${row.vendorId})` : "";
        const pct = row.percent != null && row.percent !== "" ? ` — porsi ${row.percent}%` : "";
        const val = row.value != null && row.value !== "" ? ` — ${trkRp(row.value)}` : "";
        return `Pemenang: ${name}${id}${pct}${val}`;
      });
      const proofSpec = {
        fileName: `Bukti_Pemenang_${trkSampleSlug(proposal.proposalNumber).slice(-18)}.pdf`,
        docType: "winner-proof",
        title: "Bukti Pemenang Bid Evaluation",
        remark: "Winner evidence and evaluation recommendation.",
        lines: [
          `Proposal: ${proposal.proposalNumber}`,
          `Jobsite: ${proposal.jobsite}`,
          `Nilai proposal: ${trkRp(proposal.amount)}`,
          ...winnerLines,
          ...scores.map((row) => `${row.rank}. ${row.vendorName} — teknis ${row.technicalScore}, komersial ${row.commercialScore}, total ${row.totalScore}, penawaran ${trkRp(row.bidPrice)}`),
        ],
      };
      const proofDoc = await trkBuildSampleDocumentRecord(proposal, activity, null, proofSpec, trkSampleShiftTimestamp(completedAt, -1));
      evidenceNames.push(proofDoc.fileName);
      winnerIds.forEach((id) => evidenceNames.unshift(`winner::${id}`));
      const bidKey = `${TRK_BID_EVAL_KEY}${trkSampleAuxKeyPart(proposalId)}`;
      const bidState = trkSampleReadJson(bidKey, {}) || {};
      bidState[activity.id] = { winnerVendorIds: winnerIds, winnerValues, proofDocuments: [proofDoc] };
      trkSampleWriteJson(bidKey, bidState);
    }

    const remark = trkSampleCompletionRemark(stage.code, winnerNames);
    await trkFlushProcurementStorage();
    await trkCompleteActivity(proposalId, activity.id, {
      remark,
      evidenceNames: Array.from(new Set(evidenceNames)),
      actorName: officer,
      at: completedAt,
      completedAt,
    });
    await trkFlushProcurementStorage();
  }

  proposal = (trkReadStore().proposals || []).find((item) => item.id === proposalId);
  if (!proposal) throw new Error("proposal_not_found");

  const evalCompleted = (proposal.activities || []).some((item) =>
    (trkSampleStageCode(item) === "EVAL" || String(item.title || "").toLowerCase() === "bid evaluation")
    && item.status === "Completed");
  const negoCompleted = (proposal.activities || []).some((item) =>
    (trkSampleStageCode(item) === "NEGO" || String(item.title || "").toLowerCase() === "negotiation")
    && item.status === "Completed");
  if ((hasEval && evalCompleted) || (!hasEval && negoCompleted)) {
    let winners = hasEval ? winnerIds.slice() : trkDirectAppointmentWinnerIds(proposal);
    if (!winners.length && winner && winner.vendorId) winners = [winner.vendorId];
    if (!winners.length) {
      const fallback = (trkVendorsForProposal(proposalId)[0] || vendors[0]);
      if (fallback && fallback.vendorId) winners = [fallback.vendorId];
    }
    if (!winners.length) throw new Error("award_winner_missing");
    const source = hasEval ? "BidEvaluation" : "Negotiation";
    await trkFlushProcurementStorage();
    const saved = await trkSaveAwardResult(
      proposalId,
      trkBuildAwardResultRequest(proposal, winners, officer, source, scores, hasEval ? winnerValues : null),
    );
    if (!saved.ok) throw new Error("award_not_synced");
    const cip = await trkCreateCipCasesFromAward(proposalId, officer);
    if (!cip.ok) throw new Error(cip.code || "cip_not_opened");
  }

  return { ok: true };
}

Object.assign(window, { trkAdvanceGeneratedSample });
export default { trkAdvanceGeneratedSample };
