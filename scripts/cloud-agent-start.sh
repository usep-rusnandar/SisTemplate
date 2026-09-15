#!/usr/bin/env bash
# Cloud Agent environment: per-boot service startup.
# Reconciles the local SQL Server the backend needs, ensures the dev database
# and gitignored dev connection config exist, then launches the backend API and
# the Vite dev server (detached, idempotent) and returns. Safe to run on every
# boot and safe to re-run: services already up are left alone.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SA_PASSWORD="${MSSQL_SA_PASSWORD:-Dev_Password123!}"
DB_NAME="SISTEMPLATE_DB"
SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
DEV_SETTINGS="${REPO_ROOT}/backend/src/AppHost/appsettings.Development.json"
export PATH="/opt/dotnet:${PATH}"

log() { printf '\n=== %s ===\n' "$1"; }

# ---------------------------------------------------------------------------
# SQL Server
# ---------------------------------------------------------------------------
log "Starting SQL Server (if not already running)"
if ! pgrep -x sqlservr >/dev/null 2>&1; then
  sudo mkdir -p /var/opt/mssql
  sudo chown -R mssql:mssql /var/opt/mssql
  # Run the engine directly (no systemd in this VM). Detached so start returns.
  sudo -u mssql env ACCEPT_EULA=Y MSSQL_SA_PASSWORD="${SA_PASSWORD}" MSSQL_PID=Developer \
    nohup /opt/mssql/bin/sqlservr >/tmp/sqlservr.log 2>&1 &
fi

log "Waiting for SQL Server to accept connections"
for i in $(seq 1 60); do
  if "${SQLCMD}" -S localhost -U sa -P "${SA_PASSWORD}" -C -l 2 -Q "SELECT 1" >/dev/null 2>&1; then
    echo "SQL Server is ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "SQL Server did not become ready in time." >&2
    tail -n 40 /tmp/sqlservr.log >&2 || true
    exit 1
  fi
  sleep 2
done

log "Ensuring database ${DB_NAME} exists"
"${SQLCMD}" -S localhost -U sa -P "${SA_PASSWORD}" -C \
  -Q "IF DB_ID('${DB_NAME}') IS NULL CREATE DATABASE [${DB_NAME}];"

if [ ! -f "${DEV_SETTINGS}" ]; then
  log "Writing dev connection config (gitignored)"
  cat > "${DEV_SETTINGS}" <<JSON
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=${DB_NAME};User Id=sa;Password=${SA_PASSWORD};Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=True"
  },
  "AzureBlob": {
    "UseLocalStorage": true,
    "LocalRoot": "${REPO_ROOT}/.run/blob-storage"
  },
  "Auth": {
    "AllowPasswordlessDevLogin": true
  }
}
JSON
fi

# ---------------------------------------------------------------------------
# Backend API (http://localhost:5055) — auto-migrates + seeds on boot
# ---------------------------------------------------------------------------
log "Starting backend API (if not already running)"
if curl -fsS http://localhost:5055/api/health/live >/dev/null 2>&1; then
  echo "Backend already responding on :5055 — leaving it alone."
else
  (
    cd "${REPO_ROOT}/backend/src/AppHost"
    ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5055 \
      nohup dotnet run --no-launch-profile >/tmp/backend.log 2>&1 &
  )
  echo "Backend launching (logs: /tmp/backend.log). Waiting for health..."
  for i in $(seq 1 90); do
    if curl -fsS http://localhost:5055/api/health/live >/dev/null 2>&1; then
      echo "Backend is live on :5055."
      break
    fi
    [ "$i" -eq 90 ] && echo "Backend not healthy yet; see /tmp/backend.log." >&2
    sleep 2
  done
fi

# ---------------------------------------------------------------------------
# Frontend dev server (http://localhost:8008) — proxies /api to :5055
# ---------------------------------------------------------------------------
log "Starting frontend dev server (if not already running)"
if curl -fsS -o /dev/null http://localhost:8008/ >/dev/null 2>&1; then
  echo "Frontend already responding on :8008 — leaving it alone."
else
  (
    cd "${REPO_ROOT}/frontend"
    nohup npm run dev >/tmp/frontend.log 2>&1 &
  )
  echo "Frontend launching (logs: /tmp/frontend.log). Waiting for :8008..."
  for i in $(seq 1 30); do
    if curl -fsS -o /dev/null http://localhost:8008/ >/dev/null 2>&1; then
      echo "Frontend is serving on :8008."
      break
    fi
    [ "$i" -eq 30 ] && echo "Frontend not up yet; see /tmp/frontend.log." >&2
    sleep 2
  done
fi

log "Start complete — SQL Server, backend (:5055) and frontend (:8008) reconciled"
