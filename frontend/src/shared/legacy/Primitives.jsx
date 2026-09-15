import React from "react";
import { useC, FONT, RADIUS } from "./Tokens.jsx";
import { useI18n } from "./i18n.jsx";
import { Tooltip } from "./PrimitivesX.jsx";

/* Alamtri Geo Admin — core primitives. All theme-aware via useC(). Exposed on window. */

/* ---------- Icon (Lucide, self-managed DOM) ---------- */
function Icon({ name, size = 16, color, strokeWidth = 2, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = "";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    el.appendChild(i);
    window.lucide.createIcons();
    const svg = el.querySelector("svg");
    if (svg) { svg.setAttribute("width", size); svg.setAttribute("height", size); svg.setAttribute("stroke-width", strokeWidth); }
  }, [name, size, strokeWidth]);
  return <span ref={ref} style={{ display: "inline-flex", width: size, height: size, color, ...style }} />;
}

/* ---------- Flag (real flag images, not emoji) ---------- */
const FLAG_SRC = { en: "/assets/flags/us.jpg", us: "/assets/flags/us.jpg", gb: "/assets/flags/us.jpg", id: "/assets/flags/id.jpg" };
function Flag({ code, size = 22, style }) {
  const C = useC();
  const src = FLAG_SRC[code];
  const w = size, h = Math.round(size * 0.72);
  if (!src) return <span style={{ fontSize: size, lineHeight: 1, ...style }}>\uD83C\uDF10</span>;
  return <img src={src} alt={code} style={{ width: w, height: h, objectFit: "cover", borderRadius: 3, border: `1px solid ${C.border}`, display: "block", ...style }} />;
}

/* ---------- Button ---------- */
const BTN_SIZE = {
  xs: { padding: "0 10px", fontSize: 12, height: 28, gap: 6 },
  sm: { padding: "0 12px", fontSize: 12.5, height: 32, gap: 6 },
  md: { padding: "0 16px", fontSize: 13.5, height: 38, gap: 8 },
  lg: { padding: "0 20px", fontSize: 14.5, height: 44, gap: 8 },
};
function Button({ variant = "primary", size = "md", iconLeft, iconRight, fullWidth, children, disabled, onClick, type, style }) {
  const C = useC();
  const sz = BTN_SIZE[size];
  const [hover, setHover] = React.useState(false);
  const variants = {
    primary: { bg: C.primary, fg: C.onPrimary, bd: C.primary, hbg: C.primaryHover },
    secondary: { bg: C.surface, fg: C.text, bd: C.border, hbg: C.hover },
    ghost: { bg: "transparent", fg: C.text, bd: "transparent", hbg: C.hover },
    accent: { bg: C.ocean, fg: "#fff", bd: C.ocean, hbg: C.scheme === "dark" ? "#2f9aa2" : "#0c6b72" },
    destructive: { bg: C.danger, fg: "#fff", bd: C.danger, hbg: C.scheme === "dark" ? "#d8543d" : "#a32a14" },
    link: { bg: "transparent", fg: C.ocean, bd: "transparent", hbg: "transparent", link: true },
  };
  const vs = variants[variant] || variants.primary;
  const disStyle = disabled ? { backgroundColor: C.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(1,59,82,0.06)", color: C.textSubtle, border: "1px solid transparent", cursor: "not-allowed" } : {};
  return (
    <button type={type || "button"} onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...FONT, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
        fontSize: sz.fontSize, gap: sz.gap, height: vs.link ? "auto" : sz.height, padding: vs.link ? 0 : sz.padding,
        borderRadius: vs.link ? 0 : RADIUS.md, cursor: "pointer", outline: "none", transition: "background-color 0.15s, border-color 0.15s",
        backgroundColor: hover && !vs.link ? vs.hbg : vs.bg, color: vs.fg, border: "1px solid " + vs.bd,
        textDecoration: vs.link && hover ? "underline" : "none", width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap", ...disStyle, ...style }}>
      {iconLeft && <Icon name={iconLeft} size={sz.fontSize + 1} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sz.fontSize + 1} />}
    </button>
  );
}
function IconButton({ variant = "ghost", size = "md", name, onClick, title, tipSide = "bottom", active, disabled = false, ariaLabel, style }) {
  const C = useC();
  const dim = { sm: 30, md: 36, lg: 40 }[size];
  const [hover, setHover] = React.useState(false);
  const base = variant === "secondary"
    ? { bg: C.surface, bd: C.border, fg: C.textMuted, hbg: C.hover }
    : variant === "brand"
      ? { bg: C.brandBg, bd: C.ocean, fg: C.ocean, hbg: C.active }
      : { bg: "transparent", bd: "transparent", fg: C.textMuted, hbg: C.hover };
  return (
    <Tooltip label={title} side={tipSide}>
      <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} aria-label={ariaLabel || title}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ ...FONT, width: dim, height: dim, borderRadius: RADIUS.md, cursor: disabled ? "not-allowed" : "pointer", outline: "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          backgroundColor: active ? C.active : hover ? base.hbg : base.bg, color: active ? C.ocean : base.fg,
          border: "1px solid " + base.bd, opacity: disabled ? 0.5 : 1, transition: "background-color 0.15s, color 0.15s", ...style }}>
        <Icon name={name} size={18} />
      </button>
    </Tooltip>
  );
}

// Canonical refresh control for data tables: compact, secondary, and tooltip-labelled.
// Keep refresh close to the data it reloads instead of promoting it to a page-level action.
function TableRefreshButton({ onClick, title, tipSide = "bottom", style, disabled }) {
  const { t } = useI18n();
  return <IconButton variant="secondary" size="sm" name="refresh-cw" title={title || t("act.refresh")} tipSide={tipSide} onClick={onClick} disabled={disabled} style={style} />;
}

/* ---------- Badge / Status pill ---------- */
function Badge({ children, tone = "neutral", dot, size = "md" }) {
  const C = useC();
  const tones = {
    neutral: { bg: C.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(1,59,82,0.07)", fg: C.textMuted },
    info: { bg: C.infoBg, fg: C.info }, success: { bg: C.successBg, fg: C.success },
    warning: { bg: C.warningBg, fg: C.warningText }, danger: { bg: C.dangerBg, fg: C.danger },
    brand: { bg: C.brandBg, fg: C.ocean }, orange: { bg: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)", fg: C.orange },
  };
  const t = tones[tone] || tones.neutral;
  const pad = size === "sm" ? "1px 7px" : "2px 9px";
  return (
    <span style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, padding: pad, backgroundColor: t.bg,
      color: t.fg, fontSize: size === "sm" ? 10.5 : 11.5, fontWeight: 600, borderRadius: RADIUS.pill, lineHeight: 1.6, whiteSpace: "nowrap" }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: t.fg }} />}
      {children}
    </span>
  );
}
const STATUS_TONE = { active: "success", approved: "success", enabled: "success", verified: "success", running: "info", ready: "success", idle: "neutral",
  inactive: "neutral", draft: "neutral", archived: "neutral", disabled: "neutral",
  pending: "warning", trial: "info", info: "info", suspended: "danger", rejected: "danger", failed: "danger", error: "danger" };
function StatusBadge({ status }) {
  const tone = STATUS_TONE[String(status).toLowerCase()] || "neutral";
  return <Badge tone={tone} dot>{status}</Badge>;
}

/* ---------- Avatar ---------- */
function Avatar({ name, size = 32, src, bg }) {
  const C = useC();
  const palette = [C.ocean, C.blue, C.forest, C.orange, C.main];
  const idx = (name || "?").charCodeAt(0) % palette.length;
  const initials = (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: bg || palette[idx], flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.4, fontWeight: 700 }}>{initials}</span>
  );
}

/* ---------- Cards ---------- */
function Card({ children, pad = 20, style, hover }) {
  const C = useC();
  const [h, setH] = React.useState(false);
  return (
    <div onMouseEnter={() => hover && setH(true)} onMouseLeave={() => hover && setH(false)}
      style={{ ...FONT, backgroundColor: C.surface, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS.lg,
        padding: pad, boxShadow: h ? C.shadowMd : C.cardShadow, transition: "box-shadow 0.15s", ...style }}>{children}</div>
  );
}
function DetailCard({ title, subtitle, action, children, pad = 20, style, bodyStyle }) {
  const C = useC();
  return (
    <div style={{ ...FONT, backgroundColor: C.surface, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS.lg, boxShadow: C.cardShadow, ...style }}>
      {title && (
        <div style={{ padding: "13px 20px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: pad, ...bodyStyle }}>{children}</div>
    </div>
  );
}
function MetricCard({ label, value, delta, trend = "up", hint, icon, iconTone = "brand", onClick }) {
  const C = useC();
  const [hover, setHover] = React.useState(false);
  const trendColor = trend === "up" ? C.success : trend === "down" ? C.danger : C.textMuted;
  const tones = { brand: { bg: C.brandBg, fg: C.ocean }, orange: { bg: C.scheme === "dark" ? "rgba(240,116,61,0.16)" : "rgba(235,102,46,0.12)", fg: C.orange },
    blue: { bg: C.infoBg, fg: C.info }, forest: { bg: C.successBg, fg: C.success }, danger: { bg: C.dangerBg, fg: C.danger } };
  const it = tones[iconTone] || tones.brand;
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...FONT, backgroundColor: C.surface, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS.lg, padding: 18,
        cursor: onClick ? "pointer" : "default", boxShadow: hover && onClick ? C.shadowMd : C.cardShadow, transition: "box-shadow 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 12.5, color: C.textMuted, fontWeight: 500 }}>{label}</div>
        {icon && <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: it.bg, color: it.fg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={17} /></span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 8, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 12, color: trendColor, fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {delta} {hint && <span style={{ color: C.textMuted, fontWeight: 500 }}>{hint}</span>}
        </div>
      )}
    </div>
  );
}
function InfoList({ items, cols = "1fr 1.6fr" }) {
  const C = useC();
  return (
    <dl style={{ ...FONT, display: "grid", gridTemplateColumns: cols, rowGap: 13, columnGap: 16, margin: 0 }}>
      {items.map((i, idx) => (
        <React.Fragment key={idx}>
          <dt style={{ fontSize: 13, color: C.textMuted }}>{i.label}</dt>
          <dd style={{ fontSize: 13, color: C.text, fontWeight: 500, margin: 0 }}>{i.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/* ---------- Form controls ---------- */
function TextInput({ value, onChange, placeholder, iconLeft, iconRight, type = "text", status = "default", defaultValue, disabled, readOnly, maxLength, size = "md", onKeyDown, onFocus, onBlur, inputRef, style }) {
  const C = useC();
  const [focused, setFocused] = React.useState(false);
  const locked = disabled || readOnly;
  const border = status === "error" ? C.danger : status === "success" ? C.success : (focused && !readOnly) ? C.ocean : C.border;
  const ring = status === "error" ? C.errorRing : (focused && !readOnly) ? C.focusRing : "none";
  const h = size === "sm" ? 32 : 38;
  return (
    <div style={{ ...FONT, display: "flex", alignItems: "center", gap: 8, height: h, padding: "0 12px", backgroundColor: locked ? C.surfaceAlt : C.inputBg,
      borderRadius: RADIUS.md, border: `1px solid ${border}`, boxShadow: ring, transition: "border-color 0.15s, box-shadow 0.15s", opacity: disabled ? 0.6 : 1, ...style }}>
      {iconLeft && <Icon name={iconLeft} size={15} color={C.textMuted} />}
      <input ref={inputRef} type={type} value={value} defaultValue={defaultValue} placeholder={placeholder} disabled={disabled} readOnly={readOnly} maxLength={maxLength} onKeyDown={onKeyDown}
        onChange={onChange} onFocus={(e) => { setFocused(true); onFocus && onFocus(e); }} onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
        style={{ flex: 1, background: "transparent", outline: "none", border: "none", fontSize: 13.5, color: C.text, fontFamily: FONT.fontFamily, minWidth: 0 }} />
      {iconRight}
    </div>
  );
}
function Field({ label, required, helper, status, children, style }) {
  const C = useC();
  const hcolor = status === "error" ? C.danger : status === "success" ? C.success : C.textMuted;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && <label style={{ ...FONT, fontSize: 12.5, fontWeight: 600, color: C.text }}>{label}{required && <span style={{ color: C.danger }}> *</span>}</label>}
      {children}
      {helper && <span style={{ ...FONT, fontSize: 12, color: hcolor, display: "inline-flex", alignItems: "center", gap: 4 }}>
        {status === "error" && <Icon name="alert-circle" size={12} />}{status === "success" && <Icon name="check-circle-2" size={12} />}{helper}</span>}
    </div>
  );
}
function Select({ options, value, onChange, defaultValue, disabled, size = "md", style }) {
  const C = useC();
  const [focused, setFocused] = React.useState(false);
  const h = size === "sm" ? 32 : 38;
  return (
    <div style={{ position: "relative", height: h, backgroundColor: disabled ? C.surfaceAlt : C.inputBg, borderRadius: RADIUS.md,
      border: `1px solid ${focused ? C.ocean : C.border}`, boxShadow: focused ? C.focusRing : "none", opacity: disabled ? 0.6 : 1, ...style }}>
      <select value={value} defaultValue={defaultValue} onChange={onChange} disabled={disabled} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...FONT, width: "100%", height: "100%", padding: "0 34px 0 12px", background: "transparent", border: "none", outline: "none",
          appearance: "none", fontSize: size === "sm" ? 12.5 : 13.5, color: C.text, cursor: "pointer" }}>
        {options.map((o) => <option key={o.value} value={o.value} style={{ color: "#013B52" }}>{o.label}</option>)}
      </select>
      <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
        <Icon name="chevron-down" size={15} color={C.textMuted} /></span>
    </div>
  );
}
function Textarea({ placeholder, defaultValue, value, onChange, rows = 4, maxLength, style }) {
  const C = useC();
  const [focused, setFocused] = React.useState(false);
  return (
    <textarea placeholder={placeholder} defaultValue={defaultValue} value={value} onChange={onChange} rows={rows} maxLength={maxLength}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...FONT, padding: "10px 12px", backgroundColor: C.inputBg, borderRadius: RADIUS.md,
        border: `1px solid ${focused ? C.ocean : C.border}`, boxShadow: focused ? C.focusRing : "none",
        outline: "none", fontSize: 13.5, color: C.text, resize: "vertical", minHeight: 80, width: "100%", ...style }} />
  );
}
function Checkbox({ checked, onChange, label, disabled }) {
  const C = useC();
  return (
    <label style={{ ...FONT, display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, color: C.text, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <span onClick={() => !disabled && onChange && onChange(!checked)} style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${checked ? C.primary : C.border}`,
        backgroundColor: checked ? C.primary : C.inputBg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}>
        {checked && <Icon name="check" size={11} color="#fff" strokeWidth={3} />}</span>{label}
    </label>
  );
}
function Radio({ checked, onChange, label, disabled }) {
  const C = useC();
  return (
    <label style={{ ...FONT, display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, color: C.text, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <span onClick={() => !disabled && onChange && onChange()} style={{ width: 17, height: 17, borderRadius: "50%", border: `1.5px solid ${checked ? C.primary : C.border}`,
        backgroundColor: C.inputBg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {checked && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: C.primary }} />}</span>{label}
    </label>
  );
}
function Toggle({ checked, onChange, label, disabled }) {
  const C = useC();
  return (
    <label style={{ ...FONT, display: "inline-flex", gap: 10, alignItems: "center", fontSize: 13, color: C.text, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <span onClick={() => !disabled && onChange && onChange(!checked)} style={{ width: 38, height: 22, borderRadius: 999, backgroundColor: checked ? C.primary : (C.scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(1,59,82,0.2)"), position: "relative", transition: "background-color 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} /></span>{label}
    </label>
  );
}

/* ---------- DiamondMark (decorative 2x2 watermark on auth brand panels) ---------- */
function DiamondMark({ size = 22, gap = 3 }) {
  const cell = (color) => <span style={{ width: size, height: size, background: color, borderRadius: 5, transform: "rotate(45deg)", display: "block" }} />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(2, ${size}px)`, gap }}>
      {cell("#EB662E")}{cell("#005C96")}{cell("#0F828A")}{cell("#11713B")}
    </div>
  );
}

/* Official AlamTri geo lockup. Color wordmark on light surfaces; reverse on dark; diamond-only for rails/favicons. */
function BrandLockup({ height = 28, onDark = false, markOnly = false, alt = "AlamTri geo", style }) {
  const src = markOnly
    ? "/assets/alam-tri-ico.png"
    : (onDark ? "/assets/alamtri-logo-on-dark.png" : "/assets/alamtri-logo-full.png");
  return (
    <img
      src={src}
      alt={alt}
      style={{ height, width: markOnly ? height : "auto", display: "block", objectFit: "contain", ...style }}
    />
  );
}

export { Icon, Flag, Button, IconButton, TableRefreshButton, Badge, StatusBadge, Avatar, Card, DetailCard, MetricCard, InfoList, TextInput, Field, Select, Textarea, Checkbox, Radio, Toggle, DiamondMark, BrandLockup };
Object.assign(window, { Icon, Flag, Button, IconButton, TableRefreshButton, Badge, StatusBadge, Avatar, Card, DetailCard, MetricCard, InfoList, TextInput, Field, Select, Textarea, Checkbox, Radio, Toggle, DiamondMark, BrandLockup });
