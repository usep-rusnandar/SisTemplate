/**
 * Export primary frontend/backend seed data to Excel for review.
 * Sources:
 *  - Tracker: TrackerData.jsx catalog + TrackerMasterData.jsx
 *  - CIP: derived from Tracker LOA handoff (seedSource tracker-loa)
 *  - Contract Monitoring: ContractMonData.jsx generators
 *  - IAM: InitialIamDataSeeder.cs static lists (mirrored here for review)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../../docs/seed-review");
fs.mkdirSync(outDir, { recursive: true });

const pad = (n, w = 2) => String(n).padStart(w, "0");
const today = "2026-06-09"; // stable review baseline close to module seeds

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pick(arr, i, mul = 1) {
  return arr[(i * mul) % arr.length];
}

/* -------------------- Tracker -------------------- */
const TRK_JOBSITES = ["JAHO", "ADMO", "WARA", "KIDECO", "HEAD OFFICE", "MIP", "BALANGAN", "ADMO SERA"];
const TRK_SCENARIO_CATALOG = [
  ["S.02.03 Heavy Equipment", "TM-1", 32100000000, "Pengadaan tyre 24.00R35 untuk fleet hauling HD785"],
  ["S.02.03 Heavy Equipment", "TM-1", 28700000000, "Pengadaan tyre 27.00R49 untuk dump truck HD1500"],
  ["S.02.03 Heavy Equipment", "TM-2", 14800000000, "Supply spare part undercarriage excavator PC2000"],
  ["S.02.03 Heavy Equipment", "TM-1", 21500000000, "Pengadaan bucket GET shovel PC4000 dan adapter"],
  ["S.02.03 Heavy Equipment", "TM-2", 9650000000, "Sewa unit dozer D375A untuk land clearing pit selatan"],
  ["S.02.03 Heavy Equipment", "TM-1", 36800000000, "Pengadaan engine assembly Cummins QSK60 untuk HD785"],
  ["S.02.03 Heavy Equipment", "TM-2", 12450000000, "Supply final drive dan travel motor excavator EX1900"],
  ["S.02.03 Heavy Equipment", "TM-3", 3580000000, "Sewa mobile crane 80 ton untuk shutdown crusher plant"],
  ["S.02.03 Heavy Equipment", "TM-2", 6720000000, "Rebuild komponen power train dump truck CAT 777"],
  ["S.02.03 Heavy Equipment", "TM-2", 4150000000, "Pengadaan ripper tip dan cutting edge dozer D155"],
  ["S.03.02 Catering", "TM-1", 24500000000, "Jasa catering dan mess management camp induk periode 2026-2027"],
  ["S.03.02 Catering", "TM-1", 9650000000, "Jasa catering camp Barat periode Q3-Q4 2026"],
  ["S.03.02 Catering", "TM-2", 4160000000, "Kontrak cleaning service office dan mess karyawan"],
  ["S.03.02 Catering", "TM-2", 2850000000, "Jasa laundry dan housekeeping mess karyawan"],
  ["S.03.02 Catering", "TM-3", 1280000000, "Supply air minum kemasan dan galon untuk camp"],
  ["M.11.02 HDPE Pipe", "TM-1", 17650000000, "Pekerjaan lining HDPE settling pond phase 2"],
  ["M.11.02 HDPE Pipe", "TM-2", 7350000000, "Pengadaan pipa HDPE PN16 OD630 untuk dewatering pit utara"],
  ["M.11.02 HDPE Pipe", "TM-2", 5480000000, "Supply dan instalasi pipa HDPE jalur main sump"],
  ["M.11.02 HDPE Pipe", "TM-3", 1920000000, "Pengadaan fitting dan butt fusion HDPE accessories"],
  ["M.11.02 HDPE Pipe", "TM-2", 8950000000, "Pengadaan pompa submersible dan pipa discharge dewatering"],
  ["S.11.02 IT Solution", "TM-2", 4280000000, "Upgrade jaringan microwave link dispatch ke ROM"],
  ["S.11.02 IT Solution", "TM-2", 5450000000, "Supply dan instalasi CCTV perimeter stockpile"],
  ["S.11.02 IT Solution", "TM-2", 2275000000, "Pengadaan radio komunikasi trunking untuk pit operation"],
  ["S.11.02 IT Solution", "TM-3", 3850000000, "License endpoint protection dan EDR corporate"],
  ["S.11.02 IT Solution", "TM-1", 16200000000, "Implementasi fleet management system (FMS) tahap 2"],
  ["S.11.02 IT Solution", "TM-2", 7600000000, "Pengadaan server dan storage untuk dispatch system"],
  ["S.11.02 IT Solution", "TM-2", 3120000000, "Pengadaan perangkat GPS high precision untuk survey"],
  ["S.11.02 IT Solution", "TM-2", 5280000000, "Langganan VSAT dan backbone internet site 2026-2027"],
  ["S.08.05 Light Vehicle", "TM-1", 6120000000, "Sewa light vehicle double cabin operasional engineering"],
  ["S.08.05 Light Vehicle", "TM-2", 4830000000, "Sewa bus karyawan rute camp - kota"],
  ["S.08.05 Light Vehicle", "TM-2", 3450000000, "Sewa light vehicle single cabin patrol HSE"],
  ["S.08.05 Light Vehicle", "TM-3", 2680000000, "Pengadaan ambulance dan unit rescue site"],
  ["S.01.06 Repair Maintenance", "TM-1", 18450000000, "Overhaul conveyor CV-12 dan chute transfer crusher BIB"],
  ["S.01.06 Repair Maintenance", "TM-3", 1850000000, "Perbaikan genset emergency kantor admin dan workshop"],
  ["S.01.06 Repair Maintenance", "TM-3", 1325000000, "Chemical water treatment untuk WTP camp"],
  ["S.01.06 Repair Maintenance", "TM-3", 740000000, "Kalibrasi weighbridge dan sertifikasi tera"],
  ["S.01.06 Repair Maintenance", "TM-2", 2980000000, "Jasa maintenance AC dan chiller office building"],
  ["S.01.06 Repair Maintenance", "TM-2", 5240000000, "Overhaul pompa multiflow dewatering pit"],
  ["S.01.06 Repair Maintenance", "TM-2", 6850000000, "Perbaikan dan recoating tangki BBM bulk storage"],
  ["S.01.06 Repair Maintenance", "TM-1", 11200000000, "Jasa preventive maintenance crusher plant tahunan"],
  ["S.11.06 Infrastructure", "TM-1", 11850000000, "Konstruksi shelter fuel station dan canopy dispenser"],
  ["S.11.06 Infrastructure", "TM-3", 890000000, "Pengadaan APAR, foam, dan fire blanket workshop"],
  ["S.11.06 Infrastructure", "TM-2", 4920000000, "Civil work perbaikan drainase workshop tyre bay"],
  ["S.11.06 Infrastructure", "TM-1", 22400000000, "Pembangunan gudang material dan warehouse spare part"],
  ["S.11.06 Infrastructure", "TM-1", 34500000000, "Konstruksi jalan hauling segmen KM-8 sampai KM-12"],
  ["S.11.06 Infrastructure", "TM-2", 8600000000, "Pekerjaan pengaspalan akses jalan camp"],
  ["S.11.06 Infrastructure", "TM-1", 15700000000, "Pembangunan workshop tyre dan washing bay"],
  ["S.11.06 Infrastructure", "TM-2", 3760000000, "Konstruksi pos security dan gerbang utama site"],
  ["S.02.03 Heavy Equipment", "TM-2", 5630000000, "Pengadaan blade dan cutting edge grader CAT 16M"],
  ["S.02.03 Heavy Equipment", "TM-2", 7180000000, "Supply hydraulic cylinder excavator PC1250"],
];

const TRK_PROFILE_PLAN = [
  "termsheet", "termsheet", "loa", "termsheet", "mid",
  "termsheet", "completed", "termsheet", "early", "termsheet",
  "termsheet", "loa", "recycle", "termsheet", "cancel",
  "termsheet", "termsheet", "loa", "termsheet", "completed",
  "termsheet", "termsheet", "termsheet", "termsheet", "loa",
  "termsheet", "termsheet", "termsheet", "termsheet", "termsheet",
  "termsheet", "completed", "termsheet", "recycle", "termsheet",
  "termsheet", "termsheet", "loa", "termsheet", "cancel",
  "termsheet", "termsheet", "termsheet", "termsheet", "termsheet",
  "termsheet", "termsheet", "termsheet", "termsheet", "loa",
];

const TRK_MULTI_WINNER = {
  1: { count: 2, percentages: "60/40", split: "pembagian supply tyre ukuran kritikal dan support stok consignment agar availability fleet hauling tetap aman" },
  3: { count: 2, percentages: "55/45", split: "paket GET shovel dibagi antara bucket teeth set dan adapter supaya lead time overhaul tidak menunggu satu vendor" },
  10: { count: 2, percentages: "65/35", split: "split layanan camp induk dan mess management agar transisi dapur tidak mengganggu operasi shift" },
  15: { count: 2, percentages: "50/50", split: "pembagian area settling pond sisi utara dan selatan supaya lining selesai sebelum window hujan" },
  24: { count: 3, percentages: "45/35/20", split: "implementasi FMS dibagi untuk perangkat onboard, integrasi dispatch, dan support commissioning agar risiko go-live terkendali" },
  32: { count: 2, percentages: "58/42", split: "overhaul conveyor dibagi antara mechanical rotating parts dan chute transfer agar shutdown crusher tetap sesuai window operasi" },
  37: { count: 2, percentages: "52/48", split: "overhaul pompa dibagi paket mechanical dan electrical rewinding untuk mempercepat ketersediaan dewatering" },
  43: { count: 2, percentages: "62/38", split: "warehouse spare part dibagi civil structure dan racking system agar pekerjaan site dan material handling berjalan paralel" },
  49: { count: 2, percentages: "57/43", split: "hydraulic cylinder dipisah antara supply seal kit dan repair cylinder assembly untuk menjaga jadwal standby unit" },
};

const TRK_COMMODITY_DEPARTMENT = {
  "S.02.03 Heavy Equipment": "Plant Maintenance",
  "S.03.02 Catering": "General Affairs",
  "M.11.02 HDPE Pipe": "Engineering",
  "S.11.02 IT Solution": "Information Technology",
  "S.08.05 Light Vehicle": "General Affairs",
  "S.01.06 Repair Maintenance": "Plant Maintenance",
  "S.11.06 Infrastructure": "Engineering",
};

// Excel-only mock winners for the offline seed workbook. Runtime Generate Sample Data
// reads recommended vendors from Vendor Database status RGSTD — not this list.
const EXCEL_MOCK_WINNERS = [
  { vendorId: "074DFA5288", vendorName: "PT Tambang Sarana Mandiri" },
  { vendorId: "0C9B904FA5", vendorName: "PT Prima Daya Lestari" },
  { vendorId: "0E21C69FF3", vendorName: "PT Borneo Teknika Utama" },
  { vendorId: "13962F6C69", vendorName: "PT Mandiri Rekayasa Nusantara" },
  { vendorId: "1B15AD8F4C", vendorName: "PT Karya Multi Energi" },
  { vendorId: "251D2D73EC", vendorName: "PT Cipta Solusi Digital" },
];

function scenarioType(title) {
  return /sewa|jasa|kontrak|konstruksi|pembangunan|license|langganan|maintenance|implementasi|cleaning|catering|laundry|instalasi|pemeliharaan|pengaspalan/i.test(title)
    ? "Contractual" : "Non Contractual";
}
function scenarioPriority(amount, method) {
  if (amount >= 20000000000) return "A. Priority";
  if (amount >= 8000000000 || method === "TM-1") return "B. Urgent";
  return "C. Normal";
}
function scenarioSchedule(profile, i) {
  const anchor = profile === "completed" ? "2026-04-03"
    : profile === "termsheet" ? "2026-04-14"
      : profile === "loa" ? "2026-04-30"
        : "2026-04-22";
  const start = addDays(anchor, (i * 2) % 36);
  const req = addDays(start, 66 + (i % 22));
  return { start, req };
}

function activeStageForProfile(profile) {
  switch (profile) {
    case "ready": return "Proposal Received";
    case "early": return "Invitation & Aanwijzing / RFQ";
    case "mid": return "Negotiation / Bid Evaluation";
    case "loa": return "Letter of Award (LOA)";
    case "termsheet": return "Term Sheet";
    case "completed": return "Contract (Completed)";
    case "recycle": return "Recycle reopen (prior completed step)";
    case "cancel": return "Canceled";
    default: return profile;
  }
}

const trackerProposals = TRK_SCENARIO_CATALOG.slice(0, 50).map((row, i) => {
  const [commodity, method, amount, title] = row;
  const profile = TRK_PROFILE_PLAN[i];
  const schedule = scenarioSchedule(profile, i);
  const multi = TRK_MULTI_WINNER[i] || null;
  const winnerCount = multi ? multi.count : 1;
  const winners = EXCEL_MOCK_WINNERS.slice(0, winnerCount).map((v) => v.vendorName).join("; ");
  return {
    Index: i + 1,
    ProposalId: `p-${pad(i + 1, 3)}`,
    ProposalNumber: `PR-2026-${pad(i + 1, 4)}`,
    AribaId: `ARIBA-2026-${String(26000 + i + 1).padStart(5, "0")}`,
    Title: title,
    Commodity: commodity,
    Method: method,
    AmountIDR: amount,
    Jobsite: TRK_JOBSITES[(i * 3 + 1) % TRK_JOBSITES.length],
    Department: TRK_COMMODITY_DEPARTMENT[commodity] || "",
    ContractType: scenarioType(title),
    ContractualType: scenarioType(title) === "Contractual" ? "Service Agreement" : "",
    Priority: scenarioPriority(amount, method),
    SeedProfile: profile,
    ActiveStageHint: activeStageForProfile(profile),
    StartActivityDate: schedule.start,
    RequirementDate: schedule.req,
    Officer: i % 2 === 0 ? "Agus Pratama" : "Tono Hartono",
    MultiWinner: multi ? "Yes" : "No",
    WinnerCount: winnerCount,
    AwardSplitPct: multi ? multi.percentages : "100",
    SplitReason: multi ? multi.split : "",
    WinnerVendors: winners,
    CipHandoffReady: ["termsheet", "loa", "completed"].includes(profile) ? "Likely" : "No",
  };
});

const trackerSteps = [
  { Id: "TS-1", Name: "Proposal Received", Code: "PROP", Note: "Initial intake of the procurement proposal" },
  { Id: "TS-2", Name: "Invitation & Aanwijzing", Code: "TIA", Note: "Tender invitation and pre-bid clarification meeting" },
  { Id: "TS-3", Name: "Request for Quotation (RFQ)", Code: "RFQ", Note: "Issue RFQ and collect vendor quotations" },
  { Id: "TS-4", Name: "Negotiation", Code: "NEGO", Note: "Commercial and technical negotiation" },
  { Id: "TS-5", Name: "Bid Evaluation", Code: "EVAL", Note: "Evaluate and score submitted bids" },
  { Id: "TS-6", Name: "Letter of Award (LOA)", Code: "LOA", Note: "Issue the Letter of Award to the winning vendor" },
  { Id: "TS-7", Name: "Term Sheet", Code: "TERM", Note: "Agree key commercial terms" },
  { Id: "TS-8", Name: "Contract", Code: "CTR", Note: "Draft, review, and sign the contract" },
];

const trackerMethods = [
  { Id: "TM-1", Name: "Tender", Code: "TND", Desc: "Open competitive tender with public invitation and aanwijzing.", SLA: "TIA2 RFQ7 NEGO7 EVAL3 LOA2 TERM1 CTR1" },
  { Id: "TM-2", Name: "Pemilihan Langsung", Code: "PML", Desc: "Limited selection from shortlisted vendors.", SLA: "RFQ6 NEGO7 EVAL3 LOA2 TERM1 CTR1" },
  { Id: "TM-3", Name: "Penunjukan Langsung", Code: "PNL", Desc: "Direct appointment of a single vendor.", SLA: "RFQ3 NEGO3 LOA2 TERM1 CTR1" },
];

/* -------------------- CIP (derived from Tracker LOA) -------------------- */
const cipCases = [];
let cipIndex = 0;
for (const p of trackerProposals) {
  // CIP seed historically builds from Tracker LOA inbox (completed LOA, pending Term Sheet).
  if (!["termsheet", "loa", "completed"].includes(p.SeedProfile)) continue;
  const winners = EXCEL_MOCK_WINNERS.slice(0, p.WinnerCount);
  for (const vendor of winners) {
    cipIndex += 1;
    const vendorSuffix = vendor.vendorId.slice(-4).toUpperCase();
    cipCases.push({
      Index: cipIndex,
      CaseId: `CIP-2026-${pad(cipIndex, 3)}`,
      Source: "tracker-loa",
      ProposalId: p.ProposalId,
      ProposalNumber: p.ProposalNumber,
      Title: p.Title,
      VendorId: vendor.vendorId,
      VendorName: vendor.vendorName,
      Jobsite: p.Jobsite,
      AwardValueIDR: Math.round(p.AmountIDR * (Number(String(p.AwardSplitPct).split("/")[winners.indexOf(vendor)] || 100) / 100)),
      ProposalTotalValueIDR: p.AmountIDR,
      AwardPercent: Number(String(p.AwardSplitPct).split("/")[winners.indexOf(vendor)] || 100),
      StageSeed: p.SeedProfile === "completed" ? "contract" : p.SeedProfile === "loa" ? "loa" : "loa",
      Method: p.Method,
      Department: p.Department,
      RequirementDate: p.RequirementDate,
      TermsheetNo: `TS/CIP-2026-${pad(cipIndex, 3)}/${vendorSuffix}/VI/2026`,
      ContractNo: `CTR/CIP-2026-${pad(cipIndex, 3)}/${vendorSuffix}/VI/2026`,
      Note: "CIP cases are created from Tracker LOA handoff; exact runtime count depends on completed LOA docs.",
    });
  }
}

/* -------------------- Contract Monitoring -------------------- */
const CM_JOBSITES = ["JAHO", "ADMO", "ADMO SERA BORO MACO", "WARA", "KIDECO", "HEAD OFFICE", "MIP", "BALANGAN"];
const CM_CLASSES = [
  "Human Resources", "Subcontractor", "Chemicals", "Ground Engaging Tool (GET)", "Shoes & Garment",
  "Heavy Equipment", "Fuel & Lubricant", "IT & Digital", "Facility Services", "Logistics",
];
const CM_SUPPLIERS = [
  "PT ADARO TIRTA SARANA", "PT KOTRACK MACHINERY INDONESIA", "PT EONCHEMICALS PUTRA", "PT ESHAEL INDONESIA",
  "PT BINA BUSANA INTERNUSA", "PT GLOBAL UTAMA TEKNIK", "PT SAPTA SARANA SEJAHTERA", "PT KARYA MINING SERVICES",
  "PT MITRA LOGISTIK NUSANTARA", "PT PRIMARI INRAHM UTAMA", "PT HEXINDO ADIPERKASA", "PT TRAKINDO UTAMA",
  "PT UNITED TRACTORS", "PT SUMBER ENERGI DIESEL", "PT SINERGI MITRAJAYA ABADI", "PT TIGA SAUDARA MANDIRI BHAKTI",
  "PT BUKIT MAKMUR MANDIRI", "PT ETI FIRE SYSTEMS", "PT TEKNOLOGI CERDAS INDONESIA", "PT OSMIRA GEMILANG JAYA",
];
const CM_TITLES = [
  "PERJANJIAN JASA PENGELOLAAN DAN PEMOMPAAN AIR TAMBANG",
  "PERJANJIAN PENYEDIAAN BAHAN KIMIA OPERASIONAL",
  "PERJANJIAN JUAL BELI SPAREPART GROUND ENGAGING TOOL",
  "PERJANJIAN JASA GENERAL SERVICES JOBSITE",
  "PERJANJIAN PENGADAAN SERAGAM DAN SAFETY SHOES",
  "PERJANJIAN SEWA HEAVY EQUIPMENT DAN SUPPORT UNIT",
  "PERJANJIAN SUPPLY FUEL DAN LUBRICANT",
  "PERJANJIAN IMPLEMENTASI APLIKASI DAN SUPPORT DIGITAL",
  "PERJANJIAN JASA CATERING, MESS, DAN FACILITY SERVICES",
  "PERJANJIAN TRANSPORTASI DAN LOGISTIK MATERIAL",
];
const CM_SUBCLASS = {
  "Human Resources": ["Assessment", "Training", "Medical Check Up", "Recruitment Support"],
  "Subcontractor": ["Dewatering Equipment", "Civil Works", "Mining Support", "Plant Maintenance"],
  "Chemicals": ["Water Treatment", "Other Chemicals", "Laboratory Reagent", "Explosive Support"],
  "Ground Engaging Tool (GET)": ["Bucket Teeth", "Adapters", "Cutting Edge", "Wear Parts"],
  "Shoes & Garment": ["Uniform", "Safety Shoes", "Jacket", "PPE Garment"],
  "Heavy Equipment": ["Excavator", "Dozer", "Dump Truck", "Crane"],
  "Fuel & Lubricant": ["Diesel Fuel", "Grease", "Hydraulic Oil", "Engine Oil"],
  "IT & Digital": ["Software", "Infrastructure", "Cyber Security", "Managed Service"],
  "Facility Services": ["Catering", "Camp Services", "Cleaning", "Security"],
  "Logistics": ["Hauling", "Warehouse", "Material Transport", "Courier"],
};
const CM_PICS = [
  { name: "Rahmat Hidayat", email: "rahmat.hidayat@saptaindra.co.id", dept: "Contract Monitoring" },
  { name: "Bayu Setiawan", email: "bayu.setiawan@saptaindra.co.id", dept: "Contract Monitoring" },
  { name: "Sari Indah", email: "sari.indah@saptaindra.co.id", dept: "Contract Monitoring" },
  { name: "Maya Kusuma", email: "maya.kusuma@saptaindra.co.id", dept: "Contract Monitoring" },
  { name: "Fajar Nugroho", email: "fajar.nugroho@saptaindra.co.id", dept: "Contract Monitoring" },
  { name: "Hendra Gunawan", email: "hendra.gunawan@saptaindra.co.id", dept: "Operations" },
  { name: "Putri Handayani", email: "putri.handayani@saptaindra.co.id", dept: "Procurement" },
  { name: "Siti Rahmawati", email: "siti.rahmawati@saptaindra.co.id", dept: "Division Office" },
  { name: "Doni Kurniawan", email: "doni.kurniawan@saptaindra.co.id", dept: "Legal & Contract" },
  { name: "Nadia Salsabila", email: "nadia.salsabila@saptaindra.co.id", dept: "Legal & Contract" },
];
const CM_OWNERS = ["Siti Maryam", "Dini Rachma Putri", "Kadryal Roscie", "Andi Kurniwan", "Dita Irmayana", "Aulia Fathur", "Rendra Pratama", "Wita Aprilia"];
const CM_TEMPLATES = ["Non-Template", "Non-Konsultan", "Fixed Price", "Consignment", "Service Agreement", "Framework Agreement"];
const CM_FREQUENCIES = ["Rutin", "Ad-hoc", "Call Off", "Project Based", "Annual"];
const CM_OWNERSHIP = ["SIS", "ATRI", "AEI", "ADARO", "PARTNER"];
const CM_PRICE_ADJ = [
  "",
  "Fixed price until contract end date.",
  "Price adjustment every 6 months based on fuel index.",
  "Rate review applies after volume exceeds contracted baseline.",
  "Consignment price list update effective per quarter.",
  "Escalation clause applies for exchange rate movement above 5%.",
];

function cmExpiryOffset(i) {
  if (i <= 12) return -1 * (12 + i * 18);
  if (i <= 24) return 3 + (i - 13) * 2;
  if (i <= 39) return 31 + (i - 25) * 2;
  if (i <= 60) return 62 + (i - 40) * 5;
  if (i <= 76) return 123 + (i - 61) * 4;
  return 190 + (i - 77) * 32;
}

const CM_BASE = Array.from({ length: 100 }).map((_, z) => {
  const i = z + 1;
  const cls = pick(CM_CLASSES, i, 7);
  const supplier = pick(CM_SUPPLIERS, i, 3);
  const pic = i % 5 === 0 ? CM_PICS[0] : pick(CM_PICS, i, 2);
  const expOffset = cmExpiryOffset(i);
  const expiredDate = addDays(today, expOffset);
  const effectiveOffset = expOffset > 365 ? expOffset - (365 + (i % 7) * 35) : -1 * (260 + (i % 15) * 22);
  const contractDate = addDays(today, effectiveOffset - 18);
  const value = (350000000 + (i % 17) * 825000000 + Math.floor(i / 4) * 1250000000) * (i % 9 === 0 ? 4 : 1);
  const type = i % 11 === 0 ? "AMENDMENT II" : i % 4 === 0 ? "AMENDMENT I" : "MAIN CONTRACT";
  return {
    RowKind: "BASE",
    Idx: i,
    StatusSeed: expOffset < 0 ? "Expired" : "Active",
    ReceivedDate: addDays(today, effectiveOffset - 28),
    ContractId: `CM-${String(2024 + (i % 3))}-${pad(i, 4)}`,
    Supplier: supplier,
    Title: `${type === "MAIN CONTRACT" ? "" : type + " "}${pick(CM_TITLES, i, 5)}`,
    ValueIDR: value,
    Jobsite: pick(CM_JOBSITES, i, 5),
    Type: type,
    PriceAdj: pick(CM_PRICE_ADJ, i, 3),
    Ownership: pick(CM_OWNERSHIP, i, 2),
    ContractDate: contractDate,
    EffectiveDate: addDays(today, effectiveOffset),
    ExpiredDate: expiredDate,
    DaysToExpiryFromSeedToday: expOffset,
    Template: pick(CM_TEMPLATES, i, 4),
    Classification: cls,
    SubClass: pick(CM_SUBCLASS[cls], i, 3),
    Frequency: pick(CM_FREQUENCIES, i, 6),
    Owner: pick(CM_OWNERS, i, 5),
    UserDept: pic.dept,
    PicName: pic.name,
    PicEmail: pic.email,
    SystemNo1: `90${String(100000 + i * 37)}`,
    SystemNo2: `90${String(200000 + i * 19)}`,
    Link: `https://sharepoint.example.local/contracts/CM-${pad(i, 4)}.pdf`,
  };
});

const CM_ROMAN = { 1: "I", 2: "II" };
function roundM(v) { return Math.round(v / 1000000) * 1000000; }
const CM_AMENDMENTS = [];
CM_BASE.forEach((base) => {
  const i = base.Idx;
  if (base.Type !== "MAIN CONTRACT") return;
  if (i % 5 !== 0 && i % 7 !== 0) return;
  const count = i % 7 === 0 ? 2 : 1;
  let prevExpiry = base.ExpiredDate;
  let prevValue = base.ValueIDR;
  for (let n = 1; n <= count; n++) {
    const roman = CM_ROMAN[n];
    const signed = addDays(prevExpiry, -40);
    const effective = addDays(prevExpiry, 1);
    const expired = addDays(prevExpiry, 365 + ((i + n) % 4) * 30);
    const value = roundM(prevValue * (1.1 + ((i + n) % 4) * 0.03));
    CM_AMENDMENTS.push({
      ...base,
      RowKind: "AMENDMENT",
      Idx: 100 + CM_AMENDMENTS.length + 1,
      StatusSeed: expired < today ? "Expired" : "Active",
      ReceivedDate: addDays(prevExpiry, -48),
      ContractId: base.ContractId,
      Title: `AMENDMENT ${roman} ${base.Title}`,
      ValueIDR: value,
      Type: `AMENDMENT ${roman}`,
      ContractDate: signed,
      EffectiveDate: effective,
      ExpiredDate: expired,
      DaysToExpiryFromSeedToday: Math.round((new Date(`${expired}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000),
      SystemNo1: `90${String(400000 + i * 53 + n)}`,
      SystemNo2: `90${String(500000 + i * 29 + n)}`,
      Link: `https://sharepoint.example.local/contracts/CM-${pad(i, 4)}-AMD-${roman}.pdf`,
    });
    prevExpiry = expired;
    prevValue = value;
  }
});

const cmRows = [...CM_BASE, ...CM_AMENDMENTS];
const distinctContracts = [...new Set(cmRows.map((r) => r.ContractId))];

/* -------------------- IAM -------------------- */
const iamRoles = [
  { RoleId: "R-001", Name: "Super Admin", Module: "(all)", System: "Yes" },
  { RoleId: "R-002", Name: "Administrator Vendor", Module: "vendorOnboarding", System: "No" },
  { RoleId: "R-003", Name: "Administrator Tracker", Module: "proposalTracker", System: "No" },
  { RoleId: "R-004", Name: "Administrator Contract Initiation Platform", Module: "contractInitiationPlatform", System: "No" },
  { RoleId: "R-005", Name: "Administrator Contract Monitoring", Module: "contractMonitoring", System: "No" },
  { RoleId: "R-006", Name: "Division Head", Module: "(cross)", System: "No" },
  { RoleId: "R-007", Name: "Department Head 1", Module: "(cross)", System: "No" },
  { RoleId: "R-008", Name: "Department Head 2", Module: "(cross)", System: "No" },
  { RoleId: "R-009", Name: "Section Head Vendor", Module: "vendorOnboarding", System: "No" },
  { RoleId: "R-010", Name: "Section Head Tracker", Module: "proposalTracker", System: "No" },
  { RoleId: "R-011", Name: "Section Head Contract Initiation Platform", Module: "contractInitiationPlatform", System: "No" },
  { RoleId: "R-012", Name: "Section Head Contract Monitoring", Module: "contractMonitoring", System: "No" },
  { RoleId: "R-013", Name: "Officer Vendor", Module: "vendorOnboarding", System: "No" },
  { RoleId: "R-014", Name: "Officer Tracker", Module: "proposalTracker", System: "No" },
  { RoleId: "R-015", Name: "Officer Contract Initiation Platform", Module: "contractInitiationPlatform", System: "No" },
  { RoleId: "R-016", Name: "Officer Contract Monitoring", Module: "contractMonitoring", System: "No" },
  { RoleId: "R-017", Name: "User Contract Monitoring", Module: "contractMonitoring", System: "No" },
];

const iamUsers = [
  ["P-00001", "Usep Rusnandar", "usep.rusnandar@saptaindra.co.id", "Administration", "Super Admin", "Active", "Super Admin"],
  ["P-00002", "Budi Santoso", "budi.santoso@saptaindra.co.id", "Procurement", "Administrator Vendor", "Active", "Administrator Vendor"],
  ["P-00003", "Rizki Ramadhan", "rizki.ramadhan@saptaindra.co.id", "Procurement", "Administrator Tracker", "Active", "Administrator Tracker"],
  ["P-00004", "Yoga Prasetya", "yoga.prasetya@saptaindra.co.id", "Legal & Contract", "Administrator Contract Initiation Platform", "Active", "Administrator Contract Initiation Platform"],
  ["P-00005", "Bayu Setiawan", "bayu.setiawan@saptaindra.co.id", "Contract Monitoring", "Administrator Contract Monitoring", "Active", "Administrator Contract Monitoring"],
  ["P-00006", "Siti Rahmawati", "siti.rahmawati@saptaindra.co.id", "Division Office", "Division Head", "Active", "Division Head; Administrator Vendor"],
  ["P-00007", "Hendra Gunawan", "hendra.gunawan@saptaindra.co.id", "Operations", "Department Head 1", "Active", "Department Head 1"],
  ["P-00008", "Putri Handayani", "putri.handayani@saptaindra.co.id", "Procurement", "Department Head 2", "Active", "Department Head 2"],
  ["P-00009", "Andi Wijaya", "andi.wijaya@saptaindra.co.id", "Vendor Onboarding", "Section Head Vendor", "Active", "Section Head Vendor"],
  ["P-00010", "Lestari Putri", "lestari.putri@saptaindra.co.id", "Proposal Tracker", "Section Head Tracker", "Active", "Section Head Tracker"],
  ["P-00011", "Wulan Safitri", "wulan.safitri@saptaindra.co.id", "Legal & Contract", "Section Head Contract Initiation Platform", "Inactive", "Section Head Contract Initiation Platform"],
  ["P-00012", "Sari Indah", "sari.indah@saptaindra.co.id", "Contract Monitoring", "Section Head Contract Monitoring", "Active", "Section Head Contract Monitoring"],
  ["P-00013", "Rina Melati", "rina.melati@saptaindra.co.id", "Vendor Onboarding", "Officer Vendor", "Suspended", "Officer Vendor"],
  ["P-00014", "Citra Lestari", "citra.lestari@saptaindra.co.id", "Vendor Onboarding", "Officer Vendor", "Active", "Officer Vendor; Officer Contract Monitoring"],
  ["P-00015", "Agus Pratama", "agus.pratama@saptaindra.co.id", "Proposal Tracker", "Officer Tracker", "Active", "Officer Tracker"],
  ["P-00016", "Tono Hartono", "tono.hartono@saptaindra.co.id", "Proposal Tracker", "Officer Tracker", "Inactive", "Officer Tracker"],
  ["P-00017", "Nadia Salsabila", "nadia.salsabila@saptaindra.co.id", "Legal & Contract", "Officer Contract Initiation Platform", "Active", "Officer Contract Initiation Platform"],
  ["P-00018", "Doni Kurniawan", "doni.kurniawan@saptaindra.co.id", "Legal & Contract", "Officer Contract Initiation Platform", "Active", "Officer Contract Initiation Platform"],
  ["P-00019", "Maya Kusuma", "maya.kusuma@saptaindra.co.id", "Contract Monitoring", "Officer Contract Monitoring", "Active", "Officer Contract Monitoring"],
  ["P-00020", "Fajar Nugroho", "fajar.nugroho@saptaindra.co.id", "Contract Monitoring", "Officer Contract Monitoring", "Active", "Officer Contract Monitoring"],
  ["P-00021", "Rahmat Hidayat", "rahmat.hidayat@saptaindra.co.id", "Contract Monitoring", "User Contract Monitoring", "Active", "User Contract Monitoring"],
  ["P-00022", "Rina Mardiana", "rina.mardiana@saptaindra.co.id", "Proposal Tracker", "Section Head Tracker", "Active", "Section Head Tracker"],
].map((r) => ({
  PersonnelNo: r[0], FullName: r[1], Email: r[2], Department: r[3], JobTitle: r[4], Status: r[5], Roles: r[6],
}));

const profileCounts = trackerProposals.reduce((acc, p) => {
  acc[p.SeedProfile] = (acc[p.SeedProfile] || 0) + 1;
  return acc;
}, {});

const summary = [
  { Module: "Proposal Tracker", Item: "Proposals (active seed cap)", Count: trackerProposals.length, Source: "TrackerData.jsx trkSeedStore / TRK_SCENARIO_CATALOG" },
  { Module: "Proposal Tracker", Item: "Steps master", Count: trackerSteps.length, Source: "TrackerMasterData.jsx TRACKER_STEPS_SEED" },
  { Module: "Proposal Tracker", Item: "Methods master", Count: trackerMethods.length, Source: "TrackerMasterData.jsx TRACKER_METHODS_SEED" },
  { Module: "Proposal Tracker", Item: "Recommended vendors (sample data)", Count: "runtime", Source: "Vendor Database status RGSTD via IRegisteredVendorReadPort" },
  ...Object.entries(profileCounts).map(([k, v]) => ({ Module: "Proposal Tracker", Item: `Profile: ${k}`, Count: v, Source: "TRK_PROFILE_PLAN" })),
  { Module: "CIP", Item: "Derived cases from LOA-ready profiles (estimate)", Count: cipCases.length, Source: "ContractCIPData.jsx cipSeedStore from Tracker LOA" },
  { Module: "Contract Monitoring", Item: "Base contract rows", Count: CM_BASE.length, Source: "ContractMonData.jsx CM_BASE" },
  { Module: "Contract Monitoring", Item: "Amendment rows", Count: CM_AMENDMENTS.length, Source: "ContractMonData.jsx CM_AMENDMENTS" },
  { Module: "Contract Monitoring", Item: "Raw document rows (CM_CONTRACTS)", Count: cmRows.length, Source: "CM_BASE + CM_AMENDMENTS" },
  { Module: "Contract Monitoring", Item: "Distinct Contract No (after merge)", Count: distinctContracts.length, Source: "cmGroups() rule" },
  { Module: "Contract Monitoring", Item: "Reminders seed", Count: 0, Source: "Empty until send/scan runs" },
  { Module: "IAM", Item: "Roles", Count: iamRoles.length, Source: "InitialIamDataSeeder.cs" },
  { Module: "IAM", Item: "Users", Count: iamUsers.length, Source: "InitialIamDataSeeder.cs" },
  { Module: "Notes", Item: "SeedToday baseline used for CM date math", Count: today, Source: "Export script fixed baseline (source uses runtime today)" },
  { Module: "Notes", Item: "LocalDB domain tables currently empty", Count: "0", Source: "sqlcmd count 2026-07-13 — Excel is from source seed, not DB snapshot" },
];

const wb = XLSX.utils.book_new();
function addSheet(name, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

addSheet("00_Summary", summary);
addSheet("01_Tracker_Proposals", trackerProposals);
addSheet("02_Tracker_Steps", trackerSteps);
addSheet("03_Tracker_Methods", trackerMethods);
addSheet("04_Tracker_Vendors", EXCEL_MOCK_WINNERS);
addSheet("05_CIP_Cases_Derived", cipCases);
addSheet("06_CM_Contract_Rows", cmRows);
addSheet("07_IAM_Roles", iamRoles);
addSheet("08_IAM_Users", iamUsers);

const outFile = path.join(outDir, "IntegratedProcurement_SeedData_Review_2026-07-13.xlsx");
XLSX.writeFile(wb, outFile);

console.log(JSON.stringify({
  outFile,
  summary: {
    trackerProposals: trackerProposals.length,
    cipDerivedCases: cipCases.length,
    cmRows: cmRows.length,
    cmDistinctContracts: distinctContracts.length,
    iamUsers: iamUsers.length,
  },
}, null, 2));
