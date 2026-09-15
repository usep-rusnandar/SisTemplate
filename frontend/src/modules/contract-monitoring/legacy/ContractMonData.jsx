/* fm3-converted */
/* Alamtri Geo Admin - Contract Monitoring data.
   Reset sample data: 100 deterministic contracts with varied expiry, value,
   jobsite, classification, owner, PIC, template, and operational condition. */

const CM_TODAY = (function () {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

const CM_JOBSITES = ["JAHO", "ADMO", "ADMO SERA BORO MACO", "WARA", "KIDECO", "HEAD OFFICE", "MIP", "BALANGAN"];
const CM_CLASSES = [
  "Human Resources",
  "Subcontractor",
  "Chemicals",
  "Ground Engaging Tool (GET)",
  "Shoes & Garment",
  "Heavy Equipment",
  "Fuel & Lubricant",
  "IT & Digital",
  "Facility Services",
  "Logistics",
];

const CM_STATUS = {
  Active:    { en: "Active", id: "Aktif", tone: "success" },
  Expiring:  { en: "Expiring", id: "Akan Berakhir", tone: "warning" },
  Expired:   { en: "Expired", id: "Berakhir", tone: "danger" },
  Draft:     { en: "Draft", id: "Draf", tone: "neutral" },
  Submitted: { en: "Submitted", id: "Diajukan", tone: "info" },
  Verified:  { en: "Verified", id: "Diverifikasi", tone: "info" },
  Approved:  { en: "Approved", id: "Disetujui", tone: "brand" },
};

const CM_REMINDERS = [
  { key: "d30", maxDays: 30,  en: "< 30 days",  id: "< 30 hari",  tone: "danger",  color: "danger" },
  { key: "m2",  maxDays: 60,  en: "< 2 months", id: "< 2 bulan",  tone: "orange",  color: "orange" },
  { key: "m4",  maxDays: 120, en: "< 4 months", id: "< 4 bulan",  tone: "warning", color: "yellow" },
  { key: "m6",  maxDays: 180, en: "< 6 months", id: "< 6 bulan",  tone: "info",    color: "blue" },
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

const CM_TEMPLATES = ["Non-Template", "Non-Konsultan", "Fixed Price", "Consignment", "Service Agreement", "Framework Agreement"];
const CM_FREQUENCIES = ["Rutin", "Ad-hoc", "Call Off", "Project Based", "Annual"];

function cmDateFromToday(days) {
  const d = new Date(CM_TODAY + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* Contract rows are backend-driven — the module reads real imports / CIP final contracts via
   cmLoadContracts() (returns [] when the backend has none). No sample generator lives here.
   cmGroups() still collapses duplicate Contract Nos (originals + amendments) at render time. */
const CM_CONTRACTS = [];

const CM_CONTRACT_STORE_KEY = "ag_cm_contracts_v1";

function cmDaysToExpiry(iso) {
  if (!iso) return null;
  const a = new Date(`${CM_TODAY}T00:00:00`);
  const b = new Date(`${iso}T00:00:00`);
  return Math.round((b - a) / 86400000);
}
function cmBaseTitle(t) { return (t || "").replace(/^(AMANDEMEN|AMENDMENT)\s+[IVX]+\s+/i, "").trim(); }
function cmTypeOrder(t) {
  return ({ "MAIN CONTRACT": 0, "AMENDMENT I": 1, "AMENDMENT II": 2, "AMENDMENT III": 3, "AMENDMENT IV": 4 })[t] != null
    ? ({ "MAIN CONTRACT": 0, "AMENDMENT I": 1, "AMENDMENT II": 2, "AMENDMENT III": 3, "AMENDMENT IV": 4 })[t]
    : 9;
}
function cmSortByExpiry(versions) {
  return [...versions].sort((a, b) =>
    (a.expiredDate || "").localeCompare(b.expiredDate || "") || cmTypeOrder(a.type) - cmTypeOrder(b.type));
}
function cmGroups(rows = []) {
  const map = new Map();
  rows.forEach((c) => {
    if (!map.has(c.contractId)) map.set(c.contractId, []);
    map.get(c.contractId).push(c);
  });
  const groups = [];
  for (const [id, raw] of map) {
    const versions = cmSortByExpiry(raw);
    const first = versions[0];
    const latest = versions[versions.length - 1];
    const days = cmDaysToExpiry(latest.expiredDate);
    const status = latest.status === "Expired" || (days != null && days < 0) ? "Expired" : (days != null && days <= 180 ? "Expiring" : "Active");
    groups.push({
      contractId: id, supplier: latest.supplier, title: cmBaseTitle(first.title),
      classification: latest.classification, subClass: latest.subClass, jobsite: latest.jobsite,
      template: latest.template, frequency: latest.frequency, owner: latest.owner, userDept: latest.userDept,
      picNames: latest.picNames, picEmail: latest.picEmail, value: latest.value, currentExpiry: latest.expiredDate, effectiveDate: first.effectiveDate || latest.effectiveDate,
      contractDate: first.contractDate, receivedDate: latest.receivedDate, ownership: latest.ownership || first.ownership,
      systemNos: latest.systemNos, link: latest.link, priceAdj: latest.priceAdj,
      versions, days, status,
    });
  }
  return groups;
}
function cmAccessForSession(session) {
  const roles = session.effectiveRoles || [session.effectiveRole];
  const has = (name) => roles.includes(name);
  const isDeptHead = roles.some((r) => /^Department Head/.test(r));
  const allView = has("Super Admin") || has("Administrator Contract Monitoring") || has("Division Head") || isDeptHead || has("Section Head Contract Monitoring") || has("Officer Contract Monitoring");
  const ownOnly = has("User Contract Monitoring") && !allView;
  const canWrite = has("Super Admin") || has("Officer Contract Monitoring");
  return { roles, allView, ownOnly, canWrite, label: canWrite ? "CRU" : "View Only" };
}
function cmLoadContracts() {
  try {
    const s = window.__procurementStorage.getItem(CM_CONTRACT_STORE_KEY);
    const parsed = s ? JSON.parse(s) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return [];
}
function cmSaveContracts(list) { try { window.__procurementStorage.setItem(CM_CONTRACT_STORE_KEY, JSON.stringify(list)); } catch (e) {} }
async function cmPersistContracts(list) {
  cmSaveContracts(list);
  const storage = typeof window !== "undefined" ? window.__procurementStorage : null;
  if (storage && typeof storage.flushPendingWrites === "function") {
    await storage.flushPendingWrites();
  }
}
async function cmReloadContracts() {
  const storage = typeof window !== "undefined" ? window.__procurementStorage : null;
  if (storage && typeof storage.refreshItem === "function") {
    await storage.refreshItem(CM_CONTRACT_STORE_KEY);
  }
  return cmLoadContracts();
}

Object.assign(window, {
  CM_TODAY, CM_JOBSITES, CM_CLASSES, CM_STATUS, CM_REMINDERS, CM_CONTRACTS,
  CM_SUBCLASS, CM_PICS, CM_TEMPLATES, CM_FREQUENCIES, cmDateFromToday,
  cmDaysToExpiry, cmGroups, cmAccessForSession, cmLoadContracts, cmSaveContracts,
  cmPersistContracts, cmReloadContracts,
});
export {
  CM_TODAY, CM_JOBSITES, CM_CLASSES, CM_STATUS, CM_REMINDERS, CM_CONTRACTS,
  CM_SUBCLASS, CM_PICS, CM_TEMPLATES, CM_FREQUENCIES, cmDateFromToday,
  cmDaysToExpiry, cmGroups, cmAccessForSession, cmLoadContracts, cmSaveContracts,
  cmPersistContracts, cmReloadContracts,
};
