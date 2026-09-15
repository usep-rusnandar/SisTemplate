# Phase 5 - Vendor Invitation Registration Flow

## Scope

Phase 5 implements invitation-only vendor onboarding across backend and the accepted `MockupVite` frontend structure.

Completed flow:

- Internal procurement creates a vendor invitation.
- Backend generates a secure one-time invitation code.
- Code is stored only as SHA-256 hash plus masked display value.
- Vendor validates the invitation code from `vendor.html`.
- Vendor registration creates:
  - `USERS_T` ASP.NET Identity user
  - `VENDOR_T`
  - `VENDOR_USER_T`
  - `USER_ROLES_T` assignment to `VENDOR_ADMIN`
- Invitation is marked `Registered` and cannot be reused.
- Invitation attempts are logged in `INVITATION_ATTEMPT_T`.

## Backend Endpoints

Internal invitation endpoints:

- `GET /api/v1/vendor-onboarding/invitations`
- `GET /api/v1/vendor-onboarding/invitations/{id}`
- `POST /api/v1/vendor-onboarding/invitations`
- `POST /api/v1/vendor-onboarding/invitations/{id}/resend`
- `POST /api/v1/vendor-onboarding/invitations/{id}/revoke`

Public registration endpoints:

- `POST /api/v1/public/vendor-registration/validate-invitation`
- `POST /api/v1/public/vendor-registration/register`

## Frontend Integration

`MockupVite` keeps the agreed modular structure and still syncs legacy mockup files from `Mockup/project/app`.

Integration points:

- `MockupVite/src/platform/api/vendorInvitationApi.ts`
- `MockupVite/src/app/bootstrap/internal.ts`
- `MockupVite/src/app/bootstrap/external.ts`
- `Mockup/project/app/VendorOnboardingData.jsx`
- `Mockup/project/app/ScreensVendorMore.jsx`
- `Mockup/project/app/VendorRegister.jsx`

The frontend uses backend API when available and falls back to localStorage demo data when unavailable.

## Local Runtime

Backend:

- URL: `http://localhost:5055`
- Database: `IntegratedProcurement` on LocalDB

Frontend:

- Preferred current URL: `http://127.0.0.1:5174`
- Vendor registration page: `http://127.0.0.1:5174/vendor.html`

Port `5174` is included for local development because another frontend may already occupy `5173`.

## Verification

Executed checks:

- `dotnet ef database update`
- `dotnet build Code\backend\src\AppHost\IntegratedProcurement.AppHost.Api.csproj --no-restore --disable-build-servers -m:1 -v:minimal`
- `dotnet test Code\backend\tests\AppHost\IntegratedProcurement.AppHost.Api.IntegrationTests.csproj --no-restore --disable-build-servers -m:1 -v:minimal`
- `npm run build` in `MockupVite`
- `npm run lint` in `MockupVite`
- Runtime smoke test:
  - create invitation
  - validate invitation
  - register vendor
  - confirm reused invitation returns `used`
  - confirm CORS preflight from `http://127.0.0.1:5174`
