import React from "react";
import { useC } from "./Tokens.jsx";
import { useTT } from "./i18n.jsx";

/* Alamtri Geo — screen-level error boundary.

   Without one, a single component that throws unmounts the WHOLE React tree: the user gets a blank
   white page with no sidebar, no way back, and no idea what happened (that is exactly what the
   Proposal Tracker matrix does today when its master data has not hydrated). A boundary contains the
   damage to the page body — the shell, the menu and navigation keep working.

   Error boundaries have to be class components; there is no hook equivalent. */

class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the detail in the console for whoever is debugging; the UI stays calm.
    console.error("Screen crashed:", error, info && info.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Navigating away is the natural "try something else" — clear the error so the next screen renders.
    if (this.state.error && prevProps.routeKey !== this.props.routeKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ScreenErrorNotice error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}

/* Rendered in place of the crashed page. Deliberately plain: it must not depend on anything that
   could itself be broken, so it reads theme tokens defensively and uses no data. */
function ScreenErrorNotice({ error, onRetry }) {
  const C = useC() || {};
  const tt = useTT();
  const text = C.text || "#0b2b38";
  const muted = C.textMuted || "#5b7180";
  const surface = C.surface || "#fff";
  const border = C.border || "#dfe7ec";
  const danger = C.danger || "#c0392b";

  return (
    <div role="alert" style={{
      backgroundColor: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${danger}`,
      borderRadius: 14, padding: "26px 28px", maxWidth: 720, margin: "24px auto",
    }}>
      <div style={{ fontSize: 15, fontWeight: 750, color: text }}>
        {tt("This page could not be displayed", "Halaman ini tidak dapat ditampilkan")}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: muted, lineHeight: 1.6 }}>
        {tt(
          "Something in this screen failed while rendering. The rest of the application still works — use the menu to continue, or try again.",
          "Ada bagian layar ini yang gagal ditampilkan. Bagian lain aplikasi tetap berfungsi — silakan lanjut lewat menu, atau coba lagi.",
        )}
      </div>
      <pre style={{
        marginTop: 14, marginBottom: 16, padding: "10px 12px", borderRadius: 8, backgroundColor: C.surfaceAlt || "#f4f7f9",
        color: muted, fontSize: 11.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "auto",
      }}>{String((error && error.message) || error)}</pre>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onRetry} style={{
          border: `1px solid ${border}`, backgroundColor: surface, color: text, borderRadius: 8,
          padding: "8px 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", font: "inherit",
        }}>{tt("Try again", "Coba lagi")}</button>
        <button type="button" onClick={() => window.location.reload()} style={{
          border: `1px solid ${border}`, backgroundColor: surface, color: muted, borderRadius: 8,
          padding: "8px 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", font: "inherit",
        }}>{tt("Reload", "Muat ulang")}</button>
      </div>
    </div>
  );
}

export { ScreenErrorBoundary, ScreenErrorNotice };
Object.assign(window, { ScreenErrorBoundary, ScreenErrorNotice });
