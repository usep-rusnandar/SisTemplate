# Integrated Procurement - Phase 4 Data and Authentication Foundation

Tanggal: 2026-06-22
Status: generated data/auth foundation
Depends on:

- `Code/docs/phase-1-architecture.md`
- `Code/docs/phase-2-manifest-and-contracts.md`
- `Code/docs/phase-3-foundation-skeleton.md`

## 1. Scope

Phase 4 creates the backend foundation for database persistence and
authentication boundaries. Business workflows for Tracker, CIP, and Contract
Management are not implemented yet.

## 2. Backend Output

Generated:

- EF Core SQL Server persistence project.
- `ProcurementDbContext` with uppercase underscore table/column conventions.
- ASP.NET Core Identity mapped to vendor tables:
  - `USERS_T`
  - `ROLES_T`
  - `USER_ROLES_T`
  - `USER_CLAIMS_T`
  - `USER_LOGINS_T`
  - `USER_TOKENS_T`
  - `ROLE_CLAIMS_T`
- Internal identity tables:
  - `USER_T`
  - `SSO_NRP_MAPPING_T`
  - `iam.ROLE_T`
  - `iam.USER_ROLE_T`
  - `PERMISSION_T`
  - `iam.ROLE_PERMISSION_T`
- Vendor Onboarding tables:
  - `VENDOR_T`
  - `VENDOR_USER_T`
  - `INVITATION_T`
  - `INVITATION_ATTEMPT_T`
- SISWarrior SSO options, JWT helper, middleware, session keys, and NRP to
  `PERSONNEL_NO` mapping boundary.
- Vendor Identity role seeds:
  - `VENDOR_ADMIN`
  - `VENDOR_USER`
- Integration tests for health, foundation manifest, and SSO-disabled internal
  access behavior.

## 3. Identity Boundary

Internal users:

- External SSO sends NRP.
- `SSO_NRP_MAPPING_T` maps NRP to `PERSONNEL_NO`.
- `PERSONNEL_NO` is stored in session and used by domain, authorization, and
  audit.
- `USER_T` is separate from Identity tables.

Vendor users:

- ASP.NET Core Identity owns `USERS_T` and role tables.
- Vendor profile data is linked through `VENDOR_USER_T.IDENTITY_USER_ID`.
- Vendor users never use `PERSONNEL_NO`.

## 4. SSO Configuration Examples

Development mode:

```json
{
  "SSO": {
    "Enabled": false,
    "SsoUrl": "https://app-saptaindra.msappproxy.net/SISwarrior/auth/redirect",
    "ApplicationUrl": "http://localhost:5173/internal/sso/callback",
    "Application": "IntegratedProcurement"
  }
}
```

Production integrated mode:

```json
{
  "SSO": {
    "Enabled": true,
    "SsoUrl": "https://app-saptaindra.msappproxy.net/SISwarrior/auth/redirect",
    "ApplicationUrl": "https://your-app.example.com/internal/sso/callback",
    "Application": "IntegratedProcurement"
  }
}
```

## 5. Migration and SQL Scripts

Migration:

```text
Code/backend/src/Platform/Persistence/Migrations/20260622011116_InitialIdentityAndVendorFoundation.cs
```

Idempotent SQL script:

```text
Code/tools/database/phase4-initial-identity-vendor-schema.sql
```

Access function:

```text
Code/tools/database/cek-user-access-fn.sql
```

Local EF tool:

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet tool restore
dotnet tool run dotnet-ef migrations script --idempotent --project src\Platform\Persistence\IntegratedProcurement.Platform.Persistence.csproj --startup-project src\AppHost\IntegratedProcurement.AppHost.Api.csproj --context ProcurementDbContext --output ..\tools\database\phase4-initial-identity-vendor-schema.sql
```

## 6. Verification

Commands executed:

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet build --no-restore
dotnet test --no-build --no-restore

cd D:\Projects\IntegratedProcurement\Code\frontend
npm run build
npm run lint
```

Result:

- Backend build: pass, 0 warning, 0 error.
- Backend tests: pass, 3 tests.
- Frontend build: pass.
- Frontend lint: pass.

## 7. Next Slice

Recommended Phase 5:

1. Implement Vendor Invitation API behavior end to end.
2. Generate secure invitation code and hash.
3. Enforce one active invitation per email.
4. Register vendor user through ASP.NET Core Identity.
5. Create linked `VENDOR_T` and `VENDOR_USER_T`.
6. Log invitation attempts.
7. Add frontend wiring for invitation creation and registration.
