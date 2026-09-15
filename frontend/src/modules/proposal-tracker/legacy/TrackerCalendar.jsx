/* fm3-converted */
import { Holiday, holidayDateSet } from "../../../platform/administration/legacy/ScreensHoliday.jsx";
/* Alamtri Geo Admin — Tracker working-days calendar + SLA compute engine.
   Ported (vanilla) from the reference tracker: SLA, aging, plan dates, overdue, and
   variance are all measured in WORKING DAYS — weekends + master holidays excluded.
   Holidays are sourced from the backend Holiday master via window.holidayDateSet()
   (hydrated from /api/v1/master-data/sets/holiday; see ScreensHoliday). */

/* "today" anchor — real current (local) date so working-days/SLA math reflects real time. */
const TRK_NOW = (function () {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

function _trkHolidaySet() {
  // Holidays come from the backend Holiday master (window.holidayDateSet, hydrated on demand).
  try {
    if (typeof window !== "undefined" && typeof window.holidayDateSet === "function") return window.holidayDateSet();
  } catch (e) {}
  return new Set();
}

function trkParseDate(s) {
  const head = (s || "").split("T")[0] || "";
  const p = head.split("-").map(Number);
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
  const d = new Date(p[0], p[1] - 1, p[2]); d.setHours(0, 0, 0, 0); return d;
}
function trkFmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function trkIsWeekend(d) { const g = d.getDay(); return g === 0 || g === 6; }
function trkIsWorkingDay(d, hol) { return !trkIsWeekend(d) && !hol.has(trkFmtISO(d)); }

/* add N working days after dateStr (start day not counted) */
function trkAddWorkingDays(dateStr, workingDays, hol) {
  hol = hol || _trkHolidaySet();
  const days = Math.max(0, Math.floor(Number.isFinite(workingDays) ? workingDays : 0));
  const start = trkParseDate(dateStr);
  if (!start || days === 0) return start ? trkFmtISO(start) : dateStr;
  const cur = new Date(start); let added = 0;
  while (added < days) { cur.setDate(cur.getDate() + 1); if (trkIsWorkingDay(cur, hol)) added += 1; }
  return trkFmtISO(cur);
}

/* working days strictly after start through end (inclusive). Negative if end < start. */
function trkWorkingDaysBetween(startStr, endStr, hol) {
  hol = hol || _trkHolidaySet();
  const start = trkParseDate(startStr), end = trkParseDate(endStr);
  if (!start || !end || start.getTime() === end.getTime()) return 0;
  if (end > start) {
    let n = 0; const c = new Date(start); c.setDate(c.getDate() + 1);
    while (c <= end) { if (trkIsWorkingDay(c, hol)) n += 1; c.setDate(c.getDate() + 1); }
    return n;
  }
  let n = 0; const c = new Date(end); c.setDate(c.getDate() + 1);
  while (c <= start) { if (trkIsWorkingDay(c, hol)) n -= 1; c.setDate(c.getDate() + 1); }
  return n;
}

/* working days from today → requirement date (positive = future room, negative = past) */
function trkRemainToRequirement(requirementDateStr, now) {
  return trkWorkingDaysBetween(now || TRK_NOW, requirementDateStr, _trkHolidaySet());
}

/* cumulative plan target date per stage: start + running sum of SLA working days */
function trkCumulativeTargetDates(startActivityDateStr, slaDaysArr, hol) {
  hol = hol || _trkHolidaySet();
  let cum = 0;
  return slaDaysArr.map((days) => {
    cum += Math.max(0, Math.floor(Number.isFinite(days) ? days : 0));
    if (!trkParseDate(startActivityDateStr)) return startActivityDateStr;
    return trkAddWorkingDays(startActivityDateStr, cum, hol);
  });
}

/* largest-remainder proportional split of targetTotal across weights */
function trkAllocateProportional(weights, targetTotal) {
  const n = weights.length; if (n === 0) return [];
  const target = Math.max(0, Math.floor(Math.max(0, targetTotal)));
  const w = weights.map((x) => (typeof x === "number" && !Number.isNaN(x) ? Math.max(0, x) : 0));
  const sumW = w.reduce((a, b) => a + b, 0);
  if (sumW === 0) { const base = Math.floor(target / n); const rem = target - base * n; return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0)); }
  const raw = w.map((wi) => (wi / sumW) * target);
  const out = raw.map((x) => Math.floor(x));
  const rem = target - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (let k = 0; k < rem; k++) out[order[k % n].i] += 1;
  return out;
}

/* the ordered activity stages for a method (from Tracker Step + Method master).
   stepsMaster = tm.steps (ordered), method = a tm.methods row with sla map. */
function trkMethodStages(stepsMaster, method) {
  if (!method || !method.sla) return [];
  return stepsMaster
    .filter((s) => method.sla[s.id] != null)
    .map((s) => ({ stepId: s.id, name: s.name, code: s.code, slaDays: Number(method.sla[s.id]) || 0 }));
}

Object.assign(window, {
  TRK_NOW, trkParseDate, trkFmtISO, trkIsWorkingDay, trkAddWorkingDays, trkWorkingDaysBetween,
  trkRemainToRequirement, trkCumulativeTargetDates, trkAllocateProportional, trkMethodStages,
});
export { TRK_NOW, trkParseDate, trkFmtISO, trkIsWorkingDay, trkAddWorkingDays, trkWorkingDaysBetween, trkRemainToRequirement, trkCumulativeTargetDates, trkAllocateProportional, trkMethodStages };
