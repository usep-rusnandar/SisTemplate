/* fm3-converted */
import React from "react";
import { trkBuildPdfDataUri, trkHash, trkIsCipCaseKey, trkNow, trkReadStore, trkRp, trkStageIdByCode } from "../../proposal-tracker/legacy/TrackerData.jsx";
import { Select } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDate } from "../../../shared/legacy/PrimitivesX.jsx";
/* Alamtri Geo Admin — Contract Initiation Platform (CIP) data layer.
   Per the current process: the commercial award result is the Term Sheet input. After the
   Term Sheet is completed, Proposal Tracker LOA and CIP Contract continue in parallel.
   Legacy LOA-created cases remain readable. CIP verifies the source data and generates
   the standardized Termsheet (Commercial/Finance/Tax & Insurance, Technical,
   Operations, Legal), recommends one of the 23 standardized Legal templates,
   generates the draft contract, accepts the externally reviewed final contract,
   and hands the executed contract to Contract Monitoring.
   The 23 templates below are the REAL template list from BRD Lampiran 2. */

const CIP_TODAY = (function () {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const CIP_AS_OF = (function () {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
})();

/* ---------- pipeline stages (Tracker award → Term Sheet → executed contract) ---------- */
const CIP_STAGES = [
  { key: "loa",       en: "Award Result from Proposal Tracker",  id: "Hasil Award dari Proposal Tracker",   icon: "inbox",            desc_en: "Winning vendor and commercial result received from Proposal Tracker. LOA is issued later in Tracker, in parallel with CIP Contract.", desc_id: "Vendor pemenang dan hasil komersial diterima dari Proposal Tracker. LOA diterbitkan kemudian di Tracker, paralel dengan Contract CIP." },
  { key: "verify",    en: "Data Verification", id: "Verifikasi Data",    icon: "clipboard-check",  desc_en: "Verify the structured award payload before Term Sheet generation", desc_id: "Verifikasi payload award terstruktur sebelum generate Term Sheet" },
  { key: "termsheet", en: "Generate Term Sheet", id: "Generate Term Sheet", icon: "file-text",     desc_en: "Generate the standardized Term Sheet from the Proposal Tracker award result", desc_id: "Generate Term Sheet standar dari hasil award Proposal Tracker" },
  { key: "template",  en: "Template",          id: "Template",           icon: "layout-template",  desc_en: "Smart recommendation from the 23 standardized templates", desc_id: "Rekomendasi cerdas dari 23 template terstandar" },
  { key: "draft",     en: "Draft Contract",    id: "Draf Kontrak",       icon: "file-pen",         desc_en: "Merge Termsheet data into the selected template", desc_id: "Gabungkan data Termsheet ke template terpilih" },
  { key: "final",     en: "Final Contract",    id: "Kontrak Final",      icon: "award",            desc_en: "Upload the externally reviewed final contract, complete Contract activity, and hand off to Contract Monitoring", desc_id: "Upload kontrak final hasil review eksternal, complete activity Contract, dan serah ke Contract Monitoring" },
];
const CIP_STAGE = Object.fromEntries(CIP_STAGES.map((s, i) => [s.key, { ...s, order: i }]));
/* Legacy saved cases may still carry the removed in-system Legal Review stage. */
CIP_STAGE.review = { ...CIP_STAGE.final, key: "review", en: "Final Contract", id: "Kontrak Final" };
function cipStageIdx(key) { return CIP_STAGE[key] ? CIP_STAGE[key].order : 0; }

const CIP_STATUS = {
  intake:     { en: "Intake",      id: "Intake",      tone: "neutral" },
  inprogress: { en: "In Progress", id: "Berproses",   tone: "info" },
  approved:   { en: "Executed",    id: "Final",       tone: "success" },
};
function cipStatusForStage(stage) {
  if (stage === "loa") return "intake";
  return "inprogress";
}

const CIP_PHASES = [
  { key: "termsheet", en: "Termsheet", id: "Termsheet", icon: "file-text", desc_en: "Validate the Proposal Tracker award result and generate the authorization-ready Term Sheet", desc_id: "Validasi hasil award Proposal Tracker dan generate Term Sheet siap otorisasi" },
  { key: "contract", en: "Contract", id: "Kontrak", icon: "file-signature", desc_en: "Select template, draft, upload final contract, and hand over the executed contract", desc_id: "Pilih template, susun draf, upload kontrak final, dan serahkan kontrak final" },
];
const CIP_PHASE = Object.fromEntries(CIP_PHASES.map((s, i) => [s.key, { ...s, order: i }]));
function cipPhaseForStage(stage) {
  return ["loa", "verify", "termsheet"].includes(stage) ? "termsheet" : "contract";
}
function cipPhaseIdx(stageOrPhase) {
  const key = CIP_PHASE[stageOrPhase] ? stageOrPhase : cipPhaseForStage(stageOrPhase);
  return CIP_PHASE[key] ? CIP_PHASE[key].order : 0;
}

/* CIP roles per BRD: Requestor, Procurement/Contract Mgmt, Legal, Approver, Admin */
const CIP_ROLES = [
  { key: "requestor",   en: "User / Requestor",              id: "User / Requestor" },
  { key: "procurement", en: "Procurement / Contract Mgmt",   id: "Procurement / Manajemen Kontrak" },
  { key: "legal",       en: "Legal Team",                    id: "Tim Legal" },
  { key: "approver",    en: "Approver / Management",         id: "Approver / Manajemen" },
  { key: "admin",       en: "System Administrator",          id: "Administrator Sistem" },
];

/* ---------- Termsheet authorization master (from the supplied matrix) ---------- */
const CIP_USD_RATE = 16850;
const CIP_AUTHORIZATION_BANDS = [
  { key: "ta", code: "Transactional A", label: "VT < $2.5K", minUsd: 0, maxUsd: 2500 },
  { key: "tb", code: "Transactional B", label: "$2.5K <= VT < $5K", minUsd: 2500, maxUsd: 5000 },
  { key: "tc", code: "Transactional C", label: "$5K <= VT < $35K", minUsd: 5000, maxUsd: 35000 },
  { key: "td", code: "Transactional D", label: "$35K <= VT < $100K", minUsd: 35000, maxUsd: 100000 },
  { key: "sa", code: "Strategic A", label: "$100K <= VT < $250K", minUsd: 100000, maxUsd: 250000 },
  { key: "sb", code: "Strategic B", label: "$250K <= VT < $1.000K", minUsd: 250000, maxUsd: 1000000 },
  { key: "low", code: "Low", label: "$1.000K <= VT < $2.000K", minUsd: 1000000, maxUsd: 2000000 },
  { key: "med", code: "Medium", label: "$2.000K <= VT < $4.000K", minUsd: 2000000, maxUsd: 4000000 },
  { key: "high", code: "High", label: "$4.000K <= VT < $5.000K", minUsd: 4000000, maxUsd: 5000000 },
  { key: "mat", code: "Material", label: "VT >= $5.000K", minUsd: 5000000, maxUsd: Infinity },
];
const CIP_AUTHORIZATION_ROLES = [
  { key: "deptHeadProc", label: "Dept. Head Procurement", defaultName: "Andy Prasetio Wibowo", defaultTitle: "Vendor Onboarding Dept. Head", group: "prepared" },
  { key: "divHeadProc", label: "Div. Head Procurement", defaultName: "Benjamin Rumbi", defaultTitle: "Procurement & Logistics Div. Head", group: "submitted" },
  { key: "divHeadUser", label: "Div. Head User", defaultName: "Heri Iswantara", defaultTitle: "Plant Dev & Engineering Div. Head", group: "approved" },
  { key: "divHeadFinance", label: "Div. Head Finance", defaultName: "Rina Marlina", defaultTitle: "Finance Div. Head", group: "approved" },
  { key: "directorProc", label: "Director Procurement", defaultName: "Asep Kusmana", defaultTitle: "Procurement & Logistics Director", group: "submitted" },
  { key: "directorUser", label: "Director User", defaultName: "Lunggar Siputro", defaultTitle: "Plant Director", group: "approved" },
  { key: "directorFinance", label: "Director Finance", defaultName: "Dian Permana", defaultTitle: "Finance Director", group: "approved" },
  { key: "presidentDirector", label: "President Director", defaultName: "Rudy Halim", defaultTitle: "President Director", group: "approved" },
  { key: "allBoardDirectors", label: "All Board of Directors", defaultName: "Board of Directors", defaultTitle: "All Board of Directors", group: "approved" },
  { key: "aglsLegal", label: "AGLS (Legal)", defaultName: "Corporate Legal", defaultTitle: "AGLS Legal", group: "noted" },
  { key: "perseroanDirectors", label: "Perseroan Directors", defaultName: "Perseroan Directors", defaultTitle: "Directors of Perseroan", group: "approved" },
];
const CIP_AUTHORIZATION_MATRIX = {
  deptHeadProc: { ta: "required", tb: "required", tc: "required", td: "required", sa: "required", sb: "required", low: "required", med: "required", high: "required", mat: "required" },
  divHeadProc: { ta: "required", tb: "required", tc: "required", td: "required", sa: "required", sb: "required", low: "required", med: "required", high: "required", mat: "required" },
  divHeadUser: { ta: "required", tb: "required", tc: "required", td: "required", sa: "required", sb: "required", low: "required", med: "required" },
  divHeadFinance: { ta: "required", tb: "required", tc: "required", td: "required", sa: "required", sb: "required", low: "required", med: "required", high: "required", mat: "required" },
  directorProc: { sb: "required", low: "required", med: "required" },
  directorUser: { sb: "required", low: "required", med: "required" },
  directorFinance: { sb: "ack", low: "required", med: "required" },
  presidentDirector: { low: "board", med: "board" },
  allBoardDirectors: { high: "required", mat: "required" },
  aglsLegal: { mat: "required" },
  perseroanDirectors: { mat: "required" },
};

const CIP_AUTH_MASTER_STORE_KEY = "ag_cip_auth_master_v1";
const CIP_AUTH_MASTER_EVENT = "ag-cip-auth-master";
function cipDefaultAuthMaster() {
  return {
    roles: CIP_AUTHORIZATION_ROLES.map((r) => ({ ...r })),
    matrix: Object.fromEntries(Object.entries(CIP_AUTHORIZATION_MATRIX).map(([k, v]) => [k, { ...v }])),
  };
}
function cipAuthMasterSnapshot() {
  try {
    const raw = window.__procurementStorage.getItem(CIP_AUTH_MASTER_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.roles) && parsed.matrix) {
      return {
        roles: parsed.roles.map((r) => ({ ...r })),
        matrix: Object.fromEntries(Object.entries(parsed.matrix).map(([k, v]) => [k, { ...(v || {}) }])),
      };
    }
  } catch (e) {}
  return cipDefaultAuthMaster();
}
function cipSaveAuthMaster(master) {
  const clean = {
    roles: (master.roles || []).map((r) => ({ ...r })),
    matrix: Object.fromEntries(Object.entries(master.matrix || {}).map(([k, v]) => [k, { ...(v || {}) }])),
  };
  try { window.__procurementStorage.setItem(CIP_AUTH_MASTER_STORE_KEY, JSON.stringify(clean)); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent(CIP_AUTH_MASTER_EVENT, { detail: clean })); } catch (e) {}
  return clean;
}
function cipUsdValue(value, rate) {
  const n = Number(value) || 0;
  const r = Number(rate) || CIP_USD_RATE;
  return Math.round((n / r) * 100) / 100;
}
function cipAuthorizationBandForValue(value, rate) {
  const usd = cipUsdValue(value, rate);
  return CIP_AUTHORIZATION_BANDS.find((b) => usd >= b.minUsd && usd < b.maxUsd) || CIP_AUTHORIZATION_BANDS[CIP_AUTHORIZATION_BANDS.length - 1];
}
function cipAuthorizationCell(roleKey, bandKey, master) {
  const src = master || cipAuthMasterSnapshot();
  return (src.matrix[roleKey] && src.matrix[roleKey][bandKey]) || "";
}
function cipAuthorizationForCase(c, rate, master) {
  const src = master || cipAuthMasterSnapshot();
  const band = cipAuthorizationBandForValue(c && c.value, rate);
  const roles = src.roles.map((role) => {
    const state = cipAuthorizationCell(role.key, band.key, src);
    return { ...role, state };
  });
  return {
    band,
    usdValue: cipUsdValue(c && c.value, rate),
    rate: Number(rate) || CIP_USD_RATE,
    roles,
    signers: roles.filter((role) => role.state === "required" || role.state === "board"),
    acknowledgers: roles.filter((role) => role.state === "ack"),
  };
}

/* ---------- Contract signing matrix (separate from Termsheet authorization) ---------- */
const CIP_CONTRACT_SIGNING_ROLES = {
  directorProc: { key: "directorProc", label: "Director - Procurement", defaultName: "Asep Kusmana", defaultTitle: "Procurement & Logistics Director" },
  directorUser: { key: "directorUser", label: "Director - User", defaultName: "Lunggar Siputro", defaultTitle: "User Directorate" },
  directorFinance: { key: "directorFinance", label: "Director - Finance", defaultName: "Dian Permana", defaultTitle: "Finance Director" },
  presidentDirector: { key: "presidentDirector", label: "President Director", defaultName: "Rudy Halim", defaultTitle: "President Director" },
  sectHeadProcHo: { key: "sectHeadProcHo", label: "Sect. Head Procurement HO", defaultName: "Nadia Salsabila", defaultTitle: "Procurement HO Section Head" },
  deptHeadProc: { key: "deptHeadProc", label: "Dept. Head Procurement", defaultName: "Andy Prasetio Wibowo", defaultTitle: "Vendor Onboarding Dept. Head" },
  divHeadProc: { key: "divHeadProc", label: "Div. Head Procurement", defaultName: "Benjamin Rumbi", defaultTitle: "Procurement & Logistics Div. Head" },
};
const CIP_CONTRACT_CELL = {
  signer: { en: "Contract signer", id: "Penanda tangan Contract", tone: "signer" },
  alternate: { en: "Replacement signer", id: "Pengganti signer", tone: "alternate" },
  president: { en: "President Director route", id: "Route President Director", tone: "president" },
};
const CIP_CONTRACT_SIGNING_SECTIONS = [
  {
    key: "contractDocument",
    title: "3. Contract Document",
    rows: [
      { roleKey: "directorProc", cells: { ta: "signer", tb: "signer", tc: "signer", td: "signer", sa: "signer", sb: "signer", low: "signer", med: "signer", high: "signer", mat: "signer" } },
      { roleKey: "directorUser", cells: { ta: "signer", tb: "signer", tc: "signer", td: "signer", sa: "signer", sb: "signer", low: "signer", med: "signer", high: "signer", mat: "signer" } },
      { roleKey: "directorFinance", cells: { ta: "alternate", tb: "alternate", tc: "alternate", td: "alternate", sa: "alternate", sb: "alternate", low: "alternate", med: "alternate", high: "alternate", mat: "alternate" } },
      { roleKey: "presidentDirector", cells: { low: "president", med: "president", high: "president", mat: "president" } },
    ],
  },
  {
    key: "outlineAgreement",
    title: "4. Outline Agreement",
    rows: [
      { roleKey: "sectHeadProcHo", cells: { ta: "signer", tb: "signer", tc: "signer", td: "signer", sa: "signer", sb: "signer", low: "signer", med: "signer", high: "signer", mat: "signer" } },
      { roleKey: "deptHeadProc", cells: { ta: "signer", tb: "signer", tc: "signer", td: "signer", sa: "signer", sb: "signer", low: "signer", med: "signer", high: "signer", mat: "signer" } },
      { roleKey: "divHeadProc", cells: { sb: "signer", low: "signer", med: "signer", high: "signer", mat: "signer" } },
    ],
  },
];
const CIP_CONTRACT_SIGNING_NOTES = [
  {
    key: "procAsUser",
    en: "When Director Procurement is also the User, Director Finance replaces Director Procurement in the contract signing route.",
    id: "Pada saat Direktur Procurement menjadi User, posisi Direktur Procurement digantikan oleh Direktur Finance dalam proses penandatanganan Contract.",
  },
  {
    key: "presAsProcLow",
    en: "When President Director also acts as Director Procurement and VT < $2.000K, the contract is signed by Director User and Director Finance.",
    id: "Jika Presiden Direktur juga menjabat sebagai Direktur Procurement dan VT < $2.000K, dokumen Contract ditandatangani oleh Director User dan Director Finance.",
  },
  {
    key: "presAsProcHigh",
    en: "When President Director also acts as Director Procurement and VT >= $2.000K, the contract is signed by Director User and President Director.",
    id: "Jika Presiden Direktur juga menjabat sebagai Direktur Procurement dan VT >= $2.000K, dokumen Contract ditandatangani oleh Director User dan President Director.",
  },
];
function cipContractMatrixCell(roleKey, bandKey) {
  for (const section of CIP_CONTRACT_SIGNING_SECTIONS) {
    const row = (section.rows || []).find((r) => r.roleKey === roleKey);
    if (row) return (row.cells && row.cells[bandKey]) || "";
  }
  return "";
}
function cipContractSigningRole(roleKey, state) {
  const role = CIP_CONTRACT_SIGNING_ROLES[roleKey] || { key: roleKey, label: roleKey, defaultName: "-", defaultTitle: "" };
  return { ...role, state: state || "signer" };
}
function cipContractOutlineSignersForBand(bandKey) {
  return ["sectHeadProcHo", "deptHeadProc", "divHeadProc"]
    .map((roleKey) => ({ roleKey, state: cipContractMatrixCell(roleKey, bandKey) }))
    .filter((row) => row.state)
    .map((row) => cipContractSigningRole(row.roleKey, row.state));
}
function cipContractSigningForCase(c, rate, options) {
  const band = cipAuthorizationBandForValue(c && c.value, rate);
  const opts = options || {};
  const directorProcurementIsUser = !!(opts.directorProcurementIsUser || (c && c.directorProcurementIsUser));
  const presidentDirectorIsProcurement = !!(opts.presidentDirectorIsProcurement || (c && c.presidentDirectorIsProcurement));
  let routeKey = "standard";
  let signerKeys = ["directorProc", "directorUser"];
  if (presidentDirectorIsProcurement) {
    const presidentThreshold = band.minUsd >= 2000000;
    routeKey = presidentThreshold ? "presidentAsProcHigh" : "presidentAsProcLow";
    signerKeys = presidentThreshold ? ["presidentDirector", "directorUser"] : ["directorFinance", "directorUser"];
  } else if (directorProcurementIsUser) {
    routeKey = "procurementAsUser";
    signerKeys = ["directorFinance", "directorUser"];
  }
  const roles = Object.keys(CIP_CONTRACT_SIGNING_ROLES).map((roleKey) => cipContractSigningRole(roleKey, cipContractMatrixCell(roleKey, band.key)));
  return {
    band,
    usdValue: cipUsdValue(c && c.value, rate),
    rate: Number(rate) || CIP_USD_RATE,
    routeKey,
    roles,
    signers: signerKeys.map((roleKey) => cipContractSigningRole(roleKey, "signer")),
    outlineSigners: cipContractOutlineSignersForBand(band.key),
    notes: CIP_CONTRACT_SIGNING_NOTES,
  };
}

/* ---------- the REAL 23 standardized Legal templates (BRD Lampiran 2) ---------- */
const CIP_TPL_CATS = [
  { key: "jasa",     en: "Services",        id: "Jasa",        color: "#0F828A" },
  { key: "sewa",     en: "Rental & Lease",  id: "Sewa",        color: "#EB662E" },
  { key: "jualbeli", en: "Sale & Purchase", id: "Jual Beli",   color: "#005C96" },
  { key: "konstruksi", en: "Construction",  id: "Konstruksi",  color: "#11713B" },
  { key: "khusus",   en: "Special",         id: "Khusus",      color: "#7C5CBF" },
];
const CIP_TPL_CAT = Object.fromEntries(CIP_TPL_CATS.map((c) => [c.key, c]));

const CIP_TEMPLATE_SOURCE_ROOT = "D:\\Projects\\IntegratedProcurement\\NewDoc\\Draft Template Kontrak";
const CIP_TEMPLATE_DOCUMENTS = {
  "TK-01": { fileName: "1. [STANDAR] Draft_Amandemen Perjanjian_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 7, words: 1983, tables: 1, placeholders: 81, notes: 10, pasalDetected: 6 },
  "TK-02": { fileName: "2. [STANDAR] Draft Perjanjian Jasa (konsultan-kajian-studi) _300522.doc", ext: "doc", version: "300522", effectiveDate: "2022-05-30", pages: 26, words: 9548, tables: 2, placeholders: 66, notes: 17, pasalDetected: 44 },
  "TK-03": { fileName: "3. [STANDAR] Draft_Perjanjian Jasa (selain konsultansi penyusunan kajian)_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 27, words: 9423, tables: 2, placeholders: 68, notes: 10, pasalDetected: 39 },
  "TK-04": { fileName: "4. [STANDAR] Draft_Perjanjian Jasa Penanaman Pemeliharaan Perawatan_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 33, words: 12120, tables: 7, placeholders: 118, notes: 24, pasalDetected: 47 },
  "TK-05": { fileName: "5. [STANDAR] Draft Perjanjian Sewa Menyewa Bangunan-Mess-Rumah (sebagai Penyewa)_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 26, words: 9487, tables: 4, placeholders: 81, notes: 14, pasalDetected: 35 },
  "TK-06": { fileName: "6. [STANDAR] Draft_Perjanjian Sewa Menyewa (sebagai Penyewa)_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 24, words: 8848, tables: 2, placeholders: 92, notes: 13, pasalDetected: 37 },
  "TK-07": { fileName: "7. [STANDAR] Draft_Perjanjian Penyediaan Jasa Pekerja_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 28, words: 10773, tables: 2, placeholders: 85, notes: 10, pasalDetected: 47 },
  "TK-08": { fileName: "8. [STANDAR] Draft_Perjanjian Sewa Menyewa Kendaraan (Penyewa) - Tanpa Pengemudi_300522.doc", ext: "doc", version: "300522", effectiveDate: "2022-05-30", pages: 38, words: 13036, tables: 15, placeholders: 109, notes: 21, pasalDetected: 43, fields: 1 },
  "TK-09": { fileName: "9. [STANDAR] Draft Perjanjian Jasa Penyediaan Kendaraan - dengan Pengemudi_210524.doc", ext: "doc", version: "210524", effectiveDate: "2024-05-21", pages: 37, words: 15478, tables: 15, placeholders: 92, notes: 32, pasalDetected: 45 },
  "TK-10": { fileName: "10. [STANDAR] Draft Perjanjian Jual Beli Putus_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 25, words: 8651, tables: 3, placeholders: 156, notes: 8, pasalDetected: 46 },
  "TK-11": { fileName: "11. [STANDAR] Draft Perjanjian Jasa (utk penyediaan dan pengoperasian Alat_300522.doc", ext: "doc", version: "300522", effectiveDate: "2022-05-30", pages: 30, words: 13120, tables: 4, placeholders: 97, notes: 11, pasalDetected: 59, comments: 1 },
  "TK-12": { fileName: "12. [STANDAR] Draft Perjanjian Rancang Bangun-Pembangunan_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 50, words: 19916, tables: 10, placeholders: 119, notes: 28, pasalDetected: 67, comments: 7, bookmarks: 6 },
  "TK-13": { fileName: "13. [STANDAR] Draft Perjanjian Jasa Penyediaan dan Penyajian Makanan_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 28, words: 12798, tables: 4, placeholders: 110, notes: 21, pasalDetected: 54 },
  "TK-14": { fileName: "14. [STANDAR] Draft Perjanjian Jasa Pengelolaan Limbah B3_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 24, words: 10017, tables: 4, placeholders: 93, notes: 15, pasalDetected: 40 },
  "TK-15": { fileName: "15. [STANDAR] Draft Perjanjian Pemborongan Pekerjaan_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 26, words: 9869, tables: 1, placeholders: 71, notes: 9, pasalDetected: 40 },
  "TK-16": { fileName: "16. [STANDAR] Draft Perjanjian Sewa Alat_tanpa operator_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 30, words: 12165, tables: 6, placeholders: 83, notes: 12, pasalDetected: 56 },
  "TK-17": { fileName: "17. [STANDAR] Draft Perjanjian Jual Beli Alat Berat-Disposal (Penjual)_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 12, words: 4313, tables: 2, placeholders: 73, notes: 1, pasalDetected: 27 },
  "TK-18": { fileName: "18. [STANDAR] Draft Perjanjian Jual Beli Alat Berat-Disposal (Pembeli)_300522.docx", ext: "docx", version: "300522", effectiveDate: "2022-05-30", pages: 15, words: 5889, tables: 2, placeholders: 64, notes: 3, pasalDetected: 32 },
  "TK-19": { fileName: "19. [STANDAR] Draft Perjanjian Jual Beli Alat Baru (Pembeli)_300522.doc", ext: "doc", version: "300522", effectiveDate: "2022-05-30", pages: 18, words: 6543, tables: 2, placeholders: 64, notes: 3, pasalDetected: 31 },
  "TK-20": { fileName: "20. STANDAR Draft Perjanjian Penyediaan Suku Cadang VHS_171125.docx", ext: "docx", version: "171125", effectiveDate: "2025-11-17", pages: 46, words: 15017, tables: 10, placeholders: 131, notes: 7, pasalDetected: 44, revisions: 59 },
  "TK-21": { fileName: "21. STANDAR Draft Perjanjian Penyediaan Suku Cadang (Consignment)_171125.docx", ext: "docx", version: "171125", effectiveDate: "2025-11-17", pages: 47, words: 16397, tables: 12, placeholders: 161, notes: 16, pasalDetected: 48 },
  "TK-22": { fileName: "22. STANDAR Draft Perjanjian Jual Beli (Fixed Price)_171125.docx", ext: "docx", version: "171125", effectiveDate: "2025-11-17", pages: 40, words: 11521, tables: 8, placeholders: 246, notes: 15, pasalDetected: 38 },
  "TK-23": { fileName: "23. STANDAR Draft NDA SIS - Pengungkap Informasi_050325.docx", ext: "docx", version: "050325", effectiveDate: "2025-03-05", pages: 17, words: 8142, tables: 2, placeholders: 21, notes: 1, pasalDetected: 2, family: "nda" },
};

const CIP_CONTRACT_FIELD_GROUPS = [
  { key: "parties", en: "Parties & authority", id: "Para pihak & kewenangan", source: "Proposal Tracker award + Vendor DB", fields: ["Company entity", "Vendor legal name", "Authorized signers", "Addresses"] },
  { key: "commercial", en: "Commercial terms", id: "Ketentuan komersial", source: "Termsheet", fields: ["Contract value", "Payment terms", "Tax/VAT", "Bank account"] },
  { key: "scope", en: "Scope & delivery", id: "Ruang lingkup & delivery", source: "Award + Termsheet", fields: ["Scope of work", "Location", "Period", "Line items"] },
  { key: "legal", en: "Legal controls", id: "Kontrol legal", source: "Legal template", fields: ["Standard clauses", "Legal notes", "Attachments", "Sign blocks"] },
];

function cipTemplateDoc(tplOrCode) {
  const code = typeof tplOrCode === "string" ? tplOrCode : tplOrCode && tplOrCode.code;
  const d = code ? CIP_TEMPLATE_DOCUMENTS[code] : null;
  if (!d) return null;
  return {
    comments: 0,
    revisions: 0,
    bookmarks: 0,
    fields: 0,
    family: "agreement",
    ...d,
    code,
    path: `${CIP_TEMPLATE_SOURCE_ROOT}\\${d.fileName}`,
    isLegacy: d.ext === "doc",
  };
}

function cipTemplateCleanupIssues(tplOrCode) {
  const d = cipTemplateDoc(tplOrCode);
  if (!d) return [];
  const issues = [];
  if (d.isLegacy) issues.push({ key: "legacy", tone: "warning", en: "Convert legacy .doc", id: "Konversi .doc legacy" });
  if (d.revisions > 0) issues.push({ key: "revisions", tone: "danger", en: `${d.revisions} tracked revisions`, id: `${d.revisions} tracked revisions` });
  if (d.comments > 0) issues.push({ key: "comments", tone: "warning", en: `${d.comments} comments`, id: `${d.comments} komentar` });
  if (d.fields > 0) issues.push({ key: "fields", tone: "info", en: `${d.fields} Word field`, id: `${d.fields} field Word` });
  if (d.bookmarks > 0) issues.push({ key: "bookmarks", tone: "info", en: `${d.bookmarks} bookmarks`, id: `${d.bookmarks} bookmark` });
  return issues;
}

function cipTemplateReadiness(tplOrCode) {
  const d = cipTemplateDoc(tplOrCode);
  if (!d) return { key: "missing", tone: "danger", en: "Source missing", id: "Sumber belum ada", score: 0 };
  if (d.revisions > 0) return { key: "revision", tone: "danger", en: "Clean revisions first", id: "Bersihkan revision dulu", score: 44 };
  if (d.comments > 0) return { key: "comment", tone: "warning", en: "Resolve comments", id: "Selesaikan komentar", score: 62 };
  if (d.isLegacy) return { key: "convert", tone: "warning", en: "Convert to .docx", id: "Konversi ke .docx", score: 70 };
  if (d.placeholders >= 150) return { key: "heavy", tone: "info", en: "Mapping-heavy", id: "Mapping besar", score: 82 };
  return { key: "ready", tone: "success", en: "Ready for mapping", id: "Siap mapping", score: 94 };
}

function cipTemplateMergePlan(tplOrCode) {
  const d = cipTemplateDoc(tplOrCode);
  if (!d) return { auto: 0, manual: 0, total: 0, percent: 0 };
  const base = d.family === "nda" ? 0.45 : d.placeholders >= 150 ? 0.58 : 0.66;
  const auto = Math.min(d.placeholders, Math.max(8, Math.round(d.placeholders * base)));
  const manual = Math.max(0, d.placeholders - auto);
  return { auto, manual, total: d.placeholders, percent: d.placeholders ? Math.round((auto / d.placeholders) * 100) : 0 };
}

function cipTemplateLibraryStats(templates) {
  const rows = (templates || CIP_TEMPLATES).map((t) => cipTemplateDoc(t)).filter(Boolean);
  const pages = rows.map((d) => d.pages);
  return {
    total: rows.length,
    docx: rows.filter((d) => d.ext === "docx").length,
    legacy: rows.filter((d) => d.ext === "doc").length,
    placeholders: rows.reduce((s, d) => s + d.placeholders, 0),
    pagesMin: pages.length ? Math.min(...pages) : 0,
    pagesMax: pages.length ? Math.max(...pages) : 0,
    cleanup: rows.filter((d) => cipTemplateCleanupIssues(d.code).some((x) => ["legacy", "revisions", "comments"].includes(x.key))).length,
  };
}

const CIP_TEMPLATES = [
  { code: "TK-01", id: "Amandemen Perjanjian",                                          en: "Contract Amendment",                          cat: "khusus",     kw: ["amandemen", "addendum", "perubahan", "perpanjangan"], clauses: 9,  usage: 31 },
  { code: "TK-02", id: "Perjanjian Jasa — Konsultansi, Kajian & Studi",                 en: "Services — Consultancy, Assessment & Study",  cat: "jasa",       kw: ["konsultan", "kajian", "studi", "consulting", "advisory", "assessment"], clauses: 18, usage: 12 },
  { code: "TK-03", id: "Perjanjian Jasa — Selain Konsultansi Penyusunan Kajian",        en: "Services — Other than Consultancy",           cat: "jasa",       kw: ["jasa", "layanan", "service", "pekerjaan jasa"], clauses: 20, usage: 26 },
  { code: "TK-04", id: "Perjanjian Jasa Penanaman, Pemeliharaan & Perawatan",           en: "Planting, Maintenance & Upkeep Services",     cat: "jasa",       kw: ["penanaman", "pemeliharaan", "perawatan", "revegetasi", "maintenance", "servis"], clauses: 19, usage: 14 },
  { code: "TK-05", id: "Perjanjian Sewa Bangunan / Mess / Rumah (sebagai Penyewa)",     en: "Building / Mess / House Lease (as Lessee)",   cat: "sewa",       kw: ["sewa bangunan", "mess", "rumah", "gedung", "kantor"], clauses: 16, usage: 9 },
  { code: "TK-06", id: "Perjanjian Sewa Menyewa (sebagai Penyewa)",                     en: "General Lease Agreement (as Lessee)",         cat: "sewa",       kw: ["sewa", "menyewa", "lease", "rental"], clauses: 15, usage: 11 },
  { code: "TK-07", id: "Perjanjian Penyediaan Jasa Pekerja",                            en: "Manpower Supply Agreement",                   cat: "jasa",       kw: ["pekerja", "manpower", "tenaga kerja", "outsourcing", "penjaga", "security", "cleaning", "teknisi"], clauses: 22, usage: 28 },
  { code: "TK-08", id: "Perjanjian Sewa Kendaraan (Penyewa) — Tanpa Pengemudi",         en: "Vehicle Rental — Without Driver",             cat: "sewa",       kw: ["kendaraan", "mobil", "vehicle", "light vehicle", "tanpa pengemudi"], clauses: 15, usage: 17 },
  { code: "TK-09", id: "Perjanjian Jasa Penyediaan Kendaraan — Dengan Pengemudi",       en: "Vehicle Provision Services — With Driver",    cat: "sewa",       kw: ["kendaraan", "pengemudi", "driver", "transportasi", "angkutan", "bus"], clauses: 17, usage: 13 },
  { code: "TK-10", id: "Perjanjian Jual Beli Putus",                                    en: "Outright Sale & Purchase",                    cat: "jualbeli",   kw: ["jual beli", "putus", "pembelian"], clauses: 13, usage: 19 },
  { code: "TK-11", id: "Perjanjian Jasa — Penyediaan & Pengoperasian Alat",             en: "Equipment Supply & Operation Services",       cat: "jasa",       kw: ["alat", "pengoperasian", "operator", "equipment", "rental alat", "crane"], clauses: 21, usage: 16 },
  { code: "TK-12", id: "Perjanjian Rancang Bangun / Pembangunan",                       en: "Design & Build / Construction",               cat: "konstruksi", kw: ["rancang bangun", "pembangunan", "konstruksi", "civil", "infrastruktur", "renovasi"], clauses: 24, usage: 10 },
  { code: "TK-13", id: "Perjanjian Jasa Penyediaan & Penyajian Makanan",                en: "Food Provision & Serving (Catering)",         cat: "jasa",       kw: ["makanan", "catering", "kantin", "meal", "konsumsi", "penyajian"], clauses: 18, usage: 15 },
  { code: "TK-14", id: "Perjanjian Jasa Pengelolaan Limbah B3",                         en: "Hazardous (B3) Waste Management Services",    cat: "jasa",       kw: ["limbah", "b3", "waste", "lingkungan", "ipal", "pengelolaan limbah"], clauses: 20, usage: 8 },
  { code: "TK-15", id: "Perjanjian Pemborongan Pekerjaan",                              en: "Lump-Sum Work Agreement (Borongan)",          cat: "jasa",       kw: ["borongan", "pemborongan", "general service", "general services", "jasa borongan"], clauses: 23, usage: 34 },
  { code: "TK-16", id: "Perjanjian Sewa Alat — Tanpa Operator",                         en: "Equipment Rental — Without Operator",         cat: "sewa",       kw: ["sewa alat", "alat berat", "excavator", "dozer", "tanpa operator", "genset"], clauses: 16, usage: 21 },
  { code: "TK-17", id: "Perjanjian Jual Beli Alat Berat — Disposal (Penjual)",          en: "Heavy Equipment Disposal (as Seller)",        cat: "jualbeli",   kw: ["alat berat", "disposal", "penjual", "lelang unit"], clauses: 14, usage: 6 },
  { code: "TK-18", id: "Perjanjian Jual Beli Alat Berat — Disposal (Pembeli)",          en: "Heavy Equipment Disposal (as Buyer)",         cat: "jualbeli",   kw: ["alat berat", "disposal", "pembeli", "unit bekas"], clauses: 14, usage: 5 },
  { code: "TK-19", id: "Perjanjian Jual Beli Alat Baru (Pembeli)",                      en: "New Equipment Purchase (as Buyer)",           cat: "jualbeli",   kw: ["alat baru", "unit baru", "pembelian alat", "unit komputer", "perangkat"], clauses: 15, usage: 12 },
  { code: "TK-20", id: "Perjanjian Penyediaan Suku Cadang VHS",                         en: "Spare Parts Supply — VHS",                    cat: "jualbeli",   kw: ["suku cadang", "spare part", "vhs", "komponen", "generator"], clauses: 16, usage: 18 },
  { code: "TK-21", id: "Perjanjian Penyediaan Suku Cadang — Consignment",               en: "Spare Parts Supply — Consignment",            cat: "jualbeli",   kw: ["suku cadang", "consignment", "konsinyasi", "spare part"], clauses: 17, usage: 9 },
  { code: "TK-22", id: "Perjanjian Jual Beli — Fixed Price",                            en: "Sale & Purchase — Fixed Price",               cat: "jualbeli",   kw: ["jual beli", "fixed price", "material", "barang", "pengadaan barang", "hdpe"], clauses: 14, usage: 23 },
  { code: "TK-23", id: "NDA — Perjanjian Kerahasiaan (Pengungkap Informasi)",           en: "Non-Disclosure Agreement (Discloser)",        cat: "khusus",     kw: ["nda", "kerahasiaan", "confidential", "rahasia", "pengungkap informasi"], clauses: 11, usage: 27 },
].map((tpl) => ({ ...tpl, doc: cipTemplateDoc(tpl.code), readiness: cipTemplateReadiness(tpl.code), mergePlan: cipTemplateMergePlan(tpl.code) }));
const CIP_TEMPLATE = Object.fromEntries(CIP_TEMPLATES.map((t) => [t.code, t]));

/* clause outline used in template preview & draft generation (generic skeleton) */
const CIP_CLAUSE_OUTLINE = [
  { id: "Ruang Lingkup Pekerjaan",        en: "Scope of Work" },
  { id: "Jangka Waktu Perjanjian",        en: "Term of Agreement" },
  { id: "Nilai Perjanjian",               en: "Contract Value" },
  { id: "Tata Cara Pembayaran",           en: "Payment Terms" },
  { id: "Hak & Kewajiban Para Pihak",     en: "Rights & Obligations" },
  { id: "Jaminan & Asuransi",             en: "Guarantees & Insurance" },
  { id: "Pajak",                          en: "Taxes" },
  { id: "Sanksi & Denda",                 en: "Sanctions & Penalties" },
  { id: "Keadaan Kahar (Force Majeure)",  en: "Force Majeure" },
  { id: "Kerahasiaan",                    en: "Confidentiality" },
  { id: "K3LH & Kepatuhan",               en: "HSE & Compliance" },
  { id: "Pengakhiran Perjanjian",         en: "Termination" },
  { id: "Penyelesaian Perselisihan",      en: "Dispute Resolution" },
  { id: "Hukum yang Berlaku",             en: "Governing Law" },
];

/* ---------- smart template recommendation ----------
   Corpus: case title + jobsite + method + award scope + Termsheet sections.
   Score: weighted keyword hits (longer phrases weigh more), tie-break by usage.
   Match %: min(98, 52 + score×8 + min(usage,20) + best-match bonus).
   Fallback: if <3 keyword hits, fill with most-used templates in the same category. */
function cipRecommendCorpus(c) {
  if (!c) return "";
  if (typeof c === "string") return c.toLowerCase();
  const parts = [c.title, c.jobsite, c.method, c.department, c.vendor];
  const loa = c.lead ? CIP_LEAD_LOA : (c.loaPayload || {});
  if (loa) {
    parts.push(loa.subject, loa.scope, loa.attachmentDescription, loa.procurementSubject);
  }
  if (c.termsheetPayload || c.lead) {
    try {
      const sections = c.lead ? CIP_LEAD_TERMSHEET : cipBuildTermsheetPayload(c, c.termsheetPayload).sections;
      Object.values(sections || {}).forEach((rows) => {
        (rows || []).forEach((row) => {
          if (row && row.label) parts.push(row.label);
          if (row && row.value) parts.push(String(row.value));
        });
      });
      if (c.lead && CIP_LEAD_TERMSHEET.lineItems) {
        CIP_LEAD_TERMSHEET.lineItems.forEach((row) => parts.push(row.desc));
      }
      if (c.lead && CIP_LEAD_TERMSHEET.technical) parts.push(...CIP_LEAD_TERMSHEET.technical);
    } catch (e) { /* termsheet not ready yet */ }
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function cipRecommendKeywordScore(corpus, kw) {
  const term = String(kw || "").toLowerCase().trim();
  if (!term || !corpus.includes(term)) return { hit: false, weight: 0 };
  return { hit: true, weight: term.length >= 14 ? 4 : term.length >= 10 ? 3 : term.length >= 6 ? 2 : 1 };
}

function cipRecommendCategoryHint(corpus) {
  if (/(sewa|lease|rental|menyewa)/.test(corpus)) return "sewa";
  if (/(jual beli|pembelian barang|material|suku cadang|spare part)/.test(corpus)) return "jualbeli";
  if (/(konstruksi|rancang bangun|pembangunan|civil)/.test(corpus)) return "konstruksi";
  if (/(nda|kerahasiaan|confidential)/.test(corpus)) return "khusus";
  if (/(amandemen|addendum|perubahan kontrak)/.test(corpus)) return "khusus";
  return "jasa";
}

function cipRecommend(input) {
  const corpus = cipRecommendCorpus(input);
  const catHint = cipRecommendCategoryHint(corpus);
  const scored = CIP_TEMPLATES.map((tpl) => {
    const hits = [];
    let score = 0;
    tpl.kw.forEach((k) => {
      const m = cipRecommendKeywordScore(corpus, k);
      if (m.hit) { hits.push(k); score += m.weight; }
    });
    if (tpl.cat === catHint) score += 1;
    return { tpl, score, hits, fallback: false };
  }).filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.tpl.usage - a.tpl.usage);

  const out = scored.slice(0, 3);
  if (out.length >= 3) return out;

  const used = new Set(out.map((x) => x.tpl.code));
  const fillers = CIP_TEMPLATES
    .filter((tpl) => !used.has(tpl.code))
    .sort((a, b) => {
      const aCat = a.cat === catHint ? 1 : 0;
      const bCat = b.cat === catHint ? 1 : 0;
      return bCat - aCat || b.usage - a.usage;
    });
  fillers.forEach((tpl) => {
    if (out.length >= 3) return;
    out.push({ tpl, score: 0, hits: [], fallback: true });
  });
  return out;
}

function cipMatchPct(rec, rank) {
  if (rec.fallback) return Math.max(28, 44 - rank * 6);
  return Math.min(98, 52 + rec.score * 8 + Math.min(rec.tpl.usage, 20) + (rank === 0 ? 10 : 0));
}

/* ---------- lead case payload (real SERA documents) ---------- */
const CIP_LEAD_LOA = {
  number: "2/LOA/JAHO/SRC-CM2/OPD/III/2026",
  date: "2026-03-31",
  to: "PT Tiga Saudara Mandiri Bhakti",
  from: "PT Saptaindra Sejati",
  subject: "Jasa General Services di Jobsite SERA",
  vendorAddress: "Jl. Kartini Raya No. 53 AH, Jakarta Pusat, 10750",
  scope: "Pengadaan Jasa General Services di Jobsite SERA",
  jobsite: "Jobsite SERA — Kab. Balangan, Kalimantan Selatan",
  periodStart: "2026-05-01", periodEnd: "2029-03-31", durationMonths: 35,
  value: 1489600000,
  method: "Direct Selection",
  preparedBy: "Ronald Mawuntu",
};

const CIP_LEAD_TERMSHEET = {
  commercial: [
    { label: "Jenis Pengadaan", value: "Jasa General Service" },
    { label: "Jangka Waktu", value: `${fmtAppDate("2026-05-01")} - ${fmtAppDate("2029-03-31")} (35 bulan)` },
    { label: "Estimasi Nilai Perjanjian", value: "IDR 1.489.600.000" },
    { label: "Termin Pembayaran", value: "Maks. 30 hari kalender setelah dokumen tagihan lengkap & benar diterima Finance PT SIS" },
    { label: "Mata Uang", value: "Rupiah (IDR)" },
    { label: "Rekening Pembayaran", value: "Bank Mandiri Cab. Tanjung — 031-00-2355961-3 a.n. PT Tiga Saudara Mandiri Bhakti" },
  ],
  lineItems: [
    { desc: "Jasa Layanan Penjaga Malam", monthly: 11310000, qty: 35 },
    { desc: "Jasa Layanan Operasional IPAL", monthly: 31250000, qty: 35 },
  ],
  priceIncludes: ["PPh", "Akomodasi & transportasi layanan penjaga malam", "Material & peralatan kerja", "Master pekerja (cuti/libur), PJO, Koorlap & admin", "BPJS, MCU, THR, seragam, APD"],
  priceExcludes: ["PPN", "Material, transportasi manpower & akomodasi makan untuk operasional IPAL (disediakan PT SIS)"],
  technical: [
    "Layanan penjaga malam: patroli mess, menjaga aset, buka-tutup portal, distribusi meal box, perbaikan minor, pencapaian KPI",
    "Layanan operasional IPAL: monitoring swapantau (pH, TSS, BOD, debit), 5R housekeeping, penambahan bahan kimia (klorin, tawas, bakteri aktivator)",
    "Penempatan min. 2 tenaga penjaga malam (Shift II 19.00–06.00 WITA) & 5 tenaga IPAL (Shift I 07.00–17.00 WITA)",
    "Vendor wajib menyediakan APD, seragam, dan tenaga pengganti bila cuti/libur",
  ],
  operations: [
    "Lokasi: Jobsite SERA, Kab. Balangan, Kalimantan Selatan",
    "Pelaksanaan jasa sesuai timeline Perjanjian / PO yang diterbitkan PT SIS",
    "Laporan pelaksanaan mingguan atas timesheet harian untuk persetujuan PT SIS",
    "Berita Acara pelaksanaan Jasa bulanan ditandatangani Para Pihak sebelum penagihan",
    "Mekanisme peringatan tertulis I–III; sanksi & pengakhiran sepihak atas ketidaktercapaian KPI",
  ],
  legal: [
    "Vendor tidak boleh mengalihkan hak/kewajiban ke pihak ketiga tanpa persetujuan tertulis PT SIS",
    "Hukum yang berlaku: Hukum Negara Republik Indonesia",
    "Penyelesaian perselisihan: musyawarah, lalu Pengadilan Negeri Jakarta Selatan",
    "Seluruh ketentuan mengikuti standar perjanjian Divisi Legal PT Alamtri Resources Indonesia Tbk",
  ],
};

/* generic termsheet for non-lead cases, shaped from the case record */
function cipGenericTermsheet(c) {
  return {
    commercial: [
      { label: "Jenis Pengadaan", value: c.title },
      { label: "Jangka Waktu", value: "12 bulan sejak tanggal efektif Perjanjian" },
      { label: "Estimasi Nilai Perjanjian", value: trkRp(c.value) },
      { label: "Termin Pembayaran", value: "Maks. 30 hari kalender setelah dokumen tagihan lengkap & benar" },
      { label: "Mata Uang", value: "Rupiah (IDR)" },
      { label: "Rekening Pembayaran", value: `Sesuai data rekening terverifikasi ${c.vendor} pada Vendor Database` },
    ],
    lineItems: [{ desc: c.title, monthly: Math.round(c.value / 12), qty: 12 }],
    priceIncludes: ["PPh", "Mobilisasi & demobilisasi", "APD dan perlengkapan kerja standar"],
    priceExcludes: ["PPN", "Pekerjaan tambah di luar ruang lingkup"],
    technical: [
      "Spesifikasi teknis mengacu pada dokumen tender dan klarifikasi yang disepakati",
      "Vendor wajib memenuhi standar mutu dan jadwal yang ditetapkan PT SIS",
    ],
    operations: [
      `Lokasi pelaksanaan: ${c.jobsite}`,
      "Laporan pelaksanaan berkala untuk persetujuan PT SIS",
      "Berita Acara sebagai dasar penagihan",
    ],
    legal: [
      "Larangan pengalihan hak/kewajiban tanpa persetujuan tertulis PT SIS",
      "Hukum yang berlaku: Hukum Negara Republik Indonesia",
      "Penyelesaian perselisihan: musyawarah, lalu Pengadilan Negeri Jakarta Selatan",
    ],
  };
}

const CIP_TERMSHEET_TEMPLATE_META = {
  odsFile: "Termsheet.ods",
  odtFile: "Termsheet.odt",
  sheet: "Project_Term_sheet",
  title: "FORMULIR PEMBERITAHUAN DAN PERSETUJUAN",
  company: "ALAMTRI - PT SAPTAINDRA SEJATI",
};
const CIP_TERMSHEET_TEMPLATE_FIELDS = [
  { key: "procurementKind", en: "Procurement type", id: "Jenis Pengadaan", type: "select", required: true, row: 4, options: ["Barang", "Jasa"] },
  { key: "transaction", en: "Transaction", id: "Transaksi", type: "text", required: true, row: 6 },
  { key: "counterpart", en: "Counterpart", id: "Counterpart", type: "text", required: true, row: 7 },
  { key: "periodStart", en: "Procurement period start", id: "Awal jangka waktu", type: "date", required: true, row: 9 },
  { key: "periodEnd", en: "Procurement period end", id: "Akhir jangka waktu", type: "date", required: true, row: 9 },
  { key: "processType", en: "Appointment process", id: "Proses penunjukan", type: "select", required: true, row: 10, options: ["Tender", "Pemilihan Langsung", "Penunjukkan Langsung"] },
  { key: "termOfPayment", en: "Term of payment", id: "Term of Payment", type: "text", required: true, row: 11 },
  { key: "paymentMethod", en: "Payment method", id: "Cara Pembayaran", type: "text", required: true, row: 12 },
  { key: "scope", en: "Transaction scope", id: "Ruang Lingkup Transaksi", type: "textarea", required: true, row: 13 },
  { key: "attachmentNote", en: "Attachment note", id: "Lampiran Form", type: "textarea", required: true, row: 14 },
  { key: "governingLaw", en: "Governing law", id: "Hukum Yang Berlaku", type: "text", required: true, row: 15 },
  { key: "businessNotes", en: "Description", id: "Keterangan", type: "textarea", required: true, row: 16 },
];

function cipTemplateDate(value) {
  if (!value) return "";
  return typeof fmtAppDate === "function" ? fmtAppDate(value) : String(value);
}
function cipDateOnly(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function cipAddMonths(dateStr, months) {
  const base = cipDateOnly(dateStr);
  if (!base) return "";
  const d = new Date(`${base}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + (Number(months) || 0));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function cipTermsheetPeriodDefaults(c) {
  const lead = c && c.lead ? CIP_LEAD_LOA : null;
  if (lead) return { periodStart: lead.periodStart, periodEnd: lead.periodEnd };
  const start = cipDateOnly((c && c.createdAt) || CIP_TODAY) || CIP_TODAY;
  const end = cipDateOnly((c && (c.requirementDate || c.estimatedFinishDate)) || "") || cipAddMonths(start, 12);
  return { periodStart: start, periodEnd: end };
}
function cipMonthsBetween(start, end) {
  const a = start ? new Date(start) : null;
  const b = end ? new Date(end) : null;
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}
function cipProcessTypeFromMethod(method) {
  const m = String(method || "").toLowerCase();
  if (m.includes("tender") || m.includes("open")) return "Tender";
  if (m.includes("appointment") || m.includes("penunj")) return "Penunjukkan Langsung";
  return "Pemilihan Langsung";
}
function cipProcurementKindFromTitle(title) {
  return /jasa|service|layanan|sewa|rental|maintenance|pemeliharaan|perawatan/i.test(String(title || "")) ? "Jasa" : "Barang";
}
function cipLooksLikeCaseKeyTitle(value, c) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (typeof trkIsCipCaseKey === "function" && trkIsCipCaseKey(raw)) return true;
  const caseId = String((c && (c.id || c.caseKey)) || "").trim();
  return !!(caseId && raw.toLowerCase() === caseId.toLowerCase());
}
function cipTermsheetTitleForCase(c) {
  if (!c) return "";
  let proposalTitle = "";
  try {
    const store = typeof trkReadStore === "function" ? trkReadStore() : null;
    const keys = [c && c.proposalId, c && c.proposalKey, c && c.proposalNumber]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    const proposal = store && keys.length
      ? (store.proposals || []).find((row) => keys.includes(String(row.id || "").trim().toLowerCase())
        || keys.includes(String(row.proposalNumber || "").trim().toLowerCase()))
      : null;
    proposalTitle = (proposal && proposal.title) || "";
  } catch (e) {
    proposalTitle = "";
  }
  const loa = cipLoaFor(c);
  const payload = (c && (c.awardPayload || c.loaPayload)) || {};
  const candidates = [
    proposalTitle,
    loa && loa.subject,
    payload.letterSubject,
    payload.procurementSubject,
    payload.proposalTitle,
    c && c.title,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = String(candidates[i] || "").trim();
    if (value && !cipLooksLikeCaseKeyTitle(value, c)) return value;
  }
  return String(proposalTitle || (c && c.title) || "").trim();
}
function cipTermsheetTransactionSeed(c, existing) {
  const current = String(existing || "").trim();
  if (current && !cipLooksLikeCaseKeyTitle(current, c)) return current;
  return cipTermsheetTitleForCase(c) || current;
}
function cipTermsheetBaseForm(c) {
  const lead = c && c.lead ? CIP_LEAD_LOA : null;
  const periods = cipTermsheetPeriodDefaults(c);
  const title = cipTermsheetTitleForCase(c);
  return {
    termsheetNo: c && c.lead ? "1/DOA/JAHO/SRC-CM/HR/I/2026" : ((c && c.termsheetNo) || `TS/${(c && c.id) || "CIP"}`),
    procurementKind: cipProcurementKindFromTitle(title || (c && c.title)),
    valueMode: "Value",
    transaction: title || "",
    counterpart: (c && c.vendor) || "",
    totalValueIdr: Number(c && c.value) || 0,
    usdRate: CIP_USD_RATE,
    periodStart: periods.periodStart,
    periodEnd: periods.periodEnd,
    processType: cipProcessTypeFromMethod(c && c.method),
    termOfPayment: "N30",
    paymentMethod: "Dibayarkan per-bulan",
    scope: (lead && lead.scope) || (c && c.title) || "",
    attachmentNote: "Terlampir pada halaman selanjutnya dan menjadi satu kesatuan dengan halaman ini",
    governingLaw: "Hukum Negara Republik Indonesia",
    businessNotes: c && c.lead ? "No NIB. 1303260116007 - Aktivitas Penyedia Gabungan Jasa Penunjang Fasilitas" : "",
    jobsite: (lead && lead.jobsite) || (c && c.jobsite) || "",
    requestorName: (c && c.requestor) || "",
    preparedByName: (c && c.procurement) || "Contract Monitoring Officer",
    preparedByTitle: "Contract Monitoring",
  };
}
function cipTermsheetInitialForm(c, overrides) {
  return { ...cipTermsheetBaseForm(c), ...((c && c.termsheetPayload) || {}), ...(overrides || {}) };
}
function cipTermsheetPeriodText(payload) {
  const months = Number(payload.durationMonths) || cipMonthsBetween(payload.periodStart, payload.periodEnd);
  const range = payload.periodStart && payload.periodEnd ? `${cipTemplateDate(payload.periodStart)} - ${cipTemplateDate(payload.periodEnd)}` : "";
  return [range, months ? `(${months} bulan)` : ""].filter(Boolean).join(" ");
}
function cipBuildTermsheetSections(c, payload) {
  const months = Number(payload.durationMonths) || cipMonthsBetween(payload.periodStart, payload.periodEnd) || 12;
  const monthly = Math.round((Number(payload.totalValueIdr) || 0) / Math.max(months, 1));
  return {
    commercial: [
      { label: "Jenis Pengadaan", value: payload.transaction },
      { label: "Jangka Waktu", value: payload.periodText || "Menunggu kelengkapan data" },
      { label: "Estimasi Nilai Perjanjian", value: trkRp(payload.totalValueIdr) },
      { label: "Termin Pembayaran", value: payload.termOfPayment },
      { label: "Cara Pembayaran", value: payload.paymentMethod },
      { label: "Mata Uang", value: "Rupiah (IDR)" },
    ],
    lineItems: [{ desc: payload.scope || payload.transaction, monthly, qty: months }],
    priceIncludes: ["PPh", "Mobilisasi & demobilisasi", "APD dan perlengkapan kerja standar"],
    priceExcludes: ["PPN", "Pekerjaan tambah di luar ruang lingkup"],
    technical: [
      payload.scope || "Spesifikasi teknis mengacu pada dokumen tender dan klarifikasi yang disepakati",
      "Vendor wajib memenuhi standar mutu dan jadwal yang ditetapkan PT SIS",
    ],
    operations: [
      `Lokasi pelaksanaan: ${payload.jobsite || (c && c.jobsite) || "-"}`,
      "Laporan pelaksanaan berkala untuk persetujuan PT SIS",
      "Berita Acara sebagai dasar penagihan",
    ],
    legal: [
      payload.governingLaw || "Hukum Negara Republik Indonesia",
      "Larangan pengalihan hak/kewajiban tanpa persetujuan tertulis PT SIS",
      "Penyelesaian perselisihan: musyawarah, lalu Pengadilan Negeri Jakarta Selatan",
    ],
  };
}
function cipBuildTermsheetPayload(c, overrides) {
  const form = cipTermsheetInitialForm(c, overrides);
  const totalValueIdr = Number(form.totalValueIdr || (c && c.value)) || 0;
  const usdRate = Number(form.usdRate) || CIP_USD_RATE;
  const authorization = cipAuthorizationForCase({ ...(c || {}), value: totalValueIdr }, usdRate);
  const periodText = cipTermsheetPeriodText(form);
  const totalValueText = `Estimated ${trkRp(totalValueIdr)} (Eqv USD ${cipUsdValue(totalValueIdr, usdRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) 1USD=IDR ${usdRate.toLocaleString("id-ID")}`;
  const payload = {
    ...form,
    totalValueIdr,
    usdRate,
    periodText,
    totalValueText,
    bandKey: authorization.band.key,
    bandCode: authorization.band.code,
    bandLabel: authorization.band.label,
    authorization,
  };
  return { ...payload, sections: cipBuildTermsheetSections(c, payload) };
}
function cipTermsheetMissingFields(c, payload) {
  const p = payload || cipBuildTermsheetPayload(c);
  return CIP_TERMSHEET_TEMPLATE_FIELDS.filter((field) => field.required && !String(p[field.key] == null ? "" : p[field.key]).trim());
}
function cipPdfPlain(value) {
  return String(value == null ? "" : value)
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}
function cipPdfEscape(value) {
  return cipPdfPlain(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function cipPdfTextWidth(text, size) {
  return cipPdfPlain(text).split("").reduce((sum, char) => sum + (char === " " ? size * 0.28 : /[A-Z0-9]/.test(char) ? size * 0.62 : size * 0.5), 0);
}
function cipPdfWrapText(text, size, maxWidth) {
  const rows = [];
  cipPdfPlain(text).replace(/\r/g, "").split("\n").forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      rows.push("");
      return;
    }
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (cipPdfTextWidth(candidate, size) <= maxWidth) {
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
function cipBuildTermsheetTemplatePdfDataUri(c, payload) {
  const p = payload || cipBuildTermsheetPayload(c);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const commands = [];
  const num = (value) => Number(value).toFixed(2);
  const rgb = (hex) => {
    const clean = String(hex || "#000000").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((ch) => ch + ch).join("") : clean.padEnd(6, "0").slice(0, 6);
    return [0, 2, 4].map((i) => (parseInt(full.slice(i, i + 2), 16) / 255).toFixed(3)).join(" ");
  };
  const top = (y) => pageHeight - y;
  const fillCmd = (color) => `${rgb(color)} rg`;
  const strokeCmd = (color) => `${rgb(color)} RG`;
  const rect = (x, y, w, h, options) => {
    const opts = options || {};
    const pdfY = pageHeight - y - h;
    if (opts.fill) commands.push(`q ${fillCmd(opts.fill)} ${num(x)} ${num(pdfY)} ${num(w)} ${num(h)} re f Q`);
    if (opts.stroke !== false) commands.push(`q ${strokeCmd(opts.stroke || "#000000")} ${num(opts.lineWidth || 0.75)} w ${num(x)} ${num(pdfY)} ${num(w)} ${num(h)} re S Q`);
  };
  const line = (x1, y1, x2, y2, options) => {
    const opts = options || {};
    commands.push(`q ${strokeCmd(opts.color || "#000000")} ${num(opts.width || 0.75)} w ${num(x1)} ${num(top(y1))} m ${num(x2)} ${num(top(y2))} l S Q`);
  };
  const text = (value, x, y, options) => {
    const opts = options || {};
    const size = opts.size || 7.5;
    const lineHeight = opts.lineHeight || size + 1.6;
    const maxWidth = opts.maxWidth || 500;
    const font = opts.bold ? "F2" : opts.italic ? "F3" : "F1";
    const rows = cipPdfWrapText(value, size, maxWidth);
    rows.forEach((row, index) => {
      const tx = opts.align === "right" ? x - cipPdfTextWidth(row, size) : opts.align === "center" ? x - (cipPdfTextWidth(row, size) / 2) : x;
      commands.push(`BT ${fillCmd(opts.color || "#000000")} /${font} ${num(size)} Tf 1 0 0 1 ${num(tx)} ${num(pageHeight - (y + index * lineHeight) - size)} Tm (${cipPdfEscape(row)}) Tj ET`);
    });
    return rows.length * lineHeight;
  };
  const checkbox = (x, y, label, checked, options) => {
    const opts = options || {};
    rect(x, y, opts.size || 6, opts.size || 6, { lineWidth: 0.65 });
    if (checked) {
      line(x + 1.2, y + 3.3, x + 2.5, y + 5.2, { width: 0.8 });
      line(x + 2.5, y + 5.2, x + 5.4, y + 1.2, { width: 0.8 });
    }
    if (label) text(label, x + (opts.size || 6) + 3, y - 0.3, { size: opts.labelSize || 6.1, maxWidth: opts.maxWidth || 70 });
  };
  const valueBandOptions = ["Transactional D", "A - Medium", "High", "Material"];
  const selectedValueLabel = valueBandOptions.includes(p.bandCode) ? p.bandCode : p.bandCode || p.bandLabel;
  const field = (label, value, y, options) => {
    const opts = options || {};
    text(label, 22, y, { size: 7.4, bold: true, maxWidth: 118 });
    text(":", 150, y, { size: 7.4, bold: true, maxWidth: 5 });
    const used = text(value || "-", 158, y, { size: opts.size || 7.2, maxWidth: opts.maxWidth || 392, lineHeight: opts.lineHeight || 8.7 });
    return y + Math.max(opts.minHeight || 9.2, used);
  };
  const section = (label, y) => {
    rect(17, y, 560, 12, { fill: "#F2F0EA", lineWidth: 0.75 });
    text(label, pageWidth / 2, y + 2.4, { size: 7.3, bold: true, align: "center", maxWidth: 320 });
  };
  const signatureBox = (x, y, w, h, signer, caption) => {
    rect(x, y, w, h, { lineWidth: 0.65 });
    if (caption) text(caption, x + 5, y + 5, { size: 5.7, bold: true, maxWidth: w - 10 });
    line(x + 16, y + h - 26, x + w - 16, y + h - 26, { color: "#2E5AAC", width: 0.6 });
    text(`Nama : ${(signer && signer.defaultName) || "-"}`, x + 5, y + h - 22, { size: 5.4, maxWidth: w - 10 });
    text(`Posisi : ${(signer && signer.defaultTitle) || (signer && signer.label) || "-"}`, x + 5, y + h - 15, { size: 5.1, maxWidth: w - 10 });
    text("Tgl. :", x + 5, y + h - 8, { size: 5.1, maxWidth: w - 10 });
  };

  rect(16, 24, 562, 786, { lineWidth: 1.35 });
  text(p.termsheetNo || "", 560, 28, { size: 5.7, align: "right", maxWidth: 150 });
  text(CIP_TERMSHEET_TEMPLATE_META.title, pageWidth / 2, 42, { size: 10.8, bold: true, align: "center", maxWidth: 360 });
  line(222, 54, 373, 54, { width: 0.65 });
  text(CIP_TERMSHEET_TEMPLATE_META.company, pageWidth / 2, 55, { size: 10, bold: true, align: "center", maxWidth: 360 });

  rect(17, 78, 560, 18, { lineWidth: 0.75 });
  text("Jenis Pengadaan", 22, 83, { size: 6.8, bold: true, maxWidth: 98 });
  text(":", 150, 83, { size: 6.8, bold: true, maxWidth: 5 });
  checkbox(163, 84, "Barang", p.procurementKind === "Barang", { labelSize: 5.8 });
  checkbox(215, 84, "Jasa", p.procurementKind === "Jasa", { labelSize: 5.8 });
  text("Value:", 340, 83, { size: 6.8, bold: true, maxWidth: 34 });
  checkbox(377, 84, selectedValueLabel, true, { labelSize: 5.8, maxWidth: 128 });

  section("PERSETUJUAN TRANSAKSI", 96);
  let y = 113;
  y = field("Transaksi", p.transaction, y);
  y = field("Counterpart", p.counterpart, y);
  y = field("Total Nilai Transaksi", p.totalValueText, y, { size: 6.7 });
  y = field("Jangka Waktu Pengadaan", p.periodText || "-", y);
  text("Proses Penunjukan", 22, y, { size: 7.4, bold: true, maxWidth: 118 });
  text(":", 150, y, { size: 7.4, bold: true, maxWidth: 5 });
  checkbox(158, y + 0.5, "Tender", p.processType === "Tender", { labelSize: 5.7, maxWidth: 55 });
  checkbox(240, y + 0.5, "Pemilihan Langsung", p.processType === "Pemilihan Langsung", { labelSize: 5.7, maxWidth: 95 });
  checkbox(388, y + 0.5, "Penunjukkan Langsung", p.processType === "Penunjukkan Langsung", { labelSize: 5.7, maxWidth: 115 });
  y += 10.5;
  y = field("Term of Payment", p.termOfPayment, y);
  y = field("Cara Pembayaran", p.paymentMethod, y);
  y = field("Ruang Lingkup Transaksi", p.scope, y, { size: 6.8, maxWidth: 392, lineHeight: 8.3 });
  y = field("Lampiran Form", p.attachmentNote, y, { size: 6.8, maxWidth: 392, lineHeight: 8.3 });
  y = field("Hukum Yang Berlaku", p.governingLaw, y);
  y = field("Keterangan", p.businessNotes || "-", y, { size: 6.5, maxWidth: 392, lineHeight: 7.7, minHeight: 18 });

  section("Matrix Authorization", 294);
  rect(17, 306, 560, 146, { lineWidth: 0.75 });
  const roles = ((p.authorization && p.authorization.roles) || []).filter((r) => r.state).slice(0, 7);
  const matrixX = 224;
  const matrixY = 330;
  const matrixW = 136;
  const rowH = 13;
  rect(matrixX, matrixY, matrixW, 12, { fill: "#D8DEE3", lineWidth: 0.6 });
  text("Term Sheet", matrixX + matrixW / 2, matrixY + 2.6, { size: 6, bold: true, align: "center", maxWidth: matrixW - 4 });
  roles.forEach((role, index) => {
    const ry = matrixY + 12 + index * rowH;
    rect(matrixX, ry, matrixW, rowH, { fill: index % 2 ? "#EFF3F5" : "#FFFFFF", lineWidth: 0.45, stroke: "#7A8790" });
    text(role.label, matrixX + 4, ry + 3, { size: 4.9, bold: role.state === "required" || role.state === "board", maxWidth: 88 });
    rect(matrixX + matrixW - 22, ry + 3.2, 6, 6, { fill: role.state === "ack" ? "#FFFFFF" : "#0B84C6", stroke: "#064B76", lineWidth: 0.55 });
  });
  text("1", 395, 326, { size: 86, bold: true, color: "#A1A6AA", maxWidth: 80 });
  text("Pada saat Direktur Procurement menjadi User, maka posisi Direktur Procurement digantikan oleh posisi Direktur Finance dalam proses approvalnya.", 396, 323, { size: 5.4, maxWidth: 145, lineHeight: 6.5 });
  text("Term Sheet Ditetapkan oleh :", 86, 382, { size: 5.4, bold: true, maxWidth: 120 });
  signatureBox(72, 397, 138, 35, { defaultName: p.preparedByName || c.requestor || "-", defaultTitle: p.preparedByTitle || "Contract Monitoring" }, "Paraf");

  text("Authorization:", 21, 461, { size: 7.2, bold: true, maxWidth: 100 });
  line(21, 472, 78, 472, { width: 0.55 });
  text("Diperiksa dan diajukan oleh :", 21, 477, { size: 6.6, bold: true, maxWidth: 160 });
  const signers = (p.authorization && p.authorization.signers) || [];
  const prepared = signers.filter((s) => s.group === "prepared");
  const submitted = signers.filter((s) => s.group === "submitted");
  const approved = signers.filter((s) => s.group === "approved" || s.group === "noted");
  const firstRow = (prepared.length ? prepared : [{ defaultName: p.preparedByName || c.procurement || "-", defaultTitle: p.preparedByTitle || "Contract Monitoring", label: "Prepared by" }]).concat(submitted).slice(0, 3);
  const secondRow = approved.length ? approved.slice(0, 3) : signers.slice(firstRow.length, firstRow.length + 3);
  firstRow.forEach((signer, index) => signatureBox(22 + index * 176, 499, 154, 96, signer, index === 0 ? "Term Sheet Diajukan oleh" : ""));
  text("Diketahui dan Disetujui oleh :", 21, 614, { size: 6.6, bold: true, maxWidth: 160 });
  secondRow.forEach((signer, index) => signatureBox(22 + index * 176, 636, 154, 96, signer, ""));
  text("Note: Disesuaikan dengan matrix authorization dan Struktur Organisasi yang berlaku", 22, 790, { size: 4.8, italic: true, color: "#444444", maxWidth: 400 });

  const stream = commands.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n`,
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>\nendobj\n",
    `7 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
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
function cipBuildTermsheetPdfLines(c, payload) {
  const p = payload || cipBuildTermsheetPayload(c);
  const signers = (p.authorization && p.authorization.signers) || [];
  return [
    CIP_TERMSHEET_TEMPLATE_META.title,
    CIP_TERMSHEET_TEMPLATE_META.company,
    `Template: ${CIP_TERMSHEET_TEMPLATE_META.odsFile} / ${CIP_TERMSHEET_TEMPLATE_META.sheet}`,
    `No: ${p.termsheetNo}`,
    `Jenis Pengadaan: ${p.procurementKind} | Value: ${p.bandCode}`,
    "PERSETUJUAN TRANSAKSI",
    `Transaksi: ${p.transaction}`,
    `Counterpart: ${p.counterpart}`,
    `Total Nilai Transaksi: ${p.totalValueText}`,
    `Jangka Waktu Pengadaan: ${p.periodText}`,
    `Proses Penunjukan: ${p.processType}`,
    `Term of Payment: ${p.termOfPayment}`,
    `Cara Pembayaran: ${p.paymentMethod}`,
    `Ruang Lingkup Transaksi: ${p.scope}`,
    `Lampiran Form: ${p.attachmentNote}`,
    `Hukum Yang Berlaku: ${p.governingLaw}`,
    `Keterangan: ${p.businessNotes}`,
    "Matrix Authorization Term Sheet:",
    ...signers.map((s, i) => `${i + 1}. ${s.defaultName} - ${s.defaultTitle} (${s.label})`),
  ];
}
/* ---------- Azure Blob document helpers (module: cip, container: app-contractmanagement) ---------- */
async function cipUploadDocument(file, opts) {
  const form = new FormData();
  form.append("file", file);
  if (opts && opts.entityId) form.append("entityId", String(opts.entityId));
  if (opts && opts.docType) form.append("docType", String(opts.docType));
  const res = await fetch("/api/v1/documents/contract-initiation-platform/upload", { method: "POST", credentials: "include", body: form });
  if (!res.ok) {
    const p = await res.json().catch(() => null);
    throw new Error((p && (p.detail || p.title || p.code)) || `Upload failed (${res.status})`);
  }
  return res.json();
}
async function cipDeleteDocument(doc) {
  if (!doc || !doc.blobKey || !doc.container) return;
  const res = await fetch(`/api/v1/documents/contract-initiation-platform?container=${encodeURIComponent(doc.container)}&key=${encodeURIComponent(doc.blobKey)}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}
async function cipUploadDataUri(dataUri, fileName, opts) {
  if (!dataUri) return null;
  const blob = await (await fetch(dataUri)).blob();
  const file = new File([blob], fileName || "document.pdf", { type: blob.type || "application/pdf" });
  return cipUploadDocument(file, opts);
}
async function cipResolveDocumentUrl(doc) {
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
function cipBuildTermsheetDocument(c, overrides) {
  const payload = cipBuildTermsheetPayload(c, overrides);
  const generatedAt = typeof trkNow === "function" ? trkNow() : `${CIP_TODAY} 09:20:00`;
  const fileName = `Termsheet_${(c && c.id) || "CIP"}.pdf`;
  let dataUri = null;
  try { dataUri = cipBuildTermsheetTemplatePdfDataUri(c, payload); } catch (e) { console.warn("Termsheet template PDF failed.", e); }
  if (!dataUri && typeof trkBuildPdfDataUri === "function") dataUri = trkBuildPdfDataUri(`Termsheet ${(c && c.id) || ""}`, cipBuildTermsheetPdfLines(c, payload));
  return { id: `${(c && c.id) || "cip"}-termsheet`, fileName, generatedAt, payload, dataUri };
}
function cipTermsheetUploadError(error) {
  const raw = String((error && error.message) || error || "");
  if (/not configured/i.test(raw) || /503/.test(raw) || /service unavailable/i.test(raw)) {
    return "Document storage is not configured. Term Sheet PDF cannot be saved.";
  }
  return raw || "Termsheet upload failed.";
}
async function cipGenerateTermsheetDocument(caseId, overrides) {
  const snapshot = cipReadStore();
  const target = (snapshot.cases || []).find((c) => c.id === caseId);
  if (!target) throw new Error("Term Sheet case not found.");
  const generated = cipBuildTermsheetDocument(target, overrides);
  if (!generated.dataUri) throw new Error("Termsheet PDF could not be composed.");
  // Upload the generated termsheet PDF to Blob; keep only a reference (no base64 in the DB).
  let upload;
  try {
    upload = await cipUploadDataUri(generated.dataUri, generated.fileName, { entityId: caseId, docType: "termsheet" });
  } catch (e) {
    throw new Error(cipTermsheetUploadError(e));
  }
  if (!upload || !upload.blobKey || !upload.container) {
    throw new Error("Termsheet upload did not return a blob reference.");
  }
  const detail = await cipDomainCommand(cipCaseCommandPath("termsheet/generate", caseId), {
    documentNumber: generated.payload && generated.payload.termsheetNo,
    fileName: generated.fileName,
    generatedAt: generated.generatedAt,
    container: upload.container,
    blobKey: upload.blobKey,
    payload: generated.payload,
  });
  const store = cipUpdateStore((draft) => {
    draft.cases = draft.cases.map((c) => {
      if (c.id !== caseId) return c;
      const next = {
        ...c,
        termsheetPayload: generated.payload,
        termsheetFileName: generated.fileName,
        termsheetGeneratedAt: generated.generatedAt,
        termsheetDataUri: undefined,
        termsheetContainer: upload.container,
        termsheetBlobKey: upload.blobKey,
        termsheetAuthorizationBand: generated.payload && generated.payload.bandKey,
      };
      return Array.isArray(detail && detail.documents) ? cipAttachDomainDocuments(next, detail.documents) : next;
    });
    return draft;
  });
  return { store, document: generated, upload };
}

/* ---------- draft contract generation (Word master + award result + Termsheet) ---------- */
const CIP_DRAFT_TEMPLATE_FIELDS = [
  { key: "contractNo", en: "Contract number", id: "Nomor kontrak", type: "text", required: true, source: "manual" },
  { key: "signPlace", en: "Signing place", id: "Tempat penandatanganan", type: "text", required: true, source: "loa" },
  { key: "signDate", en: "Contract signing date", id: "Tanggal penandatanganan kontrak", type: "date", required: true, source: "manual" },
  { key: "startDate", en: "Contract start date", id: "Tanggal mulai kontrak", type: "date", required: true, source: "manual" },
  { key: "endDate", en: "Contract end date", id: "Tanggal selesai kontrak", type: "date", required: true, source: "manual" },
  { key: "paymentDays", en: "Payment term (calendar days)", id: "Batas pembayaran (hari kalender)", type: "text", required: true, source: "termsheet" },
  { key: "performanceBond", en: "Performance bond (%)", id: "Jaminan pelaksanaan (%)", type: "text", required: true, source: "manual" },
  { key: "warrantyMonths", en: "Warranty period (months)", id: "Masa garansi (bulan)", type: "text", required: true, source: "manual" },
  { key: "vendorSignatoryName", en: "Vendor signatory name", id: "Nama penandatangan vendor", type: "text", required: true, source: "loa" },
  { key: "vendorSignatoryTitle", en: "Vendor signatory title", id: "Jabatan penandatangan vendor", type: "text", required: true, source: "loa" },
  { key: "additionalClause", en: "Additional clause note", id: "Catatan pasal tambahan", type: "textarea", required: false, source: "manual" },
];

function cipLoaFor(c) {
  if (c && c.lead) return CIP_LEAD_LOA;
  const payload = (c && (c.loaPayload || c.awardPayload)) || {};
  return {
    number: payload.loaNumber || c.loaNo,
    date: payload.letterDate || c.createdAt,
    to: payload.vendorName || c.vendor,
    from: "PT Saptaindra Sejati",
    subject: payload.letterSubject || payload.procurementSubject || c.title,
    vendorAddress: payload.vendorAddress || "-",
    scope: payload.procurementSubject || c.title,
    jobsite: c.jobsite, periodStart: "", periodEnd: "", durationMonths: 12,
    value: payload.awardValue || c.value,
    awardPercent: payload.awardPercent || c.awardPercent || 100,
    method: c.method || "Direct Selection",
    preparedBy: c.requestor,
    attachmentDescription: payload.attachmentDescription || "-",
    sisSignatoryName: payload.sisSignatoryName || c.requestor || "-",
    vendorDirectorName: payload.vendorDirectorName || "-",
  };
}

function cipDraftPrefillFromSources(c) {
  const L = cipLoaFor(c);
  const TS = cipBuildTermsheetPayload(c, c.termsheetPayload);
  const paymentMatch = String(TS.termOfPayment || "").match(/\d+/);
  return {
    contractNo: c.contractNo || `CTR/${String(c.loaNo || c.id || "CIP").replace(/\//g, "-")}`,
    signPlace: c.jobsite || L.jobsite || "",
    signDate: "",
    startDate: L.periodStart || "",
    endDate: L.periodEnd || "",
    paymentDays: paymentMatch ? paymentMatch[0] : "",
    performanceBond: "5",
    warrantyMonths: "12",
    vendorSignatoryName: L.vendorDirectorName || "",
    vendorSignatoryTitle: "Direktur",
    additionalClause: "",
  };
}
function cipDraftInitialForm(c, overrides) {
  return { ...cipDraftPrefillFromSources(c), ...((c && c.draftPayload) || {}), ...(overrides || {}) };
}
function cipBuildDraftPayload(c, templateCode, overrides) {
  const tpl = templateCode ? CIP_TEMPLATE[templateCode] : null;
  const form = cipDraftInitialForm(c, overrides);
  const L = cipLoaFor(c);
  const TS = cipBuildTermsheetPayload(c, c.termsheetPayload);
  return {
    ...form,
    templateCode: templateCode || (c && c.template) || "",
    templateTitle: tpl ? tpl.id : "",
    vendor: (c && c.vendor) || L.to || "",
    subject: (c && c.title) || TS.transaction || L.subject || "",
    jobsite: form.signPlace || (c && c.jobsite) || L.jobsite || "",
    contractValue: Number((c && c.value) || L.value) || 0,
    periodText: TS.periodText || "",
    scope: TS.scope || L.subject || (c && c.title) || "",
    termOfPayment: TS.termOfPayment || "",
    governingLaw: TS.governingLaw || "Hukum Negara Republik Indonesia",
  };
}
function cipDraftMissingFields(c, templateCode, payload) {
  const p = payload || cipBuildDraftPayload(c, templateCode);
  return CIP_DRAFT_TEMPLATE_FIELDS.filter((field) => field.required && !String(p[field.key] == null ? "" : p[field.key]).trim());
}
function cipBuildDraftPdfLines(c, templateCode, payload) {
  const p = payload || cipBuildDraftPayload(c, templateCode);
  const tpl = CIP_TEMPLATE[p.templateCode || templateCode];
  return [
    tpl ? tpl.id : "Draft Contract",
    `Template: ${p.templateCode || templateCode || "-"}`,
    `No: ${p.contractNo}`,
    `Between PT SAPTAINDRA SEJATI and ${String(p.vendor || "").toUpperCase()}`,
    `Subject: ${p.subject}`,
    `Location: ${p.jobsite}`,
    `Contract value: ${trkRp(p.contractValue)} (excl. VAT)`,
    `Period: ${p.periodText || "-"}`,
    `Payment: within ${p.paymentDays} calendar days after complete invoice`,
    `Performance bond: ${p.performanceBond}%`,
    `Warranty: ${p.warrantyMonths} months`,
    `Governing law: ${p.governingLaw}`,
    `Signing: ${p.signPlace}, ${cipTemplateDate(p.signDate)}`,
    `Vendor signatory: ${p.vendorSignatoryName} (${p.vendorSignatoryTitle})`,
    p.additionalClause ? `Additional note: ${p.additionalClause}` : "",
    "Generated from award result + Term Sheet merge into Word master template.",
  ].filter(Boolean);
}
/* ---- dependency-free .docx builder (a .docx is a ZIP of OOXML parts) ---- */
const CIP_CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function cipCrc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CIP_CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function cipZipStore(files) {
  // files: [{ name, data: Uint8Array }] → store-only (uncompressed) ZIP Uint8Array.
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  files.forEach((f) => {
    const nameBytes = enc.encode(f.name);
    const crc = cipCrc32(f.data);
    const size = f.data.length;
    const local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0));
    chunks.push(new Uint8Array(local), nameBytes, f.data);
    central.push({ nameBytes, crc, size, offset });
    offset += local.length + nameBytes.length + size;
  });
  const cdStart = offset;
  let cdSize = 0;
  central.forEach((e) => {
    const head = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(e.crc), u32(e.size), u32(e.size), u16(e.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.offset));
    const arr = new Uint8Array(head.length + e.nameBytes.length);
    arr.set(head, 0); arr.set(e.nameBytes, head.length);
    chunks.push(arr);
    cdSize += arr.length;
  });
  chunks.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0))));
  let total = 0; chunks.forEach((c) => (total += c.length));
  const out = new Uint8Array(total);
  let pos = 0; chunks.forEach((c) => { out.set(c, pos); pos += c.length; });
  return out;
}
function cipXmlEscape(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function cipBuildDocxBlob(paragraphs) {
  const enc = new TextEncoder();
  const body = (paragraphs || []).map((p) => {
    const text = typeof p === "string" ? p : p.text;
    const bold = typeof p === "object" && p.bold;
    const rPr = bold ? "<w:rPr><w:b/></w:rPr>" : "";
    return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${cipXmlEscape(text)}</w:t></w:r></w:p>`;
  }).join("");
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const zip = cipZipStore([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(document) },
  ]);
  return new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
function cipBuildDraftDocxParagraphs(c, code, payload) {
  const tpl = CIP_TEMPLATE[payload.templateCode || code];
  const lines = cipBuildDraftPdfLines(c, code, payload);
  // First line is the title (bold), the rest as normal paragraphs.
  return lines.map((line, i) => ({ text: line, bold: i === 0 }));
}
/* ---- template-merge: CIP template code → server-side .docx key + token dictionary ---- */
const CIP_SIS_ENTITY = "Saptaindra Sejati";    // {{ENTITAS_SIS}} — template prints "PT {{ENTITAS_SIS}}"
const CIP_SIS_DOMICILE = "Jakarta Selatan";    // {{DOMISILI_PIHAK1}} — SIS domicile
const CIP_TEMPLATE_MERGE_KEYS = {
  "TK-01": "01-amandemen-perjanjian",
  "TK-02": "02-perjanjian-jasa-konsultan",
  "TK-03": "03-perjanjian-jasa-nonkonsultan",
  "TK-04": "04-perjanjian-jasa-penanaman-pemeliharaan",
  "TK-05": "05-sewa-bangunan-mess-rumah",
  "TK-06": "06-sewa-menyewa-umum",
  "TK-07": "07-penyediaan-jasa-pekerja",
  "TK-08": "08-sewa-kendaraan-tanpa-pengemudi",
  "TK-09": "09-jasa-kendaraan-dengan-pengemudi",
  "TK-10": "10-jual-beli-putus",
  "TK-11": "11-jasa-penyediaan-pengoperasian-alat",
  "TK-12": "12-rancang-bangun-pembangunan",
  "TK-13": "13-jasa-penyediaan-makanan",
  "TK-14": "14-jasa-pengelolaan-limbah-b3",
  "TK-15": "15-pemborongan-pekerjaan",
  "TK-16": "16-sewa-alat-tanpa-operator",
  "TK-17": "17-jual-beli-alat-berat-penjual",
  "TK-18": "18-jual-beli-alat-berat-pembeli",
  "TK-19": "19-jual-beli-alat-baru-pembeli",
  "TK-20": "20-penyediaan-suku-cadang-vhs",
  "TK-21": "21-penyediaan-suku-cadang-consignment",
  "TK-22": "22-jual-beli-fixed-price",
  "TK-23": "23-nda-pengungkap-informasi",
};
function cipContractTemplateKey(code) {
  return CIP_TEMPLATE_MERGE_KEYS[code] || null;
}
// Build the full token set for a template-backed contract. Vendor identity comes from the award result,
// the SIS (Pihak Pertama) signatories from the contract signing matrix (by value band), the
// service object/location from the case, and the dates/contract number from the draft form.
function cipBuildContractTokens(c, code, payload) {
  const p = payload || cipBuildDraftPayload(c, code);
  const L = cipLoaFor(c);
  const signing = cipContractSigningForCase(c, CIP_USD_RATE);
  const sis = (signing && signing.signers) || [];
  const s1 = sis[0] || {};
  const s2 = sis[1] || {};
  const vendorDomicile = L.vendorAddress && L.vendorAddress !== "-" ? L.vendorAddress : "";
  const startDate = cipTemplateDate(p.startDate);
  const endDate = cipTemplateDate(p.endDate);
  const signDate = cipTemplateDate(p.signDate);
  const subject = p.subject || p.scope || "";
  return {
    NOMOR_KONTRAK: p.contractNo || "",
    OBJEK_JASA: subject,
    // The updated ContractTemplates use {{JUDUL_PENGADAAN}} (not OBJEK_JASA) for the contract subject.
    JUDUL_PENGADAAN: subject,
    TGL_TTD: signDate,
    TGL_MULAI: startDate,
    TGL_SELESAI: endDate,
    // Template aliases for the same dates (templates predominantly use TANGGAL_* / *_RILIS).
    TANGGAL_EFEKTIF: startDate,
    TANGGAL_BERAKHIR: endDate,
    TANGGAL_RILIS: signDate,
    TGL_RILIS: signDate,
    LOKASI_JASA: p.jobsite || p.signPlace || "",
    ENTITAS_SIS: CIP_SIS_ENTITY,
    DOMISILI_PIHAK1: CIP_SIS_DOMICILE,
    NAMA_TTD_PIHAK1: s1.defaultName || "",
    JABATAN_TTD_PIHAK1: s1.defaultTitle || "",
    NAMA_TTD_PIHAK1_2: s2.defaultName || "",
    JABATAN_TTD_PIHAK1_2: s2.defaultTitle || "",
    NAMA_VENDOR: p.vendor || L.to || "",
    DOMISILI_VENDOR: vendorDomicile,
    NAMA_TTD_VENDOR: p.vendorSignatoryName || L.vendorDirectorName || "",
    JABATAN_TTD_VENDOR: p.vendorSignatoryTitle || "Direktur",
  };
}
function cipBuildDraftDocument(c, templateCode, overrides) {
  const payload = cipBuildDraftPayload(c, templateCode, overrides);
  const code = payload.templateCode || templateCode;
  const generatedAt = typeof trkNow === "function" ? trkNow() : `${CIP_TODAY} 09:20:00`;
  const fileName = `Draft_${code || "Contract"}_${(c && c.id) || "CIP"}.pdf`;
  const docxFileName = `Draft_${code || "Contract"}_${(c && c.id) || "CIP"}.docx`;
  let dataUri = null;
  if (typeof trkBuildPdfDataUri === "function") dataUri = trkBuildPdfDataUri(`Draft Contract ${(c && c.id) || ""}`, cipBuildDraftPdfLines(c, code, payload));
  let docxBlob = null;
  try { docxBlob = cipBuildDocxBlob(cipBuildDraftDocxParagraphs(c, code, payload)); } catch (e) {}
  return { id: `${(c && c.id) || "cip"}-draft`, fileName, docxFileName, generatedAt, payload, dataUri, docxBlob, templateCode: code };
}
async function cipGenerateDraftDocument(caseId, templateCode, overrides) {
  const snapshot = cipReadStore();
  const target = (snapshot.cases || []).find((c) => c.id === caseId);
  if (!target) return { store: snapshot, document: null };
  const generated = cipBuildDraftDocument(target, templateCode, overrides);
  let upload = null;
  try { upload = await cipUploadDataUri(generated.dataUri, generated.fileName, { entityId: caseId, docType: "draft" }); }
  catch (e) { console.warn("Draft upload to Blob failed.", e); }
  // The editable .docx. For template-backed codes (e.g. TK-03), merge the REAL Word template
  // server-side from award result + Term Sheet + Authorization Master + form. Otherwise fall back to the
  // dependency-free summary .docx built client-side.
  let docxUpload = null;
  const mergeKey = cipContractTemplateKey(generated.templateCode);
  if (mergeKey) {
    try {
      const tokens = cipBuildContractTokens(target, generated.templateCode, generated.payload);
      const res = await fetch(cipCaseCommandPath("draft/render", caseId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: mergeKey, fileName: generated.docxFileName, tokens }),
      });
      if (res.ok) docxUpload = await res.json();
      else console.warn("Template merge failed; falling back to summary .docx.", res.status);
    } catch (e) { console.warn("Template merge request failed; falling back to summary .docx.", e); }
  }
  if (!docxUpload) {
    try {
      if (generated.docxBlob) {
        const docxFile = new File([generated.docxBlob], generated.docxFileName, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        docxUpload = await cipUploadDocument(docxFile, { entityId: caseId, docType: "draft-docx" });
      }
    } catch (e) { console.warn("Draft .docx upload to Blob failed.", e); }
  }
  await cipDomainCommand(cipCaseCommandPath("template/select", caseId), { templateCode: generated.templateCode });
  await cipDomainCommand(cipCaseCommandPath("draft/generate", caseId), {
    documentNumber: generated.payload && generated.payload.contractNo,
    fileName: generated.fileName,
    generatedAt: generated.generatedAt,
    container: upload && upload.container,
    blobKey: upload && upload.blobKey,
    payload: generated.payload,
  });
  const store = cipUpdateStore((draft) => {
    draft.cases = draft.cases.map((c) => {
      if (c.id !== caseId) return c;
      return {
        ...c,
        template: generated.templateCode,
        draftPayload: generated.payload,
        draftFileName: generated.fileName,
        draftDocxFileName: generated.docxFileName,
        draftGeneratedAt: generated.generatedAt,
        draftDataUri: undefined,
        draftContainer: upload && upload.container,
        draftBlobKey: upload && upload.blobKey,
        draftDocxContainer: docxUpload && docxUpload.container,
        draftDocxBlobKey: docxUpload && docxUpload.blobKey,
        contractNo: generated.payload.contractNo,
      };
    });
    return draft;
  });
  return { store, document: generated };
}
async function cipUploadFinalContract(caseId, file) {
  const at = typeof trkNow === "function" ? trkNow() : `${CIP_TODAY} 10:00:00`;
  const snapshot = cipReadStore();
  const target = (snapshot.cases || []).find((c) => c.id === caseId);
  if (!target) throw new Error("cip_case_not_found");
  // Upload the signed final contract file to Blob.
  const upload = await cipUploadDocument(file, { entityId: caseId, docType: "final" });
  await cipDomainCommand(cipCaseCommandPath("final-contract", caseId), {
    documentNumber: target.contractNo,
    fileName: upload.fileName || file.name,
    generatedAt: at,
    size: upload.size || file.size || 0,
    container: upload.container,
    blobKey: upload.blobKey,
  });
  let updated = null;
  cipUpdateStore((draft) => {
    draft.cases = draft.cases.map((c) => {
      if (c.id !== caseId) return c;
      updated = {
        ...c,
        finalContractFileName: upload.fileName || file.name,
        finalContractDataUri: undefined,
        finalContractContainer: upload.container,
        finalContractBlobKey: upload.blobKey,
        finalContractUploadedAt: at,
        finalContractSize: upload.size || file.size || 0,
      };
      return updated;
    });
    return draft;
  });
  return updated;
}

/* ---------- seed cases from Proposal Tracker award result ---------- */
const CIP_STORE_VERSION = "tracker-loa-v7";
const CIP_LEGACY_STORE_KEYS = ["ag_cip_store_v1", "ag_cip_store_v2", "ag_cip_store_v3", "ag_cip_store_v4", "ag_cip_store_v5", "ag_cip_store_v6"];
const CIP_SEED_CASES = [];

function cipClearLegacyStoreKeys() {
  try { CIP_LEGACY_STORE_KEYS.forEach((key) => window.__procurementStorage.removeItem(key)); } catch (e) {}
}

function cipTrackerPlanActualFromProposal(proposal) {
  const activities = (proposal && proposal.activities) || [];
  const termStageId = typeof trkStageIdByCode === "function" ? trkStageIdByCode("TERM") : "TERM";
  const contractStageId = typeof trkStageIdByCode === "function" ? trkStageIdByCode("CTR") : "CTR";
  const term = activities.find((a) => a.stageId === termStageId || a.title === "Term Sheet" || a.title === "Termsheet") || null;
  const contract = activities.find((a) => a.stageId === contractStageId || a.title === "Contract") || null;
  const snap = (activity) => activity ? {
    plan: activity.targetDate || "",
    actual: activity.completedAt || "",
    status: activity.status || "",
    title: activity.title || "",
  } : { plan: "", actual: "", status: "", title: "" };
  return { termsheet: snap(term), contract: snap(contract) };
}

/* ---------- persistent CIP store (mirrors the Proposal Tracker store pattern) ---------- */
const CIP_STORE_KEY = "ag_cip_store_v7";
const CIP_EVENT = "ag-cip-store";
let CIP_DOMAIN_CASES = [];
let CIP_DOMAIN_REFRESH = null;

function cipParseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (e) { return {}; }
}
function cipCaseFromDomain(item) {
  const payload = cipParseJson(item && item.payloadJson);
  const terms = cipParseJson(payload.terms || payload.Terms);
  const awardPayload = {
    source: payload.source || payload.Source || "",
    method: payload.method || payload.Method || "",
    procurementType: payload.procurementType || payload.ProcurementType || "",
    vendorId: payload.vendorId || payload.VendorId || (item && item.vendorId),
    vendorName: payload.vendorName || payload.VendorName || (item && item.vendorName),
    awardValue: payload.awardValue || payload.AwardValue || (item && item.value),
    awardPercent: payload.awardPercent || payload.AwardPercent || (item && item.awardPercent),
    ...terms,
    vendorAddress: payload.vendorAddress || payload.VendorAddress || terms.vendorAddress || terms.VendorAddress || "",
    awardSourceDocument: payload.awardSourceDocument || payload.AwardSourceDocument || terms.awardSourceDocument || null,
    winnerBidDocument: payload.winnerBidDocument || payload.WinnerBidDocument || terms.winnerBidDocument || null,
  };
  const trackerDates = item && (item.termsheetTrackerDate || item.contractTrackerDate) ? {
    termsheet: item.termsheetTrackerDate || { plan: "", actual: "", status: "", title: "" },
    contract: item.contractTrackerDate || { plan: "", actual: "", status: "", title: "" },
  } : null;
  return cipNormalizeCaseForCurrentFlow({
    id: item.caseKey || item.CaseKey,
    loaKey: item.loaKey || null,
    loaNo: item.loaNumber || "",
    title: item.title || item.caseKey,
    vendorId: item.vendorId || awardPayload.vendorId || "",
    vendor: item.vendorName || awardPayload.vendorName || "",
    jobsite: item.jobsite || awardPayload.jobsite || "",
    department: item.department || "",
    value: Number(item.value || awardPayload.awardValue) || 0,
    proposalTotalValue: Number(item.proposalTotalValue) || Number(item.value) || 0,
    awardPercent: Number(item.awardPercent || awardPayload.awardPercent) || 100,
    stage: item.stage || "termsheet",
    status: item.status || cipStatusForStage(item.stage || "termsheet"),
    template: item.template || "",
    requestor: item.requestor || "",
    procurement: item.procurement || "",
    legal: item.legal || "",
    createdAt: item.createdAtDate || CIP_TODAY,
    source: item.source || "tracker-award",
    proposalId: item.proposalKey || payload.proposalKey || payload.ProposalKey || "",
    proposalNumber: item.proposalNumber || awardPayload.proposalNumber || "",
    termsheetNo: item.termsheetNumber || "",
    contractNo: item.contractNumber || "",
    requirementDate: item.requirementDate || "",
    estimatedFinishDate: item.estimatedFinishDate || "",
    trackerDates,
    termsheetActivityCompletedAt: item.termsheetActivityCompletedAt || null,
    contractActivityCompletedAt: item.contractActivityCompletedAt || null,
    method: awardPayload.method || awardPayload.procurementType || "",
    awardPayload,
    _domain: true,
  });
}
function cipKeepExistingBlob(local, domain, prefix) {
  const blobField = `${prefix}BlobKey`;
  if (domain[blobField] || !local[blobField]) return {};
  return {
    [blobField]: local[blobField],
    [`${prefix}Container`]: local[`${prefix}Container`] || domain[`${prefix}Container`] || null,
    [`${prefix}FileName`]: domain[`${prefix}FileName`] || local[`${prefix}FileName`],
  };
}
function cipMergeDomainCases(localCases, domainCases) {
  const domainById = new Map((domainCases || []).map((c) => [c.id, c]));
  const merged = (localCases || []).map((c) => {
    const domain = domainById.get(c.id);
    if (!domain) return c;
    domainById.delete(c.id);
    return cipNormalizeCaseForCurrentFlow({
      ...c,
      ...domain,
      awardPayload: { ...(c.awardPayload || {}), ...(domain.awardPayload || {}) },
      ...cipKeepExistingBlob(c, domain, "termsheet"),
      ...cipKeepExistingBlob(c, domain, "draft"),
      ...cipKeepExistingBlob(c, domain, "draftDocx"),
      ...cipKeepExistingBlob(c, domain, "finalContract"),
      ...cipKeepExistingBlob(c, domain, "loa"),
      _domain: true,
    });
  });
  return merged.concat(Array.from(domainById.values()));
}
function cipDocumentPrefix(documentType) {
  if (documentType === "final") return "finalContract";
  if (documentType === "draft-pdf") return "draft";
  if (documentType === "draft-docx") return "draftDocx";
  return documentType;
}
function cipAttachDomainDocuments(c, documents) {
  const patch = {};
  (documents || []).filter((doc) => doc.caseKey === c.id).forEach((doc) => {
    const payload = cipParseJson(doc.payloadJson);
    const prefix = cipDocumentPrefix(doc.documentType);
    const blobKeyField = `${prefix}BlobKey`;
    const containerField = `${prefix}Container`;
    const incomingBlob = doc.blobKey || null;
    patch[`${prefix}FileName`] = doc.fileName;
    if (incomingBlob) {
      patch[containerField] = doc.container || null;
      patch[blobKeyField] = incomingBlob;
    } else if (!c[blobKeyField]) {
      patch[containerField] = doc.container || null;
      patch[blobKeyField] = null;
    }
    if (doc.documentType === "loa") patch.loaPayload = payload;
    if (doc.documentType === "termsheet") {
      patch.termsheetGeneratedAt = doc.generatedAt || "";
      patch.termsheetPayload = payload.payload || patch.termsheetPayload;
    }
    if (doc.documentType === "draft-pdf") {
      patch.draftGeneratedAt = doc.generatedAt || "";
      patch.draftPayload = payload.payload || patch.draftPayload;
    }
    if (doc.documentType === "final") {
      patch.finalContractUploadedAt = doc.generatedAt || "";
      patch.finalContractSize = doc.size || 0;
    }
  });
  return { ...c, ...patch, _domain: true };
}
async function cipRefreshDomainCases() {
  if (CIP_DOMAIN_REFRESH) return CIP_DOMAIN_REFRESH;
  CIP_DOMAIN_REFRESH = (async () => {
    const [res, repositoryRes] = await Promise.all([
      fetch("/api/v1/contract-initiation-platform/cases", { credentials: "include" }),
      fetch("/api/v1/contract-initiation-platform/repository", { credentials: "include" }),
    ]);
    if (!res.ok) throw new Error(`CIP cases failed (${res.status})`);
    const rows = await res.json();
    const documents = repositoryRes.ok ? await repositoryRes.json() : [];
    const next = (Array.isArray(rows) ? rows : []).map(cipCaseFromDomain).map((c) => cipAttachDomainDocuments(c, Array.isArray(documents) ? documents : []));
    CIP_DOMAIN_CASES = cipMergeDomainCases(CIP_DOMAIN_CASES, next).filter((c) => next.some((row) => row.id === c.id));
    const store = cipReadStore();
    window.dispatchEvent(new CustomEvent(CIP_EVENT, { detail: store }));
    return store;
  })().finally(() => { CIP_DOMAIN_REFRESH = null; });
  return CIP_DOMAIN_REFRESH;
}
function cipReadStore() {
  cipClearLegacyStoreKeys();
  try {
    const raw = window.__procurementStorage.getItem(CIP_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
        if (parsed && parsed.version === CIP_STORE_VERSION && Array.isArray(parsed.cases)) return { ...parsed, cases: cipMergeDomainCases(parsed.cases.map(cipNormalizeCaseForCurrentFlow), CIP_DOMAIN_CASES) };
    }
  } catch (e) {}
  // Backend-driven: no mockup seed. CIP starts empty; cases are created from real award results
  // finalized in Proposal Tracker and persist to the database.
  return { version: CIP_STORE_VERSION, seedSource: "tracker-award", cases: CIP_DOMAIN_CASES.slice() };
}
function cipWriteStore(store) {
  const normalized = {
    ...(store || {}),
    version: CIP_STORE_VERSION,
    seedSource: (store && store.seedSource) || "tracker-award",
    cases: Array.isArray(store && store.cases) ? store.cases.map(cipNormalizeCaseForCurrentFlow) : [],
  };
  const domainIds = new Set(CIP_DOMAIN_CASES.map((c) => c.id));
  const domainCases = normalized.cases.filter((c) => c._domain || domainIds.has(c.id));
  const legacyCases = normalized.cases.filter((c) => !c._domain && !domainIds.has(c.id));
  if (domainCases.length) {
    // Domain cases are updated through CIP command endpoints. Writing them back through the legacy
    // module-state adapter would clear and rebuild cip.CASE_T, including its documents/activities.
    CIP_DOMAIN_CASES = domainCases.map((c) => ({ ...c, _domain: true }));
  } else {
    try { window.__procurementStorage.setItem(CIP_STORE_KEY, JSON.stringify({ ...normalized, cases: legacyCases })); } catch (e) {}
  }
  const merged = { ...normalized, seedSource: "tracker-award", cases: cipMergeDomainCases(legacyCases, CIP_DOMAIN_CASES) };
  window.dispatchEvent(new CustomEvent(CIP_EVENT, { detail: merged }));
  return merged;
}
function cipCaseCommandPath(action, caseId, extraQuery) {
  const params = new URLSearchParams();
  params.set("caseId", String(caseId || ""));
  Object.entries(extraQuery || {}).forEach(([key, value]) => {
    if (value != null && value !== "") params.set(key, String(value));
  });
  return `/api/v1/contract-initiation-platform/cases/${action}?${params.toString()}`;
}
function cipNormalizeApiTimestamps(body) {
  if (!body || typeof body !== "object") return body;
  const next = { ...body };
  ["completedAt", "generatedAt", "occurredAt", "startedAt"].forEach((key) => {
    if (next[key] == null || next[key] === "") return;
    const parsed = new Date(String(next[key]).replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) next[key] = parsed.toISOString();
  });
  return next;
}
function cipDomainPost(path, body) {
  try {
    const requestBody = body ? cipNormalizeApiTimestamps(body) : body;
    fetch(path, {
      method: "POST",
      credentials: "include",
      headers: requestBody ? { "Content-Type": "application/json" } : undefined,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    }).catch((e) => console.warn("CIP domain API command failed.", e));
  } catch (e) {}
}
async function cipDomainCommand(path, body) {
  const requestBody = body ? cipNormalizeApiTimestamps(body) : body;
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: requestBody ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.code || `CIP command failed (${response.status}).`);
  return payload;
}
function cipPersistTransition(caseId, fromStage, toStage, occurredAt, actorName, remark) {
  return cipDomainCommand(cipCaseCommandPath("transition", caseId), { fromStage, toStage, occurredAt, actorName, remark });
}
function cipPersistActivityCompletion(caseId, activityKey, completedAt, actorName, remark) {
  return cipDomainCommand(cipCaseCommandPath("activities/complete", caseId, { activityKey }), { completedAt, actorName, remark });
}
function cipUpdateStore(mutator) {
  const store = cipReadStore();
  const next = mutator(JSON.parse(JSON.stringify(store))) || store;
  return cipWriteStore(next);
}
function useCipStore() {
  const [store, setStore] = React.useState(() => cipReadStore());
  React.useEffect(() => {
    const h = (e) => setStore(e.detail || cipReadStore());
    window.addEventListener(CIP_EVENT, h);
    window.addEventListener("storage", h);
    cipRefreshDomainCases().catch((e) => console.warn("CIP domain refresh failed.", e));
    return () => { window.removeEventListener(CIP_EVENT, h); window.removeEventListener("storage", h); };
  }, []);
  return store;
}
function cipResetStore() { return cipWriteStore({ version: CIP_STORE_VERSION, seedSource: "tracker-award", cases: [] }); }

function cipDropCasesForProposal(proposalId) {
  const key = String(proposalId || "");
  if (!key) return cipReadStore();
  const matches = (c) => String(c.proposalId || "") === key || String(c.proposalNumber || "") === key;
  CIP_DOMAIN_CASES = CIP_DOMAIN_CASES.filter((c) => !matches(c));
  try {
    const raw = window.__procurementStorage && window.__procurementStorage.getItem(CIP_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.cases)) {
        parsed.cases = parsed.cases.filter((c) => !matches(c));
        window.__procurementStorage.setItem(CIP_STORE_KEY, JSON.stringify(parsed));
      }
    }
  } catch (e) {}
  const store = cipReadStore();
  window.dispatchEvent(new CustomEvent(CIP_EVENT, { detail: store }));
  return store;
}
if (typeof window !== "undefined") {
  window.addEventListener("ag-cip-drop-proposal", (event) => {
    const proposalId = event && event.detail && event.detail.proposalId;
    if (proposalId) cipDropCasesForProposal(proposalId);
  });
}

function cipPatchCase(caseId, patch) {
  return cipUpdateStore((store) => {
    store.cases = store.cases.map((c) => (c.id === caseId ? { ...c, ...patch } : c));
    return store;
  });
}
function cipSetStage(caseId, stage, extra) {
  const result = cipPatchCase(caseId, { stage, status: cipStatusForStage(stage), ...(extra || {}) });
  if (stage === "termsheet") {
    cipDomainPost(cipCaseCommandPath("verify", caseId), { actorName: extra && extra.actorName });
  }
  return result;
}

function cipNormalizeCaseForCurrentFlow(c) {
  if (!c) return c;
  const stage = c.stage === "review" ? "final" : c.stage;
  const status = c.status === "review" || stage !== c.stage ? cipStatusForStage(stage) : (c.status || cipStatusForStage(stage));
  return stage === c.stage && status === c.status ? c : { ...c, stage, status, legalReviewedOutsideSystem: true };
}

const CIP_CONTRACT_SUB_STAGES = ["template", "draft", "final"];

function cipRecycleContractSubStage(caseId, stageKey, reason, actorName) {
  if (!CIP_CONTRACT_SUB_STAGES.includes(stageKey)) return null;
  let recycled = null;
  const blobsToPurge = [];
  cipUpdateStore((store) => {
    const idx = (store.cases || []).findIndex((row) => row.id === caseId);
    if (idx < 0) return store;
    const c = store.cases[idx];
    if (cipStageIdx(c.stage) < cipStageIdx(stageKey)) return store;
    // Collect documents generated/uploaded in this stage and the stages after it, to purge from Blob.
    if (stageKey === "template" || stageKey === "draft") {
      if (c.draftBlobKey) blobsToPurge.push({ container: c.draftContainer, blobKey: c.draftBlobKey });
      if (c.draftDocxBlobKey) blobsToPurge.push({ container: c.draftDocxContainer, blobKey: c.draftDocxBlobKey });
    }
    if (stageKey !== "final" && c.finalContractBlobKey) {
      blobsToPurge.push({ container: c.finalContractContainer, blobKey: c.finalContractBlobKey });
    }
    const at = trkNow();
    const stageMeta = CIP_STAGE[stageKey] || { en: stageKey };
    const cleanReason = String(reason || "").trim();
    const historyBase = Array.isArray(c.activityHistory) ? c.activityHistory : [];
    const history = historyBase.concat([
      { id: `cip-${caseId}-recycle-${stageKey}-${Date.now()}`, type: "Recycle", stageKey, at, actorName, message: cleanReason || `Recycle ${stageMeta.en}.` },
      { id: `cip-${caseId}-reopen-${stageKey}-${Date.now()}`, type: "Started", stageKey, at, actorName, message: `Re-opened ${stageMeta.en} after recycle.` },
    ]);
    const patch = { stage: stageKey, status: cipStatusForStage(stageKey), activityHistory: history };
    if (stageKey === "template" || stageKey === "draft") patch.legal = "";
    if (stageKey === "template" || stageKey === "draft") {
      patch.draftPayload = undefined;
      patch.draftDataUri = undefined;
      patch.draftContainer = undefined;
      patch.draftBlobKey = undefined;
      patch.draftFileName = undefined;
      patch.draftDocxFileName = undefined;
      patch.draftGeneratedAt = undefined;
    }
    if (stageKey !== "final") {
      patch.finalContractDataUri = undefined;
      patch.finalContractContainer = undefined;
      patch.finalContractBlobKey = undefined;
      patch.finalContractFileName = undefined;
      patch.finalContractUploadedAt = undefined;
      patch.finalContractSize = undefined;
    }
    const nextCases = store.cases.slice();
    nextCases[idx] = { ...c, ...patch };
    store.cases = nextCases;
    recycled = nextCases[idx];
    return store;
  });
  if (recycled) {
    // Best-effort: remove the purged documents from Azure Blob.
    if (blobsToPurge.length) Promise.allSettled(blobsToPurge.map((d) => cipDeleteDocument(d)));
    cipDomainPost(cipCaseCommandPath("recycle", caseId), { stageKey, reason, actorName });
  }
  return recycled;
}

/* ---------- repository: every document the platform produced ---------- */
const CIP_DOCTYPES = {
  loa:       { en: "LOA",            id: "LOA",            icon: "inbox",     tone: "info" },
  termsheet: { en: "Termsheet",      id: "Termsheet",      icon: "file-text", tone: "brand" },
  draft:     { en: "Draft Contract", id: "Draf Kontrak",   icon: "file-pen",  tone: "warning" },
  final:     { en: "Final Contract", id: "Kontrak Final",  icon: "award",     tone: "success" },
};
function cipRepositoryDocs(cases) {
  const docs = [];
  cases.forEach((c) => {
    const idx = cipStageIdx(c.stage);
    if (c.loaFileName || c.loaBlobKey || c.loaDataUri) docs.push({ id: `${c.id}-loa`, type: "loa", name: c.loaFileName || `LOA_${String(c.loaNo || c.id).replace(/\//g, "-")}.pdf`, caseId: c.id, caseTitle: c.title, vendor: c.vendor, date: c.createdAt, size: 180 + (trkHash(c.id) % 140), container: c.loaContainer || null, blobKey: c.loaBlobKey || null });
    if (c.termsheetBlobKey || idx >= cipStageIdx("template")) docs.push({ id: `${c.id}-ts`, type: "termsheet", name: c.termsheetFileName || `Termsheet_${c.id}.pdf`, caseId: c.id, caseTitle: c.title, vendor: c.vendor, date: c.termsheetGeneratedAt || c.createdAt, size: 96 + (trkHash(c.id) % 60), container: c.termsheetContainer || null, blobKey: c.termsheetBlobKey || null });
    if (idx >= cipStageIdx("draft")) docs.push({ id: `${c.id}-draft-pdf`, type: "draft", name: c.draftFileName || `Draft_${c.template || "Contract"}_${c.id}.pdf`, caseId: c.id, caseTitle: c.title, vendor: c.vendor, date: c.draftGeneratedAt || c.createdAt, size: 240 + (trkHash(c.id) % 180), container: c.draftContainer || null, blobKey: c.draftBlobKey || null });
    if (idx >= cipStageIdx("draft")) docs.push({ id: `${c.id}-draft-docx`, type: "draft", name: c.draftDocxFileName || `Draft_${c.template || "Contract"}_${c.id}.docx`, caseId: c.id, caseTitle: c.title, vendor: c.vendor, date: c.draftGeneratedAt || c.createdAt, size: 320 + (trkHash(c.id) % 120) });
    if (c.finalContractBlobKey || c.stage === "final") docs.push({ id: `${c.id}-final`, type: "final", name: c.finalContractFileName || `Perjanjian_${c.id}_signed.pdf`, caseId: c.id, caseTitle: c.title, vendor: c.vendor, date: c.finalContractUploadedAt || c.createdAt, size: c.finalContractSize || 420 + (trkHash(c.id) % 220), container: c.finalContractContainer || null, blobKey: c.finalContractBlobKey || null });
  });
  return docs.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* ---------- CIP visual identity: keyframes injected once ---------- */
(function cipInjectStyles() {
  if (document.getElementById("cip-styles")) return;
  const el = document.createElement("style");
  el.id = "cip-styles";
  el.textContent = `
    @keyframes cipFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes cipGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes cipPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @keyframes cipShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
    @keyframes cipSpin { to { transform: rotate(360deg); } }
    @keyframes cipOrbDrift { 0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.55; } 50% { transform: translate(-12px, 8px) scale(1.06); opacity: 0.75; } }
    @keyframes cipBridgeFlow { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
  .cip-fade-up { animation: cipFadeUp .5s cubic-bezier(.2,.7,.3,1) both; }
    .cip-grow { transform-origin: left; animation: cipGrow .85s cubic-bezier(.2,.7,.3,1) both; }
    .cip-display { font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, 'Times New Roman', serif; font-weight: 600; letter-spacing: -0.02em; }
    .cip-page { position: relative; }
    .cip-page::before {
      content: ""; position: absolute; inset: -24px -28px auto; height: 280px; pointer-events: none; z-index: 0;
      background:
        radial-gradient(ellipse 55% 80% at 92% -15%, rgba(15,130,138,0.09), transparent 70%),
        radial-gradient(ellipse 45% 65% at 4% 0%, rgba(0,92,150,0.07), transparent 65%);
    }
    .cip-page > * { position: relative; z-index: 1; }
    .cip-hero { isolation: isolate; }
    .cip-grain {
      position: absolute; inset: 0; pointer-events: none; opacity: 0.38; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
      background-size: 180px 180px;
    }
    .cip-hero-orb {
      position: absolute; width: 220px; height: 220px; border-radius: 50%; pointer-events: none;
      top: -80px; right: -40px;
      background: radial-gradient(circle, rgba(127,212,217,0.35) 0%, rgba(15,130,138,0.12) 45%, transparent 70%);
      animation: cipOrbDrift 9s ease-in-out infinite;
    }
    .cip-stagger > * { animation: cipFadeUp .5s cubic-bezier(.2,.7,.3,1) both; }
    .cip-stagger > *:nth-child(1) { animation-delay: .04s; }
    .cip-stagger > *:nth-child(2) { animation-delay: .09s; }
    .cip-stagger > *:nth-child(3) { animation-delay: .14s; }
    .cip-stagger > *:nth-child(4) { animation-delay: .19s; }
    .cip-stagger > *:nth-child(5) { animation-delay: .24s; }
    .cip-bridge-line { stroke-dasharray: 6 4; animation: cipBridgeFlow 1.2s ease-out forwards; }
    .cip-card-lift { transition: transform .18s ease, box-shadow .18s ease; }
    .cip-card-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 36px rgba(1,59,82,0.14); }
    .cip-sub-acc .cip-fade-up { animation-duration: 0.38s; }
    @media (max-width: 1180px) { .cip-dash-grid { grid-template-columns: 1fr !important; } .cip-hero-kpis { grid-template-columns: repeat(2,1fr) !important; } .cip-bridge { grid-template-columns: 1fr !important; } .cip-bridge-arrows { display: none !important; } }
    @media (max-width: 1080px) { .cip-detail-grid { grid-template-columns: 1fr !important; } .cip-rail { flex-direction: row !important; overflow-x: auto; position: static !important; } }
    @media (max-width: 900px)  { .cip-inbox-grid { grid-template-columns: 1fr !important; } .cip-split { grid-template-columns: 1fr !important; } }
  `;
  document.head.appendChild(el);
})();

Object.assign(window, {
  CIP_TODAY, CIP_AS_OF, CIP_STAGES, CIP_STAGE, cipStageIdx, CIP_STATUS, cipStatusForStage, CIP_ROLES,
  CIP_USD_RATE, CIP_AUTHORIZATION_BANDS, CIP_AUTHORIZATION_ROLES, CIP_AUTHORIZATION_MATRIX,
  CIP_CONTRACT_SIGNING_ROLES, CIP_CONTRACT_CELL, CIP_CONTRACT_SIGNING_SECTIONS, CIP_CONTRACT_SIGNING_NOTES,
  CIP_PHASES, CIP_PHASE, cipPhaseForStage, cipPhaseIdx,
  CIP_AUTH_MASTER_STORE_KEY, CIP_AUTH_MASTER_EVENT, cipDefaultAuthMaster, cipAuthMasterSnapshot, cipSaveAuthMaster,
  cipUsdValue, cipAuthorizationBandForValue, cipAuthorizationCell, cipAuthorizationForCase,
  cipContractMatrixCell, cipContractSigningRole, cipContractOutlineSignersForBand, cipContractSigningForCase,
  CIP_TPL_CATS, CIP_TPL_CAT, CIP_TEMPLATE_SOURCE_ROOT, CIP_TEMPLATE_DOCUMENTS, CIP_CONTRACT_FIELD_GROUPS,
  CIP_TEMPLATES, CIP_TEMPLATE, CIP_CLAUSE_OUTLINE, cipTemplateDoc, cipTemplateCleanupIssues,
  cipTemplateReadiness, cipTemplateMergePlan, cipTemplateLibraryStats, cipRecommend, cipRecommendCorpus, cipMatchPct,
  CIP_LEAD_LOA, CIP_LEAD_TERMSHEET, cipGenericTermsheet, CIP_SEED_CASES,
  CIP_TERMSHEET_TEMPLATE_META, CIP_TERMSHEET_TEMPLATE_FIELDS, cipTermsheetTitleForCase, cipTermsheetTransactionSeed, cipTermsheetInitialForm, cipBuildTermsheetPayload,
  cipTermsheetMissingFields, cipBuildTermsheetDocument, cipGenerateTermsheetDocument,
  CIP_DRAFT_TEMPLATE_FIELDS, cipDraftInitialForm, cipBuildDraftPayload, cipDraftMissingFields,
  cipBuildDraftDocument, cipGenerateDraftDocument, cipUploadFinalContract,
  cipResolveDocumentUrl,
  cipReadStore, cipWriteStore, cipUpdateStore, useCipStore, cipResetStore, cipRefreshDomainCases,
  cipPersistTransition, cipPersistActivityCompletion,
  cipPatchCase, cipSetStage, cipRecycleContractSubStage, CIP_CONTRACT_SUB_STAGES,
  CIP_DOCTYPES, cipRepositoryDocs, cipLoaFor, CIP_TEMPLATE_MERGE_KEYS, cipTrackerPlanActualFromProposal,
});
export { CIP_TODAY, CIP_AS_OF, CIP_STAGES, CIP_STAGE, cipStageIdx, CIP_STATUS, cipStatusForStage, CIP_ROLES, CIP_USD_RATE, CIP_AUTHORIZATION_BANDS, CIP_AUTHORIZATION_ROLES, CIP_AUTHORIZATION_MATRIX, CIP_CONTRACT_SIGNING_ROLES, CIP_CONTRACT_CELL, CIP_CONTRACT_SIGNING_SECTIONS, CIP_CONTRACT_SIGNING_NOTES, CIP_PHASES, CIP_PHASE, cipPhaseForStage, cipPhaseIdx, CIP_AUTH_MASTER_STORE_KEY, CIP_AUTH_MASTER_EVENT, cipDefaultAuthMaster, cipAuthMasterSnapshot, cipSaveAuthMaster, cipUsdValue, cipAuthorizationBandForValue, cipAuthorizationCell, cipAuthorizationForCase, cipContractMatrixCell, cipContractSigningRole, cipContractOutlineSignersForBand, cipContractSigningForCase, CIP_TPL_CATS, CIP_TPL_CAT, CIP_TEMPLATE_SOURCE_ROOT, CIP_TEMPLATE_DOCUMENTS, CIP_CONTRACT_FIELD_GROUPS, CIP_TEMPLATES, CIP_TEMPLATE, CIP_CLAUSE_OUTLINE, cipTemplateDoc, cipTemplateCleanupIssues, cipTemplateReadiness, cipTemplateMergePlan, cipTemplateLibraryStats, cipRecommend, cipRecommendCorpus, cipMatchPct, CIP_LEAD_LOA, CIP_LEAD_TERMSHEET, cipGenericTermsheet, CIP_SEED_CASES, CIP_TERMSHEET_TEMPLATE_META, CIP_TERMSHEET_TEMPLATE_FIELDS, cipTermsheetTitleForCase, cipTermsheetTransactionSeed, cipTermsheetInitialForm, cipBuildTermsheetPayload, cipTermsheetMissingFields, cipBuildTermsheetDocument, cipGenerateTermsheetDocument, CIP_DRAFT_TEMPLATE_FIELDS, cipDraftInitialForm, cipBuildDraftPayload, cipDraftMissingFields, cipBuildDraftDocument, cipGenerateDraftDocument, cipUploadFinalContract, cipResolveDocumentUrl, cipReadStore, cipWriteStore, cipUpdateStore, useCipStore, cipResetStore, cipRefreshDomainCases, cipPersistTransition, cipPersistActivityCompletion, cipPatchCase, cipSetStage, cipRecycleContractSubStage, CIP_CONTRACT_SUB_STAGES, CIP_DOCTYPES, cipRepositoryDocs, cipLoaFor, CIP_TEMPLATE_MERGE_KEYS, cipTrackerPlanActualFromProposal };
