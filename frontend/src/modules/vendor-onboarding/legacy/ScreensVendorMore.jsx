/* fm3-converted */
import React from "react";
import { ONBOARD_STATUS, VwAddDays, VwApiCreateInvite, VwApiListInvites, VwApiReissueInvite, VwApiRevokeInvite, VwDaysUntil, VwEffectiveStatus, VwTodayStr } from "../../vendor-workspace/legacy/VendorOnboardingData.jsx";
import { usePageSearch } from "../../../platform/search/legacy/Search.jsx";
import { useSession } from "../../../platform/session/legacy/Session.jsx";
import { useSettings } from "../../../platform/settings/legacy/SettingsStore.jsx";
import { Avatar, Badge, Button, Card, Field, Icon, IconButton, MetricCard, Select, TextInput, Textarea } from "../../../shared/legacy/Primitives.jsx";
import { Alert, DataTable, Menu, MenuDivider, MenuItem, Modal, PageHeader, Pagination, SegmentedControl, Spinner, Toolbar, fmtAppDate, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import { RADIUS, useC } from "../../../shared/legacy/Tokens.jsx";
import { useTT } from "../../../shared/legacy/i18n.jsx";
/* Alamtri Geo Admin - Vendor module screens.
   This file now exposes invite-only vendor onboarding only. */
/* ============================================================
   VENDOR INVITATION — invite NEW vendors to register (onboarding).
   Invite-only: procurement issues a tokenised invitation; the vendor
   redeems the token on the pre-login registration screen. Token lifecycle
   and persistence live in VendorOnboardingData.jsx.
   ============================================================ */

/* days-left pill for an invitation expiry */
function VInvExpiryChip({ inv }) {
  const tt = useTT();
  const eff = VwEffectiveStatus(inv);
  if (eff === "REGISTERED") return <Badge tone="success">{tt("Done", "Selesai")}</Badge>;
  if (eff === "REVOKED") return <Badge tone="neutral">{tt("Revoked", "Dicabut")}</Badge>;
  const d = VwDaysUntil(inv.expiresAt);
  if (d < 0) return <Badge tone="warning">{tt("Expired", "Kedaluwarsa")}</Badge>;
  if (d === 0) return <Badge tone="warning">{tt("Expires today", "Berakhir hari ini")}</Badge>;
  return <Badge tone={d <= 3 ? "warning" : "neutral"}>{d} {tt("days left", "hari lagi")}</Badge>;
}

function VendorInvitation() {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const session = useSession();
  const { s } = useSettings(); // procurement contact address is configured in Settings, not hardcoded
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [statusF, setStatusF] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const ps = usePageSearch(tt("Search company or email…", "Cari perusahaan atau email…"));
  const q = ps.query, setQ = ps.setQuery;
  const [detail, setDetail] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    VwApiListInvites()
      .then((items) => { if (!cancelled) setRows(items); })
      .catch((error) => {
        console.warn("Vendor invitation API unavailable.", error);
        if (!cancelled) setRows([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totals = React.useMemo(() => {
    let awaiting = 0, registered = 0, lapsed = 0;
    rows.forEach((inv) => {
      const s = VwEffectiveStatus(inv);
      if (s === "SENT" || s === "OPENED") awaiting++;
      else if (s === "REGISTERED") registered++;
      else if (s === "EXPIRED" || s === "REVOKED") lapsed++;
    });
    return { total: rows.length, awaiting, registered, lapsed };
  }, [rows]);

  const ql = q.trim().toLowerCase();
  const filtered = rows
    .filter((inv) => statusF === "all" || VwEffectiveStatus(inv) === statusF)
    .filter((inv) => !ql || [inv.company, inv.email, inv.pic, inv.category, inv.token].some((s) => String(s).toLowerCase().includes(ql)))
    .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => { setPage(1); }, [q, statusF, pageSize]);
  React.useEffect(() => { if (page > pageCount) setPage(1); }, [page, pageCount]);

  const resend = (inv) => {
    VwApiReissueInvite(inv.id)
      .then((result) => {
        setRows((current) => current.map((x) => x.id === inv.id ? result.invite : x));
        setDetail((current) => current && current.id === inv.id ? result.invite : current);
        session.record({ action: "Notify", module: "Vendor Invitation", desc: `Resent registration invite ${inv.id} — ${inv.company}`, tone: "brand" });
        // The invitation email (ET-12) is sent + logged server-side by the resend endpoint; no client-side send.
        toast.push({ title: tt("Invitation resent", "Undangan dikirim ulang"), description: `${inv.company} · ${inv.email}` });
      })
      .catch((error) => {
        toast.push({ title: tt("Resend failed", "Kirim ulang gagal"), description: error.message, tone: "error" });
      });
  };
  const revoke = (inv) => {
    VwApiRevokeInvite(inv.id)
      .then((nextInvite) => {
        setRows((current) => current.map((x) => x.id === inv.id ? nextInvite : x));
        setDetail((current) => current && current.id === inv.id ? nextInvite : current);
        session.record({ action: "Update", module: "Vendor Invitation", desc: `Revoked registration invite ${inv.id} — ${inv.company}`, tone: "danger" });
        toast.push({ title: tt("Invitation revoked", "Undangan dicabut"), description: inv.company, tone: "info" });
      })
      .catch((error) => {
        toast.push({ title: tt("Revoke failed", "Cabut undangan gagal"), description: error.message, tone: "error" });
      });
  };
  const copyLink = (inv) => {
    const registrationUrl = inv.registrationUrl;
    if (registrationUrl) {
      try { navigator.clipboard && navigator.clipboard.writeText(registrationUrl); } catch (e) {}
      toast.push({ title: tt("Registration link copied", "Link registrasi disalin"), description: `${tt("Code", "Kode")}: ${inv.token}` });
      return;
    }

    VwApiReissueInvite(inv.id)
      .then((result) => {
        setRows((current) => current.map((x) => x.id === inv.id ? result.invite : x));
        setDetail((current) => current && current.id === inv.id ? result.invite : current);
        try { navigator.clipboard && navigator.clipboard.writeText(result.registrationUrl); } catch (e) {}
        toast.push({ title: tt("Fresh registration link copied", "Link registrasi baru disalin"), description: `${tt("Code", "Kode")}: ${result.invitationCode}` });
      })
      .catch((error) => {
        toast.push({ title: tt("Copy link failed", "Salin link gagal"), description: error.message, tone: "error" });
      });
  };
  const createInvite = (form) => {
    return VwApiCreateInvite({
      email: form.email,
      vendorName: form.company,
      picName: form.pic,
      // Expiry counts from the actual current date (not the mockup's frozen date).
      expiredAt: `${VwAddDays(VwTodayStr(), Number(form.expiryDays) || 14)}T23:59:59+07:00`,
      note: form.note || null,
    })
      .then((result) => {
        setRows((current) => [result.invite, ...current]);
        session.record({ action: "Create", module: "Vendor Invitation", desc: `Invited ${result.invite.company} (${result.invite.email}) to register — ${result.invitationCode}`, tone: "success" });
        // The invitation email (ET-12) is sent + logged server-side by the create endpoint; no client-side send.
        toast.push({ title: tt("Invitation sent", "Undangan terkirim"), description: `${result.invite.company} · ${result.invite.email}${result.invite.vendorId ? ` · ${result.invite.vendorId}` : ""}` });
        setCreateOpen(false);
        setDetail(result.invite);
      })
      .catch((error) => {
        const code = error.payload && error.payload.code;
        if (code === "internal_email_not_allowed") {
          toast.push({
            tone: "error",
            title: tt("Internal company emails (saptaindra.co.id / alamtri.com) cannot be invited.",
                      "Email internal (saptaindra.co.id / alamtri.com) tidak boleh diundang."),
          });
          return;
        }
        if (code === "active_invitation_exists") {
          toast.push({
            tone: "error",
            title: tt("An invitation was already sent to this email.", "Undangan untuk email ini sudah dikirim."),
            description: tt("Open the invitation in the list and use Resend.", "Buka undangan di daftar lalu pilih Kirim ulang."),
          });
          return;
        }
        if (code === "email_registered") {
          toast.push({
            tone: "error",
            title: tt("This email already belongs to a registered vendor account.", "Email ini sudah dipakai akun vendor yang sudah daftar."),
            description: tt("Vendors that already set a password cannot be invited again.", "Vendor yang sudah membuat password tidak bisa diundang lagi."),
          });
          return;
        }
        toast.push({ title: tt("Invitation failed", "Undangan gagal"), description: error.message, tone: "error" });
      });
  };

  const stOf = (inv) => ONBOARD_STATUS[VwEffectiveStatus(inv)] || ONBOARD_STATUS.SENT;
  const columns = [
    { key: "company", label: tt("Vendor", "Vendor"), width: 310, render: (inv) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar name={inv.company.replace(/^(PT|CV)\s+/i, "")} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: C.text, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.company}</div>
          {inv.category ? <div style={{ fontSize: 11.5, color: C.textMuted }}>{inv.category}</div> : null}
        </div>
      </div>) },
    { key: "email", label: tt("Invited contact", "Kontak diundang"), render: (inv) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
        <div style={{ fontSize: 11.5, color: C.textMuted }}>{inv.pic}</div>
      </div>) },
    { key: "token", label: tt("Invitation code", "Kode undangan"), width: 150, render: (inv) => (
      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.ocean }}>{inv.token}</span>) },
    { key: "expiry", label: tt("Expiry", "Berlaku s/d"), width: 150, render: (inv) => (
      <div><div style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{fmtAppDate(inv.expiresAt)}</div><div style={{ marginTop: 3 }}><VInvExpiryChip inv={inv} /></div></div>) },
    { key: "status", label: tt("Status", "Status"), width: 130, render: (inv) => <Badge tone={stOf(inv).tone} dot>{tt(stOf(inv).en, stOf(inv).id)}</Badge> },
    { key: "_a", label: "", align: "right", width: 56, render: (inv) => {
      const eff = VwEffectiveStatus(inv);
      const active = eff === "SENT" || eff === "OPENED" || eff === "EXPIRED";
      return (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu align="right" width={210} trigger={<IconButton name="more-horizontal" size="sm" />}>
          <MenuItem icon="eye" label={tt("View detail", "Lihat detail")} onClick={() => setDetail(inv)} />
          {active && <MenuItem icon="link" label={inv.registrationUrl ? tt("Copy register link", "Salin link registrasi") : tt("Generate new link", "Buat link baru")} onClick={() => copyLink(inv)} />}
          {active && <MenuItem icon="send" label={tt("Resend invitation", "Kirim ulang")} onClick={() => resend(inv)} />}
          {(eff === "SENT" || eff === "OPENED") && <><MenuDivider /><MenuItem icon="ban" label={tt("Revoke invitation", "Cabut undangan")} danger onClick={() => revoke(inv)} /></>}
        </Menu>
      </div>); } },
  ];

  return (
    <div>
      <PageHeader title={tt("Vendor Invitation", "Undangan Vendor")}
        description={tt("Invite new vendors to register. Sending an invitation creates the vendor in Vendor Database as Invited. Only vendors holding a valid invitation can complete registration.",
          "Undang vendor baru untuk mendaftar. Mengirim undangan langsung membuat vendor di Vendor Database berstatus Invited. Hanya vendor dengan undangan yang sah yang dapat menyelesaikan registrasi.")}
        actions={<Button iconLeft="user-plus" onClick={() => setCreateOpen(true)}>{tt("Invite vendor", "Undang vendor")}</Button>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }} className="ag-holiday-stats">
        <MetricCard label={tt("Total invitations", "Total undangan")} value={totals.total} icon="mail" iconTone="brand" />
        <MetricCard label={tt("Awaiting registration", "Menunggu registrasi")} value={totals.awaiting} icon="hourglass" iconTone="orange" />
        <MetricCard label={tt("Registered", "Sudah daftar")} value={totals.registered} icon="user-check" iconTone="forest" />
        <MetricCard label={tt("Expired / revoked", "Kedaluwarsa / dicabut")} value={totals.lapsed} icon="ban" iconTone="blue" />
      </div>

      <Card pad={0}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Toolbar style={{ margin: 0 }}
            left={<SegmentedControl size="sm" value={statusF} onChange={setStatusF}
              options={[{ value: "all", label: tt("All", "Semua") }, { value: "SENT", label: tt("Sent", "Terkirim") }, { value: "OPENED", label: tt("Opened", "Dibuka") }, { value: "REGISTERED", label: tt("Registered", "Terdaftar") }, { value: "EXPIRED", label: tt("Expired", "Kedaluwarsa") }]} />}
            right={<div ref={ps.ref} style={{ width: 250 }}><TextInput iconLeft="search" placeholder={tt("Search company or email…", "Cari perusahaan atau email…")} value={q} onChange={(e) => setQ(e.target.value)} inputRef={ps.inputRef} onFocus={ps.onFocus} onBlur={ps.onBlur} /></div>} />
        </div>
        <DataTable columns={columns} data={pageRows} dense rowKey="id" onRowClick={(inv) => setDetail(inv)}
          loading={loading}
          emptyTitle={tt("No invitations", "Tidak ada undangan")} emptyDesc={tt("Invite a vendor to start the onboarding.", "Undang vendor untuk memulai onboarding.")} />
        <div style={{ padding: "4px 16px 12px" }}>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </div>
      </Card>

      <VInvDetail inv={detail} onClose={() => setDetail(null)} onResend={resend} onRevoke={revoke} onCopy={copyLink} />
      <VInvCreate open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createInvite} />
    </div>
  );
}

/* detail modal — invitation summary + registration link + lifecycle actions */
function VInvDetail({ inv, onClose, onResend, onRevoke, onCopy }) {
  const C = useC();
  const tt = useTT();
  if (!inv) return null;
  const eff = VwEffectiveStatus(inv);
  const sti = ONBOARD_STATUS[eff];
  const active = eff === "SENT" || eff === "OPENED" || eff === "EXPIRED";
  const hasFreshRegistrationLink = !!inv.registrationUrl;
  const effectiveLink = hasFreshRegistrationLink
    ? inv.registrationUrl
    : tt("Use resend to generate a fresh registration link.", "Gunakan kirim ulang untuk membuat link registrasi baru.");
  const displayedCode = hasFreshRegistrationLink ? inv.token : (inv.codeMasked || inv.token);
  const stat = (label, value) => (
    <div><div style={{ fontSize: 11, color: C.textSubtle, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div><div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 2 }}>{value}</div></div>
  );
  return (
    <Modal open={!!inv} onClose={onClose} width={580} icon="user-plus" title={inv.company} subtitle={inv.category ? `${inv.id} · ${inv.category}` : `${inv.id}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tt("Close", "Tutup")}</Button>
        {active && <Button variant="secondary" iconLeft="send" onClick={() => onResend(inv)}>{tt("Resend", "Kirim ulang")}</Button>}
        {(eff === "SENT" || eff === "OPENED") && <Button iconLeft="ban" onClick={() => { onRevoke(inv); onClose(); }}>{tt("Revoke", "Cabut")}</Button>}
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, padding: "12px 14px", borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, border: `1px solid ${C.borderSoft}` }}>
          {stat(tt("Invited by", "Diundang oleh"), inv.invitedBy)}
          {stat(tt("Sent", "Dikirim"), fmtAppDate(inv.sentAt))}
          {stat(tt("Expires", "Berlaku s/d"), fmtAppDate(inv.expiresAt))}
          {stat(tt("Vendor", "Vendor"), inv.vendorId || "—")}
          {stat(tt("Status", "Status"), <Badge tone={sti.tone} dot>{tt(sti.en, sti.id)}</Badge>)}
        </div>

        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>{tt("Invited contact", "Kontak diundang")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={inv.pic} size={34} />
            <div><div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{inv.pic}</div><div style={{ fontSize: 12, color: C.textMuted }}>{inv.email}</div></div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>{tt("Registration link", "Link registrasi")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, backgroundColor: C.surfaceInset }}>
            <Icon name="link" size={15} color={C.textMuted} />
            <div style={{ flex: 1, minWidth: 0, fontFamily: "monospace", fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{effectiveLink}</div>
            <Button variant="ghost" size="xs" iconLeft="link" onClick={() => onCopy(inv)}>{hasFreshRegistrationLink ? tt("Copy", "Salin") : tt("Generate", "Buat")}</Button>
          </div>
          {hasFreshRegistrationLink ? (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
              {tt("Invitation code", "Kode undangan")}: <b style={{ fontFamily: "monospace", color: C.ocean }}>{displayedCode}</b> — {tt("the vendor can paste this on the registration screen.", "vendor dapat menempelkan kode ini di layar registrasi.")}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
              {tt("Stored code", "Kode tersimpan")}: <b style={{ fontFamily: "monospace", color: C.ocean }}>{displayedCode}</b> — {tt("only the masked code is retained after send. Generate a fresh link to share a valid registration URL again.", "setelah pengiriman hanya kode tersamar yang disimpan. Buat link baru untuk membagikan URL registrasi yang valid lagi.")}
            </div>
          )}
        </div>

        {inv.note && <Alert tone="info" title={tt("Note", "Catatan")} description={inv.note} />}
      </div>
    </Modal>
  );
}

/* create modal — issue a registration invitation to a new vendor */
function VInvCreate({ open, onClose, onCreate }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const blank = { company: "", pic: "", email: "", expiryDays: "14", note: "" };
  const [form, setForm] = React.useState(blank);
  const [sending, setSending] = React.useState(false);
  const picRef = React.useRef(null);
  const emailRef = React.useRef(null);
  const companyRef = React.useRef(null);
  React.useEffect(() => { if (open) { setForm(blank); setSending(false); } }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: (k === "pic" || k === "company") && typeof v === "string" ? v.toUpperCase() : v }));
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fail = (msg, ref) => { toast.push({ title: msg, tone: "error" }); if (ref && ref.current) ref.current.focus(); };
  const isInternalCompanyEmail = (email) => {
    const at = email.lastIndexOf("@");
    if (at < 0 || at === email.length - 1) return false;
    const domain = email.slice(at + 1).trim().toLowerCase();
    return ["saptaindra.co.id", "alamtri.com"].some((blocked) => domain === blocked || domain.endsWith("." + blocked));
  };
  const submit = () => {
    if (!form.pic.trim()) return fail(tt("Enter the contact person.", "Masukkan nama PIC."), picRef);
    if (!emailRe.test(form.email.trim())) return fail(tt("Enter a valid contact email.", "Masukkan email kontak yang valid."), emailRef);
    if (isInternalCompanyEmail(form.email.trim())) return fail(tt("Internal company emails (saptaindra.co.id / alamtri.com) cannot be invited.", "Email internal (saptaindra.co.id / alamtri.com) tidak boleh diundang."), emailRef);
    if (!form.company.trim()) return fail(tt("Enter the company name.", "Masukkan nama perusahaan."), companyRef);
    setSending(true);
    Promise.resolve(onCreate({ company: form.company.trim().toUpperCase(), pic: form.pic.trim().toUpperCase(), email: form.email.trim().toLowerCase(), expiryDays: form.expiryDays, note: form.note.trim() }))
      .finally(() => setSending(false));
  };
  return (
    <Modal open={open} onClose={onClose} width={560} icon="user-plus" title={tt("Invite vendor to register", "Undang vendor untuk daftar")} subtitle={tt("A tokenised invitation will be emailed to the contact", "Undangan bertoken akan dikirim ke email kontak")}
      footer={<><Button variant="secondary" disabled={sending} onClick={onClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft={sending ? undefined : "send"} disabled={sending} onClick={submit}>{sending ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Spinner size={15} color="#fff" />{tt("Sending…", "Mengirim…")}</span> : tt("Send invitation", "Kirim undangan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={tt("Contact person", "Nama PIC")} required>
            <TextInput inputRef={picRef} value={form.pic} onChange={(e) => set("pic", e.target.value)} iconLeft="user" placeholder={tt("e.g. BUDI HARTONO", "mis. BUDI HARTONO")} style={{ textTransform: "uppercase" }} />
          </Field>
          <Field label={tt("Contact email", "Email kontak")} required>
            <TextInput inputRef={emailRef} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} iconLeft="mail" placeholder="vendor@email.com" />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <Field label={tt("Company name", "Nama perusahaan")} required>
            <TextInput inputRef={companyRef} value={form.company} onChange={(e) => set("company", e.target.value)} iconLeft="building-2" placeholder={tt("e.g. PT SUMBER MAKMUR", "mis. PT SUMBER MAKMUR")} style={{ textTransform: "uppercase" }} />
          </Field>
          <Field label={tt("Link valid for", "Berlaku selama")}>
            <Select value={form.expiryDays} onChange={(e) => set("expiryDays", e.target.value)} options={[{ value: "7", label: "7 " + tt("days", "hari") }, { value: "14", label: "14 " + tt("days", "hari") }, { value: "30", label: "30 " + tt("days", "hari") }]} />
          </Field>
        </div>
        <Field label={tt("Note (optional)", "Catatan (opsional)")}>
          <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} style={{ minHeight: 56 }} placeholder={tt("Internal note about this invitation…", "Catatan internal tentang undangan ini…")} />
        </Field>
        <Alert tone="info" title={tt("Invite-only registration", "Registrasi khusus undangan")} description={tt("Sending this invitation creates the vendor in Vendor Database as Invited, with a passwordless PIC account. The contact receives a one-time link + code. Revoking the invitation keeps the vendor; a later invite to the same email reuses that vendor.", "Mengirim undangan ini membuat vendor di Vendor Database berstatus Invited, dengan akun PIC tanpa password. Kontak menerima link + kode sekali pakai. Mencabut undangan tidak menghapus vendor; undangan berikutnya ke email yang sama memakai vendor itu lagi.")} />
      </div>
    </Modal>
  );
}

Object.assign(window, { VendorInvitation });
export { VendorInvitation };
