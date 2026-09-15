import React from "react";
import { TweakCtx, applyTweaks } from "./Tweaks.jsx";

/* Alamtri Geo Admin — theme tokens + ThemeProvider.
   Two cohesive palettes (light = the Alamtri Geo default; dark = teal-navy derived).
   Components read the active palette via useC(). Same key names across both themes. */

const RADIUS = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 };
const FONT = { fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" };
const GRAD = {
  primary: "linear-gradient(135deg, #013B52 0%, #0F828A 100%)",
  sunset:  "linear-gradient(135deg, #EB662E 0%, #E3E37A 100%)",
  meadow:  "linear-gradient(135deg, #11713B 0%, #ABD096 100%)",
  horizon: "linear-gradient(135deg, #005C96 0%, #0F828A 50%, #ABD096 100%)",
};

/* ---------- LIGHT (Alamtri Geo native) ---------- */
const LIGHT = {
  scheme: "light",
  main: "#013B52", primary: "#013B52", primaryHover: "#022b3d", onPrimary: "#FFFFFF",
  ocean: "#0F828A", accent: "#0F828A",
  orange: "#EB662E", yellow: "#E3E37A", blue: "#005C96", sage: "#ABD096", forest: "#11713B",

  bg: "#F7F8F9", surface: "#FFFFFF", surfaceAlt: "#F7F8F9", surfaceInset: "#FBFCFC",
  nav: "#FFFFFF", navHeader: "#FFFFFF",
  border: "rgba(1,59,82,0.12)", borderSoft: "rgba(1,59,82,0.06)",
  hover: "rgba(1,59,82,0.04)", active: "rgba(15,130,138,0.10)",

  text: "#013B52", textMuted: "#5C6B73", textSubtle: "#8A969D",

  danger: "#C5341A", dangerBg: "rgba(197,52,26,0.08)",
  success: "#11713B", successBg: "rgba(17,113,59,0.10)",
  warning: "#8A7A12", warningBg: "rgba(227,227,122,0.45)", warningText: "#6B6B1F",
  info: "#005C96", infoBg: "rgba(0,92,150,0.08)",
  brandBg: "rgba(15,130,138,0.12)",

  inputBg: "#FFFFFF",
  focusRing: "0 0 0 3px rgba(15,130,138,0.22)",
  errorRing: "0 0 0 3px rgba(197,52,26,0.15)",
  shadowSm: "0 1px 2px rgba(1,59,82,0.06)",
  shadowMd: "0 4px 12px rgba(1,59,82,0.08)",
  shadowLg: "0 12px 32px rgba(1,59,82,0.12)",
  shadowOverlay: "0 8px 24px rgba(1,59,82,0.14)",
  scrollThumb: "rgba(1,59,82,0.18)",
  logoChip: "transparent",
  cardShadow: "none", cardBorder: "rgba(1,59,82,0.12)",
  navBg: "#FFFFFF", navBgImage: "none", navText: "#013B52", navTextMuted: "#5C6B73", navTextSubtle: "#8A969D",
  navHover: "rgba(1,59,82,0.04)", navActiveBg: "rgba(15,130,138,0.10)", navAccent: "#0F828A",
  navBorder: "rgba(1,59,82,0.12)", navBorderSoft: "rgba(1,59,82,0.06)", navLogoChip: "transparent",
};

/* ---------- DARK (teal-navy, derived from brand) ---------- */
const DARK = {
  scheme: "dark",
  main: "#3FB6BE", primary: "#0F828A", primaryHover: "#11939c", onPrimary: "#FFFFFF",
  ocean: "#3FB6BE", accent: "#3FB6BE",
  orange: "#F0743D", yellow: "#E3E37A", blue: "#4AA3D6", sage: "#ABD096", forest: "#4FB477",

  bg: "#071A24", surface: "#0E2A38", surfaceAlt: "#0A2230", surfaceInset: "#0C2632",
  nav: "#0A2230", navHeader: "#0A2230",
  border: "rgba(255,255,255,0.10)", borderSoft: "rgba(255,255,255,0.055)",
  hover: "rgba(255,255,255,0.05)", active: "rgba(63,182,190,0.16)",

  text: "#E6EDF0", textMuted: "#9FB2BC", textSubtle: "#647C87",

  danger: "#EC7059", dangerBg: "rgba(232,101,78,0.16)",
  success: "#4FB477", successBg: "rgba(79,180,119,0.16)",
  warning: "#D8D87A", warningBg: "rgba(227,227,122,0.16)", warningText: "#D8D87A",
  info: "#4AA3D6", infoBg: "rgba(74,163,214,0.16)",
  brandBg: "rgba(63,182,190,0.16)",

  inputBg: "#0A2230",
  focusRing: "0 0 0 3px rgba(63,182,190,0.30)",
  errorRing: "0 0 0 3px rgba(236,112,89,0.25)",
  shadowSm: "0 1px 2px rgba(0,0,0,0.30)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.40)",
  shadowLg: "0 14px 34px rgba(0,0,0,0.55)",
  shadowOverlay: "0 10px 28px rgba(0,0,0,0.55)",
  scrollThumb: "rgba(255,255,255,0.18)",
  logoChip: "#FFFFFF",
  cardShadow: "none", cardBorder: "rgba(255,255,255,0.10)",
  navBg: "#0A2230", navBgImage: "none", navText: "#E6EDF0", navTextMuted: "#9FB2BC", navTextSubtle: "#647C87",
  navHover: "rgba(255,255,255,0.05)", navActiveBg: "rgba(63,182,190,0.16)", navAccent: "#3FB6BE",
  navBorder: "rgba(255,255,255,0.10)", navBorderSoft: "rgba(255,255,255,0.055)", navLogoChip: "#FFFFFF",
};

const ThemeCtx = React.createContext({ C: LIGHT, theme: "light", setTheme: () => {} });

function ThemeProvider({ children }) {
  const [theme, setThemeState] = React.useState(() => window.__procurementStorage.getItem("ag_theme") || "light");
  const setTheme = React.useCallback((t) => {
    setThemeState(t);
    try { window.__procurementStorage.setItem("ag_theme", t); } catch (e) {}
  }, []);
  const C = theme === "dark" ? DARK : LIGHT;
  const ctx = React.useContext(TweakCtx);
  const merged = applyTweaks(C, theme, ctx && ctx.tw);
  React.useEffect(() => {
    document.body.style.backgroundColor = merged.bg;
    document.body.style.color = merged.text;
    document.documentElement.style.setProperty("--scroll-thumb", merged.scrollThumb);
    document.documentElement.style.setProperty("--scroll-track", merged.bg);
  }, [theme, merged.bg]);
  return <ThemeCtx.Provider value={{ C: merged, theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

function useTheme() { return React.useContext(ThemeCtx); }
function useC() { return React.useContext(ThemeCtx).C; }

export { LIGHT, DARK, RADIUS, FONT, GRAD, ThemeProvider, useTheme, useC };
Object.assign(window, { LIGHT, DARK, RADIUS, FONT, GRAD, ThemeProvider, useTheme, useC });
