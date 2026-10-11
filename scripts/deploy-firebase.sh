#!/usr/bin/env bash
# Build Streamly and publish dist/ to Firebase Hosting (site root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

if [[ ! -f dist/index.html ]]; then
  echo "Build failed: dist/index.html not found" >&2
  exit 1
fi

npx --yes firebase-tools deploy --only hosting --project streamly-167bd --non-interactive
echo "Published dist/ to Firebase Hosting."
