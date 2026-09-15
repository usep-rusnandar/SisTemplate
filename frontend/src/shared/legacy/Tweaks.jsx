import React from "react";
import { useTheme } from "./Tokens.jsx";
import { TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle, useTweaks } from "./tweaks-panel.jsx";

/* Alamtri Geo Admin — Tweaks engine. Three expressive controls that reshape the whole feel:
   1) Brand accent   — recolors interactive identity (links, active, focus, primary, charts, badges)
   2) Sidebar style  — Light / Dark / Brand navigation rail
   3) Surface depth  — Flat / Soft / Raised card elevation
   Values flow into the theme palette via applyTweaks(), so every component (which reads useC())
   re-skins at once. ThemeProvider consumes TweakCtx; the panel writes to it. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#0F828A",
  "sidebar": "Light",
  "depth": "Flat"
}/*EDITMODE-END*/;

const ACCENTS = {
  "#0F828A": { key: "ocean",  L: { accent: "#0F828A", primary: "#013B52", primaryHover: "#022b3d" }, D: { accent: "#3FB6BE", primary: "#0F828A", primaryHover: "#11939c" } },
  "#4F46E5": { key: "indigo", L: { accent: "#4F46E5", primary: "#312E81", primaryHover: "#3730A3" }, D: { accent: "#818CF8", primary: "#4F46E5", primaryHover: "#4338CA" } },
  "#157347": { key: "forest", L: { accent: "#157347", primary: "#0B5132", primaryHover: "#0a4429" }, D: { accent: "#4FB477", primary: "#157347", primaryHover: "#0f5d39" } },
  "#7C3AED": { key: "violet", L: { accent: "#7C3AED", primary: "#5B21B6", primaryHover: "#4c1d95" }, D: { accent: "#A78BFA", primary: "#7C3AED", primaryHover: "#6d28d9" } },
  "#EA580C": { key: "sunset", L: { accent: "#EA580C", primary: "#C2410C", primaryHover: "#9a3412" }, D: { accent: "#FB923C", primary: "#EA580C", primaryHover: "#c2410c" } },
};
const ACCENT_OPTIONS = Object.keys(ACCENTS);

function _hexA(hex, a) {
  const h = hex.replace("#", ""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function applyTweaks(base, theme, twIn) {
  const tw = { ...TWEAK_DEFAULTS, ...(twIn || {}) };
  const dark = theme === "dark";
  const C = { ...base };
  const acc = ACCENTS[tw.accent] || ACCENTS["#0F828A"];
  const A = dark ? acc.D : acc.L;
  const brightAccent = acc.D.accent;

  // ---- Accent ----
  C.accent = A.accent; C.ocean = A.accent; C.primary = A.primary; C.primaryHover = A.primaryHover;
  C.brandBg = _hexA(A.accent, dark ? 0.18 : 0.12);
  C.active = _hexA(A.accent, dark ? 0.16 : 0.10);
  C.focusRing = `0 0 0 3px ${_hexA(A.accent, dark ? 0.32 : 0.22)}`;

  // ---- Sidebar ----
  let nav;
  if (tw.sidebar === "Dark") {
    nav = { navBg: "#0A2230", navBgImage: "none", navText: "#E6EDF0", navTextMuted: "#9FB2BC", navTextSubtle: "#647C87",
      navHover: "rgba(255,255,255,0.06)", navActiveBg: _hexA(brightAccent, 0.18), navAccent: brightAccent,
      navBorder: "rgba(255,255,255,0.10)", navBorderSoft: "rgba(255,255,255,0.06)", navLogoChip: "#FFFFFF" };
  } else if (tw.sidebar === "Brand") {
    nav = { navBg: "#012c3e", navBgImage: "linear-gradient(180deg, #013B52 0%, #02212e 100%)", navText: "#EAF3F4", navTextMuted: "rgba(234,243,244,0.62)", navTextSubtle: "rgba(234,243,244,0.40)",
      navHover: "rgba(255,255,255,0.08)", navActiveBg: "rgba(255,255,255,0.14)", navAccent: brightAccent,
      navBorder: "rgba(255,255,255,0.12)", navBorderSoft: "rgba(255,255,255,0.07)", navLogoChip: "#FFFFFF" };
  } else { // Light = match theme
    nav = dark
      ? { navBg: base.nav, navBgImage: "none", navText: base.text, navTextMuted: base.textMuted, navTextSubtle: base.textSubtle,
          navHover: base.hover, navActiveBg: C.active, navAccent: brightAccent, navBorder: base.border, navBorderSoft: base.borderSoft, navLogoChip: base.logoChip }
      : { navBg: "#FFFFFF", navBgImage: "none", navText: base.text, navTextMuted: base.textMuted, navTextSubtle: base.textSubtle,
          navHover: base.hover, navActiveBg: C.active, navAccent: A.accent, navBorder: base.border, navBorderSoft: base.borderSoft, navLogoChip: "transparent" };
  }
  Object.assign(C, nav);

  // ---- Surface depth ----
  if (tw.depth === "Soft") {
    C.cardShadow = dark ? "0 2px 10px rgba(0,0,0,0.42)" : "0 1px 3px rgba(1,59,82,0.09)";
    C.cardBorder = base.border;
  } else if (tw.depth === "Raised") {
    C.cardShadow = dark ? "0 16px 34px rgba(0,0,0,0.58)" : "0 12px 30px rgba(1,59,82,0.11)";
    C.cardBorder = dark ? "rgba(255,255,255,0.05)" : "rgba(1,59,82,0.05)";
  } else { // Flat
    C.cardShadow = "none";
    C.cardBorder = base.border;
  }
  return C;
}

const TweakCtx = React.createContext({ tw: TWEAK_DEFAULTS, setTweak: () => {} });
function useTw() { return React.useContext(TweakCtx); }

function TweaksRoot({ children }) {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return <TweakCtx.Provider value={{ tw, setTweak }}>{children}</TweakCtx.Provider>;
}

function AppTweaksPanel() {
  const { tw, setTweak } = useTw();
  const { theme, setTheme } = useTheme();
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Brand accent" />
      <TweakColor label="Accent" value={tw.accent} options={ACCENT_OPTIONS} onChange={(v) => setTweak("accent", v)} />
      <TweakSection label="Navigation" />
      <TweakRadio label="Sidebar" value={tw.sidebar} options={["Light", "Dark", "Brand"]} onChange={(v) => setTweak("sidebar", v)} />
      <TweakSection label="Surfaces" />
      <TweakRadio label="Depth" value={tw.depth} options={["Flat", "Soft", "Raised"]} onChange={(v) => setTweak("depth", v)} />
      <TweakSection label="Theme" />
      <TweakToggle label="Dark mode" value={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
    </TweaksPanel>
  );
}

export { TWEAK_DEFAULTS, ACCENTS, ACCENT_OPTIONS, applyTweaks, TweakCtx, useTw, TweaksRoot, AppTweaksPanel };
Object.assign(window, { TWEAK_DEFAULTS, ACCENTS, ACCENT_OPTIONS, applyTweaks, TweakCtx, useTw, TweaksRoot, AppTweaksPanel });
