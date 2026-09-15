# Deployment (AppHost) from GitHub Actions — Publish Profile

> Deploy the **single internal deployable** (`AppHost`: API + internal SPA) to Azure App Service
> from GitHub **without** Microsoft Entra ID access.
> Workflow: [`.github/workflows/deploy-internal.yml`](../.github/workflows/deploy-internal.yml) —
> Actions: **Deploy Internal**.
>
> Auth: **Publish Profile** (not OIDC / App Registration).
>
> Trigger:
> - **automatic:** push to `main` (paths `backend/**`, `frontend/**`, or this workflow) → **staging**
> - **manual:** `workflow_dispatch` — choose `staging` or `production`

There is only one deployable in this template — `AppHost` — because the external vendor/portal
pattern has been removed. If your application later needs a second host, add a second workflow
following the same shape.

---

## 1. What the workflow does

1. Checkout the code (branch/tag/SHA).
2. `npm ci` + `npm run build` (frontend).
3. `dotnet publish` AppHost Release (the SPA is bundled into `wwwroot`).
4. Zip the publish output.
5. Deploy the zip with `azure/webapps-deploy` + **publish profile** (staging slot or production
   site).
6. Check `GET /api/health/live` (+ a snippet of `/api/v1/about`).

The workflow does **not** touch connection strings, Blob/other secrets, or
`ASPNETCORE_ENVIRONMENT` — those stay in App Service Configuration.

| Input `target` | Azure destination | Publish profile secret | GitHub Environment |
|---|---|---|---|
| `staging` | Slot `staging` | `AZUREWEBAPP_PUBLISHPROFILE_STAGING` | `staging` |
| `production` | Production site | `AZUREWEBAPP_PUBLISHPROFILE_PRODUCTION` | `production` |

> **Slot swap** (staging ↔ production without redeploying) is still done via Portal/CLI — §5.
> Deploying `production` uploads the zip directly to the production site.

---

## 2. Prerequisites (one-time)

### 2.1 In Azure — App Service ready

- The App Service exists.
- A **`staging`** deployment slot is created.
- App settings are filled in per slot/site.
- You have Portal permission to open the App Service/slot and **download the publish profile**
  (no Entra admin role required).

### 2.2 Download the publish profile

**Staging (must come from the slot, not the production site):**

1. Portal → App Service → **Deployment** → **Deployment slots** → click slot **`staging`**.
2. Slot Overview → **Get publish profile** / **Download publish profile**.
3. The `.PublishSettings` file (XML) is saved locally — **never** commit it to git.

**Production:**

1. Portal → App Service (the main site, not a slot).
2. Overview → **Download publish profile**.
3. Keep this file separate from the staging one.

> Staging and production profiles are **different**. Mixing them up deploys to the wrong
> environment.

### 2.3 In GitHub — Environments (recommended)

Repo → **Settings** → **Environments**:

| Name | Recommended |
|---|---|
| `staging` | Optional reviewers |
| `production` | **Required reviewers** |

### 2.4 In GitHub — Variables

**Settings** → **Secrets and variables** → **Actions** → **Variables**:

| Name | Example | Notes |
|---|---|---|
| `AZURE_WEBAPP_NAME` | `your-app-name` | App Service name |
| `AZURE_SLOT_NAME` | `staging` | Slot for the `staging` target (default `staging`) |

### 2.5 In GitHub — Secrets (publish profile XML)

**Settings** → **Secrets** → **New repository secret** (or Environment secret):

| Secret | Contents |
|---|---|
| `AZUREWEBAPP_PUBLISHPROFILE_STAGING` | **Entire** contents of the staging slot's publish profile (paste the XML) |
| `AZUREWEBAPP_PUBLISHPROFILE_PRODUCTION` | **Entire** contents of the production publish profile |

Open the `.PublishSettings` file in a text editor → select all → copy → paste into the secret
value. **Never** commit that file; never paste it into chat/tickets unless necessary.

### 2.6 If publish credentials are reset

Portal → App Service → **Reset publish profile** (or change the publishing password) → download
the **new** profile → update the GitHub secret. Deploys fail until the secret is updated.

---

## 3. Running a deploy

### 3.1 Automatic staging (push to `main`)

1. Make sure the secrets/variables in §2 are filled in.
2. Merge/push to **`main`** with changes under `backend/` or `frontend/` (or the workflow file).
3. Repo → **Actions** → **Deploy Internal** runs automatically → target **staging**.
4. Approve the `staging` Environment if prompted → wait for green (~5–15 min).

Pushes that only touch `docs/` etc. do **not** trigger a deploy (path filter).

### 3.2 Production / manual deploy

1. Repo → **Actions** → **Deploy Internal** → **Run workflow**.
2. **target:** `staging` or `production`; **ref** / **skip_health_check** optional.
3. Approve the Environment if prompted → wait for green.
4. After staging is verified → run again with **target** = `production` (or use a slot swap — §5).

### 3.3 DB / patches

The workflow does not run SQL. Migrations/seed run automatically at app startup.

---

## 4. Quick verification

```powershell
$H = "https://<your-app-name>-staging.azurewebsites.net"
curl.exe -s "$H/api/health/live"
curl.exe -s "$H/api/v1/about"
```

---

## 5. Alternative for production: slot swap

Once the staging slot is green:

```powershell
az webapp deployment slot swap `
  -g <resource-group> -n <your-app-name> `
  --slot staging --target-slot production
```

Or Portal → Deployment slots → Swap.

---

## 6. Don't use the App Service "Deployment Center → GitHub" option

That option uses Oryx on Azure and does **not** run `npm run build` → `dotnet publish` correctly
for this monorepo. Use the **Deploy Internal** workflow instead.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `AZUREWEBAPP_PUBLISHPROFILE_… is not set` | Secret missing / name typo | §2.5 |
| `AZURE_WEBAPP_NAME` not set | Variable missing | §2.4 |
| Deploy 401 / auth failed | Profile wrong, expired, or staging/prod swapped | Re-download from the **correct slot/site** → update the secret |
| Deploy succeeds but wrong environment | Staging profile used for production (or vice versa) | §2.2 — download from the staging slot vs. production site |
| Health check fails | App crashed / bad connection string / cold start | Check App Service logs; temporarily set `skip_health_check` |
| `/` is blank | Frontend build didn't make it into the publish output | Check the frontend build / backend publish log steps |
| Job stuck waiting for approval | Environment protection rule | Approve on the run's page |

---

## 8. Security (summary)

- The publish profile is a publishing credential — keep it only in GitHub Secrets.
- `production` Environment + required reviewers = a human gate.
- Application connection strings/secrets stay on the App Service, not in the publish profile
  (the profile is only used to push files).
- Never commit a `.PublishSettings` file ([SECURITY.md](../SECURITY.md)).
- If leaked: reset the publish profile in the Portal and update the GitHub secret.

---

## 9. TL;DR

1. Portal → staging slot → **Download publish profile** → paste into secret
   `AZUREWEBAPP_PUBLISHPROFILE_STAGING`.
2. Portal → production App Service → download profile → secret
   `AZUREWEBAPP_PUBLISHPROFILE_PRODUCTION`.
3. Variable `AZURE_WEBAPP_NAME` = your App Service name.
4. Push to `main` → staging deploys automatically; production stays a manual **Run workflow**.
5. Microsoft Entra ID is **not required**.

---

## 10. Note: OIDC (if Entra access becomes available later)

The OIDC path (App Registration + federated credential) is more "modern" but **requires**
Microsoft Entra ID access. This template uses **Publish Profile** because that access isn't always
available. Don't mix both paths in one workflow without coordinating.

---

*Set up §2 once. After that: push to `main` → staging; production → Actions → **Deploy Internal** →
target `production`.*
