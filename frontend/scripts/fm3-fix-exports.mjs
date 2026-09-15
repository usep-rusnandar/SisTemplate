import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");

function rewriteAssignExport(rel, extraNames) {
  const abs = path.join(src, rel);
  let source = fs.readFileSync(abs, "utf8");
  const assignRe = /Object\.assign\(window,\s*\{([\s\S]*?)\}\s*\);?\s*\nexport \{[\s\S]*?\};?\s*$/;
  const m = source.match(assignRe);
  if (!m) {
    console.error("no assign+export block", rel);
    return;
  }
  const existing = [];
  for (const part of m[1].split(",")) {
    const id = part.trim().split(":")[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(id)) existing.push(id);
  }
  const names = [...new Set([...existing, ...extraNames])];
  const assignBody = names.join(", ");
  source = source.replace(assignRe, `Object.assign(window, { ${assignBody} });\nexport { ${assignBody} };\n`);
  fs.writeFileSync(abs, source);
  console.log("exports", rel, extraNames.join(", "));
}

function replaceImport(rel, fromNeedle, newLine) {
  const abs = path.join(src, rel);
  let source = fs.readFileSync(abs, "utf8");
  const re = new RegExp(`import \\{[^}]+\\} from "${fromNeedle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}";\\n`);
  if (!re.test(source)) {
    // insert after last import
    const last = source.lastIndexOf("import ");
    const end = source.indexOf("\n", last);
    source = `${source.slice(0, end + 1)}${newLine}\n${source.slice(end + 1)}`;
  } else {
    source = source.replace(re, `${newLine}\n`);
  }
  fs.writeFileSync(abs, source);
  console.log("import", rel, fromNeedle);
}

function stripImport(rel, fromNeedle) {
  const abs = path.join(src, rel);
  let source = fs.readFileSync(abs, "utf8");
  const re = new RegExp(`import \\{[^}]+\\} from "${fromNeedle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}";\\n`);
  if (re.test(source)) {
    source = source.replace(re, "");
    fs.writeFileSync(abs, source);
    console.log("strip", rel, fromNeedle);
  }
}

rewriteAssignExport("modules/proposal-tracker/legacy/TrackerData.jsx", ["trkNow", "trkHash", "trkStageIdByCode"]);
rewriteAssignExport("modules/proposal-tracker/legacy/TrackerProposals.jsx", [
  "trkActivityStatusTone",
  "trkActivityNoteRoleForSession",
  "trkActivityNoteRoleTone",
  "trkActivityNoteIsOfficer",
  "trkActivityNoteBubbleTone",
  "trkLoadActivityNotes",
  "trkSaveActivityNotes",
  "trkActivityStageCode",
  "trkDetailDate",
  "trkHistoryEventLabel",
  "trkHistoryTone",
  "trkStepHistoryColor",
  "trkCompactTableDate",
  "trkScheduleTone",
  "trkPendingTone",
  "trkProposalEstimatedDate",
]);
rewriteAssignExport("app/shell/legacy/Shell.jsx", ["ImpersonationBar"]);

replaceImport(
  "modules/contract-initiation-platform/legacy/ContractCIPData.jsx",
  "../../proposal-tracker/legacy/TrackerData.jsx",
  'import { trkBuildPdfDataUri, trkHash, trkNow, trkRp, trkStageIdByCode } from "../../proposal-tracker/legacy/TrackerData.jsx";',
);

replaceImport(
  "modules/contract-initiation-platform/legacy/ContractCIPWorkflow.jsx",
  "../../proposal-tracker/legacy/TrackerData.jsx",
  'import { TRK_TODAY, trkCompleteActivityLocal, trkDatePart, trkFmtDate, trkNow, trkReadStore, trkRp, trkStageIdByCode, trkText } from "../../proposal-tracker/legacy/TrackerData.jsx";',
);

replaceImport(
  "modules/contract-initiation-platform/legacy/ContractCIPWorkflow.jsx",
  "../../proposal-tracker/legacy/TrackerProposals.jsx",
  'import { TrkActivityBadge, trkActivityNoteBubbleTone, trkActivityNoteIsOfficer, trkActivityNoteRoleForSession, trkActivityNoteRoleTone, trkActivityStageCode, trkActivityStatusTone, trkCompactTableDate, trkDetailDate, trkHistoryEventLabel, trkHistoryTone, trkLoadActivityNotes, trkPendingTone, trkProposalEstimatedDate, trkSaveActivityNotes, trkScheduleTone, trkStepHistoryColor } from "../../proposal-tracker/legacy/TrackerProposals.jsx";',
);

stripImport("modules/proposal-tracker/legacy/TrackerProposals.jsx", "../../../platform/administration/legacy/ScreensHoliday.jsx");
stripImport("modules/proposal-tracker/legacy/TrackerProposals.jsx", "../../../platform/dashboard/legacy/Dashboard.jsx");
stripImport("modules/contract-monitoring/legacy/ContractMonScreens.jsx", "../../../platform/dashboard/legacy/Dashboard.jsx");
stripImport("modules/contract-initiation-platform/legacy/ContractCIPScreens.jsx", "../../../platform/dashboard/legacy/Dashboard.jsx");
stripImport("modules/vendor-onboarding/legacy/ScreensVendorMore.jsx", "../../../platform/settings/legacy/ScreensSettings.jsx");

console.log("fm3-fix-exports done");
