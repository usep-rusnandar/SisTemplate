# Frontend Backend Feature Checklist

Source of truth for UI/workflow parity:

- Read-only reference: `D:\Projects\IntegratedProcurement\Mockup`
- Read-only reference: `D:\Projects\IntegratedProcurement\MockupVite`
- Implementation workspace: `D:\Projects\IntegratedProcurement\Code`

## Rules

- Do not change files outside `Code`.
- `Code/frontend` must not use `localStorage`, `sessionStorage`, IndexedDB, or in-memory mock stores for business workflows.
- Browser state may hold only transient component state.
- Business data, workflow status, authorization, and identity must come from backend APIs.
- UI styling, layout density, colors, wording, and workflow sequence should follow `Mockup` / `MockupVite`.

## Completed Mockup Modules

### Proposal Tracker

- Dashboard, proposal list, proposal detail, distribute flow, date validation, SLA adjustment, status progression.
- Backend boundary: `/api/v1/tracker`.
- Production target: API-backed tracker pages in `Code/frontend/src/modules/proposal-tracker`.

### Contract Initiation Platform

- CIP dashboard, case/workflow screens, tracker-to-CIP handoff behavior, contract intelligence workflow.
- Backend boundary: `/api/v1/cip`.
- Production target: API-backed CIP pages in `Code/frontend/src/modules/contract-initiation-platform`.

### Contract Monitoring

- Contract dashboard, contract monitoring screens, import flow, contract record workflow.
- Backend boundary: `/api/v1/contracts`.
- Production target: API-backed contract pages in `Code/frontend/src/modules/contract-monitoring`.

## Phase 5 Module

### Vendor Invitation Registration

Internal procurement flow:

- List vendor invitations.
- Filter/search by company, email, PIC, category, invitation code, and status.
- Show status totals: total, awaiting registration, registered, expired/revoked.
- Create email-bound invitation.
- Resend invitation.
- Revoke invitation.
- Copy registration link only when a full one-time code is available from create/resend response.

Public vendor flow:

- Open `vendor.html?invite=<code>`.
- Validate invitation code through backend.
- Show invitation-only gate.
- Registration wizard:
  - Company
  - Legal and tax
  - Classification
  - Bank
  - Contact and login
  - Review
- Submit registration through backend.
- Backend creates Identity user, vendor, vendor user, role assignment, and marks invitation used.

Backend boundary:

- `GET /api/v1/vendor-onboarding/invitations`
- `GET /api/v1/vendor-onboarding/invitations/{id}`
- `POST /api/v1/vendor-onboarding/invitations`
- `POST /api/v1/vendor-onboarding/invitations/{id}/resend`
- `POST /api/v1/vendor-onboarding/invitations/{id}/revoke`
- `POST /api/v1/public/vendor-registration/validate-invitation`
- `POST /api/v1/public/vendor-registration/register`
- `POST /api/v1/vendor/auth/login`
- `GET /api/v1/vendor/auth/me`
- `POST /api/v1/vendor/auth/logout`

## On-Process Mockup Modules

### Vendor Onboarding

- Vendor master data, vendor profile, vendor connect master, read-only master screens.
- Backend boundary remains under `/api/v1/vendor-onboarding`.

### Vendor Workspace

- Vendor home, profile/submission workbench, vendor-facing account area.
- Backend boundary remains under `/api/v1/vendor-workspace` and `/api/v1/vendor/auth`.

### Platform Modules

- Administration: users, roles, permissions, modules, holiday, language, email templates/logs, settings, menus.
- Session/security shell, global search, notifications, account modals.
- Backend boundary remains under `/api/v1/platform` until split per platform subdomain.

## Current Implementation Priority

1. Remove browser storage based identity from `Code/frontend`.
2. Complete vendor auth backend cookie endpoints.
3. Complete API-driven vendor invitation page in `Code/frontend`.
4. Complete API-driven vendor registration page in `Code/frontend/vendor.html`.
5. Keep Tracker, CIP, and Contract pages as next API-backed modules after Phase 5.
