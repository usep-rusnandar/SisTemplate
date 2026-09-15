/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { Icon, Button, Avatar, TextInput, Field, DiamondMark, BrandLockup } from "../../../shared/legacy/Primitives.jsx";
import { fmtAppDate, Spinner } from "../../../shared/legacy/PrimitivesX.jsx";
import { useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin — session lock.
   Driven by Settings → Security → "Session timeout control":
     sessionEnabled  → master switch for idle monitoring
     timeout         → idle seconds before the session locks
     countdown       → seconds before lock that a warning prompt appears
     lockScreen      → on timeout, show the lock screen (else sign out)
   Manual lock is always available from the user menu. */

/* Watches user activity and fires onWarn / onClearWarn / onTimeout. */
function useIdleMonitor({ enabled, timeoutSec, countdownSec, locked, onWarn, onClearWarn, onTimeout }) {
  const lastRef = React.useRef(Date.now());
  React.useEffect(() => {
    const bump = () => { lastRef.current = Date.now(); };
    const evs = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  React.useEffect(() => {
    if (!enabled || locked) return;
    lastRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - lastRef.current) / 1000;
      if (elapsed >= timeoutSec) onTimeout();
      else if (elapsed >= timeoutSec - countdownSec) onWarn(Math.max(1, Math.ceil(timeoutSec - elapsed)));
      else onClearWarn();
    }, 500);
    return () => clearInterval(id);
  }, [enabled, locked, timeoutSec, countdownSec, onWarn, onClearWarn, onTimeout]);
}

/* Countdown prompt shown shortly before an idle session locks. */
function LockWarning({ seconds, onStay, onLockNow }) {
  const C = useC();
  return (
    <div style={{ ...FONT, position: "fixed", inset: 0, zIndex: 9000, background: "rgba(1,59,82,0.48)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 540, maxWidth: "100%", backgroundColor: C.surface, borderRadius: RADIUS.xl, border: `1px solid ${C.cardBorder}`, boxShadow: "0 28px 90px rgba(1,59,82,0.30)", padding: 34, textAlign: "center" }}>
        <span style={{ width: 68, height: 68, borderRadius: RADIUS.pill, backgroundColor: C.warningBg, color: C.warningText, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="clock" size={31} /></span>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: 0 }}>Session will lock shortly</div>
        <div style={{ fontSize: 82, fontWeight: 800, color: C.orange, lineHeight: 0.95, marginTop: 18, fontVariantNumeric: "tabular-nums" }}>{seconds}</div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textSubtle, marginTop: 6 }}>seconds remaining</div>
        <div style={{ fontSize: 14, color: C.textMuted, margin: "18px auto 0", lineHeight: 1.55, maxWidth: 410 }}>
          No activity detected. This internal session will lock automatically to protect platform data.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={onLockNow}>Lock now</Button>
          <Button style={{ flex: 1 }} iconLeft="check" onClick={onStay}>Continue session</Button>
        </div>
      </div>
    </div>
  );
}

/* Full-screen lock requiring the user's password to resume the session. */
function LockScreen({ user, onUnlock, onSignOut, ssoEnabled, ssoHomeUrl }) {
  const C = useC();
  const tt = useTT();
  const [pwd, setPwd] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [now, setNow] = React.useState(new Date());
  const [busy, setBusy] = React.useState(false);
  const name = (user && user.name) || "";
  const email = (user && user.email) || "";
  const hasLocalPassword = !!(user && user.hasLocalPassword);
  React.useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const submit = (e) => {
    if (e) e.preventDefault();
    // With SSO the identity provider owns credentials — unlocking just resumes the audited session,
    // no local password to verify (mirrors the no-local-password case).
    if (ssoEnabled || !hasLocalPassword) { setErr(""); setPwd(""); onUnlock(); return; }
    if (!pwd.trim()) { setErr(tt("Enter your password to continue", "Masukkan kata sandi untuk melanjutkan")); return; }
    const authApi = typeof window !== "undefined" ? window.__internalAuth : null;
    if (!authApi || typeof authApi.verifyPassword !== "function") {
      setErr(tt("Could not verify the password. Try again.", "Tidak dapat memverifikasi kata sandi. Coba lagi."));
      return;
    }
    setErr(""); setBusy(true);
    Promise.resolve(authApi.verifyPassword(pwd))
      .then(() => { setPwd(""); onUnlock(); })
      .catch((error) => {
        const code = error && error.code;
        setErr(code === "account_locked"
          ? tt("This account is locked. Sign out or ask an administrator to reset the password.", "Akun ini terkunci. Keluar atau minta administrator mereset kata sandi.")
          : tt("Password is incorrect.", "Kata sandi salah."));
      })
      .finally(() => setBusy(false));
  };
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  const date = fmtAppDate(now);
  return (
    <div style={{ ...FONT, position: "fixed", inset: 0, zIndex: 9500, minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 1fr", backgroundColor: C.bg }} className="ag-auth">
      <div className="ag-auth-brand ag-lock-aside" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(150deg, #013B52 0%, #0A5560 45%, #0F828A 100%)", color: "#fff", padding: "56px 60px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ position: "absolute", top: -60, right: -40, opacity: 0.12, transform: "scale(6) rotate(8deg)", transformOrigin: "top right" }}><DiamondMark size={22} /></div>
        <div style={{ position: "absolute", bottom: 40, left: -30, opacity: 0.08, transform: "scale(4)" }}><DiamondMark size={22} /></div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center" }}>
          <BrandLockup height={42} onDark />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 480 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8FE3E8" }}>{tt("Session secured", "Sesi aman")}</div>
          <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: 0, lineHeight: 1, marginTop: 18, fontVariantNumeric: "tabular-nums" }}>{time}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.78)", marginTop: 10 }}>{date}</div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: 0, lineHeight: 1.16, margin: "34px 0 0", color: "#fff" }}>{tt("Your internal workspace is locked.", "Ruang kerja internal Anda terkunci.")}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", marginTop: 14 }}>{tt("Unlock to continue the internal workspace with the same audited session.", "Buka kunci untuk melanjutkan ruang kerja internal dengan sesi audit yang sama.")}</p>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>{tt("Staff-only internal access · protected session", "Akses staf internal · sesi terlindungi")}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
        <form className="ag-lock-card" onSubmit={submit} style={{ width: 420, maxWidth: "100%", backgroundColor: C.surface, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS.xl, boxShadow: C.shadowLg, padding: 30, textAlign: "center" }}>
          <span style={{ width: 54, height: 54, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icon name="shield-check" size={26} /></span>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
            <Avatar name={name} src={user && user.avatar} size={68} />
            <span style={{ position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: RADIUS.pill, background: "#013B52", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", border: `3px solid ${C.surface}` }}><Icon name="lock" size={13} /></span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: 0 }}>{name}</div>
          {email ? <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div> : null}
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: email ? 8 : 6, lineHeight: 1.5 }}>
            {ssoEnabled
              ? tt("Click “Unlock session” to return to your workspace, or go back to SIS Warrior below.", "Klik “Buka kunci sesi” untuk kembali ke aplikasi, atau kembali ke SIS Warrior di bawah.")
              : hasLocalPassword
                ? tt("Enter your password to resume this session.", "Masukkan kata sandi untuk melanjutkan sesi ini.")
                : tt("This account has no local password. Continue to resume the session.", "Akun ini belum punya kata sandi lokal. Lanjut untuk membuka sesi.")}
          </div>

          {hasLocalPassword && !ssoEnabled && (
          <div style={{ marginTop: 24, textAlign: "left" }}>
            <Field label={tt("Password", "Kata sandi")} status={err ? "error" : "default"} helper={err || null}>
              <TextInput type={show ? "text" : "password"} iconLeft="lock" placeholder={tt("Enter your password", "Masukkan kata sandi")} value={pwd} disabled={busy}
                status={err ? "error" : "default"}
                onChange={(e) => { setPwd(e.target.value); if (err) setErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") submit(e); }}
                iconRight={<button type="button" onClick={() => setShow((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 0 }}><Icon name={show ? "eye-off" : "eye"} size={16} /></button>} />
            </Field>
          </div>
          )}

          <div style={{ marginTop: 18 }}>
            <Button type="submit" iconLeft={busy ? undefined : "unlock"} disabled={busy} style={{ width: "100%", justifyContent: "center" }} onClick={submit}>{busy ? <Spinner size={16} color="#fff" /> : tt("Unlock session", "Buka kunci sesi")}</Button>
          </div>
          {ssoEnabled
            ? <button type="button" onClick={() => { if (ssoHomeUrl) window.location.assign(ssoHomeUrl); else onSignOut(); }} style={{ ...FONT, marginTop: 18, background: "transparent", border: "none", color: C.textMuted, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="external-link" size={14} />{tt("Back to SIS Warrior", "Kembali ke SIS Warrior")}
              </button>
            : <button type="button" onClick={onSignOut} style={{ ...FONT, marginTop: 18, background: "transparent", border: "none", color: C.textMuted, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="log-out" size={14} />{tt("Not you? Sign out", "Bukan Anda? Keluar")}
              </button>}
        </form>
      </div>
    </div>
  );
}

Object.assign(window, { useIdleMonitor, LockWarning, LockScreen });
export { useIdleMonitor, LockWarning, LockScreen };
