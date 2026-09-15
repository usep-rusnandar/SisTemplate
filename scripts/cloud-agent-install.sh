#!/usr/bin/env bash
# Cloud Agent environment: idempotent repository bootstrap.
# Runs after the source is checked out. Installs system toolchains only when
# they are missing (so it is cheap on a warm snapshot), then refreshes project
# dependencies and builds the backend so the first `dotnet run` is fast.
#
# System dependencies (.NET SDK 10, SQL Server 2022, the OpenLDAP 2.5 shim and
# the sqlcmd client) are normally baked into the environment snapshot. This
# script re-installs them defensively so a cold VM also converges.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOTNET_DIR="/opt/dotnet"
SA_PASSWORD="${MSSQL_SA_PASSWORD:-Dev_Password123!}"

log() { printf '\n=== %s ===\n' "$1"; }

install_dotnet() {
  if [ -x "${DOTNET_DIR}/dotnet" ]; then
    return
  fi
  log "Installing .NET SDK 10"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
  chmod +x /tmp/dotnet-install.sh
  sudo /tmp/dotnet-install.sh --channel 10.0 --install-dir "${DOTNET_DIR}"
  sudo ln -sf "${DOTNET_DIR}/dotnet" /usr/local/bin/dotnet
}

install_sqlserver() {
  if [ -x /opt/mssql/bin/sqlservr ] && [ -x /opt/mssql-tools18/bin/sqlcmd ]; then
    return
  fi
  log "Installing SQL Server 2022 + client tools"
  curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc >/dev/null
  curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/mssql-server-2022.list | sudo tee /etc/apt/sources.list.d/mssql-server-2022.list >/dev/null
  curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list | sudo tee /etc/apt/sources.list.d/mssql-prod.list >/dev/null
  sudo apt-get update
  sudo ACCEPT_EULA=Y apt-get install -y mssql-server mssql-tools18 unixodbc-dev
}

install_openldap_shim() {
  # SQL Server 2022's engine links against OpenLDAP 2.5 (liblber-2.5.so.0), but
  # Ubuntu 24.04 ships OpenLDAP 2.6. Pull the 2.5 runtime libs from the jammy
  # package so /opt/mssql/bin/sqlservr can start.
  if [ -e /usr/lib/x86_64-linux-gnu/liblber-2.5.so.0 ]; then
    return
  fi
  log "Installing OpenLDAP 2.5 runtime shim for SQL Server"
  local deb="libldap-2.5-0_2.5.20+dfsg-0ubuntu0.22.04.1_amd64.deb"
  curl -fsSL -o "/tmp/${deb}" "http://archive.ubuntu.com/ubuntu/pool/main/o/openldap/${deb}"
  dpkg-deb -x "/tmp/${deb}" /tmp/libldap25
  sudo cp -av /tmp/libldap25/usr/lib/x86_64-linux-gnu/lib*2.5*.so* /usr/lib/x86_64-linux-gnu/
  sudo ldconfig
}

install_dotnet
install_sqlserver
install_openldap_shim

export PATH="${DOTNET_DIR}:${PATH}"

log "Installing frontend dependencies (npm ci)"
cd "${REPO_ROOT}/frontend"
npm ci

log "Restoring and building the backend (0 errors expected)"
cd "${REPO_ROOT}/backend"
dotnet build SisTemplate.slnx -c Debug

log "Install complete"
