# WORK.md — Backlog & working agreement

Single working board for this repo. **Read this at the start of every session.**

**Branching (updated 2026-09-14):** **`master` is the single long-lived branch** — the production trunk.
Do each change on a short-lived feature branch, open a pull request into `master`, and delete the branch
once it merges — do not leave stale branches standing. The former `development` integration branch is
retired (it only mirrored `master`), as is the earlier three-agent split. There is no module ownership
and no worktree isolation; scope comes from the task.

Repo root for git = `Code/` (this folder). Project root = its parent.

---

## 1. How to work now

1. **`master` is the only long-lived branch.** Production deploys from `master`. Start each task on a
   short-lived feature branch, open a pull request into `master`, and delete the branch once it merges.
   Do not leave extra remote branches standing.
2. **Verify before you commit.** Backend build **0 warnings / 0 errors**, and drive the real flow in the app
   for anything non-trivial. The legacy frontend has no build-time typecheck — Babel-parse every changed
   `.jsx` (see §4).
3. **Commit small and often**, conventional messages ending with the `Co-Authored-By:` trailer.
4. **Ship via pull request.** Push your feature branch and open a PR into `master`. Cloud Agents have a
   GitHub credential and push/PR directly. The local Windows box has no credential — `git push` there
   fails with `could not read Username`, so commit locally and push from a Cloud Agent (or have the user
   push `git -C D:/Projects/IntegratedProcurement/Code push`).
5. **Announce destructive data work** (bulk import, truncate, re-seed, data migration) and get the user's
   go-ahead before running it. The dev DB holds real test state.
6. **Deploy staging/production = Suite + the three module portals.** Never ship `contractone` alone.
   Production: `contractone`, `vendor-onboarding`, `proposal-tracker`, `contract-monitoring`.
   Staging: the matching `*-staging` hosts. Push `master` auto-deploys staging for Internal
   (`backend/**`/`frontend/**`) and Module Portals (`frontend/**`/`ModuleGateway/**`). Production is
   still manual — run **Deploy Internal** and **Deploy Module Portals** (all three). Vendor Workspace
   (`vendor-workspace`) is separate and only when asked.

---

## 2. Open items

| # | Task | Status | Notes |
|---|---|---|---|
| **C13** | **Vendor Approval Workflow in Master Data + per-step SLA** | **Awaiting user test** | Done 2026-08-02. Config moved out of the `VmWorkflowManager` modal into **Master Data ▸ Approval Workflow** (`ScreensVendorWorkflowMaster.jsx`, route `vendorWorkflow`), endpoints split into their own group gated on `masterData.vendorOnboarding.*`. Each step now carries a **working-day SLA** (`SlaDays`, nullable), versioned with the route because an activated version is immutable. Indicators in the approval queue (+ "Overdue only"), a step trail on the dossier, and a variance report at **Vendor ▸ Approval SLA**. Not included: proactive email reminders (deferred, needs a background job). |
| **C3** | **CIP — Termsheet F4 frontend** | **Awaiting user test (TERM→LOA∥CTR flow audited 2026-08-10)** | Step order is now **PROP→TIA→RFQ→NEGO→EVAL→TERM→LOA∥CTR**. Term Sheet source: Bid Evaluation (Tender/Pemilihan) or Negotiation (Penunjukan). Slash-bearing E-Proposal keys use query-string award/finalize and activity endpoints; slash-bearing auxiliary Tracker keys are canonicalized too, so completed-step document links, winner selection, and winner-only Term Sheet scope survive re-hydration. Tracker completion saves the award and snapshots E-Proposal material, while a CIP Officer opens/reopens cases through the CIP-permission endpoint. CIP screens hydrate domain cases without rewriting the destructive legacy projection, and show Award Result (not LOA) as the new-case Term Sheet source; case detail opens as a popup and the list exposes separate Req Date / Est Date columns. Term Sheet and Contract completion are backend-persisted CIP activities with selected completion dates and mandatory generated Term Sheet/final documents; UI state advances only after the domain command succeeds. Once every winner case for the proposal is complete, the linked Tracker activity is completed using the same date. Completing TERM opens **Letter of Award (LOA)** in Tracker and CTR in CIP in parallel, including idempotent repair of older completed TERM rows; recycling LOA does not lock its Contract sibling. LOA generation is winner-only, requires the matching completed CIP Term Sheet, displays its number/document as supporting data, maps Term Sheet scope/period/payment fields into the LOA, takes award value/percent from the backend, and persists Blob/form references for refresh/other browsers. Tracker list hydration now includes backend activities and LOA documents in one aggregate read. The Tracker matrix uses compact 5px header padding and narrower step/date/value/PIC/status columns. CIP cases originate only from award finalization; Tracker LOA is projected into the CIP Document Repository as a supporting document and no longer creates cases. Manual E-Proposal sync is available to Admin/Super Admin (global result toast) and Section Head Tracker (owned-list delta toast). E-Proposal `ContractType` is exposed as **Contract Type**. `ContractualType` remains stored but is not displayed or used until CIP template testing begins. Proposal materials stay live in the E-Proposal material view while work is in progress, are displayed with server-side paging (10/25/50/100 rows) in Proposal Detail, and `Satuan` supplies the Value currency. The recovered video-test transaction now shows TERM Completed plus LOA and Contract Open; Contract remains at Draft until a final document is registered and explicitly completed. Remaining: user/PIC test of LOA generation plus Draft through final Contract completion. |
| **V1** | Vendor Workspace — remaining fixes | Awaiting user test | Long fix list already applied; see git history for `frontend/src/modules/vendor-workspace/**`. |
| **V2** | Vendor Onboarding — remaining fixes | Awaiting user test | Latest: `f275b93`, `39a14ca`, `8914619`. |
| **VS-1** | **Vendor status chain `SBMIT` → `DEPHD-VDR` → `DIV-HD` → `APPRV`** | **Awaiting user test** | Done 2026-08-03. The versioned workflow engine is **deleted** (tables, entities, endpoints, config screen) — approval is routed by the `vendor-status` master set: `approverRoleCode` says who acts, `nextId` where an approval goes, `slaDays` the working-day target. Old→new code mapping: [`docs/vendor-status-mapping.md`](docs/vendor-status-mapping.md). Status columns are now `nvarchar(10)`. |
| **BUG-1** | **Proposal Tracker process-model loading** | **Fixed 2026-08-10** | Matrix crashed on `method.name` when `TRK_METHODS` was still empty pre-hydrate. Now: safe `trkMethodById` fallback, matrix waits for masters (“Loading process model…”), Proposals screen re-renders on `ag:tracker-master-loaded`. Operational Tracker/CIP roles can read `tracker-step` / `tracker-method` without receiving master-data management access. |
| **DEMO-1** | **Temporary E-Proposal video views** | **ACTIVE — REVERT AFTER VIDEO** | Video-recording override: `vw_ProposalHeader_sim`, `vw_ProposalVendor_sim`, and `vw_ProposalMaterial_sim`. After recording, restore the production names `vw_ProposalHeader`, `vw_ProposalVendor`, and `vw_ProposalMaterial`, then close this item. Production material view is expected to be aligned with the simulated column contract first. |
| **UI-1** | Large-screen / TV support | **Quick wins done; rest parked** | UAT said the app wasted big screens. Audit 2026-08-03: content was capped at a flat 1920 (43% of a 4K screen dead while a 26-column table still scrolled), only 1 of 14 media queries targets `min-width`, and 1132 font sizes are fixed px. Done in `eefbf68`: error boundary + width by page shape (dense = full viewport, otherwise 2560). **Parked:** the device actually used is Full HD at 100% scaling, where the width fix changes nothing — the real lever there is UI scale. Browser zoom at 150% (Chrome remembers it per origin, so only the TV is affected) tested fine by the user and is the accepted answer for now; verified the layout survives an effective 1280 and 960 viewport, where the existing small-screen rules take over. An in-app "display scale" setting is only worth building if kiosk mode or zoom resets become a problem. |
| **V3** | ~~Vendor Onboarding — Vendor Connect import~~ | **Removed 2026-09-03** | Cutover finished. Menu, APIs, runner, and `ConnectionStrings__VendorConnectConnection` are gone. Already-imported vendors and `VENDOR_CONNECT` source-system rows stay. Ariba Vendor Import (`vendorOnboarding.import`) is unchanged. |
| **CM-1** | Contract Monitoring — List of Material upload | Awaiting user feedback | Material Sync (SharePoint folder) + Contract Database Upload/View (paged), merged at `9eaa226`. |
| **CM-SP-1** | **SharePoint auth = App Registration overlay (temporary Go Live)** | **ACTIVE — revert when MI is OK** | Managed Identity Graph grants are still broken and the auth PIC is away. Staging + Production use App Registration `IntegratedProcurement-SharePoint` via App Setting `SharePoint__ClientSecret` (Kudu overlay; value is **not** in git). TenantId/ClientId/timeout=90 are already in `appsettings.Staging.json` / `appsettings.Production.json`. Apply: GitHub Action **Set SharePoint Client Secret** (`SET-BOTH`) after secret `SHAREPOINT_CLIENT_SECRET` matches the working App Registration value. Revert: **Clear SharePoint App Settings** (`CLEAR-BOTH`) once MI has `Sites.Selected` + site grant on `ProcurementSourcingDocument`. Blob uploads still use slot MI. |
| **DATA-2** | ~~`vendor-status` master vs domain codes~~ | **Done 2026-08-02** | Resolved the other way round, per the user: master data owns the vocabulary, so the code moved to it (`DRFT`→`DRAFT`, `BLCK`→`BLACK`, `APPR3` retired) and every vendor row was deleted, so no data migration was needed. `UNBLK` stays unused — un-blacklisting returns the vendor to `DRAFT`. |
| **DATA-1** | `ADM-CIP` permission drift | **Closed by CIP→Tracker role merge** | CIP roles (`ADM-CIP`, `DEPHD-CIP`, `SECHD-CIP`, `OFFCR-CIP`) are remapped onto the matching Tracker roles and retired. Tracker roles now hold `contractInitiationPlatform.*` + CIP master-data keys. The drifted ADM-CIP row is deleted by the idempotent seeder remap. |
| **FM/MP** | **Frontend modernization + multi-portal deploy (FM-1…FM-4, MP-0…MP-3)** | **Awaiting user test** | Suite + vendor no longer boot through Babel-in-browser. Internal screens are ES modules; Suite uses React Router kebab paths (`/proposal-tracker/proposals`, `/proposal-tracker/term-sheet`, …). Three module-portal Vite artifacts + leak-gates (CIP Azure host retired — Term Sheet lives in Tracker). One parameterized `ModuleGateway` (YARP allowlist = platform + one module). Auth cookies cannot be shared on `*.azurewebsites.net` — PIC Auth later; each host logs in separately. Azure App Services are **not** created here — see [`docs/multi-portal-deploy.md`](docs/multi-portal-deploy.md). |
| — | Standing | — | Tracker / CIP / Platform-Admin / Vendor / CM fixes as the user reports them from manual testing. |

**Not to be rebuilt without new input:** `C1`/`C2`/`C6` — the Tracker E-Proposal ingestion was fully reverted
at `b07ed23` because the external source query was wrong. Do not rebuild until the user supplies a corrected
query.

---

## 3. Recently completed — do not regress

- **CM-SP-1 temporary SharePoint App Registration overlay (2026-09-04)** — Go Live uses
  `SharePoint__ClientSecret` on `contractone` staging + production so Graph uses
  `ClientSecretCredential` instead of the broken Managed Identity path. Do **not** commit the
  secret. When the PIC restores MI grants, run **Clear SharePoint App Settings** and close this
  item. Do not run that clear workflow before MI is verified.
- **V3 Vendor Connect Import retired (2026-09-03)** — preview/commit/document-copy UI and APIs deleted.
  Saved menus prune `vendorConnectImport` via `RETIRED_MENU_KEYS`. Historical `VENDOR_CONNECT` batches
  remain excluded from the Ariba import list. Do not rebuild the cutover tool without a new request.
- **C12** RBAC Roles/Permissions UI (`db7178c`) — the permission catalog is now hydrated from the backend
  (`/administration/role-permissions`, `/super-admin/permissions`); `PERMISSION_MODULES` in `Data.jsx` is a
  **fallback only**. Never fabricate a permission set in the UI: those screens can write permissions. Role
  **detail** and role **permissions** go through separate endpoints (`PUT /roles/{code}` vs
  `PUT /roles/{code}/permissions`) so `roles.update` cannot rewrite access without `permissions.assign`.
  `ToastCtx`'s provider value is memoized — un-memoizing it reintroduces an infinite refetch loop.
- **C11** Roles page module filter · **C10** menu `requiredPermissions` always re-derived from
  `MENU_PERMISSIONS` · **C9** per-module master-data permissions · **C7** CIP rename
  (`contractInitiationPlatform` / `contract-initiation-platform`; DB schema `cip` and `ContractCIP*.jsx`
  names deliberately unchanged) · **C5** backend persistence gated behind an authenticated session (no
  pre-login 401 noise).
- **Approval = the status chain, no workflow engine** — `VendorApprovalService` + `VendorApprovalChain`
  read Master Data ▸ Vendor Status; the queue filters on "statuses my roles approve", the SLA clock is the
  newest `VENDOR_STATUS_T` row for the current status, and the variance report is derived from consecutive
  history rows. The V10 engine (`APPROVAL_WORKFLOW_T`, `_STEP_T`, `APPROVAL_INSTANCE_T`,
  `APPROVAL_DECISION_T`, its endpoints, and the Master Data ▸ Approval Workflow screen) is **deleted** —
  recover from git (`45ef9f9` … `bca83f6`) if it is ever wanted back. `MenuData.RETIRED_MENU_KEYS` prunes a
  retired screen from saved menu trees; add a key there whenever a screen is removed.
- **Per-screen Master Data permissions** (`61ae94c`) — `MasterDataScreens.cs` is the SoT: screen → record
  sets → default module, and each screen generates `masterData.{screenId}.view|manage`. Any admin role can
  be granted any screen from the Roles page; the module-wide keys remain the broad default (either
  unlocks). To restrict a role to specific screens, drop its module key. `MENU_PERMISSIONS` mirrors the
  pairs — keep both sides in sync when adding a screen.
- **Vendor status vocabulary = master data** — codes are `DRAFT`/`BLACK` (was `DRFT`/`BLCK`), `APPR3` is gone,
  and `CK_VENDOR_T_STATUS` was **dropped** because a frozen CHECK list would reject any status an admin adds
  to the master set. An approval step now carries its own `StatusCode` (validated against the master set on
  save); a step with none falls back to step 1 = `SBMIT`, step 2 = `APPR1`, step 3+ = `APPR2`. The vendor
  portal shows one "On Process" for every waiting status so a configured code never leaks to the vendor.
  **All vendor data was deleted on 2026-08-02 at the user's request** (2 vendors + children + 19 blobs +
  portal logins + invitations); the approval workflow definition and master data were kept.
- **Status labels from master data** (`0966c10`) — `GET /vendors/statuses` serves the `vendor-status` set;
  precedence is master → built-in `VM_STATUS` → raw code, and the badge tone stays in code. See DATA-2 for
  the code mismatch that still forces a fallback for `DRFT`/`BLCK`/`APPR3`.
- **C13** approval-workflow master data + working-day SLA — the SLA clock is **derived**, not stored:
  `max(instance.StartedAt, last decision)` starts it, and the current pass begins at the last
  `RevisionRequested` for an Active instance (legacy-inferred decisions leave `StartedAt` at the original
  submission, which used to mark the waiting step as already decided). Working days come from
  `IWorkingDayCalendarProvider` reading the `holiday` master-data set — reuse it for any other module SLA
  rather than counting calendar days. `_ensureCodeMenuNodes` is now a **generic** merge of `DEFAULT_MENU`
  into the persisted tree, so a newly shipped screen appears without a bespoke patch.
- **V10** dynamic versioned vendor approval workflow (`45ef9f9`) — immutable workflow definitions, ordered
  role-based steps, per-vendor pinned instances. `Vendor.Status` is now a compatibility projection.
  `vendorOnboarding.approve` is the **generic** permission for dynamic role-assigned steps; `approve1` /
  `approve2` / `approveFinal` remain compatibility keys pending a later separation. All four are legitimate
  entries in `PermissionKeys.cs` (45 keys total) — none of them is orphaned.

---

## 4. Runtime

```powershell
cd backend\src\AppHost
$env:ASPNETCORE_ENVIRONMENT="Development"
$env:ASPNETCORE_URLS="http://localhost:5055"
dotnet run --no-launch-profile
```

- Health: `GET http://localhost:5055/api/health/live` → `{"status":"Live"}`.
- Dev sign-in: `POST /api/v1/internal/auth/dev-login {"identifier":"00109610"}` (Super Admin USEP).
- Frontend: `npm run dev` in `frontend/` → port **8008**; the `/api` proxy already targets `5055`.
- `dotnet run` launches via `dotnet <dll>` in Debug (AppLocker blocks the apphost `.exe`) — normal. If a
  stale process locks the output, `dotnet build-server shutdown` releases the MSBuild/Roslyn file handles.
- Frontend validation (no build-time typecheck on the legacy `?raw` files):
  ```bash
  node -e "const p=require('@babel/parser'),fs=require('fs');p.parse(fs.readFileSync('<file>.jsx','utf8'),{sourceType:'script',plugins:['jsx']});console.log('OK')"
  ```

**Database.** One dev DB, `PROCUREMENT_DB`, connection in the **gitignored**
`backend/src/AppHost/appsettings.Development.json` (or env `INTEGRATED_PROCUREMENT_CONNECTION`). The app
**auto-migrates at startup** and re-runs the seeders, so seeders must stay **idempotent**. Prefer additive /
backward-compatible schema (new tables, new **nullable** columns). Now that there is a single branch, the
old serialize-the-migrations protocol is gone — just `dotnet ef migrations add`, review, build 0/0, run once
to apply, commit.

> `MigrateAsync()` lives **inside** both seeders, so "auto-migrates at startup" holds only while
> `DataSeeding:SeedInitialIam` / `SeedInitialPlatformData` are `true` (their default). Turning both off — as a
> deploy might, to skip seeding — also turns **migrations** off. See
> [deployment-cli.md §6](docs/deployment-cli.md); Azure CLI deploys have two more mandatory data steps there
> (the `vendor-status` approver-role patch and the legacy status-code rewrite), because the master-data seeder
> skips a set wholesale once it holds any record.

E-Proposal ingestion is reverted, so `EproposalConnection` is unused. The SMTP relay is unreachable from dev
machines and Azure blocks outbound :25 → test emails log as `Failed`. Expected, not a bug.

---

## 5. Conventions (non-negotiable)

> **BLOB AUTH — DO NOT CHANGE (locked 2026-09-08).**
> How the **app** talks to storage is not the same as how the **browser** gets a download/upload URL.
>
> | Environment | App → storage (credential) | Browser URL (optional SAS) |
> |---|---|---|
> | **Production** | **Managed Identity** + `AzureBlob:ServiceUri` (`stsisprodidc001`). No Account Key. | **No User Delegation SAS.** PIC keeps RBAC at **container** scope (accepted 2026-09-08). `canSignReadSas:false` is expected. Stream/proxy through AppHost is the production URL path. |
> | **Staging** | **Managed Identity** + `AzureBlob:ServiceUri` (`stsisdevidc001`, `KeyPrefix=staging`). Slot has its **own** MI. | User Delegation SAS works (`canSignReadSas:true`). Stream/proxy remains the fallback. |
> | **Development** | **Local disk** (`LocalFileDocumentStorage`). Default `UseLocalStorage=true`. Not Azure. | HMAC ticket that only *looks* like SAS (`/api/v1/documents/local`). **Not** Azure SAS. |
>
> Optional Dev-only override: `AzureBlob__UseLocalStorage=false` + `ConnectionString` (Account Key) → real Azure + **Service SAS** (shared key). Never put ConnectionString / Account Key on Staging or Production. Never `DefaultAzureCredential`. Do not “fix” production SAS by asking PIC to open account scope (they declined) or by switching to a key. Keep stream/proxy fallbacks — they are the production path. SoT: `AGENTS.md`, `DocumentsModule`, `BlobDocumentStorage`, `AzureBlobStorageMode`.

- **Module naming:** key = camelCase full (`contractInitiationPlatform`); URL = kebab full; permission =
  `moduleKey.action`. SoT = `ModuleKeys.cs` / `PermissionKeys.cs`.
- **RBAC:** permission is the single authz primitive. Menu + API + UI gate on permission keys; a role is just
  a bundle. `/auth/me` returns permissions; menu nodes carry `requiredPermissions` (ANY). The `roles: [...]`
  array on a menu node is legacy display metadata and does **not** gate.
- **Timezone (WIB):** store UTC (`DateTimeOffset.UtcNow`); display + day-boundary in Asia/Jakarta. Backend
  `JakartaTime`; frontend `fmtAppDate` / `fmtAppDateTime`. Never persist +7.
- **Blob cleanup:** deleting a record that owns a Blob document must delete the blob too.
- **Backend is source of truth:** email send + log are backend-owned; master/seed data comes from backend
  embedded JSON; the frontend reads via API.
- **Master-data payload:** the seeder writes `payloadJson` camelCase; frontend providers read keys
  case-insensitively.
- **Frontend is legacy React via runtime Babel** (`?raw`, single global scope). `Mockup/` sync is inert —
  edit `frontend/src/**` directly.
- **Cross-module reads go through ports** in the consumer's Application layer (e.g.
  `ITrackerBidEvaluationReadPort`); modules never reference each other's Infrastructure.
- **Email templates** are admin-editable and rendered server-side via `EmailTemplateNotifier` — never
  hardcode bodies.
- **Internal users are SSO-only** (no local password). Password/lockout policy is vendor-only.

---

## 6. Known tech debt

- **KV ↔ domain disconnect** — the Proposal Tracker and Contract Monitoring UIs still run largely on browser
  KV (`ag_tracker_*`, `ag_cm_contracts_v1`), disconnected from the `trk.*` / CM domain tables. Phase 1 done:
  completing Bid Evaluation (or Negotiation, for Penunjukan Langsung) PUTs the award result to
  `trk.AWARD_RESULT_*`. **Phase 2 pending:** repoint the remaining Tracker/CM reads onto the domain query
  endpoints. This is what blocks C3.
- **CIP documents** are stored as base64 dataURIs in module-state JSON — pending migration to Blob.
- **Roles page `Duplicate` and `Delete` are local-only** — they mutate the table in memory and revert on
  refresh; there is no backend delete/duplicate endpoint for roles.
- **SSO (SISWarrior)** is live behind the `SSO:Enabled` switch; `SsoMiddleware` handles the `?token=`
  callback (shape + expiry only — no signature check, per the security-team spec) and maps NRP→PersonnelNo.
  Multi-portal Staging uses per-host `redirectUrl` (`SSO:AllowedApplicationUrls`) because cookies cannot
  be shared on `*.azurewebsites.net`.

---

## 7. History

The three-agent parallel period (2026-07-29 → 2026-08-01) is recorded in git history — recoverable with
`git show <commit>:<path>`: `ONBOARDING-CLAUDE.md`, `ONBOARDING-CHATGPT.md`, `ONBOARDING-CURSOR-CM.md`,
`.cursorrules`, `HANDOFF-CURSOR-TO-COPILOT.md`, `docs/PARALLEL-AI-PLAYBOOK.md`, and earlier revisions of
this file. **`AGENTS.md` is back** as a short convention pointer (Blob auth lock + read `WORK.md` first).
It is **not** the old three-agent playbook.
