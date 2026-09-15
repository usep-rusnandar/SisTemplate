# AGENTS.md — IntegratedProcurement

Read **`WORK.md` first** (board + full conventions). Architecture map: `CLAUDE.md`.

Branching: **`master`** is the single long-lived branch (production trunk). Work on short-lived feature branches and open pull requests into `master`; delete each branch once merged. No module ownership.

---

## BLOB AUTH — DO NOT CHANGE (locked 2026-09-08)

How the **app** talks to storage is not the same as how the **browser** gets a download/upload URL.

| Environment | App → storage (credential) | Browser URL (optional SAS) |
|---|---|---|
| **Production** | **Managed Identity** + `AzureBlob:ServiceUri` (`stsisprodidc001`). No Account Key. | User Delegation SAS **does not work**. PIC keeps Azure RBAC at **container** scope (not the storage account). `GetUserDelegationKey` needs account (or RG/subscription) scope, so `canSignReadSas` stays **false**. Production download/upload URLs are **stream/proxy through AppHost** (Data Contributor on the container is enough). |
| **Staging** | **Managed Identity** + `AzureBlob:ServiceUri` (`stsisdevidc001`, `KeyPrefix=staging`). The **staging slot has its own MI**. | User Delegation SAS **does work** (`canSignReadSas:true` as of 2026-09-08). Stream/proxy remains the fallback. |
| **Development** | **Local disk** (`LocalFileDocumentStorage`). Default `UseLocalStorage=true`. Not Azure. | HMAC ticket that only *looks* like SAS (`/api/v1/documents/local`). **Not** Azure SAS. |

**Production IAM (accepted 2026-09-08):** PIC will **not** open storage-account scope. Do not re-ask unless the user asks. Do not “fix” this with an Account Key / connection string. Keep `TryCreateReadSasUriAsync` / `TryCreateWriteSasUriAsync` + `/documents/stream` / `upload-bytes` / avatar stream fallbacks — they are the production path, not a temporary workaround.

Optional Dev-only override: `AzureBlob__UseLocalStorage=false` + `ConnectionString` (Account Key) → real Azure + **Service SAS** (shared key).

**Never:**

- Put Account Key / `AzureBlob:ConnectionString` on Staging or Production.
- Use `DefaultAzureCredential`.
- “Fix” SAS by switching Azure slots to a key.
- Assume Development uses Azure SAS — it does not (unless the override above is set).
- Remove stream/proxy fallbacks.

SoT: `DocumentsModule`, `BlobDocumentStorage`, `AzureBlobStorageMode`. Full table also in `WORK.md` §5 and `CLAUDE.md`.

Verify: `GET /api/v1/platform/blob-check` → `reachable:true`. Production: `canSignReadSas:false` is **expected**. Staging: `canSignReadSas:true`.

---

## Cursor Cloud specific instructions

Cloud Agent VMs run without systemd or Docker, so the dev stack is provisioned by two committed scripts:

- **`scripts/cloud-agent-install.sh`** (environment `install`) — installs .NET SDK 10, SQL Server 2022 + `sqlcmd`, and the OpenLDAP 2.5 runtime shim SQL Server needs on Ubuntu 24.04 (only when missing), then runs `npm ci` (frontend) and `dotnet build` (backend).
- **`scripts/cloud-agent-start.sh`** (environment `start`) — starts SQL Server directly (the `sqlservr` binary, no systemd), ensures the `PROCUREMENT_DB` database and the gitignored `backend/src/AppHost/appsettings.Development.json` dev connection config exist, then launches the backend API (`:5055`) and Vite dev server (`:8008`) detached and idempotently. Safe to re-run.

Dev uses **local-disk** blob storage (`AzureBlob:UseLocalStorage=true`) — no Azure credentials, consistent with the BLOB AUTH rules above. The local SQL `sa` password is a throwaway local-only credential (override with `MSSQL_SA_PASSWORD`); it is not a secret to any real system.

- Backend health: `GET http://localhost:5055/api/health/live` → `{"status":"Live"}`.
- Sign in (SSO off in dev): `POST /api/v1/internal/auth/dev-login {"identifier":"00109610"}` (Super Admin), enabled by `Auth:AllowPasswordlessDevLogin=true` in the dev config. Through the SPA at `:8008`, run `await window.__internalAuth.devLogin("00109610")` in the browser console, then reload.
- If a service is down, re-run `bash scripts/cloud-agent-start.sh` from the repo root; it only (re)starts what is not already responding.
- Unlike the local Windows dev box, `git push` works here (a GitHub credential is provided).
