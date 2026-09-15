# CLAUDE.md — IntegratedProcurement (project)

## Read WORK.md first
`WORK.md` is the working board — open items, conventions, runtime, tech debt. **Read it at the start of
every session.**

**Branching (updated 2026-09-14):** **`master` is the single long-lived branch** — the production
trunk. Start each task on a short-lived feature branch, open a pull request into `master`, and delete
the branch once it merges. The former `development` integration branch is retired (it only mirrored
`master`), as is the earlier three-agent split — no module ownership, no worktree isolation. You own
the whole repo.
- The whole codebase is yours to edit; scope discipline now comes from the task, not from ownership.
- **Verify before you commit:** backend build 0 warnings / 0 errors, and drive the real flow for anything
  non-trivial. The legacy `?raw` frontend has no build-time typecheck — Babel-parse changed `.jsx`.
- Commit small and often; conventional messages ending with the `Co-Authored-By:` trailer.
- **Ship via pull request.** Push your feature branch and open a PR into `master`. Cloud Agents have a
  GitHub credential and push directly; on the local Windows box `git push` still fails (no credential),
  so commit there and let the PR / Cloud Agent flow reach GitHub.
- **Announce destructive data work** (bulk import, truncate, re-seed, data migration) and get the user's
  go-ahead first. The app auto-migrates and re-seeds at startup, so seeders must stay idempotent.

## Architecture (quick map)
- Backend: .NET 10 / EF Core 10 / minimal APIs, modular monolith under `backend/src/Modules/*`; Azure SQL + Azure Blob.
  Cross-cutting: `AppHost/Program.cs`, `BuildingBlocks/Application/{ModuleKeys,PermissionKeys}.cs`,
  `Platform/Persistence/{Migrations,Seeding,Configurations}`.
- Frontend: legacy React via runtime Babel (`?raw`, single global scope) under `frontend/src/{modules,platform}/**`.
  No build-time typecheck on these — validate with eslint/Babel. `Mockup/` sync is inert; edit `frontend/src/**` directly.
- Modules don't reference each other's Infrastructure — cross-module reads go through **ports** in the consumer's
  Application layer (e.g. `ITrackerBidEvaluationReadPort` lets CIP read the Tracker award result). See `ARCHITECTURE.md`.

## Conventions (non-negotiable — full list in WORK.md §5)
- **BLOB AUTH — DO NOT CHANGE:** Production and Staging authenticate to Azure Blob with **Managed Identity**
  (`AzureBlob:ServiceUri` only — `stsisprodidc001` / `stsisdevidc001`). Development defaults to **local disk**,
  not Azure SAS. **Production IAM is container-scoped** (PIC will not open account scope): `canSignReadSas`
  stays false; stream/proxy is the production URL path. Staging can sign User Delegation SAS. Never Account
  Key on Staging/Production. Never `DefaultAzureCredential`. Full table: `AGENTS.md` and WORK.md §5.
- Module key = camelCase full; URL = kebab full; permission = `moduleKey.action` (SoT: `ModuleKeys.cs`/`PermissionKeys.cs`).
- RBAC = permission-driven (menu + API + UI gate on permission keys; role = bundle). `/auth/me` returns permissions.
- WIB: store UTC, display/day-boundary in Asia/Jakarta; `fmtAppDate`/`fmtAppDateTime` (FE), `JakartaTime` (BE); never persist +7.
- Backend is source of truth: no browser-storage outbox; seed from backend embedded JSON; email backend-owned +
  rendered from admin-editable templates (`EmailTemplateNotifier`) — never hardcode email bodies.
- Master-data payload: seeder writes `payloadJson` camelCase; frontend providers read payload/parent keys case-insensitively.
- Deleting a record that owns a Blob doc must delete the blob too.
- Internal users are SSO-only (no local password); password/lockout policy is vendor-only.

## Runtime
- `dotnet run` launches via `dotnet <dll>` in Debug (AppLocker blocks the apphost .exe). Health: `GET /api/health/live`.
  Dev sign-in: `POST /api/v1/internal/auth/dev-login {"identifier":"<NRP>"}` (e.g. `00109610`).
- Backend port **5055**; frontend `npm run dev` in `frontend/` on **8008** with its `/api` proxy already on 5055.
  If a stale process locks the build output, `dotnet build-server shutdown` releases the MSBuild/Roslyn handles.
- DB auto-migrates at startup; design-time factory reads env `INTEGRATED_PROCUREMENT_CONNECTION` (else LocalDB).
  Dev DB = `PROCUREMENT_DB`; its connection lives in the gitignored `appsettings.Development.json`. It holds
  real manual-test state accumulated during the three-agent period — don't wipe it without asking.
- Verify non-trivial changes end-to-end (build 0/0 + drive the flow) before commit. Commit messages end with the Co-Authored-By trailer.
- **Deploy staging/production includes the three module portals**, not only Suite (`contractone`).
  Production: contractone, vendor-onboarding, proposal-tracker, contract-monitoring. Staging uses the
  matching `*-staging` hosts. Vendor Workspace is separate.
- **SharePoint Go Live (CM-SP-1):** Suite uses App Registration client secret via App Setting
  `SharePoint__ClientSecret` (not in git) until Managed Identity Graph grants work. Apply /
  clear only through the SharePoint GitHub Actions — never commit the secret. Module portals
  do not need this setting.
