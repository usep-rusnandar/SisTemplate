import React from "react";
import { useC, FONT, RADIUS } from "./Tokens.jsx";
import { Icon, Card, Button, Select } from "./Primitives.jsx";
import { useI18n } from "./i18n.jsx";

/* Alamtri Geo Admin — advanced primitives: DataTable, Modal, Tabs, Menu, Pagination,
   OTPInput, Alert, Spinner, Skeleton, EmptyState, SegmentedControl, FileUpload, Toasts. */

const APP_DATE_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// The app displays every date/time in Western Indonesia Time (WIB, UTC+7). Timestamps come from the
// backend as UTC ISO instants; we convert them to Jakarta here so the display is WIB regardless of the
// viewer's browser timezone. Bare calendar dates ("YYYY-MM-DD" — contract/tracker business dates) are
// formatted literally with NO timezone shift (they have no time-of-day and must not drift a day).
const APP_TIME_ZONE = "Asia/Jakarta";
// Returns the literal "DD Mon YYYY" for a date-only value ("YYYY-MM-DD"), or null if the value carries a time.
function appDateOnly(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]} ${APP_DATE_MONTHS_SHORT[Number(m[2]) - 1] || ""} ${m[1]}` : null;
}
function fmtAppDate(value) {
  if (value === null || value === undefined || value === "") return "-";
  const only = appDateOnly(value);
  if (only) return only;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" }).format(dt);
}
function fmtAppDateTime(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (appDateOnly(value)) return fmtAppDate(value); // date-only → no time-of-day to show
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(dt).replace(",", "");
}

/* ---------- Alert ---------- */
function Alert({ tone = "info", title, description, onClose, style }) {
  const C = useC();
  const map = { info: { bg: C.infoBg, fg: C.info, icon: "info" }, success: { bg: C.successBg, fg: C.success, icon: "check-circle-2" },
    warning: { bg: C.warningBg, fg: C.warningText, icon: "alert-triangle" }, error: { bg: C.dangerBg, fg: C.danger, icon: "alert-circle" } };
  const t = map[tone] || map.info;
  return (
    <div style={{ ...FONT, display: "flex", gap: 11, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: t.bg, alignItems: "flex-start", border: `1px solid ${t.fg}22`, ...style }}>
      <span style={{ flexShrink: 0, marginTop: 1, display: "flex", color: t.fg }}><Icon name={t.icon} size={16} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</div>
        {description && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2, lineHeight: 1.45 }}>{description}</div>}
      </div>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 0 }}><Icon name="x" size={15} /></button>}
    </div>
  );
}

/* ---------- Spinner / Skeleton / Empty / Tooltip ---------- */
function Spinner({ size = 18, color }) {
  const C = useC();
  return <span style={{ display: "inline-block", width: size, height: size, border: `2px solid ${C.border}`, borderTopColor: color || C.ocean, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}
function Skeleton({ w = "100%", h = 14, r = 6, style }) {
  const C = useC();
  const c1 = C.scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(1,59,82,0.05)";
  const c2 = C.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(1,59,82,0.09)";
  return <span style={{ display: "block", width: w, height: h, borderRadius: r, background: `linear-gradient(90deg, ${c1} 25%, ${c2} 37%, ${c1} 63%)`, backgroundSize: "400% 100%", animation: "shimmer 1.4s ease infinite", ...style }} />;
}
function EmptyState({ icon = "inbox", title, description, action }) {
  const C = useC();
  return (
    <div style={{ ...FONT, textAlign: "center", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.surfaceAlt, border: `1px solid ${C.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.textSubtle, marginBottom: 6 }}><Icon name={icon} size={24} /></span>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 340, lineHeight: 1.5 }}>{description}</div>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

/* ---------- Tooltip (portal, elegant, theme-agnostic dark chip) ---------- */
const TIP_BG = "#04293A", TIP_FG = "#EAF3F5", TIP_BD = "rgba(255,255,255,0.10)";
function tipArrow(side) {
  const sq = { position: "absolute", width: 8, height: 8, backgroundColor: TIP_BG };
  if (side === "top") return { ...sq, left: "50%", bottom: -4.5, transform: "translateX(-50%) rotate(45deg)", borderRight: `1px solid ${TIP_BD}`, borderBottom: `1px solid ${TIP_BD}` };
  if (side === "bottom") return { ...sq, left: "50%", top: -4.5, transform: "translateX(-50%) rotate(45deg)", borderLeft: `1px solid ${TIP_BD}`, borderTop: `1px solid ${TIP_BD}` };
  if (side === "left") return { ...sq, top: "50%", right: -4.5, transform: "translateY(-50%) rotate(45deg)", borderTop: `1px solid ${TIP_BD}`, borderRight: `1px solid ${TIP_BD}` };
  return { ...sq, top: "50%", left: -4.5, transform: "translateY(-50%) rotate(45deg)", borderBottom: `1px solid ${TIP_BD}`, borderLeft: `1px solid ${TIP_BD}` };
}
function Tooltip({ label, side = "top", delay = 220, block, children, style }) {
  const ref = React.useRef(null);
  const tipRef = React.useRef(null);
  const timer = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [vis, setVis] = React.useState(false);
  const [c, setC] = React.useState({ top: -9999, left: -9999, side });

  const reposition = React.useCallback(() => {
    const el = ref.current, tip = tipRef.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight, GAP = 9, M = 8;
    let s = side;
    const room = { top: r.top, bottom: window.innerHeight - r.bottom, left: r.left, right: window.innerWidth - r.right };
    const need = (s === "top" || s === "bottom") ? th + GAP : tw + GAP;
    const opp = { top: "bottom", bottom: "top", left: "right", right: "left" }[s];
    if (room[s] < need && room[opp] >= need) s = opp;
    let top, left;
    if (s === "top") { top = r.top - th - GAP; left = r.left + r.width / 2 - tw / 2; }
    else if (s === "bottom") { top = r.bottom + GAP; left = r.left + r.width / 2 - tw / 2; }
    else if (s === "left") { left = r.left - tw - GAP; top = r.top + r.height / 2 - th / 2; }
    else { left = r.right + GAP; top = r.top + r.height / 2 - th / 2; }
    left = Math.max(M, Math.min(left, window.innerWidth - tw - M));
    top = Math.max(M, Math.min(top, window.innerHeight - th - M));
    setC({ top, left, side: s });
  }, [side]);

  React.useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const raf = requestAnimationFrame(() => setVis(true));
    const onMove = () => reposition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); };
  }, [open, reposition, label]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), delay); };
  const hide = () => { clearTimeout(timer.current); setVis(false); setOpen(false); };

  if (label == null || label === "") return children;
  const enter = { top: "translateY(4px)", bottom: "translateY(-4px)", left: "translateX(4px)", right: "translateX(-4px)" }[c.side];
  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      style={{ display: block ? "block" : "inline-flex", width: block ? "100%" : undefined, ...style }}>
      {children}
      {open && ReactDOM.createPortal(
        <div ref={tipRef} role="tooltip" style={{ ...FONT, position: "fixed", top: c.top, left: c.left, zIndex: 5000, pointerEvents: "none",
          opacity: vis ? 1 : 0, transform: vis ? "none" : enter, transition: "opacity 0.14s ease, transform 0.14s ease",
          backgroundColor: TIP_BG, color: TIP_FG, fontSize: 12, fontWeight: 600, lineHeight: 1.35,
          padding: "6px 10px", borderRadius: 8, whiteSpace: "nowrap", maxWidth: 260, boxShadow: "0 8px 22px rgba(2,17,24,0.30)", border: `1px solid ${TIP_BD}` }}>
          {label}
          <span style={tipArrow(c.side)} />
        </div>, document.body)}
    </span>
  );
}
function SegmentedControl({ options, value, onChange, size = "md" }) {
  const C = useC();
  const h = size === "sm" ? 30 : 34;
  return (
    <div style={{ ...FONT, display: "inline-flex", padding: 3, gap: 2, backgroundColor: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, height: h }}>
      {options.map((o) => {
        const act = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", border: "none",
            borderRadius: RADIUS.sm, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: act ? C.text : C.textMuted,
            backgroundColor: act ? C.surface : "transparent", boxShadow: act ? C.shadowSm : "none", transition: "all 0.12s" }}>
            {o.icon && <Icon name={o.icon} size={14} />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- FileUpload ---------- */
function FileUpload({ hint = "Drag and drop or click to upload", sub = "PNG, JPG up to 5MB" }) {
  const C = useC();
  const [drag, setDrag] = React.useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); }}
      style={{ ...FONT, padding: 22, backgroundColor: drag ? C.hover : C.inputBg, borderRadius: RADIUS.md, border: `1.5px dashed ${drag ? C.ocean : C.border}`, textAlign: "center", cursor: "pointer", transition: "border-color 0.15s, background-color 0.15s" }}>
      <span style={{ display: "inline-flex", color: C.textMuted }}><Icon name="upload-cloud" size={22} /></span>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: C.text }}>{hint}</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

/* ---------- Tabs ---------- */
function Tabs({ tabs, active, onChange, style }) {
  const C = useC();
  return (
    <div style={{ ...FONT, display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, ...style }}>
      {tabs.map((t) => {
        const act = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", border: "none", background: "none",
            cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: act ? C.text : C.textMuted, borderBottom: `2px solid ${act ? C.ocean : "transparent"}`, marginBottom: -1, transition: "color 0.12s" }}>
            {t.icon && <Icon name={t.icon} size={15} color={act ? C.ocean : C.textMuted} />}{t.label}
            {t.badge != null && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, backgroundColor: act ? C.brandBg : C.surfaceAlt, color: act ? C.ocean : C.textMuted }}>{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* Master-data page tabs: icon + sentence-case label + count badge, inside a card rail */
function MasterDataTabsCard({ tabs, active, onChange, children }) {
  return (
    <>
      <Card pad={0} style={{ marginBottom: 0 }}>
        <div style={{ padding: "0 16px", overflowX: "auto" }}>
          <Tabs tabs={tabs} active={active} onChange={onChange} style={{ borderBottom: "none", marginBottom: 0, minWidth: "max-content" }} />
        </div>
      </Card>
      {children != null && <div style={{ marginTop: 16 }}>{children}</div>}
    </>
  );
}

/* ---------- Menu / Dropdown (portal-rendered so it layers above tables/overflow) ---------- */
function Menu({ trigger, children, align = "right", width = 220, menuStyle }) {
  const C = useC();
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });

  const place = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mh = menuRef.current ? menuRef.current.offsetHeight : 0;
    let top = r.bottom + 6;
    if (mh && top + mh > window.innerHeight - 8) {
      const above = r.top - 6 - mh;
      if (above > 8) top = above;
    }
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({ top, left });
  }, [align, width]);

  React.useLayoutEffect(() => { if (open) place(); }, [open, place]);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); };
  }, [open, place]);

  return (
    <div ref={triggerRef} style={{ position: "relative", display: "inline-flex" }}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} onClick={() => setOpen(false)} style={{ ...FONT, position: "fixed", top: pos.top, left: pos.left, zIndex: 4000, width,
          backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, boxShadow: C.shadowOverlay, padding: 5, ...menuStyle }}>
          {children}
        </div>, document.body)}
    </div>
  );
}
function MenuItem({ icon, label, onClick, danger, trailing, active, disabled }) {
  const C = useC();
  const [h, setH] = React.useState(false);
  const fg = disabled ? C.textSubtle : danger ? C.danger : C.text;
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ ...FONT, display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", border: "none", textAlign: "left",
        backgroundColor: !disabled && h ? (danger ? C.dangerBg : C.hover) : (active ? C.active : "transparent"), borderRadius: RADIUS.sm, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontSize: 13, fontWeight: 500, color: fg }}>
      {icon && <Icon name={icon} size={15} color={disabled ? C.textSubtle : danger ? C.danger : C.textMuted} />}
      <span style={{ flex: 1 }}>{label}</span>
      {trailing}
    </button>
  );
}
function MenuLabel({ children }) {
  const C = useC();
  return <div style={{ ...FONT, padding: "6px 10px 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textSubtle }}>{children}</div>;
}
function MenuDivider() { const C = useC(); return <div style={{ height: 1, backgroundColor: C.borderSoft, margin: "5px 0" }} />; }

/* ---------- Modal ---------- */
/* bodyRef exposes the scrolling body element — a modal that owns its own scroll (the full-screen vendor
   dossier) needs it to offer a back-to-top control. */
function Modal({ open, onClose, title, subtitle, icon, children, footer, width = 560, style, overlayStyle, bodyStyle, bodyRef, hideHeader = false }) {
  const C = useC();
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  const node = (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(2,17,24,0.55)", backdropFilter: "blur(1px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "56px 20px", overflowY: "auto", ...overlayStyle }}>
      <div style={{ ...FONT, width: "100%", maxWidth: width, backgroundColor: C.surface, borderRadius: RADIUS.lg, border: `1px solid ${C.border}`,
        boxShadow: C.shadowLg, animation: "modalIn 0.16s ease", ...style }}>
        {!hideHeader && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
            {icon && <span style={{ width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={icon} size={19} /></span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 4, marginTop: -2, borderRadius: 6 }}><Icon name="x" size={18} /></button>
          </div>
        )}
        <div ref={bodyRef} style={{ padding: 20, maxHeight: "calc(100vh - 220px)", overflowY: "auto", ...bodyStyle }}>{children}</div>
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, borderRadius: `0 0 ${RADIUS.lg}px ${RADIUS.lg}px` }}>{footer}</div>}
      </div>
    </div>
  );
  return (typeof ReactDOM !== "undefined" && typeof document !== "undefined" && document.body)
    ? ReactDOM.createPortal(node, document.body)
    : node;
}

/* Available width for a matrix/DataTable frame. Walk toward <main> and take the
   narrowest padded slot so a child that grew to the table min-content (flex/grid
   min-width:auto) does not report "I am as wide as my table" and hide the H-bar.
   Re-binds on `observeKey` so EmptyState → rows (F5 / Refresh) still measures. */
function readStickyTableSlotWidth(el) {
  if (!el) return 0;
  let slot = Math.round(el.getBoundingClientRect().width || el.clientWidth || 0);
  let node = el.parentElement;
  while (node && node !== document.body) {
    const cs = window.getComputedStyle(node);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const inner = Math.round((node.clientWidth || 0) - pl - pr);
    if (inner > 0 && (slot <= 0 || inner < slot - 1)) slot = inner;
    const oy = cs.overflowY;
    if (node.tagName === "MAIN" || oy === "auto" || oy === "scroll") break;
    node = node.parentElement;
  }
  return slot;
}

function useConstrainedFrameWidth(frameRef, observeKey) {
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const measure = () => {
      const next = readStickyTableSlotWidth(el);
      if (next > 0) setWidth((prev) => (prev === next ? prev : next));
    };
    measure();
    const raf = requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(measure);
    });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (ro) {
      ro.observe(el);
      if (el.parentElement) ro.observe(el.parentElement);
    }
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [observeKey]);
  return width;
}

/* Ground-truth overflow: the hidden body scroller, not a stale containerW. */
function useBodyHOverflow(bodyRef, observeKey) {
  const [state, setState] = React.useState({ overflowing: false, scrollWidth: 0 });
  React.useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const sync = () => {
      const scrollWidth = body.scrollWidth;
      const clientWidth = body.clientWidth;
      const overflowing = scrollWidth > clientWidth + 1;
      setState((prev) => (prev.overflowing === overflowing && prev.scrollWidth === scrollWidth ? prev : { overflowing, scrollWidth }));
    };
    sync();
    const raf = requestAnimationFrame(sync);
    const ro = new ResizeObserver(sync);
    ro.observe(body);
    if (body.firstElementChild) ro.observe(body.firstElementChild);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [observeKey]);
  return state;
}

function useLockstepHScroll(bodyRef, headerRef, fakeRef, observeKey) {
  React.useEffect(() => {
    const body = bodyRef.current;
    const header = headerRef.current;
    const fake = fakeRef.current;
    if (!body) return undefined;
    let raf = null;
    let sBody = false;
    let sFake = false;
    let sHead = false;
    const apply = (left, setB, setF, setH) => {
      const next = Math.max(0, left);
      if (setB) { sBody = true; body.scrollLeft = next; }
      if (setF && fake) { sFake = true; fake.scrollLeft = next; }
      if (setH && header) { sHead = true; header.scrollLeft = next; }
    };
    const onBody = () => { if (sBody) { sBody = false; return; } if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => apply(body.scrollLeft, false, true, true)); };
    const onFake = () => { if (sFake) { sFake = false; return; } if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => apply(fake.scrollLeft, true, false, true)); };
    const onHead = () => { if (sHead) { sHead = false; return; } if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => apply(header.scrollLeft, true, true, false)); };
    body.addEventListener("scroll", onBody, { passive: true });
    if (fake) fake.addEventListener("scroll", onFake, { passive: true });
    if (header) header.addEventListener("scroll", onHead, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      body.removeEventListener("scroll", onBody);
      if (fake) fake.removeEventListener("scroll", onFake);
      if (header) header.removeEventListener("scroll", onHead);
    };
  }, [observeKey]);
}

/* ---------- DataTable ----------
   Sticky header + sticky horizontal scrollbar, both pinned to the page viewport.
   Pattern (adapted from a cloned-header reference): the sticky <thead> lives in a
   SEPARATE table that is a SIBLING of the horizontally-scrolling body — so
   position:sticky resolves to the page scroller (<main>), not an inner box. A
   JS-synced "fake" scrollbar sticks to the viewport bottom. Both tables share one
   fixed colgroup so columns stay perfectly aligned. */
const DT_MIN_FLEX = 150;
function DataTable({ columns, data, rowKey = "id", sortKey, sortDir, onSort, selectable, selected = [], onToggleRow, onToggleAll, onRowClick, loading, emptyTitle = "No records found", emptyDesc, dense, striped, stickyTop = 0 }) {
  const C = useC();
  const [hoverRow, setHoverRow] = React.useState(null);
  const frameRef = React.useRef(null);
  const headerScrollRef = React.useRef(null);
  const bodyScrollRef = React.useRef(null);
  const fakeScrollRef = React.useRef(null);
  const fakeInnerRef = React.useRef(null);
  const [containerW, setContainerW] = React.useState(0);

  const allChecked = selectable && data.length > 0 && data.every((r) => selected.includes(r[rowKey]));
  const padV = dense ? "9px" : "12px";

  // full column model (prepend a selection column when selectable)
  const cols = selectable ? [{ __sel: true, key: "__sel", width: 46, align: "center" }, ...columns] : columns;

  // resolve per-column widths: fixed widths honored, the rest share leftover space
  const layout = React.useMemo(() => {
    const fixed = cols.reduce((s, c) => s + (c.width || 0), 0);
    const flexCount = cols.filter((c) => !c.width).length;
    let widths;
    if (flexCount > 0) {
      const per = Math.max(DT_MIN_FLEX, (containerW - fixed) / flexCount);
      widths = cols.map((c) => c.width || per);
    } else {
      widths = cols.map((c) => c.width);
      if (containerW && fixed < containerW && widths.length) widths[widths.length - 1] += containerW - fixed;
    }
    return { widths, total: widths.reduce((s, w) => s + w, 0) };
  }, [cols, containerW]);
  const overflowing = containerW > 0 && layout.total > containerW + 1;

  React.useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // keep the three horizontal scrollers in lockstep
  React.useEffect(() => {
    const body = bodyScrollRef.current, header = headerScrollRef.current, fake = fakeScrollRef.current;
    if (!body) return;
    let raf = null, sBody = false, sFake = false, sHead = false;
    const apply = (l, setB, setF, setH) => {
      if (setB) { sBody = true; body.scrollLeft = l; }
      if (setF && fake) { sFake = true; fake.scrollLeft = l; }
      if (setH && header) { sHead = true; header.scrollLeft = l; }
    };
    const onBody = () => { if (sBody) { sBody = false; return; } if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => apply(body.scrollLeft, false, true, true)); };
    const onFake = () => { if (sFake) { sFake = false; return; } if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => apply(fake.scrollLeft, true, false, true)); };
    const onHead = () => { if (sHead) { sHead = false; return; } if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => apply(header.scrollLeft, true, true, false)); };
    body.addEventListener("scroll", onBody, { passive: true });
    if (fake) fake.addEventListener("scroll", onFake, { passive: true });
    if (header) header.addEventListener("scroll", onHead, { passive: true });
    return () => { if (raf) cancelAnimationFrame(raf); body.removeEventListener("scroll", onBody); if (fake) fake.removeEventListener("scroll", onFake); if (header) header.removeEventListener("scroll", onHead); };
  }, [layout.total, containerW, overflowing, data.length, loading]);

  const tableStyle = { width: layout.total || "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 13 };
  const colGroup = <colgroup>{layout.widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
  const checkbox = (on) => <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${on ? C.primary : C.border}`, backgroundColor: on ? C.primary : C.inputBg, display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}>{on && <Icon name="check" size={10} color="#fff" strokeWidth={3} />}</span>;

  if (!loading && data.length === 0) {
    return <div ref={frameRef}><EmptyState icon="search-x" title={emptyTitle} description={emptyDesc} /></div>;
  }

  return (
    <div ref={frameRef} style={{ ...FONT, position: "relative" }}>
      {/* cloned sticky header (sibling of the scrolling body → sticks to the page) */}
      <div style={{ position: "sticky", top: stickyTop, zIndex: 6, backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
        <div ref={headerScrollRef} className="ag-hide-scroll" style={{ overflowX: "auto", overflowY: "hidden" }}>
          <table style={tableStyle}>
            {colGroup}
            <thead>
              <tr>
                {cols.map((c, i) => c.__sel ? (
                  <th key="__sel" style={{ padding: "10px 14px", textAlign: "center" }}>
                    <span onClick={() => onToggleAll && onToggleAll(!allChecked)} style={{ display: "inline-flex", cursor: "pointer" }}>{checkbox(allChecked)}</span>
                  </th>
                ) : (
                  <th key={i} onClick={() => c.sortable && onSort && onSort(c.key)}
                    style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textMuted, whiteSpace: "nowrap", textAlign: c.align || "left", cursor: c.sortable ? "pointer" : "default" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: c.align === "right" ? "flex-end" : "flex-start" }}>
                      {c.label}
                      {c.sortable && <span style={{ display: "inline-flex", color: sortKey === c.key ? C.ocean : C.textSubtle }}>
                        <Icon name={sortKey === c.key ? (sortDir === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down"} size={13} /></span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* body — the real horizontal scroller (native scrollbar hidden; driven by the fake one) */}
      <div ref={bodyScrollRef} className="ag-hide-scroll" style={{ overflowX: "auto", overflowY: "hidden", backgroundColor: C.surface }}>
        <table style={tableStyle}>
          {colGroup}
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, ri) => (
              <tr key={"s" + ri}>{cols.map((c, ci) => <td key={ci} style={{ padding: padV + " 14px", borderBottom: `1px solid ${C.borderSoft}` }}>{c.__sel ? <Skeleton w={16} h={16} /> : <Skeleton w={ci === 1 ? "70%" : "50%"} />}</td>)}</tr>
            ))}
            {!loading && data.map((row, ri) => {
              const id = row[rowKey];
              const checked = selected.includes(id);
              const hov = hoverRow === id;
              const stripe = striped && ri % 2 === 1 ? C.surfaceInset : "transparent";
              return (
                <tr key={id} onMouseEnter={() => setHoverRow(id)} onMouseLeave={() => setHoverRow(null)} onClick={() => onRowClick && onRowClick(row)}
                  style={{ backgroundColor: checked ? C.active : hov ? C.hover : stripe, cursor: onRowClick ? "pointer" : "default", transition: "background-color 0.1s" }}>
                  {cols.map((c, ci) => c.__sel ? (
                    <td key="__sel" onClick={(e) => { e.stopPropagation(); onToggleRow && onToggleRow(id); }} style={{ padding: padV + " 14px", borderBottom: `1px solid ${C.borderSoft}`, textAlign: "center", cursor: "pointer" }}>{checkbox(checked)}</td>
                  ) : (
                    <td key={ci} style={{ padding: padV + " 14px", textAlign: c.align || "left", color: C.text, borderBottom: `1px solid ${C.borderSoft}`, whiteSpace: c.nowrap ? "nowrap" : "normal", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.render ? c.render(row, hov) : row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* fake horizontal scrollbar — pinned to the viewport bottom */}
      <div ref={fakeScrollRef} aria-hidden="true" style={{ position: "sticky", bottom: 0, zIndex: 6, height: overflowing ? 14 : 0, overflowX: "scroll", overflowY: "hidden",
        borderTop: overflowing ? `1px solid ${C.border}` : "none", backgroundColor: C.surface, opacity: overflowing ? 1 : 0, pointerEvents: overflowing ? "auto" : "none", transition: "opacity 0.15s" }}>
        <div ref={fakeInnerRef} style={{ width: layout.total, height: 1 }} />
      </div>
    </div>
  );
}

/* ---------- Pagination ---------- */
function Pagination({ page, pageCount, onPage, total, pageSize, onPageSize }) {
  const C = useC();
  const { t } = useI18n();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const btn = (p, label, dis, act) => (
    <button key={label} disabled={dis} onClick={() => !dis && onPage(p)} style={{ ...FONT, minWidth: 32, height: 32, padding: "0 8px", borderRadius: RADIUS.sm,
      border: `1px solid ${act ? C.ocean : C.border}`, backgroundColor: act ? C.brandBg : C.surface, color: dis ? C.textSubtle : act ? C.ocean : C.text,
      fontSize: 12.5, fontWeight: act ? 700 : 500, cursor: dis ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{label}</button>
  );
  const pages = [];
  const rng = (a, b) => { for (let i = a; i <= b; i++) pages.push(i); };
  if (pageCount <= 7) rng(1, pageCount);
  else if (page <= 4) { rng(1, 5); pages.push("…", pageCount); }
  else if (page >= pageCount - 3) { pages.push(1, "…"); rng(pageCount - 4, pageCount); }
  else { pages.push(1, "…"); rng(page - 1, page + 1); pages.push("…", pageCount); }
  return (
    <div style={{ ...FONT, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "12px 4px 2px" }}>
      <div style={{ fontSize: 12.5, color: C.textMuted, display: "flex", alignItems: "center", gap: 12 }}>
        <span>{t("common.showing")} <b style={{ color: C.text }}>{start}–{end}</b> {t("common.of")} <b style={{ color: C.text }}>{total}</b> {t("common.results")}</span>
        {onPageSize && (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{t("common.rowsPerPage")}
            <span style={{ width: 64 }}><Select size="sm" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} options={[10, 25, 50, 100].map((n) => ({ value: n, label: String(n) }))} /></span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {btn(page - 1, "‹", page <= 1)}
        {pages.map((p, i) => p === "…" ? <span key={"e" + i} style={{ color: C.textSubtle, padding: "0 2px" }}>…</span> : btn(p, p, false, p === page))}
        {btn(page + 1, "›", page >= pageCount)}
      </div>
    </div>
  );
}

/* ---------- OTP Input ---------- */
function OTPInput({ length = 6, value, onChange, status }) {
  const C = useC();
  const refs = React.useRef([]);
  const set = (i, v) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const arr = value.split("");
    arr[i] = ch; const next = arr.join("").slice(0, length);
    onChange(next);
    if (ch && i < length - 1) refs.current[i + 1] && refs.current[i + 1].focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1] && refs.current[i - 1].focus();
  };
  const onPaste = (e) => { e.preventDefault(); const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, length); onChange(txt); const f = Math.min(txt.length, length - 1); refs.current[f] && refs.current[f].focus(); };
  const border = status === "error" ? C.danger : status === "success" ? C.success : C.border;
  return (
    <div style={{ display: "flex", gap: 10 }} onPaste={onPaste}>
      {Array.from({ length }).map((_, i) => {
        const filled = !!value[i];
        return (
          <input key={i} ref={(el) => (refs.current[i] = el)} value={value[i] || ""} inputMode="numeric" maxLength={1}
            onChange={(e) => set(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} onFocus={(e) => e.target.select()}
            style={{ ...FONT, width: 50, height: 58, textAlign: "center", fontSize: 22, fontWeight: 700, color: C.text, backgroundColor: C.inputBg,
              border: `1.5px solid ${filled && status !== "error" ? C.ocean : border}`, borderRadius: RADIUS.md, outline: "none",
              boxShadow: status === "error" ? C.errorRing : status === "success" ? "0 0 0 3px rgba(17,113,59,0.15)" : "none", transition: "all 0.12s" }} />
        );
      })}
    </div>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = React.createContext({ push: () => {} });
function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, tone: "success", ...toast }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), toast.duration || 3600);
  }, []);
  // Memoized: an inline `value={{ push }}` allocated a new context value on every provider render, so
  // every useCallback([toast]) in a consumer changed identity each render — enough to turn a
  // `useEffect(..., [loadX])` mount fetch into an endless refetch loop.
  const toastApi = React.useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={toastApi}>
      {children}
      <div style={{ position: "fixed", top: 18, right: 18, zIndex: 4000, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
        {toasts.map((t) => <ToastCard key={t.id} toast={t} onClose={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} />)}
      </div>
    </ToastCtx.Provider>
  );
}
function ToastCard({ toast, onClose }) {
  const C = useC();
  const map = { success: { fg: C.success, icon: "check-circle-2" }, error: { fg: C.danger, icon: "alert-circle" }, info: { fg: C.info, icon: "info" }, warning: { fg: C.warningText, icon: "alert-triangle" } };
  const m = map[toast.tone] || map.success;
  return (
    <div style={{ ...FONT, pointerEvents: "auto", minWidth: 280, maxWidth: 380, display: "flex", gap: 11, alignItems: "flex-start", padding: "13px 14px",
      backgroundColor: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${m.fg}`, borderRadius: RADIUS.md, boxShadow: C.shadowOverlay, animation: "toastIn 0.2s ease" }}>
      <span style={{ color: m.fg, display: "flex", marginTop: 1 }}><Icon name={m.icon} size={17} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{toast.title}</div>
        {toast.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{toast.description}</div>}
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSubtle, display: "flex", padding: 0 }}><Icon name="x" size={14} /></button>
    </div>
  );
}
function useToast() { return React.useContext(ToastCtx); }

/* ---------- Breadcrumb / PageHeader / Toolbar (shared page chrome) ---------- */
function Breadcrumb({ items }) {
  const C = useC();
  return (
    <nav style={{ ...FONT, display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: last ? C.text : C.textMuted, fontWeight: last ? 600 : 500, cursor: it.onClick ? "pointer" : "default" }} onClick={it.onClick}>{it.label}</span>
            {!last && <Icon name="chevron-right" size={13} color={C.textSubtle} />}
          </span>
        );
      })}
    </nav>
  );
}
function PageHeader({ title, description, breadcrumb, actions, meta, style }) {
  const C = useC();
  return (
    <div style={{ ...FONT, display: "flex", flexDirection: "column", gap: 12, marginBottom: 22, ...style }}>
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0 }}>{title}</h2>
          {description && <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 5, marginBottom: 0, maxWidth: 680, lineHeight: 1.5 }}>{description}</p>}
          {meta && <div style={{ marginTop: 10 }}>{meta}</div>}
        </div>
        {actions && <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>{actions}</div>}
      </div>
    </div>
  );
}
function Toolbar({ left, right, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{left}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{right}</div>
    </div>
  );
}

/* ---------- Ops console layout (Super Admin · Administration · Master Data) ----------
   Shared gradient hero + compact stat cards — same visual language as Authorization Master. */

const OPS_HERO_GRAD = "linear-gradient(118deg, #012B3E 0%, #013B52 38%, #0F828A 100%)";
const OPS_HERO_PATTERN =
  "radial-gradient(ellipse 520px 300px at 88% -20%, rgba(63,182,190,0.35), transparent 60%), " +
  "radial-gradient(ellipse 420px 260px at 12% 130%, rgba(0,92,150,0.45), transparent 65%), " +
  "repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 26px)";

(function injectOpsLayoutCss() {
  if (typeof document === "undefined" || document.getElementById("ag-ops-layout-css")) return;
  const el = document.createElement("style");
  el.id = "ag-ops-layout-css";
  el.textContent = `
    @keyframes opsFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes opsOrbDrift { 0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.55; } 50% { transform: translate(-12px, 8px) scale(1.06); opacity: 0.75; } }
    .ops-fade-up { animation: opsFadeUp .5s cubic-bezier(.2,.7,.3,1) both; }
    .ops-page { position: relative; }
    .ops-page::before {
      content: ""; position: absolute; inset: -24px -28px auto; height: 280px; pointer-events: none; z-index: 0;
      background:
        radial-gradient(ellipse 55% 80% at 92% -15%, rgba(15,130,138,0.09), transparent 70%),
        radial-gradient(ellipse 45% 65% at 4% 0%, rgba(0,92,150,0.07), transparent 65%);
    }
    .ops-page > * { position: relative; z-index: 1; }
    .ops-hero { isolation: isolate; }
    .ops-grain {
      position: absolute; inset: 0; pointer-events: none; opacity: 0.38; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
      background-size: 180px 180px;
    }
    .ops-hero-orb {
      position: absolute; width: 220px; height: 220px; border-radius: 50%; pointer-events: none;
      top: -80px; right: -40px;
      background: radial-gradient(circle, rgba(127,212,217,0.35) 0%, rgba(15,130,138,0.12) 45%, transparent 70%);
      animation: opsOrbDrift 9s ease-in-out infinite;
    }
    .ops-display { font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, 'Times New Roman', serif; font-weight: 600; letter-spacing: -0.02em; }
    .ops-stat-grid { display: grid; gap: 12px; margin-bottom: 16px; }
    .ops-stat-grid.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ops-stat-grid.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ops-stat-grid.cols-4 { grid-template-columns: repeat(4, minmax(170px, 1fr)); }
    @media (max-width: 1180px) { .ops-stat-grid.cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 720px)  { .ops-stat-grid.cols-3, .ops-stat-grid.cols-4, .ops-stat-grid.cols-2 { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .ops-fade-up, .ops-hero-orb { animation: none !important; } }
  `;
  document.head.appendChild(el);
})();

function OpsPage({ children }) {
  return <div className="ops-page">{children}</div>;
}

function OpsHero({ kicker, kickerIcon = "sparkles", title, subtitle, right, children, compact = true, style }) {
  return (
    <div className="ops-fade-up ops-hero" style={{ position: "relative", overflow: "hidden", borderRadius: RADIUS.xl, background: OPS_HERO_GRAD,
      padding: compact ? "20px 24px" : "26px 28px", marginBottom: 18, color: "#fff", boxShadow: "0 18px 48px rgba(1,43,62,0.22)", ...style }}>
      <div className="ops-grain" aria-hidden="true" />
      <div className="ops-hero-orb" aria-hidden="true" />
      <div style={{ position: "absolute", inset: 0, background: OPS_HERO_PATTERN, pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          {kicker && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FD4D9", marginBottom: 8 }}>
              <Icon name={kickerIcon} size={12} color="#7FD4D9" />{kicker}
            </div>
          )}
          <div className="ops-display" style={{ fontSize: compact ? 22 : 26, lineHeight: 1.18 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 8, maxWidth: 680, lineHeight: 1.58, fontWeight: 500 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function OpsHeroButton({ variant = "secondary", style, children, ...props }) {
  const heroStyle = variant === "primary"
    ? { backgroundColor: "#fff", color: "#013B52", border: "none" }
    : variant === "destructive"
      ? { backgroundColor: "rgba(220,53,40,0.9)", color: "#fff", border: "none" }
      : { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.35)", color: "#fff" };
  return <Button variant="secondary" style={{ ...heroStyle, ...style }} {...props}>{children}</Button>;
}

function OpsStatGrid({ cols = 4, children, className = "" }) {
  return <div className={`ops-stat-grid cols-${cols} ${className}`.trim()}>{children}</div>;
}

function OpsStatCard({ icon, label, value, sub, iconTone = "brand" }) {
  const C = useC();
  const tones = {
    brand: { bg: C.brandBg, fg: C.ocean },
    blue: { bg: C.infoBg, fg: C.info },
    orange: { bg: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)", fg: C.orange },
    forest: { bg: C.successBg, fg: C.success },
    danger: { bg: C.dangerBg, fg: C.danger },
  };
  const it = tones[iconTone] || tones.brand;
  return (
    <Card style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: it.bg, color: it.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 11, color: C.textMuted, fontWeight: 700 }}>{label}</span>
        <span style={{ display: "block", fontSize: 18, color: C.text, fontWeight: 800, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        {sub && <span style={{ display: "block", fontSize: 10.5, color: C.textSubtle, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
      </span>
    </Card>
  );
}

export { fmtAppDate, fmtAppDateTime, Alert, Spinner, Skeleton, EmptyState, SegmentedControl, FileUpload, Tabs, MasterDataTabsCard, Menu, MenuItem, MenuLabel, MenuDivider, Modal, DataTable, Pagination, OTPInput, ToastProvider, useToast, Breadcrumb, PageHeader, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard, OPS_HERO_GRAD, Tooltip, useConstrainedFrameWidth, useBodyHOverflow, useLockstepHScroll };
Object.assign(window, { fmtAppDate, fmtAppDateTime, Alert, Spinner, Skeleton, EmptyState, SegmentedControl, FileUpload, Tabs, MasterDataTabsCard, Menu, MenuItem, MenuLabel, MenuDivider, Modal, DataTable, Pagination, OTPInput, ToastProvider, useToast, Breadcrumb, PageHeader, Toolbar, OpsPage, OpsHero, OpsHeroButton, OpsStatGrid, OpsStatCard, OPS_HERO_GRAD, Tooltip });
