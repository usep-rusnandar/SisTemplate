/* fm2-converted */
import React from "react";
import { RADIUS, FONT, useC } from "../../../shared/legacy/Tokens.jsx";
import { useI18n } from "../../../shared/legacy/i18n.jsx";
import { Icon, Button, Badge, Card, TextInput, Field, Checkbox, Radio, Toggle } from "../../../shared/legacy/Primitives.jsx";
import { useToast, OpsPage, OpsHero, OpsHeroButton } from "../../../shared/legacy/PrimitivesX.jsx";
import { EMAIL_SENDER_MODULES } from "../../data/legacy/Data.jsx";
import { useSettings, persistableSettings } from "./SettingsStore.jsx";
/* Alamtri Geo Admin — Settings: side-nav + Email / Security / General multi-card forms. */

/* Who a setting applies to: "vendor" = Vendor Workspace accounts only; "all" = vendor and internal users. */
function ScopeBadge({ scope }) {
  const vendor = scope === "vendor";
  return (
    <Badge tone={vendor ? "info" : "neutral"} size="sm">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <Icon name={vendor ? "store" : "users"} size={12} />
        {vendor ? "Applies to vendors only" : "Applies to vendors & internal users"}
      </span>
    </Badge>
  );
}
function SettingCard({ eyebrow, title, desc, scope, children }) {
  const C = useC();
  const hasHeader = eyebrow || scope;
  return (
    <div style={{ ...FONT, backgroundColor: C.surface, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS.lg, boxShadow: C.cardShadow, padding: 20, marginBottom: 16 }}>
      {hasHeader && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          {eyebrow ? <Badge tone="orange" size="sm">{eyebrow}</Badge> : <span />}
          {scope && <ScopeBadge scope={scope} />}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: hasHeader ? 10 : 0 }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 3, lineHeight: 1.5 }}>{desc}</div>}
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}
function Row2({ children }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>{children}</div>; }

function Settings() {
  const C = useC();
  const { t } = useI18n();
  const toast = useToast();
  const [tab, setTab] = React.useState("email");
  const { s, set } = useSettings();
  const save = () => {
    fetch("/api/v1/super-admin/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: persistableSettings(s) }),
    }).then((response) => {
      if (response.ok) toast.push({ title: "Settings saved", description: "Your configuration has been applied." });
      else toast.push({ tone: "error", title: "Save failed", description: "Settings were not stored. Try again." });
    }).catch(() => toast.push({ tone: "error", title: "Save failed", description: "Backend unavailable." }));
  };

  const navItems = [
    { id: "email", icon: "mail", label: "Email", desc: "SMTP & delivery" },
    { id: "security", icon: "shield", label: "Security", desc: "Auth & sessions" },
    { id: "general", icon: "sliders-horizontal", label: "General", desc: "Retention & data" },
  ];

  return (
    <OpsPage>
      <OpsHero kicker="Super Admin" kickerIcon="crown" title={t("nav.settings")} subtitle="System, security, and email configuration for the platform." compact
        right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <OpsHeroButton variant="secondary" iconLeft="rotate-ccw">{t("act.reset")}</OpsHeroButton>
          <OpsHeroButton variant="primary" iconLeft="save" onClick={save}>{t("act.save")}</OpsHeroButton>
        </div>} />

      <div style={{ display: "grid", gridTemplateColumns: "224px 1fr", gap: 20, alignItems: "start" }} className="ag-rp-grid">
        <Card pad={6} style={{ position: "sticky", top: 88 }}>
          {navItems.map((n) => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} style={{ ...FONT, display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 12px", border: "none", textAlign: "left",
                backgroundColor: active ? C.active : "transparent", borderRadius: RADIUS.md, cursor: "pointer", marginBottom: 2 }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = C.hover; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                <span style={{ width: 32, height: 32, borderRadius: RADIUS.md, flexShrink: 0, backgroundColor: active ? C.brandBg : C.surfaceAlt, color: active ? C.ocean : C.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={n.icon} size={16} /></span>
                <span><span style={{ display: "block", fontSize: 13, fontWeight: active ? 700 : 600, color: C.text }}>{n.label}</span>
                  <span style={{ display: "block", fontSize: 11, color: C.textMuted }}>{n.desc}</span></span>
              </button>
            );
          })}
        </Card>

        <div style={{ minWidth: 0 }}>
          {tab === "email" && (
            <SettingCard eyebrow="Email settings" title="SMTP & delivery" scope="all" desc="Configure the outbound mail server used for transactional emails.">
              <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>Delivery mode</span>
                <Radio checked={(s.emailMode || "api") === "api"} onChange={() => set("emailMode", "api")} label="Via API (Base URL)" />
                <Radio checked={s.emailMode === "smtp"} onChange={() => set("emailMode", "smtp")} label="Via SMTP server" />
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 14 }}>SMTP delivery only works when the app runs on the server network; use the API gateway from local machines.</div>
              <Field label="Base URL" style={{ marginBottom: 16 }}><TextInput value={s.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} /></Field>
              <Row2>
                <Field label="SMTP server"><TextInput value={s.smtp} onChange={(e) => set("smtp", e.target.value)} /></Field>
                <Field label="Port"><TextInput value={s.port} onChange={(e) => set("port", e.target.value)} /></Field>
              </Row2>
              <div style={{ marginBottom: 16 }}><Checkbox checked={s.smtpAuth} onChange={(v) => set("smtpAuth", v)} label="Requires authentication" /></div>
              <Row2>
                <Field label="Login (email)"><TextInput value={s.login} onChange={(e) => set("login", e.target.value)} placeholder="smtp-user@saptaindra.co.id" disabled={!s.smtpAuth} /></Field>
                <Field label="Password"><TextInput type="password" value={s.pwd} onChange={(e) => set("pwd", e.target.value)} placeholder="••••••••" disabled={!s.smtpAuth} /></Field>
              </Row2>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: -8, marginBottom: 16 }}>Required when authentication is enabled.</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 10px" }}>Sender per module — From, mailbox name, and To (test) for each module</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 14 }}>When To (test) is filled for a module, outbound mail from that module is redirected there. Leave it blank to send to the real recipient — an empty field does not reuse a previous test address. Use Send test on each row to verify that module sender.</div>
              {EMAIL_SENDER_MODULES.map((m) => (
                <div key={m.key} style={{ marginBottom: 18, paddingBottom: 16, borderBottom: `1px solid ${C.borderSoft}` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>{m.label}</div>
                  <Row2>
                    <Field label="From"><TextInput value={s["from_" + m.key] || ""} onChange={(e) => set("from_" + m.key, e.target.value)} iconLeft="mail" placeholder="module@saptaindra.co.id" /></Field>
                    <Field label="Mailbox name"><TextInput value={s["mailbox_" + m.key] || ""} onChange={(e) => set("mailbox_" + m.key, e.target.value)} placeholder={`SIS – ${m.label}`} /></Field>
                  </Row2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
                    <Field label="To (test)"><TextInput value={s["toTest_" + m.key] || ""} onChange={(e) => set("toTest_" + m.key, e.target.value)} placeholder="(blank = real recipient)" /></Field>
                    <Button variant="secondary" size="sm" iconLeft="send" style={{ marginBottom: 2 }} onClick={() => {
                      fetch("/api/v1/super-admin/settings/test-email", {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json", Accept: "application/json" },
                        body: JSON.stringify({ module: m.key }),
                      })
                        .then(async (r) => {
                          const data = await r.json().catch(() => null);
                          if (r.ok && data && data.delivered) toast.push({ title: "Test email sent", description: `${m.label} → ${data.to}.` });
                          else if (r.ok) toast.push({ tone: "error", title: "Not delivered", description: `The mail relay did not accept it${data && data.to ? ` (to ${data.to})` : ""}. Check the Email Sent log.` });
                          else toast.push({ tone: "error", title: "Send failed", description: (data && data.message) || `Fill To (test) for ${m.label} and Save first.` });
                        })
                        .catch(() => toast.push({ tone: "error", title: "Send failed", description: "Backend unavailable." }));
                    }}>Send test</Button>
                  </div>
                </div>
              ))}
              <Row2>
                <Field label="CC"><TextInput value={s.cc} onChange={(e) => set("cc", e.target.value)} /></Field>
                <Field label="BCC"><TextInput value={s.bcc} onChange={(e) => set("bcc", e.target.value)} /></Field>
              </Row2>
              <div style={{ display: "flex", gap: 24, alignItems: "center", marginTop: 4 }}>
                <Radio checked={s.encryption === "ssl"} onChange={() => set("encryption", "ssl")} label="Use SSL" />
                <Radio checked={s.encryption === "tls"} onChange={() => set("encryption", "tls")} label="Use TLS" />
                <Radio checked={s.encryption === "none"} onChange={() => set("encryption", "none")} label="None" />
              </div>
            </SettingCard>
          )}

          {tab === "security" && (<>
            <SettingCard eyebrow="Security settings" title="Password complexity" scope="all" desc="Minimum length and character rules for local passwords. SSO sign-in is not affected.">
              <div style={{ marginBottom: 14 }}><Toggle checked={s.pwdDefault} onChange={(v) => set("pwdDefault", v)} label="Use default settings" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, opacity: s.pwdDefault ? 0.6 : 1, pointerEvents: s.pwdDefault ? "none" : "auto" }}>
                <Checkbox checked={s.reqDigit} onChange={(v) => set("reqDigit", v)} label="Require digit" />
                <Checkbox checked={s.reqLower} onChange={(v) => set("reqLower", v)} label="Require lowercase" />
                <Checkbox checked={s.reqNonAlpha} onChange={(v) => set("reqNonAlpha", v)} label="Require non-alphanumeric" />
                <Checkbox checked={s.reqUpper} onChange={(v) => set("reqUpper", v)} label="Require uppercase" />
              </div>
              <Field label="Required length" helper="Default is 12 characters when the toggle above is on." style={{ maxWidth: 200 }}><TextInput value={s.pwdLen} onChange={(e) => set("pwdLen", e.target.value)} /></Field>
            </SettingCard>
            <SettingCard eyebrow="Security settings" title="User lock out" scope="all" desc="Temporarily lock a local account after repeated failed sign-ins. A Super Admin unlocks an internal account by setting a new password.">
              <div style={{ marginBottom: 16 }}><Checkbox checked={s.lockEnabled} onChange={(v) => set("lockEnabled", v)} label="Enable user account locking on failed login attempts" /></div>
              <Row2>
                <Field label="Maximum failed login attempts before locking" helper="Failed sign-ins before the account is locked."><TextInput value={s.maxAttempts} onChange={(e) => set("maxAttempts", e.target.value)} disabled={!s.lockEnabled} /></Field>
                <Field label="Account locking duration (seconds)" helper="How long the account stays locked."><TextInput value={s.lockDuration} onChange={(e) => set("lockDuration", e.target.value)} disabled={!s.lockEnabled} /></Field>
              </Row2>
            </SettingCard>
            <SettingCard eyebrow="Security settings" title="Session timeout control" scope="all" desc="Automatically end idle sessions and show a lock screen.">
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                <Checkbox checked={s.sessionEnabled} onChange={(v) => set("sessionEnabled", v)} label="Session timeout control enabled" />
                <Checkbox checked={s.lockScreen} onChange={(v) => set("lockScreen", v)} label="Show lock screen when timed out" />
              </div>
              <Row2>
                <Field label="Timeout (seconds)" helper="Idle time before the session locks or signs out."><TextInput value={s.timeout} onChange={(e) => set("timeout", e.target.value)} disabled={!s.sessionEnabled} /></Field>
                <Field label="Countdown modal wait time (seconds)" helper="Warning shown this many seconds before lock."><TextInput value={s.countdown} onChange={(e) => set("countdown", e.target.value)} disabled={!s.sessionEnabled} /></Field>
              </Row2>
            </SettingCard>
            <SettingCard eyebrow="Security settings" title="Login" scope="all" desc="Send a one-time email code after a successful vendor password. SSO sign-in skips this step.">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Checkbox checked={s.emailConfirm} onChange={(v) => set("emailConfirm", v)} label="Email confirmation required for vendor login" />
                <Checkbox checked={s.emailConfirmInternal} onChange={(v) => set("emailConfirmInternal", v)} label="Email confirmation required for internal local login" />
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 12, lineHeight: 1.5 }}>The internal option is saved for a later release and is not used on staff local login yet.</div>
            </SettingCard>
          </>)}

          {tab === "general" && (<>
            <SettingCard eyebrow="General settings" title="Other settings" scope="all" desc="Data retention and automatic cleanup policies.">
              {[
                ["auditDelete", "Enable automatic audit log deletion", "auditDays", "Audit log retention period (days)", "Audit logs older than this period will be automatically deleted from the system."],
                ["notifDelete", "Enable automatic notification deletion", "notifDays", "Notification retention period (days)", "Notifications older than this period will be automatically deleted from the system."],
                ["emailLogDelete", "Enable automatic email sent log deletion", "emailLogDays", "Email sent retention period (days)", "Records of sent emails older than this period will be automatically deleted from the system."],
              ].map(([tk, tl, vk, vl, help], idx) => (
                <div key={tk} style={idx === 0 ? { marginBottom: 4 } : { paddingTop: 16, borderTop: `1px solid ${C.borderSoft}`, marginTop: 16 }}>
                  <div style={{ marginBottom: 12 }}><Checkbox checked={s[tk]} onChange={(v) => set(tk, v)} label={tl} /></div>
                  <Field label={vl} helper={help} style={{ maxWidth: 320, opacity: s[tk] ? 1 : 0.6 }}><TextInput value={s[vk]} onChange={(e) => set(vk, e.target.value)} disabled={!s[tk]} /></Field>
                </div>
              ))}
            </SettingCard>
          </>)}
        </div>
      </div>
    </OpsPage>
  );
}

Object.assign(window, { Settings });
export { Settings };
