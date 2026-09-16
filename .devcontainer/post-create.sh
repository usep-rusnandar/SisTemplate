#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Restoring frontend dependencies..."
npm --prefix "${repo_root}/frontend" ci

echo "Restoring backend dependencies..."
dotnet restore "${repo_root}/backend/SisTemplate.slnx"

echo "Codespace setup complete. Start the API and frontend with the README commands."
