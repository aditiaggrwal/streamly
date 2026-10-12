#!/usr/bin/env bash
# Build Streamly and publish Hosting plus Cloud Functions.
# Functions require the Blaze plan. This ships hosting and every function
# in functions/ (watchLinks for /api/watch-links, and the existing invite preview).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

if [[ ! -f dist/index.html ]]; then
  echo "Build failed: dist/index.html not found" >&2
  exit 1
fi

npx --yes firebase-tools deploy --only hosting,functions --project streamly-167bd --non-interactive
echo "Published dist/ to Firebase Hosting and deployed Cloud Functions."
