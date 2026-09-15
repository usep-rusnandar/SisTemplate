#!/usr/bin/env bash
# Blocks likely secrets from entering git history. Shared by the pre-commit hook (.githooks/pre-commit)
# and CI (.github/workflows/ci.yml). Heuristic, tuned to this repo's real risks — not a full DLP.
#
# Usage:
#   scripts/secret-scan.sh [file ...]   # scan the given files (pre-commit passes staged files)
#   scripts/secret-scan.sh              # no args -> scan all tracked files (CI)
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  mapfile -t FILES < <(git ls-files)
fi
[ "${#FILES[@]}" -eq 0 ] && { echo "secret-scan: nothing to scan"; exit 0; }

fail=0
report() { printf '  x %s\n' "$1"; fail=1; }

# 1) Filename checks (pure bash, no subprocess) — files that must never be committed.
for f in "${FILES[@]}"; do
  case "$f" in
    *.bak)                        report "$f — backup file (mirrors secrets); never commit";;
    *appsettings.Development.json) report "$f — local secret config must stay gitignored";;
    *.local.settings.json)        report "$f — local secret config must stay gitignored";;
    .env|.env.*|*/.env|*/.env.*)  report "$f — env secret file must stay gitignored";;
  esac
done

# 2) Content checks — one grep pass per pattern over the whole set (-I skips binaries).
scan() { printf '%s\0' "${FILES[@]}" | xargs -0 grep -InE "$1" 2>/dev/null; }

hits=$(scan 'AccountKey=[A-Za-z0-9+/]{20,}');     [ -n "$hits" ] && { report "Azure Storage AccountKey literal:"; echo "$hits" | sed 's/^/      /'; }
hits=$(scan 'subscription-key=[A-Za-z0-9]{20,}'); [ -n "$hits" ] && { report "Azure Maps subscription-key literal:"; echo "$hits" | sed 's/^/      /'; }
# Known leaked fragment, split so THIS file does not itself trip the scanner.
KNOWN_PW_FRAG='procur''ment@'
hits=$(printf '%s\0' "${FILES[@]}" | xargs -0 grep -InF "$KNOWN_PW_FRAG" 2>/dev/null); [ -n "$hits" ] && { report "known DB password literal (ROTATE it):"; echo "$hits" | sed 's/^/      /'; }
# Azure SQL connection string carrying a real password (the actual risk here): line targets a
# *.database.windows.net host AND has a Password= with a real value. Skips <PLACEHOLDER>, ..., …,
# %ENV%, empty — and localhost/test-fixture connstrings (no windows.net host) never match.
hits=$(scan 'database\.windows\.net' | grep -E "[Pp]assword=[^<%.;\"' ]" | grep -v '…' | grep -vE '\.\.\.')
[ -n "$hits" ] && { report "Azure SQL connection string with a real password:"; echo "$hits" | sed 's/^/      /'; }

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Secret scan FAILED. Keep secrets in appsettings.Development.json (gitignored) or env vars,"
  echo "never in tracked files. If this is a false positive, adjust scripts/secret-scan.sh."
  exit 1
fi
echo "secret-scan: clean (${#FILES[@]} files)"
