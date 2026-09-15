import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");

const FILES = [
  "app/shell/legacy/Shell.jsx",
  "modules/proposal-tracker/legacy/TrackerMasterData.jsx",
  "modules/proposal-tracker/legacy/TrackerCalendar.jsx",
  "modules/proposal-tracker/legacy/TrackerData.jsx",
  "modules/proposal-tracker/legacy/ScreensTrackerMaster.jsx",
  "modules/proposal-tracker/legacy/TrackerDashboard.jsx",
  "modules/proposal-tracker/legacy/TrackerProposals.jsx",
  "modules/proposal-tracker/legacy/TrackerMore.jsx",
  "modules/vendor-onboarding/legacy/VendorData.jsx",
  "modules/vendor-onboarding/legacy/BrandMasterData.jsx",
  "modules/vendor-onboarding/legacy/KbliMasterData.jsx",
  "modules/vendor-onboarding/legacy/CountryMasterData.jsx",
  "modules/vendor-onboarding/legacy/ProvinceMasterData.jsx",
  "modules/vendor-onboarding/legacy/CityMasterData.jsx",
  "modules/vendor-onboarding/legacy/DistrictMasterData.jsx",
  "modules/vendor-onboarding/legacy/VillageMasterData.jsx",
  "modules/vendor-onboarding/legacy/SpecialReqMasterData.jsx",
  "modules/vendor-onboarding/legacy/CommodityMasterData.jsx",
  "modules/vendor-onboarding/legacy/VendorMasterData.jsx",
  "modules/vendor-onboarding/legacy/VendorScreen.jsx",
  "modules/vendor-onboarding/legacy/ScreensVendorMore.jsx",
  "modules/vendor-onboarding/legacy/VendorAribaImport.jsx",
  "modules/vendor-onboarding/legacy/ScreensVendorMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensBrandMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensKbliMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensCountryMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensProvinceMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensCityMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensDistrictMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensVillageMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensSpecialReqMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensCommodityMaster.jsx",
  "modules/vendor-onboarding/legacy/ScreensAdminRegions.jsx",
  "modules/vendor-onboarding/legacy/MasterLookupEditor.jsx",
  "modules/contract-monitoring/legacy/ContractMonData.jsx",
  "modules/contract-monitoring/legacy/ContractMaterial.jsx",
  "modules/contract-monitoring/legacy/ContractMonScreens.jsx",
  "modules/contract-monitoring/legacy/ContractImport.jsx",
  "modules/contract-initiation-platform/legacy/ContractCIPData.jsx",
  "modules/contract-initiation-platform/legacy/ContractCIPScreens.jsx",
  "modules/contract-initiation-platform/legacy/ContractCIPWorkflow.jsx",
];

function toPosix(p) { return p.split(path.sep).join("/"); }

function relImport(fromFile, toFile) {
  let rel = toPosix(path.relative(path.dirname(path.join(src, fromFile)), path.join(src, toFile)));
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function assignExports(source) {
  const names = [];
  const re = /Object\.assign\(window,\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = re.exec(source))) {
    for (const part of m[1].split(",")) {
      const id = part.trim().split(":")[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(id)) names.push(id);
    }
  }
  return [...new Set(names)];
}

function definedNames(source) {
  const names = new Set();
  const re = /(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:^|\n)(?:export\s+)?const\s+([A-Za-z_$][\w$]*)|(?:^|\n)(?:export\s+)?let\s+([A-Za-z_$][\w$]*)|(?:^|\n)class\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(source))) names.add(m[1] || m[2] || m[3] || m[4]);
  return names;
}

function walkJsx(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJsx(p, acc);
    else if (ent.name.endsWith(".jsx")) acc.push(p);
  }
  return acc;
}

const catalog = new Map(); // name -> file relative to src
for (const abs of walkJsx(src)) {
  const rel = toPosix(path.relative(src, abs));
  const source = fs.readFileSync(abs, "utf8");
  for (const name of assignExports(source)) {
    if (!catalog.has(name)) catalog.set(name, rel);
  }
}

// Prefer i18n for useTT over TrackerData re-export
catalog.set("useTT", "shared/legacy/i18n.jsx");
catalog.set("useI18n", "shared/legacy/i18n.jsx");
catalog.set("LANGS", "shared/legacy/i18n.jsx");

for (const file of FILES) {
  const abs = path.join(src, file);
  let source = fs.readFileSync(abs, "utf8");
  if (source.startsWith("/* fm3-converted */") || source.startsWith("/* fm2-converted */")) {
    console.log("skip", file);
    continue;
  }

  const defined = definedNames(source);
  const used = new Set();
  for (const name of catalog.keys()) {
    if (defined.has(name)) continue;
    if (new RegExp(`\\b${name}\\b`).test(source)) used.add(name);
  }

  const groups = new Map();
  for (const name of used) {
    const from = catalog.get(name);
    if (!from || toPosix(from) === toPosix(file)) continue;
    if (!groups.has(from)) groups.set(from, []);
    groups.get(from).push(name);
  }

  const needsReact = /\bReact\./.test(source) || /<[A-Za-z]/.test(source);
  const lines = ["/* fm3-converted */"];
  if (needsReact) lines.push('import React from "react";');
  for (const [from, names] of [...groups.entries()].sort()) {
    names.sort();
    lines.push(`import { ${names.join(", ")} } from "${relImport(file, from)}";`);
  }
  lines.push("");

  const exported = assignExports(source);
  if (exported.length && !/export \{/.test(source.slice(-800))) {
    source = `${source.trimEnd()}\nexport { ${exported.join(", ")} };\n`;
  }

  // Files without Object.assign but with a primary screen function
  if (!exported.length) {
    const m = source.match(/\nfunction (VendorAribaImport)\b/);
    if (m) source = `${source.trimEnd()}\nexport { ${m[1]} };\nObject.assign(window, { ${m[1]} });\n`;
  }

  fs.writeFileSync(abs, `${lines.join("\n")}${source}`);
  console.log("converted", file, "imports", groups.size);
}
