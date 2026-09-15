import React from "react";
import { useC, useTheme, FONT, RADIUS } from "../../../shared/legacy/Tokens.jsx";
import { useTT } from "../../../shared/legacy/i18n.jsx";
import { Icon, IconButton, Button, BrandLockup, Field, TextInput } from "../../../shared/legacy/Primitives.jsx";
import { Alert, Spinner } from "../../../shared/legacy/PrimitivesX.jsx";
import { VwApiValidateInvite, VwNormalizeToken, VwApiPasswordPolicy, VwPwdValid, VwPwdChecks, VwApiRegisterVendor, VW_DEFAULT_PWD_POLICY } from "./VendorOnboardingData.jsx";

/* Alamtri Geo Admin — Vendor Workspace: invite-only registration (pre-login).
   Mirrors the legacy VendorConnect flow: the vendor reaches this screen via a tokenised
   email link (?invite=CODE) or by pasting the invitation code. After the code is validated
   a welcome screen appears and the vendor ONLY SETS A PASSWORD — saving activates the
   account and moves the vendor to Responded (RSPND). All company data is completed later,
   after sign-in, through the profile wizard (save as draft = DRFT, submit = SBMIT). */

export function VwPasswordRuleList({ password, policy }) {
  const C = useC();
  const tt = useTT();
  const checks = VwPwdChecks(password, policy, tt);
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

function VwRegTopBar({ onBack }) {
  const C = useC();
  const tt = useTT();
  const { theme, setTheme } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <BrandLockup height={28} onDark={C.scheme === "dark"} />
        <span style={{ width: 1, height: 18, backgroundColor: C.border, margin: "0 4px" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textMuted }}>Vendor Workspace · {tt("Registration", "Registrasi")}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconButton name={theme === "dark" ? "moon" : "sun"} variant="secondary" title="Theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
        <Button variant="secondary" size="sm" iconLeft="arrow-left" onClick={onBack}>{tt("Back to sign in", "Kembali ke login")}</Button>
      </div>
    </div>
  );
}

/* ---- token gate ---- */
function VwRegGate({ onValid, onBack, initialToken }) {
  const C = useC();
  const tt = useTT();
  const [code, setCode] = React.useState(initialToken || "");
  const [state, setState] = React.useState("idle"); // idle | checking | error
  const [reason, setReason] = React.useState(null);  // expired | revoked | used | invalid
  const attempted = React.useRef(false);

  const validate = React.useCallback((raw) => {
    setState("checking"); setReason(null);
    VwApiValidateInvite(raw)
      .then((result) => {
        if (!result.isValid || !result.invitation) {
          setState("error");
          setReason(result.failureReason || "invalid");
          return;
        }

        onValid({ ...result.invitation, token: VwNormalizeToken(raw) });
      })
      .catch((error) => {
        const reason = error && error.payload && error.payload.failureReason ? error.payload.failureReason : "invalid";
        setState("error");
        setReason(reason);
      });
  }, [onValid]);

  React.useEffect(() => {
    if (initialToken && !attempted.current) { attempted.current = true; validate(initialToken); }
  }, [initialToken, validate]);

  const msg = {
    invalid: tt("That invitation code was not recognised. Check the code or contact Alamtri Procurement.", "Kode undangan tidak dikenali. Periksa kembali kode atau hubungi Procurement Alamtri."),
    expired: tt("This invitation has expired. Please ask Alamtri Procurement to resend it.", "Undangan ini sudah kedaluwarsa. Mohon minta Procurement Alamtri mengirim ulang."),
    revoked: tt("This invitation was revoked and can no longer be used.", "Undangan ini telah dicabut dan tidak dapat digunakan lagi."),
    used: tt("This invitation has already been used to register.", "Undangan ini sudah pernah dipakai untuk mendaftar."),
  };

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "56px 0" }}>
      <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="ticket" size={26} /></div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Register with invitation", "Daftar dengan undangan")}</h2>
      <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 8, lineHeight: 1.55 }}>{tt("Registration is by invitation only. Enter the invitation code from your email to begin.", "Registrasi hanya melalui undangan. Masukkan kode undangan dari email Anda untuk memulai.")}</p>

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Invitation code", "Kode undangan")} status={state === "error" ? "error" : "default"}>
          <TextInput iconLeft="ticket" value={code} status={state === "error" ? "error" : "default"}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); if (state === "error") setState("idle"); }}
            placeholder="VW-XXXX-XXXX" />
        </Field>
        {state === "error" && <Alert tone="error" title={tt("Cannot use this invitation", "Tidak dapat menggunakan undangan")} description={msg[reason]} />}
        <Button size="lg" fullWidth disabled={state === "checking" || !code.trim()} iconRight={state === "checking" ? undefined : "arrow-right"} onClick={() => validate(code)}>
          {state === "checking" ? <Spinner size={16} color="#fff" /> : tt("Continue", "Lanjutkan")}
        </Button>
        <button onClick={onBack} style={{ ...FONT, background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, fontWeight: 600 }}>{tt("I don't have an invitation", "Saya tidak punya undangan")}</button>
      </div>

      <div style={{ marginTop: 26, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: C.surfaceInset, border: `1px solid ${C.borderSoft}`, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
        <b style={{ color: C.text }}>{tt("Invitation only", "Khusus undangan")}:</b> {tt("Use the invitation code from the Alamtri Procurement email you received.", "Gunakan kode undangan dari email Alamtri Procurement yang Anda terima.")}
      </div>
    </div>
  );
}

/* ---- welcome + set password (the ONLY registration input, mirroring the legacy flow) ---- */
function VwRegSetPassword({ invite, onDone }) {
  const C = useC();
  const tt = useTT();
  const [pwd, setPwd] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [policy, setPolicy] = React.useState(VW_DEFAULT_PWD_POLICY);
  React.useEffect(() => { VwApiPasswordPolicy().then(setPolicy); }, []);

  const pwdValid = VwPwdValid(pwd, policy);
  const canSave = pwdValid && confirm === pwd && !saving;

  const save = (e) => {
    e && e.preventDefault();
    if (!canSave) return;
    setErr(""); setSaving(true);
    VwApiRegisterVendor({ invitationCode: invite.token, password: pwd })
      .then(() => onDone())
      .catch((error) => setErr(error.message || tt("Registration failed.", "Registrasi gagal.")))
      .finally(() => setSaving(false));
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 0" }}>
      {/* welcome text */}
      <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: C.successBg, color: C.success, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="hand-heart" size={26} /></div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>
        {tt("Welcome, ", "Selamat datang, ")}{invite.pic || invite.company}!
      </h2>
      <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 8, lineHeight: 1.6 }}>
        <b style={{ color: C.text }}>{invite.company}</b>{tt(" has been invited to register as an Alamtri vendor. Set a password for your account to get started — you can complete your company profile after signing in.",
          " diundang untuk terdaftar sebagai vendor Alamtri. Buat kata sandi untuk akun Anda terlebih dahulu — data perusahaan dapat dilengkapi setelah masuk.")}
      </p>

      <form onSubmit={save} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={tt("Email (locked to invitation)", "Email (terkunci ke undangan)")}>
          <TextInput iconLeft="mail" value={invite.email} disabled />
        </Field>
        <Field label={tt("Create password", "Buat kata sandi")}>
          <TextInput iconLeft="lock" type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)}
            placeholder={tt("Minimum 12 characters", "Minimal 12 karakter")}
            iconRight={<button type="button" onClick={() => setShow((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 0 }}><Icon name={show ? "eye-off" : "eye"} size={16} /></button>} />
        </Field>
        <VwPasswordRuleList password={pwd} policy={policy} />
        <Field label={tt("Confirm password", "Konfirmasi sandi")} status={confirm && confirm !== pwd ? "error" : "default"} helper={confirm && confirm !== pwd ? tt("Passwords don't match", "Sandi tidak cocok") : null}>
          <TextInput iconLeft="lock" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {err && <Alert tone="error" title={err} />}
        <Button type="submit" size="lg" fullWidth disabled={!canSave} iconLeft={saving ? undefined : "save"}>
          {saving ? <Spinner size={16} color="#fff" /> : tt("Save", "Simpan")}
        </Button>
      </form>

      <div style={{ marginTop: 22, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: C.surfaceInset, border: `1px solid ${C.borderSoft}`, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
        {tt("After saving, your registration status becomes ", "Setelah disimpan, status registrasi Anda menjadi ")}
        <b style={{ color: C.text }}>Responded</b>
        {tt(". Sign in with your new password to view your profile and complete your company data — save it as a draft anytime, then submit it for review when ready.",
            ". Masuk dengan kata sandi baru Anda untuk melihat profil dan melengkapi data perusahaan — bisa disimpan sebagai draf kapan pun, lalu kirim untuk direview jika sudah siap.")}
      </div>
    </div>
  );
}

function VendorRegister({ onBack, onDone, initialToken }) {
  const C = useC();
  const tt = useTT();
  const [invite, setInvite] = React.useState(null);
  const [done, setDone] = React.useState(false);

  // submitted → success
  if (done) {
    return (
      <div style={{ ...FONT, minHeight: "100vh", backgroundColor: C.bg, display: "flex", flexDirection: "column" }}>
        <VwRegTopBar onBack={onBack} />
        <div style={{ flex: 1, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: C.successBg, color: C.success, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><Icon name="circle-check" size={34} /></div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{tt("Account activated", "Akun aktif")}</h2>
            <p style={{ fontSize: 14, color: C.textMuted, marginTop: 10, lineHeight: 1.6 }}>
              {tt("Thank you, ", "Terima kasih, ")}<b style={{ color: C.text }}>{invite ? invite.company : ""}</b>.{" "}
              {tt("Your password is set and your status is now Responded. Sign in with ", "Kata sandi Anda sudah dibuat dan status Anda kini Responded. Masuk dengan ")}
              <b style={{ color: C.text }}>{invite ? invite.email : ""}</b>{tt(" to complete your company profile.", " untuk melengkapi profil perusahaan Anda.")}
            </p>
            <div style={{ marginTop: 22 }}><Button size="lg" iconLeft="log-in" onClick={onDone}>{tt("Go to sign in", "Ke halaman login")}</Button></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...FONT, minHeight: "100vh", backgroundColor: C.bg, display: "flex", flexDirection: "column" }}>
      <VwRegTopBar onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
        {!invite
          ? <VwRegGate onValid={setInvite} onBack={onBack} initialToken={initialToken} />
          : <VwRegSetPassword invite={invite} onDone={() => setDone(true)} />}
      </div>
    </div>
  );
}

export { VendorRegister };
Object.assign(window, { VendorRegister, VwPasswordRuleList });
