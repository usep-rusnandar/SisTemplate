# Security

## Secret handling — the one rule

**Never commit credentials.** Connection strings, DB passwords, Azure Storage account keys, Azure
Maps subscription keys, SharePoint client secrets, SMTP passwords, tokens — none of these belong in
tracked files.

Where they go instead:
- **Local dev:** `backend/src/AppHost/appsettings.Development.json` (gitignored) or environment
  variables (`ConnectionStrings__DefaultConnection`, `INTEGRATED_PROCUREMENT_CONNECTION` for `dotnet ef`).
- **Azure / servers:** App Service application settings / environment variables (never in the repo).

`appsettings.json` / `appsettings.Production.json` / `appsettings.Staging.json` are committed but must
contain only **non-secret** config (URLs, public client/tenant IDs) — secret fields stay blank and are
injected at runtime.

## Guardrails in this repo

1. **`.gitignore`** blocks `appsettings.Development.json`, `.env*`, `*.local.settings.json`, `*.bak`,
   `*.pfx`, `*.key`. (A `.gitignore` rule does NOT untrack an already-tracked file — remove it explicitly.)
2. **Pre-commit hook** (`.githooks/pre-commit` → `scripts/secret-scan.sh`) blocks a commit that adds a
   `.bak`/dev-config file or a line with an Azure SQL password, Storage `AccountKey`, or Maps
   `subscription-key`. **Enable it once per clone/worktree:**
   ```bash
   git config core.hooksPath .githooks
   ```
3. **CI** (`.github/workflows/ci.yml`) runs the same scanner on every push/PR, plus backend + frontend builds.

Run the scanner manually any time: `bash scripts/secret-scan.sh` (whole tree) or pass file paths.

## If a secret is committed / leaked

1. **Rotate it immediately** — assume it is compromised (rotation is the only real fix; scrubbing hides
   but does not un-leak).
2. Remove it from the working tree and from **history** (a `git rm` alone is not enough — old commits
   keep it). Use a fresh-baseline squash or `git filter-repo`, then force-push.
3. Verify: `git grep <fragment> $(git rev-list --all)` returns nothing.

### History note (2026-07)
The GitHub baseline was created by squashing prior local history into a single clean commit because a
DB credential (`appsettings.json.bak` + a handover doc) had been committed. **The exposed Azure SQL
password `procurementdbtes` should be rotated**, and `appsettings.Development.json` updated in each
worktree afterward.

## Reporting

Report a suspected leak or vulnerability privately to the project owner (do not open a public issue).
