import React from "react";
import { useC, useTheme, FONT, RADIUS, ThemeProvider } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT, LANGS, I18nProvider } from "../../../shared/legacy/i18n.jsx";
import { Icon, IconButton, Flag, Button, DiamondMark, BrandLockup, Field, TextInput, Checkbox, Avatar } from "../../../shared/legacy/Primitives.jsx";
import { Menu, MenuItem, MenuLabel, MenuDivider, Tooltip, Spinner, Alert, Modal, ToastProvider, useToast, fmtAppDate } from "../../../shared/legacy/PrimitivesX.jsx";
import { PasswordField } from "../../../platform/account/legacy/AccountModals.jsx";
import {
  VwPwdValid, VwApiPasswordPolicy, VwApiVendorMe, VwApiVendorLogin, VwApiVendorLoginOtp,
  VwApiVendorLogout, VwApiRequestPasswordReset, VwApiConfirmPasswordReset, VwApiChangePassword, VwApiVerifyPassword,
  VW_DEFAULT_PWD_POLICY,
} from "./VendorOnboardingData.jsx";
import { VendorRegister, VwPasswordRuleList } from "./VendorRegister.jsx";
import { VendorWorkspaceProfile, VwPdfDocumentViewer } from "./VendorWorkspaceScreens.jsx";

/* Alamtri Geo — EXTERNAL bundle root (vendor.html).
   This is the vendor-facing portal: its own login (email + password), the
   invite-only registration flow, and the vendor profile. It deliberately ships
   NONE of the internal chrome (no sidebar, no impersonate, no Super Admin) and
   none of the internal data — only the shared design system + Vendor Workspace. */

/* Theme + language switchers shown on every auth screen (login, register, forgot/reset, OTP).
   Mirrors the post-login VwTopBar controls so the choice is available before signing in. */
function VwAuthControls() {
  const C = useC();
  const tt = useTT();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useI18n();
  const curLang = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <IconButton name={theme === "dark" ? "moon" : "sun"} variant="secondary" title={tt("Toggle theme", "Ganti tema")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
      <Menu align="right" width={190} trigger={
        <Tooltip label={tt("Language", "Bahasa")} side="bottom">
        <button type="button" style={{ ...FONT, display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, width: 44, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer" }}>
          <Flag code={curLang.code} size={22} />
        </button>
        </Tooltip>}>
        <MenuLabel>{tt("Language", "Bahasa")}</MenuLabel>
        {LANGS.map((l) => (
          <MenuItem key={l.code} label={<span style={{ display: "inline-flex", gap: 9, alignItems: "center" }}><Flag code={l.code} size={18} />{l.label}</span>}
            active={lang === l.code} onClick={() => setLang(l.code)} trailing={lang === l.code ? <Icon name="check" size={14} color={C.ocean} /> : null} />
        ))}
      </Menu>
    </div>
  );
}

/* ---- vendor-flavoured auth shell (independent of the internal AuthShell) ---- */
function VwAuthShell({ children }) {
  const C = useC();
  return (
    <div style={{ ...FONT, minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 1fr", backgroundColor: C.bg }} className="ag-auth">
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(150deg, #013B52 0%, #0A5560 45%, #0F828A 100%)", color: "#fff", padding: "56px 60px", display: "flex", flexDirection: "column", justifyContent: "space-between" }} className="ag-auth-brand">
        <div style={{ position: "absolute", top: -60, right: -40, opacity: 0.12, transform: "scale(6) rotate(8deg)", transformOrigin: "top right" }}><DiamondMark size={22} /></div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center" }}>
          <BrandLockup height={42} onDark />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 460 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8FE3E8" }}>Vendor Workspace</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.14, margin: "16px 0 0", color: "#fff" }}>Your gateway to working with Alamtri.</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", marginTop: 16 }}>Manage your company profile, documents, and registration — securely, in one place.</p>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>© 2026 Saptaindra · Vendor Workspace · All rights reserved</div>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
        <div style={{ position: "absolute", top: 18, right: 18, zIndex: 2 }}><VwAuthControls /></div>
        <div style={{ width: "100%", maxWidth: 392 }}>{children}</div>
      </div>
    </div>
  );
}

/* Shared fallback for the transport-level failures every auth screen can hit (rate-limit, server down,
   offline). Returns null when the status isn't one of these, so the caller can apply its own default. */
function VwAuthCommonError(error, tt) {
  const status = error && error.status;
  if (status === 429) {
    return tt("Too many requests. Please wait a moment and try again.",
      "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.");
  }
  if (typeof status === "number" && status >= 500) {
    return tt("The server is having a problem. Please try again shortly.",
      "Server sedang bermasalah. Silakan coba lagi beberapa saat.");
  }
  if (status == null) {
    return tt("Cannot reach the server. Check your internet connection and try again.",
      "Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.");
  }
  return null;
}

/* Turn a raw sign-in error into a clear, human-friendly, bilingual message. The /login endpoint replies
   401 with a machine `code` in the body (invalid_credentials / account_locked / email_not_confirmed); we
   key off that first, then fall back to HTTP status for anything else (server error, offline). */
function VwSignInErrorMessage(error, tt) {
  const code = error && error.payload && error.payload.code;
  const status = error && error.status;
  if (code === "account_locked" || status === 423) {
    return tt("Your account is temporarily locked after too many failed attempts. Please try again later or reset your password.",
      "Akun Anda terkunci sementara karena terlalu banyak percobaan gagal. Silakan coba lagi nanti atau atur ulang kata sandi.");
  }
  if (code === "email_not_confirmed") {
    return tt("Your account hasn't been verified yet. Please check your email for the verification link, or contact the administrator.",
      "Akun Anda belum diverifikasi. Silakan cek email Anda untuk tautan verifikasi, atau hubungi administrator.");
  }
  if (code === "not_workspace_pic") {
    return tt("This account cannot sign in to Vendor Workspace. Ask your administrator to set you as PIC Vendor.",
      "Akun ini tidak dapat masuk ke Vendor Workspace. Minta administrator men-set Anda sebagai PIC Vendor.");
  }
  if (code === "invalid_credentials" || status === 401 || status === 400) {
    return tt("Incorrect email or password. Please check and try again.",
      "Email atau kata sandi salah. Silakan periksa kembali.");
  }
  if (status === 403) {
    return tt("This account is not active yet. Please contact the administrator.",
      "Akun ini belum aktif. Silakan hubungi administrator.");
  }
  return VwAuthCommonError(error, tt) || tt("Sign in failed. Please try again.", "Gagal masuk. Silakan coba lagi.");
}

/* Friendly message for the "request a reset" step. That endpoint intentionally always succeeds (anti
   account-enumeration), so the only real errors here are transport-level. */
function VwResetRequestErrorMessage(error, tt) {
  return VwAuthCommonError(error, tt)
    || tt("Unable to send the reset instruction. Please try again.",
      "Tidak dapat mengirim instruksi reset. Silakan coba lagi.");
}

/* Friendly message for the "confirm new password" step. The /password-reset/confirm endpoint replies 400
   with a machine `code`: invalid_reset_request / reset_token_invalid (bad or expired link) vs
   password_reset_failed (new password rejected by the server-side policy). */
function VwResetConfirmErrorMessage(error, tt) {
  const code = error && error.payload && error.payload.code;
  if (code === "invalid_reset_request" || code === "reset_token_invalid") {
    return tt("This reset link is invalid or has expired. Please request a new reset email.",
      "Tautan reset ini tidak valid atau sudah kedaluwarsa. Silakan minta email reset baru.");
  }
  if (code === "password_reset_failed") {
    return tt("Your new password doesn't meet the security requirements. Please choose a stronger password.",
      "Sandi baru Anda belum memenuhi ketentuan keamanan. Silakan pilih sandi yang lebih kuat.");
  }
  return VwAuthCommonError(error, tt) || tt("Password reset failed. Please try again.",
    "Reset sandi gagal. Silakan coba lagi.");
}

function VendorLogin({ onAuthed, onRegister, onForgot }) {
  const C = useC();
  const tt = useTT();
  const [email, setEmail] = React.useState("");
  const [pwd, setPwd] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const submit = (e) => {
    e && e.preventDefault();
    if (!email.trim()) { setErr(tt("Enter your email", "Masukkan email Anda")); return; }
    if (!pwd) { setErr(tt("Enter your password", "Masukkan kata sandi Anda")); return; }
    setErr(""); setLoading(true);
    Promise.resolve(onAuthed(email, pwd))
      .catch((error) => { setErr(VwSignInErrorMessage(error, tt)); })
      .finally(() => setLoading(false));
  };
  return (
    <VwAuthShell>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Vendor sign in", "Masuk vendor")}</h2>
        <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6 }}>{tt("Sign in to manage your vendor profile and documents.", "Masuk untuk mengelola profil dan dokumen vendor Anda.")}</p>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Email", "Email")} status={err ? "error" : "default"} helper={err || null}>
          <TextInput iconLeft="mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" status={err ? "error" : "default"} />
        </Field>
        <Field label={tt("Password", "Kata sandi")}>
          <TextInput iconLeft="lock" type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={tt("Enter your password", "Masukkan kata sandi")}
            iconRight={<button type="button" onClick={() => setShow((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 0 }}><Icon name={show ? "eye-off" : "eye"} size={16} /></button>} />
        </Field>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Checkbox checked={remember} onChange={setRemember} label={tt("Remember me", "Ingat saya")} />
          <button type="button" onClick={() => onForgot && onForgot(email)}
            style={{ ...FONT, border: "none", background: "transparent", padding: 0, fontSize: 12.5, fontWeight: 700, color: C.ocean, cursor: "pointer" }}>{tt("Forgot password?", "Lupa sandi?")}</button>
        </div>
        <Button type="submit" size="lg" fullWidth disabled={loading} iconRight={loading ? undefined : "arrow-right"}>
          {loading ? <Spinner size={16} color="#fff" /> : tt("Sign in", "Masuk")}
        </Button>
      </form>

      <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, backgroundColor: C.surfaceInset }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="ticket" size={17} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{tt("New vendor with an invitation?", "Vendor baru dengan undangan?")}</div>
            <div style={{ fontSize: 11.5, color: C.textMuted }}>{tt("Register using your invitation code.", "Daftar dengan kode undangan Anda.")}</div>
          </div>
          <button type="button" onClick={onRegister} style={{ ...FONT, whiteSpace: "nowrap", background: "none", border: "none", cursor: "pointer", color: C.ocean, fontSize: 12.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {tt("Register", "Daftar")} <Icon name="arrow-right" size={14} />
          </button>
        </div>
      </div>
    </VwAuthShell>
  );
}

function VendorForgotPassword({ initialEmail, onBack, onReset, onRequest, resetTokenAvailable }) {
  const C = useC();
  const tt = useTT();
  const [email, setEmail] = React.useState(initialEmail || "");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState("");
  const masked = email.includes("@") ? email.replace(/^(.{2}).*(@.*)$/, "$1•••••$2") : email;
  const submit = (e) => {
    e && e.preventDefault();
    if (!email.trim()) return setErr(tt("Enter your registered email.", "Masukkan email terdaftar Anda."));
    setErr(""); setLoading(true);
    Promise.resolve(onRequest(email))
      .then(() => setSent(true))
      .catch((error) => setErr(VwResetRequestErrorMessage(error, tt)))
      .finally(() => setLoading(false));
  };
  return (
    <VwAuthShell>
      <button onClick={onBack} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 22 }}>
        <Icon name="arrow-left" size={15} /> {tt("Back to sign in", "Kembali ke login")}
      </button>
      <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="mail-check" size={25} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Forgot password", "Lupa sandi")}</h2>
      <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{tt("Enter your registered vendor email to start a secure password reset.", "Masukkan email vendor terdaftar untuk memulai reset sandi yang aman.")}</p>
      {!sent ? (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          <Field label={tt("Registered email", "Email terdaftar")} status={err ? "error" : "default"} helper={err || null}>
            <TextInput iconLeft="mail" value={email} onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }} placeholder="you@company.com" status={err ? "error" : "default"} />
          </Field>
          <Button type="submit" size="lg" fullWidth disabled={loading} iconRight={loading ? undefined : "arrow-right"}>
            {loading ? <Spinner size={16} color="#fff" /> : tt("Send reset code", "Kirim kode reset")}
          </Button>
        </form>
      ) : (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <Alert
            tone="success"
            title={tt("Check your email", "Periksa email Anda")}
            description={resetTokenAvailable
              ? tt(`We prepared a secure reset session for ${masked}. Continue to set a new password, or open the link in the email.`, `Kami menyiapkan sesi reset aman untuk ${masked}. Lanjutkan untuk membuat sandi baru, atau buka tautan di email.`)
              : tt(`If an account exists for ${masked}, we sent a reset link to that inbox. Open the email and follow the link to choose a new password.`, `Jika akun ${masked} terdaftar, tautan reset sudah dikirim ke inbox itu. Buka email lalu ikuti tautannya untuk membuat sandi baru.`)} />
          {resetTokenAvailable && <Button size="lg" fullWidth iconRight="arrow-right" onClick={() => onReset(email)}>{tt("Continue to set new password", "Lanjut buat sandi baru")}</Button>}
          <Button variant="secondary" size="lg" fullWidth onClick={submit}>{tt("Send again", "Kirim ulang")}</Button>
        </div>
      )}
    </VwAuthShell>
  );
}

function VendorResetPassword({ email, resetToken, onBack, onDone, onSubmitReset }) {
  const C = useC();
  const tt = useTT();
  const [pwd, setPwd] = React.useState("");
  const [conf, setConf] = React.useState("");
  const [err, setErr] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [policy, setPolicy] = React.useState(VW_DEFAULT_PWD_POLICY);
  React.useEffect(() => { VwApiPasswordPolicy().then(setPolicy); }, []);
  const validPassword = VwPwdValid(pwd, policy);
  const submit = () => {
    if (!resetToken) return setErr(tt("Reset token is unavailable. Request a new reset email.", "Token reset tidak tersedia. Minta email reset baru."));
    if (!validPassword) return setErr(tt("New password does not meet the requirements.", "Sandi baru belum memenuhi ketentuan."));
    if (pwd !== conf) return setErr(tt("New password and confirmation do not match.", "Sandi baru dan konfirmasi tidak cocok."));
    setErr("");
    setLoading(true);
    Promise.resolve(onSubmitReset(pwd))
      .then(() => setDone(true))
      .catch((error) => setErr(VwResetConfirmErrorMessage(error, tt)))
      .finally(() => setLoading(false));
  };
  return (
    <VwAuthShell>
      <button onClick={onBack} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 22 }}>
        <Icon name="arrow-left" size={15} /> {tt("Back", "Kembali")}
      </button>
      <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="key-round" size={25} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Reset password", "Reset sandi")}</h2>
      <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{tt("Create a new password for", "Buat sandi baru untuk")} <b style={{ color: C.text }}>{email}</b>.</p>
      {!done ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          {!resetToken && <Alert tone="warning" title={tt("Reset token unavailable", "Token reset tidak tersedia")} description={tt("Request a new reset session from the previous screen before setting a new password.", "Minta sesi reset baru dari layar sebelumnya sebelum membuat sandi baru.")} />}
          <PasswordField label={tt("New password", "Sandi baru")} required value={pwd} onChange={(e) => { setPwd(e.target.value); if (err) setErr(""); }} placeholder={tt("Enter new password", "Masukkan sandi baru")} />
          <VwPasswordRuleList password={pwd} policy={policy} />
          <PasswordField label={tt("Confirm new password", "Konfirmasi sandi baru")} required value={conf} onChange={(e) => { setConf(e.target.value); if (err) setErr(""); }} placeholder={tt("Re-enter new password", "Ulangi sandi baru")} status={conf && pwd !== conf ? "error" : "default"} />
          {err && <Alert tone="error" title={err} />}
          <Button size="lg" fullWidth iconRight={loading ? undefined : "check"} onClick={submit} disabled={loading}>{loading ? <Spinner size={16} color="#fff" /> : tt("Reset password", "Reset sandi")}</Button>
        </div>
      ) : (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <Alert tone="success" title={tt("Password reset complete", "Reset sandi selesai")} description={tt("You can now sign in with your new password.", "Anda dapat masuk dengan sandi baru.")} />
          <Button size="lg" fullWidth iconRight="log-in" onClick={onDone}>{tt("Back to sign in", "Kembali ke login")}</Button>
        </div>
      )}
    </VwAuthShell>
  );
}

/* ---- external top bar (no internal nav) ---- */
function VwTopBar({ email, onSignOut }) {
  const C = useC();
  const tt = useTT();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useI18n();
  const [acct, setAcct] = React.useState(null);
  const [locked, setLocked] = React.useState(false);
  const [fs, setFs] = React.useState(false);
  const toggleFs = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); setFs(true); }
    else { document.exitFullscreen && document.exitFullscreen().catch(() => {}); setFs(false); }
  };
  const curLang = LANGS.find((l) => l.code === lang) || LANGS[0];
  const name = (email || "vendor").split("@")[0].split(".").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  return (
    <>
    <header style={{ ...FONT, display: "flex", alignItems: "center", gap: 12, height: 60, padding: "0 24px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surface, flexShrink: 0 }}>
      <BrandLockup height={28} onDark={C.scheme === "dark"} />
      <span style={{ width: 1, height: 18, backgroundColor: C.border, margin: "0 2px" }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.textMuted }}>Vendor Workspace</span>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <IconButton name={fs ? "minimize" : "maximize"} title={tt("Fullscreen", "Layar penuh")} onClick={toggleFs} />
        <Menu align="right" width={180} trigger={<IconButton name={theme === "dark" ? "moon" : "sun"} title={tt("Theme", "Tema")} />}>
          <MenuLabel>{tt("Theme", "Tema")}</MenuLabel>
          <MenuItem icon="sun" label={tt("Light", "Terang")} active={theme === "light"} onClick={() => setTheme("light")} trailing={theme === "light" ? <Icon name="check" size={14} color={C.ocean} /> : null} />
          <MenuItem icon="moon" label={tt("Dark", "Gelap")} active={theme === "dark"} onClick={() => setTheme("dark")} trailing={theme === "dark" ? <Icon name="check" size={14} color={C.ocean} /> : null} />
        </Menu>
        <Menu align="right" width={190} trigger={
          <Tooltip label={tt("Language", "Bahasa")} side="bottom">
          <button style={{ ...FONT, display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, width: 44, borderRadius: RADIUS.md, border: "1px solid transparent", background: "transparent", cursor: "pointer" }}>
            <Flag code={curLang.code} size={24} />
          </button>
          </Tooltip>}>
          <MenuLabel>{tt("Language", "Bahasa")}</MenuLabel>
          {LANGS.map((l) => (
            <MenuItem key={l.code} label={<span style={{ display: "inline-flex", gap: 9, alignItems: "center" }}><Flag code={l.code} size={18} />{l.label}</span>}
              active={lang === l.code} onClick={() => setLang(l.code)} trailing={lang === l.code ? <Icon name="check" size={14} color={C.ocean} /> : null} />
          ))}
        </Menu>
      </div>
      <span style={{ width: 1, height: 28, backgroundColor: C.border, margin: "0 2px" }} />
      <Menu align="right" width={244} trigger={
        <button style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 9, height: 40, padding: "0 6px 0 8px", borderRadius: RADIUS.pill, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{name}</span>
            <span style={{ fontSize: 10.5, color: C.textMuted }}>{tt("Vendor", "Vendor")}</span>
          </div>
          <Avatar name={name} size={30} />
        </button>}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px 10px" }}>
          <Avatar name={name} size={38} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ fontSize: 11.5, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
          </div>
        </div>
        <MenuDivider />
        <MenuItem icon="key-round" label={tt("Change password", "Ubah sandi")} onClick={() => setAcct("password")} />
        <MenuItem icon="lock" label={tt("Lock screen", "Kunci layar")} onClick={() => setLocked(true)} />
        <MenuDivider />
        <MenuItem icon="log-out" label={tt("Sign out", "Keluar")} danger onClick={onSignOut} />
      </Menu>
    </header>
    <VwChangePasswordModal open={acct === "password"} onClose={() => setAcct(null)} />
    {locked && <VwLockScreen name={name} email={email} onUnlock={() => setLocked(false)} onSignOut={onSignOut} />}
    </>
  );
}

/* Vendor change-password modal — same password rules as vendor activation (VwPasswordRuleList). */
function VwChangePasswordModal({ open, onClose }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const [cur, setCur] = React.useState("");
  const [next, setNext] = React.useState("");
  const [conf, setConf] = React.useState("");
  const [err, setErr] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [policy, setPolicy] = React.useState(VW_DEFAULT_PWD_POLICY);
  React.useEffect(() => { if (open) { setCur(""); setNext(""); setConf(""); setErr(""); setSaving(false); VwApiPasswordPolicy().then(setPolicy); } }, [open]);
  const validPassword = VwPwdValid(next, policy);
  const submit = () => {
    if (!cur) return setErr(tt("Enter your current password.", "Masukkan sandi Anda saat ini."));
    if (!validPassword) return setErr(tt("New password does not meet the requirements.", "Sandi baru belum memenuhi ketentuan."));
    if (next !== conf) return setErr(tt("New password and confirmation do not match.", "Sandi baru dan konfirmasi tidak cocok."));
    setErr(""); setSaving(true);
    VwApiChangePassword(cur, next)
      .then(() => {
        toast.push({ title: tt("Password changed", "Sandi diperbarui"), description: tt("Your password has been updated.", "Sandi Anda telah diperbarui.") });
        onClose();
      })
      .catch((error) => {
        const payload = error && error.payload;
        if (payload && payload.code === "invalid_current_password") {
          setErr(tt("Your current password is incorrect.", "Sandi Anda saat ini salah."));
        } else if (payload && Array.isArray(payload.errors) && payload.errors.length) {
          setErr(payload.errors.join(" "));
        } else {
          setErr(tt("Could not change the password. Try again.", "Tidak dapat mengubah sandi. Coba lagi."));
        }
      })
      .finally(() => setSaving(false));
  };
  return (
    <Modal open={open} onClose={onClose} width={480} icon="key-round" title={tt("Change password", "Ubah sandi")} subtitle={tt("Update the password for your vendor account", "Perbarui sandi akun vendor Anda")}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>{tt("Cancel", "Batal")}</Button><Button iconLeft={saving ? undefined : "check"} onClick={submit} disabled={saving}>{saving ? <Spinner size={16} color="#fff" /> : tt("Update password", "Perbarui sandi")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PasswordField label={tt("Current password", "Sandi saat ini")} required value={cur} onChange={(e) => { setCur(e.target.value); if (err) setErr(""); }} placeholder={tt("Enter current password", "Masukkan sandi saat ini")} />
        <PasswordField label={tt("New password", "Sandi baru")} required value={next} onChange={(e) => { setNext(e.target.value); if (err) setErr(""); }} placeholder={tt("Enter new password", "Masukkan sandi baru")} />
        <VwPasswordRuleList password={next} policy={policy} />
        <PasswordField label={tt("Confirm new password", "Konfirmasi sandi baru")} required value={conf} onChange={(e) => { setConf(e.target.value); if (err) setErr(""); }} placeholder={tt("Re-enter new password", "Ulangi sandi baru")}
          status={conf && next !== conf ? "error" : "default"} />
        {err && <Alert tone="error" title={err} />}
      </div>
    </Modal>
  );
}

/* Vendor session lock — same behaviour as the internal lock screen, copy tailored to the vendor. */
function VwLockScreen({ name, email, onUnlock, onSignOut }) {
  const C = useC();
  const tt = useTT();
  const [pwd, setPwd] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const submit = (e) => {
    if (e) e.preventDefault();
    if (!pwd.trim()) { setErr(tt("Enter your password to continue", "Masukkan sandi untuk melanjutkan")); return; }
    setErr(""); setBusy(true);
    VwApiVerifyPassword(pwd)
      .then((res) => {
        if (res && res.valid) { setPwd(""); onUnlock(); }
        else { setErr(tt("Incorrect password. Try again.", "Sandi salah. Coba lagi.")); }
      })
      .catch(() => setErr(tt("Could not verify the password. Try again.", "Tidak dapat memverifikasi sandi. Coba lagi.")))
      .finally(() => setBusy(false));
  };
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  const date = fmtAppDate(now);
  return (
    <div style={{ ...FONT, position: "fixed", inset: 0, zIndex: 9500, minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 1fr", backgroundColor: C.bg }} className="ag-auth">
      <div className="ag-auth-brand ag-lock-aside" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(150deg, #013B52 0%, #0A5560 45%, #0F828A 100%)", color: "#fff", padding: "56px 60px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ position: "absolute", top: -60, right: -40, opacity: 0.12, transform: "scale(6) rotate(8deg)", transformOrigin: "top right" }}><DiamondMark size={22} /></div>
        <div style={{ position: "absolute", bottom: 40, left: -30, opacity: 0.08, transform: "scale(4)" }}><DiamondMark size={22} /></div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <BrandLockup height={42} onDark />
          <span style={{ width: 1, height: 16, backgroundColor: "rgba(255,255,255,0.3)", margin: "0 2px" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>Vendor Workspace</span>
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 480 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8FE3E8" }}>{tt("Session secured", "Sesi aman")}</div>
          <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: 0, lineHeight: 1, marginTop: 18, fontVariantNumeric: "tabular-nums" }}>{time}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.78)", marginTop: 10 }}>{date}</div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: 0, lineHeight: 1.16, margin: "34px 0 0", color: "#fff" }}>{tt("Your vendor workspace is locked.", "Workspace vendor Anda terkunci.")}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", marginTop: 14 }}>{tt("Unlock to continue managing your company profile, documents, and registration.", "Buka kunci untuk melanjutkan pengelolaan profil perusahaan, dokumen, dan registrasi Anda.")}</p>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>{tt("Vendor self-service access · protected session", "Akses mandiri vendor · sesi terlindungi")}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
        <form className="ag-lock-card" onSubmit={submit} style={{ width: 420, maxWidth: "100%", backgroundColor: C.surface, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS.xl, boxShadow: C.shadowLg, padding: 30, textAlign: "center" }}>
          <span style={{ width: 54, height: 54, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icon name="shield-check" size={26} /></span>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
            <Avatar name={name} size={68} />
            <span style={{ position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: RADIUS.pill, background: "#013B52", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", border: `3px solid ${C.surface}` }}><Icon name="lock" size={13} /></span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: 0 }}>{name}</div>
          <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{tt("Enter your password to resume your vendor session.", "Masukkan sandi Anda untuk melanjutkan sesi vendor.")}</div>

          <div style={{ marginTop: 24, textAlign: "left" }}>
            <Field label={tt("Password", "Sandi")} status={err ? "error" : "default"} helper={err || null}>
              <TextInput type="password" iconLeft="lock" placeholder={tt("Enter your password", "Masukkan sandi Anda")} value={pwd} disabled={busy}
                status={err ? "error" : "default"}
                onChange={(e) => { setPwd(e.target.value); if (err) setErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") submit(e); }} />
            </Field>
          </div>

          <div style={{ marginTop: 18 }}>
            <Button type="submit" iconLeft={busy ? undefined : "unlock"} disabled={busy} style={{ width: "100%", justifyContent: "center" }} onClick={submit}>{busy ? <Spinner size={16} color="#fff" /> : tt("Unlock session", "Buka kunci sesi")}</Button>
          </div>
          <button type="button" onClick={onSignOut} style={{ ...FONT, marginTop: 18, background: "transparent", border: "none", color: C.textMuted, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon name="log-out" size={14} />{tt("Not you? Sign out", "Bukan Anda? Keluar")}
          </button>
        </form>
      </div>
    </div>
  );
}

/* OTP step for an email-confirmation-gated sign-in (Settings > Security). */
function VendorOtp({ email, onVerified, onBack }) {
  const C = useC();
  const tt = useTT();
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const submit = (e) => {
    e && e.preventDefault();
    if (!code.trim()) { setErr(tt("Enter the code from your email", "Masukkan kode dari email Anda")); return; }
    setErr(""); setLoading(true);
    VwApiVendorLoginOtp(email, code.trim())
      .then(() => onVerified())
      .catch(() => setErr(tt("Invalid or expired code.", "Kode salah atau kedaluwarsa.")))
      .finally(() => setLoading(false));
  };
  return (
    <VwAuthShell>
      <div style={{ marginBottom: 24 }}>
        <div style={{ width: 46, height: 46, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Icon name="shield-check" size={22} /></div>
        <h2 style={{ fontSize: 23, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Check your email", "Periksa email Anda")}</h2>
        <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6 }}>{tt("We sent a verification code to ", "Kami mengirim kode verifikasi ke ")}<b style={{ color: C.text }}>{email}</b>. {tt("Enter it below to finish signing in.", "Masukkan kode tersebut untuk menyelesaikan proses masuk.")}</p>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Verification code", "Kode verifikasi")} status={err ? "error" : "default"} helper={err || null}>
          <TextInput iconLeft="key-round" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" status={err ? "error" : "default"} />
        </Field>
        <Button type="submit" size="lg" fullWidth disabled={loading} iconRight={loading ? undefined : "arrow-right"}>
          {loading ? <Spinner size={16} color="#fff" /> : tt("Verify & sign in", "Verifikasi & masuk")}
        </Button>
        <button type="button" onClick={onBack} style={{ ...FONT, background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, fontWeight: 600 }}>{tt("Back to sign in", "Kembali ke halaman masuk")}</button>
      </form>
    </VwAuthShell>
  );
}

function VendorAppInner() {
  const C = useC();
  const params = React.useMemo(() => { try { return new URLSearchParams(window.location.search); } catch (e) { return new URLSearchParams(); } }, []);
  const regToken = params.get("invite") || "";
  const resetLinkToken = params.get("reset") || "";
  const resetLinkEmail = params.get("email") || "";
  const [phase, setPhase] = React.useState(() => (regToken ? "register" : (resetLinkToken ? "reset" : "login")));
  const [email, setEmail] = React.useState(resetLinkEmail);
  const [resetToken, setResetToken] = React.useState(resetLinkToken || null);

  React.useEffect(() => {
    let cancelled = false;
    VwApiVendorMe()
      .then((me) => {
        if (cancelled) return;
        setEmail(me.email || "");
        setPhase("app");
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, []);

  const handleVendorLogin = async (vendorEmail, password) => {
    const result = await VwApiVendorLogin(vendorEmail, password);
    if (result && result.status === "otp_required") {
      setEmail(vendorEmail);
      setPhase("otp");
      return;
    }
    const me = await VwApiVendorMe();
    setEmail(me.email || vendorEmail);
    setPhase("app");
  };

  const handleOtpVerified = async () => {
    const me = await VwApiVendorMe();
    setEmail(me.email || email);
    setPhase("app");
  };

  const handleVendorRequestReset = async (vendorEmail) => {
    const result = await VwApiRequestPasswordReset(vendorEmail);
    setResetToken(result && result.resetToken ? result.resetToken : null);
    setEmail(vendorEmail);
    return result;
  };

  const handleVendorConfirmReset = async (newPassword) => {
    await VwApiConfirmPasswordReset(email, resetToken, newPassword);
  };

  const handleVendorSignOut = async () => {
    try { await VwApiVendorLogout(); } catch (e) {}
    setPhase("login");
  };

  if (phase === "register") return <VendorRegister initialToken={regToken} onBack={() => setPhase("login")} onDone={() => setPhase("login")} />;
  if (phase === "otp") return <VendorOtp email={email} onVerified={handleOtpVerified} onBack={() => setPhase("login")} />;
  if (phase === "login") return <VendorLogin onAuthed={handleVendorLogin} onForgot={(e) => { setEmail(e); setPhase("forgot"); }} onRegister={() => setPhase("register")} />;
  if (phase === "forgot") return <VendorForgotPassword initialEmail={email} resetTokenAvailable={!!resetToken} onBack={() => setPhase("login")} onReset={(e) => { setEmail(e); setPhase("reset"); }} onRequest={handleVendorRequestReset} />;
  if (phase === "reset") return <VendorResetPassword email={email} resetToken={resetToken} onBack={() => setPhase("forgot")} onDone={() => setPhase("login")} onSubmitReset={handleVendorConfirmReset} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: C.bg }}>
      <VwTopBar email={email} onSignOut={handleVendorSignOut} />
      <main style={{ flex: 1, overflowY: "auto" }}>
        {/* Keep the profile fluid: Full HD at 125% still exposes about 1536 CSS px. */}
        <div style={{ width: "100%", padding: "24px 28px 56px" }}>
          <VendorWorkspaceProfile onNavigate={() => {}} />
        </div>
      </main>
      <VwPdfDocumentViewer />
    </div>
  );
}

function VendorApp() {
  return (
    <ThemeProvider>
      <I18nProvider defaultLang="id" storageKey="vw_lang">
        <ToastProvider>
          <VendorAppInner />
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export { VendorApp };
