# Vendor email parity audit

Audited on 2026-08-03 against the legacy application in
`D:\Projects\SaptaindraSejati\VendorConnect`.

The legacy send sites are:

- `Controllers/Data/Invitation.cs` — vendor invitation.
- `Controllers/Data/Vendor.cs` (`SendEmailAproval`) — approval request, revision, rejection, and approval result.
- `Areas/Identity/Pages/Account/Login*.cshtml.cs` — vendor OTP.
- `Areas/Identity/Pages/Account/ForgotPassword.cshtml.cs` — vendor password reset.

## Parity matrix

| Legacy event | Recipient | Integrated Procurement template | Trigger in the new application |
|---|---|---|---|
| Vendor invitation | Vendor PIC | ET-12 — Vendor registration invitation | Invitation created or resent |
| Vendor login OTP | Vendor user | ET-02 — Vendor login OTP code | OTP-gated sign-in |
| Vendor password reset | Vendor user | ET-20 — Vendor password reset | Forgot-password request |
| Registration submitted | Vendor PIC | ET-13 — Vendor registration received | Profile submitted or resubmitted |
| Approval request | Current approver role | ET-21 — Vendor approval request | Initial submission and intermediate approval |
| Final approval request | Final approver role | ET-22 — Vendor final approval request | Transition into the last approval station |
| Revision required | Vendor PIC | ET-19 — Vendor revision requested | Reviewer requests revision |
| Revised data ready | Vendor Onboarding administrators | ET-23 — Vendor revision resubmitted — administrator | Vendor resubmits after REPIR |
| Registration rejected | Vendor PIC | ET-18 — Vendor registration rejected | Reviewer rejects registration |
| Registration approved | Vendor PIC | ET-17 — Vendor registration approved | Final approval reaches APPRV |
| Approved-vendor notice | Vendor Onboarding administrators | ET-24 — Vendor approved — administrator | Final approval reaches APPRV |

All templates are stored in `core.EMAIL_TEMPLATE_T`, are editable from **Super Admin ▸ Email
Templates**, and are rendered server-side. SMTP failure remains best-effort and cannot roll back the
business transition.

## Compatibility decisions

- Legacy email bodies are bilingual (English and Bahasa Indonesia). The corresponding vendor templates
  now retain that structure while using the Alamtri Geo Vendor Workspace / Vendor Onboarding naming.
- The old approval method sent the administrator a “vendor submitted revised data” message at the moment
  a reviewer requested revision. That wording did not match the event. ET-23 is sent when the vendor
  actually resubmits from `REPIR`, preserving the intended notification with the correct trigger.
- The legacy Identity scaffold also contains generic public self-registration / resend-confirmation
  emails. They are not mapped because Integrated Procurement deliberately uses invitation-only vendor
  registration: ET-12's secure invitation is the account-verification boundary, so adding a public
  confirmation flow would weaken the current access model.
- Existing administrator edits are preserved. On startup, a revised system template is upgraded only
  when its stored JSON still exactly matches the previous shipped default; newly added ET-22..ET-24 are
  inserted idempotently.
