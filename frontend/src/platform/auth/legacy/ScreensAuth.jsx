/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useTheme, useC } from "../../../shared/legacy/Tokens.jsx";
import { Icon, Button, IconButton, TextInput, Field, Checkbox, DiamondMark, BrandLockup, Flag } from "../../../shared/legacy/Primitives.jsx";
import { Alert, Spinner, Menu, MenuItem, MenuLabel, Tooltip } from "../../../shared/legacy/PrimitivesX.jsx";
import { LANGS, useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
import { ABOUT_FALLBACK, loadAboutApplication } from "../../about/legacy/AboutApplication.jsx";
import { PasswordField } from "../../account/legacy/AccountModals.jsx";
/* Alamtri Geo Admin — auth screens: internal sign-in and account-recovery shell. Full-viewport, outside the shell.
   This is the INTERNAL portal login (staff). Vendor login lives in the external bundle (VendorApp).
   Chrome (gradient, diamonds, type) stays Suite. Copy is keyed by window.__APP_PORTAL and UI language. */

const AUTH_PORTAL_COPY = {
  suite: {
    en: {
      eyebrow: "Integrated Procurement Platform",
      headline: "One workspace for vendor, proposal, and contract execution.",
      body: "Access Vendor Onboarding, Proposal Tracker (including Term Sheet / Contract), and Contract Monitoring from one internal portal.",
      facts: [
        ["4", "Procurement modules"],
        ["Vendor Hub", "External vendor data"],
        ["Tracker + CM", "Contract lifecycle"],
      ],
      formTitle: "Internal procurement sign in",
      formLead: "Continue across vendor data, proposals, Term Sheet, and contract monitoring.",
      footer: "Staff-only access. Sign in with your local password, or continue with SSO when it is enabled.",
    },
    id: {
      eyebrow: "Platform Pengadaan Terpadu",
      headline: "Satu ruang kerja untuk vendor, proposal, dan eksekusi kontrak.",
      body: "Akses Vendor Onboarding, Proposal Tracker (termasuk Term Sheet / Kontrak), dan Contract Monitoring dari satu portal internal.",
      facts: [
        ["4", "Modul pengadaan"],
        ["Vendor Hub", "Data vendor eksternal"],
        ["Tracker + CM", "Siklus kontrak"],
      ],
      formTitle: "Masuk pengadaan internal",
      formLead: "Lanjutkan ke data vendor, proposal, Term Sheet, dan contract monitoring.",
      footer: "Akses staf. Masuk dengan kata sandi lokal, atau lanjutkan dengan SSO jika sudah aktif.",
    },
  },
  "vendor-onboarding": {
    en: {
      eyebrow: "Vendor Onboarding",
      headline: "Qualify a vendor before they enter the workspace.",
      body: "Open a dossier, walk the status chain, and activate workspace access for the PIC who will work in Vendor Workspace.",
      facts: [
        ["Dossier", "Registration pack"],
        ["Status chain", "SBMIT to APPRV"],
        ["Workspace", "PIC activation"],
      ],
      formTitle: "Sign in to Vendor Onboarding",
      formLead: "Continue vendor registration, approval, and workspace activation.",
      footer: "Staff-only access. Sign in with your local password, or continue with SSO when it is enabled.",
    },
    id: {
      eyebrow: "Vendor Onboarding",
      headline: "Kualifikasi vendor sebelum masuk ke workspace.",
      body: "Buka dossier, ikuti rantai status, dan aktifkan akses workspace untuk PIC yang akan bekerja di Vendor Workspace.",
      facts: [
        ["Dossier", "Paket registrasi"],
        ["Rantai status", "SBMIT sampai APPRV"],
        ["Workspace", "Aktivasi PIC"],
      ],
      formTitle: "Masuk ke Vendor Onboarding",
      formLead: "Lanjutkan registrasi, persetujuan, dan aktivasi workspace vendor.",
      footer: "Akses staf. Masuk dengan kata sandi lokal, atau lanjutkan dengan SSO jika sudah aktif.",
    },
  },
  "proposal-tracker": {
    en: {
      eyebrow: "Proposal Tracker",
      headline: "Follow a proposal from intake through LOA.",
      body: "After Bid Evaluation (or Negotiation), Term Sheet is completed in Tracker. Then LOA and Contract open together on this board.",
      facts: [
        ["PROP", "Intake on this board"],
        ["EVAL", "Award recorded here"],
        ["LOA", "Issued here after TERM"],
      ],
      formTitle: "Sign in to Proposal Tracker",
      formLead: "Continue the pipeline through Term Sheet, then LOA in parallel with Contract.",
      footer: "Staff-only access. Sign in with your local password, or continue with SSO when it is enabled.",
    },
    id: {
      eyebrow: "Proposal Tracker",
      headline: "Ikuti proposal dari intake sampai LOA.",
      body: "Setelah Bid Evaluation (atau Negotiation), Term Sheet diselesaikan di Tracker. Lalu LOA dan Contract dibuka bersama di papan ini.",
      facts: [
        ["PROP", "Intake di papan ini"],
        ["EVAL", "Award dicatat di sini"],
        ["LOA", "Setelah TERM, di sini"],
      ],
      formTitle: "Masuk ke Proposal Tracker",
      formLead: "Lanjutkan pipeline lewat Term Sheet, lalu LOA paralel dengan Contract.",
      footer: "Akses staf. Masuk dengan kata sandi lokal, atau lanjutkan dengan SSO jika sudah aktif.",
    },
  },
  "contract-monitoring": {
    en: {
      eyebrow: "Contract Monitoring",
      headline: "Watch delivery after the contract is live.",
      body: "The contract database, obligations, and materials stay here once initiation is done.",
      facts: [
        ["Database", "Signed contracts"],
        ["Obligations", "What is due"],
        ["Material", "List of material"],
      ],
      formTitle: "Sign in to Contract Monitoring",
      formLead: "Continue material tracking and contract oversight.",
      footer: "Staff-only access. Sign in with your local password, or continue with SSO when it is enabled.",
    },
    id: {
      eyebrow: "Contract Monitoring",
      headline: "Pantau pelaksanaan setelah kontrak berjalan.",
      body: "Database kontrak, kewajiban, dan material berada di sini setelah inisiasi selesai.",
      facts: [
        ["Database", "Kontrak tertandatangani"],
        ["Kewajiban", "Yang jatuh tempo"],
        ["Material", "Daftar material"],
      ],
      formTitle: "Masuk ke Contract Monitoring",
      formLead: "Lanjutkan pelacakan material dan pengawasan kontrak.",
      footer: "Akses staf. Masuk dengan kata sandi lokal, atau lanjutkan dengan SSO jika sudah aktif.",
    },
  },
};

function authPortalCopy(lang) {
  const portal = (typeof window !== "undefined" && window.__APP_PORTAL) || "suite";
  const pack = AUTH_PORTAL_COPY[portal] || AUTH_PORTAL_COPY.suite;
  return (lang === "id" ? pack.id : pack.en) || pack.en;
}

function translateAccessDenied(err, tt) {
  const match = String(err || "").match(/does not have access to\s+(.+?)\.?$/i);
  if (!match) return err;
  const name = match[1].replace(/\.$/, "");
  return tt(`This account does not have access to ${name}.`, `Akun ini tidak memiliki akses ke ${name}.`);
}

function AuthControls() {
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

function AuthShell({ children }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const copy = authPortalCopy(lang);
  const [appVersion, setAppVersion] = React.useState(
    (typeof ABOUT_FALLBACK !== "undefined" && ABOUT_FALLBACK.version) || "1.0.0"
  );
  React.useEffect(() => {
    if (typeof loadAboutApplication !== "function") return undefined;
    let cancelled = false;
    loadAboutApplication().then((data) => {
      if (!cancelled && data && data.version) setAppVersion(data.version);
    });
    return () => { cancelled = true; };
  }, []);
  return (
    <div style={{ ...FONT, minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 1fr", backgroundColor: C.bg }} className="ag-auth">
      {/* Brand panel — Suite chrome; portal-specific thesis */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(150deg, #013B52 0%, #0A5560 45%, #0F828A 100%)", color: "#fff", padding: "56px 60px", display: "flex", flexDirection: "column", justifyContent: "space-between" }} className="ag-auth-brand">
        <div style={{ position: "absolute", top: -60, right: -40, opacity: 0.12, transform: "scale(6) rotate(8deg)", transformOrigin: "top right" }}><DiamondMark size={22} /></div>
        <div style={{ position: "absolute", bottom: 40, left: -30, opacity: 0.08, transform: "scale(4)" }}><DiamondMark size={22} /></div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center" }}>
          <BrandLockup height={42} onDark />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 540 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8FE3E8" }}>{copy.eyebrow}</div>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: 0, lineHeight: 1.12, margin: "16px 0 0", color: "#fff" }}>{copy.headline}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", marginTop: 16 }}>{copy.body}</p>
          <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "flex-start", gap: 14, marginTop: 36 }}>
            {copy.facts.map(([v, l], i) => (
              <React.Fragment key={`${v}-${l}`}>
                {i > 0 && <span aria-hidden="true" style={{ color: "rgba(143,227,232,0.55)", fontSize: 20, fontWeight: 700, lineHeight: "28px", flex: "0 0 auto" }}>→</span>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{v}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginTop: 2, whiteSpace: "nowrap" }}>{l}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
          <span>{tt("© 2026 Saptaindra · PT Saptaindra Sejati · All rights reserved", "© 2026 Saptaindra · PT Saptaindra Sejati · Hak cipta dilindungi")}</span>
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{tt("Version", "Versi")} {appVersion}</span>
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
        <div style={{ position: "absolute", top: 18, right: 18, zIndex: 2 }}><AuthControls /></div>
        <div style={{ width: "100%", maxWidth: 392 }}>{children}</div>
      </div>
    </div>
  );
}

function LoginScreen({ onSubmit, onRegister, onForgot, onSso, ssoEnabled }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const copy = authPortalCopy(lang);
  const [user, setUser] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const submit = (e) => {
    e && e.preventDefault();
    if (!user.trim()) { setErr(tt("Enter your personnel number or email", "Masukkan NRP atau email")); return; }
    if (!password) { setErr(tt("Enter your password", "Masukkan kata sandi")); return; }
    setErr(""); setLoading(true);
    Promise.resolve(onSubmit({ identifier: user.trim(), password }))
      .catch((error) => {
        const code = error && error.code;
        if (code === "account_locked") setErr(tt("This account is locked after too many failed sign-ins. Try again later or ask an administrator to reset the password.", "Akun ini terkunci setelah terlalu banyak percobaan gagal. Coba lagi nanti atau minta administrator mereset kata sandi."));
        else if (code === "internal_user_inactive") setErr(tt("This account is not active.", "Akun ini tidak aktif."));
        else setErr(error.message || tt("Sign in failed", "Gagal masuk"));
      })
      .finally(() => setLoading(false));
  };
  const accessDenied = err && /does not have access to/i.test(err);
  return (
    <AuthShell>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{copy.formTitle}</h2>
        <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>{copy.formLead}</p>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {accessDenied && <Alert tone="error" title={tt("No access to this module", "Tidak ada akses ke modul ini")} description={translateAccessDenied(err, tt)} />}
        <Field label={tt("Personnel number or email", "NRP atau email")} status={err && !accessDenied ? "error" : "default"}>
          <TextInput iconLeft="user" value={user} onChange={(e) => { setUser(e.target.value); if (err) setErr(""); }} placeholder="you@saptaindra.co.id" status={err && !accessDenied ? "error" : "default"} />
        </Field>
        <Field label={tt("Password", "Kata sandi")} status={err && !accessDenied ? "error" : "default"} helper={err && !accessDenied ? err : null}>
          <TextInput iconLeft="lock" type={show ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); if (err) setErr(""); }} placeholder={tt("Enter your password", "Masukkan kata sandi")}
            status={err && !accessDenied ? "error" : "default"}
            iconRight={<button type="button" onClick={() => setShow((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 0 }}><Icon name={show ? "eye-off" : "eye"} size={16} /></button>} />
        </Field>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Checkbox checked={remember} onChange={setRemember} label={tt("Remember me", "Ingat saya")} />
          <button type="button" onClick={() => onForgot && onForgot(user)}
            style={{ ...FONT, border: "none", background: "transparent", padding: 0, fontSize: 12.5, fontWeight: 700, color: C.ocean, cursor: "pointer" }}>{tt("Forgot password?", "Lupa kata sandi?")}</button>
        </div>
        <Button type="submit" size="lg" fullWidth disabled={loading} iconRight={loading ? undefined : "arrow-right"}>
          {loading ? <Spinner size={16} color="#fff" /> : tt("Sign in", "Masuk")}
        </Button>
        {ssoEnabled && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}>
              <div style={{ flex: 1, height: 1, backgroundColor: C.border }} /><span style={{ fontSize: 11.5, color: C.textSubtle, fontWeight: 500 }}>{tt("OR", "ATAU")}</span><div style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </div>
            <Button type="button" variant="secondary" size="lg" fullWidth iconLeft="shield-check" onClick={() => onSso && onSso()}>{tt("Continue with SSO", "Lanjutkan dengan SSO")}</Button>
          </>
        )}
      </form>
      <p style={{ fontSize: 12.5, color: C.textMuted, textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
        {copy.footer}
      </p>
    </AuthShell>
  );
}

const DEFAULT_PASSWORD_POLICY = { minLength: 12, requireDigit: true, requireLowercase: true, requireUppercase: true, requireNonAlphanumeric: true };

function passwordMeetsPolicy(password, policy) {
  const p = policy || DEFAULT_PASSWORD_POLICY;
  const value = password || "";
  if (value.length < p.minLength) return false;
  if (p.requireDigit && !/[0-9]/.test(value)) return false;
  if (p.requireLowercase && !/[a-z]/.test(value)) return false;
  if (p.requireUppercase && !/[A-Z]/.test(value)) return false;
  if (p.requireNonAlphanumeric && !/[^a-zA-Z0-9]/.test(value)) return false;
  return true;
}

function PasswordRuleList({ password, policy }) {
  const C = useC();
  const tt = useTT();
  const p = policy || DEFAULT_PASSWORD_POLICY;
  const checks = [
    { ok: password.length >= p.minLength, label: tt(`At least ${p.minLength} characters`, `Minimal ${p.minLength} karakter`) },
  ];
  if (p.requireUppercase) checks.push({ ok: /[A-Z]/.test(password), label: tt("Contains an uppercase letter", "Mengandung huruf besar") });
  if (p.requireLowercase) checks.push({ ok: /[a-z]/.test(password), label: tt("Contains a lowercase letter", "Mengandung huruf kecil") });
  if (p.requireDigit) checks.push({ ok: /[0-9]/.test(password), label: tt("Contains a number", "Mengandung angka") });
  if (p.requireNonAlphanumeric) checks.push({ ok: /[^a-zA-Z0-9]/.test(password), label: tt("Contains a symbol", "Mengandung simbol") });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
      {checks.map((c) => (
        <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: c.ok ? C.success : C.textMuted }}>
          <Icon name={c.ok ? "check-circle-2" : "circle"} size={13} />{c.label}
        </span>
      ))}
    </div>
  );
}

function resetRequestErrorMessage(error, tt) {
  return (error && error.message) || tt("Unable to send the reset instruction. Please try again.", "Tidak dapat mengirim instruksi reset. Silakan coba lagi.");
}

function resetConfirmErrorMessage(error, tt) {
  const code = error && error.code;
  if (code === "invalid_reset_request" || code === "reset_token_invalid") {
    return tt("This reset link is invalid or has expired. Please request a new reset email.", "Tautan reset ini tidak valid atau sudah kedaluwarsa. Silakan minta email reset baru.");
  }
  if (code === "password_reset_failed") {
    return tt("Your new password doesn't meet the security requirements. Please choose a stronger password.", "Kata sandi baru Anda belum memenuhi ketentuan keamanan. Silakan pilih kata sandi yang lebih kuat.");
  }
  return (error && error.message) || tt("Password reset failed. Please try again.", "Reset kata sandi gagal. Silakan coba lagi.");
}

function ForgotPasswordScreen({ initialUser, onBack, onReset, onRequest, resetTokenAvailable }) {
  const C = useC();
  const tt = useTT();
  const [account, setAccount] = React.useState(initialUser || "");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState("");
  const trimmed = (account || "").trim();
  const masked = trimmed.includes("@") ? trimmed.replace(/^(.{2}).*(@.*)$/, "$1•••••$2") : trimmed;
  const submit = (e) => {
    e && e.preventDefault();
    if (!trimmed) return setErr(tt("Enter your personnel number or email.", "Masukkan NRP atau email."));
    setErr(""); setLoading(true);
    Promise.resolve(onRequest(trimmed))
      .then(() => setSent(true))
      .catch((error) => setErr(resetRequestErrorMessage(error, tt)))
      .finally(() => setLoading(false));
  };
  return (
    <AuthShell>
      <button type="button" onClick={onBack} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 22 }}>
        <Icon name="arrow-left" size={15} /> {tt("Back to sign in", "Kembali ke masuk")}
      </button>
      <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="mail-check" size={25} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Forgot password", "Lupa kata sandi")}</h2>
      <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{tt("Enter your personnel number or email to start a secure password reset.", "Masukkan NRP atau email untuk memulai reset kata sandi yang aman.")}</p>
      {!sent ? (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          <Field label={tt("Personnel number or email", "NRP atau email")} status={err ? "error" : "default"} helper={err || null}>
            <TextInput iconLeft="user" value={account} onChange={(e) => { setAccount(e.target.value); if (err) setErr(""); }} placeholder="you@saptaindra.co.id" status={err ? "error" : "default"} />
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
              ? tt(`We prepared a secure reset session for ${masked || "this account"}. Continue to set a new password, or open the link in the email.`, `Kami menyiapkan sesi reset aman untuk ${masked || "akun ini"}. Lanjutkan untuk membuat kata sandi baru, atau buka tautan di email.`)
              : tt(`If an account exists for ${masked || "this account"}, we sent a reset link to that inbox. Open the email and follow the link to choose a new password.`, `Jika akun ${masked || "akun ini"} terdaftar, tautan reset sudah dikirim ke inbox itu. Buka email lalu ikuti tautannya untuk membuat kata sandi baru.`)} />
          {resetTokenAvailable && <Button size="lg" fullWidth iconRight="arrow-right" onClick={() => onReset && onReset(account)}>{tt("Continue to set new password", "Lanjut buat kata sandi baru")}</Button>}
          <Button variant="secondary" size="lg" fullWidth onClick={submit} disabled={loading}>{tt("Send again", "Kirim ulang")}</Button>
        </div>
      )}
    </AuthShell>
  );
}

function ResetPasswordScreen({ account, resetToken, onBack, onDone, onSubmitReset }) {
  const C = useC();
  const tt = useTT();
  const [pwd, setPwd] = React.useState("");
  const [conf, setConf] = React.useState("");
  const [err, setErr] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [policy, setPolicy] = React.useState(null);
  React.useEffect(() => {
    const authApi = typeof window !== "undefined" ? window.__internalAuth : null;
    if (!authApi || typeof authApi.passwordPolicy !== "function") return undefined;
    let cancelled = false;
    authApi.passwordPolicy().then((data) => { if (!cancelled && data) setPolicy(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const submit = () => {
    if (!resetToken) return setErr(tt("Reset token is unavailable. Request a new reset email.", "Token reset tidak tersedia. Minta email reset baru."));
    if (!passwordMeetsPolicy(pwd, policy)) return setErr(tt("New password does not meet the requirements.", "Kata sandi baru belum memenuhi ketentuan."));
    if (pwd !== conf) return setErr(tt("New password and confirmation do not match.", "Kata sandi baru dan konfirmasi tidak sama."));
    setErr(""); setLoading(true);
    Promise.resolve(onSubmitReset(pwd))
      .then(() => setDone(true))
      .catch((error) => setErr(resetConfirmErrorMessage(error, tt)))
      .finally(() => setLoading(false));
  };
  return (
    <AuthShell>
      <button type="button" onClick={onBack} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 22 }}>
        <Icon name="arrow-left" size={15} /> {tt("Back", "Kembali")}
      </button>
      <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="key-round" size={25} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Reset password", "Atur ulang kata sandi")}</h2>
      <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{tt("Create a new password for", "Buat kata sandi baru untuk")} <b style={{ color: C.text }}>{account || tt("your account", "akun Anda")}</b>.</p>
      {!done ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          {!resetToken && <Alert tone="warning" title={tt("Reset token unavailable", "Token reset tidak tersedia")} description={tt("Request a new reset session from the previous screen before setting a new password.", "Minta sesi reset baru dari layar sebelumnya sebelum membuat kata sandi baru.")} />}
          <PasswordField label={tt("New password", "Kata sandi baru")} required value={pwd} onChange={(e) => { setPwd(e.target.value); if (err) setErr(""); }} placeholder={tt("Enter new password", "Masukkan kata sandi baru")} />
          <PasswordRuleList password={pwd} policy={policy} />
          <PasswordField label={tt("Confirm new password", "Konfirmasi kata sandi baru")} required value={conf} onChange={(e) => { setConf(e.target.value); if (err) setErr(""); }} placeholder={tt("Re-enter new password", "Ulangi kata sandi baru")} status={conf && pwd !== conf ? "error" : "default"} />
          {err && <Alert tone="error" title={err} />}
          <Button size="lg" fullWidth iconRight={loading ? undefined : "check"} onClick={submit} disabled={loading}>{loading ? <Spinner size={16} color="#fff" /> : tt("Reset password", "Atur ulang kata sandi")}</Button>
        </div>
      ) : (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <Alert tone="success" title={tt("Password reset complete", "Reset kata sandi selesai")} description={tt("You can now sign in with your new password.", "Anda dapat masuk dengan kata sandi baru.")} />
          <Button size="lg" fullWidth iconRight="log-in" onClick={onDone}>{tt("Back to sign in", "Kembali ke masuk")}</Button>
        </div>
      )}
    </AuthShell>
  );
}

function OTPScreen({ email, onVerify, onBack }) {
  const C = useC();
  const tt = useTT();
  const masked = email.includes("@") ? email.replace(/^(.{2}).*(@.*)$/, "$1•••••$2") : email + "@saptaindra.co.id";
  return (
    <AuthShell>
      <button onClick={onBack} style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 22 }}>
        <Icon name="arrow-left" size={15} /> {tt("Back to sign in", "Kembali ke masuk")}
      </button>
      <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="shield-check" size={26} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Verify your identity", "Verifikasi identitas Anda")}</h2>
      <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{tt("Multi-factor verification for", "Verifikasi multi-faktor untuk")} <b style={{ color: C.text }}>{masked}</b> {tt("will be handled by the enterprise identity provider once SSO/MFA integration is enabled.", "akan ditangani penyedia identitas perusahaan setelah integrasi SSO/MFA diaktifkan.")}</p>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <Alert tone="info" title={tt("MFA integration pending", "Integrasi MFA belum aktif")} description={tt("This screen is reserved for enterprise MFA. Continue with SSO when it is enabled, or contact IT if you cannot access your internal account.", "Layar ini disiapkan untuk MFA perusahaan. Lanjutkan dengan SSO jika sudah aktif, atau hubungi IT jika tidak bisa mengakses akun internal.")} />
        <Button size="lg" fullWidth onClick={() => onVerify && onVerify()}>{tt("Acknowledge", "Mengerti")}</Button>
      </div>
    </AuthShell>
  );
}

function MustChangePasswordScreen({ onDone, onSignOut }) {
  const C = useC();
  const tt = useTT();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [policy, setPolicy] = React.useState(null);
  React.useEffect(() => {
    const authApi = typeof window !== "undefined" ? window.__internalAuth : null;
    if (!authApi || typeof authApi.passwordPolicy !== "function") return undefined;
    let cancelled = false;
    authApi.passwordPolicy().then((data) => { if (!cancelled && data) setPolicy(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const submit = (e) => {
    e && e.preventDefault();
    if (!current || !next) { setErr(tt("Enter your current and new password.", "Masukkan kata sandi saat ini dan yang baru.")); return; }
    if (!passwordMeetsPolicy(next, policy)) { setErr(tt("New password does not meet the requirements.", "Kata sandi baru belum memenuhi ketentuan.")); return; }
    if (next !== confirm) { setErr(tt("New password and confirmation do not match.", "Kata sandi baru dan konfirmasi tidak sama.")); return; }
    setErr(""); setLoading(true);
    Promise.resolve(window.__internalAuth.changePassword(current, next))
      .then(() => onDone && onDone())
      .catch((error) => {
        const list = error && error.errors;
        setErr((Array.isArray(list) && list[0]) || error.message || tt("Could not update the password.", "Tidak bisa memperbarui kata sandi."));
      })
      .finally(() => setLoading(false));
  };
  return (
    <AuthShell>
      <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="key-round" size={25} /></div>
      <h2 style={{ fontSize: 25, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Set a new password", "Atur kata sandi baru")}</h2>
      <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{tt("An administrator set a temporary local password. Choose a new one before continuing.", "Administrator mengatur kata sandi lokal sementara. Pilih yang baru sebelum lanjut.")}</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
        <PasswordField label={tt("Current password", "Kata sandi saat ini")} required value={current} onChange={(e) => { setCurrent(e.target.value); if (err) setErr(""); }} placeholder={tt("Enter current password", "Masukkan kata sandi saat ini")} />
        <PasswordField label={tt("New password", "Kata sandi baru")} required value={next} onChange={(e) => { setNext(e.target.value); if (err) setErr(""); }} placeholder={tt("Enter new password", "Masukkan kata sandi baru")} />
        <PasswordRuleList password={next} policy={policy} />
        <PasswordField label={tt("Confirm new password", "Konfirmasi kata sandi baru")} required value={confirm} onChange={(e) => { setConfirm(e.target.value); if (err) setErr(""); }} placeholder={tt("Re-enter new password", "Ulangi kata sandi baru")} status={confirm && next !== confirm ? "error" : "default"} />
        {err && <Alert tone="error" title={err} />}
        <Button type="submit" size="lg" fullWidth disabled={loading} iconRight={loading ? undefined : "check"}>{loading ? <Spinner size={16} color="#fff" /> : tt("Save password", "Simpan kata sandi")}</Button>
        <button type="button" onClick={onSignOut} style={{ ...FONT, background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12.5, fontWeight: 600 }}>{tt("Sign out", "Keluar")}</button>
      </form>
    </AuthShell>
  );
}

Object.assign(window, { LoginScreen, OTPScreen, ForgotPasswordScreen, ResetPasswordScreen, PasswordRuleList, MustChangePasswordScreen });
export { LoginScreen, OTPScreen, ForgotPasswordScreen, ResetPasswordScreen, PasswordRuleList, MustChangePasswordScreen, passwordMeetsPolicy };
