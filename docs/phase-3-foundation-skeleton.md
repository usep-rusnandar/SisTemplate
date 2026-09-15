# Integrated Procurement - Phase 3 Foundation Skeleton

Tanggal: 2026-06-22
Status: generated foundation skeleton
Depends on:

- `Code/docs/phase-1-architecture.md`
- `Code/docs/phase-2-manifest-and-contracts.md`

## 1. Scope

Phase 3 creates the first runnable backend and frontend foundation under
`Code/`. The goal is to prepare a production-oriented structure before module
business logic is migrated from the accepted mockup workflows.

## 2. Backend Output

Location: `Code/backend`

Generated:

- ASP.NET Core 10 solution.
- Modular Clean Architecture project layout.
- Building blocks for domain entities, result types, clock, current actor, and
  infrastructure dependency registration.
- AppHost API with CORS, OpenAPI, health endpoints, problem details,
  correlation id middleware, exception middleware, and route groups.
- Placeholder endpoint groups for internal auth, vendor auth, vendor
  invitations, Tracker, CIP, Contract Monitoring, and foundation manifest.
- Integration test project for AppHost health behavior.

## 3. Frontend Output

Location: `Code/frontend`

Generated:

- React/Vite/TypeScript foundation.
- `src/app` routing, providers, and shell layouts.
- `src/platform` API client, query client, runtime config, auth helpers, and
  navigation contracts.
- `src/shared` reusable status card and global styling.
- `src/modules` route placeholders for Tracker, CIP, Contract Monitoring,
  Vendor Invitations, and Vendor Workspace.
- `.env.example` for local API and SSO mode configuration.

## 4. Tools Output

Location: `Code/tools`

Generated:

- Database helper README.
- `CEK_USER_ACCESS_FN` SQL script using `PERSONNEL_NO`.

## 5. Verification Commands

Backend:

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet restore
dotnet build --no-restore
dotnet test --no-restore
```

Frontend:

```powershell
cd D:\Projects\IntegratedProcurement\Code\frontend
npm install
npm run build
npm run lint
```

## 6. Next Implementation Slice

Recommended next slice:

1. Add EF Core SQL Server infrastructure and naming conventions.
2. Implement internal SSO options, JWT helper, middleware, and session storage.
3. Implement internal `USER_T` access lookup using `PERSONNEL_NO`.
4. Implement vendor Identity tables mapped to `USERS_T`, `ROLES_T`,
   `USER_ROLES_T`, `USER_CLAIMS_T`, `USER_LOGINS_T`, and `USER_TOKENS_T`.
5. Implement vendor invitation registration flow.
