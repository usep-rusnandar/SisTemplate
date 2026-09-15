# AGENTS.md — SisTemplate

Read **`WORK.md` first** (board + full conventions). Architecture map: `CLAUDE.md`.

Branching: **`main`** is the single long-lived branch (production trunk). Work on short-lived
feature branches and open pull requests into `main`; delete each branch once merged. No module
ownership.

---

## BLOB AUTH pattern (documented example — adapt per real deployment)

How the **app** talks to storage does not have to be the same as how the **browser** gets a
download/upload URL. This template's `Documents` module supports the following shape; when you
stand up real Azure infrastructure for a new app built on this template, fill in your own storage
account names/scopes and keep this table up to date for that app.

| Environment | App → storage (credential) | Browser URL (optional SAS) |
|---|---|---|
| **Production** | **Managed Identity** + `AzureBlob:ServiceUri`. No Account Key. | If Azure RBAC is scoped at the **storage account** (or RG/subscription), User Delegation SAS works. If it's scoped at **container** only, `GetUserDelegationKey` cannot be granted, so `canSignReadSas` stays **false** and downloads/uploads go through **stream/proxy via AppHost** instead (Data Contributor on the container is enough for that path). Both are legitimate production configurations — pick whichever matches your real IAM grant. |
| **Staging** | **Managed Identity** + `AzureBlob:ServiceUri` (its own MI/slot identity, distinct from production). | Same account-vs-container-scope rule as production. |
| **Development** | **Local disk** (`LocalFileDocumentStorage`). Default `UseLocalStorage=true`. Not Azure. | HMAC ticket that only *looks* like SAS (`/api/v1/documents/local`). **Not** Azure SAS. |

Optional Dev-only override: `AzureBlob__UseLocalStorage=false` + `ConnectionString` (Account Key) →
real Azure + **Service SAS** (shared key) — useful for exercising the real-Azure path locally.

**Never (regardless of which deployment you adapt this to):**

- Put Account Key / `AzureBlob:ConnectionString` on Staging or Production.
- Use `DefaultAzureCredential` in place of the explicit Managed Identity wiring.
- "Fix" a container-scoped IAM limitation by switching to a key — that's a workaround, not a fix;
  keep the stream/proxy fallback instead.
- Assume Development uses Azure SAS — it does not (unless the override above is set).
- Remove the stream/proxy fallback endpoints; they are a supported production path, not dead code.

SoT: `Platform/Documents/Infrastructure/BlobDocumentStorage.cs`, `AzureBlobStorageMode.cs`. Full
table also in `WORK.md` §6 and `CLAUDE.md`.

Verify: `GET /api/v1/platform/blob-check` → `reachable:true`.

---

## Cursor Cloud specific instructions

Cloud Agent VMs run without systemd or Docker, so the dev stack is provisioned by two committed
scripts:

- **`scripts/cloud-agent-install.sh`** (environment `install`) — installs .NET SDK 10, SQL Server
  2022 + `sqlcmd`, and the OpenLDAP 2.5 runtime shim SQL Server needs on Ubuntu 24.04 (only when
  missing), then runs `npm ci` (frontend) and `dotnet build` (backend).
- **`scripts/cloud-agent-start.sh`** (environment `start`) — starts SQL Server directly (the
  `sqlservr` binary, no systemd), ensures the `SISTEMPLATE_DB` database and the gitignored
  `backend/src/AppHost/appsettings.Development.json` dev connection config exist, then launches
  the backend API (`:5055`) and Vite dev server (`:8008`) detached and idempotently. Safe to
  re-run.

Dev uses **local-disk** blob storage (`AzureBlob:UseLocalStorage=true`) — no Azure credentials,
consistent with the BLOB AUTH pattern above. The local SQL `sa` password is a throwaway
local-only credential (override with `MSSQL_SA_PASSWORD`); it is not a secret to any real system.

- Backend health: `GET http://localhost:5055/api/health/live` → `{"status":"Live"}`.
- Sign in (SSO off in dev): `POST /api/v1/internal/auth/dev-login {"identifier":"<id>"}`, enabled
  by `Auth:AllowPasswordlessDevLogin=true` in the dev config. Through the SPA at `:8008`, run
  `await window.__internalAuth.devLogin("<id>")` in the browser console, then reload.
- If a service is down, re-run `bash scripts/cloud-agent-start.sh` from the repo root; it only
  (re)starts what is not already responding.
- Unlike a locked-down local Windows dev box, `git push` works here (a GitHub credential is
  provided).
